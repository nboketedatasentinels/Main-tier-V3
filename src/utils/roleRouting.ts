import { UserProfile, UserRole } from '@/types'
import { normalizeRole } from './role'

/**
 * Gets the default dashboard route based on membership status.
 *
 * @param membershipStatus The user's membership status ('free' or 'paid').
 * @returns The corresponding dashboard path.
 */
export const getDefaultDashboardRouteByMembership = (
  membershipStatus: 'free' | 'paid' | undefined | null
): string => {
  return membershipStatus === 'paid' ? '/app/dashboard/member' : '/app/dashboard/free'
}

/**
 * Determines the appropriate landing path for a user based on their role and profile status.
 *
 * @param profile The user's profile object.
 * @param searchParams Optional URLSearchParams to check for a 'redirectUrl'.
 * @returns The calculated landing path string.
 */
export const getLandingPathForRole = (
  profile: UserProfile | null,
  searchParams?: URLSearchParams
): string => {
  // 1. Priority: Handle external redirect flows (e.g., payment)
  const redirectUrl = searchParams?.get('redirectUrl')
  if (redirectUrl) {
    try {
      // Basic validation to prevent open redirects
      const url = new URL(redirectUrl, window.location.origin)
      if (url.hostname === window.location.hostname) {
        return url.pathname + url.search
      }
    } catch (error) {
      console.warn('Invalid redirectUrl parameter:', redirectUrl)
      // Fall through to default logic
    }
  }

  if (!profile) {
    return '/login'
  }

  const role = normalizeRole(profile.role)

  // 2. Handle admin and specialized roles first
  if (role === UserRole.SUPER_ADMIN) {
    return '/super-admin/dashboard'
  }
  if (role === UserRole.COMPANY_ADMIN) {
    return '/admin/dashboard'
  }
  if (role === UserRole.MENTOR) {
    // Corporate mentors have a different dashboard
    if (profile.transformationTier === 'corporate_leader' || profile.transformationTier === 'corporate_member') {
      return '/mentor/dashboard'
    }
    // Non-corporate mentors go to the standard learner dashboard
    return getDefaultDashboardRouteByMembership(profile.membershipStatus)
  }
  if (role === UserRole.AMBASSADOR) {
    return '/ambassador/dashboard'
  }

  // 3. Handle standard learners (user | team_leader)
  if (role === UserRole.USER || role === UserRole.TEAM_LEADER) {
    // Onboarding incomplete takes precedence
    if (!profile.onboardingComplete && !profile.onboardingSkipped) {
      return '/welcome'
    }

    // Use preferred route if set, otherwise fall back to membership default
    return (
      profile.dashboardPreferences?.defaultRoute ||
      getDefaultDashboardRouteByMembership(profile.membershipStatus)
    )
  }

  // 4. Fallback for any unknown roles
  console.warn(`Could not determine landing path for role: ${profile.role}. Defaulting to free dashboard.`)
  return '/app/dashboard/free'
}
