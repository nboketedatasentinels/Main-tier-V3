import { UserProfile } from '@/types'
import { normalizeRole } from './role'

/**
 * Lightweight permission helpers for admin and organization-aware checks.
 * These helpers keep role casing consistent across the app and centralize
 * the logic for partner/super-admin fallbacks.
 */

export const isSuperAdmin = (profile?: UserProfile | null) => normalizeRole(profile?.role) === 'super_admin'

export const isPartnerAdmin = (profile?: UserProfile | null) => {
  const role = normalizeRole(profile?.role)
  return role === 'partner' || role === 'admin'
}

export const isAdminLike = (profile?: UserProfile | null) => isSuperAdmin(profile) || isPartnerAdmin(profile)

export const isAssignedPartner = (profile: UserProfile | null | undefined, organizationCode?: string) => {
  if (!profile || !organizationCode) return false
  if (isSuperAdmin(profile)) return true
  return profile.assignedOrganizations?.includes(organizationCode) ?? false
}

export const canManageOrganization = (profile: UserProfile | null | undefined, organizationCode?: string) => {
  if (!profile) return false
  if (isSuperAdmin(profile)) return true
  return isAssignedPartner(profile, organizationCode)
}

export const guardByRole = (profile: UserProfile | null | undefined, allowedRoles: string[]) => {
  if (!profile) return false
  const normalized = normalizeRole(profile.role)
  return allowedRoles.map(normalizeRole).includes(normalized)
}

export const getRoleLabel = (profile: UserProfile | null | undefined) => {
  if (!profile) return 'guest'
  const normalized = normalizeRole(profile.role)
  switch (normalized) {
    case 'super_admin':
      return 'Super Admin'
    case 'admin':
      return 'Admin'
    case 'partner':
      return 'Partner Admin'
    case 'mentor':
      return 'Mentor'
    case 'ambassador':
      return 'Ambassador'
    default:
      return 'Member'
  }
}
