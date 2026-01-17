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
import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { PartnerUser, PartnerOrganization, PartnerRiskLevel } from '@/hooks/usePartnerDashboardData'
import UserNudgeHistoryPanel from '@/components/partner/nudges/UserNudgeHistoryPanel'
import { type PointsVerificationRequest } from '@/services/pointsVerificationService'
import { usePartnerUserSorting, SortKey } from '@/hooks/partner/usePartnerUserSorting'
import { useUserSelection } from '@/hooks/partner/useUserSelection'
import { usePartnerBulkActions } from '@/hooks/partner/usePartnerBulkActions'
import { usePointsApprovalQueue } from '@/hooks/partner/usePointsApprovalQueue'
import { isLeader, isAtRisk } from '@/utils/userRoles'

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

const formatRequestTimestamp = (value?: unknown) => {
  if (!value) return 'Recently submitted'
  if (value instanceof Date) return formatDistanceToNow(value, { addSuffix: true })
  if (typeof value === 'number') return formatDistanceToNow(new Date(value), { addSuffix: true })
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return formatDistanceToNow((value as { toDate: () => Date }).toDate(), { addSuffix: true })
  }
  if (typeof value === 'string') {
    const dateValue = new Date(value)
    if (!Number.isNaN(dateValue.getTime())) {
      return formatDistanceToNow(dateValue, { addSuffix: true })
    }
  }
  return 'Recently submitted'
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
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<PartnerUser | null>(null)
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [adjustmentValue, setAdjustmentValue] = useState(0)
  const [loadingAdjustment, setLoadingAdjustment] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PointsVerificationRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const drawer = useDisclosure()
  const adjustmentModal = useDisclosure()
  const rejectionModal = useDisclosure()
  const toast = useToast()

  // Logic Hooks
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

  const safeUsers = usersLoading ? [] : (users ?? [])
  const filtered = useMemo(() => {
    if (selectedOrg === 'all') return safeUsers
    return safeUsers.filter(u => u.companyCode === selectedOrg)
  }, [safeUsers, selectedOrg])

  const learnerUsers = useMemo(
    () => filtered.filter(u => u.role === 'learner'),
    [filtered],
  )

  const { sortKey, sortDir, toggleSort, sortedUsers } = usePartnerUserSorting(learnerUsers)
  const { selection, toggleSelection, clearSelection, selectAll } = useUserSelection()
  const { bulkAction, setBulkAction, bulkApply, isProcessing: processingBulk } = usePartnerBulkActions(
    selection,
    clearSelection,
  )
  const {
    approvalQueue,
    loading: approvalsLoading,
    actionId: approvalActionId,
    handleApprove: handleApproveRequest,
    handleReject: performRejectRequest,
  } = usePointsApprovalQueue(learnerUsers, activeTab === 'approvals')

  useEffect(() => {
    console.log('[PartnerUserManagement]', {
      usersLength: users?.length ?? 0,
      filteredLength: filtered.length,
      learnerLength: learnerUsers.length,
      sortedLength: sortedUsers.length,
      selectedOrg,
      usersLoading,
    })
  }, [users, filtered, learnerUsers, sortedUsers, selectedOrg, usersLoading])

  // Pagination & Derived State
  useEffect(() => {
    setPage(1)
  }, [selectedOrg, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE))
  const paginated = sortedUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const waitingForOrganizations = organizationsLoading && !organizationsReady

  const atRiskUsers = useMemo(() => learnerUsers.filter(isAtRisk), [learnerUsers])
  const leaders = useMemo(() => filtered.filter(isLeader), [filtered])

  const openUser = (user: PartnerUser) => {
    setSelectedUser(user)
    drawer.onOpen()
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
    await performRejectRequest(selectedRequest, rejectReason)
    rejectionModal.onClose()
    setSelectedRequest(null)
    setRejectReason('')
  }

  const renderTableHeader = () => (
    <Thead>
      <Tr>
        {['Name/Email', 'Company', 'Progress %', 'Current Week', 'Status', 'Last Active', 'Risk'].map((header, idx) => {
          const sortMapping: SortKey[] = ['name', 'company', 'progress', 'week', 'status', 'lastActive', 'risk']
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
    const safeLastActive = user.lastActive ? new Date(user.lastActive) : null
    const lastActiveLabel =
      !safeLastActive || isNaN(safeLastActive.getTime())
        ? 'Unknown'
        : formatDistanceToNow(safeLastActive, { addSuffix: true })

    return (
      <Tr key={user.id} _hover={{ bg: 'brand.accent' }} cursor="pointer" onClick={() => openUser(user)}>
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
        <Td>
          <Badge colorScheme={riskColor[user.riskStatus]} textTransform="capitalize">
            {user.riskStatus === 'at_risk' ? 'At Risk' : user.riskStatus}
          </Badge>
        </Td>
      </Tr>
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
        <Button size="sm" onClick={clearSelection} variant="ghost">
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
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, sortedUsers.length)} of {sortedUsers.length} users
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
                      e.target.checked ? selectAll(atRiskUsers.map(u => u.id)) : clearSelection()
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
                    <Text fontSize="sm">
                      {user.lastActive
                        ? formatDistanceToNow(new Date(user.lastActive), { addSuffix: true })
                        : 'Unknown'}
                    </Text>
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
          <Text fontWeight="semibold" color="brand.text">Mentors & Leaders</Text>
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
                  <Td>
                    {leader.lastActive
                      ? formatDistanceToNow(new Date(leader.lastActive), { addSuffix: true })
                      : 'Unknown'}
                  </Td>
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
              isLoading={approvalActionId === selectedRequest?.id}
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
