import { differenceInCalendarDays } from 'date-fns'
import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'

export interface WeeklyPointsRecord {
  user_id?: string
  week_number?: number
  points_earned?: number
  target_points?: number
  required_points?: number
}

export interface ProgressMappingResult {
  current_week: number
  earned_points: Record<number, number>
  required_points: Record<number, number>
}

export const getProgramWeekNumber = (startDate?: string): number => {
  if (!startDate) return 1
  const start = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, diffWeeks + 1)
}

export const mapWeeklyPointsToProgress = (
  weeklyPointsData: WeeklyPointsRecord[],
  currentWeek: number,
): ProgressMappingResult => {
  const earned_points: Record<number, number> = {}
  const required_points: Record<number, number> = {}

  weeklyPointsData.forEach((entry) => {
    const week = entry.week_number ?? 0
    if (!week) return

    earned_points[week] = entry.points_earned ?? 0
    required_points[week] = entry.required_points ?? entry.target_points ?? 0
  })

  return {
    current_week: currentWeek,
    earned_points,
    required_points,
  }
}

/**
 * Journey context for risk calculation.
 * Uses pace-ratio: compare actual points earned vs expected points at this point in the journey.
 */
export interface JourneyContext {
  journeyType: string | null
  totalPoints: number
  programDurationWeeks?: number | null
}

export type RiskLevel = 'critical' | 'behind' | 'warning' | 'on_track'

export interface RiskResult {
  status: 'at_risk' | 'on_track'
  level: RiskLevel
  reason?: string
  points_deficit?: number
  paceRatio?: number
}

/**
 * Calculates user risk status using pace-ratio:
 *   paceRatio = totalEarned / expectedPointsAtThisTime
 *
 * Thresholds:
 *   Journey ended + not passed → critical
 *   paceRatio < 0.40           → critical (at_risk)
 *   paceRatio < 0.65           → behind   (at_risk)
 *   paceRatio < 0.85           → warning  (on_track — not at risk, just a heads up)
 *   paceRatio >= 0.85          → on_track
 *
 * Grace period: first 20% of the journey (or first 2 weeks) → always on_track.
 * This prevents false positives for users who just started.
 */
export const calculateUserRiskStatus = (
  currentWeek: number,
  _earnedPoints: Record<number, number>,
  _requiredPoints: Record<number, number>,
  _nudgeResponsivenessScore?: number,
  journeyContext?: JourneyContext,
): RiskResult => {
  const journeyType = journeyContext?.journeyType as JourneyType | null
  const totalEarned = journeyContext?.totalPoints ?? 0

  // Resolve pass mark and total weeks from journey metadata
  const meta = journeyType ? JOURNEY_META[journeyType] : null
  const passMarkPoints = meta?.passMarkPoints ?? 0
  const totalWeeks = journeyContext?.programDurationWeeks ?? meta?.weeks ?? 0

  // If we can't determine journey parameters, can't assess risk
  if (!passMarkPoints || !totalWeeks) {
    return { status: 'on_track', level: 'on_track' }
  }

  // Already passed — never at risk
  if (totalEarned >= passMarkPoints) {
    return {
      status: 'on_track',
      level: 'on_track',
      reason: `Passed: ${totalEarned.toLocaleString()} >= ${passMarkPoints.toLocaleString()} pass mark`,
      paceRatio: 1,
    }
  }

  const elapsedWeeks = Math.min(totalWeeks, Math.max(0, currentWeek - 1))
  const timeProgress = elapsedWeeks / totalWeeks
  const journeyEnded = currentWeek > totalWeeks

  // Grace period: first 20% of the journey or first 2 weeks — don't flag anyone
  const gracePeriodWeeks = Math.max(2, Math.ceil(totalWeeks * 0.2))
  if (currentWeek <= gracePeriodWeeks && !journeyEnded) {
    return {
      status: 'on_track',
      level: 'on_track',
      reason: `Grace period (week ${currentWeek} of ${gracePeriodWeeks})`,
      paceRatio: 1,
    }
  }

  const expectedPointsNow = timeProgress * passMarkPoints
  const paceRatio = expectedPointsNow > 0 ? totalEarned / expectedPointsNow : 1
  const deficit = Math.max(0, Math.round(expectedPointsNow - totalEarned))

  // Journey ended without passing
  if (journeyEnded) {
    return {
      status: 'at_risk',
      level: 'critical',
      reason: `Journey ended: ${totalEarned.toLocaleString()} of ${passMarkPoints.toLocaleString()} required`,
      points_deficit: passMarkPoints - totalEarned,
      paceRatio,
    }
  }

  // Significantly behind — critical
  if (paceRatio < 0.4) {
    return {
      status: 'at_risk',
      level: 'critical',
      reason: `Significantly behind: ${deficit.toLocaleString()} pts below expected pace`,
      points_deficit: deficit,
      paceRatio,
    }
  }

  // Falling behind — at risk
  if (paceRatio < 0.65) {
    return {
      status: 'at_risk',
      level: 'behind',
      reason: `Falling behind: ${deficit.toLocaleString()} pts below expected pace`,
      points_deficit: deficit,
      paceRatio,
    }
  }

  // Slightly off pace — warning, but NOT at_risk (positively evolving)
  if (paceRatio < 0.85) {
    return {
      status: 'on_track',
      level: 'warning',
      reason: `Slightly off pace: ${deficit.toLocaleString()} pts below target`,
      points_deficit: deficit,
      paceRatio,
    }
  }

  // On track
  return {
    status: 'on_track',
    level: 'on_track',
    paceRatio,
  }
}

export const build14DayRegistrationTrend = (
  registrationDates: (string | undefined)[],
): { label: string; value: number }[] => {
  const start = new Date()
  start.setDate(start.getDate() - 13)

  const buckets = Array.from({ length: 14 }, (_, idx) => ({
    date: new Date(start.getTime() + idx * 24 * 60 * 60 * 1000),
    value: 0,
  }))

  registrationDates.forEach((dateString) => {
    if (!dateString) return
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return
    const dayIndex = differenceInCalendarDays(date, start)
    if (!Number.isInteger(dayIndex)) return
    if (dayIndex < 0 || dayIndex >= 14) return
    buckets[dayIndex].value += 1
  })

  return buckets.map((bucket) => ({
    label: `${bucket.date.getMonth() + 1}/${bucket.date.getDate()}`,
    value: bucket.value,
  }))
}
