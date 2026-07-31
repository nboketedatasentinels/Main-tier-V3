import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
} from '@chakra-ui/react'
import { CheckCheck, ExternalLink, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NotificationRecord } from '@/types/notifications'
import { getNotificationDetailPath } from '@/utils/notificationRouting'
import {
  isNotificationRead,
  notificationIcon,
  resolveNotificationDestination,
  resolveTimestamp,
} from './notificationMeta'

interface NotificationItemProps {
  notification: NotificationRecord
  onMarkRead: () => void
  onAction?: (action: NotificationRecord['action_response']) => void
  onClose?: () => void
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
  const navigate = useNavigate()
  const location = useLocation()

  const isRead = isNotificationRead(notification)
  const timestamp = resolveTimestamp(notification.created_at)
  const hasAction =
    notification.type === 'challenge_request' && !notification.action_response

  // The dropdown is a preview only - every notification opens on the full
  // notifications page, which shows the whole message instead of two clamped
  // lines. Any link the notification carries is offered there as an action.
  const destination = resolveNotificationDestination(notification)

  const handleOpen = () => {
    onClose?.()
    navigate(getNotificationDetailPath(location.pathname, notification.id))
  }

  return (
    <Box
      as="button"
      type="button"
      onClick={handleOpen}
      textAlign="left"
      w="full"
      borderWidth="1px"
      borderColor="border.control"
      borderRadius="lg"
      bg="white"
      p={4}
      transition="all 0.15s ease"
      cursor="pointer"
      _hover={{ shadow: 'md', borderColor: 'brand.primary' }}
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

          <Text
            as="span"
            color="brand.primary"
            fontSize="xs"
            fontWeight="semibold"
            mt={1}
            alignSelf="flex-start"
          >
            Read message →
          </Text>

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
          as="div"
          role="button"
          tabIndex={0}
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
}
