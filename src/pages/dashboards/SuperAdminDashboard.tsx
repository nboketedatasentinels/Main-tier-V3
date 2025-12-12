import React, { useMemo } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Card,
  CardBody,
  Flex,
  Grid,
  GridItem,
  HStack,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { Gauge, Sparkles, Users, Building, GitBranch, ShieldCheck, Gauge as GaugeIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { MetricCard } from '@/components/admin/MetricCard'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { RiskAnalysisCard, RiskLevel, RiskReason, DataWarning } from '@/components/admin/RiskAnalysisCard'
import { AdminUserTable, TableColumn } from '@/components/admin/AdminUserTable'
import { OrganizationCard } from '@/components/admin/OrganizationCard'
import type { OrganizationCardProps } from '@/components/admin/OrganizationCard'
import { StatusBadge } from '@/components/admin/StatusBadge'

const registrationTrend = [
  { label: 'Mar 1', value: 18 },
  { label: 'Mar 2', value: 22 },
  { label: 'Mar 3', value: 19 },
  { label: 'Mar 4', value: 24 },
  { label: 'Mar 5', value: 28 },
  { label: 'Mar 6', value: 23 },
  { label: 'Mar 7', value: 26 },
  { label: 'Mar 8', value: 30 },
  { label: 'Mar 9', value: 34 },
  { label: 'Mar 10', value: 31 },
  { label: 'Mar 11', value: 29 },
  { label: 'Mar 12', value: 36 },
  { label: 'Mar 13', value: 38 },
  { label: 'Mar 14', value: 41 },
]

const riskLevels: RiskLevel[] = [
  { label: 'Engaged', count: 482, color: 'green', reasons: ['Consistent logins', 'Above-baseline activity'] },
  { label: 'Watch', count: 126, color: 'yellow', reasons: ['Drop in activity', 'Fewer completions'] },
  { label: 'Concern', count: 62, color: 'orange', reasons: ['Low response rate', 'No recent impact logs'] },
  { label: 'Critical', count: 21, color: 'red', reasons: ['Inactivity 14+ days', 'Multiple failed logins'] },
]

const riskReasons: RiskReason[] = [
  { label: 'Low engagement score', count: 48, color: 'orange' },
  { label: 'Inactivity 14+ days', count: 21, color: 'red' },
  { label: 'Login friction', count: 17, color: 'yellow' },
  { label: 'Org mismatch', count: 12, color: 'purple' },
]

const dataQualityWarnings: DataWarning[] = [
  { message: '9 user records with invalid UUID format', severity: 'critical' },
  { message: '3 accounts missing organization assignment', severity: 'warning' },
]

const organizations: OrganizationCardProps[] = [
  { name: 'Northwind Holdings', status: 'active', admins: 4, newThisWeek: 2, activeUsers: 182, change: '+12' },
  { name: 'Contoso Labs', status: 'active', admins: 3, newThisWeek: 1, activeUsers: 143, change: '+4' },
  { name: 'Globex Partners', status: 'watch', admins: 2, newThisWeek: 0, activeUsers: 96, change: '-3' },
  { name: 'Initech Systems', status: 'pending', admins: 1, newThisWeek: 1, activeUsers: 74, change: '+6' },
]

const userTable = [
  { name: 'Alicia Patel', org: 'Northwind', role: 'Member', status: 'Active', engagement: 92, risk: 'Engaged' },
  { name: 'Marco Ruiz', org: 'Contoso', role: 'Mentor', status: 'Active', engagement: 67, risk: 'Watch' },
  { name: 'Tanya Brooks', org: 'Globex', role: 'Member', status: 'Paused', engagement: 38, risk: 'Concern' },
  { name: 'Samir Rao', org: 'Initech', role: 'Member', status: 'Active', engagement: 84, risk: 'Engaged' },
]

const upgradeRequests = [
  { requester: 'Isabella Chen', from: 'Member', to: 'Mentor', submitted: 'Mar 12' },
  { requester: 'Victor Hale', from: 'Free', to: 'Member', submitted: 'Mar 11' },
  { requester: 'Priya Shah', from: 'Member', to: 'Ambassador', submitted: 'Mar 9' },
]

const auditTrail = [
  { actor: 'Alicia Patel', action: 'Granted ambassador role to Marco Ruiz', ts: '2h ago', severity: 'active' },
  { actor: 'Victor Hale', action: 'Revoked suspended account access', ts: '4h ago', severity: 'watch' },
  { actor: 'Priya Shah', action: 'Adjusted risk thresholds for Globex', ts: 'Yesterday', severity: 'active' },
]

const migrations = [
  { name: 'Org directory sync', progress: 76, status: 'Running', logs: 'Processing batch #24' },
  { name: 'Legacy UUID fix', progress: 42, status: 'Queued', logs: 'Awaiting approval' },
  { name: 'Analytics rollup', progress: 93, status: 'Verifying', logs: 'Finalizing aggregates' },
]

const dbMetrics = [
  { label: 'Connection status', value: 'Healthy', icon: ShieldCheck },
  { label: 'Query p95', value: '142ms', icon: Gauge },
]

const performanceStats = [
  { label: 'Response time', value: '228ms', trend: '+12ms' },
  { label: 'CPU usage', value: '62%', trend: '-4%' },
  { label: 'Memory', value: '71%', trend: '+3%' },
]

export const SuperAdminDashboard: React.FC = () => {
  const { profile } = useAuth()
  const adminName = profile?.fullName || profile?.firstName || 'Admin'

  const userColumns: TableColumn<(typeof userTable)[number]>[] = useMemo(
    () => [
      {
        header: 'User',
        accessor: 'avatar',
        render: row => (
          <HStack spacing={3}>
            <Avatar size="sm" name={row.name} bg="brand.primary" color="white" />
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="semibold" color="brand.text">{row.name}</Text>
              <Text fontSize="xs" color="brand.subtleText">Edit • View history</Text>
            </VStack>
          </HStack>
        ),
      },
      { header: 'Organization', accessor: 'org' },
      { header: 'Role', accessor: 'role' },
      {
        header: 'Status',
        accessor: 'status',
        render: row => <Badge colorScheme={row.status === 'Active' ? 'green' : 'yellow'}>{row.status}</Badge>,
      },
      {
        header: 'Engagement',
        accessor: 'engagement',
        render: row => (
          <HStack spacing={2}>
            <Progress value={row.engagement} w="80px" size="sm" borderRadius="full" />
            <Text fontSize="sm">{row.engagement}%</Text>
          </HStack>
        ),
      },
      {
        header: 'Risk',
        accessor: 'risk',
        render: row => <StatusBadge status={row.risk.toLowerCase()} />,
      },
    ],
    [],
  )

  return (
    <Stack spacing={8}>
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} wrap="wrap">
        <Stack spacing={2}>
          <Text fontSize="sm" color="brand.subtleText">
            Super Admin
          </Text>
          <Text fontSize="3xl" fontWeight="bold" color="white">
            Welcome back, {adminName}
          </Text>
          <Text color="brand.textOnDark" opacity={0.9} maxW="720px">
            Platform-wide oversight with risk visibility, organization governance, and system performance monitoring. Missing
            organization assignments are surfaced here so you can correct access quickly.
          </Text>
        </Stack>
        <Avatar size="lg" name={adminName} src={profile?.avatarUrl} bg="brand.primary" color="white" />
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
        <MetricCard icon={Users} label="Active members (30d)" value="2,148" helper="+186 vs previous 30 days" />
        <MetricCard
          icon={GaugeIcon}
          label="Engagement rate"
          value="76%"
          helper="Up 4.2% week over week"
          accent="rgba(93, 107, 255, 0.12)"
        />
        <MetricCard
          icon={Sparkles}
          label="New registrations (7d)"
          value="384"
          helper="+48 vs prior 7 days"
          accent="rgba(255, 193, 7, 0.16)"
        />
        <MetricCard
          icon={Building}
          label="Managed companies"
          value={organizations.length}
          helper="Platform-wide visibility"
          accent="rgba(52, 211, 153, 0.18)"
        />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <EngagementChart
                data={registrationTrend}
                title="Engagement trends"
                subtitle="14-day daily new registrations with platform guidance"
                valueLabel="New registrations"
              />
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <RiskAnalysisCard
            title="At-risk accounts"
            badgeLabel="Risk engine v2"
            levels={riskLevels}
            reasons={riskReasons}
            warnings={dataQualityWarnings}
            scopeNote="Covers all organizations with automatic reassignment checks"
          />
        </GridItem>
      </Grid>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <Text fontWeight="bold" color="brand.text">
                Platform-wide user management
              </Text>
              <Badge colorScheme="blue">All organizations</Badge>
            </HStack>
            <AdminUserTable rows={userTable} columns={userColumns} />
          </Stack>
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <Text fontWeight="bold" color="brand.text">
                Organization management
              </Text>
              <Badge colorScheme="teal">Status + weekly changes</Badge>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
              {organizations.map(org => (
                <OrganizationCard key={org.name} {...org} />
              ))}
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">
                    Admin oversight
                  </Text>
                  <Badge colorScheme="purple">Audit trail</Badge>
                </HStack>
                <Stack spacing={3}>
                  {auditTrail.map(entry => (
                    <HStack
                      key={entry.action}
                      justify="space-between"
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="brand.border"
                      bg="brand.accent"
                    >
                      <VStack align="flex-start" spacing={0}>
                        <Text fontWeight="semibold" color="brand.text">
                          {entry.actor}
                        </Text>
                        <Text fontSize="sm" color="brand.subtleText">
                          {entry.action}
                        </Text>
                      </VStack>
                      <VStack align="flex-end" spacing={0}>
                        <StatusBadge status={entry.severity} />
                        <Text fontSize="xs" color="brand.subtleText">
                          {entry.ts}
                        </Text>
                      </VStack>
                    </HStack>
                  ))}
                </Stack>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">
                    Upgrade requests
                  </Text>
                  <Badge colorScheme="orange">Pending</Badge>
                </HStack>
                <Stack spacing={3}>
                  {upgradeRequests.map(request => (
                    <HStack
                      key={request.requester}
                      justify="space-between"
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="brand.border"
                      bg="brand.accent"
                    >
                      <VStack align="flex-start" spacing={0}>
                        <Text fontWeight="semibold" color="brand.text">{request.requester}</Text>
                        <Text fontSize="sm" color="brand.subtleText">
                          {request.from} → {request.to}
                        </Text>
                      </VStack>
                      <Badge colorScheme="green">Submitted {request.submitted}</Badge>
                    </HStack>
                  ))}
                </Stack>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">Bolt database monitoring</Text>
                  <Badge colorScheme="green">Live</Badge>
                </HStack>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                  {dbMetrics.map(metric => (
                    <HStack
                      key={metric.label}
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="brand.border"
                      bg="brand.accent"
                      spacing={3}
                    >
                      <Box p={2} borderRadius="md" bg="white" border="1px solid" borderColor="brand.border">
                        <metric.icon color="#4b5563" />
                      </Box>
                      <VStack align="flex-start" spacing={0}>
                        <Text fontSize="sm" color="brand.subtleText">{metric.label}</Text>
                        <Text fontWeight="semibold" color="brand.text">{metric.value}</Text>
                      </VStack>
                    </HStack>
                  ))}
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
                  <Text fontWeight="bold" color="brand.text">Performance monitoring</Text>
                  <Badge colorScheme="blue">Real-time</Badge>
                </HStack>
                <Wrap spacing={3}>
                  {performanceStats.map(item => (
                    <WrapItem key={item.label}>
                      <Box
                        p={3}
                        borderRadius="md"
                        border="1px solid"
                        borderColor="brand.border"
                        bg="brand.accent"
                        minW="160px"
                      >
                        <Text fontSize="sm" color="brand.subtleText">{item.label}</Text>
                        <Text fontWeight="semibold" color="brand.text">{item.value}</Text>
                        <Text fontSize="xs" color="brand.subtleText">{item.trend} last 15m</Text>
                      </Box>
                    </WrapItem>
                  ))}
                </Wrap>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between">
              <Text fontWeight="bold" color="brand.text">Migration status</Text>
              <Badge colorScheme="purple">Tracked</Badge>
            </HStack>
            <Stack spacing={3}>
              {migrations.map(migration => (
                <Box
                  key={migration.name}
                  p={3}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="brand.border"
                  bg="brand.accent"
                >
                  <HStack justify="space-between" mb={2}>
                    <HStack spacing={2}>
                      <GitBranch color="#5d6bff" />
                      <Text fontWeight="semibold" color="brand.text">{migration.name}</Text>
                    </HStack>
                    <Badge colorScheme="blue">{migration.status}</Badge>
                  </HStack>
                  <Progress value={migration.progress} size="sm" borderRadius="full" mb={1} />
                  <Text fontSize="xs" color="brand.subtleText">
                    {migration.logs}
                  </Text>
                </Box>
              ))}
            </Stack>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )
}
