
import { UserRole } from '@/types';

/**
 * Standardizes a user role from various legacy or UI-specific values.
 *
 * @param role The raw role string from Firestore or UI.
 * @returns The standardized UserRole enum value.
 */
export const normalizeRole = (role: string | undefined | null): UserRole | null => {
  if (!role) return null;

  const roleLower = role.toLowerCase();

  switch (roleLower) {
    // --- Phase 1: Standardize vocabulary ---
    // Firestore stores: super_admin | partner | mentor | ambassador | team_leader | user

    case 'super_admin':
    case 'super-admin':
      return UserRole.SUPER_ADMIN;

    case 'partner':
    case 'company_admin': // Legacy UI value
    case 'company-admin':
    case 'admin':         // Legacy fallback
      return UserRole.COMPANY_ADMIN; // Stays as partner for UI logic

    case 'mentor':
      return UserRole.MENTOR;

    case 'ambassador':
      return UserRole.AMBASSADOR;

    case 'team_leader':
    case 'team-leader':
      return UserRole.TEAM_LEADER;

    // --- Learner / Default ---
    case 'user':
    case 'free_user':      // Legacy UI value
    case 'paid_member':    // Legacy UI value
    case 'learner':
      return UserRole.USER;

    default:
      console.warn(`Unknown role encountered: "${role}". Defaulting to USER.`);
      return UserRole.USER;
  }
}

/**
 * Check if a role is an admin type (partner or super_admin)
 * @param role - Role to check
 * @returns True if role is any admin type
 */
export const isAdminRole = (role: unknown): boolean => {
  const normalized = normalizeRole(role)
  return normalized === 'super_admin' || normalized === 'partner'
}

/**
 * Checks if a role is considered an administrative role.
 * @param role The UserRole to check.
 * @returns True if the role is SUPER_ADMIN or COMPANY_ADMIN.
 */
export const isSuperAdminRole = (role: unknown): boolean => {
  return normalizeRole(role) === 'super_admin'
}

/**
 * Checks if a role is a super admin role.
 * @param role The UserRole to check.
 * @returns True if the role is SUPER_ADMIN.
 */
export const isSuperAdminRole = (role: UserRole | null): boolean => {
  return role === UserRole.SUPER_ADMIN;
};
