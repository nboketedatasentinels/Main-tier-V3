import { differenceInCalendarDays } from 'date-fns'

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
 * Journey context for risk calculation
 * Used to apply 6-Week Power Journey specific at-risk logic
 */
export interface JourneyContext {
  journeyType: string | null
  totalPoints: number
}

// 6-Week journey constants
const SIX_WEEK_PASS_MARK = 40000
const SIX_WEEK_AT_RISK_THRESHOLD = 4 // At-risk starts at week 5 (> 4)

export const calculateUserRiskStatus = (
  currentWeek: number,
  earnedPoints: Record<number, number>,
  requiredPoints: Record<number, number>,
  nudgeResponsivenessScore?: number,
  journeyContext?: JourneyContext,
): { status: 'at_risk' | 'on_track'; reason?: string; points_deficit?: number } => {
  // 6-Week Power Journey specific logic
  if (journeyContext?.journeyType === '6W') {
    // Weeks 1-4: NEVER flag as at_risk
    if (currentWeek <= SIX_WEEK_AT_RISK_THRESHOLD) {
      return {
        status: 'on_track',
        reason: `Week ${currentWeek}: At-risk evaluation starts at week 5`,
      }
    }

    // Week 5+: Flag as at_risk ONLY if below 40,000 points
    if (journeyContext.totalPoints < SIX_WEEK_PASS_MARK) {
      return {
        status: 'at_risk',
        reason: `Week ${currentWeek}: ${journeyContext.totalPoints.toLocaleString()} < ${SIX_WEEK_PASS_MARK.toLocaleString()} pass mark`,
        points_deficit: SIX_WEEK_PASS_MARK - journeyContext.totalPoints,
      }
    }

    // Week 5+ with >= 40,000 points: on_track
    return {
      status: 'on_track',
      reason: `Passed: ${journeyContext.totalPoints.toLocaleString()} >= ${SIX_WEEK_PASS_MARK.toLocaleString()}`,
    }
  }

  // Default logic for other journey types
  const weekRequirement = requiredPoints[currentWeek] ?? 0
  const weekEarned = earnedPoints[currentWeek] ?? 0

  const cumulativeRequirement = Object.keys(requiredPoints).reduce((total, weekKey) => {
    const weekNumber = Number(weekKey)
    if (weekNumber > currentWeek) return total
    return total + (requiredPoints[weekNumber] ?? 0)
  }, 0)

  const cumulativeEarned = Object.keys(earnedPoints).reduce((total, weekKey) => {
    const weekNumber = Number(weekKey)
    if (weekNumber > currentWeek) return total
    return total + (earnedPoints[weekNumber] ?? 0)
  }, 0)

  const weeklyRatio = weekRequirement > 0 ? weekEarned / weekRequirement : 1
  const cumulativeRatio = cumulativeRequirement > 0 ? cumulativeEarned / cumulativeRequirement : 1
  const baseRatio = Math.min(weeklyRatio, cumulativeRatio)
  const responsivenessBoost = nudgeResponsivenessScore ? Math.min(0.1, nudgeResponsivenessScore * 0.05) : 0
  const progressRatio = Math.min(1, baseRatio + responsivenessBoost)

  if (progressRatio < 0.8) {
    const deficit = Math.max(0, Math.round(weekRequirement * 0.8 - weekEarned))
    return {
      status: 'at_risk',
      reason: 'Behind on weekly points target',
      points_deficit: deficit,
    }
  }

  return {
    status: 'on_track',
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
