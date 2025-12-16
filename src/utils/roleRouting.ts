import { UserProfile } from '@/types'
import { normalizeRole } from './role'
import { getPreferredDashboardRoute } from '@/utils/dashboardPaths'

/**
 * Gets the default dashboard route based on membership status.
 */
export const getDefaultDashboardRouteByMembership = (
  membershipStatus: 'free' | 'paid' | undefined | null
): string => {
  return membershipStatus === 'paid'
    ? '/app/dashboard/member'
    : '/app/dashboard/free'
}

/**
 * Comprehensive role-based landing path with priority logic
 */
export const getLandingPathForRole = (
  profile: UserProfile | null,
  searchParams?: URLSearchParams
): string => {
  const role = profile?.role
  const redirectUrl = searchParams?.get('redirect')

  console.log('🔷 getLandingPathForRole called with:', {
    role,
    roleType: typeof role,
    redirectUrl,
    profile: profile
      ? {
          id: profile.id,
          email: profile.email,
          role: profile.role,
          onboardingComplete: profile.onboardingComplete,
          transformationTier: profile.transformationTier,
          dashboardPreferences: profile.dashboardPreferences,
        }
      : null,
  })

  /* ------------------------------------
   * Priority 1: External redirect
   * ------------------------------------ */
  if (redirectUrl) {
    console.log('🔷 Redirect override detected:', redirectUrl)
    return redirectUrl
  }

  const normalizedRole = normalizeRole(role)
  console.log('🔷 Normalized role:', normalizedRole)

  /* ------------------------------------
   * Priority 2: Super Admin
   * ------------------------------------ */
  if (normalizedRole === 'super_admin') {
    console.log('🔷 Super admin detected')
    return '/super-admin/dashboard'
  }

  /* ------------------------------------
   * Priority 3: Partner / Company Admin
   * ------------------------------------ */
  if (normalizedRole === 'partner') {
    console.log('🔷 Partner admin detected')
    return '/admin/dashboard'
  }

  /* ------------------------------------
   * Priority 4: Mentor
   * ------------------------------------ */
  if (normalizedRole === 'mentor') {
    console.log('🔷 Mentor detected')

    const tier = profile?.transformationTier?.toString().toLowerCase()
    console.log('🔷 Mentor tier:', tier)

    if (tier === 'corporate_member' || tier === 'corporate_leader') {
      console.log('🔷 Corporate mentor → mentor dashboard')
      return '/mentor/dashboard'
    }

    const preferred = getPreferredDashboardRoute(profile)
    if (preferred) {
      console.log('🔷 Individual mentor preferred route:', preferred)
      return preferred
    }

    return '/mentor/dashboard'
  }

  /* ------------------------------------
   * Priority 5: Ambassador
   * ------------------------------------ */
  if (normalizedRole === 'ambassador') {
    console.log('🔷 Ambassador detected')
    return '/ambassador/dashboard'
  }

  /* ------------------------------------
   * Priority 6: Learners (user / team_leader)
   * ------------------------------------ */
  if (profile) {
    const needsOnboarding =
      !profile.onboardingComplete && !profile.onboardingSkipped

    console.log('🔷 Learner onboarding check:', {
      onboardingComplete: profile.onboardingComplete,
      onboardingSkipped: profile.onboardingSkipped,
      needsOnboarding,
    })

    if (needsOnboarding) {
      return '/welcome'
    }

    const preferred = getPreferredDashboardRoute(profile)
    if (preferred) {
      console.log('🔷 Learner preferred route:', preferred)
      return preferred
    }

    const fallback = getDefaultDashboardRouteByMembership(
      profile.membershipStatus
    )

    console.log('🔷 Learner fallback route:', fallback)
    return fallback
  }

  /* ------------------------------------
   * Absolute fallback
   * ------------------------------------ */
  console.log('🔷 Absolute fallback → free dashboard')
  return '/app/dashboard/free'
}
