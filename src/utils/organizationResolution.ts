import type { UserProfile } from '@/types'

export type OrganizationResolutionSource = 'companyId' | 'assignedOrganizations' | 'companyCode' | 'none'

export interface ResolvedOrganizationInfo {
  organizationId: string | null
  organizationCode: string | null
  source: OrganizationResolutionSource
  warnings: string[]
}

export const resolveUserOrganizationId = (profile?: UserProfile | null): ResolvedOrganizationInfo => {
  const warnings: string[] = []
  const companyId = profile?.companyId?.trim() || null
  const assignedOrganizationId =
    profile?.assignedOrganizations?.find((id) => typeof id === 'string' && id.trim().length > 0)?.trim() || null
  const companyCode = profile?.companyCode?.trim()?.toUpperCase() || null

  if (companyId && assignedOrganizationId && companyId !== assignedOrganizationId) {
    warnings.push('Profile companyId does not match assignedOrganizations[0].')
  }

  if (companyId) {
    return { organizationId: companyId, organizationCode: companyCode, source: 'companyId', warnings }
  }

  if (assignedOrganizationId) {
    return { organizationId: assignedOrganizationId, organizationCode: companyCode, source: 'assignedOrganizations', warnings }
  }

  if (companyCode) {
    return { organizationId: null, organizationCode: companyCode, source: 'companyCode', warnings }
  }

  return { organizationId: null, organizationCode: null, source: 'none', warnings }
}
