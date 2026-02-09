import { describe, expect, it } from 'vitest'
import type { UserProfile } from '@/types'
import { UserRole, TransformationTier } from '@/types'
import { getLandingPathForRole } from './roleRouting'

const asProfile = (overrides: Partial<UserProfile>): UserProfile => overrides as UserProfile

describe('getLandingPathForRole onboarding gating', () => {
  it('routes free users with incomplete onboarding to welcome', () => {
    const path = getLandingPathForRole(
      asProfile({
        role: UserRole.USER,
        membershipStatus: 'free',
        onboardingComplete: false,
        onboardingSkipped: false,
      })
    )

    expect(path).toBe('/welcome')
  })

  it('does not route paid members with incomplete onboarding to welcome', () => {
    const path = getLandingPathForRole(
      asProfile({
        role: UserRole.USER,
        membershipStatus: 'paid',
        onboardingComplete: false,
        onboardingSkipped: false,
      })
    )

    expect(path).toBe('/app/dashboard/member')
  })

  it('does not route paid-tier users to welcome when membership status is missing', () => {
    const path = getLandingPathForRole(
      asProfile({
        role: UserRole.USER,
        transformationTier: TransformationTier.INDIVIDUAL_PAID,
        onboardingComplete: false,
        onboardingSkipped: false,
      })
    )

    expect(path).toBe('/app/dashboard/member')
  })
})
