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
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { AdminNotificationsList } from '@/components/admin/AdminNotificationsList'
import { AdminHealthItem } from '@/components/admin/AdminDataHealthPanel'
import type { RiskLevel, RiskReason } from '@/components/admin/RiskAnalysisCard'
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

const toDate = (value?: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const formatRelativeTimestamp = (value: unknown, fallback: string) => {
  const parsed = toDate(value)
  return parsed ? formatDistanceToNow(parsed, { addSuffix: true }) : fallback
}

const isWithinPastHours = (value: unknown, hours: number) => {
  const parsed = toDate(value)
  if (!parsed) return false
  return Date.now() - parsed.getTime() <= hours * 60 * 60 * 1000
}

const mapSeverity = (value?: string): ActionItem['severity'] => {
  const normalized = value?.toLowerCase()
  if (normalized === 'critical' || normalized === 'error') return 'critical'
  if (normalized === 'high' || normalized === 'warning' || normalized === 'urgent') return 'high'
  return 'medium'
}

type OverviewPageProps = {
  adminName: string
  metrics: SuperAdminDashboardMetrics
  registrationTrend: TrendPoint[]
  userGrowthTrend: TrendPoint[]
  riskLevels?: RiskLevel[]
  riskReasons?: RiskReason[]
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
  taskNotifications,
  loading,
  error,
  onNavigate,
  healthItems,
}) => {
  const notificationsDrawer = useDisclosure()

  // Data mapping for Command Center
  const criticalActionItems: ActionItem[] = React.useMemo(() => {
    const items: ActionItem[] = []

    const pendingVerificationRequests = verificationRequests.filter((request) => {
      const status = request.status
      return !status || status === 'pending'
    })

    const urgentAlerts = systemAlerts.filter((alert) => {
      const level = alert.level?.toLowerCase()
      return level === 'critical' || level === 'high' || level === 'warning' || level === 'error'
    })

    const urgentTasks = taskNotifications.filter((task) => {
      const severity = task.severity?.toLowerCase()
      return severity === 'critical' || severity === 'high' || severity === 'warning' || severity === 'urgent'
    })

    const recentRegistrations = registrations.filter((registration) =>
      isWithinPastHours(registration.createdAt ?? registration.registrationDate, 24),
    )

    // Map urgent system alerts
    urgentAlerts
      .slice(0, 3)
      .forEach((a) => {
        items.push({
          id: `alert-${a.id}`,
          severity: mapSeverity(a.level),
          title: `System alert: ${a.component || 'Platform service'}`,
          description: a.message || 'Review the latest incident details and mitigation status.',
          timestamp: formatRelativeTimestamp(a.created_at, 'Timestamp unavailable'),
          actionLabel: 'Open oversight',
          onAction: () => onNavigate('admin-oversight'),
          icon: <ShieldAlert size={20} />,
        })
      })

    // Map pending verification requests
    if (pendingVerificationRequests.length > 0) {
      items.push({
        id: 'verifications',
        severity: 'high',
        title: `${pendingVerificationRequests.length} pending verification request${pendingVerificationRequests.length === 1 ? '' : 's'}`,
        description: 'These approval requests are waiting for a super admin decision.',
        timestamp: formatRelativeTimestamp(
          pendingVerificationRequests[0]?.created_at,
          'Awaiting review',
        ),
        actionLabel: 'Review now',
        onAction: () => onNavigate('approvals'),
        icon: <Sparkles size={20} />,
      })
    }

    // Map urgent task notifications
    urgentTasks.slice(0, 2).forEach((task) => {
      items.push({
        id: `task-${task.id}`,
        severity: mapSeverity(task.severity),
        title: task.title || 'High-priority task notification',
        description: task.message || 'A high-priority task needs follow-up.',
        timestamp: formatRelativeTimestamp(task.created_at, 'Queued'),
        actionLabel: 'Open oversight',
        onAction: () => onNavigate('admin-oversight'),
        icon: <AlertTriangle size={20} />,
      })
    })

    // Map only recent registrations for actionability
    if (recentRegistrations.length > 0) {
      items.push({
        id: 'registrations',
        severity: 'medium',
        title: `${recentRegistrations.length} new registration${recentRegistrations.length === 1 ? '' : 's'} in the last 24h`,
        description: 'New profile records that may need role or access review.',
        timestamp: formatRelativeTimestamp(
          recentRegistrations[0]?.createdAt ?? recentRegistrations[0]?.registrationDate,
          'Last 24h',
        ),
        actionLabel: 'Review users',
        onAction: () => onNavigate('users'),
        icon: <Users size={20} />,
      })
    }

    return items
  }, [systemAlerts, verificationRequests, taskNotifications, registrations, onNavigate])

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
              <Card bg="white" border="1px solid" borderColor="border.control" borderRadius="2xl" shadow="sm">
                <CardBody>
                  <EngagementChart data={registrationTrend} title="Registration Trends" subtitle="Last 14 days" valueLabel="Registrations" />
                </CardBody>
              </Card>
              <Card bg="white" border="1px solid" borderColor="border.control" borderRadius="2xl" shadow="sm">
                <CardBody>
                  <EngagementChart
                    data={userGrowthTrend}
                    title="User Growth"
                    subtitle="Rolling 30-day view"
                    strokeColor="var(--chakra-colors-brand-primary)"
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
