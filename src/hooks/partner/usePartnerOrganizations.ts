import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerAdminSnapshot } from '@/hooks/partner/usePartnerAdminSnapshot'
import { useRetryLogic } from '@/hooks/useRetryLogic'
import { listenToOrganizationsByIds } from '@/services/organizationService'
import {
  listenToOrganizationStatsUpdates,
  updateOrganizationStatisticsBatch,
} from '@/services/organizationStatsService'
import { logger, createOrgKeySet } from '@/utils/partnerDashboardUtils'
import type { OrganizationRecord } from '@/types/admin'

export interface PartnerOrganization {
  id?: string
  code: string
  name: string
  status: 'active' | 'watch' | 'paused'
  activeUsers: number
  newThisWeek: number
  lastActive?: string
  tags?: string[]
  warning?: string
}

interface UsePartnerOrganizationsOptions {
  enabled?: boolean
}

export const usePartnerOrganizations = (options: UsePartnerOrganizationsOptions = {}) => {
  const { enabled = true } = options
  const { isSuperAdmin, user, profileStatus } = useAuth()
  const {
    assignedOrganizationIds,
    assignmentKey: partnerAssignmentKey,
    loading: assignmentsLoading,
  } = usePartnerAdminSnapshot({ enabled: enabled && !isSuperAdmin })

  const [organizations, setOrganizations] = useState<PartnerOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  // FIX #2: Track active listeners to prevent memory leaks
  const statsListenersRef = useRef<(() => void)[]>([])

  const retry = useRetryLogic({
    maxRetries: 3,
    onMaxRetriesExceeded: () => {
      setOrganizations([])
    },
  })

  const assignmentKey = useMemo(
    () => (isSuperAdmin ? 'all' : partnerAssignmentKey),
    [isSuperAdmin, partnerAssignmentKey],
  )

  // Derived organization key sets for filtering
  const organizationLookup = useMemo(() => {
    if (!organizations.length) return new Map<string, string>()
    const mapping = new Map<string, string>()
    organizations.forEach((org) => {
      const orgId = org.id?.toLowerCase()
      const orgCode = org.code?.toLowerCase()
      if (orgId && orgCode) {
        mapping.set(orgId, orgCode)
        mapping.set(orgCode, orgId)
      } else if (orgId) {
        mapping.set(orgId, orgId)
      } else if (orgCode) {
        mapping.set(orgCode, orgCode)
      }
    })
    return mapping
  }, [organizations])

  // FIX #6: Use centralized normalization for org keys
  const assignedOrgKeys = useMemo(() => {
    const keys: string[] = [...assignedOrganizationIds]

    if (ready) {
      organizations.forEach((org) => {
        if (org.id) keys.push(org.id)
        if (org.code) keys.push(org.code)
      })
    }

    return createOrgKeySet(keys)
  }, [assignedOrganizationIds, organizations, ready])

  const retryOrganizations = useCallback(() => {
    setRefreshIndex((prev) => prev + 1)
  }, [])

  // Main organizations subscription
  useEffect(() => {
    if (profileStatus !== 'ready' || !enabled) {
      setOrganizations([])
      setLoading(true)
      setError(null)
      setReady(false)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | undefined

    retry.setMounted(true)
    retry.reset()

    const subscribe = () => {
      if (!isMounted) return
      setLoading(true)
      setError(null)

      if (!isSuperAdmin && assignmentsLoading) {
        setOrganizations([])
        setLoading(true)
        setReady(false)
        return
      }

      if (!user?.uid) {
        setOrganizations([])
        setLoading(false)
        setReady(false)
        return
      }

      const handleSnapshot = (orgs: PartnerOrganization[]) => {
        if (!isMounted) return
        retry.reset()
        setOrganizations(orgs)
        setLoading(false)
        setReady(true)
        setLastSuccessAt(new Date())
      }

      const handleError = (err: unknown) => {
        logger.error('Failed to load organizations', err)
        retry.scheduleRetry(err, subscribe, setError, setLoading)
      }

      if (isSuperAdmin) {
        unsubscribe = onSnapshot(
          query(collection(db, ORG_COLLECTION), where('status', '==', 'active')),
          (snapshot) => {
            logger.debug('[PartnerOrganizations] Super admin organizations loaded', {
              count: snapshot.size,
            })
            const scoped = snapshot.docs.map((docSnap) => {
              const data = docSnap.data() as Partial<PartnerOrganization>
              return {
                id: docSnap.id,
                code: data.code || docSnap.id,
                name: data.name || docSnap.id,
                status: (data.status as PartnerOrganization['status']) || 'active',
                activeUsers: data.activeUsers ?? 0,
                newThisWeek: data.newThisWeek ?? 0,
                lastActive: data.lastActive,
                tags: data.tags || [],
                warning: !data.name || !data.code ? 'Organization details incomplete.' : undefined,
              }
            })
            handleSnapshot(scoped)
          },
          handleError
        )
      } else {
        if (!assignedOrganizationIds.length) {
          handleSnapshot([])
          return
        }

        unsubscribe = listenToOrganizationsByIds(
          assignedOrganizationIds,
          (assignedOrgs) => {
            logger.debug('[PartnerOrganizations] Assigned organizations loaded', {
              count: assignedOrgs.length,
            })
            const scoped = assignedOrgs.map((org) => {
              const data = org as OrganizationRecord & Partial<PartnerOrganization>
              return {
                id: data.id,
                code: data.code || data.id || '',
                name: data.name || data.code || data.id || 'Unknown organization',
                status: (data.status as PartnerOrganization['status']) || 'active',
                activeUsers: data.activeUsers ?? 0,
                newThisWeek: data.newThisWeek ?? 0,
                lastActive: data.lastActive,
                tags: data.tags || [],
                warning: !data.name || !data.code ? 'Organization details incomplete.' : undefined,
              }
            })
            handleSnapshot(scoped)
          },
          handleError,
        )
      }
    }

    subscribe()

    return () => {
      isMounted = false
      retry.cleanup()
      if (unsubscribe) unsubscribe()
    }
  }, [
    assignmentKey,
    assignmentsLoading,
    enabled,
    isSuperAdmin,
    profileStatus,
    refreshIndex,
    retry,
    user?.uid,
    assignedOrganizationIds,
  ])

  // FIX #2: Organization stats listeners with proper cleanup
  useEffect(() => {
    if (profileStatus !== 'ready' || !organizations.length) {
      return
    }

    // Clean up previous listeners before creating new ones
    statsListenersRef.current.forEach((unsub) => unsub())
    statsListenersRef.current = []

    let isMounted = true

    const updateStats = async () => {
      try {
        await updateOrganizationStatisticsBatch(organizations)
      } catch (err) {
        logger.error('Failed to update organization statistics', err)
      }
    }

    void updateStats()

    // Create new listeners and track them
    statsListenersRef.current = organizations.map((org) =>
      listenToOrganizationStatsUpdates(
        { id: org.id, code: org.code || org.id || '' },
        {
          onError: (err) => {
            if (!isMounted) return
            logger.error('Failed to refresh organization stats', err)
          },
        }
      )
    )

    return () => {
      isMounted = false
      // Clean up all listeners on unmount
      statsListenersRef.current.forEach((unsub) => unsub())
      statsListenersRef.current = []
    }
  }, [organizations, profileStatus])

  return {
    organizations,
    loading,
    error,
    ready,
    lastSuccessAt,
    organizationLookup,
    assignedOrgKeys,
    retryOrganizations,
  }
}
