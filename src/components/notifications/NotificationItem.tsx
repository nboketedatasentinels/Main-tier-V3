import { ReactNode, useState } from 'react'
import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  BellRing,
  CheckCheck,
  ExternalLink,
  MessageCircle,
  MessageSquare,
  ShieldAlert,
  Star,
  Trophy,
  UserCheck,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Link as RouterLink } from 'react-router-dom'
import { NotificationRecord } from '@/types/notifications'
import { NotificationDetailModal } from './NotificationDetailModal'

interface NotificationItemProps {
  notification: NotificationRecord
  onMarkRead: () => void
  onAction?: (action: NotificationRecord['action_response']) => void
  onClose?: () => void
}

interface NotificationDestination {
  kind: 'external' | 'internal' | 'modal'
  url?: string
}

const resolveNotificationDestination = (
  notification: NotificationRecord,
): NotificationDestination | null => {
  const md = (notification.metadata ?? {}) as Record<string, unknown>

  const externalUrl = typeof md.externalUrl === 'string' ? md.externalUrl : null
  if (externalUrl) return { kind: 'external', url: externalUrl }

  const actionUrl = typeof md.actionUrl === 'string' ? md.actionUrl : null
  if (actionUrl) {
    return /^https?:\/\//i.test(actionUrl)
      ? { kind: 'external', url: actionUrl }
      : { kind: 'internal', url: actionUrl }
  }

  if (notification.type === 'programme_day') {
    return { kind: 'modal' }
  }

  return null
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

const linkStyle: React.CSSProperties = {
  display: 'block',
  textDecoration: 'none',
  color: 'inherit',
}

const stopClick = (e: React.MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

export const NotificationItem = ({
  notification,
  onMarkRead,
  onAction,
  onClose,
}: NotificationItemProps) => {
  const isRead = notification.is_read || notification.read
  const timestamp = resolveTimestamp(notification.created_at)
  const hasAction =
    notification.type === 'challenge_request' && !notification.action_response

  const destination = resolveNotificationDestination(notification)
  const [modalOpen, setModalOpen] = useState(false)

  const handleNavigate = () => {
    if (!isRead) onMarkRead()
    onClose?.()
  }

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isRead) onMarkRead()
    onClose?.()
    setModalOpen(true)
  }

  const clickable = destination !== null

  const cardBody = (
    <Box
      borderWidth="1px"
      borderColor="border.control"
      borderRadius="lg"
      bg="white"
      p={4}
      transition="all 0.15s ease"
      cursor={clickable ? 'pointer' : 'default'}
      _hover={{
        shadow: clickable ? 'md' : 'sm',
        borderColor: clickable ? 'brand.primary' : 'border.control',
      }}
    >
      <HStack align="start" spacing={4}>
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
            {destination?.kind === 'external' && (
              <Icon as={ExternalLink} boxSize={3} color="text.muted" />
            )}
          </HStack>

          <Text color="gray.600" fontSize="sm" noOfLines={2}>
            {notification.message}
          </Text>

          {destination?.kind === 'modal' && (
            <Text
              as="span"
              color="brand.primary"
              fontSize="xs"
              fontWeight="semibold"
              mt={1}
              _hover={{ textDecoration: 'underline' }}
              alignSelf="flex-start"
            >
              View more →
            </Text>
          )}

          {timestamp && (
            <Text color="text.muted" fontSize="xs" mt={1}>
              {timestamp}
            </Text>
          )}

          {hasAction && onAction && (
            <HStack spacing={2} mt={3}>
              <Button
                size="xs"
                colorScheme="brand"
                variant="solid"
                onClick={(e) => {
                  stopClick(e)
                  onAction('accepted')
                }}
              >
                Accept
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => {
                  stopClick(e)
                  onAction('declined')
                }}
              >
                Decline
              </Button>
            </HStack>
          )}
        </Stack>

        <IconButton
          aria-label={isRead ? 'Dismiss' : 'Mark as read'}
          icon={isRead ? <X size={16} /> : <CheckCheck size={16} />}
          variant="ghost"
          size="sm"
          color="text.muted"
          _hover={{ color: 'gray.600', bg: 'gray.100' }}
          onClick={(e) => {
            stopClick(e)
            onMarkRead()
          }}
          flexShrink={0}
        />
      </HStack>
    </Box>
  )

  return (
    <>
      <NotificationLinkWrapper
        destination={destination}
        onNavigate={handleNavigate}
        onOpenModal={handleOpenModal}
      >
        {cardBody}
      </NotificationLinkWrapper>
      <NotificationDetailModal
        notification={notification}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}

interface NotificationLinkWrapperProps {
  destination: NotificationDestination | null
  onNavigate: () => void
  onOpenModal: (e: React.MouseEvent) => void
  children: ReactNode
}

const NotificationLinkWrapper = ({
  destination,
  onNavigate,
  onOpenModal,
  children,
}: NotificationLinkWrapperProps) => {
  if (!destination) return <>{children}</>

  if (destination.kind === 'external' && destination.url) {
    return (
      <a
        href={destination.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        style={linkStyle}
      >
        {children}
      </a>
    )
  }

  if (destination.kind === 'internal' && destination.url) {
    return (
      <RouterLink to={destination.url} onClick={onNavigate} style={linkStyle}>
        {children}
      </RouterLink>
    )
  }

  // Modal case: plain clickable wrapper
  return (
    <Box as="div" onClick={onOpenModal} style={{ cursor: 'pointer' }}>
      {children}
    </Box>
  )
}
