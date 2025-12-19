import { UserRole } from '@/types'

export const normalizeRole = (role: unknown): string => {
  return String(role ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
}

export const getLandingPathForRole = (role: unknown) => {
  const r = normalizeRole(role)

  if (r === normalizeRole(UserRole.SUPER_ADMIN) || r === 'SUPER_ADMIN') {
    return '/super-admin/dashboard'
  }

  // Treat ADMIN and COMPANY_ADMIN as admin dashboard
  if (
    r === normalizeRole(UserRole.ADMIN) ||
    r === 'ADMIN' ||
    r === normalizeRole(UserRole.COMPANY_ADMIN) ||
    r === 'COMPANY_ADMIN'
  ) {
    return '/admin/dashboard'
  }

  if (r === normalizeRole(UserRole.MENTOR) || r === 'MENTOR') {
    return '/mentor/dashboard'
  }

  if (r === normalizeRole(UserRole.AMBASSADOR) || r === 'AMBASSADOR') {
    return '/app/weekly-glance'
  }

  if (r === normalizeRole(UserRole.PAID_MEMBER) || r === 'PAID_MEMBER') {
    return '/app/weekly-glance'
  }

  // Default free
  return '/app/weekly-glance'
}
