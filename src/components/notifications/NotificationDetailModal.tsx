import {
  Box,
  Button,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Quote, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { NotificationRecord } from '@/types/notifications'

interface NotificationDetailModalProps {
  notification: NotificationRecord | null
  isOpen: boolean
  onClose: () => void
}

const resolveTimestamp = (value?: unknown): string => {
  if (!value) return ''
  const date =
    typeof value === 'object' && value && 'toDate' in (value as Record<string, unknown>)
      ? (value as { toDate: () => Date }).toDate()
      : new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  return formatDistanceToNow(date, { addSuffix: true })
}

export const NotificationDetailModal = ({
  notification,
  isOpen,
  onClose,
}: NotificationDetailModalProps) => {
  if (!notification) return null

  const timestamp = resolveTimestamp(notification.created_at)

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size={{ base: 'sm', md: 'lg' }}>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent
        bgGradient="linear(to-r, #350e6f, #8b5a3c)"
        color="white"
        borderRadius="xl"
        boxShadow="2xl"
        overflow="hidden"
      >
        <Box position="absolute" top={3} right={3} zIndex={2}>
          <Button
            aria-label="Close"
            variant="ghost"
            size="sm"
            color="whiteAlpha.800"
            _hover={{ color: 'white', bg: 'whiteAlpha.200' }}
            onClick={onClose}
            p={2}
            minW="auto"
          >
            <Icon as={X} boxSize={4} />
          </Button>
        </Box>

        <ModalBody p={{ base: 6, md: 8 }} pt={{ base: 10, md: 10 }}>
          <Stack spacing={5}>
            <HStack spacing={2}>
              <Icon as={Quote} color="white" boxSize={5} />
              <Text
                fontWeight="semibold"
                fontSize="sm"
                color="whiteAlpha.900"
                fontFamily="heading"
                letterSpacing="wide"
                textTransform="uppercase"
              >
                {notification.title || 'Notification'}
              </Text>
            </HStack>

            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="medium"
              color="white"
              fontFamily="heading"
              lineHeight="1.5"
              whiteSpace="pre-line"
            >
              {notification.message}
            </Text>

            {timestamp && (
              <Text
                fontSize="xs"
                color="whiteAlpha.700"
                fontFamily="body"
                fontStyle="italic"
              >
                {timestamp}
              </Text>
            )}
          </Stack>
        </ModalBody>

        <ModalFooter
          bg="whiteAlpha.100"
          borderTopWidth="1px"
          borderTopColor="whiteAlpha.200"
        >
          <Button
            bg="white"
            color="#350e6f"
            _hover={{ bg: 'whiteAlpha.900' }}
            onClick={onClose}
            fontWeight="semibold"
          >
            Got it
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
