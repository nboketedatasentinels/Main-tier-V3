import {
  Badge,
  Box,
  HStack,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Bell, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { NotificationItem } from './NotificationItem'
import { useNotifications } from '@/hooks/useNotifications'

export const NotificationDropdown = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markNotificationAsRead,
    markAllAsRead,
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

  return (
    <Popover placement="bottom-end" closeOnBlur>
      <PopoverTrigger>
        <Box position="relative">
          <IconButton
            aria-label="Notifications"
            icon={<Bell size={20} color="black" />}
            variant="ghost"
            _hover={{ bg: 'gray.100' }}
          />
          {hasUnread && (
            <Box
              position="absolute"
              top={-1}
              right={-1}
              bg="red.500"
              color="white"
              borderRadius="full"
              fontSize="10px"
              fontWeight="bold"
              w="18px"
              h="18px"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {unreadCount}
            </Box>
          )}
        </Box>
      </PopoverTrigger>
      <PopoverContent w={{ base: '320px', md: '400px' }} shadow="lg" borderColor="border.control">
        <PopoverArrow />
        <PopoverBody p={0}>
          <VStack align="stretch" spacing={0}>
            {/* Simplified Header */}
            <HStack justify="space-between" px={4} py={3} borderBottomWidth="1px" borderColor="border.control">
              <HStack spacing={2}>
                <Text fontWeight="semibold" color="gray.900">Notifications</Text>
                {hasUnread && (
                  <Badge
                    bg="brand.primary"
                    color="white"
                    borderRadius="full"
                    fontSize="xs"
                    px={2}
                  >
                    {unreadCount}
                  </Badge>
                )}
              </HStack>
              <Text
                as="button"
                fontSize="sm"
                color="gray.500"
                cursor="pointer"
                _hover={{ color: 'brand.primary', textDecoration: 'underline' }}
                onClick={markAllAsRead}
              >
                Mark all as read
              </Text>
            </HStack>

            {/* Notification List */}
            <Box maxH="400px" overflowY="auto" px={3} py={2}>
              {loading && (
                <HStack justify="center" py={8}>
                  <Spinner color="text.muted" size="sm" />
                  <Text color="gray.500" fontSize="sm">Loading...</Text>
                </HStack>
              )}

              {!loading && !sortedNotifications.length && (
                <VStack py={8} spacing={2} color="gray.500">
                  <Sparkles size={18} />
                  <Text fontWeight="medium" fontSize="sm">You're all caught up</Text>
                  <Text fontSize="xs" textAlign="center">
                    No notifications to show.
                  </Text>
                </VStack>
              )}

              <VStack spacing={2} align="stretch">
                {sortedNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markNotificationAsRead(notification.id)}
                    onAction={(action) => {
                      if (!action) return
                      updateNotificationAction(notification, action)
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
