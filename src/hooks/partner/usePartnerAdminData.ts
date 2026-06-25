import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRetryLogic } from '@/hooks/useRetryLogic'
import { useWeeklyPointsFetcher } from '@/hooks/partner/useWeeklyPointsFetcher'
import { usePartnerMetrics } from '@/hooks/partner/usePartnerMetrics'
import { listenToOrganizationsByIds, listenToActiveOrganizations } from '@/services/organizationService'
import {
  listenToPartnerAssignedOrgIds,
  listenToPartnerMembers,
} from '@/services/partnerSupabaseReads'
import {
  logger,
  normalizeTimestamp,
  normalizeOrgKey,
  createOrgKeySet,
  type DashboardDebugInfo,
  type MismatchSample,
} from '@/utils/partnerDashboardUtils'
import { getDisplayName, type DisplayNameInput } from '@/utils/displayName'
import {
  calculateUserRiskStatus,
  getProgramWeekNumber,
  mapWeeklyPointsToProgress,
} from '@/utils/partnerProgress'
import type { OrganizationRecord, PartnerAssignment } from '@/types/admin'

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
  journeyType?: string // Added for 6W at-risk logic
  cohortStartDate?: string // Organization's cohort start date for accurate week calculation
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
  lastActive?: string // Only set when recordUserActivity is called - undefined means no activity tracked yet
  riskStatus: PartnerRiskLevel | 'at_risk'
  weeklyEarned: number
  weeklyRequired: number
  role?: 'learner' | 'mentor' | 'user' | 'team_leader'
  riskReasons?: string[]
  registrationDate?: string
  interventions?: number
  nudgeEnabled?: boolean
  adminNotes?: string
  totalPoints?: number
  journeyType?: string
  onboardingComplete?: boolean
  onboardingSkipped?: boolean
  hasCompletedPersonalityTest?: boolean
  hasCompletedValuesTest?: boolean
  // Inferred from the raw profile role: 'free_user' → 'free', everything else
  // (paid_member, mentor, ambassador) → 'paid'. Used for paid/free tab split.
  membershipTier?: 'free' | 'paid'
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
  companyId?: string
  lastActiveAt?: unknown
  last_active_at?: unknown
  lastActive?: unknown
  last_active?: unknown
  updatedAt?: unknown
  updated_at?: unknown
  createdAt?: unknown
  created_at?: unknown
  role?: PartnerUser['role']
  totalPoints?: number
  total_points?: number
  nudgeResponseScore?: number
  status?: string
  nudge_enabled?: boolean
  admin_notes?: string
  journeyType?: string // Added for 6W at-risk logic
  onboardingComplete?: boolean
  onboardingSkipped?: boolean
  hasCompletedPersonalityTest?: boolean
  hasCompletedValuesTest?: boolean
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

