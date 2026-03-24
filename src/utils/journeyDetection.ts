/**
 * Journey Detection Utilities
 *
 * Handles journey type detection from organization data and
 * journey-specific "at-risk" threshold calculations.
 *
 * CRITICAL FOR 6-WEEK JOURNEY:
 * - Learners are ONLY flagged "at-risk" AFTER week 5
 * - Only if they have NOT reached 40,000 points (pass mark)
 */

import { JourneyType, JOURNEY_META } from '@/config/pointsConfig'
import { resolveJourneyType } from '@/utils/journeyType'

/**
 * Journey detection result with confidence level
 */
export interface JourneyDetectionResult {
  journeyType: JourneyType
  detectedFrom: 'explicit' | 'weeks' | 'months' | 'fallback'
  durationWeeks: number
  passMarkPoints: number
  atRiskWeekThreshold: number
}

/**
 * Journey-specific "at risk" week thresholds
 *
 * These define the week AFTER which learners can be flagged as "at-risk"
 * based on their points progress.
 *
 * RULE: For 6W journey, learner is flagged "at risk" STARTING week 5
 * This gives them all of week 5 to reach 40,000 points before the journey ends
 */
export const JOURNEY_AT_RISK_WEEK_THRESHOLDS: Record<JourneyType, number> = {
  '4W': 3, // After week 3 (evaluation at week 4)
  '6W': 4, // CRITICAL: After week 4 (evaluation starts at week 5) - 40,000 pass mark
  '3M': 10, // After week 10 (evaluation at weeks 11-12)
  '6M': 22, // After week 22 (evaluation at weeks 23-24)
  '9M': 34, // After week 34 (evaluation at weeks 35-36)
}

/**
 * Detect journey type from organization data
 *
 * Priority order:
 * 1. Explicit journeyType field
 * 2. programDurationWeeks
 * 3. programDuration (months)
 * 4. Fallback to 3M
 */
export function detectJourneyFromOrganization(org: {
  journeyType?: string | null
  programDurationWeeks?: number | null
  programDuration?: number | null
}): JourneyDetectionResult {
  // Use existing resolver
  const journeyType =
    resolveJourneyType({
      journeyType: org.journeyType,
      programDurationWeeks: org.programDurationWeeks,
      programDuration: org.programDuration,
    }) ?? '3M' // Fallback

  const meta = JOURNEY_META[journeyType]

  // Determine detection source
  let detectedFrom: JourneyDetectionResult['detectedFrom'] = 'fallback'
  if (org.journeyType) {
    detectedFrom = 'explicit'
  } else if (org.programDurationWeeks) {
    detectedFrom = 'weeks'
  } else if (org.programDuration) {
    detectedFrom = 'months'
  }

  return {
    journeyType,
    detectedFrom,
    durationWeeks: meta.weeks,
    passMarkPoints: meta.passMarkPoints,
    atRiskWeekThreshold: JOURNEY_AT_RISK_WEEK_THRESHOLDS[journeyType],
  }
}

/**
 * Check if current week is past the at-risk threshold for a journey
 */
export function isPastAtRiskThreshold(currentWeek: number, journeyType: JourneyType): boolean {
  const threshold = JOURNEY_AT_RISK_WEEK_THRESHOLDS[journeyType]
  return currentWeek > threshold
}

/**
 * Get the at-risk week threshold for a journey type
 */
export function getAtRiskWeekThreshold(journeyType: JourneyType): number {
  return JOURNEY_AT_RISK_WEEK_THRESHOLDS[journeyType]
}

/**
 * Get pass mark points for a journey type
 */
export function getPassMarkPoints(journeyType: JourneyType): number {
  return JOURNEY_META[journeyType].passMarkPoints
}

/**
 * Result of 6-week journey at-risk evaluation
 */
export interface SixWeekAtRiskResult {
  isAtRisk: boolean
  reason: string | null
  currentWeek: number
  totalPoints: number
  passMarkPoints: number
  pointsDeficit: number
}

/**
 * Check if a 6-week journey learner qualifies as "at risk"
 *
 * CONDITIONS (ALL must be true for at-risk status):
 * 1. Journey type is '6W'
 * 2. Current week >= 5 (starts at week 5, giving time to recover before journey ends)
 * 3. Total points < 40,000
 */
export function is6WeekJourneyAtRisk(params: {
  journeyType: JourneyType
  currentWeek: number
  totalPoints: number
}): SixWeekAtRiskResult {
  const { journeyType, currentWeek, totalPoints } = params
  const PASS_MARK = 40000 // 6W pass mark
  const AT_RISK_THRESHOLD_WEEK = 4 // At-risk starts at week 5 (> 4)

  const baseResult = {
    currentWeek,
    totalPoints,
    passMarkPoints: PASS_MARK,
    pointsDeficit: Math.max(0, PASS_MARK - totalPoints),
  }

  // Only applies to 6-week journey
  if (journeyType !== '6W') {
    return {
      ...baseResult,
      isAtRisk: false,
      reason: null,
    }
  }

  // Not at risk if still in weeks 1-4
  if (currentWeek <= AT_RISK_THRESHOLD_WEEK) {
    return {
      ...baseResult,
      isAtRisk: false,
      reason: `Still in week ${currentWeek} (at-risk evaluation starts at week ${AT_RISK_THRESHOLD_WEEK + 1})`,
    }
  }

  // At risk if below pass mark starting week 5
  if (totalPoints < PASS_MARK) {
    return {
      ...baseResult,
      isAtRisk: true,
      reason: `Week ${currentWeek}: ${totalPoints.toLocaleString()} points < ${PASS_MARK.toLocaleString()} pass mark`,
    }
  }

  // Passed - not at risk
  return {
    ...baseResult,
    isAtRisk: false,
    reason: `Passed: ${totalPoints.toLocaleString()} >= ${PASS_MARK.toLocaleString()} points`,
  }
}

/**
 * Generic journey at-risk check (works for all journey types)
 *
 * Uses the journey-specific thresholds to determine if a learner
 * should be flagged as at-risk based on points.
 */
export function isJourneyAtRiskByPoints(params: {
  journeyType: JourneyType
  currentWeek: number
  totalPoints: number
}): { isAtRisk: boolean; reason: string | null } {
  const { journeyType, currentWeek, totalPoints } = params

  const threshold = JOURNEY_AT_RISK_WEEK_THRESHOLDS[journeyType]
  const passMarkPoints = JOURNEY_META[journeyType].passMarkPoints

  // Not past threshold yet - don't flag as at-risk
  if (currentWeek <= threshold) {
    return {
      isAtRisk: false,
      reason: `Week ${currentWeek} <= threshold week ${threshold}`,
    }
  }

  // Past threshold - check points
  if (totalPoints < passMarkPoints) {
    return {
      isAtRisk: true,
      reason: `${totalPoints.toLocaleString()} < ${passMarkPoints.toLocaleString()} pass mark (week ${currentWeek})`,
    }
  }

  return {
    isAtRisk: false,
    reason: `Passed: ${totalPoints.toLocaleString()} >= ${passMarkPoints.toLocaleString()}`,
  }
}
