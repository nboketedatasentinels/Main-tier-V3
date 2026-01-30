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
  invitationCode: string
  inviteLink: string
}

export const VillageInviteCodeModal = ({ isOpen, onClose, invitationCode, inviteLink }: Props) => {
  const handleCopy = async (value: string) => {
    if (!navigator.clipboard) return
    await navigator.clipboard.writeText(value)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Shareable invitation</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="start" spacing={3}>
            <Text fontSize="sm">Invitation code</Text>
            <Text fontSize="lg" fontWeight="bold" fontFamily="mono">
              {invitationCode}
            </Text>
            <Button size="sm" variant="outline" onClick={() => handleCopy(invitationCode)}>
              Copy code
            </Button>
            <Text fontSize="sm" pt={2}>Invite link</Text>
            <Text fontSize="xs" color="brand.subtleText">
              {inviteLink}
            </Text>
            <Button size="sm" variant="outline" onClick={() => handleCopy(inviteLink)}>
              Copy link
            </Button>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Done</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
