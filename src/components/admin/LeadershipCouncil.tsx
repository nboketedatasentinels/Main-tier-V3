import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Flex,
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
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { formatDistanceToNow } from 'date-fns'
import { Plus, Search, UserSquare2, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  ManagedUserRecord,
  OrganizationOption,
  assignRoleToUser,
  updateUser,
} from '@/services/userManagementService'

/* ------------------------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------------------------ */

type LeadershipRole = 'mentor' | 'ambassador'

interface LeadershipCouncilProps {
  users: ManagedUserRecord[]
  organizations: OrganizationOption[]
  loadingUsers: boolean
}

/* ------------------------------------------------------------------ */
/* CONSTANTS */
/* ------------------------------------------------------------------ */

const ROLE_LABELS: Record<LeadershipRole, string> = {
  mentor: 'Mentor',
  ambassador: 'Ambassador',
}

const statusBadge = (status?: string) => {
  if (status === 'active') return { color: 'green', label: 'Active' }
  if (status === 'suspended') return { color: 'red', label: 'Suspended' }
  if (status === 'inactive') return { color: 'orange', label: 'Inactive' }
  return { color: 'gray', label: 'Unknown' }
}

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */

export const LeadershipCouncil = (props: LeadershipCouncilProps) => {
  const { users, organizations, loadingUsers } = props

  const toast = useToast()
  const { isAdmin, isSuperAdmin } = useAuth()

  const canView = isAdmin || isSuperAdmin
  const canManage = isSuperAdmin

  const [activeRole, setActiveRole] = useState<LeadershipRole>('mentor')
  const [search, setSearch] = useState('')

  /* ---------------- DERIVED DATA ---------------- */

  const leaders = useMemo(() => {
    return {
      mentors: users.filter((u) => u.role === 'mentor'),
      ambassadors: users.filter((u) => u.role === 'ambassador'),
    }
  }, [users])

  const activeLabel = ROLE_LABELS[activeRole]

  const filteredLeaders = useMemo(() => {
    const pool = activeRole === 'mentor' ? leaders.mentors : leaders.ambassadors
    const q = search.toLowerCase()
    return pool.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.companyName || '').toLowerCase().includes(q),
    )
  }, [activeRole, leaders, search])

  const availableUsers = useMemo(
    () => users.filter((u) => !['mentor', 'ambassador'].includes(u.role)),
    [users],
  )

  /* ---------------- MODALS ---------------- */

  const assignModal = useDisclosure()
  const editModal = useDisclosure()

  const [assignRole, setAssignRole] = useState<LeadershipRole>('mentor')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingUser, setEditingUser] = useState<ManagedUserRecord | null>(null)
  const [editingOrgId, setEditingOrgId] = useState<string | undefined>()
  const [editingStatus, setEditingStatus] = useState<string>('active')
  const [editingNotes, setEditingNotes] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)

  /* ---------------- ACTIONS ---------------- */

  const handlePromote = async () => {
    if (!selectedUserId) {
      toast({ title: 'Select a user', status: 'warning' })
      return
    }

    try {
      setSaving(true)
      const org = organizations.find((o) => o.id === selectedOrgId)
      await assignRoleToUser(selectedUserId, assignRole, org || null, notes)
      toast({ title: `${activeLabel} assigned`, status: 'success' })
      assignModal.onClose()
      setSelectedUserId('')
      setSelectedOrgId(undefined)
      setNotes('')
    } catch {
      toast({ title: 'Only Super Admins can assign leadership roles', status: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    try {
      setSaving(true)
      const org = organizations.find((o) => o.id === editingOrgId)
      await updateUser(editingUser.id, {
        companyId: org?.id || null,
        companyCode: org?.code || null,
        companyName: org?.name || null,
        accountStatus: editingStatus,
        notes: editingNotes,
      })
      toast({ title: 'Leadership profile updated', status: 'success' })
      editModal.onClose()
    } catch {
      toast({ title: 'Failed to update member', status: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (user: ManagedUserRecord) => {
    if (!window.confirm(`Remove ${user.name} from leadership?`)) return
    try {
      setRemovingId(user.id)
      await updateUser(user.id, {
        role: 'user',
        companyId: null,
        companyCode: null,
        companyName: null,
        isActiveAmbassador: false,
      })
      toast({ title: `${user.name} removed`, status: 'success' })
    } catch {
      toast({ title: 'Unable to remove user', status: 'error' })
    } finally {
      setRemovingId(null)
    }
  }

  /* ---------------- ACCESS GUARD ---------------- */

  if (!canView) {
    return (
      <Card>
        <CardBody>
          <Flex direction="column" align="center" gap={3}>
            <Icon as={UserSquare2} boxSize={10} color="gray.300" />
            <Text fontWeight="semibold">Admin access required</Text>
          </Flex>
        </CardBody>
      </Card>
    )
  }

  /* ---------------- RENDER ---------------- */

  return (
    <Stack spacing={6}>
      <Flex justify="space-between" gap={4} wrap="wrap">
        <HStack>
          {(['mentor', 'ambassador'] as LeadershipRole[]).map((role) => (
            <Button
              key={role}
              variant={activeRole === role ? 'solid' : 'ghost'}
              colorScheme="purple"
              onClick={() => setActiveRole(role)}
            >
              {ROLE_LABELS[role]}
            </Button>
          ))}
        </HStack>

        <HStack>
          <InputGroup maxW="260px">
            <InputLeftElement pointerEvents="none">
              <Icon as={Search} color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder={`Search ${activeLabel.toLowerCase()}s`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>

          {canManage && (
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

      <Divider />

      {loadingUsers ? (
        <Flex justify="center" py={8} gap={2}>
          <Icon as={Users} />
          <Text>Loading leadership…</Text>
        </Flex>
      ) : filteredLeaders.length === 0 ? (
        <Text textAlign="center">No {activeLabel.toLowerCase()}s found.</Text>
      ) : (
        <Stack divider={<Divider />} spacing={0}>
          {filteredLeaders.map((u) => {
            const status = statusBadge(u.accountStatus)
            return (
              <Flex key={u.id} px={4} py={3} align="center" gap={3}>
                <Box flex="1">
                  <Text fontWeight="semibold">{u.name}</Text>
                  <Text fontSize="sm" color="gray.500">
                    {u.email}
                  </Text>
                </Box>

                <Box flex="1">
                  <Text>{u.companyName || '—'}</Text>
                  <Text fontSize="xs" color="gray.500">
                    {u.companyCode || ''}
                  </Text>
                </Box>

                <Badge colorScheme={status.color}>{status.label}</Badge>

                <Text w="120px" color="gray.500">
                  {u.lastActive
                    ? formatDistanceToNow(u.lastActive, { addSuffix: true })
                    : '—'}
                </Text>

                {canManage && (
                  <HStack>
                    <Button size="sm" onClick={() => {
                      setEditingUser(u)
                      setEditingOrgId(u.companyId || undefined)
                      setEditingStatus(u.accountStatus || 'active')
                      setEditingNotes(u.notes || '')
                      editModal.onOpen()
                    }}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="red"
                      isLoading={removingId === u.id}
                      onClick={() => handleRemove(u)}
                    >
                      Remove
                    </Button>
                  </HStack>
                )}
              </Flex>
            )
          })}
        </Stack>
      )}

      <Modal isOpen={assignModal.isOpen} onClose={assignModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add {ROLE_LABELS[assignRole]}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Box>
                <Text fontWeight="semibold" mb={2}>
                  Select User
                </Text>
                <Select
                  placeholder="Choose a user"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
              </Box>

              <Box>
                <Text fontWeight="semibold" mb={2}>
                  Organization (Optional)
                </Text>
                <Select
                  placeholder="No organization"
                  value={selectedOrgId || ''}
                  onChange={(e) => setSelectedOrgId(e.target.value || undefined)}
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.code})
                    </option>
                  ))}
                </Select>
              </Box>

              <Box>
                <Text fontWeight="semibold" mb={2}>
                  Notes
                </Text>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                />
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={assignModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" isLoading={saving} onClick={handlePromote}>
              Assign Role
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Leadership Member</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {editingUser && (
              <Stack spacing={4}>
                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    User
                  </Text>
                  <Text>{editingUser.name}</Text>
                  <Text fontSize="sm" color="gray.500">
                    {editingUser.email}
                  </Text>
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Organization
                  </Text>
                  <Select
                    value={editingOrgId || ''}
                    onChange={(e) => setEditingOrgId(e.target.value || undefined)}
                  >
                    <option value="">No organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.code})
                      </option>
                    ))}
                  </Select>
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Status
                  </Text>
                  <Select value={editingStatus} onChange={(e) => setEditingStatus(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </Select>
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Notes
                  </Text>
                  <Textarea
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    placeholder="Add any notes..."
                  />
                </Box>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={editModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" isLoading={saving} onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}
