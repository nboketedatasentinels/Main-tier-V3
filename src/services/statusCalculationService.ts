/**
 * Status Calculation Service
 * Computes learner status based on engagement metrics, activity history, and completion rates
 *
 * IMPORTANT: For 6-Week Power Journey, learners are ONLY flagged "at-risk" AFTER week 5
 * and only if they have NOT reached 40,000 points (the pass mark).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  // updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  LearnerStatusRecord,
  LearnerStatus,
  EngagementScore,
  EngagementMetrics,
  StatusCalculationConfig,
} from '@/types/monitoring'
import type { JourneyType } from '@/config/pointsConfig'
import { JOURNEY_META } from '@/config/pointsConfig'
import { JOURNEY_AT_RISK_WEEK_THRESHOLDS } from '@/utils/journeyDetection'
import { resolveJourneyType } from '@/utils/journeyType'

// Default configuration
const DEFAULT_CONFIG: StatusCalculationConfig = {
  at_risk: {
    daysSinceLastActivityMin: 7,
    daysSinceLastActivityMax: 14,
    engagementScoreThreshold: 40,
  },
  inactive: {
    daysSinceLastActivityMin: 14,
    engagementScoreThreshold: 20,
  },
  recovery: {
    daysInRecoveryBeforeActive: 7,
    pointsRequiredToRecover: 50,
  },
  alerts: {
    maxAlertsPerDay: 3,
    alertDebounceMinutes: 60,
    earlyWarningDaysBefore: 3,
  },
  recalculationIntervalMinutes: 60,
  metricsUpdateIntervalHours: 24,
}

/**
 * Calculate engagement score based on activity patterns
 * Score = (recentActivity * 0.4) + (completionRate * 0.3) + (consistency * 0.2) + (streakBonus * 0.1)
 */
export async function calculateEngagementScore(
  _userId: string,
  metrics: EngagementMetrics,
  journeyContext?: {
    currentWindowNumber: number
    windowPointsTarget: number
    completedWindows: number
  },
): Promise<EngagementScore> {
  // Recent activity score (last 7 days activity trend)
  const recentActivityScore =
    metrics.last7DaysPoints > 0
      ? Math.min(100, (metrics.last7DaysPoints / (journeyContext?.windowPointsTarget || 100)) * 100)
      : 0

  // Consistency score (based on weekly regularity)
  const weeklyRegularity = metrics.last7DaysActivityCount > 0 ? 85 : 0
  const consistencyScore = Math.min(100, weeklyRegularity + (metrics.weeklyTrend === 'stable' ? 15 : 0))

  // Completion rate score
  const completionRateScore = metrics.activitiesCompleted
    ? (metrics.activitiesCompleted / (metrics.activitiesAttempted || 1)) * 100
    : 0

  // Streak bonus (0-10 points)
  const streakBonus = Math.min(10, metrics.dailyActiveStreakDays)

  // Weighted calculation
  const score =
    recentActivityScore * 0.4 +
    completionRateScore * 0.3 +
    consistencyScore * 0.2 +
    streakBonus * 0.1

  return {
    score: Math.round(score),
    factors: {
      recentActivity: Math.round(recentActivityScore),
      completionRate: Math.round(completionRateScore),
      consistency: Math.round(consistencyScore),
      streakBonus,
    },
    calculatedAt: Timestamp.now(),
    nextRecalculationAt: Timestamp.fromDate(
      new Date(Date.now() + DEFAULT_CONFIG.metricsUpdateIntervalHours * 60 * 60 * 1000),
    ),
  }
}

/**
 * Determine learner status based on engagement and activity
 */
