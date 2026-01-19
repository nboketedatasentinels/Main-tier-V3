/**
 * Dynamic Pass Mark Service
 * Phase 6: Calculates personalized pass marks based on org configuration and constraints
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import {
  LearnerPassMarkAdjustment,
  PassMarkAdjustmentReason,
  LearnerPassMarkInfo,
  OrgLearnerPassMarkContext,
} from '../types/organization'
import { getOrgConfiguration } from './orgConfigurationService'
import { isLeadershipAvailable, leadershipHasCapacity } from './leadershipService'

/**
 * Calculate pass mark for learner in organization
 */
export async function calculateLearnerPassMark(
  orgId: string,
  learnerUserId: string,
  windowId: string
): Promise<{
  passmark: number
  basePassmark: number
  adjustments: Array<{ reason: PassMarkAdjustmentReason; amount: number }>
  explanation: string
}> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) {
      return {
        passmark: 70,
        basePassmark: 70,
        adjustments: [],
        explanation: 'Default pass mark (no org configuration found)',
      }
    }

    let currentPassmark = config.passMark.basePassMark
    const adjustments: Array<{ reason: PassMarkAdjustmentReason; amount: number }> = []

    // Check each constraint and apply adjustment if needed
    if (!config.leadership.hasMentor && config.passMark.adjustments.noMentorAvailable) {
      const adjustment = config.passMark.adjustments.noMentorAvailable
      adjustments.push({
        reason: 'no_mentor',
        amount: adjustment,
      })
      currentPassmark += adjustment
    }

    if (!config.leadership.hasAmbassador && config.passMark.adjustments.noAmbassadorAvailable) {
      const adjustment = config.passMark.adjustments.noAmbassadorAvailable
      adjustments.push({
        reason: 'no_ambassador',
        amount: adjustment,
      })
      currentPassmark += adjustment
    }

    if (!config.leadership.hasPartner && config.passMark.adjustments.noPartnerAvailable) {
      const adjustment = config.passMark.adjustments.noPartnerAvailable
      adjustments.push({
        reason: 'no_partner',
        amount: adjustment,
      })
      currentPassmark += adjustment
    }

    // Check mentor capacity
    const mentorAvailable = await isLeadershipAvailable(orgId, 'mentor')
    if (mentorAvailable) {
      const hasMentorCapacity = await leadershipHasCapacity(orgId, 'mentor')
      if (!hasMentorCapacity && config.passMark.adjustments.limitedCapacity) {
        const adjustment = config.passMark.adjustments.limitedCapacity
        adjustments.push({
          reason: 'capacity_limited',
          amount: adjustment,
        })
        currentPassmark += adjustment
      }
    }

    // Don't go below minimum
    if (config.passMark.minimumPassMark) {
      currentPassmark = Math.max(currentPassmark, config.passMark.minimumPassMark)
    }

    // Don't exceed 100
    currentPassmark = Math.min(currentPassmark, 100)

    const explanation = generatePassMarkExplanation(
      config.passMark.basePassMark,
      currentPassmark,
      adjustments
    )

    return {
      passmark: currentPassmark,
      basePassmark: config.passMark.basePassMark,
      adjustments,
      explanation,
    }
  } catch (error) {
    console.error('Error calculating learner pass mark:', error)
    return {
      passmark: 70,
      basePassmark: 70,
      adjustments: [],
      explanation: 'Error calculating pass mark',
    }
  }
}

/**
 * Generate explanation for pass mark adjustments
 */
export function generatePassMarkExplanation(
  basePassmark: number,
  currentPassmark: number,
  adjustments: Array<{ reason: PassMarkAdjustmentReason; amount: number }>
): string {
  if (adjustments.length === 0) {
    return `Your pass mark is ${currentPassmark}%`
  }

  const reasons: string[] = []

  adjustments.forEach((adj) => {
    switch (adj.reason) {
      case 'no_mentor':
        reasons.push('mentorship is not currently available')
        break
      case 'no_ambassador':
        reasons.push('ambassador support is not currently available')
        break
      case 'no_partner':
        reasons.push('transformation partner support is not currently available')
        break
      case 'capacity_limited':
        reasons.push('mentor capacity is limited')
        break
      case 'custom':
        reasons.push('custom adjustment applied')
        break
    }
  })

  const adjustmentText = reasons.join(', ')
  const difference = currentPassmark - basePassmark

  if (difference < 0) {
    return `Your pass mark is ${currentPassmark}% (normally ${basePassmark}%) because ${adjustmentText}`
  } else if (difference > 0) {
    return `Your pass mark is ${currentPassmark}% (increased from ${basePassmark}%) as ${adjustmentText}`
  } else {
    return `Your pass mark is ${currentPassmark}%`
  }
}

/**
 * Get learner pass mark info
 */
