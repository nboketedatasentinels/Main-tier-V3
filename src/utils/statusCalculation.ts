/**
 * Status Calculation Utility
 * Centralized logic for calculating engagement status based on points and targets
 */

export type EngagementStatus = 'on_track' | 'warning' | 'alert' | 'recovery'
export type LegacyWeeklyStatus = 'on_track' | 'warning' | 'at_risk'

/**
 * Calculate engagement status based on points earned vs target
 * Used by pointsService and windowProgressService
 *
 * @param earnedPoints - Points earned in the period
 * @param targetPoints - Target points for the period
 * @param previousStatus - Previous status (for recovery detection)
 * @returns Current engagement status
 */
export function calculateEngagementStatus(
  earnedPoints: number,
  targetPoints: number,
  previousStatus?: EngagementStatus
): EngagementStatus {
  if (targetPoints <= 0) {
    return 'alert'
  }

  const ratio = earnedPoints / targetPoints

  let status: EngagementStatus = 'alert'

  if (ratio >= 1) {
    status = 'on_track'
  } else if (ratio >= 0.75) {
    status = 'warning'
  } else {
    status = 'alert'
  }

  // Apply recovery status when moving from alert to on_track or warning
  if (previousStatus === 'alert' && (status === 'on_track' || status === 'warning')) {
    status = 'recovery'
  }

  return status
}

/**
 * Calculate legacy weekly status (used by weeklyPointsService)
 * This uses percentage thresholds instead of ratio
 *
 * @param earnedPoints - Points earned in the week
 * @param targetPoints - Target points for the week
 * @returns Weekly status
 */
export function calculateLegacyWeeklyStatus(
  earnedPoints: number,
  targetPoints: number
): LegacyWeeklyStatus {
  if (targetPoints === 0) {
    return 'on_track'
  }

  const percentage = (earnedPoints / targetPoints) * 100

  if (percentage >= 70) {
    return 'on_track'
  }

  if (percentage >= 40) {
    return 'warning'
  }

  return 'at_risk'
}

/**
 * Get status display information
 */
export function getStatusDisplay(status: EngagementStatus | LegacyWeeklyStatus): {
  label: string
  color: string
  emoji: string
} {
  switch (status) {
    case 'on_track':
      return { label: 'On Track', color: 'green', emoji: '✅' }
    case 'warning':
      return { label: 'Warning', color: 'yellow', emoji: '⚠️' }
    case 'alert':
      return { label: 'Alert', color: 'red', emoji: '🚨' }
    case 'at_risk':
      return { label: 'At Risk', color: 'red', emoji: '🚨' }
    case 'recovery':
      return { label: 'Recovery', color: 'blue', emoji: '🔄' }
    default:
      return { label: 'Unknown', color: 'gray', emoji: '❓' }
  }
}
