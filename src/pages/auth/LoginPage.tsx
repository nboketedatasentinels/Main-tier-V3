import React, { useCallback, useEffect, useState } from 'react'
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
import { UserRole } from '@/types'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(false)

  const { signIn, signInWithMagicLink, profile, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const getDashboardPath = useCallback(() => {
    switch (profile?.role) {
      case UserRole.PAID_MEMBER:
        return '/app/dashboard/member'
      case UserRole.MENTOR:
        return '/mentor/dashboard'
      case UserRole.AMBASSADOR:
        return '/app/dashboard/ambassador'
      case UserRole.COMPANY_ADMIN:
        return '/app/dashboard/company-admin'
      case UserRole.SUPER_ADMIN:
        return '/app/dashboard/super-admin'
      default:
        return '/app/dashboard/free'
    }
  }, [profile?.role])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      toast({
        title: 'Login failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } else {
      toast({
        title: 'Welcome back!',
        status: 'success',
        duration: 3000,
      })
      setPendingNavigation(true)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!pendingNavigation && user && profile && !authLoading) {
      setPendingNavigation(true)
    }
  }, [authLoading, pendingNavigation, profile, user])

  useEffect(() => {
    if (!pendingNavigation || authLoading || !profile) return

    if (!profile.isOnboarded) {
      navigate('/app/onboarding', { replace: true })
      return
    }

    if (!profile.dashboardTourCompleted) {
      navigate(`${getDashboardPath()}?firstVisit=true`, { replace: true })
      return
    }

    navigate(getDashboardPath(), { replace: true })
  }, [authLoading, getDashboardPath, navigate, pendingNavigation, profile])

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
          isLoading={loading}
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
