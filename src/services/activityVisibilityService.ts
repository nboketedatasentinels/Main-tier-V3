/**
 * Activity Visibility Service
 * Phase 6: Manages visibility of activities based on org configuration
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
import { db } from '@/services/firebase'
import {
  ActivityVisibility,
  VisibilityReason,
  ActivityCompletionContext,
  LeadershipRole,
} from '../types/organization'
import { getOrgConfiguration } from './orgConfigurationService'
import { isLeadershipAvailable, leadershipHasCapacity } from './leadershipService'

/**
 * Check if activity should be visible in organization
 */
export async function isActivityVisible(
  orgId: string,
  activityId: string
): Promise<{ visible: boolean; reason: VisibilityReason; details: string }> {
  try {
    const visibility = await getActivityVisibility(orgId, activityId)

    if (visibility) {
      return {
        visible: visibility.visible,
        reason: visibility.reason,
        details: visibility.detailedReason,
      }
    }

    // Calculate visibility if not cached
    return calculateActivityVisibility(orgId, activityId)
  } catch (error) {
    console.error('Error checking activity visibility:', error)
    return {
      visible: true,
      reason: 'available',
      details: 'Activity is available',
    }
  }
}

/**
 * Get cached activity visibility
 */
export async function getActivityVisibility(
  orgId: string,
  activityId: string
): Promise<ActivityVisibility | null> {
  try {
    const visId = `${activityId}-${orgId}`
    const visDoc = await getDoc(doc(db, `organization_activity_visibility`, visId))

    if (visDoc.exists()) {
      const data = visDoc.data() as ActivityVisibility
      // Check if cache is fresh (less than 1 hour old)
      const now = Date.now()
      const cacheAge = now - data.updatedAt.toMillis()
      if (cacheAge < 3600000) {
        // 1 hour
        return data
      }
    }

    return null
  } catch (error) {
    console.error('Error getting activity visibility:', error)
    return null
  }
}

/**
 * Calculate if activity should be visible
 */
export async function calculateActivityVisibility(
  orgId: string,
  activityId: string
): Promise<{ visible: boolean; reason: VisibilityReason; details: string }> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) {
      return {
        visible: true,
        reason: 'available',
        details: 'No configuration found',
      }
    }

    // Check if activity is explicitly hidden in rules
    const rule = config.passMark.activityOverrides?.[activityId]

    // Check for feature flags that might affect visibility
    if (rule?.visibleWhen === 'always' || !rule) {
      return {
        visible: true,
        reason: 'available',
        details: 'Activity is available',
      }
    }

    // Check if leadership is required but unavailable
    if (rule.leadershipDependency) {
      const hasLeadership = await isLeadershipAvailable(orgId, rule.leadershipDependency)
      if (!hasLeadership) {
        return {
          visible: false,
          reason: 'leadership_unavailable',
          details: `This activity requires ${rule.leadershipDependency} which is not currently available`,
        }
      }

      // Check capacity
      const hasCapacity = await leadershipHasCapacity(orgId, rule.leadershipDependency)
      if (!hasCapacity) {
        return {
          visible: false,
          reason: 'capacity_exceeded',
          details: `The ${rule.leadershipDependency} is at capacity. Please try again later.`,
        }
      }
    }

    return {
      visible: true,
      reason: 'available',
      details: 'Activity is available',
    }
  } catch (error) {
    console.error('Error calculating activity visibility:', error)
    return {
      visible: true,
      reason: 'available',
      details: 'Error checking visibility - activity available',
    }
  }
}

/**
 * Update activity visibility cache
 */
export async function updateActivityVisibility(
  orgId: string,
  activityId: string,
  visible: boolean,
  reason: VisibilityReason,
  detailedReason: string,
  alternativeActivityId?: string,
  userId: string = 'system'
): Promise<void> {
  try {
    const visId = `${activityId}-${orgId}`

    const visibility: ActivityVisibility = {
      id: visId,
      orgId,
      activityId,
      visible,
      reason,
      detailedReason,
      alternativeActivityId,
      showReasonToLearner: true,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    }

    await setDoc(doc(db, 'organization_activity_visibility', visId), visibility)
  } catch (error) {
    console.error('Error updating activity visibility:', error)
    throw error
  }
}

