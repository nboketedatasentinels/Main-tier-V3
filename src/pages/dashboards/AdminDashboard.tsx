import React, { useMemo } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Card,
  CardBody,
  Divider,
  Flex,
  Grid,
  GridItem,
  HStack,
  Icon,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import {
  AlertTriangle,
  Building,
  FileWarning,
  Gauge,
  GitBranch,
  LineChart as LineChartIcon,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'

const registrationTrend = [
  { day: 'Mar 1', registrations: 18 },
  { day: 'Mar 2', registrations: 22 },
  { day: 'Mar 3', registrations: 19 },
  { day: 'Mar 4', registrations: 24 },
  { day: 'Mar 5', registrations: 28 },
  { day: 'Mar 6', registrations: 23 },
  { day: 'Mar 7', registrations: 26 },
  { day: 'Mar 8', registrations: 30 },
  { day: 'Mar 9', registrations: 34 },
  { day: 'Mar 10', registrations: 31 },
  { day: 'Mar 11', registrations: 29 },
  { day: 'Mar 12', registrations: 36 },
  { day: 'Mar 13', registrations: 38 },
  { day: 'Mar 14', registrations: 41 },
]

const riskLevels = [
  { label: 'Engaged', count: 482, color: 'green', reasons: ['Consistent logins', 'Above-baseline activity'] },
  { label: 'Watch', count: 126, color: 'yellow', reasons: ['Drop in activity', 'Fewer completions'] },
  { label: 'Concern', count: 62, color: 'orange', reasons: ['Low response rate', 'No recent impact logs'] },
  { label: 'Critical', count: 21, color: 'red', reasons: ['Inactivity 14+ days', 'Multiple failed logins'] },
]

const managedCompanies = [
  { name: 'Northwind Holdings', activeUsers: 182, change: '+12', status: 'active' },
  { name: 'Contoso Labs', activeUsers: 143, change: '+4', status: 'active' },
  { name: 'Globex Partners', activeUsers: 96, change: '-3', status: 'watch' },
  { name: 'Initech Systems', activeUsers: 74, change: '+6', status: 'active' },
]

const userTable = [
  { name: 'Alicia Patel', org: 'Northwind', role: 'Member', status: 'Active', engagement: 92, risk: 'Engaged' },
  { name: 'Marco Ruiz', org: 'Contoso', role: 'Mentor', status: 'Active', engagement: 67, risk: 'Watch' },
  { name: 'Tanya Brooks', org: 'Globex', role: 'Member', status: 'Paused', engagement: 38, risk: 'Concern' },
  { name: 'Samir Rao', org: 'Initech', role: 'Member', status: 'Active', engagement: 84, risk: 'Engaged' },
]

const partnerScopedUsers = userTable.filter(user => ['Northwind', 'Contoso'].includes(user.org))

const organizations = [
  { name: 'Northwind Holdings', status: 'active', admins: 4, newThisWeek: 2 },
  { name: 'Contoso Labs', status: 'active', admins: 3, newThisWeek: 1 },
  { name: 'Globex Partners', status: 'inactive', admins: 2, newThisWeek: 0 },
  { name: 'Initech Systems', status: 'pending', admins: 1, newThisWeek: 1 },
]

const upgradeRequests = [
  { requester: 'Isabella Chen', from: 'Member', to: 'Mentor', submitted: 'Mar 12' },
  { requester: 'Victor Hale', from: 'Free', to: 'Member', submitted: 'Mar 11' },
  { requester: 'Priya Shah', from: 'Member', to: 'Ambassador', submitted: 'Mar 9' },
]

const migrations = [
  { name: 'Org directory sync', progress: 76, status: 'Running', logs: 'Processing batch #24' },
  { name: 'Legacy UUID fix', progress: 42, status: 'Queued', logs: 'Awaiting approval' },
  { name: 'Analytics rollup', progress: 93, status: 'Verifying', logs: 'Finalizing aggregates' },
]

const dataQualityWarnings = [
  { message: '9 user records with invalid UUID format', severity: 'critical' },
  { message: '3 accounts missing organization assignment', severity: 'warning' },
]

const riskReasons = [
  { label: 'Low engagement score', count: 48, color: 'orange' },
  { label: 'Inactivity 14+ days', count: 21, color: 'red' },
  { label: 'Login friction', count: 17, color: 'yellow' },
  { label: 'Org mismatch', count: 12, color: 'purple' },
]

const riskBadges: Record<string, { color: string; label: string }> = {
  Engaged: { color: 'green', label: 'Engaged' },
  Watch: { color: 'yellow', label: 'Watch' },
  Concern: { color: 'orange', label: 'Concern' },
  Critical: { color: 'red', label: 'Critical' },
}

const MetricCard = ({
  icon,
  label,
  value,
  helper,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  helper?: string
  accent?: string
}) => (
  <Card bg="white" border="1px solid" borderColor="brand.border">
    <CardBody>
      <Stack spacing={3}>
        <HStack justify="space-between">
          <Text fontSize="sm" color="brand.subtleText" fontWeight="medium">
            {label}
          </Text>
          <Box
            p={2}
            bg={accent || 'brand.primaryMuted'}
            borderRadius="md"
            color="brand.primary"
            display="grid"
            placeItems="center"
          >
            <Icon as={icon} size={18} />
          </Box>
        </HStack>
        <Text fontSize="2xl" fontWeight="bold" color="brand.text">
          {value}
        </Text>
        {helper && (
          <Text fontSize="sm" color="brand.subtleText">
            {helper}
          </Text>
        )}
      </Stack>
    </CardBody>
  </Card>
)

const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null

  return (
    <Box bg="white" borderRadius="md" border="1px solid" borderColor="brand.border" p={3} boxShadow="md">
      <Text fontWeight="bold" color="brand.text">
        {label}
      </Text>
      <Text color="brand.subtleText">New registrations: {payload[0].value}</Text>
    </Box>
  )
}

