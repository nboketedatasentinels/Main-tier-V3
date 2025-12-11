import React, { useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { useCreateUpgradeRequest } from '@/hooks/useUpgradeRequests'
import { UpgradeRequestForm } from '@/types/upgrade'
import { useAuth } from '@/hooks/useAuth'

interface RequestUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

export const RequestUpgradeModal: React.FC<RequestUpgradeModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth()
  const toast = useToast()
  const { submit, loading, error, lastRequest } = useCreateUpgradeRequest(user?.uid)
  const [form, setForm] = useState<UpgradeRequestForm>({
    requestType: 'individual',
    requestedTier: 'Individual Monthly',
  })

  const formIsValid = useMemo(() => {
    return Boolean(form.requestType && form.requestedTier && form.contactPreference && form.contactDetails)
  }, [form])

  const handleSubmit = async () => {
    const created = await submit(form)
    if (created) {
      toast({
        title: "We'll respond within 24 hours",
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Request an Upgrade</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            {lastRequest && (
              <Alert status="success" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>Request received!</AlertTitle>
                  <AlertDescription>We'll respond within 24 hours.</AlertDescription>
                </Box>
              </Alert>
            )}
            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}
            <FormControl isRequired>
              <FormLabel>Preferred Plan</FormLabel>
              <Select
                value={form.requestedTier ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    requestedTier: e.target.value,
                    requestType: e.target.value === 'Corporate' ? 'corporate_approval' : 'individual',
                  }))
                }
              >
                <option>Individual Monthly</option>
                <option>Individual Annual</option>
                <option>Corporate</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Reason for Upgrade</FormLabel>
              <Textarea
                placeholder="Share what you're hoping to unlock"
                value={form.message ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Contact Preference</FormLabel>
              <Select
                placeholder="Select contact method"
                value={form.contactPreference ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    contactPreference: e.target.value as 'email' | 'phone',
                  }))
                }
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </Select>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Best Contact Details</FormLabel>
              <Input
                placeholder="Email or phone number"
                value={form.contactDetails ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, contactDetails: e.target.value }))}
              />
            </FormControl>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Maybe Later
          </Button>
          <Button colorScheme="purple" onClick={handleSubmit} isLoading={loading} isDisabled={!formIsValid}>
            Submit Request
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
