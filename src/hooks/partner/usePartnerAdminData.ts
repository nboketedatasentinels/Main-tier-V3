import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, onSnapshot, query, where, type Query, type DocumentData } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { useAuth } from '@/hooks/useAuth'
import { useRetryLogic } from '@/hooks/useRetryLogic'
import { useWeeklyPointsFetcher } from '@/hooks/partner/useWeeklyPointsFetcher'
import { usePartnerMetrics } from '@/hooks/partner/usePartnerMetrics'
import { listenToOrganizationsByIds } from '@/services/organizationService'
import {
  listenToOrganizationStatsUpdates,
  updateOrganizationStatisticsBatch,
} from '@/services/organizationStatsService'
import {
  logger,
  normalizeTimestamp,
  normalizeOrgKey,
  createOrgKeySet,
  type DashboardDebugInfo,
  type MismatchSample,
} from '@/utils/partnerDashboardUtils'
import {
  calculateUserRiskStatus,
  getProgramWeekNumber,
  mapWeeklyPointsToProgress,
} from '@/utils/partnerProgress'
import type { OrganizationRecord, PartnerAssignment } from '@/types/admin'

// Firestore 'in' query limit
const FIRESTORE_IN_QUERY_LIMIT = 30

export type PartnerRiskLevel = 'engaged' | 'watch' | 'concern' | 'critical'

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

export interface PartnerUser {
  id: string
  name: string
  fullName?: string
  createdAt?: string
  lastActiveAt?: string
  programStartDate?: string
  email: string
  companyCode: string
  organizationId?: string
  progressPercent: number
  currentWeek: number
  status: 'Active' | 'Paused' | 'Onboarding'
  lastActive: string
  riskStatus: PartnerRiskLevel | 'at_risk'
  weeklyEarned: number
  weeklyRequired: number
  role?: 'learner' | 'mentor' | 'user' | 'team_leader'
  riskReasons?: string[]
  registrationDate?: string
  interventions?: number
  nudgeEnabled?: boolean
  adminNotes?: string
}

type FirestorePartnerUser = Partial<PartnerUser> & {
  full_name?: string
  firstName?: string
  lastName?: string
  companyCode?: string
  company_code?: string
  accountStatus?: string
  registrationDate?: unknown
  registration_date?: unknown
  programStartDate?: unknown
  program_start_date?: unknown
  organizationId?: string
  organization_id?: string
  lastActiveAt?: unknown
  last_active_at?: unknown
  lastActive?: unknown
  last_active?: unknown
  createdAt?: unknown
  created_at?: unknown
  role?: PartnerUser['role']
  totalPoints?: number
  nudgeResponseScore?: number
  status?: string
}

export interface PartnerAdminAnalytics {
  metrics: ReturnType<typeof usePartnerMetrics>['metrics']
  engagementTrend: ReturnType<typeof usePartnerMetrics>['engagementTrend']
  riskLevels: ReturnType<typeof usePartnerMetrics>['riskLevels']
  atRiskUsers: ReturnType<typeof usePartnerMetrics>['atRiskUsers']
  managedBreakdown: ReturnType<typeof usePartnerMetrics>['managedBreakdown']
  daysUntil: ReturnType<typeof usePartnerMetrics>['daysUntil']
}

export interface PartnerAdminDataSnapshot {
  partnerId: string | null
  assignments: PartnerAssignment[]
  assignedOrganizationIds: string[]
  organizations: PartnerOrganization[]
  users: PartnerUser[]
  analytics: PartnerAdminAnalytics
  organizationLookup: Map<string, string>
  assignedOrgKeys: Set<string>
  usersFetchedAt?: Date | null
}

interface UsePartnerAdminDataOptions {
  enabled?: boolean
  selectedOrg?: string
  debugMode?: boolean
}

const isActiveAssignment = (assignment: PartnerAssignment) =>
  !assignment.status || assignment.status === 'active'

