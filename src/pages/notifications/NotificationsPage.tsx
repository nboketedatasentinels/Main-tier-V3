import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Center,
  HStack,
  Heading,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { ArrowLeft, CheckCheck, ExternalLink, Inbox, Search, Sparkles } from 'lucide-react'
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationRecord } from '@/types/notifications'
import {
  isNotificationRead,
  notificationIcon,
  resolveExactTimestamp,
  resolveNotificationDestination,
  resolveSenderName,
  resolveTimestamp,
  sortNotificationsByDate,
} from '@/components/notifications/notificationMeta'

type NotificationFilter = 'all' | 'unread'

interface NotificationsPageProps {
  /** Shown under the heading; role shells pass a role-appropriate line. */
  subtitle?: string
}

/**
 * Full-page notification inbox. The bell dropdown is a preview - opening a
 * notification lands here, where the message is shown in full rather than
 * truncated to two lines. `?id=<notificationId>` focuses one message and marks
 * it read.
 */
export const NotificationsPage = ({
  subtitle = 'Messages and updates sent to you.',
}: NotificationsPageProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusedId = searchParams.get('id')

  const {
    notifications,
    loading,
    error,
    markNotificationAsRead,
    markAllAsRead,
    updateNotificationAction,
  } = useNotifications({ limit: 200 })

  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [search, setSearch] = useState('')

  // One auto-read and one auto-scroll per deep link - the notifications list
  // re-renders on every realtime update and must not re-trigger either.
  const autoReadIdRef = useRef<string | null>(null)
  const scrolledIdRef = useRef<string | null>(null)
  const focusedCardRef = useRef<HTMLDivElement | null>(null)

  const sorted = useMemo(() => sortNotificationsByDate(notifications), [notifications])

  const unreadCount = useMemo(
    () => sorted.filter((notification) => !isNotificationRead(notification)).length,
    [sorted],
  )

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()

    return sorted.filter((notification) => {
      if (filter === 'unread' && isNotificationRead(notification)) {
        // Keep the deep-linked message visible even after it is marked read.
        if (notification.id !== focusedId) return false
      }

      if (!term) return true

      return (
        (notification.title || '').toLowerCase().includes(term) ||
        notification.message.toLowerCase().includes(term) ||
        (resolveSenderName(notification) || '').toLowerCase().includes(term)
      )
    })
  }, [filter, focusedId, search, sorted])

  useEffect(() => {
    if (!focusedId) return

    const target = sorted.find((notification) => notification.id === focusedId)
    if (!target) return

    if (!isNotificationRead(target) && autoReadIdRef.current !== focusedId) {
      autoReadIdRef.current = focusedId
      void markNotificationAsRead(focusedId)
    }

    if (scrolledIdRef.current !== focusedId && focusedCardRef.current) {
      scrolledIdRef.current = focusedId
      focusedCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusedId, markNotificationAsRead, sorted])

  const clearFocus = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const handleOpenDestination = useCallback(
    (notification: NotificationRecord) => {
      const destination = resolveNotificationDestination(notification)
      if (!destination) return

      if (!isNotificationRead(notification)) void markNotificationAsRead(notification.id)

      if (destination.kind === 'external') {
        window.open(destination.url, '_blank', 'noopener,noreferrer')
        return
      }

      navigate(destination.url)
    },
    [markNotificationAsRead, navigate],
  )

  return (
    <Stack spacing={6} maxW="900px" w="full" mx="auto" py={{ base: 4, md: 6 }} px={{ base: 4, md: 0 }}>
      <Stack spacing={4}>
        <Button
          alignSelf="flex-start"
          variant="ghost"
          size="sm"
          leftIcon={<Icon as={ArrowLeft} boxSize={4} />}
          onClick={() => navigate(-1)}
          color="text.muted"
          _hover={{ color: 'brand.primary', bg: 'gray.100' }}
        >
          Back
        </Button>

        <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={3}>
          <Box>
            <HStack spacing={3}>
              <Heading size="lg">Notifications</Heading>
              {unreadCount > 0 && (
                <Badge bg="brand.primary" color="white" borderRadius="full" px={2.5} py={1}>
                  {unreadCount} unread
                </Badge>
              )}
            </HStack>
            <Text color="text.secondary" mt={1}>
              {subtitle}
            </Text>
          </Box>

          <Button
            size="sm"
            variant="outline"
            leftIcon={<Icon as={CheckCheck} boxSize={4} />}
            onClick={markAllAsRead}
            isDisabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </HStack>

        <HStack spacing={3} flexWrap="wrap">
          <ButtonGroup size="sm" isAttached variant="outline">
            <Button
              onClick={() => setFilter('all')}
              bg={filter === 'all' ? 'brand.primary' : 'transparent'}
              color={filter === 'all' ? 'white' : 'text.secondary'}
              _hover={{ bg: filter === 'all' ? 'brand.primary' : 'gray.100' }}
            >
              All ({sorted.length})
            </Button>
            <Button
              onClick={() => setFilter('unread')}
              bg={filter === 'unread' ? 'brand.primary' : 'transparent'}
              color={filter === 'unread' ? 'white' : 'text.secondary'}
              _hover={{ bg: filter === 'unread' ? 'brand.primary' : 'gray.100' }}
            >
              Unread ({unreadCount})
            </Button>
          </ButtonGroup>

          <InputGroup size="sm" maxW="280px">
            <InputLeftElement pointerEvents="none">
              <Icon as={Search} boxSize={4} color="text.muted" />
            </InputLeftElement>
            <Input
              id="notifications-search"
              name="notifications-search"
              placeholder="Search messages"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              borderRadius="md"
            />
          </InputGroup>
        </HStack>
      </Stack>

      {loading && (
        <Center py={16}>
          <HStack spacing={3}>
            <Spinner color="brand.primary" />
            <Text color="text.muted">Loading notifications...</Text>
          </HStack>
        </Center>
      )}

      {!loading && error && (
        <Box
          borderWidth="1px"
          borderColor="red.200"
          bg="red.50"
          borderRadius="lg"
          p={5}
          textAlign="center"
        >
          <Text color="red.600" fontWeight="medium">
            {error}
          </Text>
        </Box>
      )}

      {!loading && !error && !visible.length && (
        <Center py={16}>
          <Stack spacing={3} align="center" color="text.muted" maxW="360px" textAlign="center">
            <Icon as={search || filter === 'unread' ? Inbox : Sparkles} boxSize={7} />
            <Text fontWeight="semibold" color="gray.700">
              {search
                ? 'No messages match your search'
                : filter === 'unread'
                  ? 'No unread messages'
                  : "You're all caught up"}
            </Text>
            <Text fontSize="sm">
              {search
                ? 'Try a different word, or clear the search to see everything.'
                : 'New messages and updates will appear here.'}
            </Text>
          </Stack>
        </Center>
      )}

      <Stack spacing={3}>
        {visible.map((notification) => {
          const isFocused = notification.id === focusedId
          const isRead = isNotificationRead(notification)
          const destination = resolveNotificationDestination(notification)
          const sender = resolveSenderName(notification)
          const relative = resolveTimestamp(notification.created_at)
          const exact = resolveExactTimestamp(notification.created_at)
          const showActions =
            notification.type === 'challenge_request' && !notification.action_response

          return (
            <Box
              key={notification.id}
              ref={isFocused ? focusedCardRef : undefined}
              borderWidth={isFocused ? '2px' : '1px'}
              borderColor={isFocused ? 'brand.primary' : 'border.control'}
              borderRadius="lg"
              bg={isRead ? 'white' : 'purple.50'}
              p={{ base: 4, md: 5 }}
              shadow={isFocused ? 'md' : 'none'}
            >
              <HStack align="start" spacing={4}>
                <Box
                  bg={isRead ? 'gray.100' : 'brand.primary'}
                  color={isRead ? 'gray.500' : 'white'}
                  borderRadius="full"
                  p={2.5}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <Icon as={notificationIcon(notification.type)} boxSize={5} />
                </Box>

                <Stack spacing={2} flex={1} minW={0}>
                  <HStack spacing={2} align="center" flexWrap="wrap">
                    <Text fontWeight="semibold" color="gray.900">
                      {notification.title || 'Notification'}
                    </Text>
                    {!isRead && (
                      <Badge colorScheme="purple" borderRadius="full" fontSize="xs">
                        New
                      </Badge>
                    )}
                  </HStack>

                  {sender && (
                    <Text fontSize="sm" color="text.secondary">
                      From {sender}
                    </Text>
                  )}

                  {/* Full message - no line clamp, unlike the bell preview. */}
                  <Text color="gray.700" whiteSpace="pre-line">
                    {notification.message}
                  </Text>

                  {(relative || exact) && (
                    <Text fontSize="xs" color="text.muted">
                      {relative}
                      {relative && exact ? ' · ' : ''}
                      {exact}
                    </Text>
                  )}

                  <HStack spacing={2} pt={1} flexWrap="wrap">
                    {destination && (
                      <Button
                        size="xs"
                        colorScheme="brand"
                        rightIcon={
                          destination.kind === 'external' ? (
                            <Icon as={ExternalLink} boxSize={3} />
                          ) : undefined
                        }
                        onClick={() => handleOpenDestination(notification)}
                      >
                        Open
                      </Button>
                    )}

                    {showActions && (
                      <>
                        <Button
                          size="xs"
                          colorScheme="brand"
                          variant="solid"
                          onClick={() => updateNotificationAction(notification, 'accepted')}
                        >
                          Accept
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => updateNotificationAction(notification, 'declined')}
                        >
                          Decline
                        </Button>
                      </>
                    )}

                    {!isRead && (
                      <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={<Icon as={CheckCheck} boxSize={3.5} />}
                        color="text.muted"
                        onClick={() => markNotificationAsRead(notification.id)}
                      >
                        Mark as read
                      </Button>
                    )}

                    {isFocused && (
                      <Button size="xs" variant="ghost" color="text.muted" onClick={clearFocus}>
                        Clear highlight
                      </Button>
                    )}
                  </HStack>
                </Stack>
              </HStack>
            </Box>
          )
        })}
      </Stack>

      {!loading && !error && Boolean(visible.length) && (
        <Text fontSize="xs" color="text.muted" textAlign="center">
          Showing {visible.length} of {sorted.length} notification
          {sorted.length === 1 ? '' : 's'}.{' '}
          <RouterLink to={location.pathname} onClick={() => { setFilter('all'); setSearch('') }}>
            <Text as="span" color="brand.primary" textDecoration="underline">
              Show all
            </Text>
          </RouterLink>
        </Text>
      )}
    </Stack>
  )
}

export default NotificationsPage
