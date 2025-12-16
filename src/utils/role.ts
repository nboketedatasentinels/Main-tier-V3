import { UserRole } from '@/types'

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
 * @param role - Any role value from UserRole enum or string
 * @returns Normalized role string matching Firestore vocabulary
 */
export const normalizeRole = (role: unknown): string => {
  console.log('🔶 normalizeRole: Input role:', role, 'type:', typeof role);
  
  if (!role) {
    console.log('🔶 normalizeRole: Role is falsy, returning empty string');
    return ''
  }
  
  // Convert to string and normalize format (lowercase with underscores)
  const normalized = String(role)
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
  
  console.log('🔶 normalizeRole: After normalization:', normalized);
  
  // Map legacy values to Firestore vocabulary
  let result: string;
  switch (normalized) {
    case 'company_admin':
    case 'admin':
    case 'administrator':
      result = 'partner';
      break;
    case 'super_admin':
    case 'superadmin':
      result = 'super_admin';
      break;
    case 'team_leader':
    case 'teamleader':
      result = 'team_leader';
      break;
    case 'mentor':
      result = 'mentor';
      break;
    case 'ambassador':
      result = 'ambassador';
      break;
    case 'partner':
      result = 'partner';
      break;
    case 'user':
      result = 'user';
      break;
    case 'free_user':
      result = 'free_user';
      break;
    case 'paid_member':
      result = 'paid_member';
      break;
    default:
      // Return as-is if no mapping found
      result = normalized;
      break;
  }
  
  console.log('🔶 normalizeRole: Mapped to:', result);
  return result;
}

/**
 * Convert a string role to UserRole enum
 * 
 * Important: UserRole.COMPANY_ADMIN has the enum value "partner" (stored in Firestore).
 * This function maps various input strings to the correct enum, including:
 * - 'partner' → UserRole.COMPANY_ADMIN (value: 'partner')
 * - 'admin' → UserRole.COMPANY_ADMIN (value: 'partner')
 * - 'company_admin' → UserRole.COMPANY_ADMIN (value: 'partner')
 * 
 * When comparing roles, always use normalizeRole() which returns the Firestore value.
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
    // Note: All these variations map to UserRole.COMPANY_ADMIN which has value 'partner'
    // This is correct because Firestore stores it as 'partner'
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
