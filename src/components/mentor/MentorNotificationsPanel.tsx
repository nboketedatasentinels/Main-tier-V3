import { Badge, Box, Button, Flex, HStack, Icon, Stack, Text, VStack } from '@chakra-ui/react'
import { Bell, CheckCircle2 } from 'lucide-react'
import { NotificationRecord } from '@/types/notifications'

type MentorNotificationType = 'session_request' | 'progress_report' | 'mentee_checkin' | 'system_alert'

const typeToColor: Record<MentorNotificationType, string> = {
  session_request: 'purple',
  progress_report: 'indigo',
  mentee_checkin: 'emerald',
  system_alert: 'rose',
}

interface MentorNotificationsPanelProps {
  notifications: NotificationRecord[]
  isLoading?: boolean
  error?: string | null
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  markingAllRead?: boolean
}

export const MentorNotificationsPanel = ({
  notifications,
  isLoading,
  error,
  onMarkRead,
  onMarkAllRead,
  markingAllRead,
}: MentorNotificationsPanelProps) => {
  return (
    <Box borderWidth="1px" rounded="md" p={4} bg="white">
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontWeight="bold">Mentor notifications</Text>
        <Button size="sm" onClick={onMarkAllRead} isLoading={markingAllRead}>
          Mark all as read
        </Button>
      </Flex>

      {isLoading && <Text color="gray.500">Loading notifications...</Text>}
      {error && (
        <Text color="red.500" mb={2}>
          {error}
        </Text>
      )}

      <Stack spacing={3}>
        {notifications.map((notification) => {
          const isRead = notification.is_read || notification.read
          const type = (notification.type as MentorNotificationType) || 'session_request'
          return (
            <Flex
              key={notification.id}
              p={3}
              borderWidth="1px"
              rounded="md"
              borderColor={isRead ? 'gray.200' : 'purple.400'}
              bg={isRead ? 'white' : 'purple.50'}
              gap={3}
              align="start"
            >
              <Icon
                as={isRead ? CheckCircle2 : Bell}
                color={isRead ? 'gray.400' : 'purple.600'}
                boxSize={5}
              />
              <VStack align="start" spacing={1} flex={1}>
                <HStack>
                  <Badge colorScheme={typeToColor[type] || 'purple'} textTransform="capitalize">
                    {type.replace('_', ' ')}
                  </Badge>
                  {!isRead && <Badge colorScheme="purple">New</Badge>}
                </HStack>
                <Text fontWeight="bold">{notification.title || 'Notification'}</Text>
                <Text color="gray.600">{notification.message}</Text>
                {notification.related_id && (
                  <Text color="purple.600" fontSize="sm">
                    View related content: {notification.related_id}
                  </Text>
                )}
                <HStack>
                  <Button size="sm" variant="outline" onClick={() => onMarkRead(notification.id)}>
                    Mark read
                  </Button>
                  {notification.metadata?.actionUrl && (
                    <Button size="sm" as="a" href={String(notification.metadata.actionUrl)} target="_blank">
                      Open link
                    </Button>
                  )}
                </HStack>
              </VStack>
            </Flex>
          )
        })}
        {!notifications.length && <Text color="gray.600">You're all caught up</Text>}
      </Stack>
    </Box>
  )
}

export default MentorNotificationsPanel
