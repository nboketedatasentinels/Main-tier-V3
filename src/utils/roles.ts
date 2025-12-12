import { UserRole } from '@/types'

export const normalizeUserRole = (
  role?: UserRole | string | null
): UserRole | null => {
  if (!role) return null

  // normalise string (remove hyphens/spaces/extra punctuation, lower-case)
  const normalized = role
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')

  // handle explicit matches first
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
    // company-admin variations
    case 'company_admin':
    case 'companyadmin':
    case 'companyadministrator':
    case 'company-administrator':
    case 'company administrator':
    case 'administrator':
    case 'admin':
    case 'company_admin_role':
    case 'company_admin_user':
    return UserRole.COMPANY_ADMIN
    // super-admin variations
    case 'super_admin':
    case 'super admin':
    case 'superadmin':
    case 'superadministrator':
    case 'super_administrator':
    case 'super-admin':
    case 'super':
      return UserRole.SUPER_ADMIN
    default:
      // fall through to partial matching
      break
  }

  // Fallback: if the string contains both “super” and “admin”/“administrator”
  // treat it as SUPER_ADMIN
  if (
    (normalized.includes('super') || normalized.includes('supreme')) &&
    (normalized.includes('admin') || normalized.includes('administrator'))
  ) {
    return UserRole.SUPER_ADMIN
  }

  // If it contains “admin” or “administrator” by itself, assume company admin
  if (normalized.includes('admin') || normalized.includes('administrator')) {
    return UserRole.COMPANY_ADMIN
  }

  // unknown role → return null
  return null
}

export const isValidUserRole = (role?: UserRole | string | null): role is UserRole => {
  return normalizeUserRole(role) !== null
}

export const isAdminRole = (role?: UserRole | string | null): boolean => {
  const normalizedRole = normalizeUserRole(role)
  return (
    normalizedRole === UserRole.COMPANY_ADMIN || normalizedRole === UserRole.SUPER_ADMIN
  )
}

export const getSafeRole = (role?: UserRole | string | null): UserRole | null => {
  const normalized = normalizeUserRole(role)
  return normalized ?? null
}