export function determineStatus(
  engagementScore: number,
  daysSinceLastActivity: number,
  previousStatus: LearnerStatus | undefined,
  recoveryStartedAt?: Timestamp,
  config: StatusCalculationConfig = DEFAULT_CONFIG,
): LearnerStatus {
  // Handle recovery status
  if (previousStatus === 'in_recovery' && recoveryStartedAt) {
    const recoveryDuration =
      (Date.now() - recoveryStartedAt.toDate().getTime()) / (1000 * 60 * 60 * 24)
    if (
      recoveryDuration >= config.recovery.daysInRecoveryBeforeActive &&
      daysSinceLastActivity <= 3
    ) {
      return 'active'
    }
    return 'in_recovery'
  }

  // Inactive status (highest threshold)
  if (
    daysSinceLastActivity >= config.inactive.daysSinceLastActivityMin &&
    engagementScore < config.inactive.engagementScoreThreshold
  ) {
    return 'inactive'
  }

  // At-risk status
  if (
    daysSinceLastActivity >= config.at_risk.daysSinceLastActivityMin &&
    daysSinceLastActivity < config.inactive.daysSinceLastActivityMin &&
    engagementScore < config.at_risk.engagementScoreThreshold
  ) {
    return 'at_risk'
  }

  // Active status (default)
  return 'active'
}

/**
 * Journey context for status determination
 */
export interface JourneyStatusContext {
  journeyType: JourneyType
  currentWeek: number
  totalPoints: number
}

/**
 * Enhanced status determination with 6-week journey-specific logic
 *
 * CRITICAL: For 6W journey, at-risk status is ONLY set after week 5
 * if the learner has not reached 40,000 points.
 *
 * This function handles the special case where a 6-week learner:
 * - In weeks 1-5: Uses standard engagement-based status (NOT points-based at-risk)
 * - In week 6+: Uses points-based at-risk if below 40,000 points
 */
export function determineStatusWithJourneyContext(
  engagementScore: number,
  daysSinceLastActivity: number,
  previousStatus: LearnerStatus | undefined,
  journeyContext: JourneyStatusContext,
  recoveryStartedAt?: Timestamp,
  config: StatusCalculationConfig = DEFAULT_CONFIG,
): LearnerStatus {
  const { journeyType, currentWeek, totalPoints } = journeyContext

  // ═══════════════════════════════════════════════════════════════════════════
  // 6-WEEK POWER JOURNEY SPECIAL HANDLING
  // ═══════════════════════════════════════════════════════════════════════════
  if (journeyType === '6W') {
    const PASS_MARK = JOURNEY_META['6W'].passMarkPoints // 40,000
    const AT_RISK_WEEK_THRESHOLD = JOURNEY_AT_RISK_WEEK_THRESHOLDS['6W'] // 4 (at-risk starts at week 5)

    // WEEKS 1-4: Use standard engagement-based status (NOT points-based at-risk)
    // We don't want to flag learners as at-risk due to points during these weeks
    if (currentWeek <= AT_RISK_WEEK_THRESHOLD) {
      // Handle recovery status
      if (previousStatus === 'in_recovery' && recoveryStartedAt) {
        const recoveryDuration =
          (Date.now() - recoveryStartedAt.toDate().getTime()) / (1000 * 60 * 60 * 24)
        if (
          recoveryDuration >= config.recovery.daysInRecoveryBeforeActive &&
          daysSinceLastActivity <= 3
        ) {
          return 'active'
        }
        return 'in_recovery'
      }

      // Only use engagement-based inactive status (not at_risk for points)
      if (
        daysSinceLastActivity >= config.inactive.daysSinceLastActivityMin &&
        engagementScore < config.inactive.engagementScoreThreshold
      ) {
        return 'inactive'
      }

      // During weeks 1-5, only flag as at_risk for engagement reasons (not points)
      if (
        daysSinceLastActivity >= config.at_risk.daysSinceLastActivityMin &&
        daysSinceLastActivity < config.inactive.daysSinceLastActivityMin &&
        engagementScore < config.at_risk.engagementScoreThreshold
      ) {
        return 'at_risk'
      }

      return 'active'
    }

    // WEEK 6+: Apply points-based at-risk logic
    // This is where the 6W-specific rule kicks in
    if (totalPoints < PASS_MARK) {
      return 'at_risk' // 6W specific: below 40,000 after week 5
    }

    // Learner has passed - they are active (or completing journey)
    return 'active'
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OTHER JOURNEY TYPES: Use standard logic with journey-aware thresholds
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if past the at-risk threshold for this journey type
  const atRiskThreshold = JOURNEY_AT_RISK_WEEK_THRESHOLDS[journeyType]
  const passMarkPoints = JOURNEY_META[journeyType].passMarkPoints

  // If past threshold and below pass mark, consider at-risk
  if (currentWeek > atRiskThreshold && totalPoints < passMarkPoints) {
    // Points-based at-risk for all journey types (after their specific threshold)
    return 'at_risk'
  }

  // Otherwise, use standard engagement-based determination
  return determineStatus(engagementScore, daysSinceLastActivity, previousStatus, recoveryStartedAt, config)
}

/**
 * Calculate days since last activity for a user
 */
export async function calculateDaysSinceLastActivity(userId: string): Promise<number> {
  try {
    const lastActivityQuery = query(
      collection(db, 'pointsLedger'),
      where('uid', '==', userId),
    )
    const snapshot = await getDocs(lastActivityQuery)

    if (snapshot.empty) {
      // No activity found, return high number
      return 999
    }

    // Get most recent activity
    const docs = snapshot.docs.sort(
      (a, b) => (b.data().createdAt as Timestamp).toDate().getTime() -
        (a.data().createdAt as Timestamp).toDate().getTime(),
    )

    const lastActivity = docs[0]
    const lastActivityDate = (lastActivity.data().createdAt as Timestamp).toDate()
    const daysSince = Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))

    return daysSince
  } catch (error) {
    console.error('Error calculating days since last activity:', error)
    return 999
  }
}

