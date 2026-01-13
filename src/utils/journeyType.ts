import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'

export const JOURNEY_LABELS: Record<JourneyType, string> = {
  '4W': '4-Week Intro',
  '6W': '6-Week Full',
  '3M': '3-Month Program',
  '6M': '6-Month Program',
  '9M': '9-Month Program',
  '12M': '12-Month Program',
}

export const MONTH_BASED_JOURNEYS: JourneyType[] = ['3M', '6M', '9M', '12M']

export const JOURNEY_MONTH_COUNTS: Record<JourneyType, number> = {
  '4W': 1,
  '6W': 1,
  '3M': 3,
  '6M': 6,
  '9M': 9,
  '12M': 12,
}

const JOURNEY_WEEKS_MAP: Record<number, JourneyType> = {
  4: '4W',
  6: '6W',
  12: '3M',
  24: '6M',
  36: '9M',
  48: '12M',
}

export const isJourneyType = (value: unknown): value is JourneyType =>
  value === '4W' || value === '6W' || value === '3M' || value === '6M' || value === '9M' || value === '12M'

export const getJourneyLabel = (journeyType: JourneyType): string => JOURNEY_LABELS[journeyType]

export const isMonthBasedJourney = (journeyType: JourneyType): boolean => MONTH_BASED_JOURNEYS.includes(journeyType)

export const journeyTypeFromDurationWeeks = (weeks?: number | null): JourneyType | null => {
  if (!weeks) return null
  const normalized = Math.round(weeks)
  if (!Number.isFinite(normalized)) return null
  const exactMatch = JOURNEY_WEEKS_MAP[normalized]
  if (exactMatch) return exactMatch
  if (normalized <= 4) return '4W'
  if (normalized <= 6) return '6W'
  if (normalized <= 12) return '3M'
  if (normalized <= 24) return '6M'
  if (normalized <= 36) return '9M'
  return '12M'
}

export const resolveDurationWeeksFromProgramDuration = (value?: number | string | null): number | null => {
  if (value === undefined || value === null) return null
  const parsed = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  if (parsed === 1.5) return 6
  if (parsed <= 12) return Math.round(parsed * 4)
  return Math.round(parsed)
}

export const normalizeDurationWeeks = (value?: number | string | null): number | null => {
  if (value === undefined || value === null) return null
  const parsed = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed)
}

export const resolveJourneyType = (params: {
  journeyType?: unknown
  programDurationWeeks?: number | string | null
  programDuration?: number | string | null
}): JourneyType | null => {
  const { journeyType, programDurationWeeks, programDuration } = params
  if (isJourneyType(journeyType)) return journeyType
  const durationWeeks =
    normalizeDurationWeeks(programDurationWeeks) ?? resolveDurationWeeksFromProgramDuration(programDuration)
  return journeyTypeFromDurationWeeks(durationWeeks)
}

export const getJourneyWeeks = (journeyType: JourneyType): number => JOURNEY_META[journeyType].weeks
