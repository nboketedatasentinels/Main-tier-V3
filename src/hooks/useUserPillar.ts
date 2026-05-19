import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { useOrganizationProgramCourses } from './useOrganizationProgramCourses'
import type { Pillar } from '@/types/pillar'

const resolveOrganizationId = (
  profile: { organizationId?: string | null; orgId?: string | null } | null | undefined,
): string | null => {
  if (!profile) return null
  return profile.organizationId ?? profile.orgId ?? null
}

/**
 * Resolves the learner's pillar from their organization. Returns `null` if
 * unknown (no profile, no org, or org has no pillar set).
 */
export function useUserPillar(): { pillar: Pillar | null; loading: boolean } {
  const { profile } = useAuth()
  const organizationId = useMemo(
    () => resolveOrganizationId(profile as { organizationId?: string | null }),
    [profile],
  )
  const { program, loading } = useOrganizationProgramCourses(organizationId)
  return { pillar: program?.pillar ?? null, loading }
}
