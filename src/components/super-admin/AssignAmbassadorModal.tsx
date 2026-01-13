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
  ambassadors: OrganizationLead[]
  isLoadingAmbassadors?: boolean
  ambassadorsError?: string | null
}

export const AssignAmbassadorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  organization,
  onSubmit,
  ambassadors,
  isLoadingAmbassadors = false,
  ambassadorsError = null,
}) => {
  const [ambassador, setAmbassador] = useState('')
  const [ambassadorSearch, setAmbassadorSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setAmbassador(organization?.assignedAmbassadorId || '')
  }, [organization])

  const sortedAmbassadors = useMemo(
    () => [...ambassadors].sort((a, b) => a.name.localeCompare(b.name)),
    [ambassadors],
  )

  const filteredAmbassadors = useMemo(() => {
    const term = ambassadorSearch.trim().toLowerCase()
    if (!term) return sortedAmbassadors
    return sortedAmbassadors.filter((item) => {
      const email = item.email?.toLowerCase() ?? ''
      return item.name.toLowerCase().includes(term) || email.includes(term)
    })
  }, [ambassadorSearch, sortedAmbassadors])

  const missingAmbassador =
    ambassador && !ambassadors.some((item) => item.id === ambassador)
      ? { id: ambassador, name: `Current ambassador (${ambassador})` }
      : null

  const handleSubmit = async () => {
    setLoading(true)
    await onSubmit(ambassador ? ambassador : null)
    setLoading(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Assign ambassador</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text color="gray.700">
              Search ambassadors and update the assignment for this organization.
            </Text>
            <FormControl>
              <FormLabel>Search ambassador</FormLabel>
              <Input
                value={ambassadorSearch}
                onChange={(e) => setAmbassadorSearch(e.target.value)}
                placeholder="Type a name or email"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Ambassador</FormLabel>
              <Select
                value={ambassador}
                onChange={(e) => setAmbassador(e.target.value)}
                placeholder="Select ambassador"
                isDisabled={isLoadingAmbassadors}
              >
                <option value="">— No ambassador —</option>
                {missingAmbassador ? (
                  <option value={missingAmbassador.id}>{missingAmbassador.name}</option>
                ) : null}
                {filteredAmbassadors.map((ambassadorOption) => (
                  <option key={ambassadorOption.id} value={ambassadorOption.id}>
                    {ambassadorOption.name}
                    {ambassadorOption.email ? ` — ${ambassadorOption.email}` : ''}
                  </option>
                ))}
              </Select>
              {isLoadingAmbassadors ? (
                <FormHelperText>
                  <HStack spacing={2}>
                    <Spinner size="xs" />
                    <Text>Loading ambassadors...</Text>
                  </HStack>
                </FormHelperText>
              ) : null}
              {!isLoadingAmbassadors && ambassadorsError ? (
                <FormHelperText color="red.500">{ambassadorsError}</FormHelperText>
              ) : null}
              {!isLoadingAmbassadors && !ambassadorsError && !filteredAmbassadors.length ? (
                <FormHelperText color="gray.600">No ambassadors available.</FormHelperText>
              ) : null}
            </FormControl>
            {organization && (
              <Stack spacing={1} fontSize="sm" color="gray.600">
                <Text>
                  Current ambassador:{' '}
                  {ambassadors.find((item) => item.id === organization.assignedAmbassadorId)?.name || 'Unassigned'}
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
