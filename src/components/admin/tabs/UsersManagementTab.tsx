import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  Checkbox,
  Divider,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItem,
  MenuList,
  Select,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Tooltip,
  useToast,
} from '@chakra-ui/react'
import { ChevronLeft, ChevronRight, Eye, Filter, Search, Trash2 } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerAdminSnapshot } from '@/hooks/partner/usePartnerAdminSnapshot'
import {
  ManagedUserRecord,
  ManagedUserRole,
  MembershipStatus,
  bulkUpdateMembershipStatus,
  bulkUpdateRole,
  deleteUserAccount,
  updateMembershipStatus,
  updateUserRole,
} from '@/services/userManagementService'
import { fetchAdminOrganizationsList } from '@/services/admin/adminUsersService'
import { formatAdminFirestoreError } from '@/services/admin/adminErrors'

const roleOptions: ManagedUserRole[] = ['user', 'partner', 'admin', 'super_admin', 'team_leader', 'mentor', 'ambassador']
const membershipOptions: MembershipStatus[] = ['free', 'paid', 'inactive']
const PAGE_SIZE = 25

const formatDate = (date?: Date | null) => {
  if (!date) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const formatRoleLabel = (role: ManagedUserRole) => role.replace('_', ' ')

interface UsersManagementTabProps {
  users: ManagedUserRecord[]
  loading: boolean
}

export const UsersManagementTab = ({ users: propUsers, loading: propLoading }: UsersManagementTabProps) => {
  const toast = useToast()
  const { isAdmin, isSuperAdmin } = useAuth()
  const { assignedOrganizationIds } = usePartnerAdminSnapshot({ enabled: isAdmin && !isSuperAdmin })
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; code?: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [roleChangingId, setRoleChangingId] = useState<string | null>(null)
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    membershipStatus: 'all',
    organization: 'all',
    timeframe: 'all',
  })

  useEffect(() => {
    fetchAdminOrganizationsList()
      .then(setOrganizations)
      .catch((err) => {
        console.error(err)
        setError(formatAdminFirestoreError(err, 'Unable to load organizations.'))
      })
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filters.search, filters.role, filters.membershipStatus, filters.organization, filters.timeframe])

  const visibleTimeframeFilter = useMemo(() => propUsers.some((user) => !!user.lastActive), [propUsers])

  const accessibleUsers = useMemo(() => {
    if (isSuperAdmin || !assignedOrganizationIds?.length) return propUsers
    return propUsers.filter((user) => {
      const organizationId = user.companyId
      if (!organizationId) return false
      return assignedOrganizationIds.includes(organizationId)
    })
  }, [assignedOrganizationIds, isSuperAdmin, propUsers])

  const filteredUsers = useMemo(() => {
    const now = new Date()
    return accessibleUsers.filter((user) => {
      const searchText = filters.search.toLowerCase()
      const matchesSearch =
        user.name.toLowerCase().includes(searchText) ||
        (user.email || '').toLowerCase().includes(searchText) ||
        (user.companyCode || '').toLowerCase().includes(searchText)

      const matchesRole = filters.role === 'all' || user.role === filters.role
      const matchesMembership = filters.membershipStatus === 'all' || user.membershipStatus === filters.membershipStatus
      const matchesOrg =
        filters.organization === 'all' ||
        user.companyId === filters.organization

      const matchesTimeframe = (() => {
        if (filters.timeframe === 'all') return true
        if (!user.lastActive) return false
        const days = Number(filters.timeframe)
        const diff = (now.getTime() - user.lastActive.getTime()) / (1000 * 60 * 60 * 24)
        return diff <= days
      })()

      return matchesSearch && matchesRole && matchesMembership && matchesOrg && matchesTimeframe
    })
  }, [accessibleUsers, filters.membershipStatus, filters.organization, filters.role, filters.search, filters.timeframe])

  // Paginated slice
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredUsers.slice(start, start + PAGE_SIZE)
  }, [filteredUsers, page])

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE)

  const membershipBadgeColor: Record<MembershipStatus, string> = {
    free: 'orange',
    paid: 'green',
    inactive: 'gray',
  }

  const roleBadgeColor: Record<ManagedUserRole, string> = {
    user: 'gray',
    partner: 'purple',
    admin: 'teal',
    super_admin: 'pink',
    team_leader: 'orange',
    mentor: 'blue',
    ambassador: 'green',
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleRoleChange = async (userId: string, role: ManagedUserRole) => {
    if (!isSuperAdmin) return
    try {
      setRoleChangingId(userId)
      await updateUserRole(userId, role)
      toast({ title: 'Role updated', description: 'User role updated in Firebase', status: 'success' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to update role', status: 'error' })
    } finally {
      setRoleChangingId(null)
    }
  }

  const handleMembershipChange = async (userId: string, membershipStatus: MembershipStatus) => {
    try {
      setStatusChangingId(userId)
      await updateMembershipStatus(userId, membershipStatus)
      toast({ title: 'Status updated', description: 'Membership status updated in Firebase', status: 'success' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to update status', status: 'error' })
    } finally {
      setStatusChangingId(null)
    }
  }

  const handleBulkRole = async (role: ManagedUserRole) => {
    if (!selectedIds.length) return
    try {
      setBulkLoading(true)
      const result = await bulkUpdateRole(selectedIds, role)
      if (result.failedIds.length && result.successfulIds.length) {
        console.warn('[AdminUsers] Bulk role update partially failed', { failedIds: result.failedIds })
        toast({
          title: 'Roles partially updated',
          description: `${result.successfulIds.length} of ${selectedIds.length} users updated. ${result.failedIds.length} failed.`,
          status: 'warning',
        })
        setSelectedIds(result.failedIds)
      } else if (result.failedIds.length) {
        console.error('[AdminUsers] Bulk role update failed', { failedIds: result.failedIds })
        toast({
          title: 'Unable to update roles',
          description: 'No users were updated. Please retry.',
          status: 'error',
        })
      } else {
        toast({ title: 'Roles updated', description: 'Selected users updated', status: 'success' })
        setSelectedIds([])
      }
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to update roles', status: 'error' })
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkStatus = async (status: MembershipStatus) => {
    if (!selectedIds.length) return
    try {
      setBulkLoading(true)
      const result = await bulkUpdateMembershipStatus(selectedIds, status)
      if (result.failedIds.length && result.successfulIds.length) {
        console.warn('[AdminUsers] Bulk membership update partially failed', { failedIds: result.failedIds })
        toast({
          title: 'Membership partially updated',
          description: `${result.successfulIds.length} of ${selectedIds.length} users updated. ${result.failedIds.length} failed.`,
          status: 'warning',
        })
        setSelectedIds(result.failedIds)
      } else if (result.failedIds.length) {
        console.error('[AdminUsers] Bulk membership update failed', { failedIds: result.failedIds })
        toast({
          title: 'Unable to update membership',
          description: 'No users were updated. Please retry.',
          status: 'error',
        })
      } else {
        toast({ title: 'Membership updated', status: 'success' })
        setSelectedIds([])
      }
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to update membership', status: 'error' })
    } finally {
      setBulkLoading(false)
    }
  }

  const handleDelete = async (userId: string) => {
    const user = propUsers.find((u) => u.id === userId)
    const confirmMessage = `Are you sure you want to delete ${user?.name || 'this user'}? This action cannot be undone.`
    if (!window.confirm(confirmMessage)) return

    try {
      setStatusChangingId(userId)
      await deleteUserAccount(userId)
      toast({ title: 'User deleted', status: 'success' })
      setSelectedIds((prev) => prev.filter((id) => id !== userId))
    } catch (err) {
      console.error(err)
      toast({ title: 'Failed to delete user', status: 'error' })
    } finally {
      setStatusChangingId(null)
    }
  }

  const headerCheckboxChecked = selectedIds.length > 0 && selectedIds.length === filteredUsers.length
  const headerCheckboxIndeterminate = selectedIds.length > 0 && selectedIds.length < filteredUsers.length

  return (
    <Stack spacing={6}>
      <Stack spacing={1}>
        <Text fontSize="3xl" fontWeight="semibold" color="gray.800">
          User Management
        </Text>
        <Text color="gray.600">Search, filter, and manage user access across the platform.</Text>
      </Stack>

      <Card border="1px solid" borderColor="gray.200" borderRadius="2xl" bg="white">
        <CardBody>
          <Stack spacing={4}>
            <Flex direction={{ base: 'column', lg: 'row' }} gap={4} align={{ base: 'stretch', lg: 'center' }} justify="space-between">
              <InputGroup maxW={{ base: '100%', lg: '320px' }}>
                <InputLeftElement pointerEvents="none">
                  <Icon as={Search} color="gray.400" />
                </InputLeftElement>
                <Input
                  placeholder="Search by name, email, or code"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </InputGroup>

              <HStack spacing={3} flexWrap="wrap" justify={{ base: 'flex-start', lg: 'flex-end' }}>
                <Select
                  maxW="180px"
                  value={filters.role}
                  onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="all">All roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role.replace('_', ' ')}
                    </option>
                  ))}
                </Select>

                <Select
                  maxW="180px"
                  value={filters.membershipStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, membershipStatus: e.target.value }))}
                >
                  <option value="all">All membership</option>
                  {membershipOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>

                <Select
                  maxW="200px"
                  value={filters.organization}
                  onChange={(e) => setFilters((prev) => ({ ...prev, organization: e.target.value }))}
                >
                  <option value="all">All organizations</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>

                {visibleTimeframeFilter && (
                  <Select
                    maxW="180px"
                    value={filters.timeframe}
                    onChange={(e) => setFilters((prev) => ({ ...prev, timeframe: e.target.value }))}
                  >
                    <option value="all">All time</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </Select>
                )}

                <Button
                  leftIcon={<Icon as={Filter} boxSize={4} />}
                  variant="outline"
                  onClick={() => setFilters({ search: '', role: 'all', membershipStatus: 'all', organization: 'all', timeframe: 'all' })}
                >
                  Reset filters
                </Button>
              </HStack>
            </Flex>

            {selectedIds.length > 0 && (
              <Flex
                align="center"
                justify="space-between"
                bg="purple.50"
                border="1px solid"
                borderColor="purple.100"
                borderRadius="lg"
                p={3}
              >
                <Text fontWeight="medium" color="purple.700">
                  {selectedIds.length} selected
                </Text>
                <ButtonGroup size="sm" variant="solid" colorScheme="purple" isDisabled={bulkLoading || !isSuperAdmin}>
                  <Button onClick={() => handleBulkRole('partner')} isLoading={bulkLoading}>
                    Make Admin
                  </Button>
                  <Button onClick={() => handleBulkRole('user')} isLoading={bulkLoading}>
                    Make User
                  </Button>
                  <Button onClick={() => handleBulkStatus('inactive')} isLoading={bulkLoading}>
                    Deactivate
                  </Button>
                </ButtonGroup>
              </Flex>
            )}

            {/* Pagination controls (above table) */}
            {!propLoading && !error && filteredUsers.length > 0 && (
              <Flex justify="space-between" align="center" py={3} px={4} bg="gray.50" borderRadius="md">
                <Text fontSize="sm" color="gray.600">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
                </Text>
                <HStack spacing={2}>
                  <IconButton
                    aria-label="Previous page"
                    icon={<ChevronLeft size={16} />}
                    size="sm"
                    variant="outline"
                    isDisabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  />
                  <Text fontSize="sm" fontWeight="medium" minW="80px" textAlign="center">
                    Page {page} of {totalPages || 1}
                  </Text>
                  <IconButton
                    aria-label="Next page"
                    icon={<ChevronRight size={16} />}
                    size="sm"
                    variant="outline"
                    isDisabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  />
                </HStack>
              </Flex>
            )}

            <Box border="1px solid" borderColor="gray.200" borderRadius="xl" overflowX="auto">
              {propLoading ? (
                <Flex py={10} justify="center" align="center" gap={3}>
                  <Spinner color="purple.500" />
                  <Text color="gray.600">Loading users…</Text>
                </Flex>
              ) : error ? (
                <Flex py={6} justify="center" align="center">
                  <Text color="red.500">{error}</Text>
                </Flex>
              ) : (
                <Table size="sm" minW="1000px">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th w="50px">
                        <Checkbox
                          isChecked={headerCheckboxChecked}
                          isIndeterminate={headerCheckboxIndeterminate}
                          onChange={(e) => setSelectedIds(e.target.checked ? filteredUsers.map((u) => u.id) : [])}
                          aria-label="Select all"
                        />
                      </Th>
                      <Th>User</Th>
                      <Th>Role</Th>
                      <Th>Status</Th>
                      <Th>Organization</Th>
                      <Th>Last Active</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paginatedUsers.map((user) => {
                      const promoteBusy = roleChangingId === user.id || statusChangingId === user.id
                      return (
                        <Tr key={user.id} _hover={{ bg: 'gray.50' }}>
                        <Td>
                          <Checkbox
                            isChecked={selectedIds.includes(user.id)}
                            onChange={() => toggleSelect(user.id)}
                            aria-label={`Select ${user.name}`}
                          />
                        </Td>
                        <Td>
                          <Stack spacing={0}>
                            <Text fontWeight="semibold" color="gray.800">
                              {user.name}
                            </Text>
                            <Text fontSize="sm" color="gray.500">
                              {user.email || 'No email on file'}
                            </Text>
                          </Stack>
                        </Td>
                        <Td>
                          <Badge colorScheme={roleBadgeColor[user.role]} textTransform="capitalize">
                            {formatRoleLabel(user.role)}
                          </Badge>
                        </Td>
                        <Td>
                          <Badge colorScheme={membershipBadgeColor[user.membershipStatus]} textTransform="capitalize">
                            {user.membershipStatus}
                          </Badge>
                        </Td>
                        <Td>
                          {user.companyName ? (
                            <Stack spacing={0}>
                              <Text fontWeight="medium" color="gray.800">
                                {user.companyName}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {user.companyCode || '—'}
                              </Text>
                            </Stack>
                          ) : (
                            <Badge colorScheme="purple" variant="subtle">
                              Independent
                            </Badge>
                          )}
                        </Td>
                        <Td>{formatDate(user.lastActive)}</Td>
                        <Td>
                          <HStack spacing={2} justify="flex-end">
                            <Tooltip label="View and edit profile">
                              <Button
                                as={RouterLink}
                                to={`${window.location.pathname.startsWith('/partner') ? '/partner' : '/admin'}/user/${user.id}`}
                                size="sm"
                                variant="outline"
                                colorScheme="purple"
                                leftIcon={<Eye size={16} />}
                              >
                                View profile
                              </Button>
                            </Tooltip>
                            {isSuperAdmin && (
                              <>
                                <Menu>
                                  <MenuButton
                                    as={Button}
                                    size="sm"
                                    variant="outline"
                                    colorScheme="purple"
                                    isDisabled={promoteBusy}
                                    isLoading={promoteBusy}
                                  >
                                    Promote
                                  </MenuButton>
                                  <MenuList>
                                    <MenuGroup title="Change role">
                                      {roleOptions.map((role) => (
                                        <MenuItem
                                          key={role}
                                          onClick={() => handleRoleChange(user.id, role)}
                                          isDisabled={role === user.role}
                                        >
                                          {formatRoleLabel(role)}
                                        </MenuItem>
                                      ))}
                                    </MenuGroup>
                                    <MenuDivider />
                                    <MenuGroup title="Membership status">
                                      {membershipOptions.map((status) => (
                                        <MenuItem
                                          key={status}
                                          onClick={() => handleMembershipChange(user.id, status)}
                                          isDisabled={status === user.membershipStatus}
                                        >
                                          {status}
                                        </MenuItem>
                                      ))}
                                    </MenuGroup>
                                  </MenuList>
                                </Menu>
                                <IconButton
                                  aria-label={`Delete ${user.name}`}
                                  icon={<Trash2 size={16} />}
                                  variant="outline"
                                  colorScheme="red"
                                  size="sm"
                                  onClick={() => handleDelete(user.id)}
                                  isLoading={statusChangingId === user.id}
                                />
                              </>
                            )}
                          </HStack>
                        </Td>
                        </Tr>
                    )
                    })}

                    {!filteredUsers.length && (
                      <Tr>
                        <Td colSpan={7}>
                          <Flex py={10} direction="column" align="center" gap={2}>
                            <Text color="gray.700" fontWeight="medium">
                              No users found for the current filters.
                            </Text>
                            <Text color="gray.500" fontSize="sm">
                              Adjust your search, role, or organization filters to see more users.
                            </Text>
                          </Flex>
                        </Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              )}
            </Box>
          </Stack>
        </CardBody>
      </Card>
      <Divider />
    </Stack>
  )
}