/**
 * Get current window progress for a user
 */
export async function getCurrentWindowProgress(
  userId: string,
  _orgId?: string,
): Promise<{
  currentWindowNumber: number
  pointsInWindow: number
  targetPoints: number
  percentage: number
}> {
  try {
    const profileRef = doc(db, 'profiles', userId)
    const profileSnap = await getDoc(profileRef)

    if (!profileSnap.exists()) {
      return {
        currentWindowNumber: 1,
        pointsInWindow: 0,
        targetPoints: 100,
        percentage: 0,
      }
    }

    const profile = profileSnap.data()
    const currentWindow = profile.currentWeek || 1
    const pointsInWindow = profile.totalPoints || 0
    const targetPoints = 100 // Default weekly target

    return {
      currentWindowNumber: currentWindow,
      pointsInWindow,
      targetPoints,
      percentage: Math.round((pointsInWindow / targetPoints) * 100),
    }
  } catch (error) {
    console.error('Error getting current window progress:', error)
    return {
      currentWindowNumber: 1,
      pointsInWindow: 0,
      targetPoints: 100,
      percentage: 0,
    }
  }
}

/**
 * Fetch engagement metrics for a user
 */
export async function getEngagementMetrics(userId: string, daysBack: number = 30): Promise<EngagementMetrics> {
  try {
    // Query points ledger for activity
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    const pointsQuery = query(
      collection(db, 'pointsLedger'),
      where('uid', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(cutoffDate)),
    )

    const snapshot = await getDocs(pointsQuery)
    const activities = snapshot.docs.map((doc) => ({
      points: doc.data().points,
      createdAt: doc.data().createdAt as Timestamp,
    }))

    // Calculate metrics
    const today = new Date().toISOString().split('T')[0]
    const pointsEarned = activities.reduce((sum, a) => sum + a.points, 0)
    const activitiesCompleted = activities.length

    // Rolling metrics
    const last7DaysDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const last7Days = activities.filter((a) => a.createdAt.toDate() >= last7DaysDate)

    const last14DaysDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const last14Days = activities.filter((a) => a.createdAt.toDate() >= last14DaysDate)

    return {
      id: `${userId}-${today}`,
      userId,
      date: today,
      pointsEarned,
      activitiesCompleted,
      activitiesAttempted: activitiesCompleted,
      dailyActiveStreakDays: activitiesCompleted > 0 ? 1 : 0,
      isActiveToday: activitiesCompleted > 0,
      last7DaysPoints: last7Days.reduce((sum, a) => sum + a.points, 0),
      last14DaysPoints: last14Days.reduce((sum, a) => sum + a.points, 0),
      last30DaysPoints: pointsEarned,
      last7DaysActivityCount: last7Days.length,
      last14DaysActivityCount: last14Days.length,
      last30DaysActivityCount: activitiesCompleted,
      dailyAverage: Math.round(pointsEarned / daysBack),
      weeklyTrend: last7Days.length >= last14Days.length / 2 ? 'stable' : 'decreasing',
      createdAt: Timestamp.now(),
    }
  } catch (error) {
    console.error('Error fetching engagement metrics:', error)
    return {
      id: `${userId}-error`,
      userId,
      date: new Date().toISOString().split('T')[0],
      pointsEarned: 0,
      activitiesCompleted: 0,
      activitiesAttempted: 0,
      dailyActiveStreakDays: 0,
      isActiveToday: false,
      last7DaysPoints: 0,
      last14DaysPoints: 0,
      last30DaysPoints: 0,
      last7DaysActivityCount: 0,
      last14DaysActivityCount: 0,
      last30DaysActivityCount: 0,
      dailyAverage: 0,
      weeklyTrend: 'decreasing',
      createdAt: Timestamp.now(),
    }
  }
}

