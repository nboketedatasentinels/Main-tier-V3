import {
  differenceInCalendarDays,
  endOfISOWeek,
  format,
  getISOWeek,
  startOfISOWeek,
} from 'date-fns'

export const getCurrentWeekNumber = (date = new Date()) => getISOWeek(date)

export const getWeekKey = (date = new Date()) => {
  const week = getCurrentWeekNumber(date)
  return `${date.getFullYear()}-W${week}`
}

export const calculateWeekProgress = (earned: number, target: number) => {
  if (!target || target <= 0) return 0
  const percentage = Math.round((earned / target) * 100)
  return Math.min(100, Math.max(0, percentage))
}

export const getWeekDateRange = (date = new Date()) => {
  const start = startOfISOWeek(date)
  const end = endOfISOWeek(date)
  return {
    start,
    end,
    label: `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`,
  }
}

export const getWeeksRemaining = (totalWeeks: number, currentWeek: number) => {
  if (!totalWeeks) return 0
  return Math.max(0, totalWeeks - currentWeek)
}

export const formatDateDisplay = (date: Date) => format(date, 'MMM d, yyyy')

export const getDaysRemainingInWeek = (date = new Date()) => {
  const end = endOfISOWeek(date)
  const diff = differenceInCalendarDays(end, date)
  return Math.max(0, diff)
}
