import React, { useState } from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'
import { PartnerLayout } from '@/layouts/PartnerLayout'
import { useOperatorDashboardData } from '@/hooks/operator/useOperatorDashboardData'
import { PartnerOverviewPage } from '@/pages/partner/PartnerOverviewPage'
import { PartnerApprovalCenterPage } from '@/pages/partner/PartnerApprovalCenterPage'
import { UserManagementPage } from '@/pages/super-admin/UserManagementPage'

export const PartnerDashboardPage: React.FC = () => {
  const vm = useOperatorDashboardData('partner')
  const [activePage, setActivePage] = useState<string>('overview')
  const [selectedOrg, setSelectedOrg] = useState<string>('all')

  const partnerName = vm.profile?.fullName || vm.profile?.firstName || 'Partner'

  // Map organizations from profile assignedOrganizations if available
  const organizations = (vm.profile?.assignedOrganizations || []).map((orgId: string) => ({
    code: orgId,
    name: orgId,
  }))

  const renderPage = () => {
    switch (activePage) {
      case 'approvals':
        return (
          <PartnerApprovalCenterPage
            requests={vm.verificationRequests}
            loading={vm.loading}
            error={vm.error}
          />
        )
      case 'learners':
        return <UserManagementPage />
      case 'at-risk':
        return (
          <Box p={8}>
            <Heading size="lg">At Risk Learners</Heading>
            <Text mt={4}>Risk analysis and intervention tools.</Text>
          </Box>
        )
      case 'reports':
        return (
          <Box p={8}>
            <Heading size="lg">Reports</Heading>
            <Text mt={4}>Partner performance and engagement reports.</Text>
          </Box>
        )
      case 'settings':
        return (
          <Box p={8}>
            <Heading size="lg">Settings</Heading>
            <Text mt={4}>Manage your partner profile and notifications.</Text>
          </Box>
        )
      case 'support':
        return (
          <Box p={8}>
            <Heading size="lg">Support</Heading>
            <Text mt={4}>Contact support at support@transformation4leaders.com</Text>
          </Box>
        )
      case 'overview':
      default:
        return (
          <PartnerOverviewPage
            partnerName={partnerName}
            alerts={vm.systemAlerts}
            pendingApprovals={vm.verificationRequests}
            loading={vm.loading}
            error={vm.error}
            onNavigate={(page) => setActivePage(page)}
          />
        )
    }
  }

  return (
    <PartnerLayout
      organizations={organizations}
      selectedOrg={selectedOrg}
      onSelectOrg={setSelectedOrg}
      notificationCount={vm.taskNotifications.length}
      activeItem={activePage}
      onNavigate={(key) => setActivePage(key)}
    >
      {renderPage()}
    </PartnerLayout>
  )
}
