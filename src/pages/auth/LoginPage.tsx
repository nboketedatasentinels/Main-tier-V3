import React, { useState } from 'react'
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
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { UserProfile, AccountStatus } from '@/types'
import { getLandingPathForRole } from '@/utils/roleRouting'
import { PasswordChangeModal } from '@/components/PasswordChangeModal'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const { signIn, signInWithMagicLink } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const handlePostLoginRedirect = async (uid: string) => {
    try {
      // Fetch user profile from Firestore
      const profileRef = doc(db, 'profiles', uid)
      const profileSnap = await getDoc(profileRef)

      if (!profileSnap.exists()) {
        navigate('/auth/profile-missing', { replace: true })
        return
      }

      const userData = profileSnap.data() as UserProfile

      // Check account status first
      const accountStatus = userData.accountStatus?.toString().toLowerCase()
      if (accountStatus === AccountStatus.INACTIVE || accountStatus === 'inactive') {
        toast({
          title: 'Account Inactive',
          description: 'Your account is inactive. Please contact support.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        navigate('/login', { replace: true })
        return
      }

      if (accountStatus === AccountStatus.SUSPENDED || accountStatus === 'suspended') {
        toast({
          title: 'Account Suspended',
          description: 'Your account has been suspended. Please contact support.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
        navigate('/suspended', { replace: true })
        return
      }

      // Check if password change is required
      if (userData.mustChangePassword) {
        setUserId(uid)
        setProfileData(userData)
        setShowPasswordChangeModal(true)
        return
      }

      // Check for redirectUrl query parameter (payment flows, external redirects)
      const redirectUrl = searchParams.get('redirectUrl')
      
      // Check for onboarding completion
      const needsOnboarding = !userData.onboardingComplete && !userData.onboardingSkipped
      if (needsOnboarding && !redirectUrl) {
        navigate('/welcome', { replace: true })
        return
      }

      // Determine landing path based on role and profile
      const landingPath = getLandingPathForRole(userData.role, userData, redirectUrl || undefined)
      
      navigate(landingPath, { replace: true })
    } catch (error) {
      console.error('Error during post-login redirect:', error)
      toast({
        title: 'Error',
        description: 'An error occurred. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

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

      // Get the current user ID and handle post-login redirect
      const user = (await import('@/services/firebase')).auth.currentUser
      if (user) {
        await handlePostLoginRedirect(user.uid)
      }
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

  const handlePasswordChangeSuccess = () => {
    if (profileData && userId) {
      // Continue with redirect after password change
      const redirectUrl = searchParams.get('redirectUrl')
      const landingPath = getLandingPathForRole(profileData.role, profileData, redirectUrl || undefined)
      navigate(landingPath, { replace: true })
    }
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
            <Link
              as={RouterLink}
              to="/reset-password"
              color="brand.flameOrange"
              fontSize="sm"
            >
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

      {userId && (
        <PasswordChangeModal
          isOpen={showPasswordChangeModal}
          onClose={() => setShowPasswordChangeModal(false)}
          userId={userId}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}
    </>
  )
}
