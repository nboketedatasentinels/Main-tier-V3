import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout'
import { OverviewPage } from '@/pages/super-admin/OverviewPage'
import { OrganizationManagementPage } from '@/pages/super-admin/OrganizationManagementPage'
import { ReportsAnalyticsPage } from '@/pages/super-admin/ReportsAnalyticsPage'
import { UserManagementPage } from '@/pages/super-admin/UserManagementPage'
import { AdminOversightPage } from '@/pages/super-admin/AdminOversightPage'
import { ApprovalCenterPage } from '@/pages/super-admin/ApprovalCenterPage'
import {
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
import {
  DASHBOARD_TABS,
  buildDashboardSearchForNavigation,
  consumeCreateIntentFromSearch,
  resolveDashboardTabFromSearch,
} from './superAdminDashboardRouting'

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
  const { profile, profileStatus, lastProfileLoadAt, refreshProfile, effectiveRole } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const adminName = profile?.fullName || profile?.firstName || 'Admin'
  const toast = useToast()

  const [activePage, setActivePage] = useState<string>('overview')
  const [metrics, setMetrics] = useState<SuperAdminDashboardMetrics>(defaultMetrics)
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
  const isSuperAdminView = effectiveRole === 'super_admin'
  const {
    requests: upgradeRequests,
    loading: upgradeRequestsLoading,
    error: upgradeRequestsError,
    refetch: refetchUpgradeRequests,
  } = useAllUpgradeRequests({ enabled: isSuperAdminView })
  const { notifications: upgradeNotifications, unreadCount: unreadUpgradeCount } = useAdminNotifications({
    role: 'super_admin',
    enabled: isSuperAdminView,
    filters: ['upgrade_request'],
  })

  const coreStreamsLoadedRef = useRef({
    metrics: false,
    risk: false,
    registrationTrend: false,
    userGrowthTrend: false,
  })

  const sideStreamsLoadedRef = useRef({
    verificationRequests: false,
    registrations: false,
    systemAlerts: false,
    taskNotifications: false,
  })

  useEffect(() => {
    const nextTab = resolveDashboardTabFromSearch(location.search)
    setActivePage(nextTab)
  }, [location.search])

  useEffect(() => {
    if (!isSuperAdminView) {
      setLoading(false)
      setStreamsLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    coreStreamsLoadedRef.current = {
      metrics: false,
      risk: false,
      registrationTrend: false,
      userGrowthTrend: false,
    }

    const unsubscribers: Array<() => void> = []
    const markCoreStreamLoaded = (key: keyof typeof coreStreamsLoadedRef.current) => {
      if (coreStreamsLoadedRef.current[key]) return
      coreStreamsLoadedRef.current[key] = true
      if (Object.values(coreStreamsLoadedRef.current).every(Boolean)) {
        setLoading(false)
      }
    }
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
          markCoreStreamLoaded('metrics')
        },
        undefined,
        (err) => handleError('Unable to load super admin data from Firebase', err),
      ),
    )

    unsubscribers.push(
      listenToEngagementRiskAggregates(
        (aggregate) => {
          setRiskAggregate(aggregate)
          markCoreStreamLoaded('risk')
        },
        (err) => handleError('Unable to load engagement risk data from Firebase', err),
      ),
    )

    unsubscribers.push(
      listenToRegistrationTrend(
        (trend) => {
          setRegistrationTrend(trend)
          markCoreStreamLoaded('registrationTrend')
        },
        14,
        (err) => handleError('Unable to load registration trend from Firebase', err),
      ),
    )

    unsubscribers.push(
      listenToUserGrowthTrend(
        (trend) => {
          setUserGrowthTrend(trend)
          markCoreStreamLoaded('userGrowthTrend')
        },
        30,
        (err) => handleError('Unable to load user growth trend from Firebase', err),
      ),
    )

    return () => unsubscribers.forEach((unsub) => unsub())
  }, [isSuperAdminView, refreshIndex, toast])

  useEffect(() => {
    if (!isSuperAdminView) {
      setStreamsLoading(false)
      return
    }
    setStreamsLoading(true)
    sideStreamsLoadedRef.current = {
      verificationRequests: false,
      registrations: false,
      systemAlerts: false,
      taskNotifications: false,
    }

    const unsubscribers: Array<() => void> = []
    const markSideStreamLoaded = (key: keyof typeof sideStreamsLoadedRef.current) => {
      if (sideStreamsLoadedRef.current[key]) return
      sideStreamsLoadedRef.current[key] = true
      if (Object.values(sideStreamsLoadedRef.current).every(Boolean)) {
        setStreamsLoading(false)
      }
    }
    const handleSideStreamError = (
      streamKey: keyof typeof sideStreamsLoadedRef.current,
      message: string,
      err: unknown,
    ) => {
      console.error(err)
      markSideStreamLoaded(streamKey)
      setError(message)
      toast({ title: 'Failed to load dashboard', status: 'error' })
    }

    unsubscribers.push(
      listenToVerificationRequests(
        (items) => {
          setVerificationRequests(items)
          markSideStreamLoaded('verificationRequests')
        },
        (err) =>
          handleSideStreamError(
            'verificationRequests',
            'Unable to load verification requests from Firebase.',
            err,
          ),
      ),
    )

    unsubscribers.push(
      listenToRegistrations(
        (items) => {
          setRegistrations(items)
          markSideStreamLoaded('registrations')
        },
        (err) =>
          handleSideStreamError(
            'registrations',
            'Unable to load registration stream from Firebase.',
            err,
          ),
      ),
    )

    unsubscribers.push(
      listenToSystemAlerts(
        (items) => {
          setSystemAlerts(items)
          markSideStreamLoaded('systemAlerts')
        },
        (err) => handleSideStreamError('systemAlerts', 'Unable to load system alerts from Firebase.', err),
      ),
    )

    unsubscribers.push(
      listenToTaskNotifications(
        (items) => {
          setTaskNotifications(items)
          markSideStreamLoaded('taskNotifications')
        },
        (err) =>
          handleSideStreamError(
            'taskNotifications',
            'Unable to load task notifications from Firebase.',
            err,
          ),
      ),
    )

    return () => unsubscribers.forEach((unsub) => unsub())
  }, [isSuperAdminView, toast])

  useEffect(() => {
    if (!loading && !error) {
      setLastEngagementSuccessAt(new Date())
    }
  }, [error, loading, metrics, registrationTrend, riskAggregate, userGrowthTrend])

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
    const nextPage = DASHBOARD_TABS.has(key) ? key : 'overview'
    setActivePage(nextPage)

    navigate(
      {
        pathname: location.pathname,
        search: buildDashboardSearchForNavigation(location.search, nextPage),
      },
      { replace: false },
    )
  }

  const handleCreateIntentConsumed = () => {
    const params = new URLSearchParams(location.search)
    if (params.get('create') !== 'true') return
    navigate(
      {
        pathname: location.pathname,
        search: consumeCreateIntentFromSearch(location.search),
      },
      { replace: true },
    )
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
        return (
          <OrganizationManagementPage
            adminName={adminName}
            adminId={profile?.id}
            openCreateOnMount={new URLSearchParams(location.search).get('create') === 'true'}
            onCreateIntentConsumed={handleCreateIntentConsumed}
          />
        )
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
