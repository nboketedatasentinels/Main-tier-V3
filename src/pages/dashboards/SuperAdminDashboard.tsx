import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { BadgeProps } from '@chakra-ui/react'
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
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Filter,
  Gauge,
  GitBranch,
  List,
  Menu as MenuIcon,
  MoreHorizontal,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { MetricCard } from '@/components/admin/MetricCard'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { AdminNotificationsList } from '@/components/admin/AdminNotificationsList'
import { RiskAnalysisCard, RiskLevel, RiskReason } from '@/components/admin/RiskAnalysisCard'
import { OrganizationFormModal } from '@/components/super-admin/OrganizationFormModal'
import { AssignPartnerModal } from '@/components/super-admin/AssignPartnerModal'
import { ConfirmationDialog } from '@/components/super-admin/ConfirmationDialog'
import {
  assignPartner,
  createOrganization,
  deleteOrganization,
  fetchAdminActivityLog,
  fetchDashboardMetrics,
  fetchEngagementRiskAggregates,
  fetchRegistrationTrend,
  fetchOrganizations,
  fetchUserGrowthTrend,
  listenToRegistrations,
  listenToSystemAlerts,
  listenToTaskNotifications,
  listenToVerificationRequests,
  logAdminAction,
  updateOrganization,
} from '@/services/superAdminService'
import {
  AdminActivityLogEntry,
  EngagementRiskAggregate,
  OrganizationRecord,
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout'

type SortKey = keyof Pick<OrganizationRecord, 'name' | 'code' | 'teamSize' | 'status' | 'transformationPartner'>
type StreamCardItem =
  | VerificationRequest
  | RegistrationRecord
  | SystemAlertRecord
  | TaskNotificationRecord

const defaultMetrics: SuperAdminDashboardMetrics = {
  organizationCount: 0,
  managedCompanies: 0,
  paidMembers: 0,
  activeMembers: 0,
  engagementRate: 0,
  newRegistrations: 0,
}

type TrendPoint = { label: string; value: number }

export const SuperAdminDashboard: React.FC = () => {
  const { profile } = useAuth()
  const adminName = profile?.fullName || profile?.firstName || 'Admin'
  const toast = useToast()

  const [metrics, setMetrics] = useState<SuperAdminDashboardMetrics>(defaultMetrics)
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
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

  const [filters, setFilters] = useState({ search: '', status: 'all', village: 'all', cluster: 'all' })
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const [selectedOrg, setSelectedOrg] = useState<OrganizationRecord | null>(null)
  const [pendingDelete, setPendingDelete] = useState<OrganizationRecord | null>(null)

  const createModal = useDisclosure()
  const editModal = useDisclosure()
  const assignModal = useDisclosure()
  const drawer = useDisclosure()
  const confirmDialog = useDisclosure()

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const [fetchedMetrics, orgs, risks, audit, registrations, growth] = await Promise.all([
        fetchDashboardMetrics(),
        fetchOrganizations(),
        fetchEngagementRiskAggregates(),
        fetchAdminActivityLog(),
        fetchRegistrationTrend(),
        fetchUserGrowthTrend(),
      ])
      setMetrics(fetchedMetrics)
      setOrganizations(orgs)
      setRiskAggregate(risks)
      setActivityLog(audit)
      setRegistrationTrend(registrations)
      setUserGrowthTrend(growth)
    } catch (err) {
      console.error(err)
      setError('Unable to load super admin data from Firebase')
    } finally {
      setLoading(false)
    }
  }, [])

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

  const handleCreateOrg = async (org: OrganizationRecord) => {
    const id = await createOrganization(org)
    const newOrg = { ...org, id }
    setOrganizations((prev) => [newOrg, ...prev])
    await logAdminAction({
      action: 'Organization created',
      organizationName: org.name,
      organizationCode: org.code,
      adminId: profile?.id,
      adminName,
      metadata: { via: 'dashboard' },
    })
    toast({ title: 'Organization created', status: 'success' })
    createModal.onClose()
  }

  const handleEditOrg = async (updates: OrganizationRecord) => {
    if (!selectedOrg?.id) return
    await updateOrganization(selectedOrg.id, updates)
    setOrganizations((prev) => prev.map((org) => (org.id === selectedOrg.id ? { ...org, ...updates } : org)))
    await logAdminAction({
      action: 'Organization updated',
      organizationName: updates.name,
      organizationCode: updates.code,
      adminId: profile?.id,
      adminName,
    })
    toast({ title: 'Organization updated', status: 'success' })
    editModal.onClose()
  }

  const handleDeleteOrg = async () => {
    if (!pendingDelete?.id) return
    await deleteOrganization(pendingDelete.id)
    setOrganizations((prev) => prev.filter((org) => org.id !== pendingDelete.id))
    await logAdminAction({
      action: 'Organization deleted',
      organizationName: pendingDelete.name,
      organizationCode: pendingDelete.code,
      adminId: profile?.id,
      adminName,
    })
    toast({ title: 'Organization deleted', status: 'info' })
    confirmDialog.onClose()
  }

  const handleAssignPartner = async (partnerName: string) => {
    if (!selectedOrg?.id) return
    await assignPartner(selectedOrg.id, partnerName)
    setOrganizations((prev) => prev.map((org) => (org.id === selectedOrg.id ? { ...org, transformationPartner: partnerName } : org)))
    await logAdminAction({
      action: 'Partner assignment updated',
      organizationName: selectedOrg.name,
      organizationCode: selectedOrg.code,
      adminId: profile?.id,
      adminName,
      metadata: { partnerName },
    })
    toast({ title: 'Partner updated', status: 'success' })
    assignModal.onClose()
  }

  const statusCounts = useMemo(() => {
    return organizations.reduce(
      (acc, org) => {
        acc[org.status] = (acc[org.status] || 0) + 1
        return acc
      },
      { active: 0, inactive: 0, pending: 0, suspended: 0, watch: 0 } as Record<string, number>,
    )
  }, [organizations])

  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      const matchesSearch = `${org.name} ${org.code} ${org.village || ''} ${org.cluster || ''}`
        .toLowerCase()
        .includes(filters.search.toLowerCase())
      const matchesStatus = filters.status === 'all' || org.status === filters.status
      const matchesVillage = filters.village === 'all' || org.village === filters.village
      const matchesCluster = filters.cluster === 'all' || org.cluster === filters.cluster
      return matchesSearch && matchesStatus && matchesVillage && matchesCluster
    })
  }, [filters, organizations])

  const sortedOrganizations = useMemo(() => {
    return [...filteredOrganizations].sort((a, b) => {
      const aVal = a[sortKey] || ''
      const bVal = b[sortKey] || ''
      if (aVal === bVal) return 0
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1
      return aVal < bVal ? 1 : -1
    })
  }, [filteredOrganizations, sortDir, sortKey])

  const paginatedOrganizations = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedOrganizations.slice(start, start + pageSize)
  }, [page, pageSize, sortedOrganizations])

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const renderStatusBadge = (status: OrganizationRecord['status']) => {
    const mapping: Record<string, string> = {
      active: 'green',
      pending: 'orange',
      inactive: 'gray',
      suspended: 'red',
      watch: 'yellow',
    }
    return <Badge colorScheme={mapping[status] || 'gray'} textTransform="capitalize">{status}</Badge>
  }

  const statusOptions = ['all', 'active', 'inactive', 'pending', 'suspended', 'watch']

  const notificationBadge = useMemo(
    () => verificationRequests.length + systemAlerts.length + taskNotifications.length,
    [systemAlerts.length, taskNotifications.length, verificationRequests.length],
  )

  return (
    <SuperAdminLayout
      activeItem="overview"
      adminName={adminName}
      avatarUrl={profile?.avatarUrl}
      notificationCount={notificationBadge}
    >
      <Stack spacing={10} bg="gray.50" p={{ base: 4, md: 6 }} borderRadius="2xl" border="1px solid" borderColor="gray.200">
        <Card bg="white" border="1px solid" borderColor="gray.200" borderRadius="2xl" shadow="sm">
          <CardBody>
            <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={6} wrap="wrap">
              <Stack spacing={3} maxW="800px">
              <HStack spacing={3}>
                <Badge colorScheme="purple" px={3} py={1} borderRadius="full" display="inline-flex" alignItems="center">
                  <ShieldAlert size={14} style={{ marginRight: 8 }} /> ADMIN CONTROL CENTER
                </Badge>
                <Badge colorScheme="green" variant="subtle">
                  Firebase live
                </Badge>
              </HStack>
              <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" color="gray.900">
                Welcome back, {adminName}.
              </Text>
              <Text color="gray.700" fontSize={{ base: 'md', md: 'lg' }}>
                Monitor learner activity, manage badges, and configure settings across the platform in one unified view. You
                currently oversee {metrics.organizationCount.toLocaleString()} organizations.
              </Text>
              <HStack spacing={3} wrap="wrap">
                <Button leftIcon={<Settings size={16} />} variant="outline" colorScheme="purple">
                  Settings
                </Button>
                <Button leftIcon={<UploadCloud size={16} />} colorScheme="purple" variant="solid">
                  Export reports
                </Button>
                <Button leftIcon={<Bell size={16} />} onClick={drawer.onOpen} variant="ghost">
                  Notification drawer
                </Button>
              </HStack>
            </Stack>
            <Avatar
              size="xl"
              name={adminName}
              src={profile?.avatarUrl}
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

      {loading ? (
        <Flex justify="center" align="center" py={12}>
          <Spinner size="xl" />
        </Flex>
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
              icon={Gauge}
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
                  <EngagementChart
                    data={registrationTrend}
                    title="Engagement trends"
                    subtitle="Last 14 days"
                    valueLabel="Registrations"
                  />
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
                      <Button leftIcon={<List size={16} />} variant="outline" onClick={() => createModal.onOpen()}>
                        Create organization
                      </Button>
                      <Button leftIcon={<TrendingUp size={16} />} variant="ghost">
                        Engagement insights
                      </Button>
                      <Button leftIcon={<ShieldAlert size={16} />} variant="ghost">
                        Security rules
                      </Button>
                      <Button leftIcon={<GitBranch size={16} />} variant="ghost">
                        Audit activity
                      </Button>
                    </SimpleGrid>
                  </Stack>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>

          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={6}>
                <HStack justify="space-between" align={{ base: 'flex-start', md: 'center' }} flexDir={{ base: 'column', md: 'row' }} gap={3}>
                  <Stack spacing={1}>
                    <Text fontWeight="bold" color="brand.text">
                      Organization management
                    </Text>
                    <Text fontSize="sm" color="brand.subtleText">
                      Filter by status, village, or cluster. Client-side filtering and sorting keep the experience fast.
                    </Text>
                  </Stack>
                  <HStack spacing={3}>
                    <InputGroup maxW="260px">
                      <InputLeftElement pointerEvents="none">
                        <Search size={16} />
                      </InputLeftElement>
                      <Input
                        placeholder="Search organizations"
                        value={filters.search}
                        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                      />
                    </InputGroup>
                    <Select w="150px" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status === 'all' ? 'All statuses' : status}
                        </option>
                      ))}
                    </Select>
                    <Button leftIcon={<Filter size={16} />} variant="outline" onClick={() => setFilters({ search: '', status: 'all', village: 'all', cluster: 'all' })}>
                      Clear filters
                    </Button>
                    <Button colorScheme="purple" onClick={createModal.onOpen} leftIcon={<Sparkles size={16} />}>
                      Create organization
                    </Button>
                  </HStack>
                </HStack>

                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                  <StatusSummary label="Active" value={statusCounts.active} color="green" />
                  <StatusSummary label="Pending" value={statusCounts.pending} color="orange" />
                  <StatusSummary label="Suspended" value={statusCounts.suspended} color="red" />
                  <StatusSummary label="Watch" value={statusCounts.watch} color="yellow" />
                </SimpleGrid>

                <Box border="1px solid" borderColor="brand.border" borderRadius="md" overflowX="auto">
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Actions</Th>
                        <Th cursor="pointer" onClick={() => handleSort('name')}>
                          Name
                        </Th>
                        <Th cursor="pointer" onClick={() => handleSort('code')}>
                          Code
                        </Th>
                        <Th>Team size</Th>
                        <Th>Status</Th>
                        <Th>Transformation partner</Th>
                        <Th>Created</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {paginatedOrganizations.map((org) => (
                        <Tr key={org.id || org.code} _hover={{ bg: 'gray.50' }}>
                          <Td>
                            <Menu>
                              <MenuButton as={IconButton} icon={<MoreHorizontal size={16} />} aria-label="Actions" size="sm" variant="ghost" />
                              <MenuList>
                                <MenuItem onClick={() => { setSelectedOrg(org); editModal.onOpen() }}>Edit organization</MenuItem>
                                <MenuItem onClick={() => { setSelectedOrg(org); assignModal.onOpen() }}>Assign partner</MenuItem>
                                <MenuItem onClick={() => { setPendingDelete(org); confirmDialog.onOpen() }} color="red.500">
                                  Delete
                                </MenuItem>
                              </MenuList>
                            </Menu>
                          </Td>
                          <Td fontWeight="semibold">{org.name}</Td>
                          <Td>{org.code}</Td>
                          <Td>{org.teamSize || 0}</Td>
                          <Td>{renderStatusBadge(org.status)}</Td>
                          <Td>{org.transformationPartner || 'Unassigned'}</Td>
                          <Td>{org.createdAt?.toDate ? org.createdAt.toDate().toLocaleDateString() : (org.createdAt as string) || '—'}</Td>
                        </Tr>
                      ))}
                      {!paginatedOrganizations.length && (
                        <Tr>
                          <Td colSpan={7} textAlign="center" py={6}>
                            <Text color="gray.600">No organizations match the current filters.</Text>
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>

                <Flex justify="space-between" align="center" gap={3} wrap="wrap">
                  <HStack spacing={2}>
                    <Text fontSize="sm" color="gray.600">
                      Rows per page
                    </Text>
                    <Select w="90px" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </Select>
                  </HStack>
                  <HStack spacing={2}>
                    <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={page === 1}>
                      Prev
                    </Button>
                    <Text fontSize="sm">Page {page}</Text>
                    <Button
                      size="sm"
                      onClick={() => setPage((p) => (p * pageSize < sortedOrganizations.length ? p + 1 : p))}
                      isDisabled={page * pageSize >= sortedOrganizations.length}
                    >
                      Next
                    </Button>
                  </HStack>
                </Flex>
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
                        Notification streams
                      </Text>
                      <Badge colorScheme="blue">Real-time</Badge>
                    </HStack>
                    {streamsLoading && (
                      <Flex justify="center" py={4}>
                        <Spinner />
                      </Flex>
                    )}
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <NotificationStreamCard
                        title="Pending verifications"
                        items={verificationRequests}
                        icon={<CheckCircle2 size={16} />}
                        color="purple"
                        emptyLabel="No pending verifications"
                      />
                      <NotificationStreamCard
                        title="New registrations"
                        items={registrations}
                        icon={<Users size={16} />}
                        color="teal"
                        emptyLabel="No registrations"
                      />
                      <NotificationStreamCard
                        title="System health alerts"
                        items={systemAlerts}
                        icon={<AlertTriangle size={16} />}
                        color="red"
                        emptyLabel="No system alerts"
                      />
                      <NotificationStreamCard
                        title="Task notifications"
                        items={taskNotifications}
                        icon={<MenuIcon size={16} />}
                        color="orange"
                        emptyLabel="No tasks"
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
                      <Text fontWeight="bold" color="brand.text">
                        Recent admin activity
                      </Text>
                      <Badge colorScheme="purple">Audit trail</Badge>
                    </HStack>
                    <Stack spacing={3}>
                      {activityLog.map((entry) => (
                        <HStack key={entry.id} p={3} borderRadius="md" border="1px solid" borderColor="brand.border" justify="space-between" align="flex-start">
                          <Stack spacing={1}>
                            <Text fontWeight="semibold" color="brand.text">
                              {entry.action}
                            </Text>
                            <Text fontSize="sm" color="brand.subtleText">
                              {entry.adminName || 'Unknown admin'} • {entry.organizationName || 'All orgs'}
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

      <OrganizationFormModal isOpen={createModal.isOpen} onClose={createModal.onClose} onSubmit={handleCreateOrg} mode="create" />
      <OrganizationFormModal
        isOpen={editModal.isOpen}
        onClose={() => {
          setSelectedOrg(null)
          editModal.onClose()
        }}
        initialData={selectedOrg || undefined}
        onSubmit={handleEditOrg}
        mode="edit"
      />
      <AssignPartnerModal
        isOpen={assignModal.isOpen}
        onClose={() => {
          setSelectedOrg(null)
          assignModal.onClose()
        }}
        organization={selectedOrg || undefined}
        onSubmit={handleAssignPartner}
      />
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => {
          setPendingDelete(null)
          confirmDialog.onClose()
        }}
        title="Delete organization"
        description="This action removes the organization and related assignments."
        onConfirm={handleDeleteOrg}
        confirmLabel="Delete"
      />

      <Drawer isOpen={drawer.isOpen} placement="right" onClose={drawer.onClose} size="md">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>Admin notifications</DrawerHeader>
          <DrawerBody>
            <AdminNotificationsList />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      </Stack>
    </SuperAdminLayout>
  )
}

const StatusSummary = ({ label, value, color }: { label: string; value: number; color: NonNullable<BadgeProps['colorScheme']> }) => (
  <Box p={4} border="1px solid" borderColor="brand.border" borderRadius="md" bg="brand.accent">
    <Text fontSize="sm" color="brand.subtleText">
      {label}
    </Text>
    <HStack spacing={2} mt={2}>
      <Badge colorScheme={color}>{label}</Badge>
      <Text fontWeight="bold" color="brand.text">
        {value}
      </Text>
    </HStack>
  </Box>
)

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
  color: NonNullable<BadgeProps['colorScheme']>
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
      {items.map((item) => (
        <Box key={item.id} p={2} borderRadius="md" border="1px solid" borderColor="brand.border" bg="white">
          <Text fontWeight="semibold" color="brand.text">
            {item.title || item.name || item.userName || 'Item'}
          </Text>
          <Text fontSize="sm" color="brand.subtleText">
            {item.message || item.email || item.activityTitle || 'No details provided'}
          </Text>
        </Box>
      ))}
      {!items.length && (
        <Text color="gray.600" fontSize="sm">
          {emptyLabel}
        </Text>
      )}
    </Stack>
  </Box>
)
