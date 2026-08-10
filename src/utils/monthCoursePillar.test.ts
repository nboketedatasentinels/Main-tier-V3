import { describe, expect, it } from 'vitest'
import {
  resolvePillarForMonth,
  cataloguePillarToPillar,
  isProgrammePassFailMonth,
} from '@/utils/monthCoursePillar'

describe('cataloguePillarToPillar', () => {
  it('maps catalogue codes to programme pillars', () => {
    expect(cataloguePillarToPillar('L')).toBe('leading_self')
    expect(cataloguePillarToPillar('I')).toBe('innovation_technology')
    expect(cataloguePillarToPillar('F')).toBe('fostering')
    expect(cataloguePillarToPillar('T')).toBe('transforming_business')
    expect(cataloguePillarToPillar('G')).toBe('starter_kit')
  })
})

describe('resolvePillarForMonth', () => {
  it('uses the month course pillar', () => {
    const assignments = {
      '1': 'data-fluency-reporting', // I
      '2': 'mindset-reset', // L
      '3': 'think-like-an-owner', // T
    }
    expect(resolvePillarForMonth(1, assignments)).toBe('innovation_technology')
    expect(resolvePillarForMonth(2, assignments)).toBe('leading_self')
    expect(resolvePillarForMonth(3, assignments)).toBe('transforming_business')
  })

  it('returns null when the month has no course', () => {
    expect(resolvePillarForMonth(1, { '1': '' })).toBeNull()
    expect(resolvePillarForMonth(2, { '1': 'mindset-reset' })).toBeNull()
  })
})

describe('isProgrammePassFailMonth', () => {
  it('marks months 3, 6, and 9 as Pass/Fail assessments', () => {
    expect(isProgrammePassFailMonth(3)).toBe(true)
    expect(isProgrammePassFailMonth(6)).toBe(true)
    expect(isProgrammePassFailMonth(9)).toBe(true)
    expect(isProgrammePassFailMonth(1)).toBe(false)
    expect(isProgrammePassFailMonth(2)).toBe(false)
    expect(isProgrammePassFailMonth(4)).toBe(false)
  })
})
