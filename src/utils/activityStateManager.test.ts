import { describe, expect, it } from 'vitest'
import type { ActivityDef } from '@/config/pointsConfig'
import { calculateActivityAvailability, getVisibleActivities } from './activityStateManager'

const makeActivity = (overrides: Partial<ActivityDef> = {}): ActivityDef => ({
  id: 'podcast',
  baseId: 'podcast',
  title: 'Test activity',
  description: 'Test description',
  points: 100,
  maxPerMonth: 3,
  week: 1,
  category: 'Learning',
  approvalType: 'self',
  ...overrides,
})

describe('calculateActivityAvailability', () => {
  it('returns available when activity is in-window and under limits', () => {
    const activity = makeActivity({ flexibleWeeks: true })
    const result = calculateActivityAvailability(activity, {
      windowWeek: 1,
      weekCount: 0,
      windowCount: 0,
      totalCompletedAllTime: 0,
    })

    expect(result.state).toBe('available')
  })

  it('returns next_window for window-limited activity at window cap', () => {
    const activity = makeActivity({
      activityPolicy: { type: 'window_limited', maxPerWindow: 1 },
      flexibleWeeks: true,
    })

    const result = calculateActivityAvailability(activity, {
      windowWeek: 1,
      weekCount: 0,
      windowCount: 1,
      totalCompletedAllTime: 1,
    })

    expect(result).toMatchObject({
      state: 'next_window',
      reason: 'window_cap_reached',
    })
  })

  it('returns permanently_exhausted for one-time activity already used', () => {
    const activity = makeActivity({
      activityPolicy: { type: 'one_time', maxTotal: 1 },
      flexibleWeeks: true,
    })

    const result = calculateActivityAvailability(activity, {
      windowWeek: 1,
      weekCount: 0,
      windowCount: 0,
      totalCompletedAllTime: 1,
    })

    expect(result).toMatchObject({
      state: 'permanently_exhausted',
      reason: 'one_time_used',
    })
  })

  it('returns locked when activity is scheduled for a different week', () => {
    const activity = makeActivity({ week: 3, flexibleWeeks: false })

    const result = calculateActivityAvailability(activity, {
      windowWeek: 1,
      weekCount: 0,
      windowCount: 0,
      totalCompletedAllTime: 0,
    })

    expect(result).toMatchObject({
      state: 'locked',
      reason: 'scheduled',
    })
  })

  it('keeps flexible activities locked until their configured unlock week', () => {
    const activity = makeActivity({ week: 3, flexibleWeeks: true })

    const beforeUnlock = calculateActivityAvailability(activity, {
      windowWeek: 2,
      weekCount: 0,
      windowCount: 0,
      totalCompletedAllTime: 0,
    })
    expect(beforeUnlock).toMatchObject({
      state: 'locked',
      reason: 'scheduled',
      isScheduledForWeek: false,
    })

    const atUnlock = calculateActivityAvailability(activity, {
      windowWeek: 3,
      weekCount: 0,
      windowCount: 0,
      totalCompletedAllTime: 0,
    })
    expect(atUnlock).toMatchObject({
      state: 'available',
      isScheduledForWeek: true,
    })

    const afterUnlock = calculateActivityAvailability(activity, {
      windowWeek: 5,
      weekCount: 0,
      windowCount: 0,
      totalCompletedAllTime: 0,
    })
    expect(afterUnlock).toMatchObject({
      state: 'available',
      isScheduledForWeek: true,
    })
  })

  it('returns locked with cooldown reason when cooldown is active', () => {
    const activity = makeActivity({
      flexibleWeeks: true,
      cooldownWeeks: 2,
    })

    const result = calculateActivityAvailability(activity, {
      windowWeek: 4,
      weekCount: 0,
      windowCount: 0,
      totalCompletedAllTime: 1,
      lastCompletedWeek: 2,
    })

    expect(result).toMatchObject({
      state: 'locked',
      reason: 'cooldown',
      cooldownRemainingWeeks: 1,
    })
  })

  it('returns exhausted when max-per-window cap is reached', () => {
    const activity = makeActivity({
      maxPerMonth: 1,
      flexibleWeeks: true,
    })

    const result = calculateActivityAvailability(activity, {
      windowWeek: 1,
      weekCount: 0,
      windowCount: 1,
      totalCompletedAllTime: 1,
    })

    expect(result).toMatchObject({
      state: 'exhausted',
      reason: 'max_per_window',
    })
  })
})

describe('getVisibleActivities', () => {
  it('keeps permanently exhausted activities visible and sorts by state priority', () => {
    const input = [
      { id: 'locked', availability: { state: 'locked' as const } },
      { id: 'exhausted', availability: { state: 'exhausted' as const } },
      { id: 'available', availability: { state: 'available' as const } },
      { id: 'permanent', availability: { state: 'permanently_exhausted' as const } },
      { id: 'next', availability: { state: 'next_window' as const } },
    ]

    const result = getVisibleActivities(input)

    expect(result.map(item => item.id)).toEqual([
      'available',
      'next',
      'permanent',
      'locked',
      'exhausted',
    ])
  })

  it('does not mutate the original array reference', () => {
    const input = [
      { id: 'a', availability: { state: 'locked' as const } },
      { id: 'b', availability: { state: 'available' as const } },
    ]

    const result = getVisibleActivities(input)

    expect(result).not.toBe(input)
    expect(input.map(item => item.id)).toEqual(['a', 'b'])
  })

  it('hides activities blocked by missing mentor or ambassador support', () => {
    const input = [
      { id: 'mentor', availability: { state: 'locked' as const, reason: 'missing_mentor' as const } },
      { id: 'ambassador', availability: { state: 'locked' as const, reason: 'missing_ambassador' as const } },
      { id: 'regular', availability: { state: 'available' as const } },
    ]

    const result = getVisibleActivities(input)

    expect(result.map((item) => item.id)).toEqual(['regular'])
  })
})
