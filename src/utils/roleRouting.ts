import { UserRole, UserProfile } from '@/types'

export const normalizeRole = (role: unknown): string => {
  return String(role ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
}

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
 * 2. Super Admin and Partner (ADMIN, COMPANY_ADMIN) -> /admin
 * 3. Mentor conditional based on transformationTier
 * 4. Ambassador -> /ambassador
 * 5. Regular user with onboarding check
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

  // Priority 2: Super Admin and Partner
  const r = normalizeRole(role)

  if (r === normalizeRole(UserRole.SUPER_ADMIN) || r === 'SUPER_ADMIN') {
    return '/super-admin/dashboard'
  }

  // Treat ADMIN and COMPANY_ADMIN as admin dashboard
  if (
    r === normalizeRole(UserRole.ADMIN) ||
    r === 'ADMIN' ||
    r === normalizeRole(UserRole.COMPANY_ADMIN) ||
    r === 'COMPANY_ADMIN' ||
    r === 'PARTNER' // Treat legacy 'partner' role as admin
  ) {
    return '/admin/dashboard'
  }

  // Priority 3: Mentor conditional redirect based on transformationTier
  if (r === normalizeRole(UserRole.MENTOR) || r === 'MENTOR') {
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

  // Priority 4: Ambassador
  if (r === normalizeRole(UserRole.AMBASSADOR) || r === 'AMBASSADOR') {
    return '/ambassador/dashboard'
  }

  // Priority 5: Regular user (FREE_USER, PAID_MEMBER) with onboarding check
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

  // Fallback based on role only
  if (r === normalizeRole(UserRole.PAID_MEMBER) || r === 'PAID_MEMBER') {
    return '/app/dashboard/member'
  }

  // Default free
  return '/app/dashboard/free'
}
