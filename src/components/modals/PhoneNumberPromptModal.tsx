import React, { useState } from 'react'
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useToast,
  VStack,
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { normalizePhoneNumber, isValidPhoneNumber } from '@/utils/phoneNumber'

interface PhoneNumberPromptModalProps {
  isOpen: boolean
  onComplete: () => void
}

export const PhoneNumberPromptModal: React.FC<PhoneNumberPromptModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const toast = useToast()
  const { user, updateProfile } = useAuth()

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    const normalized = normalizePhoneNumber(phone)

    if (!normalized) {
      setError('Phone number is required.')
      return
    }
    if (!isValidPhoneNumber(normalized)) {
      setError('Please enter a valid phone number (e.g. +27 81 234 5678).')
      return
    }
    if (!user?.uid || !user.email) {
      setError('You must be logged in.')
      return
    }

    setLoading(true)

    try {
      // Persist via the auth layer (Supabase profiles row). updateProfile also
      // updates local profile state, so the login redirect proceeds.
      const { error: saveError } = await updateProfile({ phoneNumber: normalized })
      if (saveError) {
        setError(saveError.message || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      toast({
        title: 'Phone number saved',
        description: 'Your account is now fully set up.',
        status: 'success',
        duration: 4000,
      })

      onComplete()
    } catch (err) {
      console.error('🔴 [PhonePrompt] Failed to save phone number', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => {}} closeOnOverlayClick={false} closeOnEsc={false} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Complete Your Profile</ModalHeader>
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" color="text.secondary">
              A phone number is required to keep your account consistent across all T4L platforms.
              This ensures your impact logs and data stay linked to you everywhere.
            </Text>

            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <FormControl isRequired>
              <FormLabel>Phone Number</FormLabel>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+27 81 234 5678"
                autoComplete="tel"
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={loading}
            loadingText="Saving..."
            w="full"
          >
            Save & Continue
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
