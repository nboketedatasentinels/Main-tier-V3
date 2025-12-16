import { UserProfile } from '@/types'
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
  console.log('🔷 getLandingPathForRole called with:', {
    role,
    roleType: typeof role,
    profile: profile ? {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      onboardingComplete: profile.onboardingComplete,
      transformationTier: profile.transformationTier,
      dashboardPreferences: profile.dashboardPreferences
    } : null,
    redirectUrl
  });
  
  // Priority 1: Check for redirectUrl query parameter
  if (redirectUrl) {
    console.log('🔷 getLandingPathForRole: Using redirectUrl:', redirectUrl);
    return redirectUrl
  }

  // Priority 2: Super Admin
  const normalizedRole = normalizeRole(role)
  console.log('🔷 getLandingPathForRole: Normalized role:', normalizedRole);

  if (normalizedRole === 'super_admin') {
    console.log('🔷 getLandingPathForRole: Matched super_admin, returning /super-admin/dashboard');
    return '/super-admin/dashboard'
  }

  // Priority 3: Partner (company_admin maps to partner in Firestore)
  if (normalizedRole === 'partner') {
    console.log('🔷 getLandingPathForRole: Matched partner, returning /admin/dashboard');
    return '/admin/dashboard'
  }

  // Priority 4: Mentor conditional redirect based on transformationTier
  if (normalizedRole === 'mentor') {
    console.log('🔷 getLandingPathForRole: Matched mentor');
    // Check if mentor has corporate tier
    if (profile?.transformationTier) {
      const tier = profile.transformationTier.toString().toLowerCase()
      console.log('🔷 getLandingPathForRole: Mentor has transformationTier:', tier);
      if (tier === 'corporate_member' || tier === 'corporate_leader') {
        console.log('🔷 getLandingPathForRole: Corporate mentor, returning /mentor/dashboard');
        return '/mentor/dashboard'
      }
    }
    
    // For individual tier mentors, check for preferred dashboard route
    const preferredRoute = getPreferredDashboardRoute(profile || null)
    if (preferredRoute) {
      console.log('🔷 getLandingPathForRole: Mentor has preferred route:', preferredRoute);
      return preferredRoute
    }
    
    // Default to mentor dashboard
    console.log('🔷 getLandingPathForRole: Default mentor, returning /mentor/dashboard');
    return '/mentor/dashboard'
  }

  // Priority 5: Ambassador
  if (normalizedRole === 'ambassador') {
    console.log('🔷 getLandingPathForRole: Matched ambassador, returning /ambassador/dashboard');
    return '/ambassador/dashboard'
  }

  // Priority 6: Regular learners (user, team_leader, free_user, paid_member) with onboarding check
  // Note: These roles don't have explicit switch cases above and fall through to here
  if (profile) {
    console.log('🔷 getLandingPathForRole: Processing regular user with profile');
    // Check onboarding status
    const needsOnboarding = !profile.onboardingComplete && !profile.onboardingSkipped
    console.log('🔷 getLandingPathForRole: Onboarding check', {
      onboardingComplete: profile.onboardingComplete,
      onboardingSkipped: profile.onboardingSkipped,
      needsOnboarding
    });
    
    if (needsOnboarding) {
      console.log('🔷 getLandingPathForRole: Needs onboarding, returning /welcome');
      return '/welcome'
    }
    
    // Check for preferred dashboard route
    const preferredRoute = getPreferredDashboardRoute(profile)
    if (preferredRoute) {
      console.log('🔷 getLandingPathForRole: Has preferred route:', preferredRoute);
      return preferredRoute
    }
    
    // Use default based on membership
    const defaultRoute = getDefaultDashboardRouteByMembership(profile)
    console.log('🔷 getLandingPathForRole: Using default route by membership:', defaultRoute);
    return defaultRoute
  }

  console.log('🔷 getLandingPathForRole: No profile, checking role-based fallback');
  // Fallback based on role only (when no profile is available)
  if (normalizedRole === 'paid_member') {
    console.log('🔷 getLandingPathForRole: Paid member fallback, returning /app/dashboard/member');
    return '/app/dashboard/member'
  }

  // Default free user
  console.log('🔷 getLandingPathForRole: Default fallback, returning /app/dashboard/free');
  return '/app/dashboard/free'
}
