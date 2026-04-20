import React, { useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { useAnnouncements } from '@/hooks/useAnnouncements'

export const MandatoryAnnouncementGate: React.FC = () => {
  const { mandatoryPending, markActionCompleted } = useAnnouncements()
  const [confirming, setConfirming] = useState(false)
  const toast = useToast()

  const current = mandatoryPending[0]
  if (!current) return null

  const handleConfirm = async () => {
    if (!current) return
    setConfirming(true)
    try {
      if (current.actionUrl) {
        window.open(current.actionUrl, '_blank', 'noopener,noreferrer')
      }
      await markActionCompleted(current.id)
    } catch (error) {
      console.error('Failed to mark announcement action complete', error)
      toast({
        title: 'Unable to save your response',
        description: 'Please try again in a moment.',
        status: 'error',
        duration: 4000,
      })
    } finally {
      setConfirming(false)
    }
  }

  const remaining = mandatoryPending.length

  return (
    <Modal
      isOpen={Boolean(current)}
      onClose={() => {
        /* blocked */
      }}
      size="2xl"
      isCentered
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay bg="rgba(15, 3, 25, 0.78)" backdropFilter="blur(8px)" />
      <ModalContent borderRadius="2xl" overflow="hidden" borderWidth={2} borderColor="red.300">
        <ModalHeader bg="red.50">
          <Stack spacing={1}>
            <HStack spacing={2}>
              <Icon as={AlertTriangle} color="red.500" boxSize={5} />
              <Text fontSize="xs" fontWeight="bold" color="red.600" letterSpacing="widest">
                ACTION REQUIRED
              </Text>
              {remaining > 1 && (
                <Badge colorScheme="red" borderRadius="full">
                  {remaining} pending
                </Badge>
              )}
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
        <ModalBody pt={5} pb={2}>
          <Stack spacing={4}>
            <Alert status="warning" borderRadius="xl">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                You must confirm this action before continuing to use the platform.
              </AlertDescription>
            </Alert>
            <Box borderWidth={1} borderColor="border.subtle" bg="surface.subtle" borderRadius="2xl" p={4}>
              <Text whiteSpace="pre-wrap" color="text.secondary" fontSize="md" lineHeight="tall">
                {current.message}
              </Text>
            </Box>
          </Stack>
        </ModalBody>
        <ModalFooter justifyContent="flex-end">
          <Button
            colorScheme="red"
            size="lg"
            leftIcon={<Icon as={CheckCircle2} boxSize={4} />}
            rightIcon={current.actionUrl ? <Icon as={ArrowUpRight} boxSize={4} /> : undefined}
            onClick={handleConfirm}
            isLoading={confirming}
          >
            {current.actionLabel || 'Confirm I have taken action'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
