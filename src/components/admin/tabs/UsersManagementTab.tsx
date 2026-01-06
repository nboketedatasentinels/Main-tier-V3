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
import { ChevronDown, Eye, Filter, Search, Trash2 } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  ManagedUserRecord,
  ManagedUserRole,
  MembershipStatus,
  bulkUpdateMembershipStatus,
  bulkUpdateRole,
  deleteUserAccount,
  fetchOrganizationsList,
  listenToUsers,
  updateMembershipStatus,
  updateUserRole,
} from '@/services/userManagementService'

const roleOptions: ManagedUserRole[] = ['user', 'partner', 'super_admin', 'team_leader', 'mentor', 'ambassador']
const membershipOptions: MembershipStatus[] = ['free', 'paid', 'inactive']

const formatDate = (date?: Date | null) => {
  if (!date) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export const UsersManagementTab = () => {
  const toast = useToast()
  const { isSuperAdmin, assignedOrganizations } = useAuth()
  const [users, setUsers] = useState<ManagedUserRecord[]>([])
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; code?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [roleChangingId, setRoleChangingId] = useState<string | null>(null)
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    membershipStatus: 'all',
    organization: 'all',
    timeframe: 'all',
  })

  useEffect(() => {
    const unsub = listenToUsers((records) => {
      setUsers(records)
      setLoading(false)
    })

    fetchOrganizationsList()
      .then(setOrganizations)
      .catch((err) => {
        console.error(err)
        setError('Unable to load organizations')
      })

    return () => unsub()
  }, [])

  const visibleTimeframeFilter = useMemo(() => users.some((user) => !!user.lastActive), [users])

  const accessibleUsers = useMemo(() => {
    if (isSuperAdmin || !assignedOrganizations?.length) return users
    return users.filter((user) => {
      if (!user.companyCode) return false
      return assignedOrganizations.includes(user.companyCode)
    })
  }, [assignedOrganizations, isSuperAdmin, users])

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
        user.companyId === filters.organization ||
        user.companyCode === filters.organization

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

  const membershipBadgeColor: Record<MembershipStatus, string> = {
    free: 'orange',
    paid: 'green',
    inactive: 'gray',
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
      await bulkUpdateRole(selectedIds, role)
      toast({ title: 'Roles updated', description: 'Selected users updated', status: 'success' })
      setSelectedIds([])
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
      await bulkUpdateMembershipStatus(selectedIds, status)
      toast({ title: 'Membership updated', status: 'success' })
      setSelectedIds([])
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to update membership', status: 'error' })
    } finally {
      setBulkLoading(false)
    }
  }

  const handleDelete = async (userId: string) => {
    const user = users.find((u) => u.id === userId)
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
                    <option key={org.id} value={org.code || org.id}>
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

            <Box border="1px solid" borderColor="gray.200" borderRadius="xl" overflowX="auto">
              {loading ? (
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
                          isIndeterminate={selectedIds.length > 0 && selectedIds.length < filteredUsers.length}
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
                    {filteredUsers.map((user) => (
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
                          <Menu>
                            <MenuButton
                              as={Button}
                              size="sm"
                              variant="outline"
                              rightIcon={<ChevronDown size={14} />}
                              isDisabled={!isSuperAdmin || roleChangingId === user.id}
                              isLoading={roleChangingId === user.id}
                            >
                              {user.role}
                            </MenuButton>
                            <MenuList>
                              {roleOptions.map((role) => (
                                <MenuItem key={role} onClick={() => handleRoleChange(user.id, role)}>
                                  {role.replace('_', ' ')}
                                </MenuItem>
                              ))}
                            </MenuList>
                          </Menu>
                        </Td>
                        <Td>
                          <Menu>
                            <MenuButton
                              as={Button}
                              size="sm"
                              variant="outline"
                              rightIcon={<ChevronDown size={14} />}
                              isLoading={statusChangingId === user.id}
                            >
                              <Badge colorScheme={membershipBadgeColor[user.membershipStatus]} textTransform="capitalize">
                                {user.membershipStatus}
                              </Badge>
                            </MenuButton>
                            <MenuList>
                              {membershipOptions.map((status) => (
                                <MenuItem key={status} onClick={() => handleMembershipChange(user.id, status)}>
                                  {status}
                                </MenuItem>
                              ))}
                            </MenuList>
                          </Menu>
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
                                to={`/admin/user/${user.id}`}
                                size="sm"
                                variant="outline"
                                colorScheme="purple"
                                leftIcon={<Eye size={16} />}
                              >
                                View profile
                              </Button>
                            </Tooltip>
                            {isSuperAdmin && (
                              <IconButton
                                aria-label={`Delete ${user.name}`}
                                icon={<Trash2 size={16} />}
                                variant="outline"
                                colorScheme="red"
                                size="sm"
                                onClick={() => handleDelete(user.id)}
                                isLoading={statusChangingId === user.id}
                              />
                            )}
                          </HStack>
                        </Td>
                      </Tr>
                    ))}

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