/**
 * Hide activity with reason
 */
export async function hideActivity(
  orgId: string,
  activityId: string,
  reason: string,
  alternativeActivityId?: string,
  userId: string = 'system'
): Promise<void> {
  try {
    const detailedReason = reason || 'Activity is temporarily unavailable'

    await updateActivityVisibility(
      orgId,
      activityId,
      false,
      'custom_rule',
      detailedReason,
      alternativeActivityId,
      userId
    )

    // Record in org configuration
    const config = await getOrgConfiguration(orgId)
    if (config && config.passMark.activityOverrides) {
      const overrides = { ...config.passMark.activityOverrides }
      if (!overrides[activityId]) {
        overrides[activityId] = {}
      }
      overrides[activityId].visibleWhen = 'never'
      overrides[activityId].alternateActivityId = alternativeActivityId

      // Store this in override for reference
      const configRef = doc(db, 'organization_configuration', orgId)
      await updateDoc(configRef, {
        'passMark.activityOverrides': overrides,
        lastModified: serverTimestamp(),
        lastModifiedBy: userId,
      })
    }
  } catch (error) {
    console.error('Error hiding activity:', error)
    throw error
  }
}

/**
 * Show activity (make it visible)
 */
export async function showActivity(
  orgId: string,
  activityId: string,
  userId: string = 'system'
): Promise<void> {
  try {
    await updateActivityVisibility(
      orgId,
      activityId,
      true,
      'available',
      'Activity is available',
      undefined,
      userId
    )
  } catch (error) {
    console.error('Error showing activity:', error)
    throw error
  }
}

/**
 * Get all hidden activities for org
 */
export async function getHiddenActivitiesForOrg(orgId: string): Promise<ActivityVisibility[]> {
  try {
    const q = query(
      collection(db, 'organization_activity_visibility'),
      where('orgId', '==', orgId),
      where('visible', '==', false)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => d.data() as ActivityVisibility)
  } catch (error) {
    console.error('Error getting hidden activities:', error)
    return []
  }
}

/**
 * Get all visible activities for org
 */
export async function getVisibleActivitiesForOrg(orgId: string): Promise<ActivityVisibility[]> {
  try {
    const q = query(
      collection(db, 'organization_activity_visibility'),
      where('orgId', '==', orgId),
      where('visible', '==', true)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => d.data() as ActivityVisibility)
  } catch (error) {
    console.error('Error getting visible activities:', error)
    return []
  }
}

/**
 * Get activity visibility summary
 */
export async function getActivityVisibilitySummary(orgId: string): Promise<{
  total: number
  visible: number
  hidden: number
  reasonBreakdown: Record<VisibilityReason, number>
}> {
  try {
    const q = query(
      collection(db, 'organization_activity_visibility'),
      where('orgId', '==', orgId)
    )

    const snapshot = await getDocs(q)
    const visibilities = snapshot.docs.map((d) => d.data() as ActivityVisibility)

    const reasonBreakdown: Record<VisibilityReason, number> = {
      available: 0,
      leadership_unavailable: 0,
      capacity_exceeded: 0,
      feature_disabled: 0,
      custom_rule: 0,
      prerequisite_unmet: 0,
    }

    visibilities.forEach((v) => {
      reasonBreakdown[v.reason]++
    })

    return {
      total: visibilities.length,
      visible: visibilities.filter((v) => v.visible).length,
      hidden: visibilities.filter((v) => !v.visible).length,
      reasonBreakdown,
    }
  } catch (error) {
    console.error('Error getting activity visibility summary:', error)
    return {
      total: 0,
      visible: 0,
      hidden: 0,
      reasonBreakdown: {
        available: 0,
        leadership_unavailable: 0,
        capacity_exceeded: 0,
        feature_disabled: 0,
        custom_rule: 0,
        prerequisite_unmet: 0,
      },
    }
  }
}

/**
 * Get completion context for activity
 */
