import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { OrganizationLead, OrganizationRecord } from '@/types/admin'

interface Props {
  isOpen: boolean
  onClose: () => void
  organization?: OrganizationRecord | null
  onSubmit: (ambassadorId: string | null) => Promise<void>
  coaches: OrganizationLead[]
  isLoadingCoaches?: boolean
  coachesError?: string | null
}

export const AssignAmbassadorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  organization,
  onSubmit,
  coaches,
  isLoadingCoaches = false,
  coachesError = null,
}) => {
  const [coach, setCoach] = useState('')
  const [ambassadorSearch, setCoachSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    setCoach(organization?.assignedAmbassadorId || '')
    setSubmitError(null)
  }, [organization])

  useEffect(() => {
    if (isOpen) return
    setSubmitError(null)
  }, [isOpen])

  const sortedCoaches = useMemo(
    () => [...coaches].sort((a, b) => a.name.localeCompare(b.name)),
    [coaches],
  )

  const filteredCoaches = useMemo(() => {
    const term = ambassadorSearch.trim().toLowerCase()
    if (!term) return sortedCoaches
    return sortedCoaches.filter((item) => {
      const email = item.email?.toLowerCase() ?? ''
      return item.name.toLowerCase().includes(term) || email.includes(term)
    })
  }, [ambassadorSearch, sortedCoaches])

  const missingCoach =
    coach && !coaches.some((item) => item.id === coach)
      ? { id: coach, name: `Current coach (${coach})` }
      : null

  const handleSubmit = async () => {
    setLoading(true)
    setSubmitError(null)
    try {
      await onSubmit(coach ? coach : null)
      onClose()
    } catch (error) {
      console.error(error)
      setSubmitError(error instanceof Error ? error.message : 'Unable to save coach assignment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Assign coach</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text color="gray.700">
              Search coaches and update the assignment for this organization.
            </Text>
            <FormControl>
              <FormLabel>Search coach</FormLabel>
              <Input
                value={ambassadorSearch}
                onChange={(e) => setCoachSearch(e.target.value)}
                placeholder="Type a name or email"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Coach</FormLabel>
              <Select
                value={coach}
                onChange={(e) => setCoach(e.target.value)}
                placeholder="Select coach"
                isDisabled={isLoadingCoaches}
              >
                <option value="">- No coach -</option>
                {missingCoach ? (
                  <option value={missingCoach.id}>{missingCoach.name}</option>
                ) : null}
                {filteredCoaches.map((ambassadorOption) => (
                  <option key={ambassadorOption.id} value={ambassadorOption.id}>
                    {ambassadorOption.name}
                    {ambassadorOption.email ? ` - ${ambassadorOption.email}` : ''}
                  </option>
                ))}
              </Select>
              {isLoadingCoaches ? (
                <FormHelperText>
                  <HStack spacing={2}>
                    <Spinner size="xs" />
                    <Text>Loading coaches...</Text>
                  </HStack>
                </FormHelperText>
              ) : null}
              {!isLoadingCoaches && coachesError ? (
                <FormHelperText color="red.500">{coachesError}</FormHelperText>
              ) : null}
              {!isLoadingCoaches && !coachesError && !filteredCoaches.length ? (
                <FormHelperText color="gray.600">No coaches available.</FormHelperText>
              ) : null}
            </FormControl>
            {organization && (
              <Stack spacing={1} fontSize="sm" color="gray.600">
                <Text>
                  Current coach:{' '}
                  {coaches.find((item) => item.id === organization.assignedAmbassadorId)?.name || 'Unassigned'}
                </Text>
                <Badge colorScheme={organization.status === 'active' ? 'green' : 'orange'} w="fit-content">
                  {organization.status}
                </Badge>
              </Stack>
            )}
            {submitError ? <FormHelperText color="red.500">{submitError}</FormHelperText> : null}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="purple" onClick={handleSubmit} isLoading={loading}>
            Save assignment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
