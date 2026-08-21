import { describe, expect, it } from 'vitest'
import { requiresMandatoryLiftAssessment } from '@/utils/liftRequirement'

describe('requiresMandatoryLiftAssessment', () => {
  it('requires LIFT for learners on 3M/6M/9M', () => {
    expect(
      requiresMandatoryLiftAssessment({ role: 'paid_member', journeyType: '3M' }),
    ).toBe(true)
    expect(
      requiresMandatoryLiftAssessment({ role: 'free_user', journeyType: '6M' }),
    ).toBe(true)
    expect(requiresMandatoryLiftAssessment({ role: 'user', journeyType: '9M' })).toBe(true)
  })

  it('does not require LIFT on 4W/6W', () => {
    expect(
      requiresMandatoryLiftAssessment({ role: 'paid_member', journeyType: '4W' }),
    ).toBe(false)
    expect(
      requiresMandatoryLiftAssessment({ role: 'paid_member', journeyType: '6W' }),
    ).toBe(false)
  })

  it('never requires LIFT for staff roles', () => {
    expect(requiresMandatoryLiftAssessment({ role: 'mentor', journeyType: '3M' })).toBe(false)
    expect(requiresMandatoryLiftAssessment({ role: 'ambassador', journeyType: '3M' })).toBe(
      false,
    )
    expect(requiresMandatoryLiftAssessment({ role: 'partner', journeyType: '3M' })).toBe(false)
    expect(requiresMandatoryLiftAssessment({ role: 'super_admin', journeyType: '9M' })).toBe(
      false,
    )
  })
})
