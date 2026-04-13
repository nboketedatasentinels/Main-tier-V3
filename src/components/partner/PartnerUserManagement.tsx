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
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { PartnerUser, PartnerOrganization, PartnerRiskLevel } from '@/hooks/usePartnerDashboardData'
import { useAuth } from '@/hooks/useAuth'
import { usePointsApprovalQueue } from '@/hooks/partner/usePointsApprovalQueue'
import { db } from '@/services/firebase'
import UserNudgeHistoryPanel from '@/components/partner/nudges/UserNudgeHistoryPanel'
import { type PointsVerificationRequest } from '@/services/pointsVerificationService'
import { getDisplayName } from '@/utils/displayName'

export type PartnerUserManagementTab = 'users' | 'risk' | 'leaders' | 'approvals'

interface PartnerUserManagementProps {
  users: PartnerUser[]
  usersLoading: boolean
  organizations: PartnerOrganization[]
  organizationsLoading: boolean
  organizationsReady: boolean
  selectedOrg: string
  onSelectOrg: (org: string) => void
  updateUserPoints: (userId: string, delta: number, reason: string) => Promise<void>
  initialTab?: PartnerUserManagementTab
  onStartIntervention?: (user: PartnerUser) => Promise<void> | void
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
  if (!parsed) return 'No activity yet'
  return formatDistanceToNow(parsed, { addSuffix: true })
}

