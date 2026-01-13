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
  onSubmit: (mentorId: string | null) => Promise<void>
  mentors: OrganizationLead[]
  isLoadingMentors?: boolean
  mentorsError?: string | null
}

export const AssignMentorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  organization,
  onSubmit,
  mentors,
  isLoadingMentors = false,
  mentorsError = null,
}) => {
  const [mentor, setMentor] = useState('')
  const [mentorSearch, setMentorSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMentor(organization?.assignedMentorId || '')
  }, [organization])

  const sortedMentors = useMemo(
    () => [...mentors].sort((a, b) => a.name.localeCompare(b.name)),
    [mentors],
  )

  const filteredMentors = useMemo(() => {
    const term = mentorSearch.trim().toLowerCase()
    if (!term) return sortedMentors
    return sortedMentors.filter((item) => {
      const email = item.email?.toLowerCase() ?? ''
      return item.name.toLowerCase().includes(term) || email.includes(term)
    })
  }, [mentorSearch, sortedMentors])

  const missingMentor =
    mentor && !mentors.some((item) => item.id === mentor)
      ? { id: mentor, name: `Current mentor (${mentor})` }
      : null

  const handleSubmit = async () => {
    setLoading(true)
    await onSubmit(mentor ? mentor : null)
    setLoading(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Assign mentor</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text color="gray.700">
              Search mentors and update the assignment for this organization.
            </Text>
            <FormControl>
              <FormLabel>Search mentor</FormLabel>
              <Input
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
                placeholder="Type a name or email"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Mentor</FormLabel>
              <Select
                value={mentor}
                onChange={(e) => setMentor(e.target.value)}
                placeholder="Select mentor"
                isDisabled={isLoadingMentors}
              >
                <option value="">— No mentor —</option>
                {missingMentor ? (
                  <option value={missingMentor.id}>{missingMentor.name}</option>
                ) : null}
                {filteredMentors.map((mentorOption) => (
                  <option key={mentorOption.id} value={mentorOption.id}>
                    {mentorOption.name}
                    {mentorOption.email ? ` — ${mentorOption.email}` : ''}
                  </option>
                ))}
              </Select>
              {isLoadingMentors ? (
                <FormHelperText>
                  <HStack spacing={2}>
                    <Spinner size="xs" />
                    <Text>Loading mentors...</Text>
                  </HStack>
                </FormHelperText>
              ) : null}
              {!isLoadingMentors && mentorsError ? (
                <FormHelperText color="red.500">{mentorsError}</FormHelperText>
              ) : null}
              {!isLoadingMentors && !mentorsError && !filteredMentors.length ? (
                <FormHelperText color="gray.600">No mentors available.</FormHelperText>
              ) : null}
            </FormControl>
            {organization && (
              <Stack spacing={1} fontSize="sm" color="gray.600">
                <Text>
                  Current mentor:{' '}
                  {mentors.find((item) => item.id === organization.assignedMentorId)?.name || 'Unassigned'}
                </Text>
                <Badge colorScheme={organization.status === 'active' ? 'green' : 'orange'} w="fit-content">
                  {organization.status}
                </Badge>
              </Stack>
            )}
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
