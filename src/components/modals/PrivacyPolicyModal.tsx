import React from 'react'
import {
  Button,
  Link,
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
import { PRIVACY_STATEMENT_URL } from '@/config/app'

interface PrivacyPolicyModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Lightweight prompt that sends people to the canonical public privacy
 * statement on t4leader.com (kept for any leftover callers).
 */
export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Privacy Policy</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="start" spacing={3}>
            <Text fontSize="sm" color="gray.600">
              Our full privacy statement is published on the Transformation Leaders website.
            </Text>
            <Link href={PRIVACY_STATEMENT_URL} isExternal color="brand.primary" fontWeight="semibold">
              Open privacy statement
            </Link>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button
            as="a"
            href={PRIVACY_STATEMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            colorScheme="purple"
            mr={3}
            onClick={onClose}
          >
            View privacy statement
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
