import React, { useMemo } from 'react'
import {
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
import { Gauge, Sparkles, Users, Building, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { MetricCard } from '@/components/admin/MetricCard'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { RiskAnalysisCard, RiskLevel, RiskReason, DataWarning } from '@/components/admin/RiskAnalysisCard'
import { AdminUserTable, TableColumn } from '@/components/admin/AdminUserTable'
import { OrganizationCard } from '@/components/admin/OrganizationCard'
import { StatusBadge } from '@/components/admin/StatusBadge'

type OrganizationStatus = 'active' | 'inactive' | 'pending' | 'watch'

const registrationTrend = [
  { label: 'Mar 1', value: 9 },
  { label: 'Mar 2', value: 12 },
  { label: 'Mar 3', value: 11 },
  { label: 'Mar 4', value: 13 },
  { label: 'Mar 5', value: 15 },
  { label: 'Mar 6', value: 12 },
  { label: 'Mar 7', value: 14 },
  { label: 'Mar 8', value: 16 },
  { label: 'Mar 9', value: 17 },
  { label: 'Mar 10', value: 16 },
  { label: 'Mar 11', value: 15 },
  { label: 'Mar 12', value: 18 },
  { label: 'Mar 13', value: 19 },
  { label: 'Mar 14', value: 20 },
]

const riskLevels: RiskLevel[] = [
  { label: 'Engaged', count: 182, color: 'green', reasons: ['High check-in rate', 'Strong course completion'] },
  { label: 'Watch', count: 42, color: 'yellow', reasons: ['Drop in activity', 'Upcoming renewals'] },
  { label: 'Concern', count: 21, color: 'orange', reasons: ['Low outreach response', 'Paused journeys'] },
  { label: 'Critical', count: 8, color: 'red', reasons: ['No login 14+ days', 'Flagged by mentor'] },
]

const riskReasons: RiskReason[] = [
  { label: 'Low engagement score', count: 18, color: 'orange' },
  { label: 'Inactivity 14+ days', count: 8, color: 'red' },
  { label: 'Login friction', count: 5, color: 'yellow' },
  { label: 'Org mismatch', count: 3, color: 'purple' },
]

const dataQualityWarnings: DataWarning[] = [
  { message: '2 accounts missing organization assignment', severity: 'warning' },
]

const userTable = [
  { name: 'Leah Kim', org: 'Northwind', status: 'Active', engagement: 88, risk: 'Engaged', role: 'Member' },
  { name: 'Derrick Shaw', org: 'Northwind', status: 'Active', engagement: 61, risk: 'Watch', role: 'Member' },
  { name: 'Mei Lin', org: 'Contoso', status: 'Paused', engagement: 33, risk: 'Concern', role: 'Member' },
  { name: 'Ravi Patel', org: 'Contoso', status: 'Active', engagement: 74, risk: 'Engaged', role: 'Mentor' },
]

const scopedOrganizations: Array<{
  name: string
  status: OrganizationStatus
  admins: number
  newThisWeek: number
  activeUsers: number
  change: string
}> = [
  { name: 'Northwind Holdings', status: 'active', admins: 2, newThisWeek: 1, activeUsers: 94, change: '+6' },
  { name: 'Contoso Labs', status: 'watch', admins: 1, newThisWeek: 0, activeUsers: 71, change: '-2' },
]

const interventions = [
  { name: 'Follow-up outreach to paused users', target: '6 accounts', reason: 'Low weekly activity', status: 'watch' },
  { name: 'Mentor pairing refresh', target: '3 at-risk mentors', reason: 'Low response rate', status: 'active' },
  { name: 'Reassign orphaned users', target: '2 records', reason: 'Missing org mapping', status: 'critical' },
]

const performanceSnapshots = [
  { label: 'Response time', value: '182ms', trend: '+8ms' },
  { label: 'CPU usage', value: '48%', trend: '-3%' },
  { label: 'Memory', value: '63%', trend: '+2%' },
]

export const CompanyAdminDashboard: React.FC = () => {
  const { profile } = useAuth()
  const adminName = profile?.fullName || profile?.firstName || 'Admin'

  const userColumns: TableColumn<(typeof userTable)[number]>[] = useMemo(
    () => [
      {
        header: 'User',
        accessor: 'avatar',
        render: row => (
          <HStack spacing={3}>
            <StatusBadge status={row.risk.toLowerCase()} />
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="semibold" color="brand.text">{row.name}</Text>
              <Text fontSize="xs" color="brand.subtleText">{row.role}</Text>
            </VStack>
          </HStack>
        ),
      },
      { header: 'Organization', accessor: 'org' },
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
            Company Admin
          </Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.gold">
            Welcome back, {adminName}
          </Text>
          <Text color="brand.softGold" opacity={0.9} maxW="720px">
            Organization-scoped oversight with targeted intervention tools. Users with missing assignments are highlighted so you
            can correct mappings before they lose access.
          </Text>
        </Stack>
        <StatusBadge status="active" />
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
        <MetricCard icon={Users} label="Active members" value="224" helper="Across managed organizations" />
        <MetricCard icon={Gauge} label="Engagement rate" value="71%" helper="Up 3.1% week over week" />
        <MetricCard icon={Sparkles} label="New registrations" value="64" helper="+12 vs prior 7 days" />
        <MetricCard
          icon={Building}
          label="Managed companies"
          value={scopedOrganizations.length}
          helper="Assigned organizations"
        />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <EngagementChart
                data={registrationTrend}
                title="Engagement trends"
                subtitle="14-day registrations for your organizations"
                valueLabel="Registrations"
              />
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <RiskAnalysisCard
            title="At-risk accounts"
            badgeLabel="Scoped"
            badgeColor="green"
            levels={riskLevels}
            reasons={riskReasons}
            warnings={dataQualityWarnings}
            scopeNote="Only users in organizations you manage"
          />
        </GridItem>
      </Grid>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <Text fontWeight="bold" color="brand.text">User management</Text>
              <Badge colorScheme="green">Partner scoped</Badge>
            </HStack>
            <Text fontSize="sm" color="brand.subtleText">
              Only users in your assigned organizations are shown. Missing assignments remain visible for correction.
            </Text>
            <AdminUserTable rows={userTable} columns={userColumns} />
          </Stack>
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: '1fr', xl: '1.5fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" color="brand.text">Intervention panel</Text>
                  <Badge colorScheme="purple">Targeted</Badge>
                </HStack>
                <Stack spacing={3}>
                  {interventions.map(item => (
                    <HStack
                      key={item.name}
                      justify="space-between"
                      p={3}
                      borderRadius="md"
                      border="1px solid"
                      borderColor="brand.border"
                      bg="brand.accent"
                    >
                      <VStack align="flex-start" spacing={0}>
                        <Text fontWeight="semibold" color="brand.text">{item.name}</Text>
                        <Text fontSize="sm" color="brand.subtleText">
                          {item.target} • {item.reason}
                        </Text>
                      </VStack>
                      <StatusBadge status={item.status} />
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
                  <Text fontWeight="bold" color="brand.text">Risk reasons</Text>
                  <Badge colorScheme="orange">Org specific</Badge>
                </HStack>
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
                        <Badge colorScheme={reason.color} borderRadius="full">
                          {reason.count}
                        </Badge>
                        <Text fontSize="sm" color="brand.subtleText">
                          {reason.label}
                        </Text>
                      </HStack>
                    </WrapItem>
                  ))}
                </Wrap>
                {dataQualityWarnings.map(warning => (
                  <HStack
                    key={warning.message}
                    justify="space-between"
                    p={2}
                    borderRadius="md"
                    bg="yellow.50"
                    color="orange.700"
                  >
                    <Text fontSize="sm">{warning.message}</Text>
                    <Badge colorScheme="orange">Review</Badge>
                  </HStack>
                ))}
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
              {scopedOrganizations.map(company => (
                <OrganizationCard key={company.name} {...company} />
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
                  <Text fontWeight="bold" color="brand.text">Company performance</Text>
                  <Badge colorScheme="blue">7-day change</Badge>
                </HStack>
                <Wrap spacing={3}>
                  {scopedOrganizations.map(org => (
                    <WrapItem key={org.name}>
                      <Box
                        p={3}
                        borderRadius="md"
                        border="1px solid"
                        borderColor="brand.border"
                        bg="brand.accent"
                        minW="180px"
                      >
                        <Text fontWeight="semibold" color="brand.text">{org.name}</Text>
                        <Text fontSize="sm" color="brand.subtleText">Active users: {org.activeUsers}</Text>
                        <Badge mt={2} colorScheme={org.change.includes('-') ? 'red' : 'green'}>
                          {org.change} this week
                        </Badge>
                      </Box>
                    </WrapItem>
                  ))}
                </Wrap>
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
                  <Badge colorScheme="blue">Live</Badge>
                </HStack>
                <Wrap spacing={3}>
                  {performanceSnapshots.map(item => (
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
              <Text fontWeight="bold" color="brand.text">Data quality & monitoring</Text>
              <Badge colorScheme="green">Org scoped</Badge>
            </HStack>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
              {[{ label: 'Connection status', value: 'Healthy' }, { label: 'Query p95', value: '118ms' }].map(metric => (
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
                    <ShieldCheck color="#4b5563" />
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
    </Stack>
  )
}
