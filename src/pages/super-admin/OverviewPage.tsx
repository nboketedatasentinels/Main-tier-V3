import React from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Grid,
  GridItem,
  HStack,
  SimpleGrid,
  Skeleton,
  SkeletonText,
  Spinner,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import {
  AlertTriangle,
  Bell,
  Building2,
  GitBranch,
  List,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { MetricCard } from '@/components/admin/MetricCard'
import { RiskAnalysisCard, RiskLevel, RiskReason } from '@/components/admin/RiskAnalysisCard'
import { AdminNotificationsList } from '@/components/admin/AdminNotificationsList'
import { AdminDataHealthPanel, AdminHealthItem } from '@/components/admin/AdminDataHealthPanel'
import {
  AdminActivityLogEntry,
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'

type TrendPoint = { label: string; value: number }

type OverviewPageProps = {
  adminName: string
  metrics: SuperAdminDashboardMetrics
  registrationTrend: TrendPoint[]
  userGrowthTrend: TrendPoint[]
  riskLevels: RiskLevel[]
  riskReasons: RiskReason[]
  systemAlerts: SystemAlertRecord[]
  registrations: RegistrationRecord[]
  verificationRequests: VerificationRequest[]
  taskNotifications: TaskNotificationRecord[]
  activityLog: AdminActivityLogEntry[]
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
  riskLevels,
  riskReasons,
  systemAlerts,
  registrations,
  verificationRequests,
  taskNotifications,
  activityLog,
  loading,
  error,
  streamsLoading,
  onNavigate,
  healthItems,
}) => {
  const notificationsDrawer = useDisclosure()

  return (
    <Stack spacing={6}>
      <Card bgGradient="linear(to-r, rgba(75, 0, 130, 0.08), rgba(79, 70, 229, 0.08))" border="1px solid" borderColor="purple.100">
        <CardBody>
          <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={6} direction={{ base: 'column', md: 'row' }}>
            <Stack spacing={2}>
              <Badge colorScheme="purple" w="fit-content">
                Super Admin
              </Badge>
              <Text fontSize="2xl" fontWeight="bold" color="brand.text">
                Welcome back, {adminName}
              </Text>
              <Text color="brand.subtleText">
                Manage organizations, users, security, and analytics from a single control surface.
              </Text>
              <Stack direction={{ base: 'column', sm: 'row' }} spacing={3}>
                <Button leftIcon={<Bell size={16} />} variant="outline" onClick={notificationsDrawer.onOpen}>
                  View notifications
                </Button>
                <Button leftIcon={<TrendingUp size={16} />} colorScheme="purple" onClick={() => onNavigate('reports')}>
                  View insights
                </Button>
              </Stack>
            </Stack>
            <Avatar
              size="xl"
              name={adminName}
              bg="purple.600"
              color="white"
              border="4px solid"
              borderColor="purple.100"
            />
          </Flex>
        </CardBody>
      </Card>

      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AdminDataHealthPanel items={healthItems} />

      {loading ? (
        <Stack spacing={6}>
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
            {[1, 2, 3, 4].map((item) => (
              <Card key={item} bg="white" border="1px solid" borderColor="brand.border">
                <CardBody>
                  <Skeleton height="18px" width="40%" />
                  <SkeletonText mt="3" noOfLines={2} spacing="3" />
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
          <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
            {[1, 2].map((item) => (
              <Card key={item} bg="white" border="1px solid" borderColor="brand.border">
                <CardBody>
                  <Skeleton height="16px" width="50%" />
                  <Skeleton height="220px" mt={4} borderRadius="lg" />
                </CardBody>
              </Card>
            ))}
          </Grid>
          <Flex justify="center" align="center" py={6}>
            <Spinner size="lg" />
          </Flex>
        </Stack>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={4}>
            <MetricCard
              icon={Users}
              label="Active members (30d)"
              value={metrics.activeMembers.toLocaleString()}
              helper="Signed in within assigned organizations"
              accent="rgba(16, 185, 129, 0.15)"
            />
            <MetricCard
              icon={TrendingUp}
              label="Engagement rate"
              value={`${Math.round(metrics.engagementRate * 100)}%`}
              helper="Active members vs total accounts"
              accent="rgba(250, 204, 21, 0.2)"
            />
            <MetricCard
              icon={Sparkles}
              label="New registrations (7d)"
              value={metrics.newRegistrations.toLocaleString()}
              helper="Fresh members added this week"
              accent="rgba(90, 13, 160, 0.12)"
            />
            <MetricCard
              icon={Building2}
              label="Managed companies"
              value={metrics.managedCompanies.toString()}
              helper={`${metrics.organizationCount} total organizations`}
              accent="rgba(107, 114, 128, 0.16)"
            />
          </SimpleGrid>

          <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
            <GridItem>
              <Card bgGradient="linear(to-br, purple.50, purple.100)" border="1px solid" borderColor="purple.200" borderRadius="3xl" shadow="sm">
                <CardBody>
                  <EngagementChart data={registrationTrend} title="Engagement trends" subtitle="Last 14 days" valueLabel="Registrations" />
                </CardBody>
              </Card>
            </GridItem>

            <GridItem>
              <Card bg="white" border="1px solid" borderColor="gray.200" borderRadius="3xl" shadow="sm">
                <CardBody>
                  <EngagementChart
                    data={userGrowthTrend}
                    title="User growth trend"
                    subtitle="Rolling 30-day view"
                    strokeColor="#6366f1"
                    valueLabel="Users"
                  />
                </CardBody>
              </Card>
            </GridItem>
          </Grid>

          <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
            <GridItem>
              <Card bg="white" border="1px solid" borderColor="brand.border">
                <CardBody>
                  <RiskAnalysisCard
                    title="At-risk accounts"
                    badgeLabel="Risk engine"
                    levels={riskLevels}
                    reasons={riskReasons}
                    warnings={systemAlerts.map((alert) => ({
                      message: alert.message || 'System alert',
                      severity: alert.level === 'critical' ? 'critical' : 'warning',
                    }))}
                    scopeNote="Scores sourced from user_engagement_scores collection"
                  />
                </CardBody>
              </Card>
            </GridItem>

            <GridItem>
              <Card bg="white" border="1px solid" borderColor="brand.border">
                <CardBody>
                  <Stack spacing={4}>
                    <HStack justify="space-between">
                      <Text fontWeight="bold" color="brand.text">
                        Quick actions
                      </Text>
                      <Badge colorScheme="purple">Navigation</Badge>
                    </HStack>
                    <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                      <Button leftIcon={<List size={16} />} variant="outline" onClick={() => onNavigate('organizations')}>
                        Create organization
                      </Button>
                      <Button leftIcon={<TrendingUp size={16} />} variant="ghost" onClick={() => onNavigate('reports')}>
                        Engagement insights
                      </Button>
                    </SimpleGrid>
                  </Stack>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>

          <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
            <GridItem>
              <Card bg="white" border="1px solid" borderColor="brand.border">
                <CardBody>
                  <Stack spacing={4}>
                    <HStack justify="space-between">
                      <HStack spacing={2}>
                        <AlertTriangle size={18} />
                        <Text fontWeight="bold" color="brand.text">
                          Real-time streams
                        </Text>
                      </HStack>
                      <Badge colorScheme="purple">Live</Badge>
                    </HStack>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <NotificationStreamCard
                        title="Verification requests"
                        items={verificationRequests}
                        icon={<Sparkles size={16} />}
                        color="purple"
                        emptyLabel={streamsLoading ? 'Loading...' : 'No verification requests'}
                      />
                      <NotificationStreamCard
                        title="System alerts"
                        items={systemAlerts}
                        icon={<AlertTriangle size={16} />}
                        color="red"
                        emptyLabel={streamsLoading ? 'Loading...' : 'No alerts present'}
                      />
                      <NotificationStreamCard
                        title="Task notifications"
                        items={taskNotifications}
                        icon={<Bell size={16} />}
                        color="blue"
                        emptyLabel={streamsLoading ? 'Loading...' : 'No tasks assigned'}
                      />
                      <NotificationStreamCard
                        title="User registrations"
                        items={registrations}
                        icon={<Users size={16} />}
                        color="green"
                        emptyLabel={streamsLoading ? 'Loading...' : 'No new registrations'}
                      />
                    </SimpleGrid>
                  </Stack>
                </CardBody>
              </Card>
            </GridItem>

            <GridItem>
              <Card bg="white" border="1px solid" borderColor="brand.border">
                <CardBody>
                  <Stack spacing={4}>
                    <HStack justify="space-between">
                      <HStack spacing={2}>
                        <GitBranch size={16} />
                        <Text fontWeight="bold" color="brand.text">
                          Admin activity log
                        </Text>
                      </HStack>
                      <Badge colorScheme="gray">Audit</Badge>
                    </HStack>
                    <Stack spacing={3} maxH="360px" overflowY="auto">
                      {activityLog.map((entry) => (
                        <HStack key={entry.id} justify="space-between" align="flex-start" borderBottom="1px solid" borderColor="brand.border" pb={2}>
                          <Stack spacing={1}>
                            <Text fontWeight="semibold" color="brand.text">
                              {entry.action}
                            </Text>
                            <Text fontSize="sm" color="brand.subtleText">
                              {entry.adminName || 'Unknown admin'}
                            </Text>
                          </Stack>
                          <Stack spacing={1} align="flex-end">
                            <Badge colorScheme="gray">{entry.organizationCode || 'N/A'}</Badge>
                            <Text fontSize="xs" color="brand.subtleText">
                              {entry.createdAt?.toString?.() || 'Just now'}
                            </Text>
                          </Stack>
                        </HStack>
                      ))}
                      {!activityLog.length && <Text color="gray.600">No admin activity yet.</Text>}
                    </Stack>
                  </Stack>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        </>
      )}

      <DrawerNotifications isOpen={notificationsDrawer.isOpen} onClose={notificationsDrawer.onClose} />
    </Stack>
  )
}

type StreamCardItem = VerificationRequest | RegistrationRecord | SystemAlertRecord | TaskNotificationRecord

const isVerificationRequest = (item: StreamCardItem): item is VerificationRequest =>
  'activityTitle' in item || 'points' in item || 'userName' in item

const isRegistrationRecord = (item: StreamCardItem): item is RegistrationRecord =>
  'email' in item || 'registrationDate' in item

const isTaskNotificationRecord = (item: StreamCardItem): item is TaskNotificationRecord =>
  'severity' in item || 'message' in item

const isSystemAlertRecord = (item: StreamCardItem): item is SystemAlertRecord =>
  'component' in item || 'level' in item

const getStreamItemCopy = (item: StreamCardItem) => {
  if (isVerificationRequest(item)) {
    return {
      title: item.userName || 'Verification request',
      description: item.activityTitle || 'Awaiting verification',
    }
  }

  if (isRegistrationRecord(item)) {
    return {
      title: item.name || 'User registration',
      description: item.email || item.company || 'Registration submitted',
    }
  }

  if (isTaskNotificationRecord(item)) {
    return {
      title: item.title || 'Task notification',
      description: item.message || 'Task update available',
    }
  }

  if (isSystemAlertRecord(item)) {
    return {
      title: item.component || 'System alert',
      description: item.message || 'Alert raised',
    }
  }

  return { title: 'Item', description: 'No details provided' }
}

const NotificationStreamCard = ({
  title,
  items,
  icon,
  color,
  emptyLabel,
}: {
  title: string
  items: StreamCardItem[]
  icon: React.ReactNode
  color: 'purple' | 'red' | 'blue' | 'green'
  emptyLabel: string
}) => (
  <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={3} bg="gray.50" minH="140px">
    <HStack justify="space-between" mb={2}>
      <HStack spacing={2}>
        <Box p={2} borderRadius="md" bg={`${color}.50`} color={`${color}.600`}>
          {icon}
        </Box>
        <Text fontWeight="semibold" color="brand.text">
          {title}
        </Text>
      </HStack>
      <Badge colorScheme={color}>{items.length}</Badge>
    </HStack>
    <Stack spacing={2}>
      {items.map((item) => {
        const { title: itemTitle, description } = getStreamItemCopy(item)

        return (
          <Box key={item.id} p={2} borderRadius="md" border="1px solid" borderColor="brand.border" bg="white">
            <Text fontWeight="semibold" color="brand.text">
              {itemTitle}
            </Text>
            <Text fontSize="sm" color="brand.subtleText">
              {description}
            </Text>
          </Box>
        )
      })}
      {!items.length && (
        <Text color="gray.600" fontSize="sm">
          {emptyLabel}
        </Text>
      )}
    </Stack>
  </Box>
)

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
