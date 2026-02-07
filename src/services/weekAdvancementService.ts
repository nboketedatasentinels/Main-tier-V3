import { collection, query, where, getDocs, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { UserProfile } from '@/types'
import { JourneyType, JOURNEY_META } from '@/config/pointsConfig'
import { getWindowRange, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'
import { PointsVerificationRequest } from '@/services/pointsVerificationService'

export type CriteriaType = 'points_threshold' | 'window_completion' | 'approval_required'

export interface AdvancementCriteria {
  criteriaType: CriteriaType
  isMet: boolean
  currentValue: number
  requiredValue: number
  blockingReason?: string
  label: string
}

export interface AdvancementEligibility {
  isEligible: boolean
  currentWeek: number
  nextWeek: number
  criteria: AdvancementCriteria[]
  pendingApprovals: PointsVerificationRequest[]
  blockers: string[]
  progressPercentage: number
}

/**
 * Checks if a user is eligible to advance to the next week.
 *
 * Criteria for advancement:
 * 1. Points threshold: Must have earned at least 67% of weekly target
 * 2. Window completion: If at end of 2-week window, must meet window target
 * 3. No pending approvals: All partner-approved activities must be resolved
 *
 * @param userId - The user ID
 * @param profile - The user's profile
 * @returns Promise<AdvancementEligibility> - Eligibility status with detailed criteria
 */
export async function checkWeekAdvancementEligibility(
  userId: string,
  profile: UserProfile
): Promise<AdvancementEligibility> {
  const currentWeek = profile.currentWeek ?? 1
  const nextWeek = currentWeek + 1
  const journeyType = profile.journeyType
  const programDurationWeeks = profile.programDurationWeeks ?? JOURNEY_META[journeyType].weeks

  // Don't allow advancement beyond program duration
  if (currentWeek >= programDurationWeeks) {
    return {
      isEligible: false,
      currentWeek,
      nextWeek: currentWeek, // Stay on current week
      criteria: [],
      pendingApprovals: [],
      blockers: ['Journey complete - no further weeks available'],
      progressPercentage: 100
    }
  }

  const criteria: AdvancementCriteria[] = []
  const blockers: string[] = []

  // Get journey metadata
  const journeyMeta = JOURNEY_META[journeyType]
  const weeklyTarget = journeyMeta.weeklyTarget
  const thresholdPct = journeyMeta.completionThresholdPct ?? 67
  const requiredPoints = Math.floor((weeklyTarget * thresholdPct) / 100)

  // 1. Check Points Threshold for Current Week
  const weeklyProgress = await getWeeklyProgress(userId, currentWeek)
  const pointsEarned = weeklyProgress?.pointsEarned ?? 0

  const pointsCriteria: AdvancementCriteria = {
    criteriaType: 'points_threshold',
    isMet: pointsEarned >= requiredPoints,
    currentValue: pointsEarned,
    requiredValue: requiredPoints,
    label: `Weekly Points (${thresholdPct}% target)`
  }

  if (!pointsCriteria.isMet) {
    blockers.push(`Need ${requiredPoints - pointsEarned} more points to meet ${thresholdPct}% threshold`)
  }

  criteria.push(pointsCriteria)

  // 2. Check Window Completion (if at end of 2-week window)
  const windowRange = getWindowRange(currentWeek, programDurationWeeks, PARALLEL_WINDOW_SIZE_WEEKS)
  const isEndOfWindow = currentWeek === windowRange.endWeek

  if (isEndOfWindow) {
    const windowProgress = await getWindowProgress(userId, journeyType, windowRange.windowNumber)
    const windowPoints = windowProgress?.pointsEarned ?? 0
    const windowTarget = windowRange.windowWeeks * weeklyTarget
    const windowRequiredPoints = Math.floor((windowTarget * thresholdPct) / 100)

    const windowCriteria: AdvancementCriteria = {
      criteriaType: 'window_completion',
      isMet: windowPoints >= windowRequiredPoints,
      currentValue: windowPoints,
      requiredValue: windowRequiredPoints,
      label: `Window ${windowRange.windowNumber} Total (${windowRange.windowWeeks} weeks)`
    }

    if (!windowCriteria.isMet) {
      blockers.push(`Need ${windowRequiredPoints - windowPoints} more window points (${thresholdPct}% of ${windowTarget})`)
    }

    criteria.push(windowCriteria)
  }

  // 3. Check Pending Approvals for Current Week
  const pendingApprovals = await getPendingApprovals(userId, currentWeek)

  const approvalCriteria: AdvancementCriteria = {
    criteriaType: 'approval_required',
    isMet: pendingApprovals.length === 0,
    currentValue: pendingApprovals.length,
    requiredValue: 0,
    label: 'Pending Partner Approvals'
  }

  if (!approvalCriteria.isMet) {
    blockers.push(`${pendingApprovals.length} activity approval${pendingApprovals.length > 1 ? 's' : ''} pending`)
  }

  criteria.push(approvalCriteria)

  // Calculate overall eligibility
  const isEligible = criteria.every(c => c.isMet) && blockers.length === 0
  const metCriteriaCount = criteria.filter(c => c.isMet).length
  const progressPercentage = criteria.length > 0 ? Math.round((metCriteriaCount / criteria.length) * 100) : 0

  return {
    isEligible,
    currentWeek,
    nextWeek,
    criteria,
    pendingApprovals,
    blockers,
    progressPercentage
  }
}

/**
 * Gets weekly progress for a specific week
 */
async function getWeeklyProgress(userId: string, weekNumber: number): Promise<{ pointsEarned: number } | null> {
  try {
    const weeklyProgressRef = collection(db, 'weeklyProgress')
    const weeklyProgressQuery = query(
      weeklyProgressRef,
      where('uid', '==', userId),
      where('weekNumber', '==', weekNumber)
    )

    const snapshot = await getDocs(weeklyProgressQuery)

    if (snapshot.empty) {
      return null
    }

    const data = snapshot.docs[0].data()
    return {
      pointsEarned: data.pointsEarned ?? 0
    }
  } catch (error) {
    console.error('[weekAdvancementService] Error fetching weekly progress:', error)
    return null
  }
}

/**
 * Gets window progress for a specific window
 */
async function getWindowProgress(
  userId: string,
  journeyType: JourneyType,
  windowNumber: number
): Promise<{ pointsEarned: number } | null> {
  try {
    const windowProgressRef = collection(db, 'windowProgress')
    const windowProgressQuery = query(
      windowProgressRef,
      where('uid', '==', userId),
      where('journeyType', '==', journeyType),
      where('windowNumber', '==', windowNumber)
    )

    const snapshot = await getDocs(windowProgressQuery)

    if (snapshot.empty) {
      return null
    }

    const data = snapshot.docs[0].data()
    return {
      pointsEarned: data.pointsEarned ?? 0
    }
  } catch (error) {
    console.error('[weekAdvancementService] Error fetching window progress:', error)
    return null
  }
}

/**
 * Gets pending approval requests for a specific week
 */
async function getPendingApprovals(userId: string, weekNumber: number): Promise<PointsVerificationRequest[]> {
  try {
    const verificationRef = collection(db, 'points_verification_requests')
    const verificationQuery = query(
      verificationRef,
      where('user_id', '==', userId),
      where('week', '==', weekNumber),
      where('status', '==', 'pending')
    )

    const snapshot = await getDocs(verificationQuery)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PointsVerificationRequest))
  } catch (error) {
    console.error('[weekAdvancementService] Error fetching pending approvals:', error)
    return []
  }
}

