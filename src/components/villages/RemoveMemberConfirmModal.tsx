import {
  Button,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Textarea,
} from '@chakra-ui/react'
import { useState } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  memberName: string
  isLoading?: boolean
}

export const RemoveMemberConfirmModal = ({ isOpen, onClose, onConfirm, memberName, isLoading }: Props) => {
  const [reason, setReason] = useState('')

  const handleConfirm = async () => {
    await onConfirm(reason.trim())
    setReason('')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Remove member</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel fontSize="sm">
              Reason for removing {memberName}
            </FormLabel>
            <Textarea
              placeholder="Optional reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="red" onClick={handleConfirm} isLoading={isLoading}>
            Remove member
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
