import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout'
import { OverviewPage } from '@/pages/super-admin/OverviewPage'
import { OrganizationManagementPage } from '@/pages/super-admin/OrganizationManagementPage'
import { PlatformConfigurationPage } from '@/pages/super-admin/PlatformConfigurationPage'
import { ReportsAnalyticsPage } from '@/pages/super-admin/ReportsAnalyticsPage'
import { SecurityAuditPage } from '@/pages/super-admin/SecurityAuditPage'
import { SystemSettingsPage } from '@/pages/super-admin/SystemSettingsPage'
import { UserManagementPage } from '@/pages/super-admin/UserManagementPage'
import { AdminOversightPage } from '@/pages/super-admin/AdminOversightPage'
import {
  fetchAdminActivityLog,
  fetchDashboardMetrics,
  fetchEngagementRiskAggregates,
  fetchRegistrationTrend,
  fetchUserGrowthTrend,
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
  const { profile } = useAuth()
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

  const [registrationTrend, setRegistrationTrend] = useState<TrendPoint[]>([])
  const [userGrowthTrend, setUserGrowthTrend] = useState<TrendPoint[]>([])

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const [fetchedMetrics, risks, audit, registrationsData, growth] = await Promise.all([
        fetchDashboardMetrics(),
        fetchEngagementRiskAggregates(),
        fetchAdminActivityLog(),
        fetchRegistrationTrend(),
        fetchUserGrowthTrend(),
      ])
      setMetrics(fetchedMetrics)
      setRiskAggregate(risks)
      setActivityLog(audit)
      setRegistrationTrend(registrationsData)
      setUserGrowthTrend(growth)
    } catch (err) {
      console.error(err)
      setError('Unable to load super admin data from Firebase')
      toast({ title: 'Failed to load dashboard', status: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

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

  const renderPage = () => {
    switch (activePage) {
      case 'organizations':
        return <OrganizationManagementPage adminName={adminName} adminId={profile?.id} />
      case 'users':
        return <UserManagementPage />
      case 'admin-oversight':
        return <AdminOversightPage adminName={adminName} adminId={profile?.id} />
      case 'settings':
        return <SystemSettingsPage />
      case 'security':
        return <SecurityAuditPage />
      case 'reports':
        return <ReportsAnalyticsPage metrics={metrics} registrationTrend={registrationTrend} userGrowthTrend={userGrowthTrend} />
      case 'configuration':
        return <PlatformConfigurationPage />
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
            activityLog={activityLog}
            loading={loading}
            error={error}
            streamsLoading={streamsLoading}
            onNavigate={handleNavigate}
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
    >
      {renderPage()}
    </SuperAdminLayout>
  )
}
