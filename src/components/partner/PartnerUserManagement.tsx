import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Textarea,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  Switch,
  VStack,
} from '@chakra-ui/react'
import { CheckCircle2, ChevronDown, ChevronUp, Clock, ShieldAlert } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { PartnerUser, PartnerOrganization, PartnerRiskLevel } from '@/hooks/usePartnerDashboardData'
import { useAuth } from '@/hooks/useAuth'
import { usePointsApprovalQueue } from '@/hooks/partner/usePointsApprovalQueue'
import { db } from '@/services/firebase'
import UserNudgeHistoryPanel from '@/components/partner/nudges/UserNudgeHistoryPanel'
import { type PointsVerificationRequest } from '@/services/pointsVerificationService'

interface PartnerUserManagementProps {
  users: PartnerUser[]
  usersLoading: boolean
  organizations: PartnerOrganization[]
  organizationsLoading: boolean
  organizationsReady: boolean
  selectedOrg: string
  onSelectOrg: (org: string) => void
  updateUserPoints: (userId: string, delta: number, reason: string) => Promise<void>
}

const PAGE_SIZE = 20

const riskColor: Record<PartnerRiskLevel | 'at_risk', string> = {
  engaged: 'green',
  watch: 'yellow',
  concern: 'orange',
  critical: 'red',
  at_risk: 'red',
}

const normalizeDateValue = (value?: unknown) => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'string') {
    const dateValue = new Date(value)
    if (!Number.isNaN(dateValue.getTime())) return dateValue
  }
  return null
}

const formatLastActiveLabel = (value?: unknown) => {
  const parsed = normalizeDateValue(value)
  if (!parsed) return 'Unknown'
  return formatDistanceToNow(parsed, { addSuffix: true })
}

const getSortableValue = (user: PartnerUser, key: string) => {
  switch (key) {
    case 'risk':
      return user.riskStatus
    case 'name':
      return user.name
    case 'company':
      return user.companyCode
    case 'progress':
      return user.progressPercent
    case 'week':
      return user.currentWeek
    case 'status':
      return user.status
    case 'lastActive': {
      const lastActiveDate = normalizeDateValue(user.lastActive)
      return lastActiveDate ? lastActiveDate.getTime() : -Infinity
    }
    default:
      return ''
  }
}

const formatRequestTimestamp = (value?: unknown) => {
  const parsed = normalizeDateValue(value)
  if (!parsed) return 'Recently submitted'
  return formatDistanceToNow(parsed, { addSuffix: true })
}

