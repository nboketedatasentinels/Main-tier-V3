import { describe, expect, it } from 'vitest'
import {
  evaluateSinglePillarCourseSet,
  wouldCreateSinglePillarCourseSet,
} from '@/config/courseCatalogue'

describe('evaluateSinglePillarCourseSet', () => {
  it('allows fewer than 3 courses even if same pillar', () => {
    expect(
      evaluateSinglePillarCourseSet({
        '1': 'mindset-reset', // L
        '2': 'confidence-code', // L
        '3': '',
      }).blocked,
    ).toBe(false)
  })

  it('blocks when all 3 courses share one pillar', () => {
    const result = evaluateSinglePillarCourseSet({
      '1': 'mindset-reset', // L
      '2': 'confidence-code', // L
      '3': 'science-of-you', // L
    })
    expect(result.blocked).toBe(true)
    expect(result.pillar).toBe('L')
    expect(result.message).toContain('Leading Self')
  })

  it('allows 2 from one pillar + 1 from another', () => {
    expect(
      evaluateSinglePillarCourseSet({
        '1': 'mindset-reset', // L
        '2': 'confidence-code', // L
        '3': 'think-like-an-owner', // T
      }).blocked,
    ).toBe(false)
  })

  it('allows three different pillars', () => {
    expect(
      evaluateSinglePillarCourseSet({
        '1': 'mindset-reset', // L
        '2': 'think-like-an-owner', // T
        '3': 'data-fluency-reporting', // I
      }).blocked,
    ).toBe(false)
  })
})

describe('wouldCreateSinglePillarCourseSet', () => {
  it('blocks selecting a 3rd course that completes a single-pillar set', () => {
    const result = wouldCreateSinglePillarCourseSet({
      assignments: {
        '1': 'mindset-reset',
        '2': 'confidence-code',
        '3': '',
      },
      monthKey: '3',
      nextCourseId: 'path-to-promotion', // L
    })
    expect(result.blocked).toBe(true)
  })

  it('allows selecting a 3rd course from a different pillar', () => {
    const result = wouldCreateSinglePillarCourseSet({
      assignments: {
        '1': 'mindset-reset',
        '2': 'confidence-code',
        '3': '',
      },
      monthKey: '3',
      nextCourseId: 'ai-stacking-101', // I
    })
    expect(result.blocked).toBe(false)
  })
})
