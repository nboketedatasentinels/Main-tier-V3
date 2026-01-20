import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { PartnerAdminSnapshot, PartnerAssignment } from '@/types/admin'

interface UsePartnerAdminSnapshotOptions {
  enabled?: boolean
}

const isActiveAssignment = (assignment: PartnerAssignment) =>
  !assignment.status || assignment.status === 'active'

export const usePartnerAdminSnapshot = (options: UsePartnerAdminSnapshotOptions = {}) => {
  const { enabled = true } = options
  const { user, profileStatus, isSuperAdmin } = useAuth()

  const [snapshot, setSnapshot] = useState<PartnerAdminSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignedOrganizationIds, setAssignedOrganizationIds] = useState<string[]>([])

  useEffect(() => {
    if (!enabled || profileStatus !== 'ready') {
      setSnapshot(null)
      setLoading(true)
      setError(null)
      return
    }

    if (isSuperAdmin || !user?.uid) {
      setSnapshot(null)
      setAssignedOrganizationIds([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const assignmentsQuery = query(
      collection(db, 'partner_organizations'),
      where('partnerId', '==', user.uid),
    )

    const unsubscribe = onSnapshot(
      assignmentsQuery,
      (snapshot) => {
        const orgIds = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as { organizationId?: string }
            if (data.organizationId) return data.organizationId.trim()
            const [, organizationId] = docSnap.id.split('_')
            return organizationId?.trim() || ''
          })
          .filter((organizationId): organizationId is string => !!organizationId)

        const deduped = Array.from(new Set(orgIds))
        setAssignedOrganizationIds(deduped)
        setSnapshot({
          partnerId: user.uid,
          role: 'partner',
          assignedOrganizations: deduped.map((organizationId) => ({
            organizationId,
            status: 'active',
          })),
        })
        setLoading(false)
      },
      (err) => {
        console.error('[PartnerAdminSnapshot] Failed to load partner assignments', err)
        setSnapshot(null)
        setAssignedOrganizationIds([])
        setLoading(false)
        setError('Unable to load partner assignments.')
      },
    )

    return () => unsubscribe()
  }, [enabled, isSuperAdmin, profileStatus, user?.uid])

  const assignments = useMemo(
    () => snapshot?.assignedOrganizations ?? [],
    [snapshot?.assignedOrganizations],
  )

  const activeAssignments = useMemo(
    () => assignments.filter(isActiveAssignment),
    [assignments],
  )

  const activeAssignmentIds = useMemo(
    () =>
      activeAssignments
        .map((assignment) => assignment.organizationId?.trim())
        .filter((organizationId): organizationId is string => !!organizationId),
    [activeAssignments],
  )

  const assignedOrganizationCodes = useMemo(
    () =>
      activeAssignments
        .map((assignment) => assignment.companyCode?.trim())
        .filter((companyCode): companyCode is string => !!companyCode),
    [activeAssignments],
  )

  const assignmentKey = useMemo(
    () => assignedOrganizationIds.slice().sort().join('|'),
    [assignedOrganizationIds],
  )

  return {
    snapshot,
    assignments,
    activeAssignments,
    assignedOrganizationIds: assignedOrganizationIds.length ? assignedOrganizationIds : activeAssignmentIds,
    assignedOrganizationCodes,
    assignmentKey,
    loading,
    error,
  }
}
