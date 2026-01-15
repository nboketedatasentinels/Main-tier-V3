export const WINDOW_SIZE_WEEKS = 4

export const getWindowNumber = (weekNumber: number) => {
  if (weekNumber <= 0) return 1
  return Math.ceil(weekNumber / WINDOW_SIZE_WEEKS)
}

export const getWindowWeekNumber = (weekNumber: number) => {
  if (weekNumber <= 0) return 1
  return ((weekNumber - 1) % WINDOW_SIZE_WEEKS) + 1
}

export const getWindowRange = (weekNumber: number, totalWeeks?: number) => {
  const windowNumber = getWindowNumber(weekNumber)
  const startWeek = (windowNumber - 1) * WINDOW_SIZE_WEEKS + 1
  const rawEndWeek = startWeek + WINDOW_SIZE_WEEKS - 1
  const endWeek = totalWeeks ? Math.min(totalWeeks, rawEndWeek) : rawEndWeek
  const windowWeeks = Math.max(0, endWeek - startWeek + 1)

  return {
    windowNumber,
    startWeek,
    endWeek,
    windowWeeks,
  }
}

export const getWindowTarget = (params: {
  weekNumber: number
  weeklyTarget: number
  totalWeeks?: number
}) => {
  const { weekNumber, weeklyTarget, totalWeeks } = params
  const { windowNumber, windowWeeks } = getWindowRange(weekNumber, totalWeeks)
  return {
    windowNumber,
    windowWeeks,
    targetPoints: Math.max(0, weeklyTarget * windowWeeks),
  }
}
