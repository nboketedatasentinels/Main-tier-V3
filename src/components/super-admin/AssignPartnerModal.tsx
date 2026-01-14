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
  onSubmit: (partnerId: string | null) => Promise<void>
  partners: OrganizationLead[]
  isLoadingPartners?: boolean
  partnersError?: string | null
  partnerAssignmentCounts?: Record<string, number>
}

export const AssignPartnerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  organization,
  onSubmit,
  partners,
  isLoadingPartners = false,
  partnersError = null,
  partnerAssignmentCounts,
}) => {
  const [partner, setPartner] = useState('')
  const [partnerSearch, setPartnerSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setPartner(organization?.transformationPartnerId || '')
  }, [organization])

  const sortedPartners = useMemo(
    () => [...partners].sort((a, b) => a.name.localeCompare(b.name)),
    [partners],
  )

  const filteredPartners = useMemo(() => {
    const term = partnerSearch.trim().toLowerCase()
    if (!term) return sortedPartners
    return sortedPartners.filter((item) => {
      const email = item.email?.toLowerCase() ?? ''
      return item.name.toLowerCase().includes(term) || email.includes(term)
    })
  }, [partnerSearch, sortedPartners])

  const missingPartner =
    partner && !partners.some((item) => item.id === partner)
      ? { id: partner, name: `Current partner (${partner})` }
      : null

  const buildPartnerLabel = (item: OrganizationLead) => {
    const emailSuffix = item.email ? ` — ${item.email}` : ''
    const assignmentCount = partnerAssignmentCounts?.[item.id] ?? 0
    const countSuffix = assignmentCount > 1 ? ` • ${assignmentCount} orgs` : ''
    return `${item.name}${emailSuffix}${countSuffix}`
  }

  const handleSubmit = async () => {
    setLoading(true)
    await onSubmit(partner ? partner : null)
    setLoading(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Assign transformation partner</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text color="gray.700">
              Update the primary partner responsible for this organization. Assignment changes are logged for audit
              visibility.
            </Text>
            <FormControl>
              <FormLabel>Search partner</FormLabel>
              <Input
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                placeholder="Type a name or email"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Partner</FormLabel>
              <Select
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                placeholder="Select partner"
                isDisabled={isLoadingPartners}
              >
                <option value="">— No partner —</option>
                {missingPartner ? (
                  <option value={missingPartner.id}>{missingPartner.name}</option>
                ) : null}
                {filteredPartners.map((partnerOption) => (
                  <option key={partnerOption.id} value={partnerOption.id}>
                    {buildPartnerLabel(partnerOption)}
                  </option>
                ))}
              </Select>
              {isLoadingPartners ? (
                <FormHelperText>
                  <HStack spacing={2}>
                    <Spinner size="xs" />
                    <Text>Loading partners...</Text>
                  </HStack>
                </FormHelperText>
              ) : null}
              {!isLoadingPartners && partnersError ? (
                <FormHelperText color="red.500">{partnersError}</FormHelperText>
              ) : null}
              {!isLoadingPartners && !partnersError && !filteredPartners.length ? (
                <FormHelperText color="gray.600">No partners available.</FormHelperText>
              ) : null}
            </FormControl>
            {organization && (
              <Stack spacing={1} fontSize="sm" color="gray.600">
                <Text>
                  Current partner:{' '}
                  {partners.find((item) => item.id === organization.transformationPartnerId)?.name || 'Unassigned'}
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