/**
 * Calculate complete learner status and update database
 *
 * IMPORTANT: Uses journey-aware status determination for 6-week journeys.
 * For 6W journey, at-risk is only flagged after week 5 if points < 40,000.
 */
export async function calculateAndUpdateLearnerStatus(
  userId: string,
  orgId?: string,
): Promise<LearnerStatusRecord | null> {
  try {
    // Get previous status
    const statusRef = doc(db, 'learner_status', userId)
    const previousStatusSnap = await getDoc(statusRef)
    const previousStatus = previousStatusSnap.data() as LearnerStatusRecord | undefined

    // ═══════════════════════════════════════════════════════════════════════════
    // GET USER PROFILE FOR JOURNEY CONTEXT
    // ═══════════════════════════════════════════════════════════════════════════
    const profileRef = doc(db, 'profiles', userId)
    const profileSnap = await getDoc(profileRef)

    let journeyType: JourneyType = '3M' // Default fallback
    let currentWeek = 1
    let totalPoints = 0

    if (profileSnap.exists()) {
      const profile = profileSnap.data()
      totalPoints = profile.totalPoints ?? 0
      currentWeek = profile.currentWeek ?? 1

      // Resolve journey type from profile or organization
      const resolvedOrgId = orgId ?? profile.companyId ?? profile.organizationId

      if (profile.journeyType) {
        journeyType = profile.journeyType as JourneyType
      } else if (resolvedOrgId) {
        // Check organization for journey type
        const orgRef = doc(db, 'organizations', resolvedOrgId)
        const orgSnap = await getDoc(orgRef)

        if (orgSnap.exists()) {
          const orgData = orgSnap.data()
          const resolved = resolveJourneyType({
            journeyType: orgData.journeyType,
            programDurationWeeks: orgData.programDurationWeeks,
            programDuration: orgData.programDuration,
          })
          if (resolved) {
            journeyType = resolved
          }
        }
      }
    }

    // Calculate metrics
    const metrics = await getEngagementMetrics(userId)
    const daysSinceLastActivity = await calculateDaysSinceLastActivity(userId)
    const windowProgress = await getCurrentWindowProgress(userId, orgId)
    const engagementScore = await calculateEngagementScore(userId, metrics)

    // ═══════════════════════════════════════════════════════════════════════════
    // USE JOURNEY-AWARE STATUS DETERMINATION
    // For 6W journey: at-risk only after week 5 if < 40,000 points
    // ═══════════════════════════════════════════════════════════════════════════
    const newStatus = determineStatusWithJourneyContext(
      engagementScore.score,
      daysSinceLastActivity,
      previousStatus?.currentStatus,
      {
        journeyType,
        currentWeek,
        totalPoints,
      },
      previousStatus?.recoveryStartedAt,
    )

    // Calculate consistency score (weekly checkins)
    const consistencyScore = Math.min(100, metrics.last7DaysActivityCount * 15)

    // ═══════════════════════════════════════════════════════════════════════════
    // CALCULATE JOURNEY-SPECIFIC AT-RISK DATA
    // ═══════════════════════════════════════════════════════════════════════════
    const passMarkPoints = JOURNEY_META[journeyType].passMarkPoints
    const pointsDeficit = Math.max(0, passMarkPoints - totalPoints)
    const atRiskThreshold = JOURNEY_AT_RISK_WEEK_THRESHOLDS[journeyType]

    // Determine if this is a points-based at-risk (vs engagement-based)
    const isPointsBasedAtRisk =
      newStatus === 'at_risk' && currentWeek > atRiskThreshold && totalPoints < passMarkPoints

    // Build journey at-risk reason string
    let journeyAtRiskReason: string | undefined
    if (isPointsBasedAtRisk) {
      if (journeyType === '6W') {
        journeyAtRiskReason = `6W Journey: ${totalPoints.toLocaleString()} points < ${passMarkPoints.toLocaleString()} pass mark (week ${currentWeek})`
      } else {
        journeyAtRiskReason = `${journeyType}: ${totalPoints.toLocaleString()} < ${passMarkPoints.toLocaleString()} pass mark`
      }
    }

    // Prepare updated record
    const statusRecord: LearnerStatusRecord = {
      id: userId,
      userId,
      orgId,
      currentStatus: newStatus,
      previousStatus: previousStatus?.currentStatus,
      statusChangedAt: newStatus !== previousStatus?.currentStatus ? Timestamp.now() : previousStatus?.statusChangedAt || Timestamp.now(),
      engagementScore: engagementScore.score,
      completionRate: metrics.activitiesAttempted > 0 ? (metrics.activitiesCompleted / metrics.activitiesAttempted) * 100 : 0,
      consistencyScore,
      lastActivityDate: metrics.isActiveToday ? Timestamp.now() : previousStatus?.lastActivityDate,
      daysSinceLastActivity,
      currentWindowNumber: windowProgress.currentWindowNumber,
      pointsInCurrentWindow: windowProgress.pointsInWindow,
      targetPointsForWindow: windowProgress.targetPoints,
      windowProgressPercentage: windowProgress.percentage,
      recoveryStartedAt:
        newStatus === 'in_recovery' && previousStatus?.currentStatus !== 'in_recovery'
          ? Timestamp.now()
          : previousStatus?.recoveryStartedAt,
      recoveryNotificationSent:
        newStatus === 'in_recovery' ? (previousStatus?.recoveryNotificationSent || false) : false,
      consecutiveActiveWeeks: newStatus === 'active' ? (previousStatus?.consecutiveActiveWeeks || 0) + 1 : 0,
      alertsSentToday: 0,
      missedDeadlineCount: 0,
      // Journey-specific fields
      journeyType,
      currentWeek,
      totalPoints,
      journeyPassMarkPoints: passMarkPoints,
      pointsBasedAtRisk: isPointsBasedAtRisk,
      journeyAtRiskReason,
      pointsDeficit: isPointsBasedAtRisk ? pointsDeficit : undefined,
      updatedAt: Timestamp.now(),
      calculatedAt: Timestamp.now(),
    }

    // Save to Firestore
    await setDoc(statusRef, statusRecord, { merge: true })

    // Log status change if it occurred
    if (newStatus !== previousStatus?.currentStatus && previousStatus?.currentStatus) {
      await logStatusChange(userId, previousStatus.currentStatus, newStatus, orgId)
    }

    return statusRecord
  } catch (error) {
    console.error('Error calculating learner status:', error)
    return null
  }
}

