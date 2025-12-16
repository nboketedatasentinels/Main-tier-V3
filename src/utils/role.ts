import type { StandardRole, AllRoles } from '@/types/roles'

/**
 * Single source of truth for role normalization
 * Maps all role variations to standardized Firestore vocabulary:
 * - super_admin | partner | mentor | ambassador | team_leader | user | free_user | paid_member
 *
 * Legacy mappings:
 * - company_admin → partner (UserRole.COMPANY_ADMIN enum has value 'partner')
 * - admin → partner (maps to same enum as company_admin)
 *
 * Important: UserRole enums vs Firestore values
 * - UserRole.COMPANY_ADMIN has enum value 'partner' (this is what's stored in Firestore)
 * - normalizeRole('admin') returns 'partner' (the Firestore value)
 * - normalizeRole(UserRole.COMPANY_ADMIN) returns 'partner' (the enum's value)
 *
 * Note: free_user and paid_member are kept distinct for UI purposes,
 * though they could be consolidated to "user" with membershipStatus in the future.
 *
 * @param role - Any role value from AllRoles enum or string
 * @returns Normalized role string matching Firestore vocabulary
 */
export function normalizeRole(role: AllRoles | string | null | undefined | unknown): StandardRole {
  if (!role) return 'user'; // Default role for null/undefined or non-string inputs

  // Ensure role is a string for further processing
  const roleString = String(role);
  
  // Convert to string and normalize format (lowercase with underscores)
  const normalized = roleString
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
  
  // Map legacy values to Firestore vocabulary
  switch (normalized) {
    case 'company_admin':
    case 'admin':
    case 'administrator':
      return 'partner';
    case 'super_admin':
    case 'superadmin':
      return 'super_admin';
    case 'team_leader':
    case 'teamleader':
      return 'team_leader';
    case 'mentor':
      return 'mentor';
    case 'ambassador':
      return 'ambassador';
    case 'partner':
      return 'partner';
    case 'user':
      return 'user';
    case 'free_user':
      return 'free_user';
    case 'paid_member':
      return 'paid_member';
    default:
      // Return 'user' as default if no mapping found, to satisfy StandardRole return type
      console.warn(`Unknown role encountered: ${roleString}. Defaulting to 'user'.`);
      return 'user';
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
 * Converts any role input to a normalized UserRole or StandardRole value.
 * This is an alias for normalizeRole() for backward compatibility.
 * @param role - Any role value from AllRoles enum or string
 * @returns Normalized role string matching Firestore vocabulary
 */
export const toUserRole = normalizeRole
