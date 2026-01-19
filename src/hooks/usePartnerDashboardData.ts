import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerUsers } from '@/hooks/partner/usePartnerUsers'
import { usePartnerInterventions } from '@/hooks/partner/usePartnerInterventions'
import { usePartnerMetrics } from '@/hooks/partner/usePartnerMetrics'
import { logOrganizationAccessAttempt } from '@/services/organizationService'
import { recordEngagementAction } from '@/services/engagementService'
import { logger, normalizeOrgKey } from '@/utils/partnerDashboardUtils'
import type { DataWarning } from '@/components/admin/RiskAnalysisCard'

// Re-export types for backward compatibility
export type { PartnerRiskLevel, PartnerUser } from '@/hooks/partner/usePartnerUsers'
export type { PartnerOrganization } from '@/hooks/partner/usePartnerOrganizations'
export type { PartnerInterventionSummary } from '@/hooks/partner/usePartnerInterventions'
export type { DashboardDebugInfo } from '@/utils/partnerDashboardUtils'

interface UsePartnerDashboardDataOptions {
  selectedOrg?: string
  debugMode?: boolean
}

// ============================================================================
// FIX #15: Refactored hook that composes smaller, focused hooks
// ============================================================================
export const usePartnerDashboardData = (options?: UsePartnerDashboardDataOptions) => {
  const { assignedOrganizations = [], profile, isSuperAdmin, user, profileStatus } = useAuth()

  const [selectedOrg, setSelectedOrg] = useState<string>(options?.selectedOrg || 'all')
  const [notificationCount, setNotificationCount] = useState<number>(0)
  const lastAccessAttempt = useRef<string | null>(null)

<<<<<<< HEAD
  // Stable key for organization stats subscriptions to prevent unnecessary restarts
  const organizationIdsKey = useMemo(
    () => organizations.map((org) => org.id || org.code).filter(Boolean).sort().join('|'),
    [organizations],
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
    const keys = new Set<string>()
    assignedOrganizations.forEach((org) => keys.add(org.toLowerCase()))
    if (organizationsReady) {
      organizations.forEach((org) => {
        if (org.id) keys.add(org.id.toLowerCase())
        if (org.code) keys.add(org.code.toLowerCase())
      })
    }
    return keys
  }, [assignedOrganizations, organizations, organizationsReady])
=======
  // Use composed hooks
  const {
    organizations,
    loading: organizationsLoading,
    error: organizationsError,
    ready: organizationsReady,
    lastSuccessAt: lastOrganizationsSuccessAt,
    organizationLookup,
    assignedOrgKeys,
    retryOrganizations,
  } = usePartnerOrganizations({
    enabled: profileStatus === 'ready',
  })
