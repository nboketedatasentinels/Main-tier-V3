import type { JourneyType } from '@/config/pointsConfig'
import {
  JOURNEY_MONTH_COUNTS,
  WEEKS_PER_MONTH,
  isMonthBasedJourney,
  weekToMonth,
} from '@/utils/journeyType'

export type PaceTone = 'green' | 'yellow' | 'red'

/** Shared pace buckets used by learner Pace tile and Super Admin health. */
export type JourneyPaceLevel =
  | 'just_starting'
  | 'ahead'
  | 'on_track'
  | 'warning'
  | 'behind'
  | 'critical'

export interface JourneyPaceClassification {
  level: JourneyPaceLevel
  /** Minimum points expected by now: (daysElapsed / totalDays) × passMark. */
  expectedPointsNow: number
  /** Points per calendar day to hit the pass mark on time. */
  dailyTarget: number
  totalDays: number
  daysElapsed: number
  paceRatio: number
  deficit: number
  /** 0–100 style delta vs expected (positive = ahead). */
  deltaPct: number
}

export interface JourneyPaceInfo {
  label: string
  detail: string
  tone: PaceTone
  expectedPointsNow: number
  dailyTarget: number
  daysElapsed: number
  totalDays: number
  monthTarget: number | null
  currentMonth: number | null
  weekInMonth: number | null
}

/**
 * Minimum points expected after `daysElapsed` on a journey.
 *
 *   dailyTarget     = passMark / (totalWeeks × 7)
 *   expectedNow     = daysElapsed × dailyTarget   (capped at passMark)
 *
 * For 3M (75,000 / 84 days ≈ 893 pts/day):
 *   day 1  → ~893
 *   day 7  → 6,250   (= Month 1 target / 4)
 *   day 35 → 31,250  (= Month 1 + week 1 of Month 2)
 */
export const expectedPassMarkPointsNow = (params: {
  passMark: number
  daysElapsed: number
  totalWeeks: number
}): number => {
  const { passMark, daysElapsed, totalWeeks } = params
  if (passMark <= 0 || totalWeeks <= 0) return 0
  const totalDays = totalWeeks * 7
  const days = Math.min(totalDays, Math.max(0, daysElapsed))
  return (days / totalDays) * passMark
}

export const dailyPassMarkTarget = (passMark: number, totalWeeks: number): number => {
  if (passMark <= 0 || totalWeeks <= 0) return 0
  return passMark / (totalWeeks * 7)
}

/**
 * Classify pace from days on journey vs pass-mark minimum.
 *
 * Thresholds (earned / expected):
 *   ≥ 1.05  ahead
 *   ≥ 0.85  on_track
 *   ≥ 0.65  warning (slightly behind)
 *   ≥ 0.40  behind
 *   < 0.40  critical
 *
 * Day 0: just_starting. After the journey ends below pass mark → critical.
 */
export const classifyJourneyPace = (params: {
  totalEarned: number
  passMark: number
  daysElapsed: number
  totalWeeks: number
}): JourneyPaceClassification => {
  const { totalEarned, passMark, totalWeeks } = params
  const totalDays = Math.max(0, totalWeeks * 7)
  const daysElapsed = Math.max(0, params.daysElapsed)
  const dailyTarget = dailyPassMarkTarget(passMark, totalWeeks)
  const expectedPointsNow = expectedPassMarkPointsNow({
    passMark,
    daysElapsed,
    totalWeeks,
  })

  if (passMark <= 0 || totalDays <= 0) {
    return {
      level: 'just_starting',
      expectedPointsNow: 0,
      dailyTarget: 0,
      totalDays,
      daysElapsed,
      paceRatio: 1,
      deficit: 0,
      deltaPct: 0,
    }
  }

  if (daysElapsed < 1) {
    return {
      level: 'just_starting',
      expectedPointsNow: 0,
      dailyTarget,
      totalDays,
      daysElapsed,
      paceRatio: 1,
      deficit: 0,
      deltaPct: 0,
    }
  }

  const journeyEnded = daysElapsed >= totalDays
  if (journeyEnded && totalEarned < passMark) {
    return {
      level: 'critical',
      expectedPointsNow: passMark,
      dailyTarget,
      totalDays,
      daysElapsed: totalDays,
      paceRatio: passMark > 0 ? totalEarned / passMark : 0,
      deficit: Math.max(0, Math.round(passMark - totalEarned)),
      deltaPct: Math.round((totalEarned / passMark - 1) * 100),
    }
  }

  const paceRatio = expectedPointsNow > 0 ? totalEarned / expectedPointsNow : 1
  const deficit = Math.max(0, Math.round(expectedPointsNow - totalEarned))
  const deltaPct =
    expectedPointsNow > 0 ? Math.round((totalEarned / expectedPointsNow - 1) * 100) : 0

  let level: JourneyPaceLevel
  if (paceRatio >= 1.05) level = 'ahead'
  else if (paceRatio >= 0.85) level = 'on_track'
  else if (paceRatio >= 0.65) level = 'warning'
  else if (paceRatio >= 0.4) level = 'behind'
  else level = 'critical'

  return {
    level,
    expectedPointsNow,
    dailyTarget,
    totalDays,
    daysElapsed: Math.min(daysElapsed, totalDays),
    paceRatio,
    deficit,
    deltaPct,
  }
}

