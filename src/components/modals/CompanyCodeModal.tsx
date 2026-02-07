import React, { useEffect, useMemo, useState } from 'react'
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
import { incrementOrganizationMemberCount, validateCompanyCode } from '@/services/organizationService'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier, UserRole } from '@/types'
import { normalizeRole } from '@/utils/role'

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
  const [companyCodeValid, setCompanyCodeValid] = useState<boolean | null>(null)
  const [companyCodeError, setCompanyCodeError] = useState<string | null>(null)
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  const trimmedCode = useMemo(() => companyCode.trim().toUpperCase(), [companyCode])

  useEffect(() => {
    if (!trimmedCode) {
      setCompanyCodeValid(null)
      setCompanyCodeError(null)
      setCompanyName(null)
      setCompanyId(null)
      setIsCheckingCode(false)
      return
    }

    if (trimmedCode.length !== 6) {
      setCompanyCodeValid(null)
      setCompanyCodeError(null)
      setCompanyName(null)
      setCompanyId(null)
      setIsCheckingCode(false)
      return
    }

    let cancelled = false
    setIsCheckingCode(true)

    validateCompanyCode(trimmedCode).then((result) => {
      if (cancelled) return
      setCompanyCodeValid(result.valid)
      setCompanyCodeError(result.error ?? null)
      setCompanyName(result.valid && result.organization ? result.organization.name : null)
      setCompanyId(result.valid && result.organization ? result.organization.id : null)
      setIsCheckingCode(false)
    })

    return () => {
      cancelled = true
    }
  }, [trimmedCode])

  const handleSubmit = async () => {
    if (!trimmedCode) {
      toast({
        title: 'Company code required',
        description: 'Enter your 6-character company code to continue.',
        status: 'warning',
        duration: 4000,
      })
      return
    }

    if (trimmedCode.length !== 6) {
      toast({
        title: 'Invalid company code',
        description: 'Company codes must be 6 characters.',
        status: 'error',
        duration: 4000,
      })
      return
    }

    if (companyCodeValid === false || isCheckingCode) {
      toast({
        title: 'Company code not ready',
        description: companyCodeError || 'Please wait while we verify the company code.',
        status: 'error',
        duration: 4000,
      })
      return
    }

    setIsSubmitting(true)
    const shouldIncrementMemberCount = !!companyId && companyId !== profile?.companyId
    const nextAssignedOrganizations = companyId
      ? Array.from(
          new Set([
            ...((profile?.assignedOrganizations || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
            companyId,
          ]),
        )
      : profile?.assignedOrganizations
    const updatedPreferences = {
      ...(profile?.dashboardPreferences ?? {}),
      lockedToFreeExperience: false,
    }

    const normalizedCurrentRole = normalizeRole(profile?.role)
    const roleUpdates =
      normalizedCurrentRole === 'free_user' || normalizedCurrentRole === 'paid_member'
        ? { role: UserRole.USER }
        : {}

    const { error } = await updateProfile({
      companyCode: trimmedCode,
      companyId: companyId ?? undefined,
      companyName: companyName ?? undefined,
      ...(companyId ? { assignedOrganizations: nextAssignedOrganizations } : {}),
      ...roleUpdates,
      membershipStatus: 'paid',
      transformationTier: companyId ? TransformationTier.CORPORATE_MEMBER : TransformationTier.INDIVIDUAL_PAID,
      dashboardPreferences: updatedPreferences,
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

    if (companyId && shouldIncrementMemberCount) {
      try {
        await incrementOrganizationMemberCount(companyId)
      } catch (incrementError) {
        console.warn('🟠 [CompanyCodeModal] Unable to increment organization member count', incrementError)
      }
    }

    await refreshProfile({ reason: 'company-code-upgrade' })

    toast({
      title: 'You are now a paid member',
      description: companyName
        ? `Connected to ${companyName}. Your membership has been upgraded.`
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
