import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Checkbox,
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

type CandidateUser = OrganizationLead & { role?: string }

interface Props {
  isOpen: boolean
  onClose: () => void
  organization?: OrganizationRecord | null
  /**
   * Resolves partnerId after applying any role elevation. The page-level
   * handler now calls assignPartnerToOrganization; if `promoteFirst` is true
   * it calls promoteUserToPartner before assignment.
   */
  onSubmit: (
    partnerId: string | null,
    options: { promoteFirst: boolean },
  ) => Promise<void>
  /** Existing partners (kept for the "Current partner" fallback display). */
  partners: OrganizationLead[]
  /** All users — admins can grant partner access to any of them. */
  allUsers: CandidateUser[]
  isLoadingPartners?: boolean
  isLoadingAllUsers?: boolean
  partnersError?: string | null
  partnerAssignmentCounts?: Record<string, number>
}

export const AssignPartnerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  organization,
  onSubmit,
  partners,
  allUsers,
  isLoadingPartners = false,
  isLoadingAllUsers = false,
  partnersError = null,
  partnerAssignmentCounts,
}) => {
  const [partner, setPartner] = useState('')
  const [partnerSearch, setPartnerSearch] = useState('')
  const [grantPartnerAccess, setGrantPartnerAccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    setPartner(organization?.partnerId || organization?.transformationPartnerId || '')
    setSubmitError(null)
  }, [organization])

  useEffect(() => {
    if (isOpen) return
    setSubmitError(null)
    setGrantPartnerAccess(false)
  }, [isOpen])

  const isPartnerRole = (role?: string) => {
    const normalized = (role ?? '').toLowerCase()
    return normalized === 'partner' || normalized === 'company_admin' || normalized === 'admin'
  }

  // The candidate pool is every user. Existing partners are still surfaced
  // (sorted to the top); non-partners are eligible for elevation.
  const sortedCandidates = useMemo(() => {
    return [...allUsers].sort((a, b) => {
      const aIsPartner = isPartnerRole(a.role) ? 0 : 1
      const bIsPartner = isPartnerRole(b.role) ? 0 : 1
      if (aIsPartner !== bIsPartner) return aIsPartner - bIsPartner
      return a.name.localeCompare(b.name)
    })
  }, [allUsers])

  const filteredCandidates = useMemo(() => {
    const term = partnerSearch.trim().toLowerCase()
    if (!term) return sortedCandidates
    return sortedCandidates.filter((item) => {
      const email = item.email?.toLowerCase() ?? ''
      return item.name.toLowerCase().includes(term) || email.includes(term)
    })
  }, [partnerSearch, sortedCandidates])

  const selectedCandidate = useMemo(
    () => allUsers.find((u) => u.id === partner) ?? null,
    [allUsers, partner],
  )
  const selectedNeedsPromotion = Boolean(
    selectedCandidate && !isPartnerRole(selectedCandidate.role),
  )

  // Reset the consent checkbox when selection changes — admin must re-confirm.
  useEffect(() => {
    setGrantPartnerAccess(false)
  }, [partner])

  const missingPartner =
    partner && !allUsers.some((item) => item.id === partner)
      ? { id: partner, name: `Current partner (${partner})` }
      : null

  const buildCandidateLabel = (item: CandidateUser) => {
    const emailSuffix = item.email ? ` — ${item.email}` : ''
    const assignmentCount = partnerAssignmentCounts?.[item.id] ?? 0
    const countSuffix = assignmentCount > 1 ? ` • ${assignmentCount} orgs` : ''
    const rolePrefix = isPartnerRole(item.role) ? '' : `[${item.role || 'user'}] `
    return `${rolePrefix}${item.name}${emailSuffix}${countSuffix}`
  }

  const handleSubmit = async () => {
    if (selectedNeedsPromotion && !grantPartnerAccess) {
      setSubmitError('Tick "Grant partner access" to elevate this user before assigning.')
      return
    }
    setLoading(true)
    setSubmitError(null)
    try {
      await onSubmit(partner ? partner : null, { promoteFirst: selectedNeedsPromotion })
      onClose()
    } catch (error) {
      console.error(error)
      setSubmitError(error instanceof Error ? error.message : 'Unable to save partner assignment.')
    } finally {
      setLoading(false)
    }
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
                placeholder="Select user"
                isDisabled={isLoadingAllUsers}
              >
                <option value="">— No partner —</option>
                {missingPartner ? (
                  <option value={missingPartner.id}>{missingPartner.name}</option>
                ) : null}
                {filteredCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {buildCandidateLabel(candidate)}
                  </option>
                ))}
              </Select>
              {isLoadingAllUsers ? (
                <FormHelperText>
                  <HStack spacing={2}>
                    <Spinner size="xs" />
                    <Text>Loading users...</Text>
                  </HStack>
                </FormHelperText>
              ) : null}
              {!isLoadingAllUsers && partnersError ? (
                <FormHelperText color="red.500">{partnersError}</FormHelperText>
              ) : null}
              {!isLoadingAllUsers && !partnersError && !filteredCandidates.length ? (
                <FormHelperText color="gray.600">No users found.</FormHelperText>
              ) : null}
              {!isLoadingAllUsers && !isLoadingPartners ? (
                <FormHelperText color="gray.600">
                  Existing partners appear first. Other users are shown with their current role tag and can be granted partner access.
                </FormHelperText>
              ) : null}
            </FormControl>
            {selectedNeedsPromotion ? (
              <Box bg="orange.50" border="1px solid" borderColor="orange.200" rounded="md" p={3}>
                <Stack spacing={2}>
                  <Text fontSize="sm" color="orange.800" fontWeight="semibold">
                    {selectedCandidate?.name} is currently a {selectedCandidate?.role || 'user'}, not a partner.
                  </Text>
                  <Text fontSize="sm" color="orange.700">
                    Saving will elevate their role to <b>partner</b> across the platform (users + profiles), then assign them to this organization.
                  </Text>
                  <Checkbox
                    colorScheme="purple"
                    isChecked={grantPartnerAccess}
                    onChange={(e) => setGrantPartnerAccess(e.target.checked)}
                  >
                    <Text fontSize="sm">Grant partner access to {selectedCandidate?.name}</Text>
                  </Checkbox>
                </Stack>
              </Box>
            ) : null}
            {organization && (
              <Stack spacing={1} fontSize="sm" color="gray.600">
                <Text>
                  Current partner:{' '}
                  {partners.find((item) => item.id === (organization.partnerId || organization.transformationPartnerId))
                    ?.name || 'Unassigned'}
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
