export const WINDOW_SIZE_WEEKS = 4
export const PARALLEL_WINDOW_SIZE_WEEKS = 2

export const getWindowNumber = (weekNumber: number, windowSize = WINDOW_SIZE_WEEKS) => {
  if (weekNumber <= 0) return 1
  return Math.ceil(weekNumber / windowSize)
}

export const getWindowWeekNumber = (weekNumber: number, windowSize = WINDOW_SIZE_WEEKS) => {
  if (weekNumber <= 0) return 1
  return ((weekNumber - 1) % windowSize) + 1
}

export const getWindowRange = (weekNumber: number, totalWeeks?: number, windowSize = WINDOW_SIZE_WEEKS) => {
  const windowNumber = getWindowNumber(weekNumber, windowSize)
  const startWeek = (windowNumber - 1) * windowSize + 1
  const rawEndWeek = startWeek + windowSize - 1
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

export const getWindowTargetByJourney = (journeyType: string, weeklyTarget: number): number => {
  switch (journeyType) {
    case '4W':
      return 7500
    case '6W':
      return 14000
    case '3M':
    case '6M':
      return 12500
    case '9M':
      return 12600
    default:
      return weeklyTarget * PARALLEL_WINDOW_SIZE_WEEKS
  }
}
