import { Badge, Box, Button, Flex, Heading, HStack, Stack, Text, VStack } from '@chakra-ui/react'
import { Bell, CheckCircle2 } from 'lucide-react'
import { AdminNotification } from '@/types/notifications'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'

interface AdminNotificationsListProps {
  notifications?: AdminNotification[]
}

export const AdminNotificationsList = ({ notifications }: AdminNotificationsListProps) => {
  const hookState = useAdminNotifications({ role: 'super_admin', enabled: !notifications })
  const data = notifications || hookState.notifications

  const severityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'red'
      case 'warning':
        return 'orange'
      case 'success':
        return 'green'
      case 'info':
        return 'blue'
      default:
        return 'gray'
    }
  }

  return (
    <Box borderWidth="1px" rounded="md" p={4} bg="white">
      <Flex justify="space-between" align="center" mb={3}>
        <Heading size="md">Admin notifications</Heading>
        <HStack>
          <Badge colorScheme="purple">{data.filter((item) => !item.is_read).length} unread</Badge>
          <Button size="sm" onClick={hookState.markAllAsRead} variant="outline">
            Mark all read
          </Button>
        </HStack>
      </Flex>

      <Stack spacing={3}>
        {data.map((notification) => {
          const isRead = notification.is_read
          return (
            <Flex
              key={notification.id}
              p={3}
              borderWidth="1px"
              rounded="md"
              bg={isRead ? 'gray.50' : 'purple.50'}
              align="start"
              gap={3}
            >
              <Badge colorScheme={severityColor(notification.severity)}>{notification.severity || 'info'}</Badge>
              <VStack align="start" spacing={1} flex={1}>
                <HStack>
                  <Text fontWeight="bold">{notification.title || 'Task'}</Text>
                  {!isRead && <Badge colorScheme="purple">New</Badge>}
                </HStack>
                <Text color="gray.700">{notification.message}</Text>
                <HStack spacing={2}>
                  <Badge colorScheme="gray">{notification.type}</Badge>
                  {notification.related_id && <Badge colorScheme="purple">#{notification.related_id}</Badge>}
                </HStack>
              </VStack>
              <Button
                size="sm"
                onClick={() => hookState.markNotificationAsRead(notification.id)}
                leftIcon={isRead ? <CheckCircle2 size={16} /> : <Bell size={16} />}
                variant={isRead ? 'outline' : 'solid'}
                colorScheme="purple"
              >
                {isRead ? 'Read' : 'Mark read'}
              </Button>
            </Flex>
          )
        })}
        {!data.length && <Text color="gray.600">No admin notifications</Text>}
      </Stack>
    </Box>
  )
}

export default AdminNotificationsList
