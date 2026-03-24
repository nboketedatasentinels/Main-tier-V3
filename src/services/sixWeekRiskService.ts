/**
 * 6-Week Journey Risk Service
 *
 * Specialized service for evaluating "at-risk" status specifically
 * for the 6-Week Power Journey.
 *
 * KEY RULES:
 * - Learners are flagged "at-risk" STARTING at week 5 (gives them time to recover)
 * - Only if they have NOT reached 40,000 points (the pass mark)
 * - This is separate from engagement-based inactivity detection
 */

import { doc, getDoc, getDocs, collection, query, where, Timestamp, setDoc, updateDoc, deleteField, addDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { JourneyType } from '@/config/pointsConfig'
import { JOURNEY_META } from '@/config/pointsConfig'
import { detectJourneyFromOrganization, is6WeekJourneyAtRisk } from '@/utils/journeyDetection'
import { sendStatusChangeNotification } from './statusNotificationService'

// Constants
const SIX_WEEK_PASS_MARK = 40000

/**
 * 6-Week journey specific "at risk" evaluation result
 */
export interface SixWeekRiskEvaluation {
  userId: string
  journeyType: JourneyType
  currentWeek: number
  totalPoints: number
  passMarkPoints: number
  pointsDeficit: number
  isAtRisk: boolean
  reason: string
  evaluatedAt: Timestamp
  // Projection data
  requiredWeeklyAverage: number
  weeksRemaining: number
  canStillPass: boolean
}

/**
 * Batch evaluation result for an organization
 */
export interface OrganizationRiskEvaluationResult {
  orgId: string
  journeyType: JourneyType | null
  evaluated: number
  atRisk: SixWeekRiskEvaluation[]
  passed: number
  notYetEvaluable: number
  errors: number
  evaluatedAt: Timestamp
}

/**
 * Calculate the current week of a learner's journey
 */
export function calculateCurrentWeek(
  journeyStartDate: Date | Timestamp | string | null | undefined,
  referenceDate: Date = new Date()
): number {
  if (!journeyStartDate) {
    return 1
  }

  const startDate =
    journeyStartDate instanceof Timestamp
      ? journeyStartDate.toDate()
      : typeof journeyStartDate === 'string'
        ? new Date(journeyStartDate)
        : journeyStartDate

  if (isNaN(startDate.getTime())) {
    return 1
  }

  const diffMs = referenceDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const currentWeek = Math.floor(diffDays / 7) + 1

  return Math.max(1, currentWeek)
}

/**
 * Get organization data with journey type
 */
async function getOrganizationJourneyData(
  orgId: string
): Promise<{ journeyType: JourneyType; passMarkPoints: number } | null> {
  try {
    const orgRef = doc(db, 'organizations', orgId)
    const orgSnap = await getDoc(orgRef)

    if (!orgSnap.exists()) {
      return null
    }

    const orgData = orgSnap.data()
    const detection = detectJourneyFromOrganization({
      journeyType: orgData.journeyType,
      programDurationWeeks: orgData.programDurationWeeks,
      programDuration: orgData.programDuration,
    })

    return {
      journeyType: detection.journeyType,
      passMarkPoints: detection.passMarkPoints,
    }
  } catch (error) {
    console.error('[6W Risk] Error getting org journey data:', error)
    return null
  }
}

/**
 * Evaluate if a specific user in the 6-week journey is "at risk"
 *
 * This is the PRIMARY function to call for 6-week at-risk evaluation
 */
export async function evaluateSixWeekLearnerRisk(userId: string): Promise<SixWeekRiskEvaluation | null> {
  try {
    // 1. Get user profile
    const profileRef = doc(db, 'profiles', userId)
    const profileSnap = await getDoc(profileRef)

    if (!profileSnap.exists()) {
      console.error(`[6W Risk] Profile not found for user: ${userId}`)
      return null
    }

    const profile = profileSnap.data()
    const totalPoints = profile.totalPoints ?? 0
    const journeyStartDate = profile.journeyStartDate
    const orgId = profile.companyId ?? profile.organizationId

    // 2. Determine journey type
    let journeyType: JourneyType = (profile.journeyType as JourneyType) ?? '3M'

    // If no explicit journey type on profile, check organization
    if (!profile.journeyType && orgId) {
      const orgJourneyData = await getOrganizationJourneyData(orgId)
      if (orgJourneyData) {
        journeyType = orgJourneyData.journeyType
      }
    }

    // 3. Only proceed for 6-week journeys
    if (journeyType !== '6W') {
      return null // Not a 6-week journey - no evaluation needed
    }

    // 4. Calculate current week
    const currentWeek = journeyStartDate ? calculateCurrentWeek(journeyStartDate) : (profile.currentWeek ?? 1)

    // 5. Get 6W metadata
    const meta = JOURNEY_META['6W']
    const passMarkPoints = meta.passMarkPoints // 40,000
    const totalWeeks = meta.weeks // 6

    // 6. Evaluate at-risk status
    const riskResult = is6WeekJourneyAtRisk({
      journeyType,
      currentWeek,
      totalPoints,
    })

    // 7. Calculate projections
    const weeksRemaining = Math.max(0, totalWeeks - currentWeek + 1)
    const pointsDeficit = Math.max(0, passMarkPoints - totalPoints)
    const requiredWeeklyAverage = weeksRemaining > 0 ? Math.ceil(pointsDeficit / weeksRemaining) : pointsDeficit

    // Can still pass if required weekly average is achievable
    // Weekly target for 6W is 7,000, max possible per week ~10,000
    const canStillPass = requiredWeeklyAverage <= 10000

    return {
      userId,
      journeyType,
      currentWeek,
      totalPoints,
      passMarkPoints,
      pointsDeficit,
      isAtRisk: riskResult.isAtRisk,
      reason: riskResult.reason ?? 'No evaluation',
      evaluatedAt: Timestamp.now(),
      requiredWeeklyAverage,
      weeksRemaining,
      canStillPass,
    }
  } catch (error) {
    console.error('[6W Risk] Error evaluating learner risk:', error)
    return null
  }
}

/**
 * Check if a learner was previously flagged as at-risk
 */
async function wasLearnerAtRisk(userId: string): Promise<boolean> {
  try {
    const statusRef = doc(db, 'learner_status', userId)
    const statusSnap = await getDoc(statusRef)

    if (!statusSnap.exists()) return false

    const data = statusSnap.data()
    return data?.currentStatus === 'at_risk' && data?.pointsBasedAtRisk === true
  } catch {
    return false
  }
}

/**
 * Clear at-risk status if learner has now passed
 *
 * IMPORTANT: This function checks if a learner who was previously at-risk
 * has now reached the pass mark (40,000 points) and clears their at-risk status.
 *
 * @returns true if status was cleared, false otherwise
 */
export async function clearAtRiskIfPassed(userId: string): Promise<{
  cleared: boolean
  reason: string
}> {
  try {
    // Get current status
    const statusRef = doc(db, 'learner_status', userId)
    const statusSnap = await getDoc(statusRef)

    if (!statusSnap.exists()) {
      return { cleared: false, reason: 'No status record found' }
    }

    const statusData = statusSnap.data()

    // Only proceed if currently at-risk due to points
    if (statusData.currentStatus !== 'at_risk' || !statusData.pointsBasedAtRisk) {
      return { cleared: false, reason: 'Not currently at-risk due to points' }
    }

    // Check if this is a 6W journey
    if (statusData.journeyType !== '6W') {
      return { cleared: false, reason: 'Not a 6-week journey' }
    }

    // Get current total points from profile
    const profileRef = doc(db, 'profiles', userId)
    const profileSnap = await getDoc(profileRef)

    if (!profileSnap.exists()) {
      return { cleared: false, reason: 'Profile not found' }
    }

    const profile = profileSnap.data()
    const totalPoints = profile.totalPoints ?? 0

    // Check if learner has now passed
    if (totalPoints >= SIX_WEEK_PASS_MARK) {
      // Clear at-risk status
      await updateDoc(statusRef, {
        currentStatus: 'active',
        previousStatus: 'at_risk',
        pointsBasedAtRisk: false,
        journeyAtRiskReason: deleteField(),
        pointsDeficit: 0,
        statusChangedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      // Send recovery notification
      await sendRecoveryNotification(userId, totalPoints)

      return {
        cleared: true,
        reason: `Passed: ${totalPoints.toLocaleString()} >= ${SIX_WEEK_PASS_MARK.toLocaleString()} points`,
      }
    }

    return {
      cleared: false,
      reason: `Still below pass mark: ${totalPoints.toLocaleString()} < ${SIX_WEEK_PASS_MARK.toLocaleString()}`,
    }
  } catch (error) {
    console.error('[6W Risk] Error clearing at-risk status:', error)
    return { cleared: false, reason: 'Error occurred' }
  }
}

/**
 * Send notification when learner is newly flagged as at-risk
 */
async function sendAtRiskNotification(
  userId: string,
  evaluation: SixWeekRiskEvaluation,
  orgId?: string
): Promise<void> {
  try {
    // Create status alert
    await addDoc(collection(db, 'status_alerts'), {
      userId,
      orgId,
      type: 'six_week_at_risk',
      title: 'Action Required: You\'re at risk of not completing your journey',
      message: `You currently have ${evaluation.totalPoints.toLocaleString()} points and need ${evaluation.pointsDeficit.toLocaleString()} more to pass. With ${evaluation.weeksRemaining} week(s) remaining, focus on completing activities to reach 40,000 points.`,
      severity: 'critical',
      channels: ['in_app', 'email'],
      status: 'pending',
      metadata: {
        currentPoints: evaluation.totalPoints,
        pointsNeeded: evaluation.pointsDeficit,
        weeksRemaining: evaluation.weeksRemaining,
        passMarkPoints: SIX_WEEK_PASS_MARK,
        currentWeek: evaluation.currentWeek,
        canStillPass: evaluation.canStillPass,
      },
      actionRequired: true,
      createdAt: Timestamp.now(),
    })

    // Create in-app notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'engagement_alert',
      title: 'Action Required: You\'re at risk',
      message: `You have ${evaluation.totalPoints.toLocaleString()} points and need ${evaluation.pointsDeficit.toLocaleString()} more to reach the pass mark of 40,000 points.`,
      read: false,
      metadata: {
        currentPoints: evaluation.totalPoints,
        pointsNeeded: evaluation.pointsDeficit,
        weeksRemaining: evaluation.weeksRemaining,
      },
      createdAt: Timestamp.now(),
    })

    // Also send via status notification service
    await sendStatusChangeNotification({
      userId,
      previousStatus: 'active',
      newStatus: 'at_risk',
      engagementScore: 0, // Points-based, not engagement-based
      daysSinceActivity: 0,
      suggestedActions: [
        'Complete your podcast workbooks for 2,000 points each',
        'Attend the weekly session for 1,500 points',
        'Submit impact log entries for 2,000 points each',
        'Complete LIFT course modules for 7,000 points each',
      ],
    })

    console.log(`[6W Risk] Sent at-risk notification to user ${userId}`)
  } catch (error) {
    console.error('[6W Risk] Error sending at-risk notification:', error)
  }
}

/**
 * Send recovery notification when learner passes after being at-risk
 */
async function sendRecoveryNotification(userId: string, totalPoints: number): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'achievement',
      title: 'Congratulations! You\'ve reached the pass mark!',
      message: `Amazing work! You've earned ${totalPoints.toLocaleString()} points and passed the 6-Week Power Journey requirement of 40,000 points!`,
      read: false,
      metadata: {
        totalPoints,
        passMarkPoints: SIX_WEEK_PASS_MARK,
        journeyType: '6W',
      },
      createdAt: Timestamp.now(),
    })

    console.log(`[6W Risk] Sent recovery notification to user ${userId}`)
  } catch (error) {
    console.error('[6W Risk] Error sending recovery notification:', error)
  }
}

