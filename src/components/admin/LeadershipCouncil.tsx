import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Flex,
  Grid,
  GridItem,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  SimpleGrid,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { formatDistanceToNow } from 'date-fns'
import { Edit, Plus, Search, Trash2, UserSquare2, Users as UsersIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  ManagedUserRecord,
  OrganizationOption,
  assignRoleToUser,
  updateUser,
} from '@/services/userManagementService'

type LeadershipRole = 'mentor' | 'ambassador'

const roleLabels: Record<LeadershipRole, string> = {
  mentor: 'Mentor',
  ambassador: 'Ambassador',
}

const statusBadge = (status?: string) => {
  if (status === 'active') return { bg: 'green.100', color: 'green.600', label: 'Active' }
  if (status === 'suspended' || status === 'inactive') return { bg: 'red.100', color: 'red.600', label: status === 'suspended' ? 'Suspended' : 'Inactive' }
  return { bg: 'gray.100', color: 'gray.600', label: 'Unknown' }
}

interface LeadershipCouncilProps {
  users: ManagedUserRecord[]
  organizations: OrganizationOption[]
  loadingUsers: boolean
}

export const LeadershipCouncil = ({ users: propUsers, organizations: propOrganizations, loadingUsers }: LeadershipCouncilProps) => {
  const toast = useToast()
  const { isAdmin, isSuperAdmin } = useAuth()
  const canViewLeadership = isAdmin || isSuperAdmin
  const canManageLeadership = isSuperAdmin

  const [activeRole, setActiveRole] = useState<LeadershipRole>('mentor')
  const [leaders, setLeaders] = useState<{ mentors: ManagedUserRecord[]; ambassadors: ManagedUserRecord[] }>({ mentors: [], ambassadors: [] })
  const [search, setSearch] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const [assignRole, setAssignRole] = useState<LeadershipRole>('mentor')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>('')
  const [assignmentNotes, setAssignmentNotes] = useState('')

  const [editingMember, setEditingMember] = useState<ManagedUserRecord | null>(null)
  const [editingCompanyId, setEditingCompanyId] = useState<string | undefined>('')
  const [editingStatus, setEditingStatus] = useState<string>('')
  const [editingNotes, setEditingNotes] = useState('')

  const assignModal = useDisclosure()
  const editModal = useDisclosure()

  useEffect(() => {
    setLeaders({
      mentors: propUsers.filter((user) => user.role === 'mentor'),
      ambassadors: propUsers.filter((user) => user.role === 'ambassador'),
    })
  }, [propUsers])

  const activeLabel = roleLabels[activeRole]

  const filteredLeaders = useMemo(() => {
    const pool = activeRole === 'mentor' ? leaders.mentors : leaders.ambassadors
    const query = search.toLowerCase()
    return pool.filter((member) =>
      member.name.toLowerCase().includes(query) || (member.email || '').toLowerCase().includes(query) || (member.companyName || '').toLowerCase().includes(query),
    )
  }, [activeRole, leaders.ambassadors, leaders.mentors, search])

  const availableMembers = useMemo(
    () => propUsers.filter((user) => !['mentor', 'ambassador'].includes(user.role)),
    [propUsers],
  )

  const organizationOptions = useMemo(
    () => propOrganizations.map((company) => ({ value: company.id, label: `${company.name}${company.code ? ` (${company.code})` : ''}` })),
    [propOrganizations],
  )

  const clearPromotionForm = () => {
    setSelectedUserId('')
    setSelectedCompanyId('')
    setAssignmentNotes('')
  }

  const handlePromote = async () => {
    if (!selectedUserId) {
      toast({ title: 'Please choose a member to promote.', status: 'warning' })
      return
    }

    try {
      setIsAssigning(true)
      const company = propOrganizations.find((org) => org.id === selectedCompanyId)
      await assignRoleToUser(selectedUserId, assignRole, company || null, assignmentNotes)
      toast({ title: `${activeLabel} assigned successfully.`, status: 'success' })
      assignModal.onClose()
      clearPromotionForm()
    } catch (err) {
      console.error(err)
      toast({ title: 'Only super admins can manage leadership assignments.', status: 'error' })
    } finally {
      setIsAssigning(false)
    }
  }

  const handleOpenEdit = (member: ManagedUserRecord) => {
    setEditingMember(member)
    setEditingCompanyId(member.companyId || '')
    setEditingStatus(member.accountStatus || 'active')
    setEditingNotes(member.notes || '')
    editModal.onOpen()
  }

  const handleSaveEdit = async () => {
    if (!editingMember) return
    try {
      setIsUpdating(true)
      const company = propOrganizations.find((org) => org.id === editingCompanyId)
      const updates: Partial<ManagedUserRecord> = {
        companyId: company?.id || null,
        companyCode: company?.code || null,
        companyName: company?.name || null,
        accountStatus: editingStatus,
        notes: editingNotes,
      }

      if (editingMember.role === 'ambassador') {
        updates.isActiveAmbassador = editingStatus === 'active'
      }

      await updateUser(editingMember.id, updates)
      toast({ title: 'Leadership profile updated.', status: 'success' })
      editModal.onClose()
    } catch (err) {
      console.error(err)
      toast({ title: 'Failed to update member', status: 'error' })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemove = async (member: ManagedUserRecord) => {
    if (!window.confirm(`Remove ${member.name} from the Leadership Council?`)) return

    try {
      setRemovingId(member.id)
      const updates: Partial<ManagedUserRecord> = {
        role: 'user',
        companyId: null,
        companyCode: null,
        companyName: null,
        isActiveAmbassador: false,
      }
      await updateUser(member.id, updates)
      toast({ title: `${member.name} has been removed from the council.`, status: 'success' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to remove member', status: 'error' })
    } finally {
      setRemovingId(null)
    }
  }

  const renderAccessDenied = () => (
    <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="2xl">
      <CardBody>
        <Flex direction="column" align="center" gap={3}>
          <Icon as={UserSquare2} boxSize={10} color="gray.300" />
          <Text fontWeight="semibold">Admin access required</Text>
          <Text color="gray.600" textAlign="center">
            Leadership Council tools are restricted to administrators. Please contact support if you need assistance.
          </Text>
        </Flex>
      </CardBody>
    </Card>
  )

  return (
    <Stack spacing={6}>
      <Box
        bgGradient="linear(to-br, purple.50, white)"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="3xl"
        p={8}
        shadow="sm"
      >
        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6} alignItems="center">
          <GridItem>
            <HStack spacing={3} mb={3}>
              <Badge colorScheme="purple" variant="subtle" textTransform="uppercase" letterSpacing="widest">
                Leadership Council
              </Badge>
            </HStack>
            <Text fontSize="3xl" fontWeight="semibold" color="gray.900">
              Mentor &amp; Ambassador oversight
            </Text>
            <Text color="gray.600" mt={2}>
              Promote trusted members, track their organisation alignment, and ensure our leadership network has the right support.
            </Text>
          </GridItem>
          <GridItem>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
              <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="xl">
                <CardBody>
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="widest">
                    Active Mentors
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold">{leaders.mentors.length}</Text>
                </CardBody>
              </Card>
              <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="xl">
                <CardBody>
                  <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="widest">
                    Active Ambassadors
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold">{leaders.ambassadors.length}</Text>
                </CardBody>
              </Card>
            </SimpleGrid>
          </GridItem>
        </Grid>
      </Box>

      {!canViewLeadership ? (
        renderAccessDenied()
      ) : (
        <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="2xl">
          <CardBody>
            <Stack spacing={6}>
              <Flex
                align={{ base: 'stretch', md: 'center' }}
                direction={{ base: 'column', md: 'row' }}
                justify="space-between"
                gap={4}
              >
                <HStack
                  bg="gray.100"
                  p={1}
                  borderRadius="full"
                  spacing={1}
                  w={{ base: 'full', md: 'auto' }}
                  justify="space-between"
                >
                  {(['mentor', 'ambassador'] as LeadershipRole[]).map((role) => (
                    <Button
                      key={role}
                      onClick={() => setActiveRole(role)}
                      variant={activeRole === role ? 'solid' : 'ghost'}
                      colorScheme={activeRole === role ? 'purple' : undefined}
                      bg={activeRole === role ? 'white' : 'transparent'}
                      shadow={activeRole === role ? 'sm' : undefined}
                      borderRadius="full"
                    >
                      {roleLabels[role]}
                    </Button>
                  ))}
                </HStack>

                <HStack spacing={3} w={{ base: 'full', md: 'auto' }}>
                  <InputGroup maxW={{ base: '100%', md: '260px' }}>
                    <InputLeftElement pointerEvents="none">
                      <Icon as={Search} color="gray.400" />
                    </InputLeftElement>
                    <Input
                      placeholder={`Search ${activeLabel.toLowerCase()}s`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </InputGroup>
                  {canManageLeadership && (
                    <Button
                      colorScheme="purple"
                      leftIcon={<Plus size={16} />}
                      onClick={() => {
                        setAssignRole(activeRole)
                        assignModal.onOpen()
                      }}
                    >
                      Add {activeLabel}
                    </Button>
                  )}
                </HStack>
              </Flex>

              <Box border="1px solid" borderColor="gray.200" borderRadius="2xl" overflow="hidden">
                <Box bg="gray.50" px={4} py={3}>
                  <HStack spacing={4} fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="widest">
                    <Text flex="1">Name</Text>
                    <Text flex="1">Email</Text>
                    <Text flex="1">Company</Text>
                    <Text w="120px">Status</Text>
                    <Text w="120px">Last Active</Text>
                    <Text w="120px">Joined</Text>
                    <Text w="140px" textAlign="right">
                      Actions
                    </Text>
                  </HStack>
                </Box>

                {loadingUsers ? (
                  <Flex py={8} justify="center" align="center" gap={2}>
                    <Icon as={UsersIcon} color="purple.500" />
                    <Text color="gray.600">Loading leadership records…</Text>
                  </Flex>
                ) : filteredLeaders.length === 0 ? (
                  <Flex py={10} direction="column" align="center" gap={2}>
                    <Icon as={UsersIcon} boxSize={10} color="gray.300" />
                    <Text fontWeight="medium" color="gray.700">
                      No {activeLabel.toLowerCase()}s found. Use 'Add {activeLabel}' to promote a member.
                    </Text>
                  </Flex>
                ) : (
                  <Stack divider={<Divider />} spacing={0}>
                    {filteredLeaders.map((member) => {
                      const status = statusBadge(member.accountStatus)
                      return (
                        <Flex
                          key={member.id}
                          px={4}
                          py={3}
                          align="center"
                          gap={3}
                          _hover={{ bg: 'gray.50' }}
                          transition="background-color 0.2s ease"
                        >
                          <Box flex="1">
                            <Text fontWeight="semibold" color="gray.900">
                              {member.name}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              ID: {member.id}
                            </Text>
                          </Box>
                          <Text flex="1" color="gray.700">
                            {member.email || '—'}
                          </Text>
                          <Box flex="1">
                            <Text fontWeight="medium" color="gray.800">
                              {member.companyName || '—'}
                            </Text>
                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="widest">
                              {member.companyCode || ''}
                            </Text>
                          </Box>
                          <Box w="120px">
                            <Badge bg={status.bg} color={status.color} px={3} py={1} borderRadius="full">
                              {status.label}
                            </Badge>
                          </Box>
                          <Text w="120px" color="gray.500">
                            {member.lastActive ? formatDistanceToNow(member.lastActive, { addSuffix: true }) : '—'}
                          </Text>
                          <Text w="120px" color="gray.500">
                            {member.createdAt ? formatDistanceToNow(member.createdAt, { addSuffix: true }) : '—'}
                          </Text>
                          <Box w="140px" textAlign="right">
                            {canManageLeadership ? (
                              <HStack spacing={2} justify="flex-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  leftIcon={<Edit size={16} />}
                                  onClick={() => handleOpenEdit(member)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  colorScheme="red"
                                  leftIcon={<Trash2 size={16} />}
                                  onClick={() => handleRemove(member)}
                                  isLoading={removingId === member.id}
                                >
                                  Remove
                                </Button>
                              </HStack>
                            ) : (
                              <Text fontSize="xs" color="gray.400" textTransform="uppercase">
                                Super admin only
                              </Text>
                            )}
                          </Box>
                        </Flex>
                      )
                    })}
                  </Stack>
                )}
              </Box>
            </Stack>
          </CardBody>
        </Card>
      )}

      <Modal isOpen={assignModal.isOpen} onClose={assignModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Promote a {roleLabels[assignRole]}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Select member
                </Text>
                <Select
                  placeholder="Choose a member"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  {availableMembers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} — {user.email} ({user.role})
                    </option>
                  ))}
                </Select>
              </Box>

              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Assign company (optional)
                </Text>
                <Select
                  placeholder="Optional company assignment"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                >
                  {organizationOptions.map((org) => (
                    <option key={org.value} value={org.value}>
                      {org.label}
                    </option>
                  ))}
                </Select>
              </Box>

              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Notes (optional)
                </Text>
                <Textarea
                  placeholder="Share context for the new leadership assignment"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                />
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={assignModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handlePromote} isLoading={isAssigning}>
              Promote
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingMember ? `Update ${editingMember.name}` : 'Update member'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Company alignment
                </Text>
                <Select value={editingCompanyId} onChange={(e) => setEditingCompanyId(e.target.value)} placeholder="Select a company">
                  {organizationOptions.map((org) => (
                    <option key={org.value} value={org.value}>
                      {org.label}
                    </option>
                  ))}
                </Select>
              </Box>

              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Account status
                </Text>
                <Select value={editingStatus} onChange={(e) => setEditingStatus(e.target.value)} placeholder="Choose status">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </Box>

              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Internal notes
                </Text>
                <Textarea
                  placeholder="Document changes or context for other admins"
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                />
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handleSaveEdit} isLoading={isUpdating}>
              Save changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}