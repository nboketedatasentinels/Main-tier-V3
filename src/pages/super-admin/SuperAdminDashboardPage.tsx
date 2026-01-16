import React, { useMemo, useState } from 'react'
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout'
import { OverviewPage } from '@/pages/super-admin/OverviewPage'
import { OrganizationManagementPage } from '@/pages/super-admin/OrganizationManagementPage'
import { ReportsAnalyticsPage } from '@/pages/super-admin/ReportsAnalyticsPage'
import { UserManagementPage } from '@/pages/super-admin/UserManagementPage'
import { PartnerOversightPage } from '@/pages/super-admin/PartnerOversightPage'
import { ApprovalCenterPage } from '@/pages/super-admin/ApprovalCenterPage'
import { useAllUpgradeRequests } from '@/hooks/admin/useAdminUpgradeRequests'
import { useOperatorDashboardData } from '@/hooks/operator/useOperatorDashboardData'
import type { AdminHealthItem } from '@/components/admin/AdminDataHealthPanel'
import type { RiskLevel, RiskReason } from '@/components/admin/RiskAnalysisCard'

export const SuperAdminDashboardPage: React.FC = () => {
  const scope = 'super_admin' as const
  const vm = useOperatorDashboardData(scope)
  const [activePage, setActivePage] = useState('overview')

  const adminName = vm.profile?.fullName || vm.profile?.firstName || 'Super Admin'

  const {
    requests: upgradeRequests,
    loading: upgradeRequestsLoading,
    error: upgradeRequestsError,
    refetch: refetchUpgradeRequests,
  } = useAllUpgradeRequests()

  const riskLevels: RiskLevel[] = useMemo(() => ([
    { label: 'Engaged', count: vm.riskAggregate.riskBuckets.green || 0, color: 'green', reasons: ['Consistent logins'] },
    { label: 'Watch', count: vm.riskAggregate.riskBuckets.yellow || 0, color: 'yellow', reasons: ['Declining activity'] },
    { label: 'Concern', count: vm.riskAggregate.riskBuckets.orange || 0, color: 'orange', reasons: ['Low engagement score'] },
    { label: 'Critical', count: vm.riskAggregate.riskBuckets.red || 0, color: 'red', reasons: ['Inactive >30 days'] },
  ]), [vm.riskAggregate])

  const riskReasons: RiskReason[] = useMemo(() => ([
    { label: 'Low engagement score', count: vm.riskAggregate.riskBuckets.orange || 0, color: 'orange' },
    { label: 'Inactivity 30+ days', count: vm.riskAggregate.riskBuckets.red || 0, color: 'red' },
    { label: 'Watchlist', count: vm.riskAggregate.riskBuckets.yellow || 0, color: 'yellow' },
  ]), [vm.riskAggregate])

  const healthItems: AdminHealthItem[] = useMemo(() => ([
    {
      label: 'Profiles',
      status: vm.profileStatus === 'ready' ? 'healthy' : 'error',
      description: vm.profileStatus === 'ready'
        ? 'Identity and permissions loaded.'
        : 'Profile data still loading or unavailable.',
      lastSuccessAt: vm.lastProfileLoadAt,
      onRetry: vm.retryProfile,
    },
    {
      label: 'Upgrade requests',
      status: upgradeRequestsLoading ? 'loading' : upgradeRequestsError ? 'warning' : 'healthy',
      description: upgradeRequestsError
        ? 'Upgrade approvals delayed. Check Firestore rules.'
        : `Tracking ${upgradeRequests.length} request${upgradeRequests.length === 1 ? '' : 's'}.`,
      lastSuccessAt: null,
      onRetry: refetchUpgradeRequests,
    },
    {
      label: 'Realtime streams',
      status: vm.loading ? 'loading' : vm.error ? 'error' : 'healthy',
      description: vm.error ? vm.error : 'Live signals are updating.',
      lastSuccessAt: null,
      onRetry: vm.retryEngagement,
    },
  ]), [refetchUpgradeRequests, upgradeRequests.length, upgradeRequestsError, upgradeRequestsLoading, vm])

  const renderPage = () => {
    switch (activePage) {
      case 'organizations':
        return <OrganizationManagementPage adminName={adminName} adminId={vm.profile?.id} />
      case 'users':
        return <UserManagementPage />
      case 'approvals':
        return <ApprovalCenterPage />
      case 'admin-oversight':
        return <PartnerOversightPage adminName={adminName} adminId={vm.profile?.id} />
      case 'reports':
        return <ReportsAnalyticsPage metrics={vm.metrics} registrationTrend={vm.registrationTrend} userGrowthTrend={vm.userGrowthTrend} />
      case 'overview':
      default:
        return (
          <OverviewPage
            adminName={adminName}
            metrics={vm.metrics}
            registrationTrend={vm.registrationTrend}
            userGrowthTrend={vm.userGrowthTrend}
            riskLevels={riskLevels}
            riskReasons={riskReasons}
            systemAlerts={vm.systemAlerts}
            registrations={vm.registrations}
            verificationRequests={vm.verificationRequests}
            taskNotifications={vm.taskNotifications}
            activityLog={vm.activityLog}
            loading={vm.loading}
            error={vm.error}
            streamsLoading={vm.loading}
            onNavigate={setActivePage}
            healthItems={healthItems}
          />
        )
    }
  }

  return (
    <SuperAdminLayout
      adminName={adminName}
      avatarUrl={vm.profile?.avatarUrl}
      activeItem={activePage}
      onNavigate={setActivePage}
    >
      {renderPage()}
    </SuperAdminLayout>
  )
}
