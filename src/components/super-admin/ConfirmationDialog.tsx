import React from 'react'
import {
  Alert,
  AlertIcon,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'

interface Props {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export const ConfirmationDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
}) => {
  const [loading, setLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (isOpen) return
    setErrorMessage(null)
  }, [isOpen])

  const handleConfirm = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to complete this action.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text color="gray.700">{description}</Text>
          {errorMessage ? (
            <Alert status="error" mt={3} borderRadius="md">
              <AlertIcon />
              {errorMessage}
            </Alert>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="red" onClick={handleConfirm} isLoading={loading}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

