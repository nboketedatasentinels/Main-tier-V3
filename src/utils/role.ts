import { UserRole } from '@/types'
import type { StandardRole } from '@/types'

export const resolveRole = (role: unknown): StandardRole | null => {
  if (role == null) return null

  const roleString = role
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')

  if (!roleString) return null

  switch (roleString) {
    case 'company_admin':
    case 'admin':
    case 'administrator':
    case 'partner':
      return 'partner'

    case 'super_admin':
    case 'superadmin':
    case 'super':
      return 'super_admin'

    case 'mentor':
      return 'mentor'

    case 'ambassador':
    case 'coach':
      return 'ambassador'

    case 'verifier':
      return 'verifier'

    case 'free_user':
      return 'free_user'

    case 'paid_member':
      return 'paid_member'

    case 'user':
    default:
      return 'user'
  }
}

export const normalizeRole = (role: unknown, fallback: StandardRole = 'user'): StandardRole => {
  return resolveRole(role) ?? fallback
}

/**
 * User-facing role label. Internal role value `ambassador` displays as "Coach".
 */
export const formatRoleLabel = (role: unknown): string => {
  const normalized = normalizeRole(role)
  switch (normalized) {
    case 'super_admin':
      return 'Super Admin'
    case 'partner':
      return 'Partner'
    case 'mentor':
      return 'Mentor'
    case 'ambassador':
      return 'Coach'
    case 'verifier':
      return 'Verifier'
    case 'paid_member':
      return 'Paid Member'
    case 'free_user':
    case 'user':
    default:
      return 'Learner'
  }
}

/** Plural / section titles for roles (Coach, not Coaches). */
export const formatRoleLabelPlural = (role: unknown): string => {
  const singular = formatRoleLabel(role)
  if (singular === 'Coach') return 'Coaches'
  if (singular === 'Learner') return 'Learners'
  if (singular.endsWith('s')) return singular
  return `${singular}s`
}

export const toUserRoleEnum = (role?: string | UserRole | null): UserRole | null => {
  if (!role) return null

  const normalized = normalizeRole(role)

  switch (normalized) {
    case 'super_admin':
      return UserRole.SUPER_ADMIN
    case 'partner':
      return UserRole.PARTNER
    case 'mentor':
      return UserRole.MENTOR
    case 'ambassador':
      return UserRole.AMBASSADOR
    case 'verifier':
      return UserRole.VERIFIER
    case 'paid_member':
      return UserRole.PAID_MEMBER
    case 'free_user':
    case 'user':
      return UserRole.USER
    default:
      return null
  }
}

export const isAdminRole = (role: unknown): boolean => {
  const normalized = normalizeRole(role)
  return normalized === 'super_admin' || normalized === 'partner'
}

export const isSuperAdminRole = (role: unknown): boolean => {
  return normalizeRole(role) === 'super_admin'
}

export const toUserRole = (role?: string | UserRole | null): StandardRole => {
  return normalizeRole(role)
}

/** Staff / leadership roles that must never appear in learner/user lists. */
export const NON_LEARNER_ROLES = new Set<StandardRole>([
  'partner',
  'super_admin',
  'mentor',
  'ambassador',
  'verifier',
])

/**
 * True for learner seats only (user / free_user / paid_member).
 * Partners, mentors, coaches, and super admins are never treated as users.
 */
export const isLearnerRole = (role: unknown): boolean => {
  const normalized = normalizeRole(role)
  return !NON_LEARNER_ROLES.has(normalized)
}

