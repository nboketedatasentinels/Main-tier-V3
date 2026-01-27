import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Flex,
  FormControl,
  FormLabel,
  Heading,
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
  Skeleton,
  Stack,
  Tab,
  TabList,
  Tabs,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  useBreakpointValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { CheckIcon, CloseIcon } from '@chakra-ui/icons'
import { differenceInDays, format, formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useAllUpgradeRequests, useUpdateRequestStatus } from '@/hooks/admin/useAdminUpgradeRequests'
import { useAdminPointsVerificationRequests } from '@/hooks/admin/useAdminPointsVerificationRequests'
import {
  approvePointsVerificationRequest,
  rejectPointsVerificationRequest,
  PointsVerificationRequest,
} from '@/services/pointsVerificationService'
import { ApprovalRecord, ApprovalStatus, ApprovalWorkflowType } from '@/types/approvals'
import { getApprovalTypeMeta } from '@/utils/approvalTypeMapper'

const toDate = (value?: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const getDisplayDate = (value?: unknown) => {
  const dateValue = toDate(value)
  if (!dateValue) {
    return {
      label: 'Recently submitted',
      exact: 'Date unavailable',
      isOverdue: false,
    }
  }
  const days = differenceInDays(new Date(), dateValue)
  const isOverdue = days > 7
  const label = days > 30 ? format(dateValue, 'MMM d') : formatDistanceToNow(dateValue, { addSuffix: true })
  return {
    label: isOverdue ? `${label} ⚠️` : label,
    exact: format(dateValue, 'PPpp'),
    isOverdue,
  }
}

const normalizeName = (value: string) =>
  value
    .replace(/[_-.]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')

const getUserDisplayName = (userId?: string | null) => {
  if (!userId) return 'Unknown user'
  if (userId.includes('@')) {
    return normalizeName(userId.split('@')[0])
  }
  if (userId.length > 8) {
    return `User ${userId.slice(0, 6).toUpperCase()}`
  }
  return normalizeName(userId)
}

const getUserSubtitle = (userId?: string | null) => {
  if (!userId) return 'User ID unavailable'
  return userId.includes('@') ? userId : `ID: ${userId}`
}

const getRequestTypeBadge = (record: ApprovalRecord) => {
  if (record.type === 'points_verification') return 'Activity'
  const requestType = (record.source as { request_type?: string })?.request_type
  if (!requestType) return 'Upgrade'
  return requestType.replace(/_/g, ' ')
}

const matchesStatusTab = (status: ApprovalStatus, tab: 'pending' | 'approved' | 'rejected') => {
  if (tab === 'approved') {
    return status === 'approved' || status === 'completed'
  }
  return status === tab
}

const rejectionTemplates = [
  'This activity was already credited.',
  'Please provide supporting evidence to verify the activity.',
  'Duplicate submission detected. Submit only one request per activity.',
]

const rejectionReasonOptions = [
  'Insufficient evidence',
  'Duplicate request',
  'Invalid activity',
  'Other',
]

const ApprovalCenterPage: React.FC = () => {
  const toast = useToast()
  const { profile } = useAuth()
  const { requests: upgradeRequests, loading: upgradeLoading, error: upgradeError, refetch } = useAllUpgradeRequests()
  const {
    requests: verificationRequests,
    loading: verificationLoading,
    error: verificationError,
  } = useAdminPointsVerificationRequests('all', 40)
  const { mutate, loading: updatingUpgrade } = useUpdateRequestStatus()
  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [workflowFilter, setWorkflowFilter] = useState<ApprovalWorkflowType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [draftWorkflow, setDraftWorkflow] = useState<ApprovalWorkflowType | 'all'>('all')
  const [draftSearch, setDraftSearch] = useState('')
  const [draftDateStart, setDraftDateStart] = useState('')
  const [draftDateEnd, setDraftDateEnd] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [selectedReject, setSelectedReject] = useState<ApprovalRecord | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectCategory, setRejectCategory] = useState('')
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null)
  const [bulkRejectReason, setBulkRejectReason] = useState('')
  const [bulkRejectCategory, setBulkRejectCategory] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notesById, setNotesById] = useState<Record<string, string>>({})
  const [quickFilters, setQuickFilters] = useState({ highValue: false, overdue: false, firstTime: false })
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const rejectModal = useDisclosure()
  const bulkModal = useDisclosure()
  const isMobile = useBreakpointValue({ base: true, md: false })

  const approvalRecords = useMemo<ApprovalRecord[]>(() => {
    const upgradeRecords: ApprovalRecord[] = upgradeRequests.map((request) => {
      const searchText = [
        request.user_id,
        request.requested_tier,
        request.current_tier,
        request.message,
        request.request_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return {
        id: request.id,
        type: 'upgrade_request',
        status: request.status,
        createdAt: toDate(request.requested_at),
        userId: request.user_id,
        title: request.requested_tier ?? 'Upgrade request',
        summary: request.message ?? null,
        points: null,
        source: request,
        searchText,
      }
    })

    const verificationRecords: ApprovalRecord[] = verificationRequests.map((request) => {
      const searchText = [
        request.user_id,
        request.activity_title,
        request.activity_id,
        request.notes,
        request.proof_url,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return {
        id: request.id,
        type: 'points_verification',
        status: (request.status ?? 'pending') as ApprovalStatus,
        createdAt: toDate(request.created_at),
        userId: request.user_id,
        title: request.activity_title ?? request.activity_id,
        summary: request.notes ?? null,
        points: request.points ?? null,
        source: request,
        searchText,
      }
    })

    return [...verificationRecords, ...upgradeRecords].sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0
      const bTime = b.createdAt?.getTime() ?? 0
      return bTime - aTime
    })
  }, [upgradeRequests, verificationRequests])

  const userRequestCounts = useMemo(() => {
    const counts = new Map<string, number>()
    approvalRecords.forEach((record) => {
      if (!record.userId) return
      counts.set(record.userId, (counts.get(record.userId) ?? 0) + 1)
    })
    return counts
  }, [approvalRecords])

  const pendingCount = useMemo(
    () => approvalRecords.filter((record) => record.status === 'pending').length,
    [approvalRecords],
  )

  const statusCounts = useMemo(() => {
    const pending = approvalRecords.filter((record) => record.status === 'pending').length
    const approved = approvalRecords.filter((record) => record.status === 'approved' || record.status === 'completed').length
    const rejected = approvalRecords.filter((record) => record.status === 'rejected').length
    return { pending, approved, rejected }
  }, [approvalRecords])

  const statusFiltered = useMemo(
    () => approvalRecords.filter((record) => matchesStatusTab(record.status, statusTab)),
    [approvalRecords, statusTab],
  )

  const workflowCounts = useMemo(() => {
    return statusFiltered.reduce(
      (acc, record) => {
        acc.all += 1
        acc[record.type] += 1
        return acc
      },
      { all: 0, points_verification: 0, upgrade_request: 0 } as Record<'all' | ApprovalWorkflowType, number>,
    )
  }, [statusFiltered])

  const appliedFilters = useMemo(
    () => ({ search, workflow: workflowFilter, dateStart, dateEnd }),
    [dateEnd, dateStart, search, workflowFilter],
  )

  const hasPendingFilterChanges = useMemo(
    () =>
      appliedFilters.search !== draftSearch ||
      appliedFilters.workflow !== draftWorkflow ||
      appliedFilters.dateStart !== draftDateStart ||
      appliedFilters.dateEnd !== draftDateEnd,
    [
      appliedFilters.dateEnd,
      appliedFilters.dateStart,
      appliedFilters.search,
      appliedFilters.workflow,
      draftDateEnd,
      draftDateStart,
      draftSearch,
      draftWorkflow,
    ],
  )

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()
    return statusFiltered.filter((record) => {
      if (workflowFilter !== 'all' && record.type !== workflowFilter) return false
      if (query && !record.searchText.includes(query)) return false
      if (dateStart) {
        const startDate = new Date(dateStart)
        if (record.createdAt && record.createdAt < startDate) return false
      }
      if (dateEnd) {
        const endDate = new Date(dateEnd)
        endDate.setHours(23, 59, 59, 999)
        if (record.createdAt && record.createdAt > endDate) return false
      }
      const isHighValue = (record.points ?? 0) > 1000
      const isOverdue = differenceInDays(new Date(), record.createdAt ?? new Date()) > 7
      const isFirstTime = record.userId ? (userRequestCounts.get(record.userId) ?? 0) <= 1 : false
      if (quickFilters.highValue && !isHighValue) return false
      if (quickFilters.overdue && !isOverdue) return false
      if (quickFilters.firstTime && !isFirstTime) return false
      return true
    })
  }, [
    dateEnd,
    dateStart,
    quickFilters.firstTime,
    quickFilters.highValue,
    quickFilters.overdue,
    search,
    statusFiltered,
    userRequestCounts,
    workflowFilter,
  ])

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [currentPage, filteredRecords, pageSize])

  useEffect(() => {
    setPage(1)
  }, [workflowFilter, search, dateStart, dateEnd, statusTab, quickFilters, pageSize])

  const loading = upgradeLoading || verificationLoading
  const error = upgradeError || verificationError

  const selectAllVisible = () => {
    const next = new Set(selectedIds)
    const visibleIds = paginatedRecords.map((record) => record.id)
    const allSelected = visibleIds.every((id) => next.has(id))
    if (allSelected) {
      visibleIds.forEach((id) => next.delete(id))
    } else {
      visibleIds.forEach((id) => next.add(id))
    }
    setSelectedIds(next)
  }

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const clearSelection = () => setSelectedIds(new Set())

  const selectedRecords = useMemo(
    () => filteredRecords.filter((record) => selectedIds.has(record.id)),
    [filteredRecords, selectedIds],
  )

  const totalSelectedPoints = useMemo(
    () => selectedRecords.reduce((sum, record) => sum + (record.points ?? 0), 0),
    [selectedRecords],
  )

  const getDecisionSummary = (record: ApprovalRecord) => {
    if (record.status === 'pending') return null
    if (record.type === 'points_verification') {
      const source = record.source as PointsVerificationRequest
      if (record.status === 'approved') {
        return `Approved by ${source.approved_by_name ?? 'Admin'} · ${formatDistanceToNow(toDate(source.approved_at) ?? new Date(), {
          addSuffix: true,
        })}`
      }
      if (record.status === 'rejected') {
        return `Rejected by ${source.rejected_by_name ?? 'Admin'} · ${formatDistanceToNow(toDate(source.rejected_at) ?? new Date(), {
          addSuffix: true,
        })}`
      }
    }
    if (record.status === 'approved' || record.status === 'completed') {
      return `Approved by ${(record.source as { reviewed_by?: string })?.reviewed_by ?? 'Admin'} · ${formatDistanceToNow(
        record.createdAt ?? new Date(),
        { addSuffix: true },
      )}`
    }
    if (record.status === 'rejected') {
      return `Rejected by ${(record.source as { reviewed_by?: string })?.reviewed_by ?? 'Admin'} · ${formatDistanceToNow(
        record.createdAt ?? new Date(),
        { addSuffix: true },
      )}`
    }
    return null
  }

  const approveRecord = async (record: ApprovalRecord) => {
    if (record.type === 'points_verification') {
      await approvePointsVerificationRequest({
        request: record.source as PointsVerificationRequest,
        approver: {
          id: profile?.id ?? null,
          name: profile?.fullName ?? null,
        },
      })
    } else {
      await mutate(record.id, 'approved', undefined, profile?.id)
      refetch()
    }
  }

  const rejectRecord = async (record: ApprovalRecord, reason?: string) => {
    if (record.type === 'points_verification') {
      await rejectPointsVerificationRequest({
        request: record.source as PointsVerificationRequest,
        approver: {
          id: profile?.id ?? null,
          name: profile?.fullName ?? null,
        },
        reason: reason || undefined,
      })
    } else {
      await mutate(record.id, 'rejected', reason || undefined, profile?.id)
      refetch()
    }
  }

  const handleApprove = async (record: ApprovalRecord) => {
    setActionId(record.id)
    try {
      await approveRecord(record)
      toast({ title: 'Request approved ✓', status: 'success', duration: 3000, isClosable: true })
    } catch (error) {
      console.error(error)
      toast({ title: 'Approval failed', status: 'error', duration: 3000, isClosable: true })
    } finally {
      setActionId(null)
    }
  }

  const openRejectModal = (record: ApprovalRecord) => {
    setSelectedReject(record)
    setRejectReason('')
    setRejectCategory('')
    rejectModal.onOpen()
  }

  const handleReject = async () => {
    if (!selectedReject) return
    setActionId(selectedReject.id)
    try {
      const reason = [rejectCategory, rejectReason].filter(Boolean).join(' — ')
      await rejectRecord(selectedReject, reason)
      toast({ title: 'Rejection saved', status: 'info', duration: 3000, isClosable: true })
      rejectModal.onClose()
      setSelectedReject(null)
      setRejectReason('')
      setRejectCategory('')
    } catch (error) {
      console.error(error)
      toast({ title: 'Rejection failed', status: 'error', duration: 3000, isClosable: true })
    } finally {
      setActionId(null)
    }
  }

  const openBulkModal = (action: 'approve' | 'reject') => {
    setBulkAction(action)
    setBulkRejectReason('')
    setBulkRejectCategory('')
    bulkModal.onOpen()
  }

  const handleBulkAction = async () => {
    if (!bulkAction) return
    setBulkLoading(true)
    try {
      const reason = [bulkRejectCategory, bulkRejectReason].filter(Boolean).join(' — ')
      for (const record of selectedRecords) {
        if (bulkAction === 'approve') {
          await approveRecord(record)
        } else {
          await rejectRecord(record, reason)
        }
      }
      toast({
        title:
          bulkAction === 'approve'
            ? `Approved ${selectedRecords.length} requests totaling ${totalSelectedPoints.toLocaleString()} points.`
            : `Rejected ${selectedRecords.length} requests.`,
        status: bulkAction === 'approve' ? 'success' : 'info',
        duration: 3000,
        isClosable: true,
      })
      clearSelection()
      bulkModal.onClose()
    } catch (error) {
      console.error(error)
      toast({ title: 'Bulk action failed', status: 'error', duration: 3000, isClosable: true })
    } finally {
      setBulkLoading(false)
    }
  }

  const applyFilters = () => {
    setWorkflowFilter(draftWorkflow)
    setSearch(draftSearch)
    setDateStart(draftDateStart)
    setDateEnd(draftDateEnd)
  }

  const clearFilters = () => {
    setDraftWorkflow('all')
    setDraftSearch('')
    setDraftDateStart('')
    setDraftDateEnd('')
    setWorkflowFilter('all')
    setSearch('')
    setDateStart('')
    setDateEnd('')
    setQuickFilters({ highValue: false, overdue: false, firstTime: false })
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) {
        return
      }
      if (event.key.toLowerCase() === 'a' && selectedIds.size > 0) {
        event.preventDefault()
        openBulkModal('approve')
      }
      if (event.key.toLowerCase() === 'r' && selectedIds.size > 0) {
        event.preventDefault()
        openBulkModal('reject')
      }
      if (event.code === 'Space') {
        event.preventDefault()
        selectAllVisible()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIds.size, paginatedRecords])

  const pendingBadgeColor = pendingCount === 0 ? 'green' : pendingCount > 20 ? 'red' : 'orange'

  const hasActiveFilters =
    workflowFilter !== 'all' ||
    search.trim().length > 0 ||
    dateStart.length > 0 ||
    dateEnd.length > 0 ||
    quickFilters.highValue ||
    quickFilters.overdue ||
    quickFilters.firstTime

  const renderEmptyState = () => {
    if (statusTab === 'pending' && !hasActiveFilters) {
      return (
        <Box borderWidth="1px" borderRadius="lg" bg="white" p={8} textAlign="center">
          <Text fontSize="lg" fontWeight="semibold">
            ✅ All caught up!
          </Text>
          <Text color="gray.600" mt={2}>
            No pending approvals. Check back later or review recent decisions.
          </Text>
          <Button variant="link" mt={3} onClick={() => setStatusTab('approved')}>
            View approved items
          </Button>
        </Box>
      )
    }

    return (
      <Box borderWidth="1px" borderRadius="lg" bg="white" p={8} textAlign="center">
        <Text fontSize="lg" fontWeight="semibold">
          No results match your filters
        </Text>
        <Text color="gray.600" mt={2}>
          Try adjusting your search or clear all filters.
        </Text>
        <Button variant="outline" mt={4} onClick={clearFilters}>
          Clear all filters
        </Button>
      </Box>
    )
  }

  return (
    <Stack spacing={6}>
      <Stack spacing={2}>
        <Flex align={{ base: 'flex-start', md: 'center' }} justify="space-between" wrap="wrap" gap={3}>
          <HStack spacing={3} align="center">
            <Heading size="lg">Approval Center</Heading>
            <Badge colorScheme={pendingBadgeColor} fontSize="sm" px={3} py={1} borderRadius="full">
              {pendingCount} pending
            </Badge>
          </HStack>
          <Button variant="link" colorScheme="blue">
            View approval history
          </Button>
        </Flex>
        <Text color="gray.600">Review and process pending approval requests.</Text>
        {pendingCount > 20 && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            Backlog is growing. Prioritize high-value and overdue requests.
          </Alert>
        )}
      </Stack>

      <Tabs index={['pending', 'approved', 'rejected'].indexOf(statusTab)} onChange={(index) => setStatusTab(['pending', 'approved', 'rejected'][index] as 'pending' | 'approved' | 'rejected')} variant="solid-rounded" colorScheme="blue">
        <TabList>
          <Tab>Pending ({statusCounts.pending})</Tab>
          <Tab>Approved ({statusCounts.approved})</Tab>
          <Tab>Rejected ({statusCounts.rejected})</Tab>
        </TabList>
      </Tabs>

      <Stack spacing={3}>
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          gap={3}
          align={{ base: 'stretch', lg: 'flex-end' }}
          wrap="wrap"
        >
          <FormControl maxW={{ base: 'full', lg: '280px' }}>
            <FormLabel fontSize="sm" mb={1}>
              Search
            </FormLabel>
            <Input
              placeholder="Search by user, activity, or tier"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
            />
          </FormControl>
          <FormControl maxW={{ base: 'full', lg: '240px' }}>
            <FormLabel fontSize="sm" mb={1}>
              Workflow
            </FormLabel>
            <Select
              value={draftWorkflow}
              onChange={(e) => setDraftWorkflow(e.target.value as ApprovalWorkflowType | 'all')}
            >
              <option value="all">All workflows ({workflowCounts.all})</option>
              <option value="points_verification">Points Verification ({workflowCounts.points_verification})</option>
              <option value="upgrade_request">Upgrade Requests ({workflowCounts.upgrade_request})</option>
            </Select>
          </FormControl>
          <FormControl maxW={{ base: 'full', lg: '220px' }}>
            <FormLabel fontSize="sm" mb={1}>
              Date range
            </FormLabel>
            <HStack spacing={2}>
              <Input
                type="date"
                value={draftDateStart}
                onChange={(e) => setDraftDateStart(e.target.value)}
              />
              <Input
                type="date"
                value={draftDateEnd}
                onChange={(e) => setDraftDateEnd(e.target.value)}
              />
            </HStack>
          </FormControl>
          <Button
            colorScheme="blue"
            alignSelf={{ base: 'stretch', lg: 'flex-end' }}
            isDisabled={!hasPendingFilterChanges}
            onClick={applyFilters}
            minW="120px"
          >
            Apply
          </Button>
        </Flex>

        <HStack spacing={2} wrap="wrap">
          <Text fontSize="sm" color="gray.500">
            Quick filters:
          </Text>
          <Button
            size="sm"
            variant={quickFilters.highValue ? 'solid' : 'outline'}
            colorScheme="orange"
            onClick={() => setQuickFilters((prev) => ({ ...prev, highValue: !prev.highValue }))}
          >
            High value (&gt;1000 pts)
          </Button>
          <Button
            size="sm"
            variant={quickFilters.overdue ? 'solid' : 'outline'}
            colorScheme="red"
            onClick={() => setQuickFilters((prev) => ({ ...prev, overdue: !prev.overdue }))}
          >
            Overdue (&gt;7 days)
          </Button>
          <Button
            size="sm"
            variant={quickFilters.firstTime ? 'solid' : 'outline'}
            colorScheme="blue"
            onClick={() => setQuickFilters((prev) => ({ ...prev, firstTime: !prev.firstTime }))}
          >
            First-time users
          </Button>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear all filters
            </Button>
          )}
        </HStack>
      </Stack>

      {error && (
        <Alert status="error">
          <AlertIcon />
          <Text>{error.message}</Text>
        </Alert>
      )}

      {loading ? (
        <Stack spacing={3}>
          <Text fontSize="sm" color="gray.500">
            Loading approvals...
          </Text>
          <Box borderWidth="1px" borderRadius="lg" bg="white" p={4}>
            <Stack spacing={4}>
              {[...Array(5)].map((_, index) => (
                <Skeleton key={index} height="48px" />
              ))}
            </Stack>
          </Box>
        </Stack>
      ) : filteredRecords.length === 0 ? (
        renderEmptyState()
      ) : (
        <Stack spacing={4}>
          {!isMobile && (
            <Box borderWidth="1px" borderRadius="lg" bg="white" p={4} overflowX="auto">
              <Table size="md">
                <Thead>
                  <Tr>
                    <Th>
                      <Checkbox
                        isChecked={paginatedRecords.length > 0 && paginatedRecords.every((record) => selectedIds.has(record.id))}
                        onChange={(e) => {
                          e.stopPropagation()
                          selectAllVisible()
                        }}
                        aria-label="Select all visible"
                      />
                    </Th>
                    <Th>User</Th>
                    <Th>Request</Th>
                    <Th>Points</Th>
                    <Th>Submitted</Th>
                    <Th textAlign="right">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {paginatedRecords.map((record, index) => {
                    const meta = getApprovalTypeMeta(record.type)
                    const isPending = record.status === 'pending'
                    const isHighValue = (record.points ?? 0) > 1000
                    const isOverdue = differenceInDays(new Date(), record.createdAt ?? new Date()) > 7
                    const isFirstTime = record.userId ? (userRequestCounts.get(record.userId) ?? 0) <= 1 : false
                    const submitted = getDisplayDate(record.createdAt ?? undefined)
                    const rowBg = isOverdue
                      ? 'red.50'
                      : isHighValue
                        ? 'orange.50'
                        : index % 2 === 0
                          ? 'white'
                          : 'gray.50'
                    return (
                      <React.Fragment key={`${record.type}-${record.id}`}>
                        <Tr
                          role="group"
                          bg={rowBg}
                          _hover={{ bg: isOverdue ? 'red.100' : 'gray.100' }}
                          borderLeftWidth={isOverdue || isHighValue ? '4px' : '0px'}
                          borderLeftColor={isOverdue ? 'red.400' : isHighValue ? 'orange.400' : 'transparent'}
                          cursor="pointer"
                          onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                        >
                          <Td onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              isChecked={selectedIds.has(record.id)}
                              onChange={() => toggleSelection(record.id)}
                              aria-label={`Select ${record.title}`}
                            />
                          </Td>
                          <Td>
                            <HStack spacing={3} align="center">
                              <Avatar name={getUserDisplayName(record.userId)} size="sm" />
                              <Box>
                                <Button variant="link" colorScheme="blue" size="sm" px={0} onClick={(event) => event.stopPropagation()}>
                                  {getUserDisplayName(record.userId)}
                                </Button>
                                <Text fontSize="xs" color="gray.500">
                                  {getUserSubtitle(record.userId)}
                                </Text>
                              </Box>
                            </HStack>
                          </Td>
                          <Td>
                            <Stack spacing={2}>
                              <HStack spacing={2}>
                                <Text fontWeight="semibold">{record.title}</Text>
                                <Badge colorScheme="gray" textTransform="capitalize">
                                  {getRequestTypeBadge(record)}
                                </Badge>
                                {workflowFilter === 'all' && (
                                  <Badge colorScheme={meta.badgeColor}>{meta.label}</Badge>
                                )}
                                {isFirstTime && (
                                  <Badge colorScheme="purple" variant="subtle">
                                    New user
                                  </Badge>
                                )}
                              </HStack>
                              {record.summary && (
                                <Text fontSize="xs" color="gray.600" noOfLines={2}>
                                  {record.summary}
                                </Text>
                              )}
                              {getDecisionSummary(record) && (
                                <Text fontSize="xs" color="gray.500">
                                  {getDecisionSummary(record)}
                                </Text>
                              )}
                            </Stack>
                          </Td>
                          <Td>
                            <Stack spacing={1}>
                              <Text fontWeight="semibold" color={isHighValue ? 'orange.600' : 'gray.700'}>
                                {record.points?.toLocaleString() ?? '—'}
                              </Text>
                              {isHighValue && (
                                <Badge colorScheme="orange" variant="subtle" alignSelf="flex-start">
                                  High value
                                </Badge>
                              )}
                            </Stack>
                          </Td>
                          <Td>
                            <Tooltip label={submitted.exact} placement="top" hasArrow>
                              <Stack spacing={1}>
                                <Text color={submitted.isOverdue ? 'red.600' : 'gray.700'}>{submitted.label}</Text>
                                {submitted.isOverdue && (
                                  <Badge colorScheme="red" variant="subtle" alignSelf="flex-start">
                                    Overdue
                                  </Badge>
                                )}
                              </Stack>
                            </Tooltip>
                          </Td>
                          <Td textAlign="right" onClick={(event) => event.stopPropagation()}>
                            <HStack spacing={2} justify="flex-end">
                              <Tooltip label="Approve (A)" hasArrow>
                                <Button
                                  size="sm"
                                  colorScheme="green"
                                  variant="outline"
                                  leftIcon={<CheckIcon />}
                                  isLoading={actionId === record.id && isPending}
                                  isDisabled={!isPending || updatingUpgrade}
                                  onClick={() => handleApprove(record)}
                                  minH="44px"
                                >
                                  Approve
                                </Button>
                              </Tooltip>
                              <Tooltip label="Reject (R)" hasArrow>
                                <Button
                                  size="sm"
                                  colorScheme="red"
                                  variant="outline"
                                  leftIcon={<CloseIcon />}
                                  isLoading={actionId === record.id && isPending}
                                  isDisabled={!isPending || updatingUpgrade}
                                  onClick={() => openRejectModal(record)}
                                  minH="44px"
                                >
                                  Reject
                                </Button>
                              </Tooltip>
                            </HStack>
                          </Td>
                        </Tr>
                        <Tr bg={rowBg}>
                          <Td colSpan={6} p={0} border="none">
                            <Collapse in={expandedId === record.id} animateOpacity>
                              <Box px={6} py={4} bg="gray.50" borderTopWidth="1px">
                                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                                  <Box>
                                    <Text fontSize="sm" fontWeight="semibold" mb={1}>
                                      Full description
                                    </Text>
                                    <Text fontSize="sm" color="gray.600">
                                      {record.summary ?? 'No additional description provided.'}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize="sm" fontWeight="semibold" mb={1}>
                                      User history
                                    </Text>
                                    <Text fontSize="sm" color="gray.600">
                                      {(userRequestCounts.get(record.userId ?? '') ?? 0).toString()} previous requests, 0 rejections
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Text fontSize="sm" fontWeight="semibold" mb={1}>
                                      Supporting evidence
                                    </Text>
                                    {record.type === 'points_verification' && (record.source as PointsVerificationRequest).proof_url ? (
                                      <Link color="blue.600" href={(record.source as PointsVerificationRequest).proof_url} isExternal>
                                        View attachment
                                      </Link>
                                    ) : (
                                      <Text fontSize="sm" color="gray.600">
                                        No attachments
                                      </Text>
                                    )}
                                  </Box>
                                </SimpleGrid>
                                <Box mt={4}>
                                  <Text fontSize="sm" fontWeight="semibold" mb={2}>
                                    Notes for admin comments
                                  </Text>
                                  <Textarea
                                    value={notesById[record.id] ?? ''}
                                    onChange={(event) =>
                                      setNotesById((prev) => ({ ...prev, [record.id]: event.target.value }))
                                    }
                                    placeholder="Add internal notes for reviewers"
                                    size="sm"
                                  />
                                </Box>
                              </Box>
                            </Collapse>
                          </Td>
                        </Tr>
                      </React.Fragment>
                    )
                  })}
                </Tbody>
              </Table>
            </Box>
          )}

          {isMobile && (
            <Stack spacing={4}>
              {paginatedRecords.map((record) => {
                const isPending = record.status === 'pending'
                const isHighValue = (record.points ?? 0) > 1000
                const isOverdue = differenceInDays(new Date(), record.createdAt ?? new Date()) > 7
                const submitted = getDisplayDate(record.createdAt ?? undefined)
                return (
                  <Box key={`${record.type}-${record.id}`} borderWidth="1px" borderRadius="lg" bg="white" p={4}>
                    <Flex justify="space-between" align="center">
                      <Checkbox
                        isChecked={selectedIds.has(record.id)}
                        onChange={() => toggleSelection(record.id)}
                        aria-label={`Select ${record.title}`}
                      />
                      <Badge colorScheme={isOverdue ? 'red' : isHighValue ? 'orange' : 'gray'}>
                        {isOverdue ? 'Overdue' : isHighValue ? 'High value' : 'Normal'}
                      </Badge>
                    </Flex>
                    <HStack spacing={3} mt={3}>
                      <Avatar name={getUserDisplayName(record.userId)} size="sm" />
                      <Box>
                        <Text fontWeight="semibold">{getUserDisplayName(record.userId)}</Text>
                        <Text fontSize="xs" color="gray.500">
                          {getUserSubtitle(record.userId)}
                        </Text>
                      </Box>
                    </HStack>
                    <Box mt={3}>
                      <Text fontWeight="semibold">{record.title}</Text>
                      <HStack spacing={2} mt={1}>
                        <Badge colorScheme="gray">{getRequestTypeBadge(record)}</Badge>
                        {workflowFilter === 'all' && (
                          <Badge colorScheme={getApprovalTypeMeta(record.type).badgeColor}>
                            {getApprovalTypeMeta(record.type).label}
                          </Badge>
                        )}
                      </HStack>
                    </Box>
                    <Flex justify="space-between" mt={3} align="center">
                      <Box>
                        <Text fontSize="xs" color="gray.500">
                          Points
                        </Text>
                        <Text fontWeight="semibold" color={isHighValue ? 'orange.600' : 'gray.700'}>
                          {record.points?.toLocaleString() ?? '—'}
                        </Text>
                      </Box>
                      <Box textAlign="right">
                        <Text fontSize="xs" color="gray.500">
                          Submitted
                        </Text>
                        <Text color={submitted.isOverdue ? 'red.600' : 'gray.700'}>{submitted.label}</Text>
                      </Box>
                    </Flex>
                    <HStack spacing={2} mt={4}>
                      <Button
                        size="sm"
                        colorScheme="green"
                        variant="outline"
                        leftIcon={<CheckIcon />}
                        isLoading={actionId === record.id && isPending}
                        isDisabled={!isPending || updatingUpgrade}
                        onClick={() => handleApprove(record)}
                        minH="44px"
                        flex={1}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="outline"
                        leftIcon={<CloseIcon />}
                        isLoading={actionId === record.id && isPending}
                        isDisabled={!isPending || updatingUpgrade}
                        onClick={() => openRejectModal(record)}
                        minH="44px"
                        flex={1}
                      >
                        Reject
                      </Button>
                    </HStack>
                  </Box>
                )
              })}
            </Stack>
          )}

          <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
            <Text fontSize="sm" color="gray.500">
              Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} {statusTab} items
            </Text>
            <HStack spacing={2}>
              <Button size="sm" variant="outline" isDisabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                Previous
              </Button>
              <Text fontSize="sm">Page {currentPage} of {pageCount}</Text>
              <Button size="sm" variant="outline" isDisabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                Next
              </Button>
              <Select
                size="sm"
                width="120px"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    Show {size}
                  </option>
                ))}
              </Select>
            </HStack>
          </Flex>
        </Stack>
      )}

      {selectedIds.size > 0 && (
        <Flex
          position="fixed"
          bottom={6}
          left="50%"
          transform="translateX(-50%)"
          bg="gray.900"
          color="white"
          px={4}
          py={3}
          borderRadius="full"
          align="center"
          gap={3}
          boxShadow="lg"
          zIndex={20}
        >
          <Text fontSize="sm" fontWeight="semibold">
            {selectedIds.size} selected
          </Text>
          <Button size="sm" colorScheme="green" onClick={() => openBulkModal('approve')}>
            Bulk Approve
          </Button>
          <Button size="sm" colorScheme="red" onClick={() => openBulkModal('reject')}>
            Bulk Reject
          </Button>
          <Button size="sm" variant="ghost" color="white" onClick={clearSelection}>
            Clear selection
          </Button>
        </Flex>
      )}

      <Modal isOpen={rejectModal.isOpen} onClose={rejectModal.onClose} size="lg" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Reject request</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text color="gray.600">
                Reject request from {getUserDisplayName(selectedReject?.userId)} for {selectedReject?.title}?
              </Text>
              <FormControl>
                <FormLabel fontSize="sm">Reason</FormLabel>
                <Select value={rejectCategory} onChange={(e) => setRejectCategory(e.target.value)} placeholder="Select reason">
                  {rejectionReasonOptions.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Additional notes</FormLabel>
                <Textarea
                  placeholder="Add context for the requester"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </FormControl>
              <Box>
                <Text fontSize="xs" color="gray.500" mb={2}>
                  Templates
                </Text>
                <HStack spacing={2} wrap="wrap">
                  {rejectionTemplates.map((template) => (
                    <Button
                      key={template}
                      size="xs"
                      variant="outline"
                      onClick={() => setRejectReason(template)}
                    >
                      {template}
                    </Button>
                  ))}
                </HStack>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={rejectModal.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleReject}
              isLoading={actionId === selectedReject?.id}
            >
              Reject Request
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={bulkModal.isOpen} onClose={bulkModal.onClose} size="lg" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{bulkAction === 'approve' ? 'Bulk approve requests' : 'Bulk reject requests'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text color="gray.600">
                {bulkAction === 'approve'
                  ? `Approve ${selectedRecords.length} requests totaling ${totalSelectedPoints.toLocaleString()} points?`
                  : `Reject ${selectedRecords.length} requests?`}
              </Text>
              {bulkAction === 'reject' && (
                <>
                  <FormControl>
                    <FormLabel fontSize="sm">Reason</FormLabel>
                    <Select
                      value={bulkRejectCategory}
                      onChange={(e) => setBulkRejectCategory(e.target.value)}
                      placeholder="Select reason"
                    >
                      {rejectionReasonOptions.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Additional notes</FormLabel>
                    <Textarea
                      placeholder="Add context for the requester"
                      value={bulkRejectReason}
                      onChange={(e) => setBulkRejectReason(e.target.value)}
                    />
                  </FormControl>
                </>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={bulkModal.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme={bulkAction === 'approve' ? 'green' : 'red'}
              onClick={handleBulkAction}
              isLoading={bulkLoading}
            >
              {bulkAction === 'approve' ? 'Approve Requests' : 'Reject Requests'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}

export { ApprovalCenterPage }