/**
 * Full evaluation and update for a single learner
 *
 * This function:
 * 1. Evaluates the learner's risk status
 * 2. Checks if they were previously at-risk
 * 3. If newly at-risk: flags them and sends notification
 * 4. If was at-risk but now passed: clears flag and sends recovery notification
 */
export async function evaluateAndUpdateLearnerRisk(userId: string): Promise<{
  evaluation: SixWeekRiskEvaluation | null
  statusChanged: boolean
  action: 'flagged' | 'cleared' | 'unchanged' | 'not_applicable'
}> {
  // First, check if they should be cleared (they might have earned points)
  const clearResult = await clearAtRiskIfPassed(userId)
  if (clearResult.cleared) {
    // Re-evaluate to get current state
    const evaluation = await evaluateSixWeekLearnerRisk(userId)
    return {
      evaluation,
      statusChanged: true,
      action: 'cleared',
    }
  }

  // Evaluate risk
  const evaluation = await evaluateSixWeekLearnerRisk(userId)

  if (!evaluation) {
    return {
      evaluation: null,
      statusChanged: false,
      action: 'not_applicable',
    }
  }

  // Check previous status
  const wasAtRisk = await wasLearnerAtRisk(userId)

  if (evaluation.isAtRisk && !wasAtRisk) {
    // NEWLY at-risk - flag and notify
    const profileSnap = await getDoc(doc(db, 'profiles', userId))
    const orgId = profileSnap.data()?.companyId

    // Update status
    const statusRef = doc(db, 'learner_status', userId)
    await setDoc(
      statusRef,
      {
        userId,
        currentStatus: 'at_risk',
        previousStatus: 'active',
        journeyType: '6W',
        currentWeek: evaluation.currentWeek,
        totalPoints: evaluation.totalPoints,
        journeyPassMarkPoints: SIX_WEEK_PASS_MARK,
        pointsBasedAtRisk: true,
        journeyAtRiskReason: evaluation.reason,
        pointsDeficit: evaluation.pointsDeficit,
        statusChangedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        calculatedAt: Timestamp.now(),
      },
      { merge: true }
    )

    // Send notification
    await sendAtRiskNotification(userId, evaluation, orgId)

    return {
      evaluation,
      statusChanged: true,
      action: 'flagged',
    }
  }

  return {
    evaluation,
    statusChanged: false,
    action: 'unchanged',
  }
}

