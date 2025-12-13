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

interface PrivacyPolicyModalProps {
  isOpen: boolean
  onClose: () => void
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Privacy Policy</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="start" spacing={3} maxH="420px">
            <Text fontWeight="semibold">Your privacy matters</Text>
            <Text fontSize="sm" color="gray.600">
              We collect your information solely to provide and improve the services on this platform. Key highlights include:
            </Text>
            <VStack spacing={2} align="start" fontSize="sm" color="gray.700">
              <Text>• We do not sell your personal data.</Text>
              <Text>• Data is used to personalize your experience and track progress.</Text>
              <Text>• You can request data deletion or export through support.</Text>
              <Text>• Industry best practices are used to protect your data.</Text>
            </VStack>
            <Text fontSize="sm" color="gray.600">
              By continuing, you acknowledge that you have reviewed and understand how your data is handled.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
