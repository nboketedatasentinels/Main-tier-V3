import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'
import { PARALLEL_WINDOW_SIZE_WEEKS, getWindowNumber, getWindowRange } from '@/utils/windowCalculations'

/**
 * Partner / learner window status flags (universal across all journeys).
 *
 * Condition is always vs the current 2-week window target:
 *   On Track  ≥ 100%
 *   Warning   75% – 99%
 *   Alert     < 75%
 *   Recovery  back ≥ 100% after Alert
 */
export type WindowStatus = 'on_track' | 'warning' | 'alert' | 'recovery'

export const WINDOW_STATUS_ON_TRACK_RATIO = 1
export const WINDOW_STATUS_WARNING_RATIO = 0.75

export const getJourneyWindowTarget = (journeyType: JourneyType): number =>
  JOURNEY_META[journeyType].windowTarget

/**
 * Absolute window status from points earned in the current 2-week window.
 * Recovery only applies when the prior status was Alert and the learner is
 * back at ≥ 100% - never invent Recovery on a first write / missing history.
 */
export const calculateWindowStatus = (
  pointsEarned: number,
  windowTarget: number,
  previousStatus?: WindowStatus | null,
): WindowStatus => {
  if (windowTarget <= 0) return 'on_track'

  const ratio = pointsEarned / windowTarget
  let status: WindowStatus
  if (ratio >= WINDOW_STATUS_ON_TRACK_RATIO) {
    status = 'on_track'
  } else if (ratio >= WINDOW_STATUS_WARNING_RATIO) {
    status = 'warning'
  } else {
    status = 'alert'
  }

  if (previousStatus === 'alert' && status === 'on_track') {
    return 'recovery'
  }

  return status
}

export const getPointsInWindow = (
  currentWeek: number,
  earnedPointsByWeek: Record<number, number>,
  totalWeeks?: number,
  windowSize = PARALLEL_WINDOW_SIZE_WEEKS,
): { windowNumber: number; startWeek: number; endWeek: number; pointsInWindow: number; weekInWindow: number } => {
  const { windowNumber, startWeek, endWeek } = getWindowRange(currentWeek, totalWeeks, windowSize)
  let pointsInWindow = 0
  for (let week = startWeek; week <= endWeek; week += 1) {
    pointsInWindow += earnedPointsByWeek[week] ?? 0
  }
  const weekInWindow = ((Math.max(1, currentWeek) - 1) % windowSize) + 1
  return { windowNumber, startWeek, endWeek, pointsInWindow, weekInWindow }
}

export const hasWindowPointsSignal = (
  currentWeek: number,
  earnedPointsByWeek: Record<number, number>,
  totalWeeks?: number,
  windowSize = PARALLEL_WINDOW_SIZE_WEEKS,
): boolean => {
  const { startWeek, endWeek } = getWindowRange(currentWeek, totalWeeks, windowSize)
  for (let week = startWeek; week <= endWeek; week += 1) {
    if (Object.prototype.hasOwnProperty.call(earnedPointsByWeek, week)) {
      return true
    }
  }
  return false
}

export type PartnerWindowRiskLevel = 'on_track' | 'warning' | 'behind' | 'critical'

export interface PartnerWindowRiskResult {
  status: 'at_risk' | 'on_track'
  level: PartnerWindowRiskLevel
  windowStatus: WindowStatus
  reason?: string
  points_deficit?: number
  windowRatio?: number
  windowTarget?: number
  pointsInWindow?: number
}

export interface PartnerWindowRiskInput {
  journeyType: JourneyType | null | undefined
  currentWeek: number
  totalPoints: number
  earnedPointsByWeek?: Record<number, number>
  /** Prior window status for Recovery detection (optional). */
  previousWindowStatus?: WindowStatus | null
  programDurationWeeks?: number | null
}

/**
 * Partner / admin risk from the current 2-week window.
 *
 * False-alarm guards:
 * - No journey metadata → on_track (cannot assess)
 * - Already at/above pass mark → on_track
 * - First calendar week of the programme → on_track (just started)
 * - No weekly window points signal → on_track (do not invent risk)
 * - Alert in week 1 of a window → Warning for partners (still recoverable; not at_risk)
 * - Alert in week 2 of a window → at_risk
 * - Journey ended below pass mark → critical
 */
