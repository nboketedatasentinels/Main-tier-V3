import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { PartnerAdminSnapshot, PartnerAssignment } from '@/types/admin'

interface UsePartnerAdminSnapshotOptions {
  enabled?: boolean
}

const isActiveAssignment = (assignment: PartnerAssignment) =>
  !assignment.status || assignment.status === 'active'

const parseAssignedOrganizations = (value: unknown): PartnerAssignment[] => {
  if (!Array.isArray(value)) return []

  const assignments: PartnerAssignment[] = []

  value.forEach((entry) => {
    if (typeof entry === 'string') {
      const organizationId = entry.trim()
      if (organizationId) {
        assignments.push({ organizationId, status: 'active' })
      }
      return
    }

    if (entry && typeof entry === 'object') {
      const organizationId = (entry as { organizationId?: string }).organizationId?.trim()
      const companyCode = (entry as { companyCode?: string }).companyCode?.trim()
      const status = (entry as { status?: PartnerAssignment['status'] }).status ?? 'active'
      if (organizationId || companyCode) {
        assignments.push({
          organizationId: organizationId || undefined,
          companyCode: companyCode || undefined,
          status,
        })
      }
    }
  })

  return assignments
}

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

    const unsubscribe = onSnapshot(
      doc(db, 'partners', user.uid),
      (docSnap) => {
        if (!docSnap.exists()) {
          setSnapshot(null)
          setAssignedOrganizationIds([])
          setLoading(false)
          setError('Partner record not found.')
          return
        }

        const data = docSnap.data() as { assignedOrganizations?: unknown }
        const assignments = parseAssignedOrganizations(data.assignedOrganizations)
        const orgIds = assignments
          .map((assignment) => assignment.organizationId?.trim())
          .filter((organizationId): organizationId is string => !!organizationId)
        const deduped = Array.from(new Set(orgIds))
        setAssignedOrganizationIds(deduped)
        setSnapshot({
          partnerId: user.uid,
          role: 'partner',
          assignedOrganizations: assignments,
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
