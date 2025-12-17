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
  useToast,
  FormErrorMessage,
} from '@chakra-ui/react'
import { updatePassword } from 'firebase/auth'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/services/firebase'

interface PasswordChangeModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  onSuccess: () => void
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const handlePasswordChange = async () => {
    setError('')

    // Validation
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const user = auth.currentUser
      if (!user) {
        throw new Error('No user logged in')
      }

      // Update password in Firebase Auth
      await updatePassword(user, newPassword)

      // Update mustChangePassword field in Firestore
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      })

      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully changed.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      onSuccess()
      onClose()
    } catch (err: unknown) {
      console.error('Error changing password:', err)

      let errorMessage = 'Failed to update password'
      const firebaseError = err as { code?: string }
      if (firebaseError?.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log in again to change your password'
      } else if (firebaseError?.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password'
      }
      
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => {}} closeOnOverlayClick={false} closeOnEsc={false}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Change Your Password</ModalHeader>
        <ModalBody>
          <VStack spacing={4}>
            <Text fontSize="sm" color="gray.600">
              For security reasons, you must change your password before continuing.
            </Text>

            <FormControl isInvalid={!!error}>
              <FormLabel>New Password</FormLabel>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </FormControl>

            <FormControl isInvalid={!!error}>
              <FormLabel>Confirm New Password</FormLabel>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              {error && <FormErrorMessage>{error}</FormErrorMessage>}
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="blue"
            onClick={handlePasswordChange}
            isLoading={loading}
            loadingText="Updating..."
            isDisabled={!newPassword || !confirmPassword}
          >
            Update Password
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
