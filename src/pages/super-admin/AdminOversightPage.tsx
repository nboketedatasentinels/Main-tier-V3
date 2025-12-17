import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  SimpleGrid,
  Skeleton,
  Spacer,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { MoreHorizontal, Plus, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { MetricCard } from '@/components/admin/MetricCard'
import { ConfirmationDialog } from '@/components/super-admin/ConfirmationDialog'
import { AdminFormModal } from '@/components/super-admin/AdminFormModal'
import {
  assignOrganizations,
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  fetchOrganizations,
  toggleAdminStatus,
  updateAdminUser,
} from '@/services/superAdminService'
import { AdminFormData, AdminMetrics, AdminUserRecord, OrganizationRecord } from '@/types/admin'

interface AdminOversightPageProps {
  adminName?: string
  adminId?: string
}

type SortKey = 'name' | 'email' | 'role' | 'status' | 'lastActive'

const roleColorMap: Record<string, string> = {
  partner: 'purple',
  mentor: 'blue',
  ambassador: 'teal',
  team_leader: 'orange',
  super_admin: 'gray',
}

const statusColorMap: Record<string, string> = {
  active: 'green',
  suspended: 'red',
}

export const AdminOversightPage: React.FC<AdminOversightPageProps> = ({ adminName, adminId }) => {
  const { profile } = useAuth()
  const toast = useToast()
  const formModal = useDisclosure()
  const deleteDialog = useDisclosure()

  const [admins, setAdmins] = useState<AdminUserRecord[]>([])
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUserRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ role: 'all', status: 'all', organization: 'all' })
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [metrics, setMetrics] = useState<AdminMetrics>({
    total: 0,
    active: 0,
    partners: 0,
    mentors: 0,
    ambassadors: 0,
    teamLeaders: 0,
  })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.toLowerCase()), 200)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const loadData = async () => {
    try {
      setLoading(true)
      const [adminList, orgList] = await Promise.all([fetchAdminUsers(), fetchOrganizations()])
      setAdmins(adminList)
      setOrganizations(orgList)
      updateMetrics(adminList)
    } catch (error) {
      console.error(error)
      toast({ title: 'Unable to load admin users', status: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const getMillis = (value: unknown) => {
    if (!value) return 0
    if (typeof value === 'number') return value
    if (value instanceof Date) return value.getTime()
    const asTimestamp = value as { toMillis?: () => number; toDate?: () => Date }
    if (asTimestamp.toMillis) return asTimestamp.toMillis()
    return asTimestamp.toDate?.()?.getTime?.() || 0
  }

  const updateMetrics = (adminList: AdminUserRecord[]) => {
    const total = adminList.length
    const active = adminList.filter((admin) => admin.accountStatus !== 'suspended').length
    const partners = adminList.filter((admin) => admin.role === 'partner').length
    const mentors = adminList.filter((admin) => admin.role === 'mentor').length
    const ambassadors = adminList.filter((admin) => admin.role === 'ambassador').length
    const teamLeaders = adminList.filter((admin) => admin.role === 'team_leader').length
    setMetrics({ total, active, partners, mentors, ambassadors, teamLeaders })
  }

  const handleCreateAdmin = async (formData: AdminFormData) => {
    try {
      await createAdminUser({ ...formData, createdBy: adminId, createdByName: adminName })
      toast({ title: 'Admin created', status: 'success' })
      await loadData()
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to create admin', status: 'error' })
    }
  }

  const handleUpdateAdmin = async (formData: AdminFormData) => {
    if (!selectedAdmin) return
    try {
      await updateAdminUser(selectedAdmin.id, formData)
      await assignOrganizations(selectedAdmin.id, formData.assignedOrganizations || [])
      toast({ title: 'Admin updated', status: 'success' })
      await loadData()
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to update admin', status: 'error' })
    }
  }

  const handleToggleStatus = async (admin: AdminUserRecord) => {
    if (admin.role === 'super_admin') {
      toast({ title: 'Cannot change status for super admin accounts', status: 'warning' })
      return
    }
    const nextStatus = admin.accountStatus === 'suspended' ? 'active' : 'suspended'
    try {
      await toggleAdminStatus(admin.id, nextStatus)
      toast({ title: `Admin ${nextStatus === 'active' ? 'activated' : 'suspended'}`, status: 'success' })
      await loadData()
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to update status', status: 'error' })
    }
  }

  const [adminToDelete, setAdminToDelete] = useState<AdminUserRecord | null>(null)

  const confirmDelete = async () => {
    if (!adminToDelete) return
    try {
      await deleteAdminUser(adminToDelete.id)
      toast({ title: 'Admin deleted', status: 'success' })
      setAdminToDelete(null)
      await loadData()
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to delete admin', status: 'error' })
    }
  }

  const filteredAdmins = useMemo(() => {
    const base = admins.filter((admin) => {
      const name = (admin.fullName || `${admin.firstName || ''} ${admin.lastName || ''}`.trim()).toLowerCase()
      const email = (admin.email || '').toLowerCase()
      const matchesSearch =
        !debouncedSearch || name.includes(debouncedSearch) || email.includes(debouncedSearch)
      const matchesRole = filters.role === 'all' || admin.role === filters.role
      const matchesStatus = filters.status === 'all' || admin.accountStatus === filters.status
      const matchesOrg =
        filters.organization === 'all' || admin.assignedOrganizations?.includes(filters.organization)
      return matchesSearch && matchesRole && matchesStatus && matchesOrg
    })

    const sorted = [...base].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'email':
          return ((a.email || '').localeCompare(b.email || '')) * direction
        case 'role':
          return (a.role || '').localeCompare(b.role || '') * direction
        case 'status':
          return ((a.accountStatus || '').localeCompare(b.accountStatus || '')) * direction
        case 'lastActive': {
          const diff = getMillis(a.lastActive) - getMillis(b.lastActive)
          if (diff === 0) return 0
          return diff > 0 ? direction : -direction
        }
        case 'name':
        default:
          return ((a.fullName || '').localeCompare(b.fullName || '')) * direction
      }
    })

    return sorted
  }, [admins, debouncedSearch, filters.organization, filters.role, filters.status, sortDirection, sortKey])

  const roleLabel = (role: string) =>
    ({
      partner: 'Partner',
      mentor: 'Mentor',
      ambassador: 'Ambassador',
      team_leader: 'Team Leader',
      super_admin: 'Super Admin',
    }[role] || role)

  const organizationName = (orgId: string) => organizations.find((org) => org.id === orgId)?.name || orgId

  const renderTableRows = () => {
    if (loading) {
      return (
        <Tr>
          <Td colSpan={7}>
            <Skeleton height="16px" />
          </Td>
        </Tr>
      )
    }

    if (!filteredAdmins.length) {
      return (
        <Tr>
          <Td colSpan={7}>
            <Text color="gray.500">No admin users found.</Text>
          </Td>
        </Tr>
      )
    }

    return filteredAdmins.map((admin) => (
      <Tr key={admin.id}>
        <Td>
          <Text fontWeight="semibold">{admin.fullName || `${admin.firstName || ''} ${admin.lastName || ''}`.trim()}</Text>
        </Td>
        <Td>
          <Text color="gray.600" fontSize="sm">{admin.email || '—'}</Text>
        </Td>
        <Td>
          <Badge colorScheme={roleColorMap[admin.role] || 'gray'}>{roleLabel(admin.role)}</Badge>
        </Td>
        <Td>
          <Wrap>
            {(admin.assignedOrganizations || []).map((orgId) => (
              <WrapItem key={orgId}>
                <Badge colorScheme="gray" variant="subtle">
                  {organizationName(orgId)}
                </Badge>
              </WrapItem>
            ))}
          </Wrap>
        </Td>
        <Td>
          <Badge colorScheme={statusColorMap[admin.accountStatus || 'active'] || 'green'}>
            {admin.accountStatus === 'suspended' ? 'Suspended' : 'Active'}
          </Badge>
        </Td>
        <Td>
          <Text color="gray.600" fontSize="sm">
            {admin.lastActive ? new Date(getMillis(admin.lastActive)).toLocaleDateString() : '—'}
          </Text>
        </Td>
        <Td>
          <Menu>
            <MenuButton as={IconButton} aria-label="Actions" icon={<MoreHorizontal size={18} />} variant="ghost" />
            <MenuList>
              <MenuItem
                onClick={() => {
                  setSelectedAdmin(admin)
                  formModal.onOpen()
                }}
              >
                Edit
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setSelectedAdmin(admin)
                  formModal.onOpen()
                }}
              >
                Change Role
              </MenuItem>
              <MenuItem onClick={() => handleToggleStatus(admin)}>
                {admin.accountStatus === 'suspended' ? 'Activate' : 'Suspend'}
              </MenuItem>
              {admin.role !== 'super_admin' && (
                <MenuItem
                  color="red.500"
                  onClick={() => {
                    setAdminToDelete(admin)
                    deleteDialog.onOpen()
                  }}
                >
                  Delete
                </MenuItem>
              )}
            </MenuList>
          </Menu>
        </Td>
      </Tr>
    ))
  }

  if (profile?.role !== 'super_admin') {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        You do not have permission to access this page.
      </Alert>
    )
  }

  return (
    <Box>
      <Flex align="center" mb={6}>
        <Box>
          <Heading size="lg">Admin Oversight</Heading>
          <Text color="gray.600">Create, manage, and audit admin users across the platform.</Text>
        </Box>
        <Spacer />
        <Button
          leftIcon={<Plus size={18} />}
          colorScheme="blue"
          onClick={() => {
            setSelectedAdmin(null)
            formModal.onOpen()
          }}
        >
          Add Admin
        </Button>
      </Flex>

      <SimpleGrid columns={[1, 2, 3]} spacing={4} mb={6}>
        <MetricCard label="Total Admins" value={metrics.total} icon={ShieldCheck} helper="All admin roles" />
        <MetricCard label="Active Admins" value={metrics.active} icon={ShieldCheck} helper="Currently active" />
        <MetricCard label="Partners" value={metrics.partners} icon={ShieldCheck} helper="Company administrators" />
        <MetricCard label="Mentors" value={metrics.mentors} icon={ShieldCheck} helper="Active mentors" />
        <MetricCard label="Ambassadors" value={metrics.ambassadors} icon={ShieldCheck} helper="Community ambassadors" />
        <MetricCard label="Team Leaders" value={metrics.teamLeaders} icon={ShieldCheck} helper="Team leadership" />
      </SimpleGrid>

      <Box borderWidth="1px" borderRadius="lg" p={4} mb={4}>
        <Flex gap={3} flexWrap="wrap">
          <Input
            placeholder="Search by name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            maxW="320px"
          />
          <Select
            placeholder="All Roles"
            value={filters.role}
            onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
            maxW="200px"
          >
            <option value="all">All Roles</option>
            <option value="partner">Partner</option>
            <option value="mentor">Mentor</option>
            <option value="ambassador">Ambassador</option>
            <option value="team_leader">Team Leader</option>
          </Select>
          <Select
            placeholder="All Statuses"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            maxW="180px"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Select
            placeholder="All Organizations"
            value={filters.organization}
            onChange={(e) => setFilters((prev) => ({ ...prev, organization: e.target.value }))}
            maxW="240px"
          >
            <option value="all">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
          <Button variant="ghost" onClick={() => setFilters({ role: 'all', status: 'all', organization: 'all' })}>
            Clear Filters
          </Button>
        </Flex>
      </Box>

      <Box borderWidth="1px" borderRadius="lg" overflow="hidden">
        <Table variant="simple">
          <Thead bg="gray.50">
            <Tr>
              <Th cursor="pointer" onClick={() => handleSort('name')}>Name</Th>
              <Th>Email</Th>
              <Th cursor="pointer" onClick={() => handleSort('role')}>Role</Th>
              <Th>Organizations</Th>
              <Th cursor="pointer" onClick={() => handleSort('status')}>Status</Th>
              <Th cursor="pointer" onClick={() => handleSort('lastActive')}>Last Active</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>{renderTableRows()}</Tbody>
        </Table>
      </Box>

      <AdminFormModal
        isOpen={formModal.isOpen}
        onClose={formModal.onClose}
        mode={selectedAdmin ? 'edit' : 'create'}
        initialData={selectedAdmin || undefined}
        onSubmit={selectedAdmin ? handleUpdateAdmin : handleCreateAdmin}
        organizations={organizations}
      />

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.onClose}
        title="Delete Admin"
        description={`Are you sure you want to delete ${adminToDelete?.fullName || 'this admin'}? This action cannot be undone.`}
        onConfirm={confirmDelete}
        confirmLabel="Delete"
      />
    </Box>
  )
}
