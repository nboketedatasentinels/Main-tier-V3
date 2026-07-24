import {
  addDays,
  differenceInCalendarDays,
  endOfISOWeek,
  format,
  getISOWeek,
  parseISO,
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

export interface JourneyTimingInfo {
  currentWeek: number
  weeksElapsed: number
  daysIntoWeek: number
  daysRemaining: number
  weekStart: Date
  weekEnd: Date
  weekLabel: string
  journeyStart: Date
  journeyEnd: Date
  totalDaysElapsed: number
  progressLabel: string
  // Not-started (future cohort start) awareness
  notStarted: boolean
  daysUntilStart: number
  // Cycle = one 2-week window (the unit the dashboard labels "Cycle")
  currentCycle: number
  totalCycles: number
  cycleStart: Date
  cycleEnd: Date
  cycleDaysRemaining: number
  // Whole-journey countdown
  journeyDaysRemaining: number
}

/** Length of one cycle (window) in weeks. Journeys are measured in 2-week windows. */
const CYCLE_WEEKS = 2

export const getJourneyTiming = (
  journeyStartDate: string | Date | null | undefined,
  programDurationWeeks: number,
  today = new Date()
): JourneyTimingInfo | null => {
  if (!journeyStartDate) {
    return null
  }

  const startDate = typeof journeyStartDate === 'string' ? parseISO(journeyStartDate) : journeyStartDate
  const journeyEnd = addDays(startDate, programDurationWeeks * 7)

  // Raw offset can be negative when the cohort starts in the future. Clamp all
  // "elapsed" math to >= 0 so a not-yet-started journey never yields negative
  // weeks/days (which previously inflated "days left in cycle" to a bogus 14).
  const rawOffset = differenceInCalendarDays(today, startDate)
  const notStarted = rawOffset < 0
  const daysUntilStart = notStarted ? -rawOffset : 0

  const totalDaysElapsed = Math.max(0, rawOffset)
  const weeksElapsed = Math.floor(totalDaysElapsed / 7)
  const daysIntoWeek = totalDaysElapsed % 7

  // Current week for tracking (1-indexed, clamped to program duration)
  const currentWeek = Math.max(1, Math.min(programDurationWeeks, weeksElapsed + 1))

  // Week date range based on current week
  const weekStart = addDays(startDate, (currentWeek - 1) * 7)
  const weekEnd = addDays(weekStart, 7)

  // Days remaining in current week. Measure from the later of today/weekStart so
  // a future start never reports more than a full week.
  const weekRef = notStarted ? weekStart : today
  const daysRemaining = Math.max(0, differenceInCalendarDays(weekEnd, weekRef))

  // Cycle = one 2-week window. currentCycle/totalCycles + days left in the window.
  const totalCycles = Math.max(1, Math.ceil(programDurationWeeks / CYCLE_WEEKS))
  const currentCycle = Math.max(1, Math.min(totalCycles, Math.ceil(currentWeek / CYCLE_WEEKS)))
  const cycleStart = addDays(startDate, (currentCycle - 1) * CYCLE_WEEKS * 7)
  const cycleEnd = addDays(cycleStart, CYCLE_WEEKS * 7)
  const cycleRef = notStarted ? cycleStart : today
  const cycleDaysRemaining = Math.max(0, differenceInCalendarDays(cycleEnd, cycleRef))

  // Whole-journey countdown (0 once the program window has fully elapsed).
  const journeyDaysRemaining = Math.max(0, differenceInCalendarDays(journeyEnd, notStarted ? startDate : today))

  // Progress label: "X weeks, Y days"
  let progressLabel: string
  if (notStarted) {
    progressLabel = `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`
  } else if (totalDaysElapsed >= programDurationWeeks * 7) {
    progressLabel = `${programDurationWeeks} weeks`
  } else if (weeksElapsed === 0) {
    progressLabel = `${daysIntoWeek} day${daysIntoWeek === 1 ? '' : 's'}`
  } else if (daysIntoWeek === 0) {
    progressLabel = `${weeksElapsed} week${weeksElapsed === 1 ? '' : 's'}`
  } else {
    progressLabel = `${weeksElapsed} week${weeksElapsed === 1 ? '' : 's'}, ${daysIntoWeek} day${daysIntoWeek === 1 ? '' : 's'}`
  }

  return {
    currentWeek,
    weeksElapsed,
    daysIntoWeek,
    daysRemaining,
    weekStart,
    weekEnd,
    weekLabel: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
    journeyStart: startDate,
    journeyEnd,
    totalDaysElapsed,
    progressLabel,
    notStarted,
    daysUntilStart,
    currentCycle,
    totalCycles,
    cycleStart,
    cycleEnd,
    cycleDaysRemaining,
    journeyDaysRemaining,
  }
}

export const getJourneyWeekDateRange = (journeyStartDate: string | Date | null | undefined, weekNumber: number) => {
  if (!journeyStartDate) {
    return getWeekDateRange()
  }

  const startDate = typeof journeyStartDate === 'string' ? parseISO(journeyStartDate) : journeyStartDate
  const weekStart = addDays(startDate, (weekNumber - 1) * 7)
  const weekEnd = addDays(weekStart, 7)

  return {
    start: weekStart,
    end: weekEnd,
    label: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
  }
}

export const getDaysRemainingInJourneyWeek = (journeyStartDate: string | Date | null | undefined, weekNumber: number, today = new Date()) => {
  if (!journeyStartDate) {
    return getDaysRemainingInWeek(today)
  }

  const { end } = getJourneyWeekDateRange(journeyStartDate, weekNumber)
  const diff = differenceInCalendarDays(end, today)
  return Math.max(0, diff)
}
