import React, { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
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
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { Filter, MoreHorizontal, Search, Shield, UserPlus, Users } from 'lucide-react'

type UserRecord = {
  id: string
  name: string
  email: string
  organization: string
  role: 'member' | 'manager' | 'admin'
  status: 'active' | 'suspended' | 'invited'
  engagementScore: number
  lastActive: string
}

const sampleUsers: UserRecord[] = [
  {
    id: '1',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    organization: 'Org A',
    role: 'admin',
    status: 'active',
    engagementScore: 92,
    lastActive: 'Today',
  },
  {
    id: '2',
    name: 'Bri Martinez',
    email: 'bri@example.com',
    organization: 'Org B',
    role: 'manager',
    status: 'active',
    engagementScore: 78,
    lastActive: '1d ago',
  },
  {
    id: '3',
    name: 'Chris Lee',
    email: 'chris@example.com',
    organization: 'Org A',
    role: 'member',
    status: 'suspended',
    engagementScore: 34,
    lastActive: '7d ago',
  },
]

export const UserManagementPage: React.FC = () => {
  const toast = useToast()
  const [users, setUsers] = useState<UserRecord[]>(sampleUsers)
  const [filters, setFilters] = useState({ organization: 'all', role: 'all', status: 'all', search: '' })
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = `${user.name} ${user.email}`.toLowerCase().includes(filters.search.toLowerCase())
      const matchesOrg = filters.organization === 'all' || user.organization === filters.organization
      const matchesRole = filters.role === 'all' || user.role === filters.role
      const matchesStatus = filters.status === 'all' || user.status === filters.status
      return matchesSearch && matchesOrg && matchesRole && matchesStatus
    })
  }, [filters, users])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const bulkAction = (action: 'suspend' | 'reset') => {
    if (!selectedIds.length) {
      toast({ title: 'Select at least one user', status: 'warning' })
      return
    }
    if (action === 'suspend') {
      setUsers((prev) => prev.map((u) => (selectedIds.includes(u.id) ? { ...u, status: 'suspended' } : u)))
      toast({ title: 'Users suspended', status: 'info' })
    }
    if (action === 'reset') {
      toast({ title: 'Password reset initiated', status: 'success' })
    }
    setSelectedIds([])
  }

  const updateRole = (id: string, role: UserRecord['role']) => {
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, role } : user)))
    toast({ title: 'Role updated', status: 'success' })
  }

  const toggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, status: user.status === 'active' ? 'suspended' : 'active' } : user)),
    )
    toast({ title: 'Status updated', status: 'info' })
  }

  const handleInviteUser = () => {
    toast({
      title: 'Invite user',
      description: 'User invitation feature coming soon',
      status: 'info',
      duration: 3000,
    })
  }

  return (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={6}>
            <HStack justify="space-between" flexDir={{ base: 'column', md: 'row' }} align={{ base: 'flex-start', md: 'center' }} gap={3}>
              <Stack spacing={1}>
                <Text fontWeight="bold" color="brand.text">
                  User management
                </Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Manage users across organizations, update roles, and monitor engagement.
                </Text>
              </Stack>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={3} w={{ base: '100%', lg: 'auto' }}>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Search size={16} />
                  </InputLeftElement>
                  <Input
                    placeholder="Search users"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  />
                </InputGroup>
                <Select value={filters.organization} onChange={(e) => setFilters((prev) => ({ ...prev, organization: e.target.value }))}>
                  <option value="all">All organizations</option>
                  <option value="Org A">Org A</option>
                  <option value="Org B">Org B</option>
                </Select>
                <Select value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
                  <option value="all">All roles</option>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </Select>
                <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="invited">Invited</option>
                </Select>
              </SimpleGrid>
            </HStack>

            <HStack spacing={3}>
              <Button leftIcon={<UserPlus size={16} />} colorScheme="purple" onClick={handleInviteUser}>
                Invite user
              </Button>
              <Button leftIcon={<Filter size={16} />} variant="outline" onClick={() => setFilters({ organization: 'all', role: 'all', status: 'all', search: '' })}>
                Clear filters
              </Button>
              <Button variant="ghost" onClick={() => bulkAction('suspend')} isDisabled={!selectedIds.length}>
                Suspend selected
              </Button>
              <Button variant="ghost" onClick={() => bulkAction('reset')} isDisabled={!selectedIds.length}>
                Reset passwords
              </Button>
            </HStack>

            <Box border="1px solid" borderColor="brand.border" borderRadius="md" overflowX="auto">
              <Table size="sm">
                <Thead bg="gray.50">
                  <Tr>
                    <Th w="40px">
                      <Checkbox
                        isChecked={selectedIds.length === filteredUsers.length && filteredUsers.length > 0}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? filteredUsers.map((u) => u.id) : [])
                        }
                        aria-label="Select all"
                      />
                    </Th>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Organization</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Engagement</Th>
                    <Th>Last active</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredUsers.map((user) => (
                    <Tr key={user.id} _hover={{ bg: 'gray.50' }}>
                      <Td>
                        <Checkbox isChecked={selectedIds.includes(user.id)} onChange={() => toggleSelect(user.id)} aria-label={`Select ${user.name}`} />
                      </Td>
                      <Td fontWeight="semibold">{user.name}</Td>
                      <Td>{user.email}</Td>
                      <Td>{user.organization}</Td>
                      <Td>
                        <Select value={user.role} size="sm" onChange={(e) => updateRole(user.id, e.target.value as UserRecord['role'])}>
                          <option value="member">Member</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </Select>
                      </Td>
                      <Td>
                        <Badge colorScheme={user.status === 'active' ? 'green' : user.status === 'suspended' ? 'red' : 'orange'}>{user.status}</Badge>
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <Users size={14} />
                          <Text>{user.engagementScore}</Text>
                        </HStack>
                      </Td>
                      <Td>{user.lastActive}</Td>
                      <Td>
                        <Menu>
                          <MenuButton as={IconButton} aria-label="User actions" icon={<MoreHorizontal size={16} />} size="sm" variant="ghost" />
                          <MenuList>
                            <MenuItem icon={<Shield size={16} />} onClick={() => toggleStatus(user.id)}>
                              {user.status === 'active' ? 'Suspend' : 'Activate'}
                            </MenuItem>
                            <MenuItem onClick={() => toast({ title: 'Password reset link sent', status: 'success' })}>Reset password</MenuItem>
                            <MenuItem onClick={() => toast({ title: 'Details opened', status: 'info' })}>View details</MenuItem>
                          </MenuList>
                        </Menu>
                      </Td>
                    </Tr>
                  ))}
                  {!filteredUsers.length && (
                    <Tr>
                      <Td colSpan={9} textAlign="center" py={6}>
                        <Text color="gray.600">No users match the selected filters.</Text>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )
}
