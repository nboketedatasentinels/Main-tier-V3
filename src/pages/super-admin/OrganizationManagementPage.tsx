import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { MoreHorizontal, Search, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AssignAmbassadorModal } from '@/components/super-admin/AssignAmbassadorModal'
import { AssignMentorModal } from '@/components/super-admin/AssignMentorModal'
import { AssignPartnerModal } from '@/components/super-admin/AssignPartnerModal'
import { ConfirmationDialog } from '@/components/super-admin/ConfirmationDialog'
import { EditOrganizationModal } from '@/components/super-admin/EditOrganizationModal'
import { CreateOrganizationModal } from '@/components/super-admin/CreateOrganizationModal'
import { logAdminAction } from '@/services/superAdminService'
import {
  fetchOrganizations,
  listenToAllUsers,
  listenToAmbassadors,
  listenToMentors,
  listenToPartners,
} from '@/services/supabaseSuperAdminService'
import {
  assignLeadershipToOrg,
  assignPartnerToOrg,
  deleteOrganization,
  removeLeadershipFromOrg,
  removePartnerFromOrg,
} from '@/services/supabaseOrgService'
import { OrganizationLead, OrganizationRecord } from '@/types/admin'

type SortKey = 'name' | 'code' | 'teamSize' | 'status' | 'partnerName'

type OrganizationManagementPageProps = {
  adminName: string
  adminId?: string
  openCreateOnMount?: boolean
  onCreateIntentConsumed?: () => void
}

