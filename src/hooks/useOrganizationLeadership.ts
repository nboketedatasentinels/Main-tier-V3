import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/services/supabase'
import type { UserProfileExtended } from '@/services/userProfileService'

export interface LeadershipAssignments {
  mentorId: string | null
  ambassadorId: string | null
  partnerId: string | null
}

export type LeadershipAssignmentSource = 'user' | 'organization' | 'profile' | null

export interface LeadershipAssignmentSources {
  mentor: LeadershipAssignmentSource
  ambassador: LeadershipAssignmentSource
  partner: LeadershipAssignmentSource
}

export interface LeadershipProfiles {
  mentor: UserProfileExtended | null
  ambassador: UserProfileExtended | null
  partner: UserProfileExtended | null
}

export interface SupportAssignments {
  mentorId: string | null
  ambassadorId: string | null
}

export interface LeadershipErrors {
  organization?: string
  supportAssignments?: string
  mentor?: string
  ambassador?: string
  partner?: string
}

export interface OrganizationStatus {
  id: string | null
  exists: boolean
  loaded: boolean
}

export interface SupportAssignmentStatus {
  id: string | null
  exists: boolean
  loaded: boolean
}

const emptyAssignments: LeadershipAssignments = {
  mentorId: null,
  ambassadorId: null,
  partnerId: null,
}

const emptyProfiles: LeadershipProfiles = {
  mentor: null,
  ambassador: null,
  partner: null,
}

const emptySources: LeadershipAssignmentSources = {
  mentor: null,
  ambassador: null,
  partner: null,
}

export interface ProfileAssignments {
  mentorId?: string | null
  ambassadorId?: string | null
}

type LeadershipRpcResult = {
  organization?: { id?: string | null; code?: string | null; name?: string | null; exists?: boolean } | null
  assignments?: {
    partnerId?: string | null
    mentorId?: string | null
    ambassadorId?: string | null
  }
  assignmentSources?: {
    partner?: LeadershipAssignmentSource
    mentor?: LeadershipAssignmentSource
    ambassador?: LeadershipAssignmentSource
  }
  profiles?: {
    partner?: Record<string, unknown> | null
    mentor?: Record<string, unknown> | null
    ambassador?: Record<string, unknown> | null
  }
  error?: string
}

const toExtendedProfile = (raw: Record<string, unknown> | null | undefined): UserProfileExtended | null => {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' ? raw.id : null
  if (!id) return null
  const firstName = typeof raw.firstName === 'string' ? raw.firstName : ''
  const lastName = typeof raw.lastName === 'string' ? raw.lastName : ''
  const fullName =
    (typeof raw.fullName === 'string' && raw.fullName.trim()) ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    (typeof raw.email === 'string' ? raw.email : '') ||
    'Team member'

  return {
    id,
    email: typeof raw.email === 'string' ? raw.email : '',
    firstName,
    lastName,
    fullName,
    role: (typeof raw.role === 'string' ? raw.role : 'user') as UserProfileExtended['role'],
    companyId: typeof raw.companyId === 'string' ? raw.companyId : null,
    companyCode: typeof raw.companyCode === 'string' ? raw.companyCode : null,
    companyName: typeof raw.companyName === 'string' ? raw.companyName : null,
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
    ...(typeof raw.bio === 'string' ? { bio: raw.bio } : {}),
    ...(typeof raw.officeLocation === 'string' ? { officeLocation: raw.officeLocation } : {}),
    ...(typeof raw.timezone === 'string' ? { timezone: raw.timezone } : {}),
    ...(typeof raw.availabilityStatus === 'string' ? { availabilityStatus: raw.availabilityStatus } : {}),
  } as UserProfileExtended
}

/**
 * Loads the learner's Transformation Partner / Mentor / Coach from Supabase.
 * Replaces the old Firestore organization + support_assignments listeners that
 * fail after the Supabase auth cutover ("Failed to load organization leadership").
 */
