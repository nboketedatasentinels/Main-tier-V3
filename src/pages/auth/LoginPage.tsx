import React, { useEffect, useState } from 'react'
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
  Divider,
  HStack,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { getDashboardPathForRole } from '@/utils/dashboardPaths'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const { signIn, signInWithMagicLink, user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [redirecting, setRedirecting] = useState(false)

  // Redirect if the user is already authenticated and we know their profile
  useEffect(() => {
    if (authLoading || !user) return

    const dashboardPath = getDashboardPathForRole(profile?.role) ?? '/unauthorized'
    navigate(dashboardPath, { replace: true })
    setRedirecting(true)
  }, [authLoading, navigate, profile?.role, user])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await signIn(email, password)

      if (error) {
        toast({
          title: 'Login failed',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        return
      }

      toast({
        title: 'Welcome back!',
        status: 'success',
        duration: 3000,
      })

      // Let the authenticated app redirect decide the correct dashboard once the profile is loaded
      const dashboardPath = getDashboardPathForRole(profile?.role) ?? '/unauthorized'
      navigate(dashboardPath, { replace: true })
      setRedirecting(true)
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    setLoading(true)
    const { error } = await signInWithMagicLink(email)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
      })
    } else {
      setMagicLinkSent(true)
      toast({
        title: 'Check your email',
        description: 'We sent you a magic link to sign in',
        status: 'success',
        duration: 5000,
      })
    }

    setLoading(false)
  }

  if (magicLinkSent) {
    return (
      <VStack spacing={6}>
        <Text fontSize="2xl" fontWeight="bold" color="brand.gold">
          Check Your Email
        </Text>
        <Text color="brand.softGold" textAlign="center">
          We've sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
        </Text>
        <Button
          variant="ghost"
          onClick={() => setMagicLinkSent(false)}
        >
          Back to Login
        </Button>
      </VStack>
    )
  }

  return (
    <form onSubmit={handleLogin}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="2xl" fontWeight="bold" color="brand.gold" textAlign="center">
          Sign In
        </Text>

        <FormControl isRequired>
          <FormLabel color="brand.softGold">Email</FormLabel>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            bg="rgba(53, 14, 111, 0.3)"
            borderColor="brand.gold"
            color="brand.softGold"
            _placeholder={{ color: 'rgba(249, 219, 89, 0.5)' }}
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel color="brand.softGold">Password</FormLabel>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            bg="rgba(53, 14, 111, 0.3)"
            borderColor="brand.gold"
            color="brand.softGold"
          />
        </FormControl>

        <Button
          type="submit"
          variant="primary"
          isLoading={loading || redirecting}
          loadingText="Signing in..."
          size="lg"
        >
          Sign In
        </Button>

        <HStack>
          <Divider borderColor="rgba(234, 177, 48, 0.3)" />
          <Text fontSize="sm" color="brand.softGold" whiteSpace="nowrap">
            OR
          </Text>
          <Divider borderColor="rgba(234, 177, 48, 0.3)" />
        </HStack>

        <Button
          variant="secondary"
          onClick={handleMagicLink}
          isLoading={loading}
          size="lg"
        >
          Send Magic Link
        </Button>

        <VStack spacing={2}>
          <Link
            as={RouterLink}
            to="/reset-password"
            color="brand.flameOrange"
            fontSize="sm"
          >
            Forgot password?
          </Link>
          <Text color="brand.softGold" fontSize="sm">
            Don't have an account?{' '}
            <Link as={RouterLink} to="/signup" color="brand.flameOrange" fontWeight="semibold">
              Sign Up
            </Link>
          </Text>
        </VStack>
      </VStack>
    </form>
  )
}
