import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Select,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
  Skeleton,
  SkeletonText,
  useToast,
} from '@chakra-ui/react'
import { formatDistanceToNow } from 'date-fns'
import {
  useAllUpgradeRequests,
  useUpdateRequestStatus,
} from '@/hooks/admin/useAdminUpgradeRequests'
import { UpgradeRequest, UpgradeRequestStatus } from '@/types/upgrade'
import { useAuth } from '@/hooks/useAuth'
import { useUserDirectory } from '@/hooks/useUserDirectory'
import { getDisplayName } from '@/utils/displayName'

const statusColors: Record<UpgradeRequestStatus, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  completed: 'blue',
}
const EMPTY_UPGRADE_REQUESTS: UpgradeRequest[] = []

type UpgradeRequestsPanelProps = {
  requests?: UpgradeRequest[]
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
  lastSuccessAt?: Date | null
}

export const UpgradeRequestsPanel: React.FC<UpgradeRequestsPanelProps> = ({
  requests: requestsProp,
  loading: loadingProp,
  error: errorProp,
  onRetry,
  lastSuccessAt: lastSuccessAtProp,
}) => {
  const { profile, effectiveRole } = useAuth()
  const [filter, setFilter] = useState<UpgradeRequestStatus | 'all'>('all')
  const { requests, loading, error, refetch } = useAllUpgradeRequests({ enabled: effectiveRole === 'super_admin' })
  const { mutate, loading: updating } = useUpdateRequestStatus()
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null)
  const toast = useToast()

  const hookRequests = requests ?? EMPTY_UPGRADE_REQUESTS
  const resolvedRequests = requestsProp ?? hookRequests
  const resolvedLoading = loadingProp ?? loading
  const resolvedError = errorProp ?? error
  const retryHandler = onRetry ?? refetch
  const resolvedLastSuccessAt = lastSuccessAtProp ?? lastSuccessAt

  const visibleRequests = useMemo(() => {
    if (filter === 'all') return resolvedRequests
    return resolvedRequests.filter((request) => request.status === filter)
  }, [filter, resolvedRequests])

  const { directory: userDirectory } = useUserDirectory(visibleRequests.map((request) => request.user_id))

  useEffect(() => {
    if (!resolvedLoading && !resolvedError) {
      setLastSuccessAt(new Date())
    }
  }, [resolvedError, resolvedLoading, resolvedRequests])

  const handleUpdate = async (request: UpgradeRequest, status: UpgradeRequestStatus) => {
    const updated = await mutate(request.id, status, undefined, profile?.id)
    if (updated) {
      toast({ title: `Request ${status}`, status: 'success', duration: 2000, isClosable: true })
      retryHandler()
    } else {
      toast({ title: 'Failed to update', status: 'error', duration: 2000, isClosable: true })
    }
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="white" boxShadow="sm">
      <Stack spacing={4}>
        <HStack justify="space-between">
          <Stack spacing={1}>
            <Heading size="md">Upgrade Requests</Heading>
            <Text fontSize="xs" color="gray.500">
              {resolvedLastSuccessAt
                ? `Last successful fetch ${formatDistanceToNow(resolvedLastSuccessAt)} ago.`
                : 'Last successful fetch: Not yet.'}
            </Text>
          </Stack>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as UpgradeRequestStatus | 'all')} maxW="200px">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </Select>
        </HStack>

        {resolvedError && (
          <Alert status="error" alignItems="flex-start">
            <AlertIcon />
            <Stack spacing={2} flex="1">
              <Text>{resolvedError.message}</Text>
              <Button size="sm" variant="outline" onClick={retryHandler} isLoading={resolvedLoading}>
                Retry loading
              </Button>
            </Stack>
          </Alert>
        )}

        {resolvedLoading ? (
          <Stack spacing={3}>
            <HStack spacing={3}>
              <Spinner />
              <Text>Loading requests...</Text>
            </HStack>
            <Stack spacing={2}>
              {[1, 2, 3].map((item) => (
                <Box key={item} borderRadius="md" border="1px solid" borderColor="border.control" p={3}>
                  <Skeleton height="14px" width="40%" />
                  <SkeletonText mt="2" noOfLines={2} spacing="2" />
                </Box>
              ))}
            </Stack>
          </Stack>
        ) : visibleRequests.length === 0 ? (
          <Text color="gray.600">No requests found</Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>User</Th>
                  <Th>Current Tier</Th>
                  <Th>Requested Tier</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {visibleRequests.map((request) => {
                  const directoryEntry = userDirectory.get(request.user_id)
                  const email = request.userDetails?.email ?? directoryEntry?.email ?? null
                  const name = getDisplayName(
                    {
                      ...request.userDetails,
                      email: email ?? undefined,
                    },
                    directoryEntry?.name ?? 'Unknown user',
                  )

                  return (
                    <Tr key={request.id}>
                    <Td>
                      <Stack spacing={0}>
                        <Text fontWeight="semibold" color="gray.800">
                          {name}
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          {email || 'Email unavailable'}
                        </Text>
                      </Stack>
                    </Td>
                    <Td>{request.current_tier ?? 'N/A'}</Td>
                    <Td>{request.requested_tier ?? 'N/A'}</Td>
                    <Td>{formatDistanceToNow(new Date(request.requested_at))} ago</Td>
                    <Td>
                      <Badge colorScheme={statusColors[request.status]} textTransform="capitalize">
                        {request.status}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Button
                          size="xs"
                          colorScheme="green"
                          variant="outline"
                          isLoading={updating}
                          onClick={() => handleUpdate(request, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="outline"
                          isLoading={updating}
                          onClick={() => handleUpdate(request, 'rejected')}
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
      </Stack>
    </Box>
  )
}
