import { describe, expect, it } from 'vitest'
import { calculatePassMark } from './completion'

describe('calculatePassMark', () => {
  it('uses default targets when both mentor and ambassador are available', () => {
    const result = calculatePassMark('3M', true, true)

    expect(result.adjustedThreshold).toBe(75000)
    expect(result.totalTarget).toBe(113000)
    expect(result.adjustments.variantKey).toBeUndefined()
  })

  it('uses configured variant when both mentor and ambassador are unavailable', () => {
    const result = calculatePassMark('3M', false, false)

    expect(result.adjustedThreshold).toBe(67000)
    expect(result.totalTarget).toBe(101000)
    expect(result.adjustments.variantKey).toBe('without_mentor_and_ambassador')
  })

  it('uses configured variant when either mentor or ambassador is unavailable', () => {
    const missingMentor = calculatePassMark('3M', false, true)
    const missingAmbassador = calculatePassMark('3M', true, false)

    expect(missingMentor.adjustedThreshold).toBe(71000)
    expect(missingMentor.totalTarget).toBe(107000)
    expect(missingMentor.adjustments.variantKey).toBe('without_mentor_or_ambassador')

    expect(missingAmbassador.adjustedThreshold).toBe(71000)
    expect(missingAmbassador.totalTarget).toBe(107000)
    expect(missingAmbassador.adjustments.variantKey).toBe('without_mentor_or_ambassador')
  })

  it('keeps default thresholds for journeys without mentor/ambassador variants', () => {
    const result = calculatePassMark('6W', false, false)

    expect(result.adjustedThreshold).toBe(40000)
    expect(result.totalTarget).toBe(60000)
    expect(result.adjustments.variantKey).toBeUndefined()
  })
})
