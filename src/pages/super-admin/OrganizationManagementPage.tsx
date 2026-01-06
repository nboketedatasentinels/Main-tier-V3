import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { BadgeProps } from '@chakra-ui/react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
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
import { Filter, MoreHorizontal, Search, Sparkles } from 'lucide-react'
import { AssignPartnerModal } from '@/components/super-admin/AssignPartnerModal'
import { ConfirmationDialog } from '@/components/super-admin/ConfirmationDialog'
import { OrganizationDetailsModal } from '@/components/super-admin/OrganizationDetailsModal'
import { EditOrganizationModal } from '@/components/super-admin/EditOrganizationModal'
import { CreateOrganizationModal } from '@/components/super-admin/CreateOrganizationModal'
import { fetchPartners } from '@/services/organizationService'
import {
  assignPartner,
  deleteOrganization,
  fetchOrganizationMemberStats,
  fetchOrganizations,
  logAdminAction,
} from '@/services/superAdminService'
import { OrganizationMemberStats, OrganizationRecord } from '@/types/admin'

type SortKey = keyof Pick<OrganizationRecord, 'name' | 'code' | 'teamSize' | 'status' | 'transformationPartner'>

type OrganizationManagementPageProps = {
  adminName: string
  adminId?: string
}

export const OrganizationManagementPage: React.FC<OrganizationManagementPageProps> = ({ adminName, adminId }) => {
  const toast = useToast()
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', status: 'all', village: 'all', cluster: 'all' })
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const [selectedOrg, setSelectedOrg] = useState<OrganizationRecord | null>(null)
  const [viewOrg, setViewOrg] = useState<OrganizationRecord | null>(null)
  const [pendingDelete, setPendingDelete] = useState<OrganizationRecord | null>(null)
  const [partners, setPartners] = useState<{ id: string; name: string; email?: string }[]>([])
  const [, setIsLoadingPartners] = useState(false)
  const [memberStats, setMemberStats] = useState<OrganizationMemberStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  const createModal = useDisclosure()
  const editModal = useDisclosure()
  const assignModal = useDisclosure()
  const viewModal = useDisclosure()
  const confirmDialog = useDisclosure()

  const loadOrganizations = useCallback(async () => {
    setLoading(true)
    try {
      const orgs = await fetchOrganizations()
      setOrganizations(orgs)
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to load organizations', status: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])

  useEffect(() => {
    const loadPartners = async () => {
      setIsLoadingPartners(true)
      try {
      const partnerOptions = await fetchPartners()
      setPartners(partnerOptions)
      } catch (err) {
        console.error(err)
        toast({ title: 'Unable to load partners', status: 'error' })
      } finally {
        setIsLoadingPartners(false)
      }
    }

    loadPartners()
  }, [toast])

  useEffect(() => {
    const loadMemberStats = async () => {
      if (!viewModal.isOpen || !viewOrg) return
      setIsLoadingStats(true)
      try {
        const stats = await fetchOrganizationMemberStats({ id: viewOrg.id, code: viewOrg.code })
        setMemberStats(stats)
      } catch (err) {
        console.error(err)
        toast({ title: 'Unable to load organization stats', status: 'error' })
      } finally {
        setIsLoadingStats(false)
      }
    }

    loadMemberStats()
  }, [toast, viewModal.isOpen, viewOrg])

  const handleOrganizationCreated = async (org: OrganizationRecord) => {
    setOrganizations((prev) => [org, ...prev])
    await logAdminAction({
      action: 'Organization created',
      organizationName: org.name,
      organizationCode: org.code,
      adminId,
      adminName,
      metadata: { via: 'CreateOrganizationModal' },
    })
    toast({ title: 'Organization created', status: 'success' })
    createModal.onClose()
  }

  const handleDeleteOrg = async () => {
    if (!pendingDelete?.id) return
    await deleteOrganization(pendingDelete.id)
    setOrganizations((prev) => prev.filter((org) => org.id !== pendingDelete.id))
    await logAdminAction({
      action: 'Organization deleted',
      organizationName: pendingDelete.name,
      organizationCode: pendingDelete.code,
      adminId,
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
      adminId,
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

  const statusOptions = ['all', 'active', 'inactive', 'pending', 'suspended', 'watch']

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const handleCloseViewModal = () => {
    viewModal.onClose()
    setViewOrg(null)
    setMemberStats(null)
  }

  const handleViewOrganization = (org: OrganizationRecord) => {
    setViewOrg(org)
    setMemberStats(null)
    viewModal.onOpen()
  }

  const handleEditOrganization = (org: OrganizationRecord) => {
    setSelectedOrg(org)
    editModal.onOpen()
  }

  const handleEditFromView = () => {
    if (!viewOrg) return
    handleCloseViewModal()
    handleEditOrganization(viewOrg)
  }

  const handleOrganizationUpdated = async (updates: OrganizationRecord) => {
    setOrganizations((prev) => prev.map((org) => (org.id === updates.id ? { ...org, ...updates } : org)))
    await logAdminAction({
      action: 'Organization updated',
      organizationName: updates.name,
      organizationCode: updates.code,
      adminId,
      adminName,
    })
    toast({ title: 'Organization updated', status: 'success' })
    await loadOrganizations()
  }

  return (
    <Stack spacing={6}>
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

            {loading ? (
              <Flex justify="center" align="center" py={12}>
                <Spinner size="lg" />
              </Flex>
            ) : (
              <Stack spacing={6}>
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
                      {paginatedOrganizations.map((org) => {
                        const createdAt =
                          typeof org.createdAt === 'string'
                            ? org.createdAt
                            : org.createdAt instanceof Date
                              ? org.createdAt.toLocaleDateString()
                              : org.createdAt?.toDate?.()
                                ? org.createdAt.toDate().toLocaleDateString()
                                : '—'

                        return (
                          <Tr key={org.id || org.code} _hover={{ bg: 'gray.50' }}>
                            <Td>
                              <Menu>
                                <MenuButton as={IconButton} icon={<MoreHorizontal size={16} />} aria-label="Actions" size="sm" variant="ghost" />
                                <MenuList>
                                  <MenuItem onClick={() => handleViewOrganization(org)}>View Organisation</MenuItem>
                                  <MenuItem onClick={() => handleEditOrganization(org)}>Edit organization</MenuItem>
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
                            <Td>{createdAt}</Td>
                          </Tr>
                        )
                      })}
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
                    <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} w="80px" size="sm">
                      {[5, 10, 20, 50].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </Select>
                  </HStack>
                  <HStack spacing={2}>
                    <Button size="sm" variant="ghost" isDisabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </Button>
                    <Badge>{page}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      isDisabled={page * pageSize >= sortedOrganizations.length}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </HStack>
                </Flex>
              </Stack>
            )}
          </Stack>
        </CardBody>
      </Card>

      <CreateOrganizationModal
        isOpen={createModal.isOpen}
        onClose={createModal.onClose}
        onCreated={handleOrganizationCreated}
        adminId={adminId}
        adminName={adminName}
        partners={partners}
      />
      <OrganizationDetailsModal
        isOpen={viewModal.isOpen}
        onClose={handleCloseViewModal}
        organization={viewOrg}
        memberStats={memberStats}
        isLoadingStats={isLoadingStats}
        onEdit={viewOrg ? handleEditFromView : undefined}
      />
      <EditOrganizationModal
        isOpen={editModal.isOpen}
        onClose={() => {
          setSelectedOrg(null)
          editModal.onClose()
        }}
        organization={selectedOrg || undefined}
        onUpdated={handleOrganizationUpdated}
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
    </Stack>
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
