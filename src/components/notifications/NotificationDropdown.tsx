import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Tab,
  TabList,
  Tabs,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Bell, Sparkles } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { NotificationItem } from './NotificationItem'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationCategory } from '@/types/notifications'

const categoryLabels: Record<NotificationCategory | 'all', string> = {
  all: 'All',
  action_required: 'Action required',
  mentions: 'Mentions',
  important_updates: 'Updates',
  system_alerts: 'System',
  other: 'Other',
}

export const NotificationDropdown = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markNotificationAsRead,
    markAllAsRead,
    category,
    setCategory,
    updateNotificationAction,
  } = useNotifications({ limit: 50 })

  const hasUnread = unreadCount > 0

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort((a, b) => {
        const aDate = (a.created_at as { toDate?: () => Date } | string | undefined)
        const bDate = (b.created_at as { toDate?: () => Date } | string | undefined)

        const aValue =
          typeof aDate === 'object' && aDate && 'toDate' in aDate && typeof aDate.toDate === 'function'
            ? aDate.toDate().getTime()
            : new Date(String(aDate || '')).getTime()
        const bValue =
          typeof bDate === 'object' && bDate && 'toDate' in bDate && typeof bDate.toDate === 'function'
            ? bDate.toDate().getTime()
            : new Date(String(bDate || '')).getTime()

        return (bValue || 0) - (aValue || 0)
      }),
    [notifications],
  )

  useEffect(() => {
    if (!category) {
      setCategory('all')
    }
  }, [category, setCategory])

  return (
    <Popover placement="bottom-end" closeOnBlur>
      <PopoverTrigger>
        <Box position="relative">
          <IconButton
            aria-label="Notifications"
            icon={<Bell size={18} />}
            variant="ghost"
            bg={hasUnread ? 'purple.50' : 'brand.accent'}
            border="1px solid"
            borderColor={hasUnread ? 'purple.300' : 'brand.border'}
            _hover={{ bg: 'brand.primaryMuted' }}
          />
          {hasUnread && (
            <Badge position="absolute" top={0} right={0} colorScheme="purple" borderRadius="full">
              {unreadCount}
            </Badge>
          )}
        </Box>
      </PopoverTrigger>
      <PopoverContent w={{ base: '320px', md: '440px' }} shadow="xl">
        <PopoverArrow />
        <PopoverBody p={0}>
          <VStack align="stretch" spacing={0}>
            <HStack justify="space-between" px={4} py={3} borderBottomWidth="1px" borderColor="gray.100">
              <HStack spacing={2}>
                <Text fontWeight="bold">Notifications</Text>
                {hasUnread && <Badge colorScheme="purple">{unreadCount} new</Badge>}
              </HStack>
              <Button size="xs" variant="ghost" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            </HStack>

            <Tabs
              variant="soft-rounded"
              colorScheme="purple"
              px={3}
              pt={2}
              onChange={(index) => {
                const keys = Object.keys(categoryLabels) as (keyof typeof categoryLabels)[]
                setCategory(keys[index])
              }}
              index={Math.max(0, Object.keys(categoryLabels).indexOf(category || 'all'))}
            >
              <TabList overflowX="auto" pb={2}>
                {(Object.entries(categoryLabels) as [NotificationCategory | 'all', string][]).map(([value, label]) => (
                  <Tab key={value} whiteSpace="nowrap">
                    {label}
                  </Tab>
                ))}
              </TabList>
            </Tabs>

            <Divider />

            <Box maxH="440px" overflowY="auto" px={4} py={3}>
              {loading && (
                <HStack justify="center" py={8}>
                  <Spinner color="purple.500" />
                  <Text color="gray.600">Loading notifications...</Text>
                </HStack>
              )}

              {!loading && !sortedNotifications.length && (
                <VStack py={10} spacing={3} color="gray.600">
                  <Sparkles size={20} />
                  <Text fontWeight="bold">You're all caught up</Text>
                  <Text fontSize="sm" textAlign="center">
                    No notifications to show. We'll let you know when something new arrives.
                  </Text>
                </VStack>
              )}

              <VStack spacing={3} align="stretch">
                {sortedNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markNotificationAsRead(notification.id)}
                    onAction={(action) => {
                      if (!action) return
                      updateNotificationAction(notification.id, action)
                      markNotificationAsRead(notification.id)
                    }}
                  />
                ))}
              </VStack>
            </Box>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}
