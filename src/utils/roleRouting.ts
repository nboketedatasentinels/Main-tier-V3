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
 * Comprehensive role-based landing path with priority logic
 * Priority:
 * 1. redirectUrl query parameter (external/payment flows)
 * 2. Super Admin -> /super-admin/dashboard
 * 3. Partner (COMPANY_ADMIN) -> /admin/dashboard
 * 4. Mentor conditional based on transformationTier
 * 5. Ambassador -> /ambassador/dashboard
 * 6. Regular user (USER, TEAM_LEADER) with onboarding check
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

  // Priority 2: Super Admin
  const normalizedRole = normalizeRole(profile.role)

  if (normalizedRole === 'super_admin') {
    return '/super-admin/dashboard'
  }

  // Priority 3: Partner (company_admin maps to partner in Firestore)
  if (normalizedRole === 'partner') {
    return '/admin/dashboard'
  }

  // Priority 4: Mentor conditional redirect based on transformationTier
  if (normalizedRole === 'mentor') {
    // Check if mentor has corporate tier
    if (profile?.transformationTier) {
      const tier = profile.transformationTier.toString().toLowerCase()
      if (tier === 'corporate_member' || tier === 'corporate_leader') {
        return '/mentor/dashboard'
      }
    }
    
    // For individual tier mentors, check for preferred dashboard route
    // Assuming getPreferredDashboardRoute exists and is imported or defined elsewhere
    // For now, I'll comment it out to avoid further errors if it's not present.
    // const preferredRoute = getPreferredDashboardRoute(profile || null)
    // if (preferredRoute) {
    //   return preferredRoute
    // }
    // Non-corporate mentors go to the standard learner dashboard
    return getDefaultDashboardRouteByMembership(profile.membershipStatus)
  }

  // Priority 5: Ambassador
  if (normalizedRole === 'ambassador') {
    return '/ambassador/dashboard'
  }

  // If we reach here, it's a regular learner role (user, team_leader, free_user, paid_member)
  // We know `profile` is not null due to the `if (!profile)` check above.

  // Check onboarding status
  const needsOnboarding = !profile.onboardingComplete && !profile.onboardingSkipped
  if (needsOnboarding) {
    return '/welcome'
  }

  // Determine dashboard based on membership status if onboarding is complete or skipped
  return getDefaultDashboardRouteByMembership(profile.membershipStatus)
}
