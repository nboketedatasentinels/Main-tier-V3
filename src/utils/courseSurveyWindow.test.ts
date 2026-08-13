import { describe, expect, it } from 'vitest'
import { resolveCourseSurveyKind } from '@/utils/courseSurveyWindow'

describe('resolveCourseSurveyKind', () => {
  it('returns pre when journey timing is unknown', () => {
    expect(resolveCourseSurveyKind({})).toBe('pre')
    expect(resolveCourseSurveyKind({ programDurationWeeks: 12 })).toBe('pre')
  })

  it('returns pre until the final 3 weeks', () => {
    // 12-week journey starting 60 days ago → ~week 9, >21 days remaining
    const start = new Date('2026-01-01T12:00:00.000Z')
    const now = new Date('2026-03-02T12:00:00.000Z') // 60 days later
    expect(
      resolveCourseSurveyKind({
        journeyStartDate: start,
        programDurationWeeks: 12,
        now,
      }),
    ).toBe('pre')
  })

  it('returns post when ≤ 3 weeks remain', () => {
    const start = new Date('2026-01-01T12:00:00.000Z')
    // 12 weeks = 84 days; at day 70 → 14 days remaining
    const now = new Date('2026-03-12T12:00:00.000Z')
    expect(
      resolveCourseSurveyKind({
        journeyStartDate: start,
        programDurationWeeks: 12,
        now,
      }),
    ).toBe('post')
  })

  it('falls back to currentWeek when no start date', () => {
    expect(
      resolveCourseSurveyKind({
        programDurationWeeks: 12,
        currentWeek: 8,
      }),
    ).toBe('pre')
    expect(
      resolveCourseSurveyKind({
        programDurationWeeks: 12,
        currentWeek: 10,
      }),
    ).toBe('post')
  })
})
