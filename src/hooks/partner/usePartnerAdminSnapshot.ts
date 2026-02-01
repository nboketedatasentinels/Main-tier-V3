import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query as firestoreQuery, where } from 'firebase/firestore'
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

  const [assignmentsFromDoc, setAssignmentsFromDoc] = useState<PartnerAssignment[]>([])
  const [assignmentsFromQuery, setAssignmentsFromQuery] = useState<PartnerAssignment[]>([])
  const [docLoading, setDocLoading] = useState(true)
  const [queryLoading, setQueryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Derived state for the final snapshot
  const snapshot = useMemo<PartnerAdminSnapshot | null>(() => {
    if (!user?.uid) return null
    if (docLoading || queryLoading) return null // Wait for both sources to complete

    // Merge assignments with deduplication
    const allAssignments = [...assignmentsFromDoc, ...assignmentsFromQuery]
    const seenIds = new Set<string>()
    const uniqueAssignments: PartnerAssignment[] = []

    allAssignments.forEach((assignment) => {
      // FIX: Use organizationId OR companyCode as deduplication key
      // This prevents filtering out assignments that only have companyCode
      const key = assignment.organizationId || assignment.companyCode
      if (key && !seenIds.has(key)) {
        seenIds.add(key)
        uniqueAssignments.push(assignment)
      }
    })

    return {
      partnerId: user.uid,
      role: 'partner',
      assignedOrganizations: uniqueAssignments,
    }
  }, [user?.uid, assignmentsFromDoc, assignmentsFromQuery, docLoading, queryLoading])

  const assignedOrganizationIds = useMemo(() => {
    // FIX: Return organizationId OR companyCode to handle both identifier types
    return snapshot?.assignedOrganizations
      .map((a) => a.organizationId || a.companyCode)
      .filter((id): id is string => !!id) ?? []
  }, [snapshot])

  useEffect(() => {
    if (!enabled || profileStatus !== 'ready') {
      setAssignmentsFromDoc([])
      setAssignmentsFromQuery([])
      setDocLoading(true)
      setQueryLoading(true)
      setError(null)
      return
    }

    if (isSuperAdmin || !user?.uid) {
      setAssignmentsFromDoc([])
      setAssignmentsFromQuery([])
      setDocLoading(false)
      setQueryLoading(false)
      setError(null)
      return
    }

    setDocLoading(true)
    setQueryLoading(true)
    setError(null)

    // 1. Listen to the user document for assigned organizations
    const unsubscribeDoc = onSnapshot(
      doc(db, 'users', user.uid),
      (docSnap) => {
        if (!docSnap.exists()) {
          setAssignmentsFromDoc([])
          setDocLoading(false)
          // Don't error here, rely on the query
          return
        }

        const data = docSnap.data() as { assignedOrganizations?: unknown }
        const parsed = parseAssignedOrganizations(data.assignedOrganizations)
        setAssignmentsFromDoc(parsed)
        setDocLoading(false)
      },
      (err) => {
        console.error('[PartnerAdminSnapshot] Failed to load partner doc', err)
        setAssignmentsFromDoc([])
        setDocLoading(false)
        // We don't set global error here to allow the query to succeed
      }
    )

    // 2. Listen to the organizations collection (Source of Truth)
    const organizationsQuery = firestoreQuery(
      collection(db, 'organizations'),
      where('transformationPartnerId', '==', user.uid),
      where('status', 'in', ['active', 'watch', 'paused']) // Exclude inactive/suspended if desired, or keep all
    )

    const unsubscribeQuery = onSnapshot(
      organizationsQuery,
      (querySnap) => {
        const fromQuery: PartnerAssignment[] = querySnap.docs.map((doc) => ({
          organizationId: doc.id,
          status: 'active', // Default to active for queried orgs, or map from org status
          companyCode: doc.data().code,
        }))
        setAssignmentsFromQuery(fromQuery)
        setQueryLoading(false)
      },
      (err) => {
        console.error('[PartnerAdminSnapshot] Failed to query organizations', err)
        setAssignmentsFromQuery([])
        setQueryLoading(false)
        setError('Unable to load partner organizations.')
      }
    )

    return () => {
      unsubscribeDoc()
      unsubscribeQuery()
    }
  }, [enabled, isSuperAdmin, profileStatus, user?.uid])

  // FIX: Loading until both sources complete (not just when both are loading)
  const loading = docLoading || queryLoading

  // FIX: Set error when no assignments found (after both sources complete)
  useEffect(() => {
    if (loading || isSuperAdmin) return

    if (snapshot && snapshot.assignedOrganizations.length === 0) {
      setError('No organizations assigned. Please contact your administrator.')
    } else if (error && snapshot && snapshot.assignedOrganizations.length > 0) {
      setError(null) // Clear error if assignments are found
    }
  }, [loading, snapshot, isSuperAdmin, error])

  // Debug logging (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && snapshot) {
      console.log('[PartnerAdminSnapshot] Assignment Resolution', {
        partnerId: user?.uid,
        assignmentsFromDoc: assignmentsFromDoc.length,
        assignmentsFromQuery: assignmentsFromQuery.length,
        uniqueAssignments: snapshot.assignedOrganizations.length,
        assignedIds: assignedOrganizationIds,
        assignments: snapshot.assignedOrganizations.map(a => ({
          orgId: a.organizationId,
          code: a.companyCode,
          status: a.status
        })),
        docLoading,
        queryLoading,
        loading,
        error,
      })
    }
  }, [snapshot, assignedOrganizationIds, docLoading, queryLoading, loading, error, user?.uid, assignmentsFromDoc, assignmentsFromQuery])

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
