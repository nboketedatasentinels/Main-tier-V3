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

type Props = {
  isOpen: boolean
  onClose: () => void
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
  villageName: string
  villageDescription?: string
  memberCount: number
  availableSlots: number
  isLoading?: boolean
  isDisabled?: boolean
}

export const VillageInvitationModal = ({
  isOpen,
  onClose,
  onAccept,
  onDecline,
  villageName,
  villageDescription,
  memberCount,
  availableSlots,
  isLoading,
  isDisabled,
}: Props) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Join village?</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="start" spacing={2}>
            <Text fontSize="md" fontWeight="semibold">{villageName}</Text>
            {villageDescription && (
              <Text fontSize="sm" color="brand.subtleText">{villageDescription}</Text>
            )}
            <Text fontSize="sm">Members: {memberCount}</Text>
            <Text fontSize="sm">Available slots: {availableSlots}</Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onDecline} isDisabled={isLoading}>
            Decline
          </Button>
          <Button colorScheme="purple" onClick={onAccept} isLoading={isLoading} isDisabled={isDisabled}>
            Confirm join
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
