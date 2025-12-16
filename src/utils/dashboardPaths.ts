import { UserRole } from '@/types'
import { toUserRole } from './role'

export const getDashboardPathForRole = (role?: UserRole | string | null) => {
  const normalizedRole = toUserRole(role)

  switch (normalizedRole) {
    case 'user':
      return '/app/dashboard/free' // Assuming 'user' is default for both free and paid members, adjust if specific 'paid' dashboard needed
    case 'mentor':
      return '/mentor/dashboard'
    case UserRole.AMBASSADOR:
      return '/ambassador/dashboard'
    case UserRole.COMPANY_ADMIN:
      return '/admin/dashboard'
    case 'super_admin':
      return '/super-admin/dashboard'
    default:
      return '/app/dashboard/free'
  }
}
