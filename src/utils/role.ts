import { UserRole } from '@/types'
import type { StandardRole } from '@/types'

export const resolveRole = (role: unknown): StandardRole | null => {
  if (role == null) return null

  const roleString = role
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

  if (!roleString) return null

  switch (roleString) {
    case 'company_admin':
    case 'admin':
    case 'administrator':
    case 'partner':
      return 'partner'

    case 'super_admin':
    case 'superadmin':
    case 'super':
      return 'super_admin'

    case 'mentor':
      return 'mentor'

    case 'ambassador':
      return 'ambassador'

    case 'free_user':
      return 'free_user'

    case 'paid_member':
      return 'paid_member'

    case 'user':
    default:
      return 'user'
  }
}

export const normalizeRole = (role: unknown, fallback: StandardRole = 'user'): StandardRole => {
  return resolveRole(role) ?? fallback
}

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

export const isAdminRole = (role: unknown): boolean => {
  const normalized = normalizeRole(role)
  return normalized === 'super_admin' || normalized === 'partner'
}

export const isSuperAdminRole = (role: unknown): boolean => {
  return normalizeRole(role) === 'super_admin'
}

export const toUserRole = (role?: string | UserRole | null): StandardRole => {
  return normalizeRole(role)
}