/**
 * Log status transition to history
 */
async function logStatusChange(
  userId: string,
  previousStatus: LearnerStatus,
  newStatus: LearnerStatus,
  orgId?: string,
): Promise<void> {
  try {
    const historyCollection = collection(db, 'learner_status_history')
    const historyRecord = {
      userId,
      orgId,
      previousStatus,
      newStatus,
      reason: `Automatic transition from ${previousStatus} to ${newStatus}`,
      engagementScore: 0,
      daysSinceActivity: 0,
      triggeredAutomationRules: [],
      createdAt: Timestamp.now(),
    }

    await setDoc(doc(historyCollection), historyRecord)
  } catch (error) {
    console.error('Error logging status change:', error)
  }
}

/**
 * Batch calculate status for all active users in an organization
 */
export async function calculateOrgLearnerStatuses(orgId: string): Promise<{
  calculated: number
  statusChanges: number
  errors: number
}> {
  try {
    const usersQuery = query(
      collection(db, 'profiles'),
      where('companyId', '==', orgId),
    )

    const snapshot = await getDocs(usersQuery)
    let calculated = 0
    let statusChanges = 0
    let errors = 0

    for (const userDoc of snapshot.docs) {
      try {
        const previousStatus = await getDoc(doc(db, 'learner_status', userDoc.id))
        const prevStatusData = previousStatus.data() as LearnerStatusRecord | undefined

        const newStatusRecord = await calculateAndUpdateLearnerStatus(userDoc.id, orgId)
        if (newStatusRecord) {
          calculated++
          if (newStatusRecord.currentStatus !== prevStatusData?.currentStatus) {
            statusChanges++
          }
        }
      } catch (error) {
        console.error(`Error calculating status for user ${userDoc.id}:`, error)
        errors++
      }
    }

    return { calculated, statusChanges, errors }
  } catch (error) {
    console.error('Error in batch status calculation:', error)
    return { calculated: 0, statusChanges: 0, errors: 1 }
  }
}

