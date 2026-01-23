import {
  Box,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  BellRing,
  CheckCheck,
  MessageCircle,
  MessageSquare,
  ShieldAlert,
  Star,
  Trophy,
  UserCheck,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { NotificationRecord } from '@/types/notifications'

interface NotificationItemProps {
  notification: NotificationRecord
  onMarkRead: () => void
  onAction?: (action: NotificationRecord['action_response']) => void
}

const notificationIcon = (type: NotificationRecord['type']) => {
  switch (type) {
    case 'challenge_request':
    case 'challenge_invite':
    case 'challenge_response':
      return Trophy
    case 'session_request':
    case 'mentee_checkin':
      return UserCheck
    case 'direct_message':
    case 'mention':
      return MessageCircle
    case 'important_update':
    case 'product_update':
    case 'progress_report':
    case 'engagement_alert':
    case 'intervention_reminder':
    case 'escalation_notice':
      return BellRing
    case 'system_alert':
    case 'maintenance':
    case 'downtime':
      return ShieldAlert
    case 'milestone':
    case 'achievement':
    case 'badge_awarded':
      return Star
    default:
      return MessageSquare
  }
}

const resolveTimestamp = (value?: unknown): string => {
  if (!value) return ''

  const date = typeof value === 'object' && value && 'toDate' in (value as Record<string, unknown>)
    ? (value as { toDate: () => Date }).toDate()
    : new Date(String(value))

  if (Number.isNaN(date.getTime())) return ''

  return formatDistanceToNow(date, { addSuffix: true })
}

export const NotificationItem = ({ notification, onMarkRead }: NotificationItemProps) => {
  const isRead = notification.is_read || notification.read
  const timestamp = resolveTimestamp(notification.created_at)

  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      bg="white"
      p={4}
      transition="all 0.15s ease"
      _hover={{
        shadow: 'sm',
        borderColor: 'gray.300',
      }}
    >
      <HStack align="start" spacing={4}>
        {/* Left: Contextual Icon */}
        <Box
          bg="gray.100"
          color="gray.500"
          borderRadius="full"
          p={2.5}
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon as={notificationIcon(notification.type)} boxSize={5} />
        </Box>

        {/* Center: Title + Description + Timestamp */}
        <Stack spacing={1} flex={1} minW={0}>
          <HStack spacing={2} align="center">
            {!isRead && (
              <Box
                w={2}
                h={2}
                borderRadius="full"
                bg="brand.primary"
                flexShrink={0}
              />
            )}
            <Text
              fontWeight={isRead ? 'medium' : 'semibold'}
              fontSize="sm"
              color="gray.900"
              noOfLines={1}
            >
              {notification.title || 'Notification'}
            </Text>
          </HStack>

          <Text color="gray.600" fontSize="sm" noOfLines={2}>
            {notification.message}
          </Text>

          {timestamp && (
            <Text color="gray.400" fontSize="xs" mt={1}>
              {timestamp}
            </Text>
          )}
        </Stack>

        {/* Right: Dismiss/Mark-as-read action */}
        <IconButton
          aria-label={isRead ? 'Dismiss' : 'Mark as read'}
          icon={isRead ? <X size={16} /> : <CheckCheck size={16} />}
          variant="ghost"
          size="sm"
          color="gray.400"
          _hover={{
            color: 'gray.600',
            bg: 'gray.100',
          }}
          onClick={onMarkRead}
          flexShrink={0}
        />
      </HStack>
    </Box>
  )
}
