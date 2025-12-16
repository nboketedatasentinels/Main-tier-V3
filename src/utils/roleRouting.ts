import { UserRole, UserProfile } from '@/types'
import { normalizeRole } from './role'

// Re-export for convenience
export { normalizeRole }

/**
 * Get the preferred dashboard route from user profile
 */
export const getPreferredDashboardRoute = (profile: UserProfile | null): string | null => {
  if (!profile) return null
  
  // Check dashboard preferences first
  if (profile.dashboardPreferences?.defaultRoute) {
    return profile.dashboardPreferences.defaultRoute
  }
  
  // Check direct defaultDashboardRoute field
  if (profile.defaultDashboardRoute) {
    return profile.defaultDashboardRoute
  }
  
  return null
}

/**
 * Get default dashboard route based on membership tier
 */
export const getDefaultDashboardRouteByMembership = (profile: UserProfile | null): string => {
  if (!profile) return '/app/weekly-glance'
  
  const role = profile.role
  const tier = profile.transformationTier
  
  // Corporate members may have custom defaults
  if (tier && tier.toString().toLowerCase().includes('corporate')) {
    return '/app/dashboard/company'
  }
  
  // Paid members get full access
  if (role === UserRole.PAID_MEMBER) {
    return '/app/weekly-glance'
  }
  
  // Free users default to weekly glance
  return '/app/weekly-glance'
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
  role: unknown,
  profile?: UserProfile | null,
  redirectUrl?: string | null
): string => {
  // Priority 1: Check for redirectUrl query parameter
  if (redirectUrl) {
    return redirectUrl
  }

  // Priority 2: Super Admin
  const normalizedRole = normalizeRole(role)

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
    const preferredRoute = getPreferredDashboardRoute(profile || null)
    if (preferredRoute) {
      return preferredRoute
    }
    
    // Default to mentor dashboard
    return '/mentor/dashboard'
  }

  // Priority 5: Ambassador
  if (normalizedRole === 'ambassador') {
    return '/ambassador/dashboard'
  }

  // Priority 6: Regular learners (user, team_leader, free_user, paid_member) with onboarding check
  // Note: These roles don't have explicit switch cases above and fall through to here
  if (profile) {
    // Check onboarding status
    const needsOnboarding = !profile.onboardingComplete && !profile.onboardingSkipped
    if (needsOnboarding) {
      return '/welcome'
    }
    
    // Check for preferred dashboard route
    const preferredRoute = getPreferredDashboardRoute(profile)
    if (preferredRoute) {
      return preferredRoute
    }
    
    // Use default based on membership
    return getDefaultDashboardRouteByMembership(profile)
  }

  // Fallback based on role only (when no profile is available)
  if (normalizedRole === 'paid_member') {
    return '/app/dashboard/member'
  }

  // Default free user
  return '/app/dashboard/free'
}
