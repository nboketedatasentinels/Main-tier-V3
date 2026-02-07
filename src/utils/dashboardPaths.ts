import { toUserRole } from './role'

export const getDashboardPathForRole = (
  role?: string | null,
  membershipStatus?: 'free' | 'paid' | null,
) => {
  const normalizedRole = toUserRole(role)

  switch (normalizedRole) {
    case 'user':
    case 'free_user':
      return membershipStatus === 'paid' ? '/app/dashboard/member' : '/app/dashboard/free'
    case 'paid_member':
      return '/app/dashboard/member'

    case 'mentor':
      return '/mentor/dashboard'

    case 'ambassador':
      return '/ambassador/dashboard'

    case 'partner':
      return '/partner/dashboard'

    case 'super_admin':
      return '/admin/dashboard'

    default:
      return '/app/weekly-glance'
  }
}
