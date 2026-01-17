import { UserRole } from '@/types'
import type { StandardRole } from '@/types'

/**
 * 🔐 Single source of truth for role normalization
 * Always returns Firestore-compatible role strings
 */
export const normalizeRole = (role: unknown): StandardRole => {
  if (!role) {
    return 'paid_member'
  }

  const roleString = role
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

  let result: StandardRole

  switch (roleString) {
    case 'company_admin':
    case 'admin':
    case 'administrator':
    case 'partner':
      result = 'partner'
      break

    case 'super_admin':
    case 'superadmin':
    case 'super':
      result = 'super_admin'
      break

    case 'mentor':
      result = 'mentor'
      break

    case 'ambassador':
      result = 'ambassador'
      break


    case 'free_user':
      result = 'free_user'
      break

    case 'paid_member':
      result = 'paid_member'
      break

    case 'user':
    default:
      result = 'user'
      break
  }

  return result
}

/**
 * 🎯 Convert role string → UserRole enum
 */
export const toUserRoleEnum = (role?: string | UserRole | null): UserRole | null => {
  if (!role) return null

  const normalized = normalizeRole(role)

  switch (normalized) {
    case 'super_admin':
      return UserRole.SUPER_ADMIN
    case 'partner':
      return UserRole.PARTNER
    case 'mentor':
      return UserRole.MENTOR
    case 'ambassador':
      return UserRole.AMBASSADOR
    case 'paid_member':
      return UserRole.PAID_MEMBER
    case 'free_user':
    case 'user':
      return UserRole.USER
    default:
      return null
  }
}

/**
 * 🛂 Admin check
 */
export const isAdminRole = (role: unknown): boolean => {
  const normalized = normalizeRole(role)
  const isAdmin = normalized === 'super_admin' || normalized === 'partner'
  return isAdmin
}

/**
 * 👑 Super Admin check
 */
export const isSuperAdminRole = (role: unknown): boolean => {
  const isSuper = normalizeRole(role) === 'super_admin'
  return isSuper
}
/**
 * ✅ Backwards-compatible export (used by dashboardPaths.ts and others)
 * Returns a normalized Firestore role string.
 */
export const toUserRole = (role?: string | UserRole | null): StandardRole => {
  return normalizeRole(role)
}
