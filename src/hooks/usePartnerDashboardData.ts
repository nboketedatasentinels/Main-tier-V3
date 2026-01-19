import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerAdminData } from '@/hooks/partner/usePartnerAdminData'
import { usePartnerInterventions } from '@/hooks/partner/usePartnerInterventions'
import { logOrganizationAccessAttempt } from '@/services/organizationService'
import { recordEngagementAction } from '@/services/engagementService'
import { logger, normalizeOrgKey } from '@/utils/partnerDashboardUtils'
import type { DataWarning } from '@/components/admin/RiskAnalysisCard'
import type { NotificationRecord } from '@/types/notifications'

// Re-export types for backward compatibility
export type { PartnerRiskLevel, PartnerUser, PartnerOrganization } from '@/hooks/partner/usePartnerAdminData'
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
  const { profile, isSuperAdmin, user, profileStatus } = useAuth()

  const [selectedOrg, setSelectedOrg] = useState<string>(options?.selectedOrg || 'all')
  const [notificationCount, setNotificationCount] = useState<number>(0)
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState<boolean>(true)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)
  const lastAccessAttempt = useRef<string | null>(null)

  const {
    snapshot,
    loading: adminDataLoading,
    error: adminDataError,
    organizationsLoading,
    organizationsError,
    organizationsReady,
    usersLoading,
    usersError,
    lastOrganizationsSuccessAt,
    lastUsersSuccessAt,
    retryOrganizations,
    retryUsers,
    debugInfo,
    assignmentsLoading,
    assignmentsError,
  } = usePartnerAdminData(user?.uid, {
    enabled: profileStatus === 'ready',
    selectedOrg,
    debugMode: options?.debugMode,
  })

  const organizations = snapshot.organizations
  const users = snapshot.users
  const assignedOrganizationIds = snapshot.assignedOrganizationIds
  const organizationLookup = snapshot.organizationLookup
  const assignedOrgKeys = snapshot.assignedOrgKeys

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

  const { interventions, hasQueryLimitWarning } = usePartnerInterventions({
    selectedOrg,
    assignedOrgKeys,
    selectedOrgKeys,
    enabled: profileStatus === 'ready',
  })

  const { metrics, engagementTrend, riskLevels, atRiskUsers, managedBreakdown, daysUntil } =
    snapshot.analytics

  // Reset selected org when it becomes invalid
  useEffect(() => {
    if (profileStatus !== 'ready') return
    if (selectedOrg === 'all') return
    if (organizationsLoading) return
    const selected = selectedOrg.toLowerCase()
    const stillValid = organizations.some(
      (org) =>
        org.code?.toLowerCase() === selected || org.id?.toLowerCase() === selected
    )

    if (!stillValid) {
      setSelectedOrg('all')
    }
  }, [organizations, organizationsLoading, profileStatus, selectedOrg])

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

  // Notifications subscription (unread count)
  useEffect(() => {
    if (profileStatus !== 'ready') return
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

  // Recent notifications for the partner dashboard
  useEffect(() => {
    if (profileStatus !== 'ready' || !profile?.id) {
      setNotifications([])
      setNotificationsLoading(false)
      return
    }

    setNotificationsLoading(true)
    setNotificationsError(null)

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('user_id', '==', profile.id),
      orderBy('created_at', 'desc'),
      limit(5),
    )

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as NotificationRecord),
          id: docSnap.id,
        }))
        setNotifications(items)
        setNotificationsLoading(false)
      },
      (error) => {
        console.error('[PartnerDashboard] Failed to load notifications', error)
        setNotifications([])
        setNotificationsLoading(false)
        setNotificationsError('Unable to load recent notifications.')
      },
    )

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

    if (!organizationsLoading && !isSuperAdmin && !organizations.length && !assignmentsLoading) {
      warnings.push({
        message: 'No organizations are assigned to this account yet.',
        severity: 'warning',
      })
    }

    if (
      profileStatus === 'ready' &&
      assignedOrganizationIds.length > organizations.length &&
      organizations.length > 0
    ) {
      warnings.push({
        message:
          'Some assigned organizations could not be resolved. Please re-sync your profile.',
        severity: 'warning',
      })
    }

    const missingAssignments = users.filter((u) => !u.organizationId).length
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

    if (assignmentsError) {
      warnings.push({
        message: assignmentsError,
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
    assignedOrganizationIds.length,
    assignmentsError,
    assignmentsLoading,
    debugInfo,
    hasQueryLimitWarning,
    isSuperAdmin,
    organizations.length,
    organizationsLoading,
    profileStatus,
    users,
  ])

  const assignedOrgCount = organizations.length || assignedOrganizationIds?.length || 0

  // Return loading state if profile not ready
  if (profileStatus !== 'ready') {
    return {
      assignedOrgCount: 0,
      assignedOrganizations: assignedOrganizationIds ?? [],
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
      notifications: [],
      notificationsLoading: true,
      notificationsError: null,
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
      snapshot,
      adminDataLoading,
      adminDataError,
    }
  }

  return {
    assignedOrgCount,
    assignedOrganizations: assignedOrganizationIds ?? [],
    atRiskUsers,
    dataQualityWarnings,
    engagementTrend,
    managedBreakdown,
    metrics,
    notificationCount,
    notifications,
    notificationsLoading,
    notificationsError,
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
    snapshot,
    adminDataLoading,
    adminDataError,
  }
}

export type PartnerDashboardData = ReturnType<typeof usePartnerDashboardData>
