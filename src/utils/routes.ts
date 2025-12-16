
import { UserProfile } from '@/types';
import { StandardRole, normalizeRole } from '@/utils/role';

/**
 * Get the preferred dashboard route from user profile
 */
export const getPreferredDashboardRoute = (profile: UserProfile | null): string | null => {
  if (!profile) return null;

  // Check dashboard preferences first
  if (profile.dashboardPreferences?.defaultRoute) {
    return profile.dashboardPreferences.defaultRoute;
  }

  // Check direct defaultDashboardRoute field
  if (profile.defaultDashboardRoute) {
    return profile.defaultDashboardRoute;
  }

  return null;
};

/**
 * Get default dashboard route based on membership tier
 */
export const getDefaultDashboardRouteByMembership = (profile: UserProfile | null): string => {
  if (!profile) return '/app/weekly-glance';

  const normalizedRole = normalizeRole(profile.role);
  const membershipStatus = profile.membershipStatus;

  // Corporate members may have custom defaults
  if (profile.transformationTier && profile.transformationTier.toString().toLowerCase().includes('corporate')) {
    return '/app/dashboard/company';
  }

  // Paid users get full access
  if (normalizedRole === 'user' && membershipStatus === 'paid') {
    return '/app/weekly-glance';
  }

  // Default free
  return '/app/weekly-glance';
};

/**
 * Comprehensive role-based landing path with priority logic
 * Priority:
 * 1. redirectUrl query parameter (external/payment flows)
 * 2. Role-based redirection (Super Admin, Admin, Mentor, Ambassador)
 * 3. Regular user with onboarding check
 */
export const getLandingPathForRole = (
  role: StandardRole,
  profile?: UserProfile | null,
  redirectUrl?: string | null
): string => {
  // Priority 1: Check for redirectUrl query parameter
  if (redirectUrl) {
    return redirectUrl;
  }

  const normalizedRole = normalizeRole(role);

  // Priority 2: Role-based redirection
  switch (normalizedRole) {
    case 'super_admin':
      return '/super-admin/dashboard';
    case 'partner':
      return '/admin/dashboard';
    case 'mentor':
      // Mentor conditional redirect based on transformationTier
      if (profile?.transformationTier) {
        const tier = profile.transformationTier.toString().toLowerCase();
        if (tier === 'corporate_member' || tier === 'corporate_leader') {
          return '/mentor/dashboard';
        }
      }
      // For individual tier mentors, check for preferred dashboard route
      const preferredRoute = getPreferredDashboardRoute(profile || null);
      if (preferredRoute) {
        return preferredRoute;
      }
      return '/mentor/dashboard';
    case 'ambassador':
      return '/ambassador/dashboard';
    default:
      // Continue to Priority 3 for other roles
      break;
  }

  // Priority 3: Regular user (FREE_USER, PAID_MEMBER) with onboarding check
  if (profile) {
    // Check onboarding status
    const needsOnboarding = !profile.onboardingComplete && !profile.onboardingSkipped;
    if (needsOnboarding) {
      return '/welcome';
    }

    // Check for preferred dashboard route
    const preferredRoute = getPreferredDashboardRoute(profile);
    if (preferredRoute) {
      return preferredRoute;
    }

    // Use default based on membership
    return getDefaultDashboardRouteByMembership(profile);
  }

  // Fallback based on role only
  if (normalizedRole === 'user' && profile?.membershipStatus === 'paid') {
    return '/app/dashboard/member';
  }

  // Default free
  return '/app/dashboard/free';
};
