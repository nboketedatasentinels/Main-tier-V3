import { UserRole } from '@/types'

/**
 * Single source of truth for role normalization
 * Converts any role variation to a standardized string format for comparison
 * 
 * This function normalizes role strings by:
 * - Converting to uppercase
 * - Replacing spaces and hyphens with underscores
 * - Handling common variations and legacy values
 * 
 * @param role - Any role value from UserRole enum or string
 * @returns Normalized role string in uppercase with underscores
 */
export const normalizeRole = (role: unknown): string => {
  if (!role) return ''
  
  // Convert to string and normalize format
  return String(role)
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, '_')
}

/**
 * Convert a string role to UserRole enum
 * Handles common variations and legacy mappings:
 * - company_admin variations → COMPANY_ADMIN
 * - admin variations → ADMIN
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
    // Company-admin variations
    case 'company_admin':
    case 'companyadmin':
    case 'companyadministrator':
    case 'company-administrator':
      return UserRole.COMPANY_ADMIN
    case 'admin':
    case 'administrator':
      return UserRole.ADMIN
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
 * Check if a role is an admin type (ADMIN, COMPANY_ADMIN, or SUPER_ADMIN)
 * @param role - Role to check
 * @returns True if role is any admin type
 */
export const isAdminRole = (role: unknown): boolean => {
  const normalized = normalizeRole(role)
  return (
    normalized === 'SUPER_ADMIN' ||
    normalized === 'ADMIN' ||
    normalized === 'COMPANY_ADMIN'
  )
}

/**
 * Check if a role is super admin
 * @param role - Role to check
 * @returns True if role is super admin
 */
export const isSuperAdminRole = (role: unknown): boolean => {
  return normalizeRole(role) === 'SUPER_ADMIN'
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