export const calculatePartnerWindowRisk = (input: PartnerWindowRiskInput): PartnerWindowRiskResult => {
  const journeyType = input.journeyType ?? null
  const meta = journeyType ? JOURNEY_META[journeyType] : null
  const passMarkPoints = meta?.passMarkPoints ?? 0
  const totalWeeks = input.programDurationWeeks ?? meta?.weeks ?? 0
  const windowTarget = meta?.windowTarget ?? 0
  const currentWeek = Math.max(1, input.currentWeek || 1)
  const totalPoints = input.totalPoints ?? 0
  const earnedPointsByWeek = input.earnedPointsByWeek ?? {}

  if (!passMarkPoints || !totalWeeks || !windowTarget) {
    return {
      status: 'on_track',
      level: 'on_track',
      windowStatus: 'on_track',
      reason: 'Insufficient journey context to assess window risk',
    }
  }

  if (totalPoints >= passMarkPoints) {
    return {
      status: 'on_track',
      level: 'on_track',
      windowStatus: 'on_track',
      reason: `Passed: ${totalPoints.toLocaleString()} >= ${passMarkPoints.toLocaleString()} pass mark`,
      windowRatio: 1,
      windowTarget,
    }
  }

  const journeyEnded = currentWeek > totalWeeks
  if (journeyEnded) {
    return {
      status: 'at_risk',
      level: 'critical',
      windowStatus: 'alert',
      reason: `Journey ended: ${totalPoints.toLocaleString()} of ${passMarkPoints.toLocaleString()} required`,
      points_deficit: passMarkPoints - totalPoints,
      windowTarget,
      pointsInWindow: 0,
    }
  }

  // Brand-new learners: never flag in week 1.
  if (currentWeek <= 1) {
    return {
      status: 'on_track',
      level: 'on_track',
      windowStatus: 'on_track',
      reason: `Grace period (week ${currentWeek})`,
      windowRatio: 1,
      windowTarget,
    }
  }

  if (!hasWindowPointsSignal(currentWeek, earnedPointsByWeek, totalWeeks)) {
    return {
      status: 'on_track',
      level: 'on_track',
      windowStatus: 'on_track',
      reason: 'No current-window points signal yet - not flagging at risk',
      windowTarget,
    }
  }

  const { pointsInWindow, weekInWindow, windowNumber } = getPointsInWindow(
    currentWeek,
    earnedPointsByWeek,
    totalWeeks,
  )
  const windowStatus = calculateWindowStatus(
    pointsInWindow,
    windowTarget,
    input.previousWindowStatus,
  )
  const windowRatio = windowTarget > 0 ? pointsInWindow / windowTarget : 1
  const deficit = Math.max(0, Math.round(windowTarget - pointsInWindow))

  if (windowStatus === 'on_track' || windowStatus === 'recovery') {
    return {
      status: 'on_track',
      level: 'on_track',
      windowStatus,
      reason:
        windowStatus === 'recovery'
          ? `Recovery: back on track in window ${windowNumber}`
          : `On track in window ${windowNumber}`,
      windowRatio,
      windowTarget,
      pointsInWindow,
    }
  }

  if (windowStatus === 'warning') {
    return {
      status: 'on_track',
      level: 'warning',
      windowStatus,
      reason: `Warning: ${pointsInWindow.toLocaleString()} / ${windowTarget.toLocaleString()} in window ${windowNumber} (75–99%)`,
      points_deficit: deficit,
      windowRatio,
      windowTarget,
      pointsInWindow,
    }
  }

  // Alert (< 75%). Only escalate to partner at-risk in the second week of the window.
  if (weekInWindow < PARALLEL_WINDOW_SIZE_WEEKS) {
    return {
      status: 'on_track',
      level: 'warning',
      windowStatus: 'alert',
      reason: `Early in window ${windowNumber}: ${pointsInWindow.toLocaleString()} / ${windowTarget.toLocaleString()} - monitoring, not at risk yet`,
      points_deficit: deficit,
      windowRatio,
      windowTarget,
      pointsInWindow,
    }
  }

  return {
    status: 'at_risk',
    level: 'behind',
    windowStatus: 'alert',
    reason: `Alert: ${pointsInWindow.toLocaleString()} / ${windowTarget.toLocaleString()} in window ${windowNumber} (< 75%)`,
    points_deficit: deficit,
    windowRatio,
    windowTarget,
    pointsInWindow,
  }
}

/** @deprecated Prefer getJourneyWindowTarget - kept for call sites using week math. */
export const resolveWindowNumber = (weekNumber: number) =>
  getWindowNumber(weekNumber, PARALLEL_WINDOW_SIZE_WEEKS)