/**
 * Get status for a specific user
 */
export async function getLearnerStatus(userId: string): Promise<LearnerStatusRecord | null> {
  try {
    const statusRef = doc(db, 'learner_status', userId)
    const snapshot = await getDoc(statusRef)

    if (!snapshot.exists()) {
      return null
    }

    return snapshot.data() as LearnerStatusRecord
  } catch (error) {
    console.error('Error getting learner status:', error)
    return null
  }
}

/**
 * Get all at-risk learners in an organization
 */
export async function getAtRiskLearners(
  orgId: string,
): Promise<LearnerStatusRecord[]> {
  try {
    const statusQuery = query(
      collection(db, 'learner_status'),
      where('orgId', '==', orgId),
      where('currentStatus', '==', 'at_risk'),
    )

    const snapshot = await getDocs(statusQuery)
    return snapshot.docs.map((doc) => doc.data() as LearnerStatusRecord)
  } catch (error) {
    console.error('Error fetching at-risk learners:', error)
    return []
  }
}

/**
 * Get recovery candidates (recently recovered learners)
 */
export async function getRecoveryCandidates(orgId: string, hoursBack: number = 24): Promise<LearnerStatusRecord[]> {
  try {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

    const statusQuery = query(
      collection(db, 'learner_status'),
      where('orgId', '==', orgId),
      where('currentStatus', '==', 'in_recovery'),
      where('recoveryStartedAt', '>=', Timestamp.fromDate(cutoffTime)),
    )

    const snapshot = await getDocs(statusQuery)
    return snapshot.docs.map((doc) => doc.data() as LearnerStatusRecord)
  } catch (error) {
    console.error('Error fetching recovery candidates:', error)
    return []
  }
}
