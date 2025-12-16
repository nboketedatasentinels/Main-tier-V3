import { StandardRole, normalizeRole } from '@/utils/role'

export const getDashboardPathForRole = (role?: StandardRole | string | null) => {
  const normalizedRole = normalizeRole(role)

  switch (normalizedRole) {
    case 'user':
      return '/app/dashboard/free' // Assuming 'user' is default for both free and paid members, adjust if specific 'paid' dashboard needed
    case 'mentor':
      return '/mentor/dashboard'
    case 'ambassador':
      return '/app/dashboard/ambassador'
    case 'partner':
      return '/admin/dashboard'
    case 'super_admin':
      return '/super-admin/dashboard'
    default:
      return '/app/dashboard/free'
  }
}