/**
 * Batch evaluate all 6-week journey learners in an organization
 */
export async function evaluateOrganizationSixWeekRisk(orgId: string): Promise<OrganizationRiskEvaluationResult> {
  const result: OrganizationRiskEvaluationResult = {
    orgId,
    journeyType: null,
    evaluated: 0,
    atRisk: [],
    passed: 0,
    notYetEvaluable: 0,
    errors: 0,
    evaluatedAt: Timestamp.now(),
  }

  try {
    // 1. First, verify this is a 6-week organization
    const orgJourneyData = await getOrganizationJourneyData(orgId)

    if (!orgJourneyData) {
      console.error(`[6W Risk] Organization not found: ${orgId}`)
      return result
    }

    result.journeyType = orgJourneyData.journeyType

    // Skip if not a 6-week journey organization
    if (orgJourneyData.journeyType !== '6W') {
      console.log(`[6W Risk] Org ${orgId} is ${orgJourneyData.journeyType}, skipping 6W evaluation`)
      return result
    }

    // 2. Get all learners in this organization
    const usersQuery = query(collection(db, 'profiles'), where('companyId', '==', orgId))

    const usersSnap = await getDocs(usersQuery)

    // 3. Evaluate each learner
    for (const userDoc of usersSnap.docs) {
      try {
        const evaluation = await evaluateSixWeekLearnerRisk(userDoc.id)

        if (!evaluation) {
          result.errors++
          continue
        }

        result.evaluated++

        if (evaluation.isAtRisk) {
          result.atRisk.push(evaluation)
        } else if (evaluation.currentWeek <= 4) {
          result.notYetEvaluable++ // Weeks 1-4 are not yet evaluable
        } else {
          result.passed++
        }
      } catch (error) {
        console.error(`[6W Risk] Error evaluating user ${userDoc.id}:`, error)
        result.errors++
      }
    }

    return result
  } catch (error) {
    console.error('[6W Risk] Error in batch evaluation:', error)
    return result
  }
}

