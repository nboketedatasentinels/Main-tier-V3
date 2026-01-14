import React, { useMemo, useState } from 'react'
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
  useToast,
} from '@chakra-ui/react'
import { formatDistanceToNow } from 'date-fns'
import {
  useAllUpgradeRequests,
  useUpdateRequestStatus,
} from '@/hooks/admin/useAdminUpgradeRequests'
import { UpgradeRequest, UpgradeRequestStatus } from '@/types/upgrade'
import { useAuth } from '@/hooks/useAuth'

const statusColors: Record<UpgradeRequestStatus, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  completed: 'blue',
}

export const UpgradeRequestsPanel: React.FC = () => {
  const { profile } = useAuth()
  const [filter, setFilter] = useState<UpgradeRequestStatus | 'all'>('all')
  const { requests, loading, error, refetch } = useAllUpgradeRequests()
  const { mutate, loading: updating } = useUpdateRequestStatus()
  const toast = useToast()

  const visibleRequests = useMemo(() => {
    if (filter === 'all') return requests
    return requests.filter((request) => request.status === filter)
  }, [filter, requests])

  const handleUpdate = async (request: UpgradeRequest, status: UpgradeRequestStatus) => {
    const updated = await mutate(request.id, status, undefined, profile?.id)
    if (updated) {
      toast({ title: `Request ${status}`, status: 'success', duration: 2000, isClosable: true })
      refetch()
    } else {
      toast({ title: 'Failed to update', status: 'error', duration: 2000, isClosable: true })
    }
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="white" boxShadow="sm">
      <Stack spacing={4}>
        <HStack justify="space-between">
          <Heading size="md">Upgrade Requests</Heading>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as UpgradeRequestStatus | 'all')} maxW="200px">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </Select>
        </HStack>

        {error && (
          <Alert status="error" alignItems="flex-start">
            <AlertIcon />
            <Stack spacing={2} flex="1">
              <Text>{error.message}</Text>
              <Button size="sm" variant="outline" onClick={refetch} isLoading={loading}>
                Retry loading
              </Button>
            </Stack>
          </Alert>
        )}

        {loading ? (
          <HStack spacing={3}>
            <Spinner />
            <Text>Loading requests...</Text>
          </HStack>
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
                {visibleRequests.map((request) => (
                  <Tr key={request.id}>
                    <Td>{request.user_id}</Td>
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
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Stack>
    </Box>
  )
}
