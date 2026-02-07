import React, { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  FormErrorMessage,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react'

interface AccountLinkingModalProps {
  isOpen: boolean
  onClose: () => void
  email: string
  onLinkAccount: (password: string) => Promise<{ error: Error | null }>
}

export const AccountLinkingModal: React.FC<AccountLinkingModalProps> = ({
  isOpen,
  onClose,
  email,
  onLinkAccount,
}) => {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLink = async () => {
    setError('')

    if (!password) {
      setError('Please enter your password')
      return
    }

    setLoading(true)

    try {
      const result = await onLinkAccount(password)
      if (result.error) {
        setError(result.error.message)
      } else {
        setPassword('')
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setPassword('')
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Link Your Google Account</ModalHeader>
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                An account already exists with <strong>{email}</strong> using email/password sign-in.
                Enter your password to link your Google account.
              </AlertDescription>
            </Alert>

            <Text fontSize="sm" color="gray.600">
              After linking, you can sign in with either Google or your password.
            </Text>

            <FormControl isInvalid={!!error}>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password) {
                    handleLink()
                  }
                }}
              />
              {error && <FormErrorMessage>{error}</FormErrorMessage>}
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorScheme="purple"
            onClick={handleLink}
            isLoading={loading}
            loadingText="Linking..."
            isDisabled={!password}
          >
            Link Accounts
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