/**
 * Get all at-risk learners for a 6-week organization
 *
 * This function:
 * 1. Verifies the org is a 6W journey
 * 2. Finds all learners past week 5
 * 3. Returns those with < 40,000 points
 */
export async function getSixWeekAtRiskLearners(
  orgId: string
): Promise<{ learners: SixWeekRiskEvaluation[]; total: number }> {
  const evaluation = await evaluateOrganizationSixWeekRisk(orgId)
  return {
    learners: evaluation.atRisk,
    total: evaluation.evaluated,
  }
}

/**
 * Save at-risk evaluation result to Firestore for tracking
 */
export async function saveRiskEvaluation(evaluation: SixWeekRiskEvaluation): Promise<void> {
  try {
    const evalRef = doc(db, 'sixWeekRiskEvaluations', `${evaluation.userId}_${evaluation.evaluatedAt.toMillis()}`)
    await setDoc(evalRef, evaluation)
  } catch (error) {
    console.error('[6W Risk] Error saving evaluation:', error)
  }
}

/**
 * Check if a user is in a 6-week journey
 */
export async function isUserIn6WeekJourney(userId: string): Promise<boolean> {
  try {
    const profileRef = doc(db, 'profiles', userId)
    const profileSnap = await getDoc(profileRef)

    if (!profileSnap.exists()) {
      return false
    }

    const profile = profileSnap.data()

    // Check profile journey type first
    if (profile.journeyType === '6W') {
      return true
    }

    // Check organization journey type
    const orgId = profile.companyId ?? profile.organizationId
    if (orgId) {
      const orgJourneyData = await getOrganizationJourneyData(orgId)
      return orgJourneyData?.journeyType === '6W'
    }

    return false
  } catch (error) {
    console.error('[6W Risk] Error checking user journey:', error)
    return false
  }
}

