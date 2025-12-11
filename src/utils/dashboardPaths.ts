import { UserRole } from '@/types'

export const getDashboardPathForRole = (role?: UserRole | null) => {
  switch (role) {
    case UserRole.FREE_USER:
      return '/app/dashboard/free'
    case UserRole.PAID_MEMBER:
      return '/app/dashboard/member'
    case UserRole.MENTOR:
      return '/mentor/dashboard'
    case UserRole.AMBASSADOR:
      return '/app/dashboard/ambassador'
    case UserRole.COMPANY_ADMIN:
      return '/app/dashboard/company-admin'
    case UserRole.SUPER_ADMIN:
      return '/app/dashboard/super-admin'
    default:
      return '/app/dashboard/free'
  }
}