export const PartnerUserManagement: React.FC<PartnerUserManagementProps> = ({
  users,
  usersLoading,
  organizations,
  organizationsLoading,
  organizationsReady,
  selectedOrg,
  onSelectOrg,
  updateUserPoints,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'risk' | 'leaders' | 'approvals'>('users')
  const [sortKey, setSortKey] = useState('lastActive')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedUser, setSelectedUser] = useState<PartnerUser | null>(null)
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [adjustmentValue, setAdjustmentValue] = useState(0)
  const [loadingAdjustment, setLoadingAdjustment] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [processingBulk, setProcessingBulk] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<PointsVerificationRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const drawer = useDisclosure()
  const adjustmentModal = useDisclosure()
  const rejectionModal = useDisclosure()
  const toast = useToast()
  const { profile } = useAuth()

  // Extract organization IDs for server-side approval filtering
  const partnerOrganizationIds = useMemo(
    () => organizations.map((org) => org.id).filter(Boolean) as string[],
    [organizations],
  )

  const {
    approvalQueue,
    loading: approvalsLoading,
    actionId: approvalActionId,
    handleApprove: handleApproveRequest,
    handleReject: handleRejectRequestBase,
  } = usePointsApprovalQueue(users, activeTab === 'approvals', {
    organizationIds: partnerOrganizationIds,
    enabled: true,
  })

  const organizationOptions = useMemo(
    () => [
      { code: 'all', name: 'All Companies' },
      ...organizations.map((org) => ({
        ...org,
        code: org.code || org.id || 'unknown',
        name: org.name || org.code || org.id || 'Unknown organization',
      })),
    ],
    [organizations],
  )

  const organizationCodeLookup = useMemo(() => {
    const lookup = new Map<string, string>()
    organizations.forEach((org) => {
      if (org.code) lookup.set(org.code.toLowerCase(), org.code.toLowerCase())
      if (org.id) lookup.set(org.id.toLowerCase(), org.code?.toLowerCase() ?? org.id.toLowerCase())
    })
    return lookup
  }, [organizations])

  const filtered = useMemo(() => {
    if (selectedOrg === 'all') return users
    const normalized = selectedOrg.toLowerCase()
    const companyCode = organizationCodeLookup.get(normalized) ?? normalized
    return users.filter((user) => user.companyCode?.toLowerCase() === companyCode)
  }, [organizationCodeLookup, users, selectedOrg])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = getSortableValue(a, sortKey)
      const bVal = getSortableValue(b, sortKey)
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortDir, sortKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const waitingForOrganizations = organizationsLoading && !organizationsReady

  const atRiskUsers = useMemo(
    () =>
      filtered.filter(user => ['watch', 'concern', 'critical', 'at_risk'].includes(user.riskStatus)),
    [filtered],
  )

  const leaders = useMemo(() => filtered.filter(user => user.role === 'mentor' || user.role === 'team_leader'), [filtered])

  useEffect(() => {
    setPage(1)
  }, [selectedOrg])

  useEffect(() => {
    setSelection([])
  }, [activeTab])

  const openUser = (user: PartnerUser) => {
    setSelectedUser(user)
    drawer.onOpen()
  }

  const toggleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleAdjustment = async () => {
    if (!selectedUser) return
    if (adjustmentValue <= 0) {
      toast({
        title: 'Points must be positive',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }
    setLoadingAdjustment(true)
    try {
      await updateUserPoints(selectedUser.id, adjustmentValue, adjustmentReason || 'Manual adjustment')
      toast({
        title: 'Points updated',
        description: `${adjustmentValue} points applied to ${selectedUser.name}`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
      setAdjustmentValue(0)
      setAdjustmentReason('')
      adjustmentModal.onClose()
    } finally {
      setLoadingAdjustment(false)
    }
  }

  const openRejectModal = (request: PointsVerificationRequest) => {
    setSelectedRequest(request)
    setRejectReason('')
    rejectionModal.onOpen()
  }

  const handleRejectRequest = async () => {
    if (!selectedRequest) return
    await handleRejectRequestBase(selectedRequest, rejectReason)
    rejectionModal.onClose()
    setSelectedRequest(null)
    setRejectReason('')
  }

  const toggleSelection = (id: string) => {
    setSelection(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
  }

  const toggleRowExpansion = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const bulkApply = async (actionLabel: string) => {
    const actionToApply = actionLabel || bulkAction
    if (!selection.length) {
      toast({ title: 'Please select at least one user', status: 'error' })
      return
    }

    if (!actionToApply) {
      toast({ title: 'Select an action to apply', status: 'error' })
      return
    }

    setProcessingBulk(true)
    try {
      const results = await Promise.allSettled(
        selection.map((userId) =>
          addDoc(collection(db, 'users', userId, 'engagement_actions'), {
            action_type: actionToApply.toLowerCase().replace(/\s+/g, '_'),
            action_label: actionToApply,
            actor_id: profile?.id ?? null,
            actor_name: profile?.fullName ?? null,
            timestamp: serverTimestamp(),
            user_id: userId,
          }),
        ),
      )

      const failedIds = results
        .map((result, idx) => (result.status === 'rejected' ? selection[idx] : null))
        .filter((id): id is string => typeof id === 'string')
      const successCount = results.length - failedIds.length

      if (failedIds.length && successCount) {
        console.warn('[PartnerDashboard] Bulk action partially failed', {
          action: actionToApply,
          failedIds,
        })
        toast({
          title: 'Bulk action partially completed',
          description: `${successCount} of ${selection.length} user(s) updated. ${failedIds.length} failed.`,
          status: 'warning',
        })
        setSelection(failedIds)
      } else if (failedIds.length) {
        console.error('[PartnerDashboard] Bulk action failed', { action: actionToApply, failedIds })
        toast({
          title: 'Bulk action failed',
          description: 'No updates were applied. Please retry.',
          status: 'error',
        })
      } else {
        toast({
          title: `${actionToApply} applied`,
          description: `${selection.length} user(s) updated`,
          status: 'success',
        })
        setSelection([])
        setBulkAction('')
      }
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to apply action', status: 'error' })
    } finally {
      setProcessingBulk(false)
    }
  }

  const renderTableHeader = () => (
    <Thead>
      <Tr>
        <Th width="40px"></Th>
        {['Risk', 'Name/Email', 'Company', 'Progress %', 'Current Week', 'Status', 'Last Active', 'Primary Action'].map((header, idx) => {
          const sortMapping = ['risk', 'name', 'company', 'progress', 'week', 'status', 'lastActive', 'action']
          const key = sortMapping[idx] || 'name'
          return (
            <Th
              key={header}
              cursor="pointer"
              onClick={() => toggleSort(key)}
              whiteSpace="nowrap"
            >
              <HStack spacing={2}>
                <Text>{header}</Text>
                {sortKey === key && <Badge colorScheme="purple">{sortDir === 'asc' ? '▲' : '▼'}</Badge>}
              </HStack>
            </Th>
          )
        })}
      </Tr>
    </Thead>
  )

  const renderUserRow = (user: PartnerUser) => {
    const lastActiveLabel = formatLastActiveLabel(user.lastActive)
    const isExpanded = expandedRows.has(user.id)

    return (
      <React.Fragment key={user.id}>
        <Tr _hover={{ bg: 'brand.accent' }} cursor="pointer" onClick={() => openUser(user)}>
          <Td onClick={(e) => toggleRowExpansion(user.id, e)}>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Td>
          <Td>
            <Badge colorScheme={riskColor[user.riskStatus]} textTransform="capitalize">
              {user.riskStatus === 'at_risk' ? 'At Risk' : user.riskStatus}
            </Badge>
          </Td>
          <Td>
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="semibold" color="brand.text">
                {user.name}
              </Text>
              <Text fontSize="sm" color="brand.subtleText">
                {user.email}
              </Text>
            </VStack>
          </Td>
          <Td textTransform="capitalize">{user.companyCode || 'Unassigned'}</Td>
          <Td>
            <HStack spacing={2}>
              <Box bg="brand.accent" borderRadius="full" h="8px" w="80px" position="relative">
                <Box
                  position="absolute"
                  left={0}
                  top={0}
                  bottom={0}
                  borderRadius="full"
                  bg="indigo.500"
                  width={`${user.progressPercent}%`}
                />
              </Box>
              <Text fontSize="sm">{user.progressPercent}%</Text>
            </HStack>
          </Td>
          <Td>{user.currentWeek}</Td>
          <Td>
            <Badge colorScheme={user.status === 'Active' ? 'green' : 'yellow'}>{user.status}</Badge>
          </Td>
          <Td>
            <Text fontSize="sm">{lastActiveLabel}</Text>
          </Td>
          <Td onClick={(e) => e.stopPropagation()}>
            <HStack spacing={2}>
              {user.riskStatus !== 'engaged' ? (
                <Button size="xs" colorScheme="purple" onClick={() => openUser(user)}>Start intervention</Button>
              ) : (
                <Button size="xs" variant="outline" onClick={() => openUser(user)}>Schedule check-in</Button>
              )}
            </HStack>
          </Td>
        </Tr>
        {isExpanded && (
          <Tr bg="gray.50">
            <Td colSpan={9}>
              <Box p={4}>
                <Stack spacing={4}>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <Box>
                      <Text fontWeight="bold" fontSize="xs" color="gray.500" textTransform="uppercase" mb={2}>Risk Reasons</Text>
                      <VStack align="flex-start" spacing={1}>
                        {(user.riskReasons ?? ['Behind on weekly points target']).map((reason, idx) => (
                          <Badge key={idx} colorScheme="orange" variant="subtle">{reason}</Badge>
                        ))}
                      </VStack>
                    </Box>
                    <Box>
                      <Text fontWeight="bold" fontSize="xs" color="gray.500" textTransform="uppercase" mb={2}>Weekly Progress</Text>
                      <VStack align="flex-start" spacing={1}>
                        <Text fontSize="sm">Earned: {user.weeklyEarned} pts</Text>
                        <Text fontSize="sm">Required: {user.weeklyRequired} pts</Text>
                        <Badge colorScheme={user.weeklyEarned >= user.weeklyRequired ? 'green' : 'orange'}>
                          {user.weeklyEarned >= user.weeklyRequired ? 'Target Met' : 'Below Target'}
                        </Badge>
                      </VStack>
                    </Box>
                    <Box>
                      <Text fontWeight="bold" fontSize="xs" color="gray.500" textTransform="uppercase" mb={2}>Partner Notes</Text>
                      <Text fontSize="sm" color="gray.600">No notes available for this learner.</Text>
                      <Button size="xs" variant="link" colorScheme="purple" mt={2} onClick={() => openUser(user)}>Add note</Button>
                    </Box>
                  </SimpleGrid>
                </Stack>
              </Box>
            </Td>
          </Tr>
        )}
      </React.Fragment>
    )
  }

  const renderBulkToolbar = () => (
    <Flex
      bg="amber.50"
      border="1px solid"
      borderColor="yellow.200"
      borderRadius="md"
      p={3}
      justify="space-between"
      align={{ base: 'flex-start', md: 'center' }}
      direction={{ base: 'column', md: 'row' }}
      gap={3}
    >
      <HStack spacing={3}>
        <Badge colorScheme="purple">{selection.length} user(s) selected</Badge>
        <Button size="sm" onClick={() => setSelection([])} variant="ghost">
          Clear selection
        </Button>
      </HStack>
        <HStack spacing={3}>
          <Select
            size="sm"
            placeholder="Select action"
            maxW="220px"
            value={bulkAction}
            onChange={e => setBulkAction(e.target.value)}
          >
            <option value="Active Intervention">Active Intervention</option>
            <option value="Mentor Follow-up">Mentor Follow-up</option>
            <option value="Overdue Acknowledgement">Overdue Acknowledgement</option>
            <option value="Active Escalation">Active Escalation</option>
          </Select>
        <Button
            size="sm"
            colorScheme="purple"
            isLoading={processingBulk}
            isDisabled={!selection.length}
            onClick={() => bulkApply(bulkAction)}
          >
            Apply to Selected
          </Button>
        </HStack>
    </Flex>
  )

  return (
    <Stack spacing={6}>
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} wrap="wrap">
        <Stack spacing={1}>
          <Text fontWeight="bold" color="brand.text">User management</Text>
          <Text fontSize="sm" color="brand.subtleText">
            Filtered to your assigned organizations. Manual adjustments are logged for auditability.
          </Text>
        </Stack>
        <Select maxW="240px" value={selectedOrg} onChange={e => onSelectOrg(e.target.value)}>
          {organizationOptions.map(org => (
            <option key={org.code} value={org.code}>
              {org.name}
            </option>
          ))}
        </Select>
      </Flex>

      <HStack spacing={3} wrap="wrap">
        <Button
          variant={activeTab === 'users' ? 'solid' : 'ghost'}
          colorScheme="purple"
          size="sm"
          onClick={() => setActiveTab('users')}
        >
          Users
        </Button>
        <Button
          variant={activeTab === 'risk' ? 'solid' : 'ghost'}
          colorScheme="purple"
          size="sm"
          onClick={() => setActiveTab('risk')}
          rightIcon={<Badge colorScheme="red">{atRiskUsers.length}</Badge>}
        >
          At Risk
        </Button>
        <Button
          variant={activeTab === 'leaders' ? 'solid' : 'ghost'}
          colorScheme="purple"
          size="sm"
          onClick={() => setActiveTab('leaders')}
        >
          Leaders
        </Button>
        <Button
          variant={activeTab === 'approvals' ? 'solid' : 'ghost'}
          colorScheme="purple"
          size="sm"
          onClick={() => setActiveTab('approvals')}
          rightIcon={<Badge colorScheme="blue">{approvalQueue.length}</Badge>}
        >
          Approvals
        </Button>
      </HStack>

      {activeTab === 'users' && (
        <Stack spacing={4}>
          <Table size="md" variant="simple">
            {renderTableHeader()}
            <Tbody>
              {paginated.map(renderUserRow)}
              {usersLoading && (
                <Tr>
                  <Td colSpan={7}>
                    <HStack spacing={3} py={6} justify="center">
                      <Spinner size="sm" />
                      <Text color="brand.subtleText">
                        {waitingForOrganizations ? 'Waiting for organizations...' : 'Loading learners...'}
                      </Text>
                    </HStack>
                  </Td>
                </Tr>
              )}
              {!usersLoading && !paginated.length && (
                <Tr>
                  <Td colSpan={7}>
                    <HStack spacing={3} py={6} justify="center">
                      <CheckCircle2 color="green" />
                      <Text color="brand.subtleText">
                        {usersLoading
                          ? 'Loading learners...'
                          : 'No learners found for the selected company'}
                      </Text>
                    </HStack>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>

          <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
            <Text fontSize="sm" color="brand.subtleText">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} users
            </Text>
            <HStack spacing={3}>
              <Button size="sm" onClick={() => setPage(prev => Math.max(1, prev - 1))} isDisabled={page === 1}>
                Previous
              </Button>
              <Button size="sm" onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} isDisabled={page === totalPages}>
                Next
              </Button>
            </HStack>
          </Flex>
        </Stack>
      )}

      {activeTab === 'risk' && (
        <Stack spacing={4}>
          <Text fontWeight="semibold" color="brand.text">Active Alerts</Text>
          {selection.length > 0 && renderBulkToolbar()}
          <Table size="md" variant="simple">
            <Thead>
              <Tr>
                <Th>
                  <Checkbox
                    size="lg"
                    borderRadius="md"
                    onChange={e =>
                      setSelection(e.target.checked ? atRiskUsers.map(u => u.id) : [])
                    }
                  />
                </Th>
                <Th>Name/Email</Th>
                <Th>Company</Th>
                <Th>Progress %</Th>
                <Th>Current Week</Th>
                <Th>Status</Th>
                <Th>Risk Reason</Th>
                <Th>Last Active</Th>
                <Th>Nudge status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {usersLoading && (
                <Tr>
                  <Td colSpan={10}>
                    <HStack spacing={3} py={6} justify="center">
                      <Spinner size="sm" />
                      <Text color="brand.subtleText">
                        {waitingForOrganizations ? 'Waiting for organizations...' : 'Loading learners...'}
                      </Text>
                    </HStack>
                  </Td>
                </Tr>
              )}
              {atRiskUsers.map(user => (
                <Tr key={user.id}>
                  <Td>
                    <Checkbox
                      size="lg"
                      borderRadius="md"
                      isChecked={selection.includes(user.id)}
                      onChange={() => toggleSelection(user.id)}
                    />
                  </Td>
                  <Td>
                    <VStack align="flex-start" spacing={0}>
                      <Text fontWeight="semibold" color="brand.text">{user.name}</Text>
                      <Text fontSize="sm" color="brand.subtleText">{user.email}</Text>
                    </VStack>
                  </Td>
                  <Td textTransform="capitalize">{user.companyCode}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Box bg="red.50" borderRadius="full" h="8px" w="80px" position="relative">
                        <Box
                          position="absolute"
                          left={0}
                          top={0}
                          bottom={0}
                          borderRadius="full"
                          bg="red.400"
                          width={`${user.progressPercent}%`}
                        />
                      </Box>
                      <Text fontSize="sm">{user.progressPercent}%</Text>
                    </HStack>
                  </Td>
                  <Td>{user.currentWeek}</Td>
                  <Td>
                    <Badge colorScheme="red">At Risk</Badge>
                  </Td>
                  <Td>
                    <Text fontSize="sm" color="brand.subtleText">
                      {user.riskReasons?.[0] || 'Points deficit'}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm">{formatLastActiveLabel(user.lastActive)}</Text>
                  </Td>
                  <Td>
                    <Badge colorScheme="green">Ready</Badge>
                  </Td>
                  <Td>
                    <Button size="xs" colorScheme="purple" variant="outline" onClick={() => openUser(user)}>
                      Quick nudge
                    </Button>
                  </Td>
                </Tr>
              ))}
              {!usersLoading && !atRiskUsers.length && (
                <Tr>
                  <Td colSpan={10}>
                    <HStack spacing={3} py={6} justify="center">
                      <CheckCircle2 color="green" />
                      <Text color="brand.subtleText">
                        {usersLoading ? 'Loading learners...' : 'All learners on track!'}
                      </Text>
                    </HStack>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Stack>
      )}

      {activeTab === 'leaders' && (
        <Stack spacing={4}>
          <Text fontWeight="semibold" color="brand.text">Mentors & Team Leaders</Text>
          <Table size="md" variant="simple">
            <Thead>
              <Tr>
                <Th>Name/Email</Th>
                <Th>Company</Th>
                <Th>Role</Th>
                <Th>Last Active</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {usersLoading && (
                <Tr>
                  <Td colSpan={5}>
                    <HStack spacing={3} py={6} justify="center">
                      <Spinner size="sm" />
                      <Text color="brand.subtleText">
                        {waitingForOrganizations ? 'Waiting for organizations...' : 'Loading leaders...'}
                      </Text>
                    </HStack>
                  </Td>
                </Tr>
              )}
              {leaders.map(leader => (
                <Tr key={leader.id}>
                  <Td>
                    <VStack align="flex-start" spacing={0}>
                      <Text fontWeight="semibold" color="brand.text">{leader.name}</Text>
                      <Text fontSize="sm" color="brand.subtleText">{leader.email}</Text>
                    </VStack>
                  </Td>
                  <Td textTransform="capitalize">{leader.companyCode}</Td>
                  <Td>
                    <Badge colorScheme="purple" textTransform="capitalize">{leader.role}</Badge>
                  </Td>
                  <Td>{formatLastActiveLabel(leader.lastActive)}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Button size="xs" variant="outline">View Details</Button>
                      <Button size="xs" variant="outline">Assign to Learner</Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
              {!usersLoading && !leaders.length && (
                <Tr>
                  <Td colSpan={5}>
                    <HStack spacing={3} py={6} justify="center">
                      <Clock />
                      <Text color="brand.subtleText">
                        {usersLoading ? 'Loading leaders...' : 'No mentors or leaders in scope'}
                      </Text>
                    </HStack>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Stack>
      )}

      {activeTab === 'approvals' && (
        <Stack spacing={4}>
          <Text fontWeight="semibold" color="brand.text">Pending approvals</Text>
          <Box p={4} borderRadius="xl" border="1px solid" borderColor="brand.border" bg="white" boxShadow="sm">
            <HStack justify="space-between" mb={3}>
              <Text fontWeight="bold">Points upload requests</Text>
              <Badge colorScheme="blue">{approvalQueue.length} pending</Badge>
            </HStack>
            <Stack spacing={3}>
              {approvalsLoading && (
                <HStack spacing={3} py={4}>
                  <Spinner size="sm" />
                  <Text color="brand.subtleText">Loading requests...</Text>
                </HStack>
              )}
              {!approvalsLoading &&
                approvalQueue.map(({ request, user }) => (
                  <Box key={request.id} p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                    <HStack justify="space-between" align="flex-start" wrap="wrap" gap={3}>
                      <Stack spacing={1}>
                        <Text fontWeight="semibold" color="brand.text">{user.name}</Text>
                        <Text fontSize="sm" color="brand.subtleText">{user.companyCode}</Text>
                        <Text fontSize="sm" color="brand.subtleText">
                          {request.activity_title || 'Activity submission'} • Week {request.week} • {request.points ?? 0} pts
                        </Text>
                        <Text fontSize="xs" color="brand.subtleText">
                          Submitted {formatRequestTimestamp(request.created_at)}
                        </Text>
                        {request.proof_url && (
                          <Link href={request.proof_url} isExternal color="purple.600" fontSize="sm">
                            View proof
                          </Link>
                        )}
                        {request.notes && (
                          <Text fontSize="sm" color="brand.subtleText">
                            Notes: {request.notes}
                          </Text>
                        )}
                      </Stack>
                      <HStack spacing={2}>
                        <Button
                          size="xs"
                          colorScheme="green"
                          onClick={() => handleApproveRequest(request)}
                          isLoading={approvalActionId === request.id}
                        >
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="outline"
                          onClick={() => openRejectModal(request)}
                          isDisabled={approvalActionId === request.id}
                        >
                          Reject
                        </Button>
                      </HStack>
                    </HStack>
                  </Box>
                ))}
              {!approvalsLoading && !approvalQueue.length && (
                <HStack spacing={3}>
                  <ShieldAlert color="orange" />
                  <Text color="brand.subtleText">No pending verification requests</Text>
                </HStack>
              )}
            </Stack>
          </Box>
        </Stack>
      )}

      <Drawer
        isOpen={drawer.isOpen}
        placement="right"
        onClose={() => {
          drawer.onClose()
          setSelectedUser(null)
        }}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader borderBottomWidth="1px">User details</DrawerHeader>
          <DrawerBody>
            {!selectedUser && (
              <Flex align="center" justify="center" h="100%">
                <Spinner />
              </Flex>
            )}
            {selectedUser && (
              <Stack spacing={4}>
                <VStack align="flex-start" spacing={1}>
                  <Text fontSize="xl" fontWeight="bold">{selectedUser.name}</Text>
                  <Text color="brand.subtleText">{selectedUser.email}</Text>
                </VStack>
                <HStack spacing={3}>
                  <Badge colorScheme="purple" textTransform="capitalize">{selectedUser.companyCode}</Badge>
                  <Badge colorScheme={riskColor[selectedUser.riskStatus]}>Risk: {selectedUser.riskStatus}</Badge>
                </HStack>
                <Divider />
                <Stack spacing={2}>
                  <Text fontWeight="semibold">Weekly progress</Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    Earned {selectedUser.weeklyEarned} / {selectedUser.weeklyRequired} points this week.
                  </Text>
                  <HStack spacing={2}>
                    <Box bg="brand.accent" borderRadius="full" h="10px" flex={1} position="relative">
                      <Box
                        position="absolute"
                        left={0}
                        top={0}
                        bottom={0}
                        borderRadius="full"
                        bg={selectedUser.weeklyEarned >= selectedUser.weeklyRequired ? 'green.400' : 'indigo.500'}
                        width={`${Math.min(100, (selectedUser.weeklyEarned / Math.max(selectedUser.weeklyRequired, 1)) * 100)}%`}
                      />
                    </Box>
                    <Text fontSize="sm">{selectedUser.progressPercent}%</Text>
                  </HStack>
                  <Button size="sm" onClick={adjustmentModal.onOpen} colorScheme="purple">
                    Adjust points
                  </Button>
                </Stack>
                <Stack spacing={2}>
                  <Text fontWeight="semibold">Risk reasons</Text>
                  <VStack align="flex-start" spacing={1}>
                    {(selectedUser.riskReasons ?? ['No risk notes yet']).map(reason => (
                      <Badge key={reason} colorScheme="orange" variant="subtle">
                        {reason}
                      </Badge>
                    ))}
                  </VStack>
                </Stack>
                <UserNudgeHistoryPanel
                  userName={selectedUser.name}
                  lastNudgeAt="No nudges sent"
                  effectivenessScore={undefined}
                  cooldownHours={0}
                />
                <Stack spacing={3}>
                  <Text fontWeight="semibold">Nudge preferences</Text>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="brand.subtleText">Allow nudge notifications</Text>
                    <Switch colorScheme="purple" defaultChecked />
                  </HStack>
                  <Text fontSize="xs" color="brand.subtleText">
                    Preferences are honored across email and in-app channels.
                  </Text>
                </Stack>
                <Stack spacing={2}>
                  <Text fontWeight="semibold">Admin follow-up notes</Text>
                  <Input placeholder="Add a quick note about manual outreach" />
                  <Text fontSize="xs" color="brand.subtleText">
                    Recommended next action: schedule a follow-up in 5 days if no response.
                  </Text>
                </Stack>
              </Stack>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" mr={3} onClick={drawer.onClose}>
              Close
            </Button>
            <Button colorScheme="purple" onClick={adjustmentModal.onOpen} isDisabled={!selectedUser}>
              Add intervention
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Modal isOpen={rejectionModal.isOpen} onClose={rejectionModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Reject points upload</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Text fontSize="sm" color="brand.subtleText">
                Provide an optional reason for rejecting this points upload. The learner will not receive points.
              </Text>
              <Textarea
                placeholder="Add a brief reason (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              {selectedRequest && (
                <Text fontSize="xs" color="brand.subtleText">
                  Request: {selectedRequest.activity_title || 'Activity submission'} • Week {selectedRequest.week}
                </Text>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={rejectionModal.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleRejectRequest}
              isLoading={selectedRequest ? approvalActionId === selectedRequest.id : false}
            >
              Reject request
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={adjustmentModal.isOpen} onClose={adjustmentModal.onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Manual points adjustment</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <FormControl>
                <FormLabel>Points</FormLabel>
                <Input
                  type="number"
                  value={adjustmentValue}
                  onChange={e => setAdjustmentValue(Number(e.target.value))}
                  min={0}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Reason</FormLabel>
                <Input
                  value={adjustmentReason}
                  placeholder="Mentor follow-up, activity approval, etc."
                  onChange={e => setAdjustmentReason(e.target.value)}
                />
              </FormControl>
              <Text fontSize="sm" color="brand.subtleText">
                Adjustments are logged to the admin activity trail and reflected in weekly_points for this learner.
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={adjustmentModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handleAdjustment} isLoading={loadingAdjustment}>
              Apply points
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}

export default PartnerUserManagement
