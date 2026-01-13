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

export interface LeadershipProfiles {
  mentor: UserProfileExtended | null
  ambassador: UserProfileExtended | null
  partner: UserProfileExtended | null
}

export interface LeadershipErrors {
  organization?: string
  mentor?: string
  ambassador?: string
  partner?: string
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

export const useOrganizationLeadership = (companyId?: string | null) => {
  const [assignments, setAssignments] = useState<LeadershipAssignments>(emptyAssignments)
  const [profiles, setProfiles] = useState<LeadershipProfiles>(emptyProfiles)
  const [errors, setErrors] = useState<LeadershipErrors>({})
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!companyId) {
      setAssignments(emptyAssignments)
      setProfiles(emptyProfiles)
      setErrors({})
      setLoadingAssignments(false)
      return () => undefined
    }

    setLoadingAssignments(true)
    setErrors((prev) => ({ ...prev, organization: undefined }))

    const orgRef = doc(db, ORG_COLLECTION, companyId)
    const unsubscribe = onSnapshot(
      orgRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setErrors((prev) => ({ ...prev, organization: 'Organization not found.' }))
          setAssignments(emptyAssignments)
          setLoadingAssignments(false)
          return
        }
        const data = snapshot.data() as {
          assignedMentorId?: string | null
          assignedAmbassadorId?: string | null
          transformationPartnerId?: string | null
        }
        setAssignments({
          mentorId: data.assignedMentorId ?? null,
          ambassadorId: data.assignedAmbassadorId ?? null,
          partnerId: data.transformationPartnerId ?? null,
        })
        setLoadingAssignments(false)
      },
      (error) => {
        console.error(error)
        setErrors((prev) => ({ ...prev, organization: 'Failed to load organization leadership.' }))
        setAssignments(emptyAssignments)
        setLoadingAssignments(false)
      },
    )

    return () => unsubscribe()
  }, [companyId, refreshKey])

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
          return { profile: null, error: `${roleLabel} profile not found` }
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

  const loading = useMemo(() => loadingAssignments || loadingProfiles, [loadingAssignments, loadingProfiles])

  return {
    assignments,
    profiles,
    errors,
    loading,
    refresh,
  }
}
