import { UserRole } from '@/types'

/**
 * 🔐 Single source of truth for role normalization
 * Always returns Firestore-compatible role strings
 */
export const normalizeRole = (role: unknown): string => {
  console.log('🔶 normalizeRole: input →', role, 'type:', typeof role)

  if (!role) {
    console.warn('🔶 normalizeRole: empty role received')
    return 'user'
  }

  const roleString = role
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

  console.log('🔶 normalizeRole: normalized string →', roleString)

  let result: string

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

    case 'team_leader':
    case 'teamleader':
      result = 'team_leader'
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

  console.log('🔶 normalizeRole: result →', result)
  return result
}

/**
 * 🎯 Convert role string → UserRole enum
 * NOTE: COMPANY_ADMIN enum value === 'partner'
 */
export const toUserRoleEnum = (role?: string | UserRole | null): UserRole | null => {
  if (!role) return null

  const normalized = normalizeRole(role)

  switch (normalized) {
    case 'super_admin':
      return UserRole.SUPER_ADMIN
    case 'partner':
      return UserRole.COMPANY_ADMIN
    case 'mentor':
      return UserRole.MENTOR
    case 'ambassador':
      return UserRole.AMBASSADOR
    case 'team_leader':
      return UserRole.TEAM_LEADER
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
  console.log('🛂 isAdminRole:', role, '→', isAdmin)
  return isAdmin
}

/**
 * 👑 Super Admin check
 */
export const isSuperAdminRole = (role: unknown): boolean => {
  const isSuper = normalizeRole(role) === 'super_admin'
  console.log('👑 isSuperAdminRole:', role, '→', isSuper)
  return isSuper
}
