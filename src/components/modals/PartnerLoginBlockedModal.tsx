import React from 'react'
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { Users } from 'lucide-react'

/**
 * Shown when a transformation-partner account tries to sign in through the
 * regular user (/login) or admin (/admin-login) entry points. Partners may only
 * sign in via the partner portal (/partners), so we block them here and point
 * them to the right door. The caller signs the partner back out before/while
 * showing this so no non-partner session is left open.
 */
export const PartnerLoginBlockedModal: React.FC<{
  isOpen: boolean
  onClose: () => void
}> = ({ isOpen, onClose }) => (
  <Modal isOpen={isOpen} onClose={onClose} isCentered closeOnOverlayClick={false}>
    <ModalOverlay />
    <ModalContent>
      <ModalHeader display="flex" alignItems="center" gap={2}>
        <Users size={20} color="#350e6f" />
        Partners can&apos;t log in here
      </ModalHeader>
      <ModalBody>
        <Text color="text.secondary">
          This is a partner account. For security, partners can only sign in through the
          partner portal. Please use the partner sign-in page to access your dashboard.
        </Text>
      </ModalBody>
      <ModalFooter gap={3}>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={() => window.location.assign('/partners')}>
          Go to partner sign-in
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
)

export default PartnerLoginBlockedModal
