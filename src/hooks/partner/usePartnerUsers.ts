import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { collection, onSnapshot, query, where, Query, DocumentData } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useRetryLogic } from '@/hooks/useRetryLogic'
import { useWeeklyPointsFetcher } from '@/hooks/partner/useWeeklyPointsFetcher'
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

// Firestore 'in' query limit
const FIRESTORE_IN_QUERY_LIMIT = 30

export type PartnerRiskLevel = 'engaged' | 'watch' | 'concern' | 'critical'

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
}

// FIX #12: Proper types instead of `any`
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

interface UsePartnerUsersOptions {
  selectedOrg: string
  assignedOrgKeys: Set<string>
  rawAssignedOrganizations?: string[]
  organizationLookup: Map<string, string>
  organizationsReady: boolean
  debugMode?: boolean
  enabled?: boolean
}

const USERS_COLLECTION = collection(db, 'profiles')

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

/**
 * Creates chunked Firestore queries to handle the 30-value limit on 'in' queries.
 * Returns an array of queries, each covering up to FIRESTORE_IN_QUERY_LIMIT org keys.
 * We query multiple org identifier fields to handle mixed assignment formats.
 */
const createChunkedOrgQueries = (
  orgKeys: string[],
  isSuperAdmin: boolean
): { queries: Query<DocumentData>[]; hasQueryLimitWarning: boolean } => {
  if (isSuperAdmin || orgKeys.length === 0) {
    // Super admins get all users, no org filtering needed at query level
    return { queries: [], hasQueryLimitWarning: false }
  }

  // Dedupe org keys without altering case (organization IDs are case-sensitive)
  const uniqueKeys = Array.from(new Set(orgKeys.map((k) => k.trim()).filter(Boolean)))

  if (uniqueKeys.length === 0) {
    return { queries: [], hasQueryLimitWarning: false }
  }

  const hasQueryLimitWarning = uniqueKeys.length > FIRESTORE_IN_QUERY_LIMIT

  if (hasQueryLimitWarning) {
    logger.warn(
      `[PartnerUsers] Organization keys (${uniqueKeys.length}) exceed Firestore limit of ${FIRESTORE_IN_QUERY_LIMIT}. ` +
      `Using chunked queries to fetch all users.`
    )
  }

  const queries: Query<DocumentData>[] = []
  const queryFields = ['organizationId', 'organization_id'] as const

  // Split into chunks of FIRESTORE_IN_QUERY_LIMIT
  for (let i = 0; i < uniqueKeys.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    const chunk = uniqueKeys.slice(i, i + FIRESTORE_IN_QUERY_LIMIT)

    queryFields.forEach((field) => {
      queries.push(query(USERS_COLLECTION, where(field, 'in', chunk)))
    })
  }

  return { queries, hasQueryLimitWarning }
}

