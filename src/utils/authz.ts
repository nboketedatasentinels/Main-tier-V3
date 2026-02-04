import type { StandardRole, UserProfile } from '@/types'
import { normalizeRole, resolveRole } from '@/utils/role'

export type EffectiveRoleSource = 'claims' | 'profile' | 'fallback'

export const resolveEffectiveRole = (params: {
  claimsRole?: unknown
  profileRole?: unknown
  fallback?: StandardRole
}): { role: StandardRole; source: EffectiveRoleSource } => {
  const fallback = params.fallback ?? 'user'

  const claimsResolved = resolveRole(params.claimsRole)
  if (claimsResolved) return { role: claimsResolved, source: 'claims' }

  const profileResolved = resolveRole(params.profileRole)
  if (profileResolved) return { role: profileResolved, source: 'profile' }

  return { role: normalizeRole(null, fallback), source: 'fallback' }
}

export const resolveEffectiveOrganization = (
  profile?: Partial<UserProfile> | null,
): { companyId: string | null; companyCode: string | null; organizationId: string | null } => {
  const companyId = (profile?.companyId ?? null) as string | null
  const companyCode = (profile?.companyCode ?? null) as string | null

  const organizationId =
    (profile?.organizationId as string | null | undefined) ??
    companyId ??
    (Array.isArray(profile?.assignedOrganizations) ? profile?.assignedOrganizations?.[0] ?? null : null)

  return {
    companyId: companyId || null,
    companyCode: companyCode || null,
    organizationId: organizationId || null,
  }
}

