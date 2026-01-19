import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { listenToPartnerAdminSnapshot } from '@/services/partnerAdminService'
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

  useEffect(() => {
    if (!enabled || profileStatus !== 'ready') {
      setSnapshot(null)
      setLoading(true)
      setError(null)
      return
    }

    if (isSuperAdmin || !user?.uid) {
      setSnapshot(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = listenToPartnerAdminSnapshot(
      user.uid,
      (nextSnapshot) => {
        setSnapshot(nextSnapshot)
        setLoading(false)
      },
      (err) => {
        console.error('[PartnerAdminSnapshot] Failed to load partner assignments', err)
        setSnapshot(null)
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

  const assignedOrganizationIds = useMemo(
    () =>
      activeAssignments
        .map((assignment) => assignment.organizationId)
        .filter((organizationId) => organizationId && organizationId.length > 0),
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
    assignedOrganizationIds,
    assignmentKey,
    loading,
    error,
  }
}