const expandAssignments = (assignments: string[]) => {
  const expanded = new Set<string>()
  assignments.forEach((entry) => {
    if (typeof entry !== 'string') return
    const trimmed = entry.trim()
    if (!trimmed) return
    expanded.add(trimmed)
  })
  return Array.from(expanded)
}

const buildQueryKeys = (assignments: string[]): string[] => {
  const deduped = new Set<string>()
  assignments.forEach((entry) => {
    if (typeof entry !== 'string') return
    const trimmed = entry.trim()
    if (!trimmed) return
    deduped.add(trimmed)
  })
  return Array.from(deduped)
}

const createChunkedOrgQueries = (
  orgKeys: string[],
  isSuperAdmin: boolean
): { queries: Query<DocumentData>[]; hasQueryLimitWarning: boolean } => {
  if (isSuperAdmin || orgKeys.length === 0) {
    return { queries: [], hasQueryLimitWarning: false }
  }

  const uniqueKeys = Array.from(new Set(orgKeys.map((k) => k.trim()).filter(Boolean)))

  if (uniqueKeys.length === 0) {
    return { queries: [], hasQueryLimitWarning: false }
  }

  const hasQueryLimitWarning = uniqueKeys.length > FIRESTORE_IN_QUERY_LIMIT

  if (hasQueryLimitWarning) {
    logger.warn(
      `[PartnerAdminData] Organization keys (${uniqueKeys.length}) exceed Firestore limit of ${FIRESTORE_IN_QUERY_LIMIT}. ` +
      'Using chunked queries to fetch all users.'
    )
  }

  const queries: Query<DocumentData>[] = []
  const queryFields = ['organizationId', 'organization_id', 'companyCode', 'company_code'] as const

  for (let i = 0; i < uniqueKeys.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    const chunk = uniqueKeys.slice(i, i + FIRESTORE_IN_QUERY_LIMIT)

    queryFields.forEach((field) => {
      queries.push(query(collection(db, 'profiles'), where(field, 'in', chunk)))
    })
  }

  return { queries, hasQueryLimitWarning }
}

