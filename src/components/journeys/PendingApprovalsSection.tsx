import React from 'react'
import {
  Box,
  Card,
  CardBody,
  Stack,
  HStack,
  Text,
  Badge,
  Icon,
  Skeleton,
  Link,
  Divider,
  Alert,
  AlertIcon
} from '@chakra-ui/react'
import { Clock, ExternalLink, CheckCircle } from 'lucide-react'
import { PointsVerificationRequest } from '@/services/pointsVerificationService'
import { formatDistanceToNow } from 'date-fns'

export interface PendingApprovalsSectionProps {
  pendingRequests: PointsVerificationRequest[]
  currentWeek?: number
  loading: boolean
  title?: string
  emptyMessage?: string
}

/**
 * Section displaying activities awaiting partner approval.
 *
 * Shows:
 * - Activity title and points
 * - Submission timestamp
 * - Proof link (if provided)
 * - Week number
 *
 * @param pendingRequests - Array of pending verification requests
 * @param currentWeek - Current week number (optional, for filtering)
 * @param loading - Loading state
 * @param title - Custom section title
 * @param emptyMessage - Custom message when no pending approvals
 */
export const PendingApprovalsSection: React.FC<PendingApprovalsSectionProps> = ({
  pendingRequests,
  currentWeek,
  loading,
  title = 'Pending Partner Approvals',
  emptyMessage = 'No pending approvals - you\'re all set!'
}) => {
  // Filter by current week if specified
  const filteredRequests = currentWeek
    ? pendingRequests.filter(req => req.week === currentWeek)
    : pendingRequests

  const formatTimestamp = (timestamp: unknown) => {
    if (!timestamp) return 'Recently'

    try {
      const date =
        typeof timestamp === 'object' &&
        timestamp !== null &&
        'toDate' in timestamp &&
        typeof timestamp.toDate === 'function'
          ? timestamp.toDate()
          : new Date(timestamp as string | number | Date)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch (err) {
      return 'Recently'
    }
  }

  if (loading) {
    return (
      <Box borderWidth="1px" borderColor="border.card" p={4} borderRadius="lg" bg="surface.default">
        <Stack spacing={3}>
          <Skeleton height="24px" width="60%" />
          <Skeleton height="80px" />
          <Skeleton height="80px" />
        </Stack>
      </Box>
    )
  }

  return (
    <Box borderWidth="1px" borderColor="border.card" p={4} borderRadius="lg" bg="surface.default">
      <Stack spacing={3}>
        {/* Header */}
        <HStack justify="space-between">
          <HStack spacing={2}>
            <Icon as={Clock} color="brand.primary" boxSize={5} />
            <Text fontWeight="semibold" fontSize="md" color="text.primary">
              {title}
            </Text>
          </HStack>
          {filteredRequests.length > 0 && (
            <Badge colorScheme="yellow" variant="subtle" px={2} py={1} borderRadius="full">
              {filteredRequests.length}
            </Badge>
          )}
        </HStack>

        <Divider />

        {/* Empty State */}
        {filteredRequests.length === 0 ? (
          <Alert status="success" borderRadius="md" bg="green.50" variant="subtle">
            <AlertIcon as={CheckCircle} color="green.500" />
            <Text fontSize="sm" color="text.secondary">
              {emptyMessage}
            </Text>
          </Alert>
        ) : (
          /* Pending Approvals List */
          <Stack spacing={3}>
            {filteredRequests.map((request) => (
              <Card
                key={request.id}
                variant="outline"
                borderColor="yellow.200"
                bg="yellow.50"
                size="sm"
              >
                <CardBody p={3}>
                  <Stack spacing={2}>
                    <HStack justify="space-between" align="flex-start">
                      <Stack spacing={0} flex={1}>
                        <Text fontWeight="semibold" fontSize="sm" color="text.primary">
                          {request.activity_title || 'Activity Submission'}
                        </Text>
                        <HStack spacing={2} fontSize="xs" color="text.secondary">
                          <Text>Week {request.week}</Text>
                          <Text>•</Text>
                          <Text>{request.points ?? 0} pts</Text>
                        </HStack>
                      </Stack>
                      <Badge colorScheme="yellow" variant="solid" fontSize="xs">
                        Pending
                      </Badge>
                    </HStack>

                    <HStack spacing={2} fontSize="xs" color="text.secondary">
                      <Icon as={Clock} boxSize={3} />
                      <Text>Submitted {formatTimestamp(request.created_at)}</Text>
                    </HStack>

                    {request.proof_url && (
                      <Link
                        href={request.proof_url}
                        isExternal
                        color="purple.600"
                        fontSize="sm"
                        display="flex"
                        alignItems="center"
                        gap={1}
                        _hover={{ textDecoration: 'underline' }}
                      >
                        <Icon as={ExternalLink} boxSize={3} />
                        View proof
                      </Link>
                    )}

                    {request.notes && (
                      <Box
                        borderWidth="1px"
                        borderColor="yellow.200"
                        bg="white"
                        p={2}
                        borderRadius="md"
                      >
                        <Text fontSize="xs" color="text.secondary" fontStyle="italic">
                          Note: {request.notes}
                        </Text>
                      </Box>
                    )}
                  </Stack>
                </CardBody>
              </Card>
            ))}
          </Stack>
        )}

        {/* Helper Text */}
        {filteredRequests.length > 0 && (
          <Alert status="info" borderRadius="md" fontSize="xs" variant="subtle">
            <AlertIcon />
            <Text>
              Activities awaiting approval won't count toward your progress until reviewed by your partner.
              They typically respond within 24-48 hours.
            </Text>
          </Alert>
        )}
      </Stack>
    </Box>
  )
}
