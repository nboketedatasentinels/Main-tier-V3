import React, { useState, useEffect } from 'react'
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom'
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
import { PasswordChangeModal } from '@/components/PasswordChangeModal'
import { getLandingPathForRole } from '@/utils/roleRouting'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false)

  const { signIn, signInWithMagicLink, user, profile, profileLoading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    console.log('🔵 LoginPage useEffect triggered:', {
      user: user ? { uid: user.uid, email: user.email } : null,
      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            fullName: profile.fullName,
            onboardingComplete: profile.onboardingComplete,
            onboardingSkipped: profile.onboardingSkipped,
            dashboardPreferences: profile.dashboardPreferences,
          }
        : null,
      profileLoading,
      condition: !profileLoading && !!user && !!profile,
    })

    if (profileLoading) return
    if (!user || !profile) return

    // ✅ Correct call signature: (profile, searchParams)
    const landingPath = getLandingPathForRole(profile, searchParams)

    console.log('🎯 LoginPage: Calculated landing path:', landingPath)

    // Avoid pointless redirects (and reduce loops)
    const currentPath = window.location.pathname
    if (currentPath === landingPath) {
      console.log('🟢 LoginPage: Already on landing path, no navigation needed.')
      return
    }

    console.log('🎯 LoginPage: Navigating to:', landingPath)
    navigate(landingPath, { replace: true })
  }, [user, profile, profileLoading, navigate, searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    console.log('🔴 LoginPage: handleLogin called', { email })

    try {
      console.log('🔴 LoginPage: Calling signIn...')
      const { error } = await signIn(email, password)
      console.log('🔴 LoginPage: signIn returned', { error: error?.message || null })

      if (error) {
        toast({
          title: 'Login failed',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        setLoading(false)
        return
      }

      toast({
        title: 'Welcome back!',
        status: 'success',
        duration: 3000,
      })

      console.log('🟢 LoginPage: Sign in successful, waiting for AuthContext profile load...')
      // Redirect will happen in the useEffect once profile is loaded
    } catch (err) {
      console.error('🔴 LoginPage: Exception in handleLogin', err)
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

  const handlePasswordChangeSuccess = () => {
    setShowPasswordChangeModal(false)
  }

  if (magicLinkSent) {
    return (
      <VStack spacing={6}>
        <Text fontSize="2xl" fontWeight="bold" color="white">
          Check Your Email
        </Text>
        <Text color="white" textAlign="center">
          We've sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
        </Text>
        <Button
          variant="ghost"
          onClick={() => setMagicLinkSent(false)}
          color="white"
          _hover={{ bg: 'whiteAlpha.200' }}
        >
          Back to Login
        </Button>
      </VStack>
    )
  }

  return (
    <>
      <form onSubmit={handleLogin}>
        <VStack spacing={6} align="stretch">
          <Text fontSize="2xl" fontWeight="bold" color="white" textAlign="center">
            Sign In
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

          <FormControl isRequired>
            <FormLabel color="white">Password</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
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
            loadingText="Signing in..."
            size="lg"
          >
            Sign In
          </Button>

          <HStack>
            <Divider borderColor="rgba(234, 177, 48, 0.3)" />
            <Text fontSize="sm" color="white" whiteSpace="nowrap">
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
            <Link as={RouterLink} to="/reset-password" color="brand.flameOrange" fontSize="sm">
              Forgot password?
            </Link>
            <Text color="white" fontSize="sm">
              Don't have an account?{' '}
              <Link as={RouterLink} to="/signup" color="brand.flameOrange" fontWeight="semibold">
                Sign Up
              </Link>
            </Text>
          </VStack>
        </VStack>
      </form>

      {user?.uid && (
        <PasswordChangeModal
          isOpen={showPasswordChangeModal}
          onClose={() => setShowPasswordChangeModal(false)}
          userId={user.uid}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}
    </>
  )
}
