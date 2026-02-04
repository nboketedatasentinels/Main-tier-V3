import React from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Card,
  CardBody,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  SimpleGrid,
  Skeleton,
  Spinner,
  Stack,
  useDisclosure,
} from '@chakra-ui/react'
import {
  Sparkles,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { AdminNotificationsList } from '@/components/admin/AdminNotificationsList'
import { AdminHealthItem } from '@/components/admin/AdminDataHealthPanel'
import {
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'

// Command Center Components
import { CommandCenterHeader } from './components/CommandCenterHeader'
import { CriticalActionInbox, ActionItem } from './components/CriticalActionInbox'
import { SystemHealthStrip, HealthKPI } from './components/SystemHealthStrip'
import { CollapsibleMetrics } from './components/CollapsibleMetrics'

type TrendPoint = { label: string; value: number }

type OverviewPageProps = {
  adminName: string
  metrics: SuperAdminDashboardMetrics
  registrationTrend: TrendPoint[]
  userGrowthTrend: TrendPoint[]
  systemAlerts: SystemAlertRecord[]
  registrations: RegistrationRecord[]
  verificationRequests: VerificationRequest[]
  taskNotifications: TaskNotificationRecord[]
  loading: boolean
  error: string | null
  streamsLoading: boolean
  onNavigate: (key: string) => void
  healthItems: AdminHealthItem[]
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  adminName,
  metrics,
  registrationTrend,
  userGrowthTrend,
  systemAlerts,
  registrations,
  verificationRequests,
  loading,
  error,
  onNavigate,
  healthItems,
}) => {
  const notificationsDrawer = useDisclosure()

  // Data mapping for Command Center
  const criticalActionItems: ActionItem[] = React.useMemo(() => {
    const items: ActionItem[] = []

    // Map system alerts (critical)
    systemAlerts
      .filter((a) => a.level === 'critical')
      .forEach((a) => {
        items.push({
          id: a.id,
          severity: 'critical',
          title: `Unauthorized access attempts detected: ${a.component || 'System'}`,
          timestamp: 'Just now',
          actionLabel: 'Review security logs',
          onAction: () => onNavigate('admin-oversight'),
          icon: <ShieldAlert size={20} />,
        })
      })

    // Map verification requests
    if (verificationRequests.length > 0) {
      items.push({
        id: 'verifications',
        severity: 'high',
        title: `${verificationRequests.length} pending verifications awaiting approval`,
        timestamp: 'Requires attention',
        actionLabel: 'Review now',
        onAction: () => onNavigate('approvals'),
        icon: <Sparkles size={20} />,
      })
    }

    // Map new registrations
    if (registrations.length > 0) {
      items.push({
        id: 'registrations',
        severity: 'medium',
        title: `${registrations.length} new registrations require review`,
        timestamp: 'Last 24h',
        actionLabel: 'Manage users',
        onAction: () => onNavigate('users'),
        icon: <Users size={20} />,
      })
    }

    return items
  }, [systemAlerts, verificationRequests, registrations, onNavigate])

  const healthKPIs: HealthKPI[] = React.useMemo(() => {
    const isIncident = healthItems.some((i) => i.status === 'error')
    const isDegraded = healthItems.some((i) => i.status === 'warning')

    return [
      {
        label: 'Platform Status',
        value: isIncident ? 'Incident' : isDegraded ? 'Degraded' : 'Stable',
        status: isIncident ? 'incident' : isDegraded ? 'degraded' : 'stable',
      },
      {
        label: 'Active Orgs',
        value: metrics.managedCompanies.toString(),
        status: 'stable',
        trend: 'up',
        trendValue: '+2',
      },
      {
        label: 'User Activity Health',
        value: `${Math.round(metrics.engagementRate * 100)}%`,
        status: metrics.engagementRate >= 0.7 ? 'stable' : 'degraded',
        trend: metrics.engagementRate >= 0.7 ? 'up' : 'down',
        trendValue: '5%',
      },
      {
        label: 'Security Events',
        value: systemAlerts.length.toString(),
        status: systemAlerts.length > 5 ? 'degraded' : 'stable',
      },
      {
        label: 'Automation Failures',
        value: '0',
        status: 'stable',
      },
    ]
  }, [healthItems, metrics, systemAlerts])

  return (
    <Stack spacing={8}>
      <CommandCenterHeader
        adminName={adminName}
        criticalAlertCount={systemAlerts.filter((a) => a.level === 'critical').length}
        lastSystemCheck={new Date()}
        onOpenNotifications={notificationsDrawer.onOpen}
      />

      {error && (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Stack spacing={6}>
          <Skeleton height="100px" borderRadius="xl" />
          <Skeleton height="200px" borderRadius="xl" />
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Skeleton height="150px" borderRadius="xl" />
            <Skeleton height="150px" borderRadius="xl" />
            <Skeleton height="150px" borderRadius="xl" />
          </SimpleGrid>
          <Flex justify="center" align="center" py={6}>
            <Spinner size="lg" />
          </Flex>
        </Stack>
      ) : (
        <>
          {/* ZONE 1 — CRITICAL ATTENTION */}
          <CriticalActionInbox items={criticalActionItems} />

          {/* ZONE 2 — SYSTEM HEALTH SNAPSHOT */}
          <SystemHealthStrip kpis={healthKPIs} />

          {/* ZONE 6 — SYSTEM METRICS (Collapsible) */}
          <CollapsibleMetrics>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              <Card bg="white" border="1px solid" borderColor="gray.200" borderRadius="2xl" shadow="sm">
                <CardBody>
                  <EngagementChart data={registrationTrend} title="Registration Trends" subtitle="Last 14 days" valueLabel="Registrations" />
                </CardBody>
              </Card>
              <Card bg="white" border="1px solid" borderColor="gray.200" borderRadius="2xl" shadow="sm">
                <CardBody>
                  <EngagementChart
                    data={userGrowthTrend}
                    title="User Growth"
                    subtitle="Rolling 30-day view"
                    strokeColor="#6366f1"
                    valueLabel="Users"
                  />
                </CardBody>
              </Card>
            </SimpleGrid>
          </CollapsibleMetrics>
        </>
      )}

      <DrawerNotifications isOpen={notificationsDrawer.isOpen} onClose={notificationsDrawer.onClose} />
    </Stack>
  )
}

const DrawerNotifications = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="md">
    <DrawerOverlay />
    <DrawerContent>
      <DrawerCloseButton />
      <DrawerHeader>Admin notifications</DrawerHeader>
      <DrawerBody>
        <AdminNotificationsList />
      </DrawerBody>
    </DrawerContent>
  </Drawer>
)
