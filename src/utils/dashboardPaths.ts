import { UserRole } from '@/types'
import { normalizeUserRole } from './roles'

export const getDashboardPathForRole = (role?: UserRole | string | null) => {
  const normalizedRole = normalizeUserRole(role)

  switch (normalizedRole) {
    case UserRole.FREE_USER:
      return '/app/weekly-glance'
    case UserRole.PAID_MEMBER:
      return '/app/weekly-glance'
    case UserRole.MENTOR:
      return '/mentor/dashboard'
    case UserRole.AMBASSADOR:
      return '/app/weekly-glance'
    case UserRole.ADMIN:
      return '/admin/dashboard'
    case UserRole.COMPANY_ADMIN:
      return '/admin/dashboard'
    case UserRole.SUPER_ADMIN:
      return '/super-admin/dashboard'
    default:
      return '/app/weekly-glance'
  }
}
