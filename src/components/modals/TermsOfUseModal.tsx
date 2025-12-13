import React from 'react'
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react'

interface TermsOfUseModalProps {
  isOpen: boolean
  onClose: () => void
  onAccept: () => void
}

export const TermsOfUseModal: React.FC<TermsOfUseModalProps> = ({ isOpen, onClose, onAccept }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Terms of Use</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="start" spacing={3} maxH="420px">
            <Text fontWeight="semibold">Welcome to our platform</Text>
            <Text fontSize="sm" color="gray.600">
              By creating an account, you agree to use our services responsibly and to protect your account credentials.
              Please review the following key points:
            </Text>
            <VStack spacing={2} align="start" fontSize="sm" color="gray.700">
              <Text>• Keep your login credentials secure and do not share them.</Text>
              <Text>• Respect other members and engage constructively.</Text>
              <Text>• Do not misuse or attempt to reverse engineer the platform.</Text>
              <Text>• Comply with all applicable laws and regulations.</Text>
            </VStack>
            <Text fontSize="sm" color="gray.600">
              Continued use of the platform constitutes acceptance of these terms. If you have questions, please contact
              support before proceeding.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Close
          </Button>
          <Button colorScheme="purple" onClick={onAccept}>
            Accept
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
