import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  VStack,
  Text,
  Button,
  useToast,
  Spinner,
  Box,
  Icon,
} from '@chakra-ui/react'
import { applyActionCode } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/services/firebase'
import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons'

export const EmailVerificationPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyEmail = async () => {
      const mode = searchParams.get('mode')
      const oobCode = searchParams.get('oobCode')

      if (mode !== 'verifyEmail' || !oobCode) {
        setError('Invalid verification link')
        setLoading(false)
        return
      }

      try {
        // Apply the email verification code
        await applyActionCode(auth, oobCode)
        
        // Update the user document in Firestore if authenticated
        const currentUser = auth.currentUser
        if (currentUser) {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            emailVerified: true,
            updatedAt: new Date().toISOString(),
          })
        }

        toast({
          title: 'Email verified!',
          description: 'Your email has been successfully verified.',
          status: 'success',
          duration: 5000,
        })
      } catch (error: any) {
        console.error('Email verification error:', error)
        let errorMessage = 'Failed to verify email'
        
        if (error.code === 'auth/expired-action-code') {
          errorMessage = 'Verification link has expired'
        } else if (error.code === 'auth/invalid-action-code') {
          errorMessage = 'Invalid verification link'
        }
        
        setError(errorMessage)
        toast({
          title: 'Verification failed',
          description: errorMessage,
          status: 'error',
          duration: 5000,
        })
      } finally {
        setLoading(false)
      }
    }

    verifyEmail()
  }, [searchParams, toast])

  const handleContinue = () => {
    navigate('/app', { replace: true })
  }

  const handleResendVerification = () => {
    navigate('/login')
  }

  if (loading) {
    return (
      <VStack spacing={6} align="center" py={10}>
        <Spinner size="xl" color="brand.gold" />
        <Text color="white" fontSize="lg">
          Verifying your email...
        </Text>
      </VStack>
    )
  }

  if (error) {
    return (
      <VStack spacing={6} align="stretch" maxW="md" mx="auto" py={10}>
        <Box textAlign="center">
          <Icon as={WarningIcon} w={16} h={16} color="red.500" mb={4} />
          <Text fontSize="2xl" fontWeight="bold" color="white" mb={2}>
            Verification Failed
          </Text>
          <Text color="white" mb={6}>
            {error}
          </Text>
        </Box>
        
        <Button
          variant="primary"
          onClick={handleResendVerification}
          size="lg"
        >
          Return to Login
        </Button>
      </VStack>
    )
  }

  return (
    <VStack spacing={6} align="stretch" maxW="md" mx="auto" py={10}>
      <Box textAlign="center">
        <Icon as={CheckCircleIcon} w={16} h={16} color="green.500" mb={4} />
        <Text fontSize="2xl" fontWeight="bold" color="white" mb={2}>
          Email Verified!
        </Text>
        <Text color="white" mb={6}>
          Your email has been successfully verified. You can now access all features.
        </Text>
      </Box>
      
      <Button
        variant="primary"
        onClick={handleContinue}
        size="lg"
      >
        Continue to Dashboard
      </Button>
    </VStack>
  )
}
