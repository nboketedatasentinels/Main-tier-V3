import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

vi.mock('@/services/userProfileService', () => ({
  fetchUserProfileById: vi.fn(),
}))

import { calculatePassMark } from './completion'

describe('calculatePassMark', () => {
  it('uses default targets when both mentor and coach are available', () => {
    const result = calculatePassMark('3M', true, true)

    expect(result.adjustedThreshold).toBe(75000)
    expect(result.totalTarget).toBe(113000)
    expect(result.adjustments.variantKey).toBeUndefined()
  })

  it('uses configured variant when both mentor and coach are unavailable', () => {
    const result = calculatePassMark('3M', false, false)

    expect(result.adjustedThreshold).toBe(67000)
    expect(result.totalTarget).toBe(101000)
    expect(result.adjustments.variantKey).toBe('without_mentor_and_ambassador')
  })

  it('uses configured variant when either mentor or coach is unavailable', () => {
    const missingMentor = calculatePassMark('3M', false, true)
    const missingCoach = calculatePassMark('3M', true, false)

    expect(missingMentor.adjustedThreshold).toBe(71000)
    expect(missingMentor.totalTarget).toBe(107000)
    expect(missingMentor.adjustments.variantKey).toBe('without_mentor_or_ambassador')

    expect(missingCoach.adjustedThreshold).toBe(71000)
    expect(missingCoach.totalTarget).toBe(107000)
    expect(missingCoach.adjustments.variantKey).toBe('without_mentor_or_ambassador')
  })

  it('keeps default thresholds for journeys without mentor/coach variants', () => {
    const result = calculatePassMark('6W', false, false)

    expect(result.adjustedThreshold).toBe(40000)
    expect(result.totalTarget).toBe(60000)
    expect(result.adjustments.variantKey).toBeUndefined()
  })
})
