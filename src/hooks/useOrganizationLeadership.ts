import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { fetchUserProfileById, UserProfileExtended } from '@/services/userProfileService'

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

const emptySupportAssignments: SupportAssignments = {
  mentorId: null,
  ambassadorId: null,
}

const emptyProfiles: LeadershipProfiles = {
  mentor: null,
  ambassador: null,
  partner: null,
}

const resolveAssignmentId = (data: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return null
}

const resolveNestedAssignmentId = (data: Record<string, unknown>, keys: string[]) => {
  const leadership = data.leadership
  if (!leadership || typeof leadership !== 'object') return null
  return resolveAssignmentId(leadership as Record<string, unknown>, keys)
}

export interface ProfileAssignments {
  mentorId?: string | null
  ambassadorId?: string | null
}

export const useOrganizationLeadership = (
  companyId?: string | null,
  userId?: string | null,
  profile?: ProfileAssignments | null
) => {
  const [organizationAssignments, setOrganizationAssignments] = useState<LeadershipAssignments>(emptyAssignments)
  const [supportAssignments, setSupportAssignments] = useState<SupportAssignments>(emptySupportAssignments)
  const [profiles, setProfiles] = useState<LeadershipProfiles>(emptyProfiles)
  const [errors, setErrors] = useState<LeadershipErrors>({})
  const [loadingOrganizationAssignments, setLoadingOrganizationAssignments] = useState(false)
  const [loadingSupportAssignments, setLoadingSupportAssignments] = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [organizationExists, setOrganizationExists] = useState(false)
  const [organizationLoaded, setOrganizationLoaded] = useState(false)
  const [supportAssignmentExists, setSupportAssignmentExists] = useState(false)
  const [supportAssignmentLoaded, setSupportAssignmentLoaded] = useState(false)

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!companyId) {
      setOrganizationAssignments(emptyAssignments)
      setProfiles(emptyProfiles)
      setErrors({})
      setLoadingOrganizationAssignments(false)
      setLoadingProfiles(false)
      setOrganizationExists(false)
      setOrganizationLoaded(false)
      return () => undefined
    }

    setLoadingOrganizationAssignments(true)
    setErrors((prev) => ({ ...prev, organization: undefined }))

    const orgRef = doc(db, ORG_COLLECTION, companyId)
    const unsubscribe = onSnapshot(
      orgRef,
      (snapshot) => {
        setOrganizationLoaded(true)
        if (!snapshot.exists()) {
          setOrganizationExists(false)
          setErrors((prev) => ({ ...prev, organization: 'Organization not found.' }))
          setOrganizationAssignments(emptyAssignments)
          setLoadingOrganizationAssignments(false)
          return
        }
        setOrganizationExists(true)
        const data = snapshot.data() as Record<string, unknown>
        const mentorKeys = ['assignedMentorId', 'mentorId', 'mentor_id', 'assigned_mentor_id']
        const ambassadorKeys = ['assignedAmbassadorId', 'ambassadorId', 'ambassador_id', 'assigned_ambassador_id']
        const partnerKeys = ['transformationPartnerId', 'partnerId', 'partner_id', 'transformation_partner_id']

        const mentorId = resolveAssignmentId(data, mentorKeys) ?? resolveNestedAssignmentId(data, mentorKeys)
        const ambassadorId =
          resolveAssignmentId(data, ambassadorKeys) ?? resolveNestedAssignmentId(data, ambassadorKeys)
        const partnerId = resolveAssignmentId(data, partnerKeys) ?? resolveNestedAssignmentId(data, partnerKeys)
        setOrganizationAssignments({
          mentorId,
          ambassadorId,
          partnerId,
        })
        setLoadingOrganizationAssignments(false)
      },
      (error) => {
        console.error(error)
        setErrors((prev) => ({ ...prev, organization: 'Failed to load organization leadership.' }))
        setOrganizationAssignments(emptyAssignments)
        setLoadingOrganizationAssignments(false)
        setOrganizationExists(false)
        setOrganizationLoaded(true)
      },
    )

    return () => unsubscribe()
  }, [companyId, refreshKey])

  useEffect(() => {
    if (!userId) {
      setSupportAssignments(emptySupportAssignments)
      setSupportAssignmentExists(false)
      setSupportAssignmentLoaded(false)
      setErrors((prev) => ({ ...prev, supportAssignments: undefined }))
      setLoadingSupportAssignments(false)
      return () => undefined
    }

    setLoadingSupportAssignments(true)
    setErrors((prev) => ({ ...prev, supportAssignments: undefined }))

    const supportRef = doc(db, 'support_assignments', userId)
    const unsubscribe = onSnapshot(
      supportRef,
      (snapshot) => {
        setSupportAssignmentLoaded(true)
        if (!snapshot.exists()) {
          setSupportAssignmentExists(false)
          setSupportAssignments(emptySupportAssignments)
          setLoadingSupportAssignments(false)
          return
        }
        setSupportAssignmentExists(true)
        const data = snapshot.data() as Record<string, unknown>
        const mentorId = resolveAssignmentId(data, ['mentor_id', 'mentorId', 'assignedMentorId', 'assigned_mentor_id'])
        const ambassadorId = resolveAssignmentId(data, [
          'ambassador_id',
          'ambassadorId',
          'assignedAmbassadorId',
          'assigned_ambassador_id',
        ])
        setSupportAssignments({ mentorId, ambassadorId })
        setLoadingSupportAssignments(false)
      },
      (error) => {
        console.error(error)
        setErrors((prev) => ({ ...prev, supportAssignments: 'Failed to load support assignments.' }))
        setSupportAssignments(emptySupportAssignments)
        setSupportAssignmentExists(false)
        setSupportAssignmentLoaded(true)
        setLoadingSupportAssignments(false)
      },
    )

    return () => unsubscribe()
  }, [userId, refreshKey])

  const assignments = useMemo<LeadershipAssignments>(() => {
    const mentorId = supportAssignments.mentorId ?? organizationAssignments.mentorId ?? profile?.mentorId ?? null
    const ambassadorId = supportAssignments.ambassadorId ?? organizationAssignments.ambassadorId ?? profile?.ambassadorId ?? null
    const partnerId = organizationAssignments.partnerId ?? null
    return { mentorId, ambassadorId, partnerId }
  }, [organizationAssignments, supportAssignments, profile?.mentorId, profile?.ambassadorId])

  const assignmentSources = useMemo<LeadershipAssignmentSources>(() => {
    const mentor = supportAssignments.mentorId
      ? 'user'
      : organizationAssignments.mentorId
        ? 'organization'
        : profile?.mentorId
          ? 'profile'
          : null
    const ambassador = supportAssignments.ambassadorId
      ? 'user'
      : organizationAssignments.ambassadorId
        ? 'organization'
        : profile?.ambassadorId
          ? 'profile'
          : null
    const partner = organizationAssignments.partnerId ? 'organization' : null
    return { mentor, ambassador, partner }
  }, [organizationAssignments, supportAssignments, profile?.mentorId, profile?.ambassadorId])

  useEffect(() => {
    const { mentorId, ambassadorId, partnerId } = assignments

    if (!mentorId && !ambassadorId && !partnerId) {
      setProfiles(emptyProfiles)
      setErrors((prev) => ({ ...prev, mentor: undefined, ambassador: undefined, partner: undefined }))
      setLoadingProfiles(false)
      return
    }

    let isActive = true
    setLoadingProfiles(true)
    setErrors((prev) => ({ ...prev, mentor: undefined, ambassador: undefined, partner: undefined }))

    const loadProfile = async (userId: string | null, roleLabel: 'mentor' | 'ambassador' | 'partner') => {
      if (!userId) {
        return { profile: null, error: undefined }
      }
      try {
        const profile = await fetchUserProfileById(userId)
        if (!profile) {
          return { profile: null, error: `${roleLabel} assigned but profile not found` }
        }
        return { profile, error: undefined }
      } catch (error) {
        console.error(error)
        return { profile: null, error: `Unable to load ${roleLabel} profile` }
      }
    }

    void (async () => {
      const [mentorResult, ambassadorResult, partnerResult] = await Promise.all([
        loadProfile(mentorId, 'mentor'),
        loadProfile(ambassadorId, 'ambassador'),
        loadProfile(partnerId, 'partner'),
      ])

      if (!isActive) return
      setProfiles({
        mentor: mentorResult.profile,
        ambassador: ambassadorResult.profile,
        partner: partnerResult.profile,
      })
      setErrors((prev) => ({
        ...prev,
        mentor: mentorResult.error,
        ambassador: ambassadorResult.error,
        partner: partnerResult.error,
      }))
      setLoadingProfiles(false)
    })()

    return () => {
      isActive = false
    }
  }, [assignments])

  const loadingAssignments = useMemo(
    () => loadingOrganizationAssignments || loadingSupportAssignments,
    [loadingOrganizationAssignments, loadingSupportAssignments],
  )
  const loading = useMemo(() => loadingAssignments || loadingProfiles, [loadingAssignments, loadingProfiles])
  const organization = useMemo<OrganizationStatus>(
    () => ({
      id: companyId ?? null,
      exists: organizationExists,
      loaded: organizationLoaded,
    }),
    [companyId, organizationExists, organizationLoaded],
  )
  const supportAssignment = useMemo<SupportAssignmentStatus>(
    () => ({
      id: userId ?? null,
      exists: supportAssignmentExists,
      loaded: supportAssignmentLoaded,
    }),
    [supportAssignmentExists, supportAssignmentLoaded, userId],
  )

  return {
    assignments,
    assignmentSources,
    profiles,
    errors,
    loading,
    loadingAssignments,
    loadingProfiles,
    organization,
    supportAssignment,
    refresh,
  }
}
