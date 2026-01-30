import React, { useEffect, useMemo, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout'
import { OverviewPage } from '@/pages/super-admin/OverviewPage'
import { OrganizationManagementPage } from '@/pages/super-admin/OrganizationManagementPage'
import { ReportsAnalyticsPage } from '@/pages/super-admin/ReportsAnalyticsPage'
import { UserManagementPage } from '@/pages/super-admin/UserManagementPage'
import { AdminOversightPage } from '@/pages/super-admin/AdminOversightPage'
import { ApprovalCenterPage } from '@/pages/super-admin/ApprovalCenterPage'
import {
  listenToAdminActivityLog,
  listenToDashboardMetrics,
  listenToEngagementRiskAggregates,
  listenToRegistrationTrend,
  listenToUserGrowthTrend,
  listenToRegistrations,
  listenToSystemAlerts,
  listenToTaskNotifications,
  listenToVerificationRequests,
} from '@/services/superAdminService'
import {
  AdminActivityLogEntry,
  EngagementRiskAggregate,
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'
import { RiskLevel, RiskReason } from '@/components/admin/RiskAnalysisCard'
import { useAllUpgradeRequests } from '@/hooks/admin/useAdminUpgradeRequests'
import type { AdminHealthItem } from '@/components/admin/AdminDataHealthPanel'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { buildSuperAdminNavItems } from '@/utils/navigationItems'
import { PageTransitionLoader } from '@/components/PageTransitionLoader'

type TrendPoint = { label: string; value: number }

const defaultMetrics: SuperAdminDashboardMetrics = {
  organizationCount: 0,
  managedCompanies: 0,
  paidMembers: 0,
  activeMembers: 0,
  engagementRate: 0,
  newRegistrations: 0,
}

export const SuperAdminDashboard: React.FC = () => {
  const { profile, profileStatus, lastProfileLoadAt, refreshProfile } = useAuth()
  const adminName = profile?.fullName || profile?.firstName || 'Admin'
  const toast = useToast()

  const [activePage, setActivePage] = useState<string>('overview')
  const [metrics, setMetrics] = useState<SuperAdminDashboardMetrics>(defaultMetrics)
  const [activityLog, setActivityLog] = useState<AdminActivityLogEntry[]>([])
  const [riskAggregate, setRiskAggregate] = useState<EngagementRiskAggregate>({ total: 0, riskBuckets: {} })
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([])
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlertRecord[]>([])
  const [taskNotifications, setTaskNotifications] = useState<TaskNotificationRecord[]>([])
  const [streamsLoading, setStreamsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [lastEngagementSuccessAt, setLastEngagementSuccessAt] = useState<Date | null>(null)
  const [lastUpgradeSuccessAt, setLastUpgradeSuccessAt] = useState<Date | null>(null)
  const [lastUpgradeNotificationId, setLastUpgradeNotificationId] = useState<string | null>(null)

  const [registrationTrend, setRegistrationTrend] = useState<TrendPoint[]>([])
  const [userGrowthTrend, setUserGrowthTrend] = useState<TrendPoint[]>([])
  const {
    requests: upgradeRequests,
    loading: upgradeRequestsLoading,
    error: upgradeRequestsError,
    refetch: refetchUpgradeRequests,
  } = useAllUpgradeRequests()
  const { notifications: upgradeNotifications, unreadCount: unreadUpgradeCount } = useAdminNotifications({
    role: 'super_admin',
    filters: ['upgrade_request'],
  })

  useEffect(() => {
    setLoading(true)
    setError(null)

    const unsubscribers: Array<() => void> = []
    const handleError = (message: string, err: unknown) => {
      console.error(err)
      setError(message)
      toast({ title: 'Failed to load dashboard', status: 'error' })
      setLoading(false)
    }

    unsubscribers.push(
      listenToDashboardMetrics(
        (liveMetrics) => {
          setMetrics(liveMetrics)
          setLoading(false)
        },
        undefined,
        (err) => handleError('Unable to load super admin data from Firebase', err),
      ),
    )

    unsubscribers.push(
      listenToEngagementRiskAggregates(
        (aggregate) => {
          setRiskAggregate(aggregate)
          setLoading(false)
        },
        (err) => handleError('Unable to load engagement risk data from Firebase', err),
      ),
    )

    unsubscribers.push(
      listenToAdminActivityLog(
        (entries) => {
          setActivityLog(entries)
          setLoading(false)
        },
        10,
        (err) => handleError('Unable to load admin activity from Firebase', err),
      ),
    )

    unsubscribers.push(
      listenToRegistrationTrend(
        (trend) => {
          setRegistrationTrend(trend)
          setLoading(false)
        },
        14,
        (err) => handleError('Unable to load registration trend from Firebase', err),
      ),
    )

    unsubscribers.push(
      listenToUserGrowthTrend(
        (trend) => {
          setUserGrowthTrend(trend)
          setLoading(false)
        },
        30,
        (err) => handleError('Unable to load user growth trend from Firebase', err),
      ),
    )

    return () => unsubscribers.forEach((unsub) => unsub())
  }, [refreshIndex, toast])

  useEffect(() => {
    const unsubscribers: Array<() => void> = []

    unsubscribers.push(
      listenToVerificationRequests((items) => {
        setVerificationRequests(items)
        setStreamsLoading(false)
      }),
    )

    unsubscribers.push(
      listenToRegistrations((items) => {
        setRegistrations(items)
        setStreamsLoading(false)
      }),
    )

    unsubscribers.push(
      listenToSystemAlerts((items) => {
        setSystemAlerts(items)
        setStreamsLoading(false)
      }),
    )

    unsubscribers.push(
      listenToTaskNotifications((items) => {
        setTaskNotifications(items)
        setStreamsLoading(false)
      }),
    )

    return () => unsubscribers.forEach((unsub) => unsub())
  }, [])

  useEffect(() => {
    if (!loading && !error) {
      setLastEngagementSuccessAt(new Date())
    }
  }, [activityLog, error, loading, metrics, registrationTrend, riskAggregate, userGrowthTrend])

  useEffect(() => {
    if (!upgradeRequestsLoading && !upgradeRequestsError) {
      setLastUpgradeSuccessAt(new Date())
    }
  }, [upgradeRequestsError, upgradeRequestsLoading, upgradeRequests.length])

  useEffect(() => {
    if (!upgradeNotifications.length) return
    const latest = upgradeNotifications[0]
    if (latest.id === lastUpgradeNotificationId) return
    if (!latest.is_read) {
      toast({
        title: 'New upgrade request',
        description: latest.message,
        status: 'info',
        duration: 5000,
        isClosable: true,
      })
    }
    setLastUpgradeNotificationId(latest.id)
  }, [lastUpgradeNotificationId, toast, upgradeNotifications])

  const navSections = useMemo(() => {
    const sections = buildSuperAdminNavItems()
    return sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        badgeCount: item.key === 'approvals' ? unreadUpgradeCount : item.badgeCount,
      })),
    }))
  }, [unreadUpgradeCount])

  const riskLevels: RiskLevel[] = useMemo(() => {
    return [
      { label: 'Engaged', count: riskAggregate.riskBuckets.green || 0, color: 'green', reasons: ['Consistent logins'] },
      { label: 'Watch', count: riskAggregate.riskBuckets.yellow || 0, color: 'yellow', reasons: ['Declining activity'] },
      { label: 'Concern', count: riskAggregate.riskBuckets.orange || 0, color: 'orange', reasons: ['Low engagement score'] },
      { label: 'Critical', count: riskAggregate.riskBuckets.red || 0, color: 'red', reasons: ['Inactive >30 days'] },
    ]
  }, [riskAggregate])

  const riskReasons: RiskReason[] = useMemo(() => {
    return [
      { label: 'Low engagement score', count: riskAggregate.riskBuckets.orange || 0, color: 'orange' },
      { label: 'Inactivity 30+ days', count: riskAggregate.riskBuckets.red || 0, color: 'red' },
      { label: 'Watchlist', count: riskAggregate.riskBuckets.yellow || 0, color: 'yellow' },
    ]
  }, [riskAggregate])

  const handleNavigate = (key: string) => {
    setActivePage(key)
  }

  const retryEngagement = () => setRefreshIndex((prev) => prev + 1)
  const retryProfile = () => {
    void refreshProfile({ reason: 'super-admin-health-panel' })
  }

  const healthItems: AdminHealthItem[] = [
    {
      label: 'Profiles',
      status: profileStatus === 'ready' ? 'healthy' : 'error',
      description: profileStatus === 'ready'
        ? 'Admin identity and permissions are loaded.'
        : 'Profile data is still loading or unavailable.',
      lastSuccessAt: lastProfileLoadAt ? new Date(lastProfileLoadAt) : null,
      onRetry: retryProfile,
    },
    {
      label: 'Upgrade requests',
      status: upgradeRequestsLoading
        ? 'loading'
        : upgradeRequestsError
          ? 'warning'
          : 'healthy',
      description: upgradeRequestsError
        ? 'Upgrade approvals are delayed. Check permissions or Firestore rules.'
        : `Tracking ${upgradeRequests.length} request${upgradeRequests.length === 1 ? '' : 's'}.`,
      lastSuccessAt: lastUpgradeSuccessAt,
      onRetry: refetchUpgradeRequests,
    },
    {
      label: 'Engagement signals',
      status: loading
        ? 'loading'
        : error
          ? 'error'
          : 'healthy',
      description: error
        ? error
        : 'Engagement trends and risk signals are live.',
      lastSuccessAt: lastEngagementSuccessAt,
      onRetry: retryEngagement,
    },
  ]

  const renderPage = () => {
    switch (activePage) {
      case 'organizations':
        return <OrganizationManagementPage adminName={adminName} adminId={profile?.id} />
      case 'users':
        return <UserManagementPage />
      case 'approvals':
        return <ApprovalCenterPage />
      case 'admin-oversight':
        return <AdminOversightPage adminName={adminName} adminId={profile?.id} />
      case 'reports':
        return <ReportsAnalyticsPage metrics={metrics} registrationTrend={registrationTrend} userGrowthTrend={userGrowthTrend} />
      case 'overview':
      default:
        if (loading && !error) {
          return <PageTransitionLoader fullScreen={false} size="large" />
        }
        return (
          <OverviewPage
            adminName={adminName}
            metrics={metrics}
            registrationTrend={registrationTrend}
            userGrowthTrend={userGrowthTrend}
            riskLevels={riskLevels}
            riskReasons={riskReasons}
            systemAlerts={systemAlerts}
            registrations={registrations}
            verificationRequests={verificationRequests}
            taskNotifications={taskNotifications}
            activityLog={activityLog}
            loading={loading}
            error={error}
            streamsLoading={streamsLoading}
            onNavigate={handleNavigate}
            healthItems={healthItems}
          />
        )
    }
  }

  return (
    <SuperAdminLayout
      adminName={adminName}
      avatarUrl={profile?.avatarUrl}
      activeItem={activePage}
      onNavigate={handleNavigate}
      navSections={navSections}
    >
      {renderPage()}
    </SuperAdminLayout>
  )
}
