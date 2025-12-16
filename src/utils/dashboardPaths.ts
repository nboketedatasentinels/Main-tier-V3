import { toUserRole } from './role'

export const getDashboardPathForRole = (role?: string | null) => {
  const normalizedRole = toUserRole(role)

  switch (normalizedRole) {
    case 'user':
    case 'free_user':
    case 'paid_member':
      return '/app/dashboard/free'

    case 'mentor':
      return '/mentor/dashboard'

    case 'ambassador':
      return '/ambassador/dashboard'

    case 'partner':
      return '/admin/dashboard'

    case 'super_admin':
      return '/super-admin/dashboard'

    default:
      return '/app/dashboard/free'
  }
}
