import { describe, expect, it } from 'vitest'
import { expectedPassMarkPointsNow, computeJourneyPace } from '@/utils/journeyPace'

describe('expectedPassMarkPointsNow', () => {
  it('uses monthTarget/4 for week 1 of a 3M journey', () => {
    expect(
      expectedPassMarkPointsNow({
        passMark: 75_000,
        daysElapsed: 7,
        totalWeeks: 12,
      }),
    ).toBe(6_250)
  })

  it('stacks prior months when entering month 2 week 1', () => {
    expect(
      expectedPassMarkPointsNow({
        passMark: 75_000,
        daysElapsed: 35,
        totalWeeks: 12,
      }),
    ).toBe(31_250)
  })
})

describe('computeJourneyPace', () => {
  it('matches admin week-1 grace: On track even with low points', () => {
    const pace = computeJourneyPace({
      totalEarned: 1_000,
      passMark: 75_000,
      daysElapsed: 3,
      totalWeeks: 12,
      journeyType: '3M',
      currentWeek: 1,
      earnedPointsByWeek: { 1: 1_000 },
    })
    expect(pace.label).toBe('On track')
    expect(pace.tone).toBe('green')
    expect(pace.detail).toContain('Week 1')
    expect(pace.monthTarget).toBe(25_000)
  })

  it('stays healthy mid-journey when the window is on track', () => {
    // Week 3 = week 1 of window 2; full window target already earned → healthy
    const pace = computeJourneyPace({
      totalEarned: 18_750,
      passMark: 75_000,
      daysElapsed: 21,
      totalWeeks: 12,
      journeyType: '3M',
      currentWeek: 3,
      earnedPointsByWeek: { 3: 12_500 },
    })
    expect(['On track', 'Ahead of pace']).toContain(pace.label)
    expect(pace.tone).toBe('green')
  })
})
