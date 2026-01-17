import { useMemo, useState } from 'react'
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
  updateMembershipStatus,
  updateUserRole,
} from '@/services/userManagementService'

/* ------------------------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------------------------ */

interface UsersManagementTabProps {
  users: ManagedUserRecord[]
  loading: boolean
}

/* ------------------------------------------------------------------ */
/* CONSTANTS */
/* ------------------------------------------------------------------ */

const roleOptions: ManagedUserRole[] = ['user', 'partner', 'mentor', 'ambassador', 'super_admin']
const membershipOptions: MembershipStatus[] = ['free', 'paid', 'inactive']

const membershipBadgeColor: Record<MembershipStatus, string> = {
  free: 'orange',
  paid: 'green',
  inactive: 'gray',
}

const formatDate = (date?: Date | null) =>
  date
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date)
    : '—'

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */

export const UsersManagementTab = ({ users, loading }: UsersManagementTabProps) => {
  const toast = useToast()
  const { isSuperAdmin, assignedOrganizations } = useAuth()

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

  /* ------------------------------------------------------------------ */
  /* ACCESS CONTROL (PURE, DERIVED) */
  /* ------------------------------------------------------------------ */

  const accessibleUsers = useMemo(() => {
    if (isSuperAdmin || !assignedOrganizations?.length) return users
    return users.filter((u) => u.companyId && assignedOrganizations.includes(u.companyId))
  }, [users, isSuperAdmin, assignedOrganizations])

  /* ------------------------------------------------------------------ */
  /* FILTERING (PURE) */
  /* ------------------------------------------------------------------ */

  const filteredUsers = useMemo(() => {
    const now = new Date()

    return accessibleUsers.filter((user) => {
      const search = filters.search.toLowerCase()

      const matchesSearch =
        user.name.toLowerCase().includes(search) ||
        (user.email || '').toLowerCase().includes(search) ||
        (user.companyCode || '').toLowerCase().includes(search)

      const matchesRole = filters.role === 'all' || user.role === filters.role
      const matchesMembership =
        filters.membershipStatus === 'all' || user.membershipStatus === filters.membershipStatus

      const matchesOrg =
        filters.organization === 'all' ||
        user.companyId === filters.organization ||
        user.companyCode === filters.organization

      const matchesTimeframe = (() => {
        if (filters.timeframe === 'all') return true
        if (!user.lastActive) return false
        const days = Number(filters.timeframe)
        const diffDays = (now.getTime() - user.lastActive.getTime()) / (1000 * 60 * 60 * 24)
        return diffDays <= days
      })()

      return matchesSearch && matchesRole && matchesMembership && matchesOrg && matchesTimeframe
    })
  }, [accessibleUsers, filters])

  /* ------------------------------------------------------------------ */
  /* SELECTION */
  /* ------------------------------------------------------------------ */

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const allSelected =
    selectedIds.length > 0 && selectedIds.length === filteredUsers.length

  /* ------------------------------------------------------------------ */
  /* ACTIONS */
  /* ------------------------------------------------------------------ */

  const handleRoleChange = async (userId: string, role: ManagedUserRole) => {
    if (!isSuperAdmin) return
    try {
      setRoleChangingId(userId)
      await updateUserRole(userId, role)
      toast({ title: 'Role updated', status: 'success' })
    } catch {
      toast({ title: 'Failed to update role', status: 'error' })
    } finally {
      setRoleChangingId(null)
    }
  }

  const handleMembershipChange = async (userId: string, status: MembershipStatus) => {
    try {
      setStatusChangingId(userId)
      await updateMembershipStatus(userId, status)
      toast({ title: 'Membership updated', status: 'success' })
    } catch {
      toast({ title: 'Failed to update membership', status: 'error' })
    } finally {
      setStatusChangingId(null)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) return
    try {
      setStatusChangingId(userId)
      await deleteUserAccount(userId)
      toast({ title: 'User deleted', status: 'success' })
      setSelectedIds((prev) => prev.filter((id) => id !== userId))
    } catch {
      toast({ title: 'Failed to delete user', status: 'error' })
    } finally {
      setStatusChangingId(null)
    }
  }

  /* ------------------------------------------------------------------ */
  /* RENDER */
  /* ------------------------------------------------------------------ */

  return (
    <Stack spacing={6}>
      <Text fontSize="3xl" fontWeight="semibold">
        User Management
      </Text>

      <Card border="1px solid" borderColor="gray.200" borderRadius="2xl">
        <CardBody>
          {loading ? (
            <Flex py={10} justify="center" align="center" gap={3}>
              <Spinner color="purple.500" />
              <Text>Loading users…</Text>
            </Flex>
          ) : (
            <Box overflowX="auto">
              <Table size="sm" minW="1000px">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>
                      <Checkbox
                        isChecked={allSelected}
                        isIndeterminate={selectedIds.length > 0 && !allSelected}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? filteredUsers.map((u) => u.id) : [])
                        }
                      />
                    </Th>
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Organization</Th>
                    <Th>Last Active</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredUsers.map((user) => (
                    <Tr key={user.id}>
                      <Td>
                        <Checkbox
                          isChecked={selectedIds.includes(user.id)}
                          onChange={() => toggleSelect(user.id)}
                        />
                      </Td>
                      <Td>
                        <Text fontWeight="medium">{user.name}</Text>
                        <Text fontSize="sm" color="gray.500">
                          {user.email || '—'}
                        </Text>
                      </Td>
                      <Td>
                        <Menu>
                          <MenuButton
                            as={Button}
                            size="sm"
                            variant="outline"
                            rightIcon={<ChevronDown size={14} />}
                            isDisabled={!isSuperAdmin || roleChangingId === user.id}
                          >
                            {user.role}
                          </MenuButton>
                          <MenuList>
                            {roleOptions.map((role) => (
                              <MenuItem key={role} onClick={() => handleRoleChange(user.id, role)}>
                                {role}
                              </MenuItem>
                            ))}
                          </MenuList>
                        </Menu>
                      </Td>
                      <Td>
                        <Badge colorScheme={membershipBadgeColor[user.membershipStatus]}>
                          {user.membershipStatus}
                        </Badge>
                      </Td>
                      <Td>{user.companyName || 'Independent'}</Td>
                      <Td>{formatDate(user.lastActive)}</Td>
                      <Td>
                        <HStack spacing={2}>
                          <Button
                            as={RouterLink}
                            to={`/admin/user/${user.id}`}
                            size="sm"
                            variant="outline"
                          >
                            <Eye size={14} />
                          </Button>
                          {isSuperAdmin && (
                            <IconButton
                              aria-label="Delete"
                              icon={<Trash2 size={14} />}
                              size="sm"
                              colorScheme="red"
                              onClick={() => handleDelete(user.id)}
                              isLoading={statusChangingId === user.id}
                            />
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </CardBody>
      </Card>

      <Divider />
    </Stack>
  )
}
