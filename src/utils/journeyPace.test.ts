import { describe, expect, it } from 'vitest'
import {
  expectedPassMarkPointsNow,
  classifyJourneyPace,
  computeJourneyPace,
  dailyPassMarkTarget,
} from '@/utils/journeyPace'

describe('expectedPassMarkPointsNow (day-based)', () => {
  it('scales by calendar days against the pass mark', () => {
    // 75,000 / 84 ≈ 892.86 pts/day → day 3 ≈ 2,678.57
    expect(
      expectedPassMarkPointsNow({
        passMark: 75_000,
        daysElapsed: 3,
        totalWeeks: 12,
      }),
    ).toBeCloseTo((3 / 84) * 75_000, 5)
  })

  it('hits monthTarget/4 at end of week 1', () => {
    expect(
      expectedPassMarkPointsNow({
        passMark: 75_000,
        daysElapsed: 7,
        totalWeeks: 12,
      }),
    ).toBe(6_250)
  })

  it('stacks prior months at day 35 (month 2 week 1 end)', () => {
    expect(
      expectedPassMarkPointsNow({
        passMark: 75_000,
        daysElapsed: 35,
        totalWeeks: 12,
      }),
    ).toBe(31_250)
  })
})

describe('dailyPassMarkTarget', () => {
  it('is passMark / journey days', () => {
    expect(dailyPassMarkTarget(75_000, 12)).toBeCloseTo(75_000 / 84, 5)
  })
})

describe('classifyJourneyPace', () => {
  it('marks just starting before day 1', () => {
    const pace = classifyJourneyPace({
      totalEarned: 0,
      passMark: 75_000,
      daysElapsed: 0.5,
      totalWeeks: 12,
    })
    expect(pace.level).toBe('just_starting')
  })

  it('is on track when earned meets the day minimum', () => {
    // Day 3 min ≈ 2,679; earn 2,700 → on_track
    const pace = classifyJourneyPace({
      totalEarned: 2_700,
      passMark: 75_000,
      daysElapsed: 3,
      totalWeeks: 12,
    })
    expect(pace.level).toBe('on_track')
    expect(pace.expectedPointsNow).toBeCloseTo((3 / 84) * 75_000, 5)
  })

  it('flags behind when well under the day minimum', () => {
    // Day 7 min = 6,250; earn 1,000 → ratio 0.16 → critical
    const pace = classifyJourneyPace({
      totalEarned: 1_000,
      passMark: 75_000,
      daysElapsed: 7,
      totalWeeks: 12,
    })
    expect(pace.level).toBe('critical')
    expect(pace.deficit).toBe(5_250)
  })
})

describe('computeJourneyPace', () => {
  it('surfaces day + minimum in the detail for on track', () => {
    const pace = computeJourneyPace({
      totalEarned: 2_700,
      passMark: 75_000,
      daysElapsed: 3,
      totalWeeks: 12,
      journeyType: '3M',
      currentWeek: 1,
    })
    expect(pace.label).toBe('On track')
    expect(pace.detail).toContain('Day')
    expect(pace.detail).toContain('min ~')
    expect(pace.monthTarget).toBe(25_000)
  })

  it('shows behind with pts short when under the day minimum', () => {
    const pace = computeJourneyPace({
      totalEarned: 1_000,
      passMark: 75_000,
      daysElapsed: 7,
      totalWeeks: 12,
      journeyType: '3M',
      currentWeek: 1,
    })
    expect(pace.label).toBe('Behind pace')
    expect(pace.detail).toContain('pts short')
    expect(pace.tone).toBe('red')
  })
})
