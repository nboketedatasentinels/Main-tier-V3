import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@chakra-ui/react'
import T4LAuthScreen from '@/components/ui/T4LAuthCard'
import { useAuth } from '@/hooks/useAuth'
import { getDashboardRouteForRole, mapFirebaseAuthError } from '@/utils/auth'

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const { signIn, signInWithGoogle, profile, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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

  const handlePostAuthNavigation = (fallback = '/onboarding') => {
    const fromState = (location.state as { from?: { pathname?: string } } | null)?.from
    if (fromState?.pathname) {
      navigate(fromState.pathname, { replace: true })
      return
    }

    if (profile) {
      navigate(profile.isOnboarded ? getDashboardRouteForRole(profile.role) : '/onboarding', {
        replace: true,
      })
      return
    }

    navigate(fallback, { replace: true })
  }

  const handleEmailSignIn = async (values: { email: string; password?: string }) => {
    setServerError(null)
    setLoading(true)
    const { error } = await signIn(values.email, values.password || '')
    setLoading(false)

    if (error) {
      const friendlyMessage = mapFirebaseAuthError((error as { code?: string }).code)
      setServerError(friendlyMessage)
      toast({
        title: 'Login failed',
        description: friendlyMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return { error: friendlyMessage }
    }

    toast({
      title: 'Welcome back!',
      status: 'success',
      duration: 3000,
    })

    handlePostAuthNavigation()
    return { error: undefined }
  }

  const handleGoogleSignIn = async () => {
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
      status: 'success',
      duration: 3000,
    })

    handlePostAuthNavigation()
    return { error: undefined }
  }

  return (
    <T4LAuthScreen
      mode="signin"
      loading={loading || googleLoading}
      serverError={serverError}
      onSubmit={handleEmailSignIn}
      onGoogleClick={handleGoogleSignIn}
      onNavigateToReset={() => navigate('/reset-password')}
      onNavigateToSignUp={() => navigate('/signup')}
    />
  )
}
