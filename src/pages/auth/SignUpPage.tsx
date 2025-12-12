import React, { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  VStack,
  FormControl,
  FormLabel,
  Input,
  Button,
  Text,
  Link,
  useToast,
  HStack,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'

export const SignUpPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  })
  const [loading, setLoading] = useState(false)
  
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Passwords do not match',
        status: 'error',
        duration: 3000,
      })
      return
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setLoading(true)

    const { error, userId } = await signUp(formData.email, formData.password, {
      firstName: formData.firstName,
      lastName: formData.lastName,
      fullName: `${formData.firstName} ${formData.lastName}`,
    })

    if (error) {
      toast({
        title: 'Sign up failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    } else {
      toast({
        title: 'Account created!',
        description: 'Redirecting you to your dashboard to begin exploring.',
        status: 'success',
        duration: 5000,
      })
      if (userId) {
        localStorage.setItem(`t4l.newUserWelcome.${userId}`, 'pending')
      }
      navigate('/app/dashboard/free')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSignUp}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="2xl" fontWeight="bold" color="white" textAlign="center">
          Create Account
        </Text>

        <HStack spacing={4}>
          <FormControl isRequired>
            <FormLabel color="white">First Name</FormLabel>
            <Input
              value={formData.firstName}
              onChange={e => handleChange('firstName', e.target.value)}
              placeholder="John"
              bg="rgba(53, 14, 111, 0.3)"
              borderColor="brand.gold"
              color="white"
              _placeholder={{ color: 'rgba(255, 255, 255, 0.5)' }}
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel color="white">Last Name</FormLabel>
            <Input
              value={formData.lastName}
              onChange={e => handleChange('lastName', e.target.value)}
              placeholder="Doe"
              bg="rgba(53, 14, 111, 0.3)"
              borderColor="brand.gold"
              color="white"
              _placeholder={{ color: 'rgba(255, 255, 255, 0.5)' }}
            />
          </FormControl>
        </HStack>

        <FormControl isRequired>
          <FormLabel color="white">Email</FormLabel>
          <Input
            type="email"
            value={formData.email}
            onChange={e => handleChange('email', e.target.value)}
            placeholder="your@email.com"
            bg="rgba(53, 14, 111, 0.3)"
            borderColor="brand.gold"
            color="white"
            _placeholder={{ color: 'rgba(255, 255, 255, 0.5)' }}
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel color="white">Password</FormLabel>
          <Input
            type="password"
            value={formData.password}
            onChange={e => handleChange('password', e.target.value)}
            placeholder="••••••••"
            bg="rgba(53, 14, 111, 0.3)"
            borderColor="brand.gold"
            color="white"
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel color="white">Confirm Password</FormLabel>
          <Input
            type="password"
            value={formData.confirmPassword}
            onChange={e => handleChange('confirmPassword', e.target.value)}
            placeholder="••••••••"
            bg="rgba(53, 14, 111, 0.3)"
            borderColor="brand.gold"
            color="white"
          />
        </FormControl>

        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
          loadingText="Creating account..."
          size="lg"
        >
          Sign Up
        </Button>

        <Text color="white" fontSize="sm" textAlign="center">
          Already have an account?{' '}
          <Link as={RouterLink} to="/login" color="brand.flameOrange" fontWeight="semibold">
            Sign In
          </Link>
        </Text>
      </VStack>
    </form>
  )
}