const getSortableValue = (user: PartnerUser, key: string) => {
  switch (key) {
    case 'risk':
      return user.riskStatus
    case 'name':
      return getDisplayName(user, 'Member')
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
  initialTab = 'users',
  onStartIntervention,
}) => {
  const [activeTab, setActiveTab] = useState<PartnerUserManagementTab>(initialTab)
  const [sortKey, setSortKey] = useState('lastActive')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedUser, setSelectedUser] = useState<PartnerUser | null>(null)
  const [nudgeEnabledDraft, setNudgeEnabledDraft] = useState(true)
  const [followUpNoteDraft, setFollowUpNoteDraft] = useState('')
  const [savingNudgePreference, setSavingNudgePreference] = useState(false)
  const [savingFollowUpNote, setSavingFollowUpNote] = useState(false)
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

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (!selectedUser) {
      setNudgeEnabledDraft(true)
      setFollowUpNoteDraft('')
      return
    }

    setNudgeEnabledDraft(selectedUser.nudgeEnabled ?? true)
    setFollowUpNoteDraft(selectedUser.adminNotes ?? '')
  }, [selectedUser])

  const openUser = (user: PartnerUser) => {
    setSelectedUser(user)
    drawer.onOpen()
  }

  const persistProfileMetadata = async (userId: string, updates: Record<string, unknown>) => {
    const timestamp = serverTimestamp()
    await updateDoc(doc(db, 'profiles', userId), {
      ...updates,
      updatedAt: timestamp,
      updated_at: timestamp,
    })
  }

  const handleNudgePreferenceToggle = async (enabled: boolean) => {
    if (!selectedUser) return
    const previousValue = selectedUser.nudgeEnabled ?? true
    const userId = selectedUser.id

    setNudgeEnabledDraft(enabled)
    setSavingNudgePreference(true)

    try {
      await persistProfileMetadata(userId, {
        nudgeEnabled: enabled,
        nudge_enabled: enabled,
      })
      setSelectedUser((prev) => (prev && prev.id === userId ? { ...prev, nudgeEnabled: enabled } : prev))
      toast({
        title: 'Nudge preference saved',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })
    } catch (error) {
      console.error('[PartnerUserManagement] Failed to save nudge preference', error)
      setNudgeEnabledDraft(previousValue)
      toast({
        title: 'Failed to save nudge preference',
        description: 'Please retry in a moment.',
        status: 'error',
      })
    } finally {
      setSavingNudgePreference(false)
    }
  }

  const handleSaveFollowUpNote = async () => {
    if (!selectedUser) return
    const userId = selectedUser.id
    const noteValue = followUpNoteDraft.trim()

    setSavingFollowUpNote(true)
    try {
      await persistProfileMetadata(userId, {
        adminNotes: noteValue,
        admin_notes: noteValue,
      })
      setSelectedUser((prev) => (prev && prev.id === userId ? { ...prev, adminNotes: noteValue } : prev))
      toast({
        title: 'Follow-up note saved',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })
    } catch (error) {
      console.error('[PartnerUserManagement] Failed to save follow-up note', error)
      toast({
        title: 'Failed to save follow-up note',
        description: 'Please retry in a moment.',
        status: 'error',
      })
    } finally {
      setSavingFollowUpNote(false)
    }
  }

  const handleStartIntervention = async (user: PartnerUser) => {
    if (!onStartIntervention) {
      openUser(user)
      return
    }

    try {
      await onStartIntervention(user)
    } catch (error) {
      console.error('[PartnerUserManagement] Failed to start intervention', error)
      toast({
        title: 'Failed to start intervention',
        description: 'We could not create an intervention for this learner. Please try again.',
        status: 'error',
      })
    }
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

  const columnWidths: Record<string, string> = {
    expand: '30px',
    risk: '70px',
    name: '180px',
    company: '80px',
    progress: '90px',
    week: '60px',
    status: '70px',
    lastActive: '80px',
    action: '90px',
  }

  const renderTableHeader = () => (
    <Thead>
      <Tr>
        <Th width={columnWidths.expand} px={1}></Th>
        {['Risk', 'Name/Email', 'Company', 'Progress', 'Week', 'Status', 'Active', 'Action'].map((header, idx) => {
          const sortMapping = ['risk', 'name', 'company', 'progress', 'week', 'status', 'lastActive', 'action']
          const key = sortMapping[idx] || 'name'
          const widthKey = ['risk', 'name', 'company', 'progress', 'week', 'status', 'lastActive', 'action'][idx]
          return (
            <Th
              key={header}
              cursor="pointer"
              onClick={() => toggleSort(key)}
              whiteSpace="nowrap"
              width={columnWidths[widthKey]}
              px={2}
              fontSize="xs"
            >
              <HStack spacing={1}>
                <Text>{header}</Text>
                {sortKey === key && <Badge size="sm" colorScheme="purple">{sortDir === 'asc' ? '▲' : '▼'}</Badge>}
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
    const displayName = getDisplayName(user, 'Member')

    return (
      <React.Fragment key={user.id}>
        <Tr _hover={{ bg: 'brand.accent' }} cursor="pointer" onClick={() => openUser(user)}>
          <Td px={1} onClick={(e) => toggleRowExpansion(user.id, e)}>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Td>
          <Td px={2}>
            <Badge size="sm" colorScheme={riskColor[user.riskStatus]} textTransform="capitalize" fontSize="xs">
              {user.riskStatus === 'at_risk' ? 'Risk' : user.riskStatus}
            </Badge>
          </Td>
          <Td px={2} maxW="180px">
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="semibold" color="brand.text" fontSize="sm" noOfLines={1}>
                {displayName}
              </Text>
              <Text fontSize="xs" color="brand.subtleText" noOfLines={1}>
                {user.email}
              </Text>
            </VStack>
          </Td>
          <Td px={2} fontSize="sm" textTransform="capitalize">{user.companyCode || '—'}</Td>
          <Td px={2}>
            <HStack spacing={1}>
              <Box bg="brand.accent" borderRadius="full" h="6px" w="50px" position="relative">
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
              <Text fontSize="xs">{user.progressPercent}%</Text>
            </HStack>
          </Td>
          <Td px={2} fontSize="sm">{user.currentWeek}</Td>
          <Td px={2}>
            <Badge size="sm" fontSize="xs" colorScheme={user.status === 'Active' ? 'green' : 'yellow'}>{user.status}</Badge>
          </Td>
          <Td px={2}>
            <Text fontSize="xs" noOfLines={1}>{lastActiveLabel}</Text>
          </Td>
          <Td px={2} onClick={(e) => e.stopPropagation()}>
            {user.riskStatus !== 'engaged' ? (
              <Button size="xs" fontSize="xs" colorScheme="purple" onClick={() => void handleStartIntervention(user)}>Intervene</Button>
            ) : (
              <Button size="xs" fontSize="xs" variant="outline" onClick={() => openUser(user)}>Check-in</Button>
            )}
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
                        {(user.riskReasons ?? ['Below current 2-week cycle points target']).map((reason, idx) => (
                          <Badge key={idx} colorScheme="orange" variant="subtle">{reason}</Badge>
                        ))}
                      </VStack>
                    </Box>
                    <Box>
                      <Text fontWeight="bold" fontSize="xs" color="gray.500" textTransform="uppercase" mb={2}>Cycle Progress</Text>
                      <VStack align="flex-start" spacing={1}>
                        <Text fontSize="sm">Points accumulated: {user.weeklyEarned} pts</Text>
                        <Text fontSize="sm">Cycle target: {user.weeklyRequired} pts</Text>
                        <Badge colorScheme={user.weeklyEarned >= user.weeklyRequired ? 'green' : 'orange'}>
                          {user.weeklyEarned >= user.weeklyRequired ? 'Target met' : 'Below target'}
                        </Badge>
                      </VStack>
                    </Box>
                    <Box>
                      <Text fontWeight="bold" fontSize="xs" color="gray.500" textTransform="uppercase" mb={2}>Partner Notes</Text>
                      <Text fontSize="sm" color="gray.600">{user.adminNotes?.trim() || 'No notes available for this learner.'}</Text>
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
          <Box overflowX="auto">
          <Table size="sm" variant="simple" w="100%">
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
          </Box>

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
          <Box overflowX="auto">
          <Table size="sm" variant="simple" w="100%">
            <Thead>
              <Tr>
                <Th px={1} width="30px">
                  <Checkbox
                    size="md"
                    borderRadius="md"
                    onChange={e =>
                      setSelection(e.target.checked ? atRiskUsers.map(u => u.id) : [])
                    }
                  />
                </Th>
                <Th px={2} fontSize="xs">Name/Email</Th>
                <Th px={2} fontSize="xs">Company</Th>
                <Th px={2} fontSize="xs">Progress</Th>
                <Th px={2} fontSize="xs">Week</Th>
                <Th px={2} fontSize="xs">Status</Th>
                <Th px={2} fontSize="xs">Active</Th>
                <Th px={2} fontSize="xs">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {usersLoading && (
                <Tr>
                  <Td colSpan={8}>
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
                  <Td px={1}>
                    <Checkbox
                      size="md"
                      borderRadius="md"
                      isChecked={selection.includes(user.id)}
                      onChange={() => toggleSelection(user.id)}
                    />
                  </Td>
                  <Td px={2} maxW="180px">
                    <VStack align="flex-start" spacing={0}>
                      <Text fontWeight="semibold" color="brand.text" fontSize="sm" noOfLines={1}>{getDisplayName(user, 'Member')}</Text>
                      <Text fontSize="xs" color="brand.subtleText" noOfLines={1}>{user.email}</Text>
                    </VStack>
                  </Td>
                  <Td px={2} fontSize="sm" textTransform="capitalize">{user.companyCode || '—'}</Td>
                  <Td px={2}>
                    <HStack spacing={1}>
                      <Box bg="red.50" borderRadius="full" h="6px" w="50px" position="relative">
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
                      <Text fontSize="xs">{user.progressPercent}%</Text>
                    </HStack>
                  </Td>
                  <Td px={2} fontSize="sm">{user.currentWeek}</Td>
                  <Td px={2}>
                    <Badge size="sm" fontSize="xs" colorScheme="red">At Risk</Badge>
                  </Td>
                  <Td px={2}>
                    <Text fontSize="xs" noOfLines={1}>{formatLastActiveLabel(user.lastActive)}</Text>
                  </Td>
                  <Td px={2}>
                    <Button size="xs" fontSize="xs" colorScheme="purple" variant="outline" onClick={() => openUser(user)}>
                      Nudge
                    </Button>
                  </Td>
                </Tr>
              ))}
              {!usersLoading && !atRiskUsers.length && (
                <Tr>
                  <Td colSpan={8}>
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
          </Box>
        </Stack>
      )}

      {activeTab === 'leaders' && (
        <Stack spacing={4}>
          <Text fontWeight="semibold" color="brand.text">Mentors & Team Leaders</Text>
          <Box overflowX="auto">
          <Table size="sm" variant="simple" w="100%">
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
                      <Text fontWeight="semibold" color="brand.text">{getDisplayName(leader, 'Member')}</Text>
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
          </Box>
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
                        <Text fontWeight="semibold" color="brand.text">{getDisplayName(user, 'Member')}</Text>
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
                  <Text fontSize="xl" fontWeight="bold">{getDisplayName(selectedUser, 'Member')}</Text>
                  <Text color="brand.subtleText">{selectedUser.email}</Text>
                </VStack>
                <HStack spacing={3}>
                  <Badge colorScheme="purple" textTransform="capitalize">{selectedUser.companyCode}</Badge>
                  <Badge colorScheme={riskColor[selectedUser.riskStatus]}>Risk: {selectedUser.riskStatus}</Badge>
                </HStack>
                <Divider />
                <Stack spacing={2}>
                  <Text fontWeight="semibold">Cycle progress</Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    Points accumulated: {selectedUser.weeklyEarned} / {selectedUser.weeklyRequired} in the current 2-week cycle.
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
                    <Switch
                      colorScheme="purple"
                      isChecked={nudgeEnabledDraft}
                      isDisabled={savingNudgePreference}
                      onChange={(event) => void handleNudgePreferenceToggle(event.target.checked)}
                    />
                  </HStack>
                  <Text fontSize="xs" color="brand.subtleText">
                    Preferences are honored across email and in-app channels.
                  </Text>
                </Stack>
                <Stack spacing={2}>
                  <Text fontWeight="semibold">Admin follow-up notes</Text>
                  <Textarea
                    placeholder="Add a quick note about manual outreach"
                    value={followUpNoteDraft}
                    onChange={(event) => setFollowUpNoteDraft(event.target.value)}
                    minH="96px"
                  />
                  <Button
                    size="sm"
                    alignSelf="flex-start"
                    colorScheme="purple"
                    variant="outline"
                    isLoading={savingFollowUpNote}
                    onClick={() => void handleSaveFollowUpNote()}
                  >
                    Save note
                  </Button>
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
            <Button
              colorScheme="purple"
              onClick={() => {
                if (!selectedUser) return
                void handleStartIntervention(selectedUser)
              }}
              isDisabled={!selectedUser}
            >
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
