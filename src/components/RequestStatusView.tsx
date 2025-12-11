import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Icon,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { Clock, FileCheck2, FileX, Sparkles } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { UpgradeRequest } from '@/types/upgrade'

const statusConfig: Record<UpgradeRequest['status'], { color: string; label: string; icon: typeof Clock }> = {
  pending: { color: 'yellow', label: 'Pending', icon: Clock },
  approved: { color: 'green', label: 'Approved', icon: FileCheck2 },
  rejected: { color: 'red', label: 'Rejected', icon: FileX },
  completed: { color: 'blue', label: 'Completed', icon: Sparkles },
}

interface RequestStatusViewProps {
  request: UpgradeRequest
  onCancel?: () => void
}

export const RequestStatusView: React.FC<RequestStatusViewProps> = ({ request, onCancel }) => {
  const borderColor = useColorModeValue('gray.200', 'gray.700')
  const { color, label, icon } = statusConfig[request.status]

  return (
    <Box
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      p={4}
      bg={useColorModeValue('white', 'gray.900')}
    >
      <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" spacing={4} align="flex-start">
        <Stack spacing={2} flex={1}>
          <Flex align="center" gap={3}>
            <Badge colorScheme={color} px={3} py={1} borderRadius="md">
              {label}
            </Badge>
            <Text color="gray.600">Submitted {formatDistanceToNow(new Date(request.requested_at))} ago</Text>
          </Flex>
          <Heading size="md">Requested Tier: {request.requested_tier ?? 'Not specified'}</Heading>
          {request.message && (
            <Text color="gray.700">Reason: {request.message}</Text>
          )}
          <Text fontSize="sm" color="gray.600">
            Estimated response time: under 24 hours
          </Text>
        </Stack>
        <Flex direction="column" align="flex-end" gap={3}>
          <Icon as={icon} boxSize={8} color={`${color}.500`} />
          {request.status === 'pending' && (
            <Button variant="outline" size="sm" onClick={onCancel} aria-label="Cancel upgrade request">
              Cancel Request
            </Button>
          )}
        </Flex>
      </Stack>
    </Box>
  )
}
