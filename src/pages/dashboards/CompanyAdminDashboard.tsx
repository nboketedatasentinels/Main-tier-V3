import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Skeleton,
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
import type { OrganizationCardProps } from '@/components/admin/OrganizationCard'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { DashboardErrorBoundary } from '@/components/ui/DashboardErrorBoundary'
import CompanyAdminLayout from '@/layouts/CompanyAdminLayout'
import { buildCompanyAdminNavItems } from '@/utils/navigationItems'
import {
  fetchOrganizationEngagementStats,
  listenToAssignedOrganizations,
  logOrganizationAccessAttempt,
} from '@/services/organizationService'
import type { OrganizationRecord, OrganizationStatistics } from '@/types/admin'

type CompanyPageKey = 'overview' | 'users' | 'organizations' | 'reports' | 'settings' | 'support'
type CompanyOrg = OrganizationCardProps & { code: string; id?: string }

type UserRow = {
  name: string
  org: string
  orgCode: string
  status: string
  engagement: number
  risk: string
  role: string
}

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

const baseUsers: UserRow[] = [
  { name: 'Leah Kim', org: 'Northwind', orgCode: 'northwind', status: 'Active', engagement: 88, risk: 'Engaged', role: 'Member' },
  { name: 'Derrick Shaw', org: 'Northwind', orgCode: 'northwind', status: 'Active', engagement: 61, risk: 'Watch', role: 'Member' },
  { name: 'Mei Lin', org: 'Contoso', orgCode: 'contoso', status: 'Paused', engagement: 33, risk: 'Concern', role: 'Member' },
  { name: 'Ravi Patel', org: 'Contoso', orgCode: 'contoso', status: 'Active', engagement: 74, risk: 'Engaged', role: 'Mentor' },
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

const UserManagementSection: React.FC<{
  rows: UserRow[]
  columns: TableColumn<UserRow>[]
  scopeLabel?: string
}> = ({ rows, columns, scopeLabel }) => (
  <Stack spacing={4}>
    <HStack justify="space-between" align="center">
      <Text fontWeight="bold" color="brand.text">User management</Text>
      {scopeLabel && <Badge colorScheme="green">{scopeLabel}</Badge>}
    </HStack>
    <Text fontSize="sm" color="brand.subtleText">
      Only users in your assigned organizations are shown. Missing assignments remain visible for correction.
    </Text>
    <AdminUserTable rows={rows} columns={columns} />
  </Stack>
)

export const CompanyAdminDashboard: React.FC = () => {
  const { profile, assignedOrganizations, isSuperAdmin, user, profileStatus } = useAuth()
  const navigate = useNavigate()
  const adminName = profile?.fullName || profile?.firstName || 'Admin'
  const [activePage, setActivePage] = useState<CompanyPageKey>('overview')
  const [selectedOrg, setSelectedOrg] = useState<string>('all')
  const [organizations, setOrganizations] = useState<CompanyOrg[]>([])
  const navSections = useMemo(() => buildCompanyAdminNavItems(), [])
  const [organizationRecords, setOrganizationRecords] = useState<OrganizationRecord[]>([])
  const [organizationStats, setOrganizationStats] = useState<Record<string, OrganizationStatistics>>({})
  const [organizationsError, setOrganizationsError] = useState<string | null>(null)
  const [organizationsLoading, setOrganizationsLoading] = useState(true)
  const retryTimeoutRef = useRef<number | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const assignedCount = assignedOrganizations?.length || 0

  const mapOrgStatus = (status?: OrganizationRecord['status']): CompanyOrg['status'] => {
    if (status === 'inactive') return 'inactive'
    if (status === 'pending') return 'pending'
    if (status === 'watch') return 'watch'
    if (status === 'suspended') return 'paused'
    return 'active'
  }

  useEffect(() => {
    if (profileStatus !== 'ready') {
      setOrganizationsLoading(true)
      setOrganizationRecords([])
      return undefined
    }
    if (!user?.uid) return undefined

    const startListener = () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      setOrganizationsLoading(true)
      unsubscribeRef.current = listenToAssignedOrganizations(
        user.uid,
        (orgs) => {
          setOrganizationRecords(orgs)
          setOrganizationsError(null)
          setOrganizationsLoading(false)
        },
        {
          onError: (error) => {
            console.error('Failed to listen for assigned organizations', error)
            setOrganizationsError('Live organization updates are temporarily unavailable. Retrying…')
            setOrganizationsLoading(false)
            if (retryTimeoutRef.current) {
              window.clearTimeout(retryTimeoutRef.current)
            }
            retryTimeoutRef.current = window.setTimeout(startListener, 5000)
          },
        },
      )
    }

    startListener()

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [profileStatus, user?.uid])

  useEffect(() => {
    let isActive = true

    const loadStats = async () => {
      if (!organizationRecords.length) {
        setOrganizationStats({})
        return
      }
      try {
        const entries = await Promise.all(
          organizationRecords.map(async (org) => {
            const key = org.id || org.code
            const stats = await fetchOrganizationEngagementStats(key)
            return [key, stats] as const
          }),
        )
        if (!isActive) return
        setOrganizationStats(Object.fromEntries(entries))
      } catch (error) {
        console.error('Failed to load organization statistics', error)
        if (!isActive) return
        setOrganizationsError('Unable to load organization statistics right now.')
      }
    }

    loadStats()

    return () => {
      isActive = false
    }
  }, [organizationRecords])

  const scopedOrganizations = useMemo<CompanyOrg[]>(() => {
    return organizationRecords.map((org) => {
      const key = org.id || org.code
      const stats = organizationStats[key]
      const newThisWeek = stats?.newMembersThisWeek ?? 0
      const warning = !org.name || !org.code ? 'Organization details incomplete.' : undefined
      return {
        code: org.code || key,
        name: org.name || 'Unknown organization',
        status: mapOrgStatus(org.status),
        activeUsers: stats?.activeMembers ?? 0,
        newThisWeek,
        change: stats ? `${newThisWeek >= 0 ? '+' : ''}${newThisWeek}` : undefined,
        admins: org.assignmentCount,
        description: org.description,
        warning,
      }
    })
  }, [organizationRecords, organizationStats])

  const organizationOptions = useMemo(
    () => [{ code: 'all', name: 'All Organizations' }, ...scopedOrganizations.map(({ code, name }) => ({ code, name }))],
    [scopedOrganizations],
  )

  const filteredOrganizations = useMemo(() => {
    if (selectedOrg === 'all') return scopedOrganizations
    return scopedOrganizations.filter(org => org.code === selectedOrg)
  }, [selectedOrg, scopedOrganizations])

  useEffect(() => {
    if (selectedOrg === 'all') return
    const hasSelection = scopedOrganizations.some((org) => org.code === selectedOrg)
    if (!hasSelection) {
      setSelectedOrg('all')
    }
  }, [scopedOrganizations, selectedOrg])

  const userColumns: TableColumn<UserRow>[] = useMemo(
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

  const filteredUsers = useMemo(
    () => (selectedOrg === 'all' ? baseUsers : baseUsers.filter(user => user.orgCode === selectedOrg)),
    [selectedOrg],
  )

  const activeOrgName = selectedOrg === 'all' ? 'all organizations' : filteredOrganizations[0]?.name || 'selected org'
  const hasAssignments = isSuperAdmin || assignedOrganizations.length > 0

  useEffect(() => {
    if (profileStatus !== 'ready') {
      return
    }
    if (!user?.uid) return
    if (!isSuperAdmin && !assignedOrganizations.length) {
      setOrganizations([])
      return
    }

    const unsubscribe = listenToAssignedOrganizations(
      user.uid,
      (assignedOrgs) => {
        const mapped = assignedOrgs.map((org: OrganizationRecord) => {
          const status = org.status === 'suspended' ? 'paused' : org.status
          return {
            id: org.id,
            code: org.code || org.id || '',
            name: org.name || org.code || org.id || 'Unknown organization',
            status: (status as CompanyOrg['status']) || 'active',
            activeUsers: org.assignmentCount ?? org.teamSize ?? 0,
          }
        })
        setOrganizations(mapped)
      },
      { onError: (error) => console.warn('Failed to load assigned organizations', error) },
    )

    return () => unsubscribe()
  }, [assignedOrganizations, isSuperAdmin, profileStatus, user?.uid])

  useEffect(() => {
    if (selectedOrg === 'all') return
    const stillValid = organizations.some(org => org.code === selectedOrg)
    if (!stillValid) {
      setSelectedOrg('all')
    }
  }, [organizations, selectedOrg])

  const aggregateStats = useMemo(() => {
    const totals = {
      totalMembers: 0,
      activeMembers: 0,
      newMembersThisWeek: 0,
      engagementWeightedSum: 0,
    }

    Object.values(organizationStats).forEach((stats) => {
      totals.totalMembers += stats.totalMembers
      totals.activeMembers += stats.activeMembers
      totals.newMembersThisWeek += stats.newMembersThisWeek
      totals.engagementWeightedSum += stats.averageEngagementRate * stats.totalMembers
    })

    const engagementRate = totals.totalMembers
      ? Math.round(totals.engagementWeightedSum / totals.totalMembers)
      : 0

    return {
      activeMembers: totals.activeMembers,
      newMembersThisWeek: totals.newMembersThisWeek,
      engagementRate,
    }
  }, [organizationStats])

  const handleViewOrganization = (orgCode: string) => {
    const allowed = isSuperAdmin || organizations.some(org => org.code.toLowerCase() === orgCode.toLowerCase())
    if (!allowed && user?.uid) {
      void logOrganizationAccessAttempt({
        userId: user.uid,
        organizationCode: orgCode,
        reason: 'company_admin_dashboard',
      })
      return
    }
    navigate(`/admin/organization/${orgCode}`)
  }

  const renderOverview = () => (
    <Stack spacing={8}>
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} wrap="wrap">
        <Stack spacing={2}>
          <Text fontSize="sm" color="brand.subtleText">
            Company Admin
          </Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.text">
            Welcome back, {adminName}
          </Text>
          {organizationsError && (
            <Badge colorScheme="red" w="fit-content">
              {organizationsError}
            </Badge>
          )}
          {!organizationsLoading && assignedCount === 0 && (
            <Badge colorScheme="yellow" w="fit-content">
              No organizations assigned yet
            </Badge>
          )}
          <Text color="brand.textOnDark" opacity={0.9} maxW="720px">
            Organization-scoped oversight with targeted intervention tools. Users with missing assignments are highlighted so you can
            correct mappings before they lose access.
          </Text>
          {!hasAssignments && (
            <Text color="orange.200" fontSize="sm">
              No organizations are assigned to this account yet. Contact a super admin to request access.
            </Text>
          )}
        </Stack>
        <StatusBadge status="active" />
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
        <MetricCard
          icon={Users}
          label="Active members"
          value={aggregateStats.activeMembers.toString()}
          helper={`Viewing ${activeOrgName}`}
        />
        <MetricCard
          icon={Gauge}
          label="Engagement rate"
          value={`${aggregateStats.engagementRate}%`}
          helper="Based on assigned organizations"
        />
        <MetricCard
          icon={Sparkles}
          label="New registrations"
          value={aggregateStats.newMembersThisWeek.toString()}
          helper="Last 7 days"
        />
        <MetricCard
          icon={Building}
          label="Managed companies"
          value={filteredOrganizations.length.toString()}
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
                subtitle={`14-day registrations for ${activeOrgName}`}
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
          <UserManagementSection rows={filteredUsers} columns={userColumns} scopeLabel="Partner scoped" />
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
            <DashboardErrorBoundary context="Company Admin organizations">
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
                {filteredOrganizations.map(company => (
                  <OrganizationCard key={company.name} {...company} onViewClick={() => handleViewOrganization(company.code)} />
                ))}
              </SimpleGrid>
            </DashboardErrorBoundary>
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
                  {filteredOrganizations.map(org => (
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
                        <Badge mt={2} colorScheme={(org.change ?? '0%').includes('-') ? 'red' : 'green'}>
                          {(org.change ?? '0%')} this week
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

  const renderOrganizations = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <HStack justify="space-between" align="center">
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight="bold" color="brand.text">Organizations</Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Showing {filteredOrganizations.length} organizations for {activeOrgName}
                </Text>
              </VStack>
              <Badge colorScheme="purple">Scoped</Badge>
            </HStack>
            {filteredOrganizations.length ? (
              <DashboardErrorBoundary context="Company Admin organizations">
                <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
                  {filteredOrganizations.map(org => (
                    <OrganizationCard key={org.name} {...org} onViewClick={() => handleViewOrganization(org.code)} />
                  ))}
                </SimpleGrid>
              </DashboardErrorBoundary>
            ) : (
              <Text fontSize="sm" color="brand.subtleText">
                No organizations are assigned to this account yet.
              </Text>
            )}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderReports = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <Text fontWeight="bold" color="brand.text">Reports</Text>
            <Text fontSize="sm" color="brand.subtleText">
              Analytics and engagement reports will appear here. Customize filters by organization to export scoped summaries.
            </Text>
            <Wrap spacing={3}>
              {['Engagement by org', 'At-risk trends', 'Data quality'].map(report => (
                <WrapItem key={report}>
                  <Box
                    p={3}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="brand.border"
                    bg="brand.accent"
                    minW="200px"
                  >
                    <Text fontWeight="semibold" color="brand.text">{report}</Text>
                    <Text fontSize="sm" color="brand.subtleText">Coming soon</Text>
                  </Box>
                </WrapItem>
              ))}
            </Wrap>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderSettings = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <Text fontWeight="bold" color="brand.text">Settings</Text>
            <Text fontSize="sm" color="brand.subtleText">
              Manage dashboard preferences, notification thresholds, and organization defaults.
            </Text>
            <Wrap spacing={3}>
              {['Notification rules', 'Organization defaults', 'Access control'].map(setting => (
                <WrapItem key={setting}>
                  <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                    <Text fontWeight="semibold" color="brand.text">{setting}</Text>
                    <Text fontSize="sm" color="brand.subtleText">Configuration coming soon</Text>
                  </Box>
                </WrapItem>
              ))}
            </Wrap>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderSupport = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <Text fontWeight="bold" color="brand.text">Support</Text>
            <Text fontSize="sm" color="brand.subtleText">
              Need help? Reach out to support or review the upcoming knowledge base articles for company admins.
            </Text>
            <Badge colorScheme="blue" w="fit-content">
              Live chat coming soon
            </Badge>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderPage = () => {
    switch (activePage) {
      case 'users':
        return (
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <UserManagementSection rows={filteredUsers} columns={userColumns} scopeLabel="Partner scoped" />
            </CardBody>
          </Card>
        )
      case 'organizations':
        return renderOrganizations()
      case 'reports':
        return renderReports()
      case 'settings':
        return renderSettings()
      case 'support':
        return renderSupport()
      case 'overview':
      default:
        return renderOverview()
    }
  }

  const handleNavigate = (key: string) => {
    const normalized = key as CompanyPageKey
    if (['overview', 'users', 'organizations', 'reports', 'settings', 'support'].includes(normalized)) {
      setActivePage(normalized)
    }
  }

  if (profileStatus !== 'ready') {
    return (
      <CompanyAdminLayout
        navSections={navSections}
        activeItem={activePage}
        onNavigate={handleNavigate}
        organizations={organizationOptions}
        selectedOrg={selectedOrg}
        onSelectOrg={setSelectedOrg}
      >
        <Stack spacing={4}>
          <Skeleton height="28px" width="240px" />
          <Text fontSize="sm" color="brand.subtleText">
            Loading profile...
          </Text>
          <Skeleton height="140px" borderRadius="md" />
          <Text fontSize="sm" color="brand.subtleText">
            Loading organizations...
          </Text>
          <Skeleton height="220px" borderRadius="md" />
        </Stack>
      </CompanyAdminLayout>
    )
  }

  return (
    <CompanyAdminLayout
      navSections={navSections}
      activeItem={activePage}
      onNavigate={handleNavigate}
      organizations={organizationOptions}
      selectedOrg={selectedOrg}
      onSelectOrg={setSelectedOrg}
    >
      {renderPage()}
    </CompanyAdminLayout>
  )
}

export default CompanyAdminDashboard