export const AdminDashboard: React.FC = () => {
  const { profile } = useAuth()
  const adminName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : 'Admin'
  const roleLabel = profile?.role === UserRole.SUPER_ADMIN ? 'Super Admin' : 'Partner Admin'
  const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN

  const managedCompanyCount = useMemo(() => managedCompanies.length, [])

  return (
    <Stack spacing={8}>
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} wrap="wrap">
        <Stack spacing={2}>
          <Text fontSize="sm" color="brand.subtleText">{roleLabel}</Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.gold">
            Welcome back, {adminName}
          </Text>
          <Text color="brand.softGold" opacity={0.9}>
            Administrative control center with platform-wide oversight, user risk signals, and real-time performance monitoring.
          </Text>
        </Stack>
        <HStack spacing={3} align="center">
          <Avatar size="lg" name={adminName} src={profile?.avatarUrl} bg="brand.primary" color="white" />
          <VStack align="flex-start" spacing={0}>
            <Text fontWeight="semibold" color="brand.text">{adminName}</Text>
            <Text fontSize="sm" color="brand.subtleText">{roleLabel}</Text>
          </VStack>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
        <MetricCard
          icon={Users}
          label="Active members (30d)"
          value="2,148"
          helper="+186 vs previous 30 days"
        />
        <MetricCard
          icon={Gauge}
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
          value={managedCompanyCount}
          helper="Detailed breakdown by risk"
          accent="rgba(52, 211, 153, 0.18)"
        />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <HStack justify="space-between" align="flex-start" mb={4}>
                <Stack spacing={1}>
                  <Text fontWeight="bold" color="brand.text">
                    Engagement trends
                  </Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    14-day daily new registrations with trend guidance
                  </Text>
                </Stack>
                <Icon as={LineChartIcon} color="brand.primary" />
              </HStack>
              <Box h="260px">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={registrationTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f6" />
                    <XAxis dataKey="day" stroke="#8b94b8" tickLine={false} />
                    <YAxis stroke="#8b94b8" tickLine={false} allowDecimals={false} />
                    <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#e0e3ef', strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="registrations" stroke="#5d6bff" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">At-risk accounts</Text>
                  <Badge colorScheme="purple" borderRadius="full" px={3} py={1}>
                    Risk engine v2
                  </Badge>
                </HStack>
                <Stack spacing={3}>
                  {riskLevels.map(level => (
                    <Box
                      key={level.label}
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="brand.border"
                      bg="brand.accent"
                    >
                      <HStack justify="space-between" mb={2}>
                        <HStack spacing={2}>
                          <Badge colorScheme={level.color} borderRadius="full" px={3}>
                            {level.label}
                          </Badge>
                          <Text color="brand.subtleText" fontSize="sm">
                            {level.reasons.join(' • ')}
                          </Text>
                        </HStack>
                        <Text fontWeight="bold" color="brand.text">
                          {level.count}
                        </Text>
                      </HStack>
                      <Progress
                        value={(level.count / 500) * 100}
                        colorScheme={level.color as 'green' | 'yellow' | 'orange' | 'red'}
                        borderRadius="full"
                        size="sm"
                        bg="white"
                      />
                    </Box>
                  ))}
                </Stack>
                <Divider />
                <Stack spacing={2}>
                  <Text fontWeight="semibold" color="brand.text">
                    Risk reasons breakdown
                  </Text>
                  <Wrap spacing={2}>
                    {riskReasons.map(reason => (
                      <WrapItem key={reason.label}>
                        <HStack
                          spacing={2}
                          border="1px solid"
                          borderColor="brand.border"
                          borderRadius="full"
                          px={3}
                          py={2}
                          bg="brand.accent"
                        >
                          <Badge colorScheme={reason.color as any} borderRadius="full">
                            {reason.count}
                          </Badge>
                          <Text fontSize="sm" color="brand.subtleText">
                            {reason.label}
                          </Text>
                        </HStack>
                      </WrapItem>
                    ))}
                  </Wrap>
                </Stack>
                <Divider />
                <Stack spacing={3}>
                  <HStack color="red.500" spacing={2}>
                    <Icon as={AlertTriangle} />
                    <Text fontWeight="semibold">Data quality warnings</Text>
                  </HStack>
                  {dataQualityWarnings.map(warning => (
                    <HStack
                      key={warning.message}
                      justify="space-between"
                      p={2}
                      borderRadius="md"
                      bg={warning.severity === 'critical' ? 'red.50' : 'yellow.50'}
                      color={warning.severity === 'critical' ? 'red.700' : 'orange.700'}
                    >
                      <HStack spacing={2}>
                        <Icon as={FileWarning} />
                        <Text fontSize="sm">{warning.message}</Text>
                      </HStack>
                      <Badge colorScheme={warning.severity === 'critical' ? 'red' : 'orange'}>
                        Validate
                      </Badge>
                    </HStack>
                  ))}
                </Stack>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <Text fontWeight="bold" color="brand.text">Managed companies</Text>
              <Badge colorScheme="teal">Scoped by role</Badge>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
              {managedCompanies.map(company => (
                <Box
                  key={company.name}
                  p={3}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="brand.border"
                  bg="brand.accent"
                >
                  <HStack justify="space-between" mb={2}>
                    <Text fontWeight="semibold" color="brand.text">
                      {company.name}
                    </Text>
                    <Badge
                      colorScheme={
                        company.status === 'active'
                          ? 'green'
                          : company.status === 'watch'
                            ? 'yellow'
                            : 'red'
                      }
                    >
                      {company.status}
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">
                    Active users: {company.activeUsers}
                  </Text>
                  <Text fontSize="xs" color="brand.subtleText">
                    7d change: {company.change}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: '1fr', xl: isSuperAdmin ? '1fr' : '1.5fr 1fr' }} gap={6}>
        {isSuperAdmin ? (
          <GridItem>
            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <Text fontWeight="bold" color="brand.text">User management</Text>
                    <Badge colorScheme="blue">Platform-wide</Badge>
                  </HStack>
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>User</Th>
                        <Th>Organization</Th>
                        <Th>Role</Th>
                        <Th>Status</Th>
                        <Th>Engagement</Th>
                        <Th>Risk</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {userTable.map(user => (
                        <Tr key={user.name}>
                          <Td>
                            <HStack spacing={3}>
                              <Avatar size="sm" name={user.name} bg="brand.primary" color="white" />
                              <VStack align="flex-start" spacing={0}>
                                <Text fontWeight="semibold" color="brand.text">{user.name}</Text>
                                <Text fontSize="xs" color="brand.subtleText">
                                  Edit • View history
                                </Text>
                              </VStack>
                            </HStack>
                          </Td>
                          <Td>{user.org}</Td>
                          <Td>{user.role}</Td>
                          <Td>
                            <Badge colorScheme={user.status === 'Active' ? 'green' : 'yellow'}>{user.status}</Badge>
                          </Td>
                          <Td>
                            <HStack spacing={2}>
                              <Progress value={user.engagement} w="80px" size="sm" borderRadius="full" />
                              <Text fontSize="sm">{user.engagement}%</Text>
                            </HStack>
                          </Td>
                          <Td>
                            <Badge colorScheme={riskBadges[user.risk].color as any}>{riskBadges[user.risk].label}</Badge>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Stack>
              </CardBody>
            </Card>
          </GridItem>
        ) : (
          <GridItem>
            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <Text fontWeight="bold" color="brand.text">User management</Text>
                    <Badge colorScheme="green">Partner scoped</Badge>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">
                    Scoped to assigned organizations only. Administrative actions limited to status updates and outreach.
                  </Text>
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>User</Th>
                        <Th>Organization</Th>
                        <Th>Status</Th>
                        <Th>Engagement</Th>
                        <Th>Risk</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {partnerScopedUsers.map(user => (
                        <Tr key={user.name}>
                          <Td>{user.name}</Td>
                          <Td>{user.org}</Td>
                          <Td>
                            <Badge colorScheme={user.status === 'Active' ? 'green' : 'yellow'}>{user.status}</Badge>
                          </Td>
                          <Td>{user.engagement}%</Td>
                          <Td>
                            <Badge colorScheme={riskBadges[user.risk].color as any}>{riskBadges[user.risk].label}</Badge>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Stack>
              </CardBody>
            </Card>
          </GridItem>
        )}
        {!isSuperAdmin && (
          <GridItem>
            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <Text fontWeight="bold" color="brand.text">Intervention panel</Text>
                    <Badge colorScheme="purple">Partner only</Badge>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">
                    Targeted outreach to at-risk users with tracked risk reasons and recommendations.
                  </Text>
                  <Stack spacing={3}>
                    {['Low engagement score', 'Inactivity alerts', 'Login friction'].map(reason => (
                      <Box
                        key={reason}
                        p={3}
                        borderRadius="md"
                        border="1px solid"
                        borderColor="brand.border"
                        bg="brand.accent"
                      >
                        <HStack justify="space-between" mb={2}>
                          <Text fontWeight="semibold" color="brand.text">
                            {reason}
                          </Text>
                          <Badge colorScheme="yellow">Watch</Badge>
                        </HStack>
                        <Text fontSize="sm" color="brand.subtleText">
                          Recommended action: personalized outreach, validate org mapping, and schedule mentor check-in.
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              </CardBody>
            </Card>
          </GridItem>
        )}
      </Grid>

      {isSuperAdmin && (
        <Grid templateColumns={{ base: '1fr', xl: 'repeat(2, 1fr)' }} gap={6}>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">Organization management</Text>
                  <Badge colorScheme="teal">Super admin</Badge>
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  {organizations.map(org => (
                    <Box
                      key={org.name}
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="brand.border"
                      bg="brand.accent"
                    >
                      <HStack justify="space-between" mb={2}>
                        <Text fontWeight="semibold" color="brand.text">{org.name}</Text>
                        <Badge
                          colorScheme={
                            org.status === 'active'
                              ? 'green'
                              : org.status === 'pending'
                                ? 'yellow'
                                : 'red'
                          }
                        >
                          {org.status}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between" fontSize="sm" color="brand.subtleText">
                        <Text>Admins: {org.admins}</Text>
                        <Text>7d change: +{org.newThisWeek}</Text>
                      </HStack>
                    </Box>
                  ))}
                </SimpleGrid>
              </Stack>
            </CardBody>
          </Card>

          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">Admin oversight</Text>
                  <Badge colorScheme="blue">Audit trail</Badge>
                </HStack>
                <Stack spacing={3}>
                  {["Role assignments updated", 'Bulk status change', 'Org reassignment approved'].map(action => (
                    <HStack
                      key={action}
                      justify="space-between"
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="brand.border"
                      bg="brand.accent"
                    >
                      <Text color="brand.text">{action}</Text>
                      <Badge colorScheme="purple">Tracked</Badge>
                    </HStack>
                  ))}
                </Stack>
              </Stack>
            </CardBody>
          </Card>

          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">Upgrade requests</Text>
                  <Badge colorScheme="orange">{upgradeRequests.length} pending</Badge>
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

          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">Bolt database monitoring</Text>
                  <Badge colorScheme="green">Live</Badge>
                </HStack>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                  {[{ label: 'Connection status', value: 'Healthy', icon: ShieldCheck }, { label: 'Query p95', value: '142ms', icon: Gauge }].map(metric => (
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
                        <Icon as={metric.icon} color="brand.primary" />
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

          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">Performance monitoring</Text>
                  <Badge colorScheme="blue">Real-time</Badge>
                </HStack>
                <Wrap spacing={3}>
                  {[{ label: 'Response time', value: '228ms', trend: '+12ms' }, { label: 'CPU usage', value: '62%', trend: '-4%' }, { label: 'Memory', value: '71%', trend: '+3%' }].map(item => (
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
                          <Icon as={GitBranch} color="brand.primary" />
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
        </Grid>
      )}
    </Stack>
  )
}

export default AdminDashboard
