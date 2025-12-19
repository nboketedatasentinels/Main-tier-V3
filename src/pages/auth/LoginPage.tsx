import React, { useState, useEffect } from 'react'
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
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
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { PasswordChangeModal } from '@/components/PasswordChangeModal'
import { getLandingPathForRole } from '@/utils/roleRouting'

export const LoginPage: React.FC = () => {
  const { signIn, signInWithMagicLink, user, profile, profileLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false)
  const [profileTimeoutReached, setProfileTimeoutReached] = useState(false)
  const [refreshingProfile, setRefreshingProfile] = useState(false)

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

  useEffect(() => {
    if (!user || profile) {
      setProfileTimeoutReached(false)
      return
    }

    const timer = window.setTimeout(() => {
      console.warn('⏱️ LoginPage: Profile still missing after timeout, enabling manual refresh')
      setProfileTimeoutReached(true)
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [user, profile])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)

    console.log('🔴 LoginPage: handleLogin called', { email })

    try {
      console.log('🔴 LoginPage: Calling signIn...')
      const { error } = await signIn(email, password)
      console.log('🔴 LoginPage: signIn returned', { error: error?.message || null })

      if (error) {
        setError(error.message)
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

      console.log('🟢 LoginPage: Sign in successful, waiting for AuthContext profile load...')
      // Redirect will happen in the useEffect once profile is loaded
    } catch (err) {
      console.error('🔴 LoginPage: Exception in handleLogin', err)
      setError('Something went wrong while signing in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileRefresh = async () => {
    console.log('🔵 LoginPage: Manual profile refresh triggered')
    setRefreshingProfile(true)
    const { error } = await refreshProfile()
    if (error) {
      toast({
        title: 'Profile refresh failed',
        description: error.message,
        status: 'error',
        duration: 4000,
      })
    }
    setRefreshingProfile(false)
  }

  const handleMagicLink = async () => {
    setError(null)

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
    try {
      const { error } = await signInWithMagicLink(email.trim())
      if (error) {
        setError(error.message)
        return
      }

      setMagicLinkSent(true)
      toast({
        title: 'Check your email',
        description: 'We sent you a magic link to sign in',
        status: 'success',
        duration: 5000,
      })
    } catch (err) {
      console.error('🔴 LoginPage: Exception in handleMagicLink', err)
      setError('Unable to send the magic link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChangeSuccess = () => {
    setShowPasswordChangeModal(false)
  }

  if (magicLinkSent) {
    return (
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-600">
            We sent a magic sign-in link to {" "}
            <span className="font-semibold text-gray-900">{email}</span>.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-600">
              If you don’t see it in a few minutes, check your spam/junk folder.
            </div>

            <button
              type="button"
              onClick={() => setMagicLinkSent(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleLogin}>
        <VStack spacing={6} align="stretch">
          <Text fontSize="2xl" fontWeight="bold" color="white" textAlign="center">
            Sign In
          </Text>

          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
          )}

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

          {profileTimeoutReached && (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              We're still loading your profile. You can retry below.
            </Alert>
          )}

          {profileTimeoutReached && (
            <Button
              variant="secondary"
              onClick={handleProfileRefresh}
              isLoading={refreshingProfile}
              loadingText="Refreshing profile..."
              size="lg"
            >
              Retry profile load
            </Button>
          )}

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
