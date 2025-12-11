import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  Icon,
  Spinner,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Bell, CheckCircle2, CircleAlert, Mail, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  listenToUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationAction,
} from '@/services/notificationService'
import { NotificationRecord, NotificationType } from '@/types/notifications'

const categoryLabels: Record<string, string> = {
  all: 'All',
  action_required: 'Action Required',
  important_updates: 'Important Updates',
  mentions: 'Mentions',
  system_alerts: 'System Alerts',
  other: 'Other',
}

const notificationCategoryMap: Record<NotificationType, string> = {
  challenge_request: 'action_required',
  challenge_invite: 'action_required',
  challenge_response: 'action_required',
  session_request: 'action_required',
  task_due: 'action_required',
  direct_message: 'mentions',
  mention: 'mentions',
  system_alert: 'system_alerts',
  maintenance: 'system_alerts',
  downtime: 'system_alerts',
  milestone: 'important_updates',
  achievement: 'important_updates',
  important_update: 'important_updates',
  product_update: 'important_updates',
  engagement_alert: 'system_alerts',
  intervention_reminder: 'system_alerts',
  escalation_notice: 'system_alerts',
  system_event: 'system_alerts',
  progress_report: 'important_updates',
  mentee_checkin: 'important_updates',
  unknown: 'other',
}

const typeLabels: Partial<Record<NotificationType, string>> = {
  challenge_request: 'Challenge request',
  session_request: 'Session request',
  direct_message: 'Direct message',
  mention: 'Mention',
  system_alert: 'System alert',
}

const statusBadge = (notification: NotificationRecord) => {
  if (notification.action_response === 'accepted') {
    return (
      <Badge colorScheme="green" variant="subtle">
        Accepted
      </Badge>
    )
  }
  if (notification.action_response === 'declined') {
    return (
      <Badge colorScheme="red" variant="subtle">
        Declined
      </Badge>
    )
  }
  if (notification.action_response === 'acknowledged') {
    return (
      <Badge colorScheme="blue" variant="subtle">
        Acknowledged
      </Badge>
    )
  }
  return null
}

const NotificationCard = ({
  notification,
  onMarkRead,
  onAction,
}: {
  notification: NotificationRecord
  onMarkRead: () => void
  onAction: (action: NotificationRecord['action_response']) => void
}) => {
  const category = notificationCategoryMap[notification.type] || 'other'
  const isRead = notification.is_read || notification.read
  return (
    <Box
      borderWidth="1px"
      borderColor={isRead ? 'gray.200' : 'purple.300'}
      bg={isRead ? 'white' : 'purple.50'}
      p={4}
      rounded="lg"
      _hover={{ shadow: 'sm' }}
    >
      <HStack align="start" spacing={4}>
        <Icon as={isRead ? CheckCircle2 : Bell} color={isRead ? 'gray.400' : 'purple.500'} boxSize={5} />
        <VStack align="start" spacing={2} flex={1}>
          <HStack spacing={3} align="center">
            <Badge colorScheme={isRead ? 'gray' : 'purple'}>{categoryLabels[category]}</Badge>
            {!isRead && <Badge colorScheme="purple">New</Badge>}
            {notification.type === 'direct_message' && <Icon as={MessageCircle} boxSize={4} />}
            {notification.type === 'system_alert' && <Icon as={CircleAlert} boxSize={4} />}
            {notification.type === 'important_update' && <Icon as={Mail} boxSize={4} />}
          </HStack>
          <Text fontWeight="bold" color="gray.900">
            {notification.title || typeLabels[notification.type] || 'Notification'}
          </Text>
          <Text color="gray.700">{notification.message}</Text>
          <HStack spacing={2}>{statusBadge(notification)}</HStack>
          <HStack spacing={2}>
            <Button size="sm" variant="ghost" colorScheme="purple" onClick={onMarkRead}>
              Mark as read
            </Button>
            {['challenge_request', 'session_request'].includes(notification.type) && (
              <ButtonGroup size="sm" variant="solid" colorScheme="purple">
                <Button onClick={() => onAction('accepted')}>Accept</Button>
                <Button onClick={() => onAction('declined')}>Decline</Button>
              </ButtonGroup>
            )}
            {notification.type === 'system_alert' && (
              <Button size="sm" onClick={() => onAction('acknowledged')} colorScheme="blue" variant="outline">
                Acknowledge
              </Button>
            )}
          </HStack>
        </VStack>
      </HStack>
    </Box>
  )
}

export const NotificationsList = () => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('all')

  useEffect(() => {
    if (!user) return

    setLoading(true)
    const unsubscribe = listenToUserNotifications(user.uid, (items) => {
      setNotifications(items)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const filtered = useMemo(() => {
    if (category === 'all') return notifications
    return notifications.filter((notification) => {
      const bucket = notificationCategoryMap[notification.type] || 'other'
      return bucket === category
    })
  }, [category, notifications])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
  }

  const handleAction = async (
    id: string,
    action: NotificationRecord['action_response'],
  ) => {
    await updateNotificationAction(id, action)
  }

  const handleMarkAll = async () => {
    if (!user) return
    await markAllNotificationsRead(user.uid)
  }

  return (
    <Stack spacing={4}>
      <Flex justify="space-between" align="center">
        <Text fontSize="lg" fontWeight="bold">
          Notifications
        </Text>
        <HStack>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={category === key ? 'solid' : 'outline'}
              colorScheme="purple"
              onClick={() => setCategory(key)}
            >
              {label}
            </Button>
          ))}
          <Button size="sm" colorScheme="purple" variant="outline" onClick={handleMarkAll}>
            Mark all as read
          </Button>
        </HStack>
      </Flex>

      {loading ? (
        <Flex justify="center" py={8}>
          <Spinner color="purple.500" />
        </Flex>
      ) : filtered.length === 0 ? (
        <Box p={6} textAlign="center" borderWidth="1px" rounded="md" borderColor="gray.100">
          <Text color="gray.600">No notifications yet.</Text>
        </Box>
      ) : (
        <Stack spacing={3}>
          {filtered.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={() => handleMarkRead(notification.id)}
              onAction={(action) => handleAction(notification.id, action)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

export default NotificationsList