export const OrganizationManagementPage: React.FC<OrganizationManagementPageProps> = ({
  adminName,
  adminId,
  openCreateOnMount = false,
  onCreateIntentConsumed,
}) => {
  const navigate = useNavigate()
  const toast = useToast()
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', status: 'all', village: 'all', cluster: 'all' })
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const hasHandledCreateIntent = useRef(false)

  const [selectedOrg, setSelectedOrg] = useState<OrganizationRecord | null>(null)
  const [pendingDelete, setPendingDelete] = useState<OrganizationRecord | null>(null)
  const [partners, setPartners] = useState<OrganizationLead[]>([])
  const [isLoadingPartners, setIsLoadingPartners] = useState(false)
  const [partnersError, setPartnersError] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<(OrganizationLead & { role?: string })[]>([])
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState(false)
  const [mentors, setMentors] = useState<OrganizationLead[]>([])
  const [isLoadingMentors, setIsLoadingMentors] = useState(false)
  const [mentorsError, setMentorsError] = useState<string | null>(null)
  const [ambassadors, setAmbassadors] = useState<OrganizationLead[]>([])
  const [isLoadingAmbassadors, setIsLoadingAmbassadors] = useState(false)
  const [ambassadorsError, setAmbassadorsError] = useState<string | null>(null)

  const createModal = useDisclosure()
  const editModal = useDisclosure()
  const assignPartnerModal = useDisclosure()
  const assignMentorModal = useDisclosure()
  const assignAmbassadorModal = useDisclosure()
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
    if (!openCreateOnMount || hasHandledCreateIntent.current) return
    hasHandledCreateIntent.current = true
    createModal.onOpen()
    onCreateIntentConsumed?.()
  }, [createModal, onCreateIntentConsumed, openCreateOnMount])

  useEffect(() => {
    setIsLoadingPartners(true)
    setPartnersError(null)
    const unsubscribe = listenToPartners(
      (partnerOptions) => {
        setPartners(partnerOptions)
        setIsLoadingPartners(false)
      },
      (error) => {
        console.error(error)
        setPartnersError('Unable to load partners.')
        toast({ title: 'Unable to load partners', status: 'error' })
        setIsLoadingPartners(false)
      },
    )
    return unsubscribe
  }, [toast])

  useEffect(() => {
    setIsLoadingAllUsers(true)
    const unsubscribe = listenToAllUsers(
      (userOptions) => {
        setAllUsers(userOptions)
        setIsLoadingAllUsers(false)
      },
      (error) => {
        console.error(error)
        toast({ title: 'Unable to load users', status: 'error' })
        setIsLoadingAllUsers(false)
      },
    )
    return unsubscribe
  }, [toast])

  useEffect(() => {
    setIsLoadingMentors(true)
    setMentorsError(null)
    const unsubscribe = listenToMentors(
      (mentorOptions) => {
        setMentors(mentorOptions)
        setIsLoadingMentors(false)
      },
      (error) => {
        console.error(error)
        setMentorsError('Unable to load mentors.')
        toast({ title: 'Unable to load mentors', status: 'error' })
        setIsLoadingMentors(false)
      },
    )
    return unsubscribe
  }, [toast])

  useEffect(() => {
    setIsLoadingAmbassadors(true)
    setAmbassadorsError(null)
    const unsubscribe = listenToAmbassadors(
      (ambassadorOptions) => {
        setAmbassadors(ambassadorOptions)
        setIsLoadingAmbassadors(false)
      },
      (error) => {
        console.error(error)
        setAmbassadorsError('Unable to load ambassadors.')
        toast({ title: 'Unable to load ambassadors', status: 'error' })
        setIsLoadingAmbassadors(false)
      },
    )
    return unsubscribe
  }, [toast])

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
    try {
      await deleteOrganization(pendingDelete.id)
      setOrganizations((prev) => prev.filter((org) => org.id !== pendingDelete.id))
      await logAdminAction({
        action: 'Organization deleted',
        organizationName: pendingDelete.name,
        organizationCode: pendingDelete.code,
        adminId,
        adminName,
      })
      toast({
        title: 'Organization deleted',
        description: 'Partner access assignments linked by organization ID were removed.',
        status: 'info',
      })
      confirmDialog.onClose()
    } catch (error) {
      console.error(error)
      toast({
        title: 'Unable to delete organization',
        description: error instanceof Error ? error.message : undefined,
        status: 'error',
      })
      return
    }
  }

  const handleAssignPartner = async (
    partnerId: string | null,
    _options: { promoteFirst: boolean } = { promoteFirst: false },
  ) => {
    if (!selectedOrg?.id) return
    try {
      // Supabase RPC: assignPartnerToOrg promotes the chosen user to partner AND
      // links them to the org in one call; removePartnerFromOrg clears it.
      if (partnerId) {
        await assignPartnerToOrg(selectedOrg.id, partnerId)
      } else {
        await removePartnerFromOrg(selectedOrg.id)
      }
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === selectedOrg.id ? { ...org, partnerId, transformationPartnerId: partnerId } : org,
        ),
      )
      toast({
        title: partnerId ? 'Partner assigned' : 'Partner removed',
        status: 'success',
      })
      assignPartnerModal.onClose()
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Unexpected error'
      toast({
        title: 'Unable to update partner assignment',
        description: message,
        status: 'error',
      })
      throw error instanceof Error ? error : new Error(message)
    }
  }

  const handleAssignMentor = async (mentorId: string | null) => {
    if (!selectedOrg?.id) return
    try {
      if (mentorId) {
        await assignLeadershipToOrg(selectedOrg.id, mentorId, 'mentor', {
          code: selectedOrg.code,
          name: selectedOrg.name,
        })
      } else {
        await removeLeadershipFromOrg(selectedOrg.id, 'mentor')
      }
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === selectedOrg.id ? { ...org, assignedMentorId: mentorId } : org,
        ),
      )
      // Best-effort audit (Firestore); must not fail the Supabase assignment.
      try {
        await logAdminAction({
          action: 'Mentor assignment updated',
          organizationName: selectedOrg.name,
          organizationCode: selectedOrg.code,
          adminId,
          adminName,
          metadata: { mentorId },
        })
      } catch (auditError) {
        console.warn('[OrgManagement] mentor audit log failed', auditError)
      }
      toast({ title: mentorId ? 'Mentor assigned' : 'Mentor removed', status: 'success' })
      assignMentorModal.onClose()
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Unexpected error'
      toast({ title: 'Unable to update mentor assignment', description: message, status: 'error' })
      return
    }
  }

  const handleAssignAmbassador = async (ambassadorId: string | null) => {
    if (!selectedOrg?.id) return
    try {
      if (ambassadorId) {
        await assignLeadershipToOrg(selectedOrg.id, ambassadorId, 'ambassador', {
          code: selectedOrg.code,
          name: selectedOrg.name,
        })
      } else {
        await removeLeadershipFromOrg(selectedOrg.id, 'ambassador')
      }
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === selectedOrg.id ? { ...org, assignedAmbassadorId: ambassadorId } : org,
        ),
      )
      // Best-effort audit (Firestore); must not fail the Supabase assignment.
      try {
        await logAdminAction({
          action: 'Ambassador assignment updated',
          organizationName: selectedOrg.name,
          organizationCode: selectedOrg.code,
          adminId,
          adminName,
          metadata: { ambassadorId },
        })
      } catch (auditError) {
        console.warn('[OrgManagement] ambassador audit log failed', auditError)
      }
      toast({ title: ambassadorId ? 'Ambassador assigned' : 'Ambassador removed', status: 'success' })
      assignAmbassadorModal.onClose()
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Unexpected error'
      toast({ title: 'Unable to update ambassador assignment', description: message, status: 'error' })
      return
    }
  }


  const partnerLookup = useMemo(() => {
    // Resolve from ALL users (not just the current partners list) so a newly
    // assigned/promoted partner shows immediately instead of "Unassigned".
    const map = new Map<string, string>()
    allUsers.forEach((u) => {
      if (u.name) map.set(u.id, u.name)
    })
    partners.forEach((p) => {
      if (p.name) map.set(p.id, p.name)
    })
    return map
  }, [allUsers, partners])

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
      const aVal =
        sortKey === 'partnerName'
          ? partnerLookup.get(a.transformationPartnerId || '') || ''
          : a[sortKey as keyof OrganizationRecord] || ''
      const bVal =
        sortKey === 'partnerName'
          ? partnerLookup.get(b.transformationPartnerId || '') || ''
          : b[sortKey as keyof OrganizationRecord] || ''
      if (aVal === bVal) return 0
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1
      return aVal < bVal ? 1 : -1
    })
  }, [filteredOrganizations, partnerLookup, sortDir, sortKey])

  const partnerAssignmentCounts = useMemo(() => {
    return organizations.reduce((acc, org) => {
      const key = (org.transformationPartnerId || '').trim()
      if (key) {
        acc[key] = (acc[key] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
  }, [organizations])

  const paginatedOrganizations = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedOrganizations.slice(start, start + pageSize)
  }, [page, pageSize, sortedOrganizations])

  useEffect(() => {
    setPage(1)
  }, [filters.cluster, filters.search, filters.status, filters.village, pageSize])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedOrganizations.length / pageSize))
    setPage((currentPage) => (currentPage > maxPage ? maxPage : currentPage))
  }, [pageSize, sortedOrganizations.length])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const handleViewOrganization = (org: OrganizationRecord) => {
    const organizationKey = org.code || org.id
    if (!organizationKey) return
    navigate(`/admin/organization/${organizationKey}`)
  }

  const handleEditOrganization = (org: OrganizationRecord) => {
    setSelectedOrg(org)
    editModal.onOpen()
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
              </Stack>
              <HStack spacing={3} flexWrap="wrap">
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
                <Box border="1px solid" borderColor="brand.border" borderRadius="md" overflowX="auto">
                  <Table
                    size="sm"
                    sx={{
                      th: {
                        color: 'brand.subtleText',
                        borderColor: 'brand.border',
                      },
                      td: {
                        color: 'brand.text',
                        borderColor: 'brand.border',
                      },
                    }}
                  >
                    <Thead bg="brand.accent">
                      <Tr>
                        <Th>Actions</Th>
                        <Th cursor="pointer" onClick={() => handleSort('name')}>
                          Name
                        </Th>
                        <Th cursor="pointer" onClick={() => handleSort('code')}>
                          Code
                        </Th>
                        <Th>Team size</Th>
                        <Th cursor="pointer" onClick={() => handleSort('partnerName')}>
                          Transformation partner
                        </Th>
                        <Th>Created</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {paginatedOrganizations.map((org, index) => {
                        const safeName = (org.name || '').trim() || 'Unnamed organization'
                        const safeCode = (org.code || '').trim() || 'No code'
                        const safeTeamSize = Number.isFinite(org.teamSize) ? Number(org.teamSize) : 0
                        const resolvedPartner = partnerLookup.get(org.transformationPartnerId || '')
                        // A partner assigned by email at creation has no
                        // transformation_partner_id until that email signs up,
                        // so surface the pending email instead of "Unassigned".
                        const safePartner =
                          resolvedPartner ||
                          (org.assignedPartnerEmail
                            ? `Pending: ${org.assignedPartnerEmail}`
                            : 'Unassigned')
                        // Resolve the raw value (Supabase ISO string, Date, or
                        // Firestore Timestamp) to a Date, then show a clean
                        // date + time with no seconds/milliseconds.
                        const createdDate =
                          typeof org.createdAt === 'string'
                            ? new Date(org.createdAt)
                            : org.createdAt instanceof Date
                              ? org.createdAt
                              : org.createdAt?.toDate?.() ?? null
                        const createdAt =
                          createdDate && !Number.isNaN(createdDate.getTime())
                            ? createdDate.toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Not set'

                        return (
                          <Tr key={org.id || org.code || `fallback-${index}`} _hover={{ bg: 'brand.accent' }}>
                            <Td>
                              <Menu>
                                <MenuButton
                                  as={IconButton}
                                  icon={<MoreHorizontal size={16} />}
                                  aria-label="Actions"
                                  size="sm"
                                  variant="ghost"
                                  color="brand.text"
                                />
                                <MenuList>
                                  <MenuItem onClick={() => handleViewOrganization(org)}>View Organisation</MenuItem>
                                  <MenuItem onClick={() => handleEditOrganization(org)}>Edit organization</MenuItem>
                                  <MenuItem onClick={() => { setSelectedOrg(org); assignMentorModal.onOpen() }}>Assign mentor</MenuItem>
                                  <MenuItem onClick={() => { setSelectedOrg(org); assignAmbassadorModal.onOpen() }}>Assign ambassador</MenuItem>
                                  <MenuItem onClick={() => { setSelectedOrg(org); assignPartnerModal.onOpen() }}>Assign partner</MenuItem>
                                  <MenuItem onClick={() => { setPendingDelete(org); confirmDialog.onOpen() }} color="red.500">
                                    Delete
                                  </MenuItem>
                                </MenuList>
                              </Menu>
                            </Td>
                            <Td fontWeight="semibold">{safeName}</Td>
                            <Td>{safeCode}</Td>
                            <Td>{safeTeamSize}</Td>
                            <Td>{safePartner}</Td>
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
        isOpen={assignPartnerModal.isOpen}
        onClose={() => {
          setSelectedOrg(null)
          assignPartnerModal.onClose()
        }}
        organization={selectedOrg || undefined}
        onSubmit={handleAssignPartner}
        partners={partners}
        allUsers={allUsers}
        isLoadingPartners={isLoadingPartners}
        isLoadingAllUsers={isLoadingAllUsers}
        partnersError={partnersError}
        partnerAssignmentCounts={partnerAssignmentCounts}
      />
      <AssignMentorModal
        isOpen={assignMentorModal.isOpen}
        onClose={() => {
          setSelectedOrg(null)
          assignMentorModal.onClose()
        }}
        organization={selectedOrg || undefined}
        onSubmit={handleAssignMentor}
        mentors={mentors}
        isLoadingMentors={isLoadingMentors}
        mentorsError={mentorsError}
      />
      <AssignAmbassadorModal
        isOpen={assignAmbassadorModal.isOpen}
        onClose={() => {
          setSelectedOrg(null)
          assignAmbassadorModal.onClose()
        }}
        organization={selectedOrg || undefined}
        onSubmit={handleAssignAmbassador}
        ambassadors={ambassadors}
        isLoadingAmbassadors={isLoadingAmbassadors}
        ambassadorsError={ambassadorsError}
      />
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => {
          setPendingDelete(null)
          confirmDialog.onClose()
        }}
        title="Delete organization"
        description="This action removes the organization and detaches partner access assignments that reference this organization ID."
        onConfirm={handleDeleteOrg}
        confirmLabel="Delete"
      />
    </Stack>
  )
}

