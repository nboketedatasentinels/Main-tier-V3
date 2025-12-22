import { UserProfile, UserRole } from '@/types'
import { normalizeRole } from './role'

export { normalizeRole } from './role'

/**
 * Extracts preferred dashboard route from the profile (if set).
 * Looks at the most common fields used across the codebase:
 * - profile.dashboardPreferences.defaultRoute
 * - profile.defaultDashboardRoute
 */
export const getPreferredDashboardRoute = (profile?: UserProfile | null): string | null => {
  const fromPrefs =
    typeof profile?.dashboardPreferences?.defaultRoute === 'string'
      ? profile.dashboardPreferences.defaultRoute
      : null

  const fromLegacy =
    typeof profile?.defaultDashboardRoute === 'string'
      ? profile.defaultDashboardRoute
      : null

  const preferred = (fromPrefs || fromLegacy || '').trim()

  console.log('🟩 getPreferredDashboardRoute:', {
    fromPrefs,
    fromLegacy,
    preferred,
  })

  return preferred.length > 0 ? preferred : null
}

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
  profileOrRole?: UserProfile | UserRole | null,
  searchParams?: URLSearchParams
): string => {
  const profile = typeof profileOrRole === 'object' && profileOrRole !== null && 'role' in profileOrRole
    ? (profileOrRole as UserProfile)
    : null
  const role = typeof profileOrRole === 'string' ? profileOrRole : profile?.role
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
          onboardingSkipped: profile.onboardingSkipped,
          transformationTier: profile.transformationTier,
          membershipStatus: profile.membershipStatus,
          dashboardPreferences: profile.dashboardPreferences,
        }
      : null,
  })

  // Priority 1: External redirect override
  if (redirectUrl) {
    console.log('🔷 Redirect override detected:', redirectUrl)
    return redirectUrl
  }

  const normalizedRole = normalizeRole(role) ?? (profile?.mentorId ? 'mentor' : null)
  console.log('🔷 Normalized role:', normalizedRole, 'mentorIdHint:', profile?.mentorId)

  // Priority 2: Super Admin
  if (normalizedRole === 'super_admin') {
    console.log('🔷 Super admin detected → /super-admin/dashboard')
    return '/super-admin/dashboard'
  }

  // Priority 3: Partner/Admin (company admin)
  if (normalizedRole === 'partner') {
    console.log('🔷 Partner detected → /admin/dashboard')
    return '/admin/dashboard'
  }

  // Priority 4: Mentor (conditional corporate)
  if (normalizedRole === 'mentor') {
    console.log('🔷 Mentor detected')

    const tier = profile?.transformationTier?.toString().toLowerCase()
    console.log('🔷 Mentor tier:', tier)

    if (tier === 'corporate_member' || tier === 'corporate_leader') {
      console.log('🔷 Corporate mentor → /mentor/dashboard')
      return '/mentor/dashboard'
    }

    const preferred = getPreferredDashboardRoute(profile)
    if (preferred) {
      console.log('🔷 Individual mentor preferred route:', preferred)
      return preferred
    }

    console.log('🔷 Mentor default → /mentor/dashboard')
    return '/mentor/dashboard'
  }

  // Priority 5: Ambassador
  if (normalizedRole === 'ambassador') {
    console.log('🔷 Ambassador detected → /ambassador/dashboard')
    return '/ambassador/dashboard'
  }

  // Priority 6: Learners (user / team_leader / free_user / paid_member)
  if (profile) {
    const needsOnboarding =
      !profile.onboardingComplete && !profile.onboardingSkipped

    console.log('🔷 Learner onboarding check:', {
      onboardingComplete: profile.onboardingComplete,
      onboardingSkipped: profile.onboardingSkipped,
      needsOnboarding,
    })

    if (needsOnboarding) {
      console.log('🔷 Needs onboarding → /welcome')
      return '/welcome'
    }

    const preferred = getPreferredDashboardRoute(profile)
    if (preferred) {
      console.log('🔷 Learner preferred route:', preferred)
      return preferred
    }

    const membershipStatus = profile.membershipStatus

    const fallback = getDefaultDashboardRouteByMembership(membershipStatus)
    console.log('🔷 Learner fallback route:', fallback)
    return fallback
  }

  if (profile) {
    const fallback = getPreferredDashboardRoute(profile) || getDefaultDashboardRouteByMembership(profile.membershipStatus)
    console.warn('🔷 Role missing or null, using fallback route', fallback)
    return fallback
  }

  console.log('🔷 Absolute fallback → /app/dashboard/free')
  return '/app/dashboard/free'
}
