import React, { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  VStack,
  FormControl,
  FormLabel,
  Input,
  Button,
  Text,
  Link,
  useToast,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'

export const ResetPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  
  const { resetPassword } = useAuth()
  const toast = useToast()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await resetPassword(email)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    } else {
      setEmailSent(true)
      toast({
        title: 'Check your email',
        description: 'We sent you instructions to reset your password',
        status: 'success',
        duration: 5000,
      })
    }

    setLoading(false)
  }

  if (emailSent) {
    return (
      <VStack spacing={6}>
        <Text fontSize="2xl" fontWeight="bold" color="white">
          Check Your Email
        </Text>
        <Text color="white" textAlign="center">
          We've sent password reset instructions to <strong>{email}</strong>.
        </Text>
        <Link as={RouterLink} to="/login" color="brand.flameOrange">
          Back to Login
        </Link>
      </VStack>
    )
  }

  return (
    <form onSubmit={handleResetPassword}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="2xl" fontWeight="bold" color="white" textAlign="center">
          Reset Password
        </Text>

        <Text color="white" textAlign="center" fontSize="sm">
          Enter your email address and we'll send you instructions to reset your password.
        </Text>

        <FormControl isRequired>
          <FormLabel color="white">Email</FormLabel>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            bg="rgba(53, 14, 111, 0.3)"
            borderColor="brand.gold"
            color="white"
            _placeholder={{ color: 'rgba(255, 255, 255, 0.5)' }}
          />
        </FormControl>

        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
          loadingText="Sending..."
          size="lg"
        >
          Send Reset Link
        </Button>

        <Text color="white" fontSize="sm" textAlign="center">
          Remember your password?{' '}
          <Link as={RouterLink} to="/login" color="brand.flameOrange" fontWeight="semibold">
            Sign In
          </Link>
        </Text>
      </VStack>
    </form>
  )
}
