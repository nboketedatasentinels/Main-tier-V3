import {
  Badge,
  Box,
  Button,
  HStack,
  Icon,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import {
  BellRing,
  AlertCircle,
  Clock3,
  MessageCircle,
  MessageSquare,
  ShieldAlert,
  Trophy,
  UserCheck,
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
      return Trophy
    case 'session_request':
      return UserCheck
    case 'direct_message':
    case 'mention':
      return MessageCircle
    case 'important_update':
    case 'product_update':
      return BellRing
    case 'system_alert':
    case 'maintenance':
    case 'downtime':
      return ShieldAlert
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

export const NotificationItem = ({ notification, onMarkRead, onAction }: NotificationItemProps) => {
  const bg = useColorModeValue(notification.is_read || notification.read ? 'white' : 'purple.50', 'gray.800')
  const border = useColorModeValue('gray.200', 'gray.700')
  const actionTaken = Boolean(notification.action_response)

  const timestamp = resolveTimestamp(notification.created_at)
  const categoryLabel = notification.metadata?.category as string | undefined
  const groupCount = notification.metadata?.groupCount as number | undefined

  return (
    <Box
      borderWidth="1px"
      borderColor={border}
      borderRadius="lg"
      p={3}
      bg={bg}
      _hover={{ borderColor: 'purple.300' }}
    >
      <HStack align="start" spacing={3}>
        <Box
          bg="purple.100"
          color="purple.700"
          borderRadius="full"
          p={2}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon as={notificationIcon(notification.type)} boxSize={5} />
        </Box>
        <Stack spacing={1} flex={1}>
          <HStack justify="space-between" align="start">
            <Text fontWeight="semibold" fontSize="sm">
              {notification.title || 'Notification'}
            </Text>
            {timestamp && (
              <HStack spacing={1} color="gray.500" fontSize="xs">
                <Clock3 size={14} />
                <Text>{timestamp}</Text>
              </HStack>
            )}
          </HStack>
          <Text color="gray.700" fontSize="sm">
            {notification.message}
          </Text>
          <HStack spacing={2} flexWrap="wrap">
            {notification.severity && (
              <Badge colorScheme={notification.severity === 'critical' ? 'red' : 'purple'}>
                {notification.severity}
              </Badge>
            )}
            {notification.type && <Badge colorScheme="gray">{notification.type}</Badge>}
            {notification.related_id && <Badge colorScheme="purple">#{notification.related_id}</Badge>}
            {categoryLabel && <Badge colorScheme="teal">{categoryLabel}</Badge>}
            {groupCount && <Badge colorScheme="yellow">{groupCount} similar</Badge>}
          </HStack>
          <HStack spacing={2} pt={1}>
            {!notification.is_read && !notification.read && (
              <Button size="xs" variant="solid" colorScheme="purple" onClick={onMarkRead}>
                Mark as read
              </Button>
            )}
            {['challenge_request', 'session_request'].includes(notification.type) && (
              <>
                <Button size="xs" variant="outline" onClick={() => onAction?.('accepted')} isDisabled={actionTaken}>
                  Accept
                </Button>
                <Button size="xs" variant="ghost" colorScheme="red" onClick={() => onAction?.('declined')} isDisabled={actionTaken}>
                  Decline
                </Button>
              </>
            )}
            {notification.type === 'system_alert' && (
              <Button size="xs" variant="outline" leftIcon={<AlertCircle size={14} />} onClick={() => onAction?.('acknowledged')}>
                Acknowledge
              </Button>
            )}
          </HStack>
        </Stack>
      </HStack>
    </Box>
  )
}