/**
 * Manually advances a user to the next week.
 *
 * This function:
 * 1. Checks eligibility (unless override is true)
 * 2. Updates profile.currentWeek
 * 3. Creates audit trail in week_advancement_log
 * 4. Sends notification to user
 *
 * @param params - Advancement parameters
 * @returns Success status with new week number or error
 */
export async function advanceUserToNextWeek(params: {
  userId: string
  profile: UserProfile
  partnerId: string | null
  partnerName: string | null
  override?: boolean
  reason?: string
}): Promise<{ success: boolean; newWeek: number; error?: string }> {
  const { userId, profile, partnerId, partnerName, override = false, reason } = params

  const currentWeek = profile.currentWeek ?? 1
  const nextWeek = currentWeek + 1
  const programDurationWeeks = profile.programDurationWeeks ?? JOURNEY_META[profile.journeyType].weeks

  // Check if already at final week
  if (currentWeek >= programDurationWeeks) {
    return {
      success: false,
      newWeek: currentWeek,
      error: 'User is already on the final week of their journey'
    }
  }

  // Check eligibility (unless override is true)
  let eligibility: AdvancementEligibility | null = null
  if (!override) {
    try {
      eligibility = await checkWeekAdvancementEligibility(userId, profile)

      if (!eligibility.isEligible) {
        return {
          success: false,
          newWeek: currentWeek,
          error: `User is not eligible to advance: ${eligibility.blockers.join(', ')}`
        }
      }
    } catch (error) {
      console.error('[weekAdvancementService] Error checking eligibility:', error)
      return {
        success: false,
        newWeek: currentWeek,
        error: 'Failed to check advancement eligibility'
      }
    }
  }

  try {
    // 1. Update profile.currentWeek
    const profileRef = doc(db, 'profiles', userId)
    await setDoc(
      profileRef,
      {
        currentWeek: nextWeek,
        lastWeekAdvancement: serverTimestamp(),
        advancedBy: partnerId
      },
      { merge: true }
    )

    // 2. Create audit trail
    await addDoc(collection(db, 'week_advancement_log'), {
      userId,
      fromWeek: currentWeek,
      toWeek: nextWeek,
      timestamp: serverTimestamp(),
      advancedBy: partnerId,
      advancedByName: partnerName,
      method: override ? 'manual_override' : 'partner_approved',
      eligibilitySnapshot: eligibility ? JSON.stringify(eligibility) : null,
      reason: reason || null
    })

    // 3. Send notification to user
    await addDoc(collection(db, 'notifications'), {
      user_id: userId,
      type: 'week_advancement',
      title: `Welcome to Week ${nextWeek}!`,
      message: `You've unlocked Week ${nextWeek}. New activities are now available.`,
      severity: 'success',
      is_read: false,
      read: false,
      created_at: serverTimestamp()
    })

    console.log(`[weekAdvancementService] Successfully advanced user ${userId} from Week ${currentWeek} to Week ${nextWeek}`)

    return {
      success: true,
      newWeek: nextWeek
    }
  } catch (error) {
    console.error('[weekAdvancementService] Error advancing user:', error)
    return {
      success: false,
      newWeek: currentWeek,
      error: error instanceof Error ? error.message : 'Failed to advance user'
    }
  }
}
