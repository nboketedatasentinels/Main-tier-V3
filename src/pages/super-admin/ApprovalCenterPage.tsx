import React, { useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
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
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { formatDistanceToNow } from 'date-fns'
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

const statusColors: Record<ApprovalStatus, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  completed: 'blue',
}

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

const formatRelativeDate = (value?: unknown) => {
  const dateValue = toDate(value)
  if (!dateValue) return 'Recently submitted'
  return formatDistanceToNow(dateValue, { addSuffix: true })
}

export const ApprovalCenterPage: React.FC = () => {
  const toast = useToast()
  const { profile } = useAuth()
  const { requests: upgradeRequests, loading: upgradeLoading, error: upgradeError, refetch } = useAllUpgradeRequests()
  const {
    requests: verificationRequests,
    loading: verificationLoading,
    error: verificationError,
  } = useAdminPointsVerificationRequests('all', 40)
  const { mutate, loading: updatingUpgrade } = useUpdateRequestStatus()
  const [workflowFilter, setWorkflowFilter] = useState<ApprovalWorkflowType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [selectedReject, setSelectedReject] = useState<ApprovalRecord | null>(null)
  const rejectModal = useDisclosure()

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

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()
    return approvalRecords.filter((record) => {
      if (workflowFilter !== 'all' && record.type !== workflowFilter) return false
      if (statusFilter !== 'all' && record.status !== statusFilter) return false
      if (query && !record.searchText.includes(query)) return false
      return true
    })
  }, [approvalRecords, search, statusFilter, workflowFilter])

  const pendingCount = useMemo(
    () => approvalRecords.filter((record) => record.status === 'pending').length,
    [approvalRecords],
  )

  const handleApprove = async (record: ApprovalRecord) => {
    setActionId(record.id)
    try {
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
      toast({ title: 'Approval completed', status: 'success', duration: 3000, isClosable: true })
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
    rejectModal.onOpen()
  }

  const handleReject = async () => {
    if (!selectedReject) return
    setActionId(selectedReject.id)
    try {
      if (selectedReject.type === 'points_verification') {
        await rejectPointsVerificationRequest({
          request: selectedReject.source as PointsVerificationRequest,
          approver: {
            id: profile?.id ?? null,
            name: profile?.fullName ?? null,
          },
          reason: rejectReason || undefined,
        })
      } else {
        await mutate(selectedReject.id, 'rejected', rejectReason || undefined, profile?.id)
        refetch()
      }
      toast({ title: 'Rejection saved', status: 'info', duration: 3000, isClosable: true })
      rejectModal.onClose()
      setSelectedReject(null)
      setRejectReason('')
    } catch (error) {
      console.error(error)
      toast({ title: 'Rejection failed', status: 'error', duration: 3000, isClosable: true })
    } finally {
      setActionId(null)
    }
  }

  const loading = upgradeLoading || verificationLoading
  const error = upgradeError || verificationError

  return (
    <Stack spacing={6}>
      <Stack spacing={1}>
        <Heading size="lg">Approval Center</Heading>
        <Text color="gray.600">
          Manage approvals across upgrade requests and points verification workflows.
        </Text>
      </Stack>

      <Flex direction={{ base: 'column', lg: 'row' }} gap={4} align={{ base: 'stretch', lg: 'center' }} justify="space-between">
        <HStack spacing={3} flexWrap="wrap">
          <FormControl maxW="220px">
            <FormLabel fontSize="sm" mb={1}>
              Workflow
            </FormLabel>
            <Select value={workflowFilter} onChange={(e) => setWorkflowFilter(e.target.value as ApprovalWorkflowType | 'all')}>
              <option value="all">All workflows</option>
              <option value="points_verification">Points verification</option>
              <option value="upgrade_request">Upgrade requests</option>
            </Select>
          </FormControl>
          <FormControl maxW="200px">
            <FormLabel fontSize="sm" mb={1}>
              Status
            </FormLabel>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | 'all')}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
            </Select>
          </FormControl>
          <FormControl minW={{ base: 'full', md: '280px' }}>
            <FormLabel fontSize="sm" mb={1}>
              Search
            </FormLabel>
            <Input
              placeholder="Search by user, activity, or tier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FormControl>
        </HStack>

        <Stack spacing={0} align={{ base: 'flex-start', lg: 'flex-end' }}>
          <Text fontSize="sm" color="gray.500">
            Pending approvals
          </Text>
          <Heading size="md">{pendingCount}</Heading>
        </Stack>
      </Flex>

      {error && (
        <Alert status="error">
          <AlertIcon />
          <Text>{error.message}</Text>
        </Alert>
      )}

      {loading ? (
        <HStack spacing={3}>
          <Spinner />
          <Text>Loading approvals...</Text>
        </HStack>
      ) : filteredRecords.length === 0 ? (
        <Box borderWidth="1px" borderRadius="lg" bg="white" p={6}>
          <Text color="gray.600">No approval items match the selected filters.</Text>
        </Box>
      ) : (
        <Box borderWidth="1px" borderRadius="lg" bg="white" p={4} overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Workflow</Th>
                <Th>User</Th>
                <Th>Details</Th>
                <Th>Points</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredRecords.map((record) => {
                const meta = getApprovalTypeMeta(record.type)
                const isPending = record.status === 'pending'
                return (
                  <Tr key={`${record.type}-${record.id}`}>
                    <Td>
                      <Stack spacing={1}>
                        <Badge colorScheme={meta.badgeColor}>{meta.label}</Badge>
                        <Text fontSize="xs" color="gray.500">
                          {meta.description}
                        </Text>
                      </Stack>
                    </Td>
                    <Td>{record.userId}</Td>
                    <Td>
                      <Stack spacing={1}>
                        <Text fontWeight="semibold">{record.title}</Text>
                        {record.summary && (
                          <Text fontSize="xs" color="gray.600" noOfLines={2}>
                            {record.summary}
                          </Text>
                        )}
                      </Stack>
                    </Td>
                    <Td>{record.points ?? '—'}</Td>
                    <Td>{formatRelativeDate(record.createdAt ?? undefined)}</Td>
                    <Td>
                      <Badge colorScheme={statusColors[record.status]} textTransform="capitalize">
                        {record.status}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Button
                          size="xs"
                          colorScheme="green"
                          variant="outline"
                          isLoading={actionId === record.id && isPending}
                          isDisabled={!isPending || updatingUpgrade}
                          onClick={() => handleApprove(record)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="outline"
                          isLoading={actionId === record.id && isPending}
                          isDisabled={!isPending || updatingUpgrade}
                          onClick={() => openRejectModal(record)}
                        >
                          Reject
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </Box>
      )}

      <Modal isOpen={rejectModal.isOpen} onClose={rejectModal.onClose} size="lg" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Reject approval</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Text color="gray.600">
                Add context for the rejection so the requester knows what to address next.
              </Text>
              <Textarea
                placeholder="Share the reason or next steps"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
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
              Submit rejection
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}