export async function getLearnerPassMarkInfo(
  orgId: string,
  learnerUserId: string,
  windowId: string
): Promise<LearnerPassMarkInfo> {
  try {
    const passmarkCalc = await calculateLearnerPassMark(orgId, learnerUserId, windowId)
    const config = await getOrgConfiguration(orgId)

    // Get visible/hidden activities
    const visibleActivities: string[] = []
    const hiddenActivities: Array<{ activityId: string; reason: string }> = []

    if (config?.passMark.activityOverrides) {
      Object.entries(config.passMark.activityOverrides).forEach(([activityId, override]) => {
        if (override.visibleWhen === 'always' || override.visible !== false) {
          visibleActivities.push(activityId)
        } else {
          hiddenActivities.push({
            activityId,
            reason: `Requires ${override.leadershipDependency} which is not available`,
          })
        }
      })
    }

    return {
      passmark: passmarkCalc.passmark,
      basePassmark: passmarkCalc.basePassmark,
      adjustments: passmarkCalc.adjustments,
      explanation: passmarkCalc.explanation,
      visibleActivities,
      hiddenActivities,
    }
  } catch (error) {
    console.error('Error getting learner pass mark info:', error)
    throw error
  }
}

/**
 * Store learner pass mark adjustment
 */
export async function storeLearnerPassMarkAdjustment(
  orgId: string,
  learnerUserId: string,
  windowId: string,
  adjustment: LearnerPassMarkAdjustment,
  userId: string = 'system'
): Promise<void> {
  try {
    const adjustmentId = `${learnerUserId}-${windowId}-${orgId}`

    await setDoc(
      doc(db, `organizations/${orgId}/learner_pass_marks`, adjustmentId),
      {
        ...adjustment,
        createdBy: userId,
        updatedAt: Timestamp.now(),
      }
    )
  } catch (error) {
    console.error('Error storing learner pass mark adjustment:', error)
    throw error
  }
}

/**
 * Get stored learner pass mark adjustment
 */
export async function getLearnerPassMarkAdjustment(
  orgId: string,
  learnerUserId: string,
  windowId: string
): Promise<LearnerPassMarkAdjustment | null> {
  try {
    const adjustmentId = `${learnerUserId}-${windowId}-${orgId}`
    const doc_ref = doc(db, `organizations/${orgId}/learner_pass_marks`, adjustmentId)
    const snapshot = await getDoc(doc_ref)

    if (snapshot.exists()) {
      return snapshot.data() as LearnerPassMarkAdjustment
    }

    return null
  } catch (error) {
    console.error('Error getting learner pass mark adjustment:', error)
    return null
  }
}

/**
 * Update learner pass mark adjustment
 */
