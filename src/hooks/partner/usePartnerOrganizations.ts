import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerAdminSnapshot } from '@/hooks/partner/usePartnerAdminSnapshot'
import { useRetryLogic } from '@/hooks/useRetryLogic'
import {
  listenToActiveOrganizations,
  listenToOrganizationsByIds,
} from '@/services/organizationService'
import { listenToPartnerOrgStats, type OrgStatCounts } from '@/services/partnerSupabaseReads'
import { logger, createOrgKeySet, normalizeOrgKey } from '@/utils/partnerDashboardUtils'
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

  // Per-org member stats, computed from Supabase profiles. Held separately from
  // `organizations` so refreshing stats never mutates the org list (which would
  // re-key the subscription effect and churn - see prior re-subscribe-loop fixes).
  const [orgStats, setOrgStats] = useState<Map<string, OrgStatCounts>>(new Map())

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
        unsubscribe = listenToActiveOrganizations(
          (activeOrgs: OrganizationRecord[]) => {
            logger.debug('[PartnerOrganizations] Super admin organizations loaded', {
              count: activeOrgs.length,
            })
            const scoped = activeOrgs.map((org: OrganizationRecord) => {
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
      } else {
        if (!assignedOrganizationIds.length) {
          handleSnapshot([])
          return
        }

        unsubscribe = listenToOrganizationsByIds(
          assignedOrganizationIds,
          (assignedOrgs: OrganizationRecord[]) => {
            logger.debug('[PartnerOrganizations] Assigned organizations loaded', {
              count: assignedOrgs.length,
            })
            const scoped = assignedOrgs.map((org: OrganizationRecord) => {
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

  // Stable signature of the org id/code set. The stats subscription re-keys on
  // this (not the `organizations` array reference), so it only re-subscribes
  // when the set of orgs actually changes - never on a stats-only update.
  const orgStatKeysSig = useMemo(() => {
    const keys: string[] = []
    organizations.forEach((org) => {
      if (org.id) keys.push(org.id.trim())
      if (org.code) keys.push(org.code.trim())
    })
    return Array.from(new Set(keys.filter(Boolean))).sort().join('|')
  }, [organizations])

  // Organization stats from Supabase profiles (replaces the old Firestore path).
  useEffect(() => {
    if (profileStatus !== 'ready') {
      setOrgStats(new Map())
      return
    }
    const keys = orgStatKeysSig.split('|').filter(Boolean)
    if (!keys.length) {
      setOrgStats(new Map())
      return
    }

    const unsubscribe = listenToPartnerOrgStats(keys, setOrgStats, (err) => {
      logger.error('Failed to refresh organization stats', err)
    })

    return () => unsubscribe()
  }, [orgStatKeysSig, profileStatus])

  // Merge live Supabase stats into the org list for display.
  const organizationsWithStats = useMemo(() => {
    if (orgStats.size === 0) return organizations
    return organizations.map((org) => {
      const counts =
        orgStats.get(normalizeOrgKey(org.id) ?? '') ?? orgStats.get(normalizeOrgKey(org.code) ?? '')
      return counts
        ? { ...org, activeUsers: counts.activeUsers, newThisWeek: counts.newThisWeek }
        : org
    })
  }, [organizations, orgStats])

  return {
    organizations: organizationsWithStats,
    loading,
    error,
    ready,
    lastSuccessAt,
    organizationLookup,
    assignedOrgKeys,
    retryOrganizations,
  }
}
