import { UserRole } from '@/types'

export const normalizeUserRole = (role?: UserRole | string | null): UserRole | null => {
  if (!role) return null

  const normalized = role
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

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
    case 'company_admin':
    case 'admin':
      return UserRole.COMPANY_ADMIN
    case 'super_admin':
    case 'superadmin':
    case 'super':
      return UserRole.SUPER_ADMIN
    default:
      return null
  }
}