export async function updateLearnerPassMarkAdjustment(
  orgId: string,
  learnerUserId: string,
  windowId: string,
  updates: Partial<LearnerPassMarkAdjustment>,
  userId: string = 'system'
): Promise<void> {
  try {
    const adjustmentId = `${learnerUserId}-${windowId}-${orgId}`

    await updateDoc(doc(db, `organizations/${orgId}/learner_pass_marks`, adjustmentId), {
      ...updates,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error updating learner pass mark adjustment:', error)
    throw error
  }
}

/**
 * Get all learners with pass mark adjustments in org
 */
export async function getLearnersWithAdjustments(
  orgId: string
): Promise<Array<{ learnerUserId: string; adjustment: number; reason: string }>> {
  try {
    const snapshot = await getDocs(collection(db, `organizations/${orgId}/learner_pass_marks`))

    return snapshot.docs
      .map((d) => {
        const data = d.data() as LearnerPassMarkAdjustment
        const totalAdjustment = data.adjustments.reduce((sum, a) => sum + a.adjustment, 0)
        const reasons = data.adjustments.map((a) => a.reason).join(', ')

        return {
          learnerUserId: data.userId,
          adjustment: totalAdjustment,
          reason: reasons,
        }
      })
      .filter((a) => a.adjustment !== 0)
  } catch (error) {
    console.error('Error getting learners with adjustments:', error)
    return []
  }
}

/**
 * Calculate pass mark statistics for org
 */
export async function getPassMarkStatistics(orgId: string): Promise<{
  avgBasePassmark: number
  avgFinalPassmark: number
  learnersAffected: number
  adjustmentReasons: Record<PassMarkAdjustmentReason, number>
  avgAdjustmentAmount: number
}> {
  try {
    const adjustments = await getLearnersWithAdjustments(orgId)
    const config = await getOrgConfiguration(orgId)

    const basePassmark = config?.passMark.basePassMark || 70
    const adjustmentReasons: Record<PassMarkAdjustmentReason, number> = {
      no_mentor: 0,
      no_ambassador: 0,
      no_partner: 0,
      capacity_limited: 0,
      custom: 0,
    }

    let totalAdjustment = 0

    adjustments.forEach((adj) => {
      totalAdjustment += adj.adjustment
      // Parse reasons
      if (adj.reason.includes('no_mentor')) adjustmentReasons.no_mentor++
      if (adj.reason.includes('no_ambassador')) adjustmentReasons.no_ambassador++
      if (adj.reason.includes('no_partner')) adjustmentReasons.no_partner++
      if (adj.reason.includes('capacity')) adjustmentReasons.capacity_limited++
    })

    const avgAdjustment = adjustments.length > 0 ? totalAdjustment / adjustments.length : 0

    return {
      avgBasePassmark: basePassmark,
      avgFinalPassmark: basePassmark + avgAdjustment,
      learnersAffected: adjustments.length,
      adjustmentReasons,
      avgAdjustmentAmount: avgAdjustment,
    }
  } catch (error) {
    console.error('Error calculating pass mark statistics:', error)
    return {
      avgBasePassmark: 70,
      avgFinalPassmark: 70,
      learnersAffected: 0,
      adjustmentReasons: {
        no_mentor: 0,
        no_ambassador: 0,
        no_partner: 0,
        capacity_limited: 0,
        custom: 0,
      },
      avgAdjustmentAmount: 0,
    }
  }
}

/**
 * Recalculate and store pass marks for all learners in window
 */
export async function recalculateWindowPassMarks(
  orgId: string,
  windowId: string,
  learnerIds: string[],
  userId: string = 'system'
): Promise<number> {
  try {
    let updated = 0

    for (const learnerId of learnerIds) {
      const calc = await calculateLearnerPassMark(orgId, learnerId, windowId)

      const adjustment: LearnerPassMarkAdjustment = {
        id: `${learnerId}-${windowId}-${orgId}`,
        userId: learnerId,
        orgId,
        windowId,
        basePassMark: calc.basePassmark,
        adjustments: calc.adjustments.map((adj) => ({
          reason: adj.reason,
          adjustment: adj.amount,
          appliedAt: Timestamp.now(),
          appliedBy: userId,
        })),
        finalPassMark: calc.passmark,
        transparency: {
          visibleToLearner: true,
          explanation: calc.explanation,
        },
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
      }

      await storeLearnerPassMarkAdjustment(orgId, learnerId, windowId, adjustment, userId)
      updated++
    }

    return updated
  } catch (error) {
    console.error('Error recalculating window pass marks:', error)
    throw error
  }
}

/**
 * Create context for pass mark calculation
 */
export async function createPassMarkContext(
  orgId: string,
  learnerUserId: string,
  windowId: string
): Promise<OrgLearnerPassMarkContext> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) throw new Error('Organization configuration not found')

    const context: OrgLearnerPassMarkContext = {
      learnerUserId,
      orgId,
      windowId,
      basePassMark: config.passMark.basePassMark,
      orgConfiguration: config,
      leadership: config.leadership,
      features: config.features,

      calculatePassMark(): number {
        let passmark = this.basePassMark

        if (!this.leadership.hasMentor) {
          passmark +=
            this.orgConfiguration.passMark.adjustments.noMentorAvailable || 0
        }

        if (!this.leadership.hasAmbassador) {
          passmark +=
            this.orgConfiguration.passMark.adjustments.noAmbassadorAvailable || 0
        }

        if (!this.leadership.hasPartner) {
          passmark +=
            this.orgConfiguration.passMark.adjustments.noPartnerAvailable || 0
        }

        if (this.orgConfiguration.passMark.minimumPassMark) {
          passmark = Math.max(
            passmark,
            this.orgConfiguration.passMark.minimumPassMark
          )
        }

        return Math.min(passmark, 100)
      },

      getExplanation(): string {
        const calc = this.calculatePassMark()
        const adjustments: Array<{
          reason: PassMarkAdjustmentReason
          amount: number
        }> = []

        if (!this.leadership.hasMentor) {
          adjustments.push({
            reason: 'no_mentor',
            amount:
              this.orgConfiguration.passMark.adjustments.noMentorAvailable || 0,
          })
        }

        if (!this.leadership.hasAmbassador) {
          adjustments.push({
            reason: 'no_ambassador',
            amount:
              this.orgConfiguration.passMark.adjustments
                .noAmbassadorAvailable || 0,
          })
        }

        if (!this.leadership.hasPartner) {
          adjustments.push({
            reason: 'no_partner',
            amount:
              this.orgConfiguration.passMark.adjustments.noPartnerAvailable || 0,
          })
        }

        return generatePassMarkExplanation(this.basePassMark, calc, adjustments)
      },

      getVisibleActivities(): string[] {
        const visible: string[] = []

        if (this.orgConfiguration.passMark.activityOverrides) {
          Object.entries(
            this.orgConfiguration.passMark.activityOverrides
          ).forEach(([activityId, override]) => {
            if (override.visibleWhen !== 'leadership_available') {
              visible.push(activityId)
            }
          })
        }

        return visible
      },

      getHiddenActivities(): { id: string; reason: string }[] {
        const hidden: { id: string; reason: string }[] = []

        if (this.orgConfiguration.passMark.activityOverrides) {
          Object.entries(
            this.orgConfiguration.passMark.activityOverrides
          ).forEach(([activityId, override]) => {
            if (override.visibleWhen === 'leadership_available') {
              hidden.push({
                id: activityId,
                reason: `Requires ${override.leadershipDependency || 'leadership'} which is not available`,
              })
            }
          })
        }

        return hidden
      },
    }

    return context
  } catch (error) {
    console.error('Error creating pass mark context:', error)
    throw error
  }
}