export const usePartnerUsers = (options: UsePartnerUsersOptions) => {
  const {
    selectedOrg,
    assignedOrgKeys,
    rawAssignedOrganizations = [],
    organizationLookup,
    organizationsReady,
    debugMode = false,
    enabled = true,
  } = options

  const { isSuperAdmin, profileStatus, assignedOrganizations } = useAuth()

  const [users, setUsers] = useState<PartnerUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [debugInfo, setDebugInfo] = useState<DashboardDebugInfo | null>(null)

  // FIX #1: Track snapshot processing to prevent race conditions
  const processingRef = useRef<{
    snapshotId: number
    abortController: AbortController | null
  }>({
    snapshotId: 0,
    abortController: null,
  })

  const retry = useRetryLogic({ maxRetries: 3 })
  const { fetchWeeklyPointsByUser } = useWeeklyPointsFetcher()

  // FIX #6: Derive selected org keys with proper normalization
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
    setRefreshIndex((prev) => prev + 1)
  }, [])

  // FIX #5: Include all dependencies and handle rawAssignedKeys properly
  const rawAssignedKeys = useMemo(() => {
    const sourceAssignments = rawAssignedOrganizations.length ? rawAssignedOrganizations : assignedOrganizations
    const expandedAssignments = expandAssignments(sourceAssignments)
    return buildQueryKeys(expandedAssignments)
  }, [assignedOrganizations, rawAssignedOrganizations])

  useEffect(() => {
    if (profileStatus !== 'ready' || !enabled) {
      setUsers([])
      setLoading(true)
      setError(null)
      return
    }

    const canLoadUsers =
      organizationsReady ||
      isSuperAdmin ||
      debugMode ||
      rawAssignedOrganizations.length > 0 ||
      assignedOrganizations.length > 0

    if (!canLoadUsers) {
      logger.debug('[PartnerUsers] Waiting for organizations before loading users.')
      setLoading(true)
      setError(null)
      return
    }

    let isMounted = true
    let unsubscribe: (() => void) | undefined

    retry.setMounted(true)
    retry.reset()

    const subscribe = () => {
      if (!isSuperAdmin && !debugMode && rawAssignedKeys.length === 0) {
        logger.debug('[PartnerUsers] No organizations assigned. Skipping user fetch.')
        setUsers([])
        setLoading(false)
        setDebugInfo({
          totalInSnapshot: 0,
          keptCount: 0,
          rejectedNoMatch: 0,
          rejectedSelectedOrg: 0,
          mismatchSamples: [],
          assignedOrgKeys: [],
        })
        return
      }

      // OPTIMIZATION: Use server-side filtering with chunked queries instead of full collection scan
      const { queries: orgQueries, hasQueryLimitWarning } = createChunkedOrgQueries(
        rawAssignedKeys,
        isSuperAdmin || debugMode
      )

      // For super admins or debug mode, we still need a query (but without org filtering)
      const queriesToExecute = orgQueries.length > 0 ? orgQueries : [USERS_COLLECTION]

      logger.debug('[PartnerUsers] Setting up queries', {
        queryCount: queriesToExecute.length,
        isSuperAdmin,
        debugMode,
        assignedOrgCount: rawAssignedKeys.length,
        hasQueryLimitWarning,
      })

      // Track all unsubscribe functions for multiple queries
      const unsubscribers: (() => void)[] = []

      // Accumulated docs from all queries
      const accumulatedDocsMap = new Map<string, { id: string; data: () => FirestorePartnerUser }>()
      const queryDocIdsMap = new Map<number, Set<string>>()
      let pendingSnapshots = queriesToExecute.length
      let hasReceivedInitialData = false

      const processAccumulatedDocs = async () => {
        // FIX #1: Increment snapshot ID and abort any in-flight processing
        const currentSnapshotId = ++processingRef.current.snapshotId

        if (processingRef.current.abortController) {
          processingRef.current.abortController.abort()
        }
        processingRef.current.abortController = new AbortController()
        const { signal } = processingRef.current.abortController

        try {
          retry.reset()

          // Check if we should abort before heavy processing
          if (signal.aborted || !isMounted) return

          const allDocs = Array.from(accumulatedDocsMap.values())
          const seenUserIds = new Set<string>()
          let rejectedNoMatch = 0
          let rejectedSelectedOrg = 0
          const mismatchSamples: MismatchSample[] = []

          logger.debug('[PartnerUsers] Processing accumulated docs', {
            totalDocs: allDocs.length,
            assignedOrgKeys: Array.from(assignedOrgKeys),
            isSuperAdmin,
            selectedOrg,
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

            // FIX #6: Use centralized normalization
            const userOrgKeys = createOrgKeySet([
              data.organizationId,
              data.organization_id,
            ])

            // Server-side filtering already handled org matching, but we still validate
            // in case of data inconsistencies (e.g., legacy field variants)
            if (!isSuperAdmin && !debugMode) {
              if (!assignedOrgKeys.size) {
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

              const match = Array.from(userOrgKeys).some((key) => assignedOrgKeys.has(key))
              if (!match) {
                rejectedNoMatch++
                if (mismatchSamples.length < 5) {
                  mismatchSamples.push({
                    id: docWrapper.id,
                    reason: 'Org mismatch',
                    userOrgKeys: Array.from(userOrgKeys),
                    assignedKeys: Array.from(assignedOrgKeys),
                  })
                }
                return false
              }
            }

            // Filter by selected organization
            if (
              organizationsReady &&
              selectedOrg !== 'all' &&
              selectedOrg &&
              !Array.from(userOrgKeys).some((key) => selectedOrgKeys.has(key))
            ) {
              rejectedSelectedOrg++
              return false
            }

            return true
          })

          // Check abort before expensive operation
          if (signal.aborted || !isMounted) return

          const currentDebugInfo: DashboardDebugInfo = {
            totalInSnapshot: allDocs.length,
            keptCount: filteredDocs.length,
            rejectedNoMatch,
            rejectedSelectedOrg,
            mismatchSamples,
            assignedOrgKeys: Array.from(assignedOrgKeys),
          }

          logger.debug('[PartnerUsers] User filtering results', currentDebugInfo)
          if (mismatchSamples.length > 0) {
            logger.table(mismatchSamples)
          }

          setDebugInfo(currentDebugInfo)

          const userIds = filteredDocs.map((docWrapper) => docWrapper.id)

          // FIX #1: Check abort before and after async operation
          if (signal.aborted || !isMounted) return

          const { pointsByUser, hasPartialFailure, errors } = await fetchWeeklyPointsByUser(userIds)

          // Check if this snapshot is still current after async operation
          if (
            signal.aborted ||
            !isMounted ||
            currentSnapshotId !== processingRef.current.snapshotId
          ) {
            return
          }

          // FIX #7: Warn about partial failures
          if (hasPartialFailure) {
            logger.warn('[PartnerUsers] Some weekly points batches failed to load', {
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
                    ? organizationLookup.get(rawOrganizationId.toLowerCase()) ||
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
              logger.error('[PartnerUsers] Failed to transform user record', {
                userId: docWrapper.id,
                error: err,
              })
            }
          })

          // Final abort check before state update
          if (
            signal.aborted ||
            !isMounted ||
            currentSnapshotId !== processingRef.current.snapshotId
          ) {
            return
          }

          logger.debug('[PartnerUsers] Users loaded', { count: hydratedUsers.length })

          setUsers(hydratedUsers)
          setLoading(false)
          setLastSuccessAt(new Date())
        } catch (err) {
          if (signal.aborted || !isMounted) return
          logger.error('[PartnerUsers] Failed to process user snapshot', err)
          retry.scheduleRetry(err, subscribe, setError, setLoading)
        }
      }

      // Set up listeners for each query
      queriesToExecute.forEach((q, queryIndex) => {
        const unsub = onSnapshot(
          q,
          (snapshot) => {
            if (!isMounted) return

            const queryDocIds =
              queryDocIdsMap.get(queryIndex) || new Set<string>()
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

            // Track if all initial snapshots have been received
            if (!hasReceivedInitialData) {
              pendingSnapshots--
              if (pendingSnapshots <= 0) {
                hasReceivedInitialData = true
                void processAccumulatedDocs()
              }
            } else if (hasDocChanges) {
              // After initial load, process on each update
              void processAccumulatedDocs()
            }
          },
          (err) => {
            if (!isMounted) return
            logger.error(`[PartnerUsers] Query ${queryIndex} failed`, err)
            retry.scheduleRetry(err, subscribe, setError, setLoading)
          }
        )
        unsubscribers.push(unsub)
      })

      // Store cleanup function
      unsubscribe = () => {
        unsubscribers.forEach((unsub) => unsub())
      }
    }

    subscribe()

    const currentProcessing = processingRef.current
    return () => {
      isMounted = false
      retry.cleanup()
      if (currentProcessing.abortController) {
        currentProcessing.abortController.abort()
      }
      if (unsubscribe) unsubscribe()
    }
  }, [
    assignedOrgKeys,
    assignedOrganizations.length,
    debugMode,
    enabled,
    fetchWeeklyPointsByUser,
    isSuperAdmin,
    organizationLookup,
    organizationsReady,
    profileStatus,
    rawAssignedKeys,
    rawAssignedOrganizations.length,
    refreshIndex,
    retry,
    selectedOrg,
    selectedOrgKeys,
  ])

  return {
    users,
    loading,
    error,
    lastSuccessAt,
    debugInfo,
    retryUsers,
  }
}
