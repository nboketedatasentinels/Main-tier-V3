import {
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
  Textarea,
} from '@chakra-ui/react'
import type { ProofModalState } from '@/hooks/useWeeklyChecklistViewModel'

export const ProofModal = ({
  state,
  onClose,
  onChange,
  onSubmit,
}: {
  state: ProofModalState
  onClose: () => void
  onChange: (patch: Partial<ProofModalState>) => void
  onSubmit: () => Promise<void>
}) => {
  return (
    <Modal isOpen={state.isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Submit proof for verification</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={3} color="gray.600">
            Add a link (Drive, Dropbox, Notion, screenshot URL) and optional notes. Admins will verify and award points.
          </Text>

          <Stack spacing={3}>
            <Textarea
              placeholder="Proof link (required)"
              value={state.proofUrl}
              onChange={e => onChange({ proofUrl: e.target.value })}
            />
            <Textarea
              placeholder="Notes (optional)"
              value={state.notes}
              onChange={e => onChange({ notes: e.target.value })}
            />
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="purple"
            onClick={onSubmit}
            isDisabled={!state.proofUrl?.trim()}
          >
            Submit
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
