import React, { useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from '@chakra-ui/react'
import { ArrowUpRight, CheckCircle2, Megaphone } from 'lucide-react'
import { format } from 'date-fns'
import { useAnnouncements } from '@/hooks/useAnnouncements'

export const NewAnnouncementPopup: React.FC = () => {
  const { announcements, mandatoryPending, markAnnouncementAsRead } = useAnnouncements()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const dismissingRef = useRef(false)

  const current = useMemo(() => {
    if (mandatoryPending.length > 0) return null
    return (
      announcements.find(
        (item) =>
          !item.isMandatory &&
          !item.isArchived &&
          !item.isRead &&
          !dismissedIds.has(item.id),
      ) ?? null
    )
  }, [announcements, mandatoryPending, dismissedIds])

  if (!current) return null

  const dismiss = () => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      next.add(current.id)
      return next
    })
  }

  const handleDismiss = async () => {
    if (dismissingRef.current) return
    dismissingRef.current = true
    try {
      await markAnnouncementAsRead(current.id)
    } catch (err) {
      console.error('[NewAnnouncementPopup] Failed to mark announcement as read', err)
    } finally {
      dismiss()
      dismissingRef.current = false
    }
  }

  const handleAction = () => {
    if (current.actionUrl) {
      window.open(current.actionUrl, '_blank', 'noopener,noreferrer')
    }
    void handleDismiss()
  }

  return (
    <Modal isOpen onClose={handleDismiss} size="2xl" isCentered>
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent borderRadius="2xl" overflow="hidden">
        <ModalHeader bg="purple.50">
          <Stack spacing={1}>
            <HStack spacing={2}>
              <Icon as={Megaphone} color="purple.600" boxSize={5} />
              <Text fontSize="xs" fontWeight="bold" color="purple.700" letterSpacing="widest">
                NEW ANNOUNCEMENT
              </Text>
              <Badge colorScheme="purple" borderRadius="full">
                Just posted
              </Badge>
            </HStack>
            <Heading size="lg" color="text.primary">
              {current.title}
            </Heading>
            {current.createdAt && (
              <Text color="text.muted" fontSize="xs">
                Posted {format(current.createdAt, 'MMM d, yyyy')}
                {current.author ? ` • ${current.author}` : ''}
              </Text>
            )}
          </Stack>
        </ModalHeader>
        <ModalCloseButton rounded="full" mt={2} />
        <ModalBody pt={5} pb={2}>
          <Box
            borderWidth={1}
            borderColor="border.subtle"
            bg="surface.subtle"
            borderRadius="2xl"
            p={4}
          >
            <Text whiteSpace="pre-wrap" color="text.secondary" fontSize="md" lineHeight="tall">
              {current.message}
            </Text>
          </Box>
        </ModalBody>
        <ModalFooter justifyContent="flex-end" gap={3}>
          {current.actionUrl && current.actionLabel ? (
            <Button
              colorScheme="purple"
              rightIcon={<Icon as={ArrowUpRight} boxSize={4} />}
              onClick={handleAction}
            >
              {current.actionLabel}
            </Button>
          ) : null}
          <Button
            variant="outline"
            leftIcon={<Icon as={CheckCircle2} boxSize={4} />}
            onClick={handleDismiss}
          >
            Got it
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
