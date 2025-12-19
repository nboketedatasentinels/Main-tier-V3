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

export const calculateUserRiskStatus = (
  currentWeek: number,
  earnedPoints: Record<number, number>,
  requiredPoints: Record<number, number>,
): { status: 'at_risk' | 'on_track'; reason?: string; points_deficit?: number } => {
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
  const progressRatio = Math.min(weeklyRatio, cumulativeRatio)

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