export const usePartnerAdminData = (
  partnerId?: string | null,
  options: UsePartnerAdminDataOptions = {},
) => {
  const { enabled = true, selectedOrg = 'all', debugMode = false } = options
  const { profileStatus, isSuperAdmin } = useAuth()
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)
  const [assignedOrganizationIds, setAssignedOrganizationIds] = useState<string[]>([])

  const assignments = useMemo<PartnerAssignment[]>(
    () =>
      assignedOrganizationIds.map((organizationId) => ({
        organizationId,
        status: 'active' as const,
      })),
    [assignedOrganizationIds],
  )

  const activeAssignments = useMemo(
    () => assignments.filter(isActiveAssignment),
    [assignments],
  )

  useEffect(() => {
    if (!enabled || profileStatus !== 'ready') {
      setAssignedOrganizationIds([])
      setAssignmentsLoading(true)
      setAssignmentsError(null)
      return
    }

    if (isSuperAdmin || !partnerId) {
      setAssignedOrganizationIds([])
      setAssignmentsLoading(false)
      setAssignmentsError(null)
      return
    }

    setAssignmentsLoading(true)
    setAssignmentsError(null)

    // 1. Modern Source: partners/${partnerId} document
    const partnerDocRef = doc(db, 'partners', partnerId)

    // 2. Legacy Source: partner_organizations collection where partnerId == partnerId
    const legacyQuery = query(
      collection(db, 'partner_organizations'),
      where('partnerId', '==', partnerId)
    )

    let partnerDocOrgIds: string[] = []
    let legacyOrgIds: string[] = []
    let partnerDocLoaded = false
    let legacyLoaded = false
    let partnerDocErrorOccurred = false
    let legacyErrorOccurred = false

    const updateCombinedAssignments = () => {
      const combined = Array.from(new Set([...partnerDocOrgIds, ...legacyOrgIds]))
      setAssignedOrganizationIds(combined)

      // Only stop loading when both listeners have responded at least once
      if (partnerDocLoaded && legacyLoaded) {
        setAssignmentsLoading(false)

        if (partnerDocErrorOccurred && legacyErrorOccurred) {
          setAssignmentsError('Unable to load partner assignments from any source.')
        } else {
          setAssignmentsError(null)
        }
      }

      console.log('[PartnerAdminData] Combined partner assignments updated', {
        partnerId,
        totalCount: combined.length,
        fromPartnerDoc: partnerDocOrgIds.length,
        fromLegacy: legacyOrgIds.length,
        loading: !(partnerDocLoaded && legacyLoaded)
      })
    }

    const unsubPartnerDoc = onSnapshot(
      partnerDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as {
            assignedOrganizations?: Array<string | { organizationId?: string; companyCode?: string }>
          }
          const raw = data.assignedOrganizations || []
          partnerDocOrgIds = raw
            .map((assignment) => {
              if (typeof assignment === 'string') return assignment.trim()
              return assignment.organizationId?.trim() || ''
            })
            .filter((orgId): orgId is string => !!orgId)
        } else {
          partnerDocOrgIds = []
        }
        partnerDocLoaded = true
        partnerDocErrorOccurred = false
        updateCombinedAssignments()
      },
      (err) => {
        console.error('[PartnerAdminData] Modern assignments load failed', err)
        partnerDocLoaded = true
        partnerDocErrorOccurred = true
        updateCombinedAssignments()
      }
    )

    const unsubLegacy = onSnapshot(
      legacyQuery,
      (snap) => {
        legacyOrgIds = snap.docs
          .map((docSnap) => {
            const data = docSnap.data() as { organizationId?: string }
            if (data.organizationId) return data.organizationId.trim()
            // Fallback to extracting from ID if organizationId field is missing
            // ID format is usually partnerId_organizationId
            const parts = docSnap.id.split('_')
            if (parts.length > 1) return parts[1].trim()
            return ''
          })
          .filter((orgId): orgId is string => !!orgId)

        legacyLoaded = true
        legacyErrorOccurred = false
        updateCombinedAssignments()
      },
      (err) => {
        console.error('[PartnerAdminData] Legacy assignments load failed', err)
        legacyLoaded = true
        legacyErrorOccurred = true
        updateCombinedAssignments()
      }
    )

    return () => {
      unsubPartnerDoc()
      unsubLegacy()
    }
  }, [enabled, isSuperAdmin, partnerId, profileStatus])

  const [organizations, setOrganizations] = useState<PartnerOrganization[]>([])
  const [organizationsLoading, setOrganizationsLoading] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [organizationsReady, setOrganizationsReady] = useState(false)
  const [lastOrganizationsSuccessAt, setLastOrganizationsSuccessAt] = useState<Date | null>(null)
  const [orgRefreshIndex, setOrgRefreshIndex] = useState(0)

  const statsListenersRef = useRef<(() => void)[]>([])
  const retryOrganizationsHandler = useRetryLogic({
    maxRetries: 3,
    onMaxRetriesExceeded: () => {
      setOrganizations([])
    },
  })

  const retryOrganizations = useCallback(() => {
    setOrgRefreshIndex((prev) => prev + 1)
  }, [])

  const assignmentKey = useMemo(
    () => (isSuperAdmin ? 'all' : assignedOrganizationIds.slice().sort().join('|')),
    [assignedOrganizationIds, isSuperAdmin],
  )

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

  const assignedOrgKeys = useMemo(() => {
    const keys: string[] = [...assignedOrganizationIds]

    if (organizationsReady) {
      organizations.forEach((org) => {
        if (org.id) keys.push(org.id)
        if (org.code) keys.push(org.code)
      })
    }

    return createOrgKeySet(keys)
  }, [assignedOrganizationIds, organizations, organizationsReady])

  // FIX: Track if organizations effect has initialized to prevent re-running
  const orgsInitializedRef = useRef(false)

  useEffect(() => {
    if (profileStatus !== 'ready' || !enabled) {
      setOrganizations([])
      setOrganizationsLoading(true)
      setOrganizationsError(null)
      setOrganizationsReady(false)
      orgsInitializedRef.current = false
      return
    }

    // FIX: Skip if already initialized with same assignment key
    if (orgsInitializedRef.current && orgRefreshIndex === 0) {
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | undefined

    retryOrganizationsHandler.setMounted(true)
    retryOrganizationsHandler.reset()

    const subscribe = () => {
      if (!isMounted) return
      setOrganizationsLoading(true)
      setOrganizationsError(null)

      if (!isSuperAdmin && assignmentsLoading) {
        setOrganizations([])
        setOrganizationsLoading(true)
        setOrganizationsReady(false)
        return
      }

      const handleSnapshot = (orgs: PartnerOrganization[]) => {
        if (!isMounted) return
        retryOrganizationsHandler.reset()
        orgsInitializedRef.current = true
        setOrganizations(orgs)
        setOrganizationsLoading(false)
        setOrganizationsReady(true)
        setLastOrganizationsSuccessAt(new Date())
      }

      const handleError = (err: unknown) => {
        logger.error('Failed to load organizations', err)
        retryOrganizationsHandler.scheduleRetry(err, subscribe, setOrganizationsError, setOrganizationsLoading)
      }

      if (isSuperAdmin) {
        unsubscribe = onSnapshot(
          query(collection(db, ORG_COLLECTION), where('status', '==', 'active')),
          (snapshot) => {
            logger.debug('[PartnerAdminData] Super admin organizations loaded', {
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
          (assignedOrgs: OrganizationRecord[]) => {
            logger.debug('[PartnerAdminData] Assigned organizations loaded', {
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
      retryOrganizationsHandler.cleanup()
      if (unsubscribe) unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assignmentKey,
    assignmentsLoading,
    enabled,
    isSuperAdmin,
    orgRefreshIndex,
    profileStatus,
    // NOTE: retryOrganizationsHandler and assignedOrganizationIds intentionally excluded
  ])

  // FIX: Track if stats have been initialized
  const statsInitializedRef = useRef(false)

  useEffect(() => {
    if (profileStatus !== 'ready' || !organizations.length) {
      return
    }

    // FIX: Only initialize stats once
    if (statsInitializedRef.current) {
      return
    }
    statsInitializedRef.current = true

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
      statsListenersRef.current.forEach((unsub) => unsub())
      statsListenersRef.current = []
    }
  }, [organizations, profileStatus])

  const [users, setUsers] = useState<PartnerUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [lastUsersSuccessAt, setLastUsersSuccessAt] = useState<Date | null>(null)
  const [usersRefreshIndex, setUsersRefreshIndex] = useState(0)
  const [debugInfo, setDebugInfo] = useState<DashboardDebugInfo | null>(null)
  const [hasQueryLimitWarning, setHasQueryLimitWarning] = useState(false)

  const retryUsersHandler = useRetryLogic({ maxRetries: 3 })
  const { fetchWeeklyPointsByUser } = useWeeklyPointsFetcher()

  const selectedOrgKeys = useMemo(() => {
    if (!selectedOrg || selectedOrg === 'all') return new Set<string>()
    const normalizedSelected = normalizeOrgKey(selectedOrg)
    if (!normalizedSelected) return new Set<string>()

    const keys = new Set<string>([normalizedSelected])
    const mapped = organizationLookup.get(normalizedSelected)
    if (mapped) keys.add(mapped)
    return keys
  }, [organizationLookup, selectedOrg])

  const retryUsers = useCallback(() => {
    setUsersRefreshIndex((prev) => prev + 1)
  }, [])

  const rawAssignedKeys = useMemo(() => {
    const baseKeys = assignedOrganizationIds.length ? assignedOrganizationIds : []
    const expandedAssignments = expandAssignments(baseKeys)
    const expandedFromOrganizations = organizationsReady
      ? organizations
          .flatMap((org) => [org.id, org.code])
          .filter((value): value is string => Boolean(value))
      : []
    const combined = [...expandedAssignments, ...expandedFromOrganizations]
    return buildQueryKeys(combined)
  }, [assignedOrganizationIds, organizations, organizationsReady])

  const processingRef = useRef<{
    snapshotId: number
    abortController: AbortController | null
  }>({
    snapshotId: 0,
    abortController: null,
  })

  // FIX: Store current filter values in refs to avoid stale closures and prevent re-runs
  const filterRefsRef = useRef({
    assignedOrgKeys,
    selectedOrgKeys,
    organizationLookup,
    selectedOrg,
  })

  // Update filter refs when values change (without triggering the main effect)
  useEffect(() => {
    filterRefsRef.current = {
      assignedOrgKeys,
      selectedOrgKeys,
      organizationLookup,
      selectedOrg,
    }
  }, [assignedOrgKeys, selectedOrgKeys, organizationLookup, selectedOrg])

  // FIX: Track if users have been loaded to prevent infinite loop
  const usersInitializedRef = useRef(false)

  useEffect(() => {
    if (profileStatus !== 'ready' || !enabled) {
      setUsers([])
      setUsersLoading(true)
      setUsersError(null)
      usersInitializedRef.current = false
      return
    }

    const canLoadUsers =
      isSuperAdmin ||
      debugMode ||
      (organizationsReady && assignedOrganizationIds.length > 0)

    if (!canLoadUsers) {
      logger.debug('[PartnerAdminData] Waiting for organizations before loading users.')
      setUsersLoading(true)
      setUsersError(null)
      return
    }

    // FIX: Skip if already initialized (unless manually refreshed)
    if (usersInitializedRef.current && usersRefreshIndex === 0) {
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | undefined

    retryUsersHandler.setMounted(true)
    retryUsersHandler.reset()

    const subscribe = () => {
      if (!isSuperAdmin && !debugMode && rawAssignedKeys.length === 0) {
        logger.debug('[PartnerAdminData] No organizations assigned. Skipping user fetch.')
        setUsers([])
        setUsersLoading(false)
        setDebugInfo({
          totalInSnapshot: 0,
          keptCount: 0,
          rejectedNoMatch: 0,
          rejectedSelectedOrg: 0,
          mismatchSamples: [],
          assignedOrgKeys: [],
        })
        setHasQueryLimitWarning(false)
        usersInitializedRef.current = true
        return
      }

      const { queries: orgQueries, hasQueryLimitWarning: queryLimitWarning } = createChunkedOrgQueries(
        rawAssignedKeys,
        isSuperAdmin || debugMode
      )
      setHasQueryLimitWarning(queryLimitWarning)

      const queriesToExecute = orgQueries.length > 0 ? orgQueries : [collection(db, 'profiles')]

      logger.debug('[PartnerAdminData] Setting up user queries', {
        queryCount: queriesToExecute.length,
        isSuperAdmin,
        debugMode,
        assignedOrgCount: rawAssignedKeys.length,
        hasQueryLimitWarning: queryLimitWarning,
      })

      const unsubscribers: (() => void)[] = []
      const accumulatedDocsMap = new Map<string, { id: string; data: () => FirestorePartnerUser }>()
      const queryDocIdsMap = new Map<number, Set<string>>()
      let pendingSnapshots = queriesToExecute.length
      let hasReceivedInitialData = false

      const processAccumulatedDocs = async () => {
        const currentSnapshotId = ++processingRef.current.snapshotId

        if (processingRef.current.abortController) {
          processingRef.current.abortController.abort()
        }
        processingRef.current.abortController = new AbortController()
        const { signal } = processingRef.current.abortController

        // FIX: Read latest filter values from refs
        const latestFilters = filterRefsRef.current

        try {
          retryUsersHandler.reset()

          if (signal.aborted || !isMounted) return

          const allDocs = Array.from(accumulatedDocsMap.values())
          const seenUserIds = new Set<string>()
          let rejectedNoMatch = 0
          let rejectedSelectedOrg = 0
          const mismatchSamples: MismatchSample[] = []

          logger.debug('[PartnerAdminData] Processing accumulated user docs', {
            totalDocs: allDocs.length,
            assignedOrgKeys: Array.from(latestFilters.assignedOrgKeys),
            isSuperAdmin,
            selectedOrg: latestFilters.selectedOrg,
          })

          const filteredDocs = allDocs.filter((docWrapper) => {
            if (seenUserIds.has(docWrapper.id)) return false
            seenUserIds.add(docWrapper.id)

            const data = docWrapper.data()

            const accountStatus = (
              data.accountStatus || data.status || 'active'
            ).toLowerCase()
            const allowedStatuses = ['active', 'onboarding', 'paused']
            if (!allowedStatuses.includes(accountStatus)) {
              return false
            }

            const userOrgKeys = createOrgKeySet([
              data.organizationId,
              data.organization_id,
              data.companyCode,
              data.company_code,
            ])

            if (!isSuperAdmin && !debugMode) {
              if (!latestFilters.assignedOrgKeys.size) {
                rejectedNoMatch++
                if (mismatchSamples.length < 5) {
                  mismatchSamples.push({
                    id: docWrapper.id,
                    reason: 'No assigned org keys',
                    userOrgKeys: Array.from(userOrgKeys),
                  })
                }
                return false
              }

              const match = Array.from(userOrgKeys).some((key) => latestFilters.assignedOrgKeys.has(key))
              if (!match) {
                rejectedNoMatch++
                if (mismatchSamples.length < 5) {
                  mismatchSamples.push({
                    id: docWrapper.id,
                    reason: 'Org mismatch',
                    userOrgKeys: Array.from(userOrgKeys),
                    assignedKeys: Array.from(latestFilters.assignedOrgKeys),
                  })
                }
                return false
              }
            }

            if (
              organizationsReady &&
              latestFilters.selectedOrg !== 'all' &&
              latestFilters.selectedOrg &&
              !Array.from(userOrgKeys).some((key) => latestFilters.selectedOrgKeys.has(key))
            ) {
              rejectedSelectedOrg++
              return false
            }

            return true
          })

          if (signal.aborted || !isMounted) return

          const currentDebugInfo: DashboardDebugInfo = {
            totalInSnapshot: allDocs.length,
            keptCount: filteredDocs.length,
            rejectedNoMatch,
            rejectedSelectedOrg,
            mismatchSamples,
            assignedOrgKeys: Array.from(latestFilters.assignedOrgKeys),
          }

          logger.debug('[PartnerAdminData] User filtering results', currentDebugInfo)
          if (mismatchSamples.length > 0) {
            logger.table(mismatchSamples)
          }

          setDebugInfo(currentDebugInfo)

          const userIds = filteredDocs.map((docWrapper) => docWrapper.id)

          if (signal.aborted || !isMounted) return

          const { pointsByUser, hasPartialFailure, errors } = await fetchWeeklyPointsByUser(userIds)

          if (
            signal.aborted ||
            !isMounted ||
            currentSnapshotId !== processingRef.current.snapshotId
          ) {
            return
          }

          if (hasPartialFailure) {
            logger.warn('[PartnerAdminData] Some weekly points batches failed to load', {
              errorCount: errors.length,
            })
          }

          const hydratedUsers: PartnerUser[] = []

          filteredDocs.forEach((docWrapper) => {
            try {
              const data = docWrapper.data()

              const rawCompanyCode = data.companyCode || data.company_code || ''
              const rawOrganizationId = data.organizationId || data.organization_id || ''
              const companyCode =
                rawCompanyCode.trim().length > 0
                  ? rawCompanyCode.toLowerCase()
                  : rawOrganizationId
                    ? latestFilters.organizationLookup.get(rawOrganizationId.toLowerCase()) ||
                      rawOrganizationId.toLowerCase()
                    : ''

              const normalizedCreatedAt = normalizeTimestamp(data.createdAt || data.created_at)
              const normalizedRegistrationDate =
                normalizeTimestamp(
                  data.registrationDate ||
                    data.registration_date ||
                    data.createdAt ||
                    data.created_at
                ) || undefined
              const normalizedProgramStart =
                normalizeTimestamp(
                  data.programStartDate ||
                    data.program_start_date ||
                    normalizedRegistrationDate
                ) || normalizedRegistrationDate
              const normalizedLastActive =
                normalizeTimestamp(
                  data.lastActiveAt ||
                    data.last_active_at ||
                    data.lastActive ||
                    data.last_active ||
                    normalizedRegistrationDate
                ) || new Date().toISOString()

              const currentWeek = getProgramWeekNumber(normalizedProgramStart || undefined)
              const progress = mapWeeklyPointsToProgress(
                pointsByUser[docWrapper.id] || [],
                currentWeek
              )
              const riskResult = calculateUserRiskStatus(
                progress.current_week,
                progress.earned_points,
                progress.required_points,
                data.nudgeResponseScore
              )

              const weeklyRequirement = progress.required_points[currentWeek] || 0
              const weeklyEarned = progress.earned_points[currentWeek] || 0
              const progressPercent = weeklyRequirement
                ? Math.min(100, Math.round((weeklyEarned / weeklyRequirement) * 100))
                : data.progressPercent || 0

              const riskStatus: PartnerRiskLevel | 'at_risk' =
                riskResult.status === 'at_risk'
                  ? 'at_risk'
                  : progressPercent >= 95
                    ? 'engaged'
                    : progressPercent >= 80
                      ? 'watch'
                      : progressPercent >= 60
                        ? 'concern'
                        : 'critical'

              const riskReasons = [
                ...(data.riskReasons || []),
                ...(riskResult.reason ? [riskResult.reason] : []),
                data.nudgeResponseScore && data.nudgeResponseScore >= 0.7
                  ? 'Responds well to nudges'
                  : undefined,
              ].filter(
                (reason): reason is string => typeof reason === 'string' && reason.length > 0
              )

              const displayName =
                data.name ||
                data.fullName ||
                data.full_name ||
                [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
                'Unknown User'

              hydratedUsers.push({
                id: docWrapper.id,
                name: displayName,
                fullName: data.fullName || data.full_name || displayName,
                createdAt: normalizedCreatedAt || undefined,
                lastActiveAt:
                  normalizeTimestamp(data.lastActiveAt || data.last_active_at) || undefined,
                programStartDate: normalizedProgramStart || undefined,
                email: data.email || '',
                companyCode,
                organizationId: rawOrganizationId
                  ? rawOrganizationId.toLowerCase()
                  : undefined,
                progressPercent,
                currentWeek,
                status:
                  ((data.accountStatus || data.status) as PartnerUser['status']) || 'Active',
                lastActive: normalizedLastActive,
                riskStatus,
                weeklyEarned,
                weeklyRequired: weeklyRequirement,
                role: data.role,
                riskReasons,
                registrationDate: normalizedRegistrationDate || undefined,
                interventions: data.interventions || 0,
              })
            } catch (err) {
              logger.error('[PartnerAdminData] Failed to transform user record', {
                userId: docWrapper.id,
                error: err,
              })
            }
          })

          if (
            signal.aborted ||
            !isMounted ||
            currentSnapshotId !== processingRef.current.snapshotId
          ) {
            return
          }

          logger.debug('[PartnerAdminData] Users loaded', { count: hydratedUsers.length })
          console.log('[PartnerAdminData] Users query result count', hydratedUsers.length)

          usersInitializedRef.current = true
          setUsers(hydratedUsers)
          setUsersLoading(false)
          setLastUsersSuccessAt(new Date())
        } catch (err) {
          if (signal.aborted || !isMounted) return
          logger.error('[PartnerAdminData] Failed to process user snapshot', err)
          retryUsersHandler.scheduleRetry(err, subscribe, setUsersError, setUsersLoading)
        }
      }

      queriesToExecute.forEach((q, queryIndex) => {
        const unsub = onSnapshot(
          q,
          (snapshot) => {
            if (!isMounted) return

            const queryDocIds = queryDocIdsMap.get(queryIndex) || new Set<string>()
            queryDocIdsMap.set(queryIndex, queryDocIds)

            let hasDocChanges = false

            snapshot.docChanges().forEach((change) => {
              const docSnap = change.doc

              if (change.type === 'removed') {
                queryDocIds.delete(docSnap.id)
                let stillReferenced = false
                for (const ids of queryDocIdsMap.values()) {
                  if (ids.has(docSnap.id)) {
                    stillReferenced = true
                    break
                  }
                }
                if (!stillReferenced) {
                  accumulatedDocsMap.delete(docSnap.id)
                }
                hasDocChanges = true
                return
              }

              queryDocIds.add(docSnap.id)
              accumulatedDocsMap.set(docSnap.id, {
                id: docSnap.id,
                data: () => docSnap.data() as FirestorePartnerUser,
              })
              hasDocChanges = true
            })

            if (!hasReceivedInitialData) {
              pendingSnapshots--
              if (pendingSnapshots <= 0) {
                hasReceivedInitialData = true
                void processAccumulatedDocs()
              }
            } else if (hasDocChanges) {
              void processAccumulatedDocs()
            }
          },
          (err) => {
            if (!isMounted) return
            logger.error(`[PartnerAdminData] Query ${queryIndex} failed`, err)
            retryUsersHandler.scheduleRetry(err, subscribe, setUsersError, setUsersLoading)
          }
        )
        unsubscribers.push(unsub)
      })

      unsubscribe = () => {
        unsubscribers.forEach((unsub) => unsub())
      }
    }

    subscribe()

    const currentProcessing = processingRef.current
    return () => {
      isMounted = false
      retryUsersHandler.cleanup()
      if (currentProcessing.abortController) {
        currentProcessing.abortController.abort()
      }
      if (unsubscribe) unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // FIX: Minimal stable dependencies - filter values accessed via refs
    assignedOrganizationIds.length,
    debugMode,
    enabled,
    fetchWeeklyPointsByUser,
    isSuperAdmin,
    organizationsReady,
    profileStatus,
    rawAssignedKeys.length, // Use length instead of array reference
    usersRefreshIndex,
  ])

  const analytics = usePartnerMetrics({ users, organizations })

  const snapshot: PartnerAdminDataSnapshot = useMemo(
    () => ({
      partnerId: partnerId ?? null,
      assignments: activeAssignments,
      assignedOrganizationIds,
      organizations,
      users,
      analytics,
      organizationLookup,
      assignedOrgKeys,
      usersFetchedAt: lastUsersSuccessAt,
    }),
    [
      activeAssignments,
      analytics,
      assignedOrgKeys,
      assignedOrganizationIds,
      lastUsersSuccessAt,
      organizationLookup,
      organizations,
      partnerId,
      users,
    ],
  )

  const loading = assignmentsLoading || organizationsLoading || usersLoading
  const error = assignmentsError || organizationsError || usersError

  return {
    snapshot,
    loading,
    error,
    organizationsLoading,
    organizationsError,
    organizationsReady,
    usersLoading,
    usersError,
    assignmentsLoading,
    assignmentsError,
    lastOrganizationsSuccessAt,
    lastUsersSuccessAt,
    retryOrganizations,
    retryUsers,
    debugInfo,
    hasQueryLimitWarning,
  }
}
