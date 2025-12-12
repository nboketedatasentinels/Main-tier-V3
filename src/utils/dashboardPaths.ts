import { UserRole } from '@/types'
import { getSafeRole } from './roles'

export const getDashboardPathForRole = (role?: UserRole | string | null) => {
  const normalizedRole = getSafeRole(role)

  switch (normalizedRole) {
    case UserRole.FREE_USER:
      return '/app/dashboard/free'
    case UserRole.PAID_MEMBER:
      return '/app/dashboard/member'
    case UserRole.MENTOR:
      return '/mentor/dashboard'
    case UserRole.AMBASSADOR:
      return '/app/dashboard/ambassador'
    case UserRole.COMPANY_ADMIN:
      return '/admin/dashboard'
    case UserRole.SUPER_ADMIN:
      return '/admin/dashboard'
    default:
      return '/app/dashboard/free'
  }
}
