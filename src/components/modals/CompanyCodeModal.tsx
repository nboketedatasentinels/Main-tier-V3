import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
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
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { CheckCircle, XCircle } from 'lucide-react'
import { claimOrganizationCode } from '@/services/supabaseOrgService'
import { useAuth } from '@/hooks/useAuth'
import { useCompanyCodeValidation } from '@/hooks/useCompanyCodeValidation'
import { getCompanyCodeSignupBlocker } from '@/utils/companyCodeSignupGate'

interface CompanyCodeModalProps {
  isOpen: boolean
  onClose: () => void
  onSkip?: () => void
  onSuccess?: () => void
}

export const CompanyCodeModal: React.FC<CompanyCodeModalProps> = ({
  isOpen,
  onClose,
  onSkip,
  onSuccess,
}) => {
  const toast = useToast()
  const { updateProfile, refreshProfile, profile } = useAuth()
  const [companyCode, setCompanyCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const trimmedCode = useMemo(() => companyCode.trim().toUpperCase(), [companyCode])
  const {
    isChecking: isCheckingCode,
    isValid: companyCodeValid,
    error: companyCodeError,
    organization,
  } = useCompanyCodeValidation(trimmedCode)

  const companyName = organization?.name ?? null
  const companyId = organization?.id ?? null

  const handleSubmit = async () => {
    const blocker = getCompanyCodeSignupBlocker({
      code: trimmedCode,
      isChecking: isCheckingCode,
      isValid: companyCodeValid,
      error: companyCodeError,
    })
    if (blocker) {
      toast({
        title: isCheckingCode ? 'Still verifying' : 'Company code required',
        description: blocker,
        status: isCheckingCode ? 'info' : 'error',
        duration: 4000,
      })
      return
    }

    setIsSubmitting(true)

    // Enroll through the server-side RPC. It binds the user to the org and sets
    // the org's journey + paid_member role. The role column can't be written by
    // client code (revoked in 0012), so this must NOT go through updateProfile.
    const claim = await claimOrganizationCode(trimmedCode)
    if (!claim.ok) {
      setIsSubmitting(false)
      const friendly =
        claim.error === 'code_not_found'
          ? 'Company code not found.'
          : claim.error === 'org_inactive'
            ? 'This company is not active.'
            : claim.error || 'Unable to apply company code.'
      toast({ title: 'Unable to apply company code', description: friendly, status: 'error', duration: 5000 })
      return
    }

    const claimedOrgId = claim.organizationId ?? companyId ?? undefined
    const claimedOrgName = claim.organizationName ?? companyName
    const nextAssignedOrganizations = claimedOrgId
      ? Array.from(
          new Set([
            ...((profile?.assignedOrganizations || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
            claimedOrgId,
          ]),
        )
      : profile?.assignedOrganizations

    // Non-privileged extras (data jsonb): record the org in the user's list and
    // unlock the paid experience. Role/journey/membership were set by the RPC.
    const { error } = await updateProfile({
      ...(claimedOrgId ? { assignedOrganizations: nextAssignedOrganizations } : {}),
      dashboardPreferences: {
        ...(profile?.dashboardPreferences ?? {}),
        lockedToFreeExperience: false,
      },
    })
    setIsSubmitting(false)

    if (error) {
      toast({
        title: 'Unable to apply company code',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
      return
    }

    await refreshProfile({ reason: 'company-code-upgrade' })

    toast({
      title: 'You are now a paid member',
      description: claimedOrgName
        ? `Connected to ${claimedOrgName}. Your membership has been upgraded.`
        : 'Company code saved successfully. Your membership has been upgraded.',
      status: 'success',
      duration: 4000,
    })

    onSuccess?.()
    onClose()
  }

  const handleSkip = () => {
    onSkip?.()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} motionPreset="slideInBottom" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add your company code</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Text color="gray.600">
              Add your company code to unlock corporate perks. You can skip now and add it later in profile settings.
            </Text>
            <FormControl>
              <FormLabel>Company Code</FormLabel>
              <Input
                value={companyCode}
                onChange={(event) => setCompanyCode(event.target.value.toUpperCase().slice(0, 6))}
                placeholder="Enter 6-character code"
              />
            </FormControl>
            {companyCodeValid && companyName && !isCheckingCode && (
              <Box bg="green.50" border="1px solid" borderColor="green.100" p={3} rounded="md">
                <HStack spacing={2} color="green.600">
                  <CheckCircle size={18} />
                  <Text fontSize="sm">Valid company code ({companyName})</Text>
                </HStack>
              </Box>
            )}
            {companyCodeValid === false && !isCheckingCode && (
              <Box bg="red.50" border="1px solid" borderColor="red.100" p={3} rounded="md">
                <HStack spacing={2} color="red.600">
                  <XCircle size={18} />
                  <Text fontSize="sm">{companyCodeError || 'Invalid or inactive company code'}</Text>
                </HStack>
              </Box>
            )}
            {isCheckingCode && (
              <Text fontSize="sm" color="gray.500">
                Checking company code...
              </Text>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
            <Button onClick={handleSubmit} isLoading={isSubmitting} loadingText="Saving">
              Save code
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