export async function getActivityCompletionContext(
  orgId: string,
  learnerUserId: string,
  activityId: string,
  windowId: string
): Promise<ActivityCompletionContext> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config) {
      throw new Error('Organization configuration not found')
    }

    const activityRule = config.passMark.activityOverrides?.[activityId]
    const leadershipRequired = activityRule?.leadershipDependency || undefined

    // Check visibility
    const visibilityResult = await isActivityVisible(orgId, activityId)

    // Check if leadership is available
    let pendingApprovalFrom: LeadershipRole[] = []
    if (leadershipRequired) {
      const hasLeadership = await isLeadershipAvailable(orgId, leadershipRequired)
      if (!hasLeadership) {
        pendingApprovalFrom = [leadershipRequired]
      }
    }

    const context: ActivityCompletionContext = {
      learnerUserId,
      orgId,
      activityId,
      windowId,
      leadershipRequired,
      pointsRequired: 0, // Would be loaded from activity definition
      isVisible: visibilityResult.visible,
      visibilityReason: visibilityResult.reason,
      allowCompletion: visibilityResult.visible,
      completionMessage: visibilityResult.details,
      pendingApprovalFrom,
      earnedPoints: 0,
      countsTowardPassMark: visibilityResult.visible,
      countsTowardCompletion: visibilityResult.visible,
    }

    return context
  } catch (error) {
    console.error('Error getting activity completion context:', error)
    throw error
  }
}

/**
 * Refresh all activity visibility for organization
 */
export async function refreshOrgActivityVisibility(
  orgId: string,
  activityIds: string[],
  userId: string = 'system'
): Promise<void> {
  try {
    for (const activityId of activityIds) {
      const result = await calculateActivityVisibility(orgId, activityId)

      await updateActivityVisibility(
        orgId,
        activityId,
        result.visible,
        result.reason,
        result.details,
        undefined,
        userId
      )
    }
  } catch (error) {
    console.error('Error refreshing activity visibility:', error)
    throw error
  }
}

/**
 * Hide activities by reason
 */
export async function hideActivitiesByReason(
  orgId: string,
  activityIds: string[],
  reason: string,
  userId: string = 'system'
): Promise<void> {
  try {
    for (const activityId of activityIds) {
      await hideActivity(orgId, activityId, reason, undefined, userId)
    }
  } catch (error) {
    console.error('Error hiding activities by reason:', error)
    throw error
  }
}

/**
 * Show activities
 */
export async function showActivities(
  orgId: string,
  activityIds: string[],
  userId: string = 'system'
): Promise<void> {
  try {
    for (const activityId of activityIds) {
      await showActivity(orgId, activityId, userId)
    }
  } catch (error) {
    console.error('Error showing activities:', error)
    throw error
  }
}

/**
 * Get leadership dependency for activity
 */
export async function getActivityLeadershipRequirement(
  orgId: string,
  activityId: string
): Promise<LeadershipRole | null> {
  try {
    const config = await getOrgConfiguration(orgId)
    const override = config?.passMark.activityOverrides?.[activityId]
    return override?.leadershipDependency || null
  } catch (error) {
    console.error('Error getting activity leadership requirement:', error)
    return null
  }
}

/**
 * Check if learner can complete activity
 */
export async function canLearnerCompleteActivity(
  orgId: string,
  learnerUserId: string,
  activityId: string,
  windowId: string
): Promise<{ canComplete: boolean; reason: string }> {
  try {
    const context = await getActivityCompletionContext(
      orgId,
      learnerUserId,
      activityId,
      windowId
    )

    if (!context.isVisible) {
      return {
        canComplete: false,
        reason: context.completionMessage || 'Activity is not currently available',
      }
    }

    if (context.pendingApprovalFrom && context.pendingApprovalFrom.length > 0) {
      return {
        canComplete: true,
        reason: `Activity completion pending approval from ${context.pendingApprovalFrom.join(', ')}`,
      }
    }

    return {
      canComplete: true,
      reason: 'Activity can be completed',
    }
  } catch (error) {
    console.error('Error checking if learner can complete activity:', error)
    return {
      canComplete: false,
      reason: 'Error checking activity availability',
    }
  }
}