/** Map pace level → Super Admin journey-health bucket. */
export const paceLevelToAdminBucket = (
  level: JourneyPaceLevel,
): 'onTrack' | 'needsNudge' | 'behind' | 'critical' => {
  if (level === 'critical') return 'critical'
  if (level === 'behind') return 'behind'
  if (level === 'warning') return 'needsNudge'
  return 'onTrack'
}

/**
 * Learner Pace tile - day-based minimum vs earned, same classifier as admin.
 */
export const computeJourneyPace = (params: {
  totalEarned: number
  passMark: number
  daysElapsed: number
  totalWeeks: number
  journeyType?: JourneyType | null
  currentWeek?: number
}): JourneyPaceInfo => {
  const { totalEarned, passMark, daysElapsed, totalWeeks, journeyType } = params

  const classified = classifyJourneyPace({
    totalEarned,
    passMark,
    daysElapsed,
    totalWeeks,
  })

  const journeyWeek = Math.min(
    Math.max(1, params.currentWeek ?? (Math.ceil(Math.max(0, daysElapsed) / 7) || 1)),
    Math.max(1, totalWeeks || 1),
  )

  const useMonths = Boolean(journeyType && isMonthBasedJourney(journeyType))
  const monthCount =
    journeyType && useMonths ? JOURNEY_MONTH_COUNTS[journeyType] : null
  const monthTarget =
    monthCount && monthCount > 0 ? Math.round(passMark / monthCount) : null
  const currentMonth = useMonths ? weekToMonth(journeyWeek) : null
  const weekInMonth = useMonths
    ? ((journeyWeek - 1) % WEEKS_PER_MONTH) + 1
    : null

  const dayLabel = `Day ${Math.max(1, Math.ceil(classified.daysElapsed))} of ${classified.totalDays}`
  const expectedLabel = `min ~${Math.round(classified.expectedPointsNow).toLocaleString()} pts`
  const dailyLabel =
    classified.dailyTarget > 0
      ? `~${Math.round(classified.dailyTarget).toLocaleString()} pts/day`
      : null

  const monthHint =
    useMonths && monthTarget != null && currentMonth != null && weekInMonth != null
      ? `Month ${currentMonth} · week ${weekInMonth}/${WEEKS_PER_MONTH} · ~${monthTarget.toLocaleString()} pts/month`
      : null

  const base = {
    expectedPointsNow: classified.expectedPointsNow,
    dailyTarget: classified.dailyTarget,
    daysElapsed: classified.daysElapsed,
    totalDays: classified.totalDays,
    monthTarget,
    currentMonth,
    weekInMonth,
  }

  if (classified.level === 'just_starting') {
    return {
      ...base,
      label: 'Just starting',
      detail: dailyLabel
        ? `Pace tracking starts after day 1 · aim ${dailyLabel} toward the pass mark`
        : 'Pace tracking starts after day 1',
      tone: 'yellow',
    }
  }

  if (classified.level === 'ahead') {
    return {
      ...base,
      label: 'Ahead of pace',
      detail: [
        `${Math.abs(classified.deltaPct)}% above ${expectedLabel}`,
        dayLabel,
        monthHint,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: 'green',
    }
  }

  if (classified.level === 'on_track') {
    return {
      ...base,
      label: 'On track',
      detail: [dayLabel, expectedLabel, dailyLabel, monthHint].filter(Boolean).join(' · '),
      tone: 'green',
    }
  }

  if (classified.level === 'warning') {
    return {
      ...base,
      label: 'Slightly behind',
      detail: [
        `${Math.abs(classified.deltaPct)}% below ${expectedLabel}`,
        classified.deficit > 0 ? `${classified.deficit.toLocaleString()} pts short` : null,
        dayLabel,
        monthHint,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: 'yellow',
    }
  }

  // behind | critical
  return {
    ...base,
    label: 'Behind pace',
    detail: [
      `${Math.abs(classified.deltaPct)}% below ${expectedLabel}`,
      classified.deficit > 0 ? `${classified.deficit.toLocaleString()} pts short` : null,
      dayLabel,
      dailyLabel ? `catch up toward ${dailyLabel}` : null,
      monthHint,
    ]
      .filter(Boolean)
      .join(' · '),
    tone: 'red',
  }
}
