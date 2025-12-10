import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@chakra-ui/react'
import T4LAuthScreen from '@/components/ui/T4LAuthCard'
import { useAuth } from '@/hooks/useAuth'
import { getDashboardRouteForRole, mapFirebaseAuthError, splitFullName } from '@/utils/auth'

export const SignUpPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const { signUp, signInWithGoogle, profile, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (authLoading) return

    if (user && profile) {
      const destination = profile.isOnboarded
        ? getDashboardRouteForRole(profile.role)
        : '/onboarding'
      navigate(destination, { replace: true })
    } else if (user && !profile) {
      navigate('/onboarding', { replace: true })
    }
  }, [authLoading, navigate, profile, user])

  const handleEmailSignUp = async (values: { email: string; password?: string; fullName?: string }) => {
    setServerError(null)
    setLoading(true)
    const { firstName, lastName, fullName } = splitFullName(values.fullName || '')
    const { error } = await signUp(values.email, values.password || '', {
      firstName: firstName || 'User',
      lastName,
      fullName: fullName || `${firstName} ${lastName}`.trim(),
    })
    setLoading(false)

    if (error) {
      const friendlyMessage = mapFirebaseAuthError((error as { code?: string }).code)
      setServerError(friendlyMessage)
      toast({
        title: 'Sign up failed',
        description: friendlyMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return { error: friendlyMessage }
    }

    toast({
      title: 'Account created!',
      description: 'Welcome to T4L. Let’s finish setting up your profile.',
      status: 'success',
      duration: 5000,
    })

    navigate('/onboarding', { replace: true })
    return { error: undefined }
  }

  const handleGoogleSignUp = async () => {
    setServerError(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    setGoogleLoading(false)

    if (error) {
      const friendlyMessage = mapFirebaseAuthError((error as { code?: string }).code)
      setServerError(friendlyMessage)
      toast({
        title: 'Google sign-in failed',
        description: friendlyMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return { error: friendlyMessage }
    }

    toast({
      title: 'Signed in with Google',
      description: 'Welcome to T4L! Let’s get you onboarded.',
      status: 'success',
      duration: 4000,
    })

    navigate('/onboarding', { replace: true })
    return { error: undefined }
  }

  return (
    <T4LAuthScreen
      mode="signup"
      loading={loading || googleLoading}
      serverError={serverError}
      onSubmit={handleEmailSignUp}
      onGoogleClick={handleGoogleSignUp}
      onNavigateToSignIn={() => navigate('/login')}
    />
  )
}
