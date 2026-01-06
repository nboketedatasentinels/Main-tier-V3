import React from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  Box,
} from '@chakra-ui/react'

interface IoradTutorialModalProps {
  isOpen: boolean
  isSubmitting: boolean
  tutorialUrl: string
  error?: string | null
  onClose: () => void
  onComplete: () => void
  onRetry?: () => void
}

export const IoradTutorialModal: React.FC<IoradTutorialModalProps> = ({
  isOpen,
  isSubmitting,
  tutorialUrl,
  error,
  onClose,
  onComplete,
  onRetry,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered>
    <ModalOverlay />
    <ModalContent>
      <ModalHeader>How to sync your Google calendar to the T4L calendar</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <Stack spacing={4}>
          <Text color="text.secondary">
            Complete the guided iorad tutorial below. You must finish the tutorial to mark the calendar sync rhythm item
            as done.
          </Text>
          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <AlertDescription>{error}</AlertDescription>
              {onRetry && (
                <Button size="sm" ml="auto" onClick={onRetry} variant="outline">
                  Retry
                </Button>
              )}
            </Alert>
          )}
          <Box borderWidth="1px" borderColor="border.card" borderRadius="md" overflow="hidden" bg="surface.subtle">
            <iframe
              title="Calendar sync tutorial"
              src={tutorialUrl}
              width="100%"
              height="520"
              style={{ border: 'none' }}
              allow="clipboard-write; fullscreen"
            />
          </Box>
        </Stack>
      </ModalBody>
      <ModalFooter gap={3}>
        <Button variant="ghost" onClick={onClose} isDisabled={isSubmitting}>
          Close
        </Button>
        <Button colorScheme="primary" onClick={onComplete} isLoading={isSubmitting} loadingText="Saving...">
          I've completed this tutorial
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
)
