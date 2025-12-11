import React from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
} from '@chakra-ui/react'

interface ConfirmationWelcomeModalProps {
  isOpen: boolean
  onAcknowledge: () => void
}

export const ConfirmationWelcomeModal: React.FC<ConfirmationWelcomeModalProps> = ({ isOpen, onAcknowledge }) => {
  return (
    <Modal isOpen={isOpen} onClose={onAcknowledge} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Welcome to T4L</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="start" spacing={3}>
            <Text color="brand.subtleText">Your email is verified and your journey can officially begin.</Text>
            <Text color="brand.subtleText">Start exploring the platform, log your first impact, or join a community space.</Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="purple" onClick={onAcknowledge}>
            Start exploring
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
