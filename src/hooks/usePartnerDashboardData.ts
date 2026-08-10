import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerInterventions } from '@/hooks/partner/usePartnerInterventions'
import { usePartnerMetrics } from '@/hooks/partner/usePartnerMetrics'
import { usePartnerAdminData as usePartnerAdminSnapshotData } from '@/hooks/partner/usePartnerAdminData'
import { logOrganizationAccessAttempt } from '@/services/organizationService'
import { listenToUserNotifications } from '@/services/notificationService'
import { recordEngagementAction } from '@/services/engagementService'
import { adjustUserPointsByPartner } from '@/services/pointsService'
import { notifySupabaseUser } from '@/services/notificationService'
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

  // Keep internal state in sync when the caller passes a controlled
  // `options.selectedOrg` (e.g. URL-driven shared org selection across
  // partner pages). Without this, only the initial value is honored.
  useEffect(() => {
    if (options?.selectedOrg === undefined) return
    if (options.selectedOrg === selectedOrg) return
    setSelectedOrg(options.selectedOrg || 'all')
  }, [options?.selectedOrg, selectedOrg])

  const [rawNotifications, setRawNotifications] = useState<NotificationRecord[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState<boolean>(true)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)
  const lastAccessAttempt = useRef<string | null>(null)
  const partnerId = profileStatus === 'ready' ? user?.uid ?? null : null

  const {
    snapshot: adminSnapshot,
    loading: adminDataLoading,
    error: adminDataError,
    debugInfo,
    retryOrganizations,
    retryUsers,
  } = usePartnerAdminSnapshotData(partnerId, {
    debugMode: options?.debugMode,
    selectedOrg,
  })

  const assignedOrganizationIds = useMemo(
    () => adminSnapshot?.assignedOrganizationIds ?? [],
    [adminSnapshot?.assignedOrganizationIds],
  )

  const organizations = useMemo(() => {
    if (!adminSnapshot?.organizations?.length) return []
    return adminSnapshot.organizations.map((org) => ({
      id: org.id,
      code: org.code || org.id || '',
      name: org.name || org.code || org.id || 'Unknown organization',
      status: (org.status as 'active' | 'watch' | 'paused') || 'active',
      activeUsers: (org as { activeUsers?: number }).activeUsers ?? 0,
      newThisWeek: (org as { newThisWeek?: number }).newThisWeek ?? 0,
      lastActive: (org as { lastActive?: string }).lastActive,
      tags: (org as { tags?: string[] }).tags || [],
      warning: !org.name || !org.code ? 'Organization details incomplete.' : undefined,
      journeyType: org.journeyType,
      cohortStartDate: org.cohortStartDate,
    }))
  }, [adminSnapshot?.organizations])

  const users = useMemo(() => adminSnapshot?.users ?? [], [adminSnapshot?.users])

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

  const organizationsReady = !adminDataLoading && !adminDataError

  const assignedOrgKeys = useMemo(() => {
    return adminSnapshot?.assignedOrgKeys ?? new Set<string>()
  }, [adminSnapshot?.assignedOrgKeys])

  const { metrics, engagementTrend, riskLevels, atRiskUsers, managedBreakdown, daysUntil } =
    usePartnerMetrics({ users, organizations })

  const snapshot = useMemo(
    () => ({
      partnerId: adminSnapshot?.partnerId ?? user?.uid ?? null,
      assignments: adminSnapshot?.assignments ?? [],
      assignedOrganizationIds,
      organizations,
      users,
      analytics: {
        metrics,
        engagementTrend,
        riskLevels,
        atRiskUsers,
        managedBreakdown,
        daysUntil,
      },
      organizationLookup,
      assignedOrgKeys,
    }),
    [
      adminSnapshot?.partnerId,
      adminSnapshot?.assignments,
      assignedOrgKeys,
      assignedOrganizationIds,
      atRiskUsers,
      daysUntil,
      engagementTrend,
      managedBreakdown,
      metrics,
      organizationLookup,
      organizations,
      riskLevels,
      user?.uid,
      users,
    ],
  )

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

  const organizationsLoading = adminDataLoading
  const organizationsError = adminDataError
  const usersLoading = adminDataLoading
  const usersError = adminDataError
  const assignmentsLoading = adminDataLoading
  const assignmentsError = adminDataError
  const lastOrganizationsSuccessAt = null
  const lastUsersSuccessAt = adminSnapshot?.usersFetchedAt ?? null
  // Reset selected org when it becomes invalid.
  //
  // Guard on `organizations.length`: an EMPTY list means "not resolved yet /
  // partner has no assignment", NOT "the selection is invalid". Without this
  // guard, a partner landing on ?org=<id> they aren't assigned to hit an
  // infinite ping-pong: this effect reset selectedOrg to 'all', the sync effect
  // above forced it back to the URL id, and round it went - re-rendering the
  // whole dashboard on every tick (visible twitch + "form field id/name" flood).
  // Only treat a selection as invalid when we actually have an org list to
  // validate it against.
  useEffect(() => {
    if (profileStatus !== 'ready') return
    if (selectedOrg === 'all') return
    if (organizationsLoading) return
    if (organizations.length === 0) return
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

  // Org-scoping helper: when the partner picks a single org from the dropdown,
  // notifications without org tagging still pass through (partner-personal).
  // Notifications WITH org tagging only show if they match the selected org.
  // Tagging is read flexibly from metadata since notifications across the
  // codebase use different field names (orgId/companyId/organizationId/companyCode).
  const matchesSelectedOrg = useCallback(
    (notification: NotificationRecord): boolean => {
      if (!selectedOrg || selectedOrg === 'all') return true
      const meta = (notification.metadata ?? {}) as Record<string, unknown>
      const tags = [meta.orgId, meta.organizationId, meta.companyId, meta.companyCode]
        .map((value) => (typeof value === 'string' ? value.toLowerCase() : ''))
        .filter(Boolean)
      // Untagged → assume partner-personal, keep visible.
      if (tags.length === 0) return true
      const target = selectedOrg.toLowerCase()
      const targetMapped = organizationLookup.get(target)
      return tags.some((tag) => tag === target || (typeof targetMapped === 'string' && tag === targetMapped))
    },
    [selectedOrg, organizationLookup],
  )

  // ONE stable notifications subscription per user. It must NOT depend on
  // matchesSelectedOrg (which changes when the org dropdown / org list changes):
  // re-subscribing on every filter change tore down + recreated the Supabase
  // channel and re-fetched on each render, flooding the browser
  // (ERR_INSUFFICIENT_RESOURCES). We store the raw set and derive the filtered
  // list + unread count with memos below, so changing the filter never touches
  // the subscription.
  useEffect(() => {
    if (profileStatus !== 'ready' || !profile?.id) {
      setRawNotifications([])
      setNotificationsLoading(false)
      setNotificationsError(null)
      return
    }

    setNotificationsLoading(true)
    setNotificationsError(null)

    const unsubscribe = listenToUserNotifications(
      profile.id,
      (all) => {
        setRawNotifications(all)
        setNotificationsLoading(false)
      },
      (error) => {
        logger.error('[PartnerDashboard] Failed to load notifications', error)
        setRawNotifications([])
        setNotificationsLoading(false)
        setNotificationsError('Unable to load recent notifications.')
      },
    )

    return () => unsubscribe()
  }, [profile?.id, profileStatus])

  // Derived (org-filtered) views - recompute cheaply when the filter or data
  // changes, without re-subscribing.
  const notifications = useMemo(
    () => rawNotifications.filter(matchesSelectedOrg).slice(0, 5),
    [rawNotifications, matchesSelectedOrg],
  )
  const notificationCount = useMemo(
    () => rawNotifications.filter((n) => n.is_read === false).filter(matchesSelectedOrg).length,
    [rawNotifications, matchesSelectedOrg],
  )

  // Partner-only manual add/reduce via SECURITY DEFINER RPC + audit trail.
  const updateUserPoints = useCallback(
    async (userId: string, delta: number, reason: string) => {
      if (!profile?.id) {
        logger.warn('[PartnerDashboard] Cannot update points: no profile ID')
        return
      }
      if (!Number.isFinite(delta) || delta === 0) {
        throw new Error('Enter a non-zero points amount')
      }
      const cleanReason = reason.trim()
      if (cleanReason.length < 3) {
        throw new Error('Add a short reason so the learner knows why points changed')
      }

      try {
        const result = await adjustUserPointsByPartner({
          uid: userId,
          delta,
          reason: cleanReason,
        })

        // Client-side notify as a backup if the RPC notify block soft-failed.
        // Deduped by messaging: same title/body the learner should see once
        // from RPC; this only runs when adjust succeeded.
        const applied = result.delta
        if (result.adjusted && applied !== 0) {
          const absPts = Math.abs(applied).toLocaleString()
          try {
            await notifySupabaseUser({
              userId,
              type: 'approval',
              category: 'important_updates',
              title:
                applied > 0
                  ? `Your points increased by ${absPts}`
                  : `Your points decreased by ${absPts}`,
              message:
                applied > 0
                  ? `Your partner added ${absPts} points to your dashboard.\n\nReason: ${cleanReason}`
                  : `Your partner removed ${absPts} points from your dashboard.\n\nReason: ${cleanReason}`,
              relatedId: 'partner_manual_adjustment',
              data: {
                priority: 'push',
                delta: applied,
                source: 'partner_manual_adjustment',
                reason: cleanReason,
                partnerId: profile.id,
                totalPoints: result.totalPoints,
              },
            })
          } catch (notifyError) {
            logger.warn(
              '[PartnerDashboard] Points adjusted but learner notification failed',
              notifyError,
            )
          }
        }

        // Audit trail (non-fatal if engagement logging fails).
        try {
          await recordEngagementAction({
            userId,
            actionLabel: cleanReason,
            actorId: profile.id,
            actorName: profile.fullName ?? null,
            additionalData: {
              action_type: 'manual_points_adjustment',
              delta: result.delta,
              requested_delta: delta,
              total_points: result.totalPoints,
              reason: cleanReason,
              requires_points_update: false,
            },
          })
        } catch (auditError) {
          logger.warn('[PartnerDashboard] Points adjusted but audit log failed', auditError)
        }

        logger.debug('[PartnerDashboard] Points adjustment applied', {
          userId,
          delta: result.delta,
          totalPoints: result.totalPoints,
          reason: cleanReason,
        })
      } catch (error) {
        logger.error('[PartnerDashboard] Failed to adjust points', error)
        throw error
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

    const hasPointsData = users.some((u) => u.weeklyRequired > 0 || u.weeklyEarned > 0)
    if (hasPointsData) {
      const missingPoints = users.filter(
        (u) => !u.weeklyRequired && !u.weeklyEarned
      ).length
      if (missingPoints) {
        warnings.push({
          message: `${missingPoints} learner${missingPoints === 1 ? ' is' : 's are'} missing weekly points data`,
          severity: 'warning',
        })
      }
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
      debugInfo,
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
