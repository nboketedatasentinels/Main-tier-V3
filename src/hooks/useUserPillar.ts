import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { useOrganizationProgramCourses } from './useOrganizationProgramCourses'
import { isFreeUser } from '@/utils/membership'
import type { Pillar } from '@/types/pillar'

/** Free practitioners (no org) run the Digital Transformation Starter Kit gateway. */
export const PRACTITIONER_DEFAULT_PILLAR: Pillar = 'starter_kit'

const resolveOrganizationId = (
  profile: { organizationId?: string | null; orgId?: string | null } | null | undefined,
): string | null => {
  if (!profile) return null
  return profile.organizationId ?? profile.orgId ?? null
}

/**
 * Resolves the learner's pillar.
 * - Org members: organization programme pillar
 * - Free practitioners (no org): starter_kit (Transformation Practitioner gateway)
 * - Otherwise: null
 */
export function useUserPillar(): { pillar: Pillar | null; loading: boolean } {
  const { profile } = useAuth()
  const organizationId = useMemo(
    () => resolveOrganizationId(profile as { organizationId?: string | null }),
    [profile],
  )
  const { program, loading } = useOrganizationProgramCourses(organizationId)

  const pillar = useMemo((): Pillar | null => {
    if (program?.pillar) return program.pillar
    // Practitioners = free users without an organization. Their first programme
    // is the Digital Transformation Starter Kit (Capstone Part A = One-Page Proposal).
    if (isFreeUser(profile) && !organizationId) {
      return PRACTITIONER_DEFAULT_PILLAR
    }
    return null
  }, [program?.pillar, profile, organizationId])

  return { pillar, loading: Boolean(organizationId) && loading }
}
