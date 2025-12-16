import { UserRole } from '@/types'

/**
 * Single source of truth for role normalization
 * Maps all role variations to standardized Firestore vocabulary:
 * - super_admin | partner | mentor | ambassador | team_leader | user | free_user | paid_member
 * 
 * Legacy mappings:
 * - company_admin → partner
 * - admin → partner
 * 
 * Note: free_user and paid_member are kept distinct for UI purposes,
 * though they could be consolidated to "user" with membershipStatus in the future.
 * 
 * @param role - Any role value from UserRole enum or string
 * @returns Normalized role string matching Firestore vocabulary
 */
export const normalizeRole = (role: unknown): string => {
  if (!role) return ''
  
  // Convert to string and normalize format (lowercase with underscores)
  const normalized = String(role)
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
  
  // Map legacy values to Firestore vocabulary
  switch (normalized) {
    case 'company_admin':
    case 'admin':
    case 'administrator':
      return 'partner'
    case 'super_admin':
    case 'superadmin':
      return 'super_admin'
    case 'team_leader':
    case 'teamleader':
      return 'team_leader'
    case 'mentor':
      return 'mentor'
    case 'ambassador':
      return 'ambassador'
    case 'partner':
      return 'partner'
    case 'user':
      return 'user'
    case 'free_user':
      return 'free_user'
    case 'paid_member':
      return 'paid_member'
    default:
      // Return as-is if no mapping found
      return normalized
  }
}

/**
 * Convert a string role to UserRole enum
 * Handles common variations and legacy mappings:
 * - company_admin/admin variations → COMPANY_ADMIN (which maps to "partner" in Firestore)
 * - super_admin variations → SUPER_ADMIN
 * - free/free_user → FREE_USER
 * - member/paid_member → PAID_MEMBER
 * 
 * @param role - Role string to convert
 * @returns Corresponding UserRole enum value or null if not recognized
 */
export const toUserRole = (role?: UserRole | string | null): UserRole | null => {
  if (!role) return null

  // Normalize string (remove hyphens/spaces, lowercase)
  const normalized = role
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

  // Handle explicit matches first
  switch (normalized) {
    case 'free_user':
    case 'free':
      return UserRole.FREE_USER
    case 'paid_member':
    case 'member':
      return UserRole.PAID_MEMBER
    case 'mentor':
      return UserRole.MENTOR
    case 'ambassador':
      return UserRole.AMBASSADOR
    case 'user':
      return UserRole.USER
    case 'team_leader':
    case 'teamleader':
      return UserRole.TEAM_LEADER
    // Company-admin/partner variations
    case 'company_admin':
    case 'companyadmin':
    case 'companyadministrator':
    case 'company-administrator':
    case 'admin':
    case 'administrator':
    case 'partner':
      return UserRole.COMPANY_ADMIN
    // Super-admin variations
    case 'super_admin':
    case 'superadmin':
    case 'superadministrator':
    case 'super_administrator':
    case 'super-admin':
    case 'super':
      return UserRole.SUPER_ADMIN
    default:
      return null
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
 * Check if a role is super admin
 * @param role - Role to check
 * @returns True if role is super admin
 */
export const isSuperAdminRole = (role: unknown): boolean => {
  return normalizeRole(role) === 'super_admin'
}

/**
 * Check if two roles are equivalent (after normalization)
 * @param role1 - First role
 * @param role2 - Second role
 * @returns True if roles are equivalent
 */
export const rolesMatch = (role1: unknown, role2: unknown): boolean => {
  return normalizeRole(role1) === normalizeRole(role2)
}
