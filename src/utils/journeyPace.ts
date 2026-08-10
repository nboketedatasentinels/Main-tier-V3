import type { JourneyType } from '@/config/pointsConfig'
import {
  JOURNEY_MONTH_COUNTS,
  WEEKS_PER_MONTH,
  isMonthBasedJourney,
  weekToMonth,
} from '@/utils/journeyType'
import { calculatePartnerWindowRisk } from '@/utils/windowStatus'

export type PaceTone = 'green' | 'yellow' | 'red'

export interface JourneyPaceInfo {
  label: string
  detail: string
  tone: PaceTone
  /** Points expected by now on the pass-mark timeline (informational). */
  expectedPointsNow: number
  /** Pass-mark slice for one checklist month (3M/6M/9M only). */
  monthTarget: number | null
  currentMonth: number | null
  weekInMonth: number | null
}

/**
 * Expected points to stay on the pass-mark timeline.
 *
 * Month journeys (3M/6M/9M) equal-slice the pass mark:
 *   monthTarget  = passMark / monthCount   (e.g. 75,000 / 3 = 25,000)
 *   week 1 of M1 → monthTarget / 4         (6,250)
 *   week 1 of M2 → monthTarget + monthTarget/4 (31,250)
 *
 * Same as linear weeks: (elapsedWeeks / totalWeeks) × passMark.
 */
export const expectedPassMarkPointsNow = (params: {
  passMark: number
  daysElapsed: number
  totalWeeks: number
}): number => {
  const { passMark, daysElapsed, totalWeeks } = params
  if (passMark <= 0 || totalWeeks <= 0) return 0
  const elapsedWeeks = Math.min(totalWeeks, Math.max(0, daysElapsed) / 7)
  return (elapsedWeeks / totalWeeks) * passMark
}

/**
 * Learner Pace tile - labels match Super Admin / partner window risk
 * (`calculatePartnerWindowRisk`), including the week-1 grace period so a
 * brand-new learner is "On track" in both places.
 *
 * Month journeys still surface month-target context in the detail line.
 */
export const computeJourneyPace = (params: {
  totalEarned: number
  passMark: number
  daysElapsed: number
  totalWeeks: number
  journeyType?: JourneyType | null
  /** 1-based programme week; derived from daysElapsed when omitted. */
  currentWeek?: number
  /** Weekly ledger totals - same signal partners use when available. */
  earnedPointsByWeek?: Record<number, number>
}): JourneyPaceInfo => {
  const {
    totalEarned,
    passMark,
    daysElapsed,
    totalWeeks,
    journeyType,
    earnedPointsByWeek = {},
  } = params
  const totalDays = totalWeeks * 7

  const journeyWeek = Math.min(
    Math.max(1, params.currentWeek ?? (Math.ceil(Math.max(0, daysElapsed) / 7) || 1)),
    Math.max(1, totalWeeks),
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

  const expectedPointsNow = expectedPassMarkPointsNow({
    passMark,
    daysElapsed,
    totalWeeks,
  })

  if (passMark <= 0 || totalDays <= 0) {
    return {
      label: 'Just starting',
      detail: 'Tracking begins once your journey starts',
      tone: 'yellow',
      expectedPointsNow: 0,
      monthTarget,
      currentMonth,
      weekInMonth,
    }
  }

  if (daysElapsed < 1 && journeyWeek <= 1) {
    return {
      label: 'Just starting',
      detail: 'Pace tracking starts after day 1',
      tone: 'yellow',
      expectedPointsNow: 0,
      monthTarget,
      currentMonth,
      weekInMonth,
    }
  }

  const risk = calculatePartnerWindowRisk({
    journeyType: journeyType ?? null,
    currentWeek: journeyWeek,
    totalPoints: totalEarned,
    earnedPointsByWeek,
    programDurationWeeks: totalWeeks,
  })

  const monthPaceHint =
    useMonths && monthTarget != null && currentMonth != null && weekInMonth != null
      ? `Month ${currentMonth} target ~${monthTarget.toLocaleString()} pts (~${Math.round(monthTarget / WEEKS_PER_MONTH).toLocaleString()}/week)`
      : null

  // Map admin/partner levels → learner Pace copy (same buckets).
  if (risk.level === 'on_track') {
    const isGrace = journeyWeek <= 1
    if (isGrace) {
      return {
        label: 'On track',
        detail: monthPaceHint
          ? `Week 1 · getting started · ${monthPaceHint}`
          : 'Week 1 · getting started — keep earning',
        tone: 'green',
        expectedPointsNow,
        monthTarget,
        currentMonth,
        weekInMonth,
      }
    }
    // Ahead only when clearly above the pass-mark timeline; still "on track"
    // for admin, but learners benefit from positive reinforcement.
    const ahead =
      expectedPointsNow > 0 && totalEarned / expectedPointsNow >= 1.05
    if (ahead) {
      return {
        label: 'Ahead of pace',
        detail: monthPaceHint
          ? `${Math.round((totalEarned / expectedPointsNow - 1) * 100)}% above expected · ${monthPaceHint}`
          : `${Math.round((totalEarned / expectedPointsNow - 1) * 100)}% above expected`,
        tone: 'green',
        expectedPointsNow,
        monthTarget,
        currentMonth,
        weekInMonth,
      }
    }
    return {
      label: 'On track',
      detail: monthPaceHint
        ? `Keeping up · ${monthPaceHint}`
        : 'Pace matches your journey timeline',
      tone: 'green',
      expectedPointsNow,
      monthTarget,
      currentMonth,
      weekInMonth,
    }
  }

  if (risk.level === 'warning') {
    return {
      label: 'Slightly behind',
      detail: monthPaceHint
        ? `${risk.reason ?? 'A nudge would help'} · ${monthPaceHint}`
        : risk.reason ?? 'A nudge would help',
      tone: 'yellow',
      expectedPointsNow,
      monthTarget,
      currentMonth,
      weekInMonth,
    }
  }

  // behind | critical
  return {
    label: 'Behind pace',
    detail: monthPaceHint
      ? `${risk.reason ?? 'Below expected for this window'} · ${monthPaceHint}`
      : risk.reason ?? 'Below expected for this window',
    tone: 'red',
    expectedPointsNow,
    monthTarget,
    currentMonth,
    weekInMonth,
  }
}