/**
 * Get points needed to pass for a 6W learner
 */
export function getPointsNeededToPass(totalPoints: number): number {
  const PASS_MARK = 40000
  return Math.max(0, PASS_MARK - totalPoints)
}

/**
 * Calculate projection for a 6W learner
 */
export function calculate6WProjection(params: {
  currentWeek: number
  totalPoints: number
}): {
  weeksRemaining: number
  pointsNeeded: number
  requiredWeeklyAverage: number
  canStillPass: boolean
  projectedFinalPoints: number
  weeklyTarget: number
} {
  const { currentWeek, totalPoints } = params
  const PASS_MARK = 40000
  const TOTAL_WEEKS = 6
  const WEEKLY_TARGET = 7000
  const MAX_WEEKLY_POINTS = 10000

  const weeksRemaining = Math.max(0, TOTAL_WEEKS - currentWeek + 1)
  const pointsNeeded = Math.max(0, PASS_MARK - totalPoints)
  const requiredWeeklyAverage = weeksRemaining > 0 ? Math.ceil(pointsNeeded / weeksRemaining) : pointsNeeded

  // Calculate projected final points based on current pace
  const currentWeeklyAverage = currentWeek > 0 ? totalPoints / currentWeek : 0
  const projectedFinalPoints = Math.round(currentWeeklyAverage * TOTAL_WEEKS)

  return {
    weeksRemaining,
    pointsNeeded,
    requiredWeeklyAverage,
    canStillPass: requiredWeeklyAverage <= MAX_WEEKLY_POINTS,
    projectedFinalPoints,
    weeklyTarget: WEEKLY_TARGET,
  }
}
