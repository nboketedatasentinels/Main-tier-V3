import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Input,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react'
import type { ProofModalState } from '@/hooks/useWeeklyChecklistViewModel'

export const ProofModal = ({
  state,
  isSubmitting,
  onClose,
  onChange,
  onSubmit,
}: {
  state: ProofModalState
  isSubmitting: boolean
  onClose: () => void
  onChange: (patch: Partial<ProofModalState>) => void
  onSubmit: () => Promise<void>
}) => {
  const isResubmission = Boolean(state.rejectionReason)
  return (
    <Modal isOpen={state.isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{isResubmission ? 'Resubmit proof for verification' : 'Submit proof for verification'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {state.rejectionReason ? (
            <Text mb={3} color="red.600" fontSize="sm">
              Rejected: {state.rejectionReason}
            </Text>
          ) : null}
          <Text mb={3} color="gray.600">
            Add a link (Drive, Dropbox, Notion, screenshot URL) and optional notes. Admins will verify and award points.
          </Text>

          <Stack spacing={3}>
            <Input
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com/proof (required)"
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
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            colorScheme="purple"
            onClick={onSubmit}
            isDisabled={!state.proofUrl?.trim() || isSubmitting}
            isLoading={isSubmitting}
            loadingText="Submitting"
          >
            Submit
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