export const usePartnerAdminData = (
  partnerId?: string | null,
  options: UsePartnerAdminDataOptions = {},
) => {
  const { enabled = true, selectedOrg = 'all', debugMode = false } = options
  const { profileStatus, isSuperAdmin } = useAuth()
  const [docAssignmentsLoading, setDocAssignmentsLoading] = useState(true)
  const [queryAssignmentsLoading, setQueryAssignmentsLoading] = useState(true)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)

  const [assignmentsFromDoc, setAssignmentsFromDoc] = useState<string[]>([])
  const [assignmentsFromQuery, setAssignmentsFromQuery] = useState<string[]>([])
  const [assignedOrganizationIds, setAssignedOrganizationIds] = useState<string[]>([])

  // Combine assignments when sources update
  useEffect(() => {
    const combined = Array.from(new Set([...assignmentsFromDoc, ...assignmentsFromQuery]))
    // Only update if changed to prevent loops
    setAssignedOrganizationIds(prev => {
      if (prev.length === combined.length && prev.every(id => combined.includes(id))) {
        return prev
      }
      return combined
    })
  }, [assignmentsFromDoc, assignmentsFromQuery])

  const assignmentsLoading = docAssignmentsLoading && queryAssignmentsLoading

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
      setAssignmentsFromDoc([])
      setAssignmentsFromQuery([])
      setDocAssignmentsLoading(true)
      setQueryAssignmentsLoading(true)
      setAssignmentsError(null)
      return
    }

    if (isSuperAdmin || !partnerId) {
      setAssignmentsFromDoc([])
      setAssignmentsFromQuery([])
      setDocAssignmentsLoading(false)
      setQueryAssignmentsLoading(false)
      setAssignmentsError(null)
      return
    }

    setDocAssignmentsLoading(true)
    setQueryAssignmentsLoading(true)
    setAssignmentsError(null)

    // Supabase: union of organizations.transformation_partner_id (canonical) and
    // profiles.{partnerId}.data.assignedOrganizations (mirror). Both resolved by
    // listenToPartnerAssignedOrgIds. The legacy `partner_organizations`
    // collection has no Supabase equivalent and is dropped.
    const unsubscribe = listenToPartnerAssignedOrgIds(
      partnerId,
      (orgIds) => {
        setAssignmentsFromDoc([])
        setAssignmentsFromQuery(orgIds)
        setDocAssignmentsLoading(false)
        setQueryAssignmentsLoading(false)
        setAssignmentsError(null)
        console.log('[PartnerAdminData] Partner assignments updated', {
          partnerId,
          totalCount: orgIds.length,
        })
      },
      (err) => {
        console.error('[PartnerAdminData] Assigned orgs load failed', err)
        setAssignmentsFromDoc([])
        setAssignmentsFromQuery([])
        setDocAssignmentsLoading(false)
        setQueryAssignmentsLoading(false)
        setAssignmentsError('Unable to load partner assignments.')
      },
    )

    return () => {
      unsubscribe()
    }
  }, [enabled, isSuperAdmin, partnerId, profileStatus])

  const [organizations, setOrganizations] = useState<PartnerOrganization[]>([])
  const [organizationsLoading, setOrganizationsLoading] = useState(true)
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [organizationsReady, setOrganizationsReady] = useState(false)
  const [lastOrganizationsSuccessAt, setLastOrganizationsSuccessAt] = useState<Date | null>(null)
  const [orgRefreshIndex, setOrgRefreshIndex] = useState(0)

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

  // Lookup org ID/code → journeyType (for 6W at-risk logic)
  const journeyTypeLookup = useMemo(() => {
    if (!organizations.length) return new Map<string, string>()
    const mapping = new Map<string, string>()
    organizations.forEach((org) => {
      if (org.journeyType) {
        if (org.id) mapping.set(org.id.toLowerCase(), org.journeyType)
        if (org.code) mapping.set(org.code.toLowerCase(), org.journeyType)
      }
    })
    return mapping
  }, [organizations])

  // Lookup org ID/code → cohortStartDate (for accurate week calculation)
  const cohortStartLookup = useMemo(() => {
    if (!organizations.length) return new Map<string, string>()
    const mapping = new Map<string, string>()
    organizations.forEach((org) => {
      if (org.cohortStartDate) {
        if (org.id) mapping.set(org.id.toLowerCase(), org.cohortStartDate)
        if (org.code) mapping.set(org.code.toLowerCase(), org.cohortStartDate)
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
        unsubscribe = listenToActiveOrganizations(
          (activeOrgs: OrganizationRecord[]) => {
            logger.debug('[PartnerAdminData] Super admin organizations loaded', {
              count: activeOrgs.length,
            })
            const scoped = activeOrgs.map((org) => {
              const data = org as OrganizationRecord & Partial<PartnerOrganization>
              // Fallback chain so the partner dashboard's journey progress bar
              // works for any org configured with a journey, even if an explicit
              // cohort start hasn't been set: cohortStartDate → programStart →
              // createdAt (the org's "added" date).
              const cohortStart = normalizeTimestamp(
                data.cohortStartDate || data.programStart || data.createdAt
              )
              return {
                id: data.id,
                code: data.code || data.id || '',
                name: data.name || data.code || data.id || 'Unknown organization',
                status: (data.status as PartnerOrganization['status']) || 'active',
                activeUsers: data.activeUsers ?? 0,
                newThisWeek: data.newThisWeek ?? 0,
                lastActive: typeof data.lastActive === 'string' ? data.lastActive : undefined,
                tags: data.tags || [],
                warning: !data.name || !data.code ? 'Organization details incomplete.' : undefined,
                journeyType: data.journeyType, // Include for 6W at-risk logic
                cohortStartDate: cohortStart || undefined, // Include for accurate week calculation
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
            logger.debug('[PartnerAdminData] Assigned organizations loaded', {
              count: assignedOrgs.length,
            })
            const scoped = assignedOrgs.map((org) => {
              const data = org as OrganizationRecord & Partial<PartnerOrganization>
              // Fallback chain so the partner dashboard's journey progress bar
              // works for any org configured with a journey, even if an explicit
              // cohort start hasn't been set: cohortStartDate → programStart →
              // createdAt (the org's "added" date).
              const cohortStart = normalizeTimestamp(
                data.cohortStartDate || data.programStart || data.createdAt
              )
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
                journeyType: data.journeyType, // Include for 6W at-risk logic
                cohortStartDate: cohortStart || undefined, // Include for accurate week calculation
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

  // Organization statistics are derived client-side from the Supabase-loaded
  // `users` + `organizations` (see usePartnerMetrics). The legacy Firestore
  // stats listener (onSnapshot on the `users` collection, one per org) was
  // removed in the Supabase cutover: with no Firebase session it only threw
  // "Missing or insufficient permissions" and fed nothing the dashboard reads.

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
    journeyTypeLookup, // Added for 6W at-risk logic
    cohortStartLookup, // Added for accurate week calculation
    selectedOrg,
  })

  // Update filter refs when values change (without triggering the main effect)
  useEffect(() => {
    filterRefsRef.current = {
      assignedOrgKeys,
      selectedOrgKeys,
      organizationLookup,
      journeyTypeLookup, // Added for 6W at-risk logic
      cohortStartLookup, // Added for accurate week calculation
      selectedOrg,
    }
  }, [assignedOrgKeys, selectedOrgKeys, organizationLookup, journeyTypeLookup, cohortStartLookup, selectedOrg])

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

      // Supabase has no 30-item 'in' limit; member profiles load in one paged
      // read scoped by org keys (or all profiles for super_admin/debug). The
      // query-limit warning is retained (always false) for API shape stability.
      setHasQueryLimitWarning(false)

      logger.debug('[PartnerAdminData] Setting up Supabase member load', {
        isSuperAdmin,
        debugMode,
        assignedOrgCount: rawAssignedKeys.length,
      })

      const accumulatedDocsMap = new Map<string, { id: string; data: () => FirestorePartnerUser }>()

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
          // rejectedSelectedOrg is always 0 now that we no longer filter by
          // selectedOrg at this layer (dashboard owns per-org filtering).
          // Kept in the debug payload for shape stability with downstream
          // consumers of DashboardDebugInfo.
          const rejectedSelectedOrg = 0
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

            // NOTE: We deliberately do NOT filter by selectedOrg here. This
            // hook returns the full partner-accessible user set (scoped by
            // assignedOrgKeys above); per-selection filtering is the
            // dashboard's responsibility (PartnerDashboard.overviewUsers).
            //
            // The previous behavior filtered at this layer too, but the
            // user-loading effect's deps don't include selectedOrg/
            // selectedOrgKeys - so switching the dropdown left this layer
            // stale and the dashboard then re-filtered an already-narrow
            // set, producing empty results when moving Org A → Org X.
            // Widening here lets the dashboard's useMemo re-derive
            // instantly on every dropdown change.

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

          // Fetch weekly points data for progress tracking
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
              const rawOrganizationId = data.organizationId || data.organization_id || data.companyId || ''
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

              // For lastActive: only use actual activity tracking data (lastActiveAt)
              // This is set by recordUserActivity when users perform actions
              const normalizedLastActive =
                normalizeTimestamp(
                  data.lastActiveAt ||
                  data.last_active_at
                ) || undefined

              // FIX: Use organization's cohortStartDate for week calculation if available
              // This ensures all users in the same cohort show the same week
              const orgCohortStart = rawOrganizationId
                ? latestFilters.cohortStartLookup?.get(rawOrganizationId.toLowerCase())
                : undefined
              const effectiveProgramStart = orgCohortStart || normalizedProgramStart
              const currentWeek = getProgramWeekNumber(effectiveProgramStart || undefined)
              const progress = mapWeeklyPointsToProgress(
                pointsByUser[docWrapper.id] || [],
                currentWeek
              )

              // Get journey context for 6W at-risk logic
              // Try user profile first, then fallback to organization
              let userJourneyType: string | null = data.journeyType ?? null
              if (!userJourneyType && rawOrganizationId) {
                userJourneyType = latestFilters.journeyTypeLookup?.get(rawOrganizationId.toLowerCase()) ?? null
              }
              // Use the totalPoints field directly from the user's profile
              // This is updated by pointsService.ts whenever points are awarded
              const userTotalPoints = data.totalPoints ?? data.total_points ?? 0

              const riskResult = calculateUserRiskStatus(
                progress.current_week,
                progress.earned_points,
                progress.required_points,
                data.nudgeResponseScore,
                { journeyType: userJourneyType, totalPoints: userTotalPoints }
              )

              const weeklyRequirement = progress.required_points[currentWeek] || 0
              const weeklyEarned = progress.earned_points[currentWeek] || 0
              const progressPercent = weeklyRequirement
                ? Math.min(100, Math.round((weeklyEarned / weeklyRequirement) * 100))
                : data.progressPercent || 0

              // Map pace-ratio risk level to partner display categories
              // Only critical/behind = at risk. Warning and above = positively evolving, not at risk.
              const riskStatus: PartnerRiskLevel | 'at_risk' =
                riskResult.level === 'critical'
                  ? 'critical'
                  : riskResult.level === 'behind'
                    ? 'at_risk'
                    : riskResult.level === 'warning'
                      ? 'watch'
                      : progressPercent >= 95
                        ? 'engaged'
                        : 'watch'

              const riskReasons = [
                ...(data.riskReasons || []),
                ...(riskResult.reason ? [riskResult.reason] : []),
                data.nudgeResponseScore && data.nudgeResponseScore >= 0.7
                  ? 'Responds well to nudges'
                  : undefined,
              ].filter(
                (reason): reason is string => typeof reason === 'string' && reason.length > 0
              )

              const enrichedData = data as FirestorePartnerUser & { displayName?: string }
              const displayNameInput: DisplayNameInput = {
                displayName: typeof enrichedData.displayName === 'string' ? enrichedData.displayName : undefined,
                name: typeof data.name === 'string' ? data.name : undefined,
                fullName: typeof data.fullName === 'string' ? data.fullName : undefined,
                full_name: typeof data.full_name === 'string' ? data.full_name : undefined,
                firstName: typeof data.firstName === 'string' ? data.firstName : undefined,
                lastName: typeof data.lastName === 'string' ? data.lastName : undefined,
                email: typeof data.email === 'string' ? data.email : undefined,
                uid: docWrapper.id,
              }
              const displayName = getDisplayName(displayNameInput, 'Unknown User')

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
                status: (() => {
                  // If explicitly paused in DB, respect that
                  const dbStatus = (data.accountStatus || data.status) as string | undefined
                  if (dbStatus === 'Paused' || dbStatus === 'paused') return 'Paused' as const

                  // If onboarding is incomplete, mark as Onboarding
                  const rawData = data as Record<string, unknown>
                  if (rawData.onboardingComplete === false && !rawData.onboardingSkipped) return 'Onboarding' as const

                  // Compute status from actual engagement data
                  const hasAnyPoints = userTotalPoints > 0
                  const hasLastActive = Boolean(normalizedLastActive)
                  const daysSinceActive = normalizedLastActive
                    ? Math.floor((Date.now() - new Date(normalizedLastActive).getTime()) / (1000 * 60 * 60 * 24))
                    : null

                  // No points AND no tracked activity → never engaged
                  if (!hasAnyPoints && !hasLastActive) return 'Onboarding' as const

                  // Inactive for 14+ days → Paused
                  if (daysSinceActive !== null && daysSinceActive >= 14) return 'Paused' as const

                  return 'Active' as const
                })(),
                lastActive: normalizedLastActive,
                riskStatus,
                weeklyEarned,
                weeklyRequired: weeklyRequirement,
                role: data.role,
                riskReasons,
                registrationDate: normalizedRegistrationDate || undefined,
                interventions: data.interventions || 0,
                nudgeEnabled: data.nudgeEnabled ?? data.nudge_enabled ?? true,
                adminNotes: data.adminNotes ?? data.admin_notes ?? '',
                totalPoints: userTotalPoints,
                journeyType: userJourneyType || undefined,
                onboardingComplete: data.onboardingComplete === true,
                onboardingSkipped: data.onboardingSkipped === true,
                hasCompletedPersonalityTest: data.hasCompletedPersonalityTest === true,
                hasCompletedValuesTest: data.hasCompletedValuesTest === true,
                // Raw profile role can be 'free_user' / 'paid_member' / etc. -
                // wider than the narrow PartnerUser.role enum on the type.
                membershipTier: (data.role as string | undefined) === 'free_user' ? 'free' : 'paid',
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

          // Dedupe by email so the partner's user count matches the admin's
          // (the admin path applies dedupeUserDocsByEmail on /profiles).
          // Without this, learners with duplicate profile docs (same email,
          // different docId) get counted twice in the partner view but once
          // in the admin view, producing the "tables not talking" symptom.
          // Keep the first occurrence; downstream consumers don't depend on
          // which specific doc wins, only that counts agree across views.
          const seenEmails = new Set<string>()
          const dedupedUsers: PartnerUser[] = []
          let duplicateCount = 0
          for (const user of hydratedUsers) {
            const emailKey = (user.email || '').trim().toLowerCase()
            if (!emailKey) {
              dedupedUsers.push(user)
              continue
            }
            if (seenEmails.has(emailKey)) {
              duplicateCount += 1
              continue
            }
            seenEmails.add(emailKey)
            dedupedUsers.push(user)
          }
          if (duplicateCount > 0) {
            logger.warn('[PartnerAdminData] Dropped duplicate-email profile docs', {
              dropped: duplicateCount,
              kept: dedupedUsers.length,
            })
          }

          logger.debug('[PartnerAdminData] Users loaded', { count: dedupedUsers.length })
          console.log('[PartnerAdminData] Users query result count', dedupedUsers.length)

          usersInitializedRef.current = true
          setUsers(dedupedUsers)
          setUsersLoading(false)
          setLastUsersSuccessAt(new Date())
        } catch (err) {
          if (signal.aborted || !isMounted) return
          logger.error('[PartnerAdminData] Failed to process user snapshot', err)
          retryUsersHandler.scheduleRetry(err, subscribe, setUsersError, setUsersLoading)
        }
      }

      // One Supabase read (paged) replaces the chunked Firestore listeners.
      // On every load we rebuild the doc map and re-run the existing
      // filter/hydrate pipeline, which is agnostic to the data source.
      unsubscribe = listenToPartnerMembers(
        rawAssignedKeys,
        (docs) => {
          if (!isMounted) return
          accumulatedDocsMap.clear()
          docs.forEach((d) => {
            accumulatedDocsMap.set(d.id, {
              id: d.id,
              data: () => d.data() as FirestorePartnerUser,
            })
          })
          void processAccumulatedDocs()
        },
        (err) => {
          if (!isMounted) return
          logger.error('[PartnerAdminData] Member load failed', err)
          retryUsersHandler.scheduleRetry(err, subscribe, setUsersError, setUsersLoading)
        },
        { all: isSuperAdmin || debugMode },
      )
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