export const useOrganizationLeadership = (
  companyId?: string | null,
  userId?: string | null,
  _profile?: ProfileAssignments | null,
) => {
  const [assignments, setAssignments] = useState<LeadershipAssignments>(emptyAssignments)
  const [assignmentSources, setAssignmentSources] = useState<LeadershipAssignmentSources>(emptySources)
  const [profiles, setProfiles] = useState<LeadershipProfiles>(emptyProfiles)
  const [errors, setErrors] = useState<LeadershipErrors>({})
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [organizationExists, setOrganizationExists] = useState(false)
  const [organizationLoaded, setOrganizationLoaded] = useState(false)
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(companyId ?? null)

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!userId) {
      setAssignments(emptyAssignments)
      setAssignmentSources(emptySources)
      setProfiles(emptyProfiles)
      setErrors({})
      setLoading(false)
      setOrganizationExists(false)
      setOrganizationLoaded(false)
      setResolvedOrgId(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setErrors({})

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('get_my_organization_leadership')
        if (error) throw new Error(error.message)
        if (cancelled) return

        const payload = (data ?? {}) as LeadershipRpcResult
        const org = payload.organization
        const orgExists = Boolean(org?.exists || org?.id)
        setOrganizationExists(orgExists)
        setOrganizationLoaded(true)
        setResolvedOrgId(org?.id ?? companyId ?? null)

        if (payload.error === 'organization_not_found' || (!orgExists && companyId)) {
          setErrors((prev) => ({
            ...prev,
            organization: 'Organization not found.',
          }))
        }

        const nextAssignments: LeadershipAssignments = {
          partnerId: payload.assignments?.partnerId ?? null,
          mentorId: payload.assignments?.mentorId ?? null,
          ambassadorId: payload.assignments?.ambassadorId ?? null,
        }
        setAssignments(nextAssignments)
        setAssignmentSources({
          partner: payload.assignmentSources?.partner ?? (nextAssignments.partnerId ? 'organization' : null),
          mentor: payload.assignmentSources?.mentor ?? null,
          ambassador: payload.assignmentSources?.ambassador ?? null,
        })

        const partner = toExtendedProfile(payload.profiles?.partner ?? null)
        const mentor = toExtendedProfile(payload.profiles?.mentor ?? null)
        const ambassador = toExtendedProfile(payload.profiles?.ambassador ?? null)
        setProfiles({ partner, mentor, ambassador })

        setErrors((prev) => ({
          ...prev,
          partner:
            nextAssignments.partnerId && !partner
              ? 'Partner assigned but profile not found'
              : undefined,
          mentor:
            nextAssignments.mentorId && !mentor ? 'Mentor assigned but profile not found' : undefined,
          ambassador:
            nextAssignments.ambassadorId && !ambassador
              ? 'Coach assigned but profile not found'
              : undefined,
        }))
      } catch (error) {
        console.error('[useOrganizationLeadership]', error)
        if (cancelled) return
        setOrganizationLoaded(true)
        setOrganizationExists(false)
        setAssignments(emptyAssignments)
        setAssignmentSources(emptySources)
        setProfiles(emptyProfiles)
        setErrors({
          organization: 'Failed to load organization leadership.',
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, companyId, refreshKey])

  const supportAssignments = useMemo<SupportAssignments>(
    () => ({
      mentorId: assignments.mentorId,
      ambassadorId: assignments.ambassadorId,
    }),
    [assignments.ambassadorId, assignments.mentorId],
  )

  const organization = useMemo<OrganizationStatus>(
    () => ({
      id: resolvedOrgId,
      exists: organizationExists,
      loaded: organizationLoaded,
    }),
    [organizationExists, organizationLoaded, resolvedOrgId],
  )

  const supportAssignment = useMemo<SupportAssignmentStatus>(
    () => ({
      id: userId ?? null,
      exists: Boolean(assignments.mentorId || assignments.ambassadorId),
      loaded: organizationLoaded,
    }),
    [assignments.ambassadorId, assignments.mentorId, organizationLoaded, userId],
  )

  return {
    assignments,
    assignmentSources,
    profiles,
    errors,
    loading,
    loadingAssignments: loading,
    loadingProfiles: loading,
    organization,
    supportAssignment,
    supportAssignments,
    refresh,
  }
}