>>>>>>> Journeys

  // FIX #14: Derive selectedOrgKeys only from necessary dependencies
  const selectedOrgKeys = useMemo(() => {
    if (!selectedOrg || selectedOrg === 'all') return new Set<string>()
    const normalizedSelected = normalizeOrgKey(selectedOrg)
    if (!normalizedSelected) return new Set<string>()

    const keys = new Set<string>([normalizedSelected])
    const mapped = organizationLookup.get(normalizedSelected)
    if (mapped) keys.add(mapped)
    return keys
  }, [organizationLookup, selectedOrg])

  const {
    users,
    loading: usersLoading,
    error: usersError,
    lastSuccessAt: lastUsersSuccessAt,
    debugInfo,
    retryUsers,
  } = usePartnerUsers({
    selectedOrg,
    assignedOrgKeys,
    organizationLookup,
    organizationsReady,
    debugMode: options?.debugMode,
    enabled: profileStatus === 'ready',
  })

  const { interventions, hasQueryLimitWarning } = usePartnerInterventions({
    selectedOrg,
    assignedOrgKeys,
    selectedOrgKeys,
    enabled: profileStatus === 'ready',
  })

  const {
    metrics,
    engagementTrend,
    riskLevels,
    atRiskUsers,
    managedBreakdown,
    daysUntil,
  } = usePartnerMetrics({
    users,
    organizations,
  })

  // Reset selected org when it becomes invalid
  useEffect(() => {
    if (profileStatus !== 'ready') return
    if (selectedOrg === 'all') return
    if (organizationsLoading) return

<<<<<<< HEAD
  useEffect(() => {
    if (profileStatus !== 'ready') {
      console.debug('[PartnerDashboard] Waiting for profile readiness before loading dashboard data.', {
        profileStatus,
      })
      setOrganizations([])
      setUsers([])
      setOrganizationsLoading(true)
      setUsersLoading(true)
      setOrganizationsError(null)
      setUsersError(null)
      setOrganizationsReady(false)
      return
    }
    console.debug('[PartnerDashboard] Profile ready, loading dashboard data.')
  }, [profileStatus])

  const retryOrganizations = () => setOrganizationsRefreshIndex((prev) => prev + 1)
  const retryUsers = () => setUsersRefreshIndex((prev) => prev + 1)

  useEffect(() => {
    if (profileStatus !== 'ready') {
      return
    }
    let isMounted = true
    let unsubscribe: (() => void) | undefined
    let retryTimeout: ReturnType<typeof setTimeout> | undefined

    const resetRetry = () => {
      organizationsRetryAttempts.current = 0
    }

    const scheduleRetry = (error: unknown) => {
      if (!isMounted) return
      const maxRetries = 3
      const nextAttempt = organizationsRetryAttempts.current + 1
      if (nextAttempt > maxRetries) {
        setOrganizations([])
        setOrganizationsError(formatFirestoreError(error, 'Unable to load organizations. Please try again.'))
        setOrganizationsLoading(false)
        return
      }

      organizationsRetryAttempts.current = nextAttempt
      const delay = Math.min(1000 * 2 ** (nextAttempt - 1), 8000)
      console.warn('[PartnerDashboard] Retrying organizations subscription', {
        attempt: nextAttempt,
        delay,
      })
      setOrganizationsError(
        formatFirestoreError(error, `Unable to load organizations. Retrying (${nextAttempt}/${maxRetries})...`),
      )
      retryTimeout = setTimeout(() => {
        if (!isMounted) return
        void subscribe()
      }, delay)
    }

    const subscribe = async () => {
      if (!isMounted) return
      setOrganizationsLoading(true)
      setOrganizationsError(null)

      if (!user?.uid) {
        setOrganizations([])
        setOrganizationsLoading(false)
        setOrganizationsReady(false)
        return
      }

      if (isSuperAdmin) {
        unsubscribe = onSnapshot(
          query(collection(db, ORG_COLLECTION), where('status', '==', 'active')),
          (snapshot) => {
            resetRetry()
            console.debug('[PartnerDashboard] Super admin organizations loaded', {
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
            if (!isMounted) return
            setOrganizations(scoped)
            setOrganizationsLoading(false)
            setOrganizationsReady(true)
            setLastOrganizationsSuccessAt(new Date())
          },
          (error) => {
            console.error('Failed to load organizations', error)
            scheduleRetry(error)
          },
        )
        return
      }

      unsubscribe = listenToAssignedOrganizations(
        user.uid,
        (assignedOrgs) => {
          resetRetry()
          const assignedIds = assignedOrganizations.filter(Boolean)
          const returnedIds = assignedOrgs.map((org) => org.id).filter(Boolean) as string[]
          const missingAssignments = assignedIds.filter((id) => !returnedIds.includes(id))
          const unexpectedAssignments = returnedIds.filter((id) => !assignedIds.includes(id))
          if (assignedOrganizations.length && !assignedOrgs.length) {
            console.warn('[PartnerDashboard] Assigned organizations missing from Firestore results', {
              assignments: assignedOrganizations,
            })
          } else if (missingAssignments.length) {
            console.warn('[PartnerDashboard] Some assigned organizations could not be resolved', {
              missingAssignments,
              assignments: assignedIds,
            })
          }
          if (unexpectedAssignments.length) {
            console.warn('[PartnerDashboard] Received organizations not present in assignments', {
              unexpectedAssignments,
              assignments: assignedIds,
            })
          }
          console.debug('[PartnerDashboard] Assigned organizations loaded', {
            count: assignedOrgs.length,
            organizations: assignedOrgs.map((org) => ({ id: org.id, code: org.code, name: org.name })),
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
          if (!isMounted) return
          setOrganizations(scoped)
          setOrganizationsLoading(false)
          setOrganizationsReady(true)
          setLastOrganizationsSuccessAt(new Date())
        },
        {
          status: 'active',
          onError: (error) => {
            console.error('Failed to listen for assigned organizations', error)
            scheduleRetry(error)
          },
        },
      )
    }

    void subscribe()

    return () => {
      isMounted = false
      if (retryTimeout) clearTimeout(retryTimeout)
      if (unsubscribe) unsubscribe()
    }
  }, [assignedOrganizations, assignmentKey, isSuperAdmin, organizationsRefreshIndex, profileStatus, user?.uid])

  useEffect(() => {
    if (profileStatus !== 'ready') {
      return
    }
    if (!organizations.length || !organizationIdsKey) return undefined
    let isMounted = true

    console.debug('[PartnerDashboard] Setting up organization stats listeners', {
      organizationIdsKey,
      count: organizations.length,
    })

    const updateStats = async () => {
      try {
        await updateOrganizationStatisticsBatch(organizations)
      } catch (error) {
        console.error('Failed to update organization statistics', error)
      }
    }

    void updateStats()

    const unsubscribers = organizations.map((org) =>
      listenToOrganizationStatsUpdates(
        { id: org.id, code: org.code || org.id || '' },
        {
          onError: (error) => {
            if (!isMounted) return
            console.error('Failed to refresh organization stats', error)
          },
        },
      ),
    )

    return () => {
      isMounted = false
      console.debug('[PartnerDashboard] Cleaning up organization stats listeners', {
        organizationIdsKey,
      })
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [organizationIdsKey, profileStatus])
=======
    const selected = selectedOrg.toLowerCase()
    const stillValid = organizations.some(
      (org) =>
        org.code?.toLowerCase() === selected || org.id?.toLowerCase() === selected
    )

    if (!stillValid) {
      setSelectedOrg('all')
    }
  }, [organizations, organizationsLoading, profileStatus, selectedOrg])
>>>>>>> Journeys

  // Log unauthorized access attempts
  useEffect(() => {
    if (profileStatus !== 'ready') return
    if (isSuperAdmin || selectedOrg === 'all') return

    const hasAccess =
      assignedOrgKeys.size > 0 &&
      Array.from(selectedOrgKeys).some((key) => assignedOrgKeys.has(key))

    if (hasAccess) return

    const selectedKey = selectedOrg.toLowerCase()
    if (!user?.uid || lastAccessAttempt.current === selectedKey) return

    lastAccessAttempt.current = selectedKey
    void logOrganizationAccessAttempt({
      userId: user.uid,
      organizationCode: selectedKey,
      reason: 'partner_dashboard_selection',
    })
  }, [assignedOrgKeys, isSuperAdmin, profileStatus, selectedOrg, selectedOrgKeys, user?.uid])

  // Notifications subscription
  useEffect(() => {
<<<<<<< HEAD
    if (profileStatus !== 'ready') {
      return
    }
    if (selectedOrg === 'all') return
    if (organizationsLoading) return
    const selected = selectedOrg.toLowerCase()
    const stillValid = organizations.some(
      (org) => org.code?.toLowerCase() === selected || org.id?.toLowerCase() === selected,
    )
    if (!stillValid) {
      setSelectedOrg('all')
    }
  }, [organizations, organizationsLoading, selectedOrg])

  const fetchWeeklyPointsByUser = async (userIds: string[]) => {
    const pointsByUser: Record<string, WeeklyPointsRecord[]> = {}
    const batches = []
    for (let i = 0; i < userIds.length; i += 10) {
      batches.push(userIds.slice(i, i + 10))
    }

    for (const batch of batches) {
      const weeklyQuery = query(collectionGroup(db, 'weekly_points'), where('user_id', 'in', batch))
      const weeklySnapshot = await getDocs(weeklyQuery)
      weeklySnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as WeeklyPointsRecord
        if (!data.user_id) return
        pointsByUser[data.user_id] = [...(pointsByUser[data.user_id] || []), data]
      })
    }

    if (!Object.keys(pointsByUser).length && userIds.length) {
      // Fallback to top-level weekly_points collection for legacy data
      for (const batch of batches) {
        const legacyQuery = query(collection(db, 'weekly_points'), where('user_id', 'in', batch))
        const legacySnapshot = await getDocs(legacyQuery)
        legacySnapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as WeeklyPointsRecord
          if (!data.user_id) return
          pointsByUser[data.user_id] = [...(pointsByUser[data.user_id] || []), data]
        })
      }
    }

    return pointsByUser
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
    companyId?: string
    organizationId?: string
    lastActiveAt?: unknown
    last_active_at?: unknown
    lastActive?: unknown
    last_active?: unknown
    createdAt?: unknown
    created_at?: unknown
    role?: PartnerUser['role']
    totalPoints?: number
    nudgeResponseScore?: number
  }

  useEffect(() => {
    if (profileStatus !== 'ready') {
      return
    }
    // Remove hard dependency - allow users to load in parallel with organizations
    // We'll filter by organization scope after both are loaded
    let isMounted = true
    let retryTimeout: ReturnType<typeof setTimeout> | undefined
    let unsubscribe: (() => void) | undefined

    setUsersLoading(true)
    setUsersError(null)

    const resetRetry = () => {
      usersRetryAttempts.current = 0
    }

    const scheduleRetry = (error: unknown) => {
      if (!isMounted) return
      const maxRetries = 3
      const nextAttempt = usersRetryAttempts.current + 1
      if (nextAttempt > maxRetries) {
        setUsers([])
        setUsersError(formatFirestoreError(error, 'Unable to load user data. Please try again.'))
        setUsersLoading(false)
        return
      }
      usersRetryAttempts.current = nextAttempt
      const delay = Math.min(1000 * 2 ** (nextAttempt - 1), 8000)
      console.warn('[PartnerDashboard] Retrying users subscription', { attempt: nextAttempt, delay })
      setUsersError(formatFirestoreError(error, `Unable to load users. Retrying (${nextAttempt}/${maxRetries})...`))
      retryTimeout = setTimeout(() => {
        if (!isMounted) return
        subscribe()
      }, delay)
    }

    const subscribe = () => {
      unsubscribe = onSnapshot(
        USERS_QUERY,
        async (snapshot) => {
          try {
            resetRetry()
            const seenUserIds = new Set<string>()
            const filteredDocs = snapshot.docs.filter((docSnap) => {
              if (seenUserIds.has(docSnap.id)) return false
              seenUserIds.add(docSnap.id)

              const data = docSnap.data() as FirestorePartnerUser
              const userOrgKeys = [
                data.companyCode,
                data.company_code,
                data.companyId,
                data.organizationId,
              ]
                .filter((value): value is string => !!value)
                .map((value) => value.toLowerCase())

              // Only filter by organization scope if organizations are ready
              // This allows users to load even while organizations are still loading
              if (organizationsReady) {
                if (
                  !isSuperAdmin &&
                  assignedOrgKeys.size > 0 &&
                  !userOrgKeys.some((key) => assignedOrgKeys.has(key))
                ) {
                  return false
                }

                if (
                  selectedOrg !== 'all' &&
                  selectedOrg &&
                  !userOrgKeys.some((key) => selectedOrgKeys.has(key))
                ) {
                  return false
                }
              }

              return true
            })

            const userIds = filteredDocs.map((docSnap) => docSnap.id)
            const weeklyPoints = await fetchWeeklyPointsByUser(userIds)

            if (!isMounted) return

            const hydratedUsers: PartnerUser[] = []

            filteredDocs.forEach((docSnap) => {
              try {
                const data = docSnap.data() as FirestorePartnerUser

                const rawCompanyCode = data.companyCode || data.company_code || ''
                const rawOrganizationId = data.companyId || data.organizationId || ''
                const companyCode =
                  rawCompanyCode.trim().length > 0
                    ? rawCompanyCode.toLowerCase()
                    : rawOrganizationId
                      ? organizationLookup.get(rawOrganizationId.toLowerCase()) || rawOrganizationId.toLowerCase()
                      : ''
                const normalizedCreatedAt = normalizeTimestamp(data.createdAt || data.created_at)
                const normalizedRegistrationDate =
                  normalizeTimestamp(
                    data.registrationDate || data.registration_date || data.createdAt || data.created_at,
                  ) || undefined
                const normalizedProgramStart =
                  normalizeTimestamp(
                    data.programStartDate || data.program_start_date || normalizedRegistrationDate,
                  ) || normalizedRegistrationDate
                const normalizedLastActive =
                  normalizeTimestamp(
                    data.lastActiveAt ||
                      data.last_active_at ||
                      data.lastActive ||
                      data.last_active ||
                      normalizedRegistrationDate,
                  ) || new Date().toISOString()
                const currentWeek = getProgramWeekNumber(normalizedProgramStart || undefined)
                const progress = mapWeeklyPointsToProgress(weeklyPoints[docSnap.id] || [], currentWeek)
                const riskResult = calculateUserRiskStatus(
                  progress.current_week,
                  progress.earned_points,
                  progress.required_points,
                  data.nudgeResponseScore,
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
                ].filter((reason): reason is string => typeof reason === 'string' && reason.length > 0)

                const displayName =
                  data.name ||
                  data.fullName ||
                  data.full_name ||
                  [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
                  'Unknown User'

                hydratedUsers.push({
                  id: docSnap.id,
                  name: displayName,
                  fullName: data.fullName || data.full_name || displayName,
                  createdAt: normalizedCreatedAt || undefined,
                  lastActiveAt: normalizeTimestamp(data.lastActiveAt || data.last_active_at) || undefined,
                  programStartDate: normalizedProgramStart || undefined,
                  email: data.email || '',
                  companyCode,
                  organizationId: rawOrganizationId ? rawOrganizationId.toLowerCase() : undefined,
                  progressPercent,
                  currentWeek,
                  status: (data.accountStatus as PartnerUser['status']) || 'Active',
                  lastActive: normalizedLastActive,
                  riskStatus,
                  weeklyEarned,
                  weeklyRequired: weeklyRequirement,
                  role: data.role,
                  riskReasons,
                  registrationDate: normalizedRegistrationDate || undefined,
                  interventions: data.interventions || 0,
                })
              } catch (error) {
                console.error('[PartnerDashboard] Failed to transform user record', {
                  userId: docSnap.id,
                  error,
                })
              }
            })

            console.debug('[PartnerDashboard] Users loaded', { count: hydratedUsers.length })

            setUsers(hydratedUsers)
            setUsersLoading(false)
            setLastUsersSuccessAt(new Date())
          } catch (error) {
            console.error('[PartnerDashboard] Failed to process user snapshot', error)
            scheduleRetry(error)
          }
        },
        (error) => {
          if (!isMounted) return
          console.error('Failed to load users for partner dashboard', error)
          scheduleRetry(error)
        },
      )
    }

    subscribe()

    return () => {
      isMounted = false
      if (retryTimeout) clearTimeout(retryTimeout)
      if (unsubscribe) unsubscribe()
    }
  }, [
    assignedOrgKeys,
    isSuperAdmin,
    organizationLookup,
    organizationsReady, // Keep this to trigger re-filtering when orgs become ready
    profileStatus,
    selectedOrg,
    selectedOrgKeys,
    usersRefreshIndex,
  ])

  useEffect(() => {
    if (profileStatus !== 'ready') {
      return
    }
=======
    if (profileStatus !== 'ready') return
>>>>>>> Journeys
    if (!profile?.id) return

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('user_id', '==', profile.id),
      where('is_read', '==', false)
    )

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      setNotificationCount(snapshot.size)
    })

    return () => unsubscribe()
  }, [profile?.id, profileStatus])

  // ============================================================================
  // FIX #9: updateUserPoints now properly persists to Firestore
  // ============================================================================
  const updateUserPoints = useCallback(
    async (userId: string, delta: number, reason: string) => {
      if (!profile?.id) {
        logger.warn('[PartnerDashboard] Cannot update points: no profile ID')
        return
      }

      // Optimistic update for immediate UI feedback
      // Note: This will be reconciled when the Firestore snapshot updates
      // The real persistence happens through recordEngagementAction
      
      try {
        await recordEngagementAction({
          userId,
          actionLabel: reason,
          actorId: profile.id,
          actorName: profile.fullName ?? null,
          additionalData: {
            action_type: 'manual_points_adjustment',
            delta,
            // This should trigger a cloud function to update weekly_points
            requires_points_update: true,
          },
        })

        logger.debug('[PartnerDashboard] Points adjustment recorded', {
          userId,
          delta,
          reason,
        })
      } catch (error) {
        logger.error('[PartnerDashboard] Failed to record points adjustment', error)
        throw error // Re-throw so caller can handle
      }
    },
    [profile?.id, profile?.fullName]
  )

  // Data quality warnings
  const dataQualityWarnings = useMemo(() => {
    const warnings: DataWarning[] = []

    if (!organizationsLoading && !isSuperAdmin && !organizations.length) {
      warnings.push({
        message: 'No organizations are assigned to this account yet.',
        severity: 'warning',
      })
    }

    if (
      profileStatus === 'ready' &&
      assignedOrganizations.length > organizations.length &&
      organizations.length > 0
    ) {
      warnings.push({
        message:
          'Some assigned organizations could not be resolved. Please re-sync your profile.',
        severity: 'warning',
      })
    }

    const missingAssignments = users.filter((u) => !u.companyCode).length
    if (missingAssignments) {
      warnings.push({
        message: `${missingAssignments} learner${missingAssignments === 1 ? '' : 's'} missing organization assignment`,
        severity: 'warning',
      })
    }

    const missingPoints = users.filter(
      (u) => !u.weeklyRequired && !u.weeklyEarned
    ).length
    if (missingPoints) {
      warnings.push({
        message: `${missingPoints} learner${missingPoints === 1 ? ' is' : 's are'} missing weekly points data`,
        severity: 'warning',
      })
    }

    if (debugInfo && debugInfo.rejectedNoMatch > 0) {
      warnings.push({
        message: `${debugInfo.rejectedNoMatch} learner${debugInfo.rejectedNoMatch === 1 ? '' : 's'} filtered out due to organization key mismatch`,
        severity: 'warning',
      })
    }

    // FIX #3: Warn about query truncation
    if (hasQueryLimitWarning) {
      warnings.push({
        message:
          'You have access to more than 30 organizations. Some interventions may not be displayed.',
        severity: 'warning',
      })
    }

    return warnings
  }, [
    assignedOrganizations.length,
    debugInfo,
    hasQueryLimitWarning,
    isSuperAdmin,
    organizations.length,
    organizationsLoading,
    profileStatus,
    users,
  ])

  const assignedOrgCount = organizations.length || assignedOrganizations?.length || 0

  // Return loading state if profile not ready
  if (profileStatus !== 'ready') {
    return {
      assignedOrgCount: 0,
      assignedOrganizations: assignedOrganizations ?? [],
      atRiskUsers: [],
      dataQualityWarnings: [],
      engagementTrend: [],
      managedBreakdown: { active: 0, inactive: 0 },
      metrics: {
        activeMembers: 0,
        engagementRate: 0,
        newRegistrations: 0,
        managedCompanies: 0,
        deltas: {
          activeMembers: 'Initializing',
          engagementRate: 'Initializing',
          newRegistrations: 'Initializing',
          managedCompanies: 'Initializing',
        },
      },
      notificationCount: 0,
      organizations: [],
      organizationsError: null,
      organizationsLoading: true,
      organizationsReady: false,
      lastOrganizationsSuccessAt: null,
      profile,
      riskLevels: { engaged: 0, watch: 0, concern: 0, critical: 0 },
      selectedOrg,
      setSelectedOrg,
      usersError: null,
      usersLoading: true,
      lastUsersSuccessAt: null,
      updateUserPoints: async () => undefined,
      users: [],
      interventions: [],
      daysUntil,
      retryOrganizations,
      retryUsers,
    }
  }

  return {
    assignedOrgCount,
    assignedOrganizations: assignedOrganizations ?? [],
    atRiskUsers,
    dataQualityWarnings,
    engagementTrend,
    managedBreakdown,
    metrics,
    notificationCount,
    organizations,
    organizationsError,
    organizationsLoading,
    organizationsReady,
    lastOrganizationsSuccessAt,
    profile,
    riskLevels,
    selectedOrg,
    setSelectedOrg,
    usersError,
    usersLoading,
    lastUsersSuccessAt,
    updateUserPoints,
    users,
    interventions,
    daysUntil,
    retryOrganizations,
    retryUsers,
    debugInfo,
  }
}

export type PartnerDashboardData = ReturnType<typeof usePartnerDashboardData>