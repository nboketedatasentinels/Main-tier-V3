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

/** Activities where a link is optional - confirmation notes are enough. */
const OPTIONAL_PROOF_ACTIVITY_IDS = new Set(['weekly_session'])

export const isOptionalProofActivity = (activityId?: string | null): boolean =>
  Boolean(activityId && OPTIONAL_PROOF_ACTIVITY_IDS.has(activityId))

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
  const attendanceOnly = isOptionalProofActivity(state.activityId)
  const canSubmit = attendanceOnly
    ? true
    : Boolean(state.proofUrl?.trim())

  return (
    <Modal isOpen={state.isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {attendanceOnly
            ? isResubmission
              ? 'Resubmit weekly session attendance'
              : 'Confirm weekly session attendance'
            : isResubmission
              ? 'Resubmit proof for partner review'
              : 'Submit proof for partner review'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {state.rejectionReason ? (
            <Text mb={3} color="red.600" fontSize="sm">
              Rejected: {state.rejectionReason}
            </Text>
          ) : null}
          <Text mb={3} color="gray.600">
            {attendanceOnly
              ? 'Confirm you attended. This stays pending until your partner assigns marks from the partner portal - you will not receive points yet.'
              : 'Add a link (Dropbox, Notion, screenshot URL) and optional notes. Submitting proof marks this activity as submitted; it becomes completed after approval.'}
          </Text>

          <Stack spacing={3}>
            {!attendanceOnly && (
              <Input
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com/proof (required)"
                value={state.proofUrl}
                onChange={(e) => onChange({ proofUrl: e.target.value })}
              />
            )}
            <Textarea
              placeholder={
                attendanceOnly
                  ? 'Optional notes (session date, host, etc.)'
                  : 'Notes (optional)'
              }
              value={state.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
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
            isDisabled={!canSubmit || isSubmitting}
            isLoading={isSubmitting}
            loadingText="Submitting"
          >
            {attendanceOnly ? 'Confirm attendance' : 'Submit proof'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
