import { useEffect, useMemo, useState } from 'react'
import { Alert, AlertIcon, Box, Button, Divider, HStack, Progress, Text, VStack } from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const formatTimestamp = (timestamp?: string | null) => {
  if (!timestamp) return 'Not yet recorded'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Not yet recorded'
  return date.toLocaleString()
}

const resolveGuidance = (errorMessage: string | null, isOffline: boolean) => {
  if (isOffline) {
    return {
      title: 'You appear to be offline',
      message: 'Check your connection and try again.',
    }
  }
  if (!errorMessage) {
    return {
      title: 'We are still trying to load your profile',
      message: 'Please retry in a moment, or sign out and back in.',
    }
  }
  if (/permission|denied|unauthorized|insufficient|forbidden/i.test(errorMessage)) {
    return {
      title: 'Permission issue detected',
      message: 'We do not have permission to load your profile. Please contact support or sign in again.',
    }
  }
  if (/timeout|deadline|timed out|time out/i.test(errorMessage)) {
    return {
      title: 'Profile request timed out',
      message: 'The request took too long. Please retry in a moment.',
    }
  }
  if (/network|unavailable/i.test(errorMessage)) {
    return {
      title: 'Network issue detected',
      message: 'Check your connection and try again.',
    }
  }
  return {
    title: 'We could not load your profile',
    message: 'Please retry, or sign out and back in.',
  }
}

export const ProfileMissingPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshProfile, profileLoading, profileError, lastProfileLoadAt, signOut, profile } = useAuth()
  const [retrying, setRetrying] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const errorMessage =
    typeof location.state === 'object' && location.state && 'error' in location.state
      ? String((location.state as { error?: string }).error || '')
      : ''
  const resolvedErrorMessage = profileError?.message || errorMessage || null
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false
  const guidance = useMemo(() => resolveGuidance(resolvedErrorMessage, isOffline), [resolvedErrorMessage, isOffline])

  useEffect(() => {
    if (profile && !profileLoading) {
      navigate('/app', { replace: true })
    }
  }, [navigate, profile, profileLoading])

  const handleRetry = async () => {
    if (profileLoading || retrying) return
    setRetrying(true)
    const { error, profile: refreshedProfile } = await refreshProfile({
      reason: 'profile-missing-manual',
      isManual: true,
    })
    if (!error && refreshedProfile) {
      navigate('/app', { replace: true })
    }
    setRetrying(false)
  }

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
  }

  return (
    <VStack spacing={6} align="stretch">
      <Text fontSize="2xl" fontWeight="bold" color="white" textAlign="center">
        We couldn't load your profile
      </Text>
      <Text color="white" textAlign="center">
        Your account is signed in, but we couldn't retrieve your profile details. We’ll keep trying while you can retry
        manually or sign out and log back in.
      </Text>

      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="semibold" color="gray.800">
            {guidance.title}
          </Text>
          <Text color="gray.700" fontSize="sm">
            {guidance.message}
          </Text>
        </Box>
      </Alert>

      {(profileLoading || retrying) && (
        <Box>
          <HStack spacing={3} mb={2}>
            <Text color="white" fontSize="sm">
              Refreshing your profile…
            </Text>
            <Progress flex="1" size="xs" isIndeterminate colorScheme="yellow" borderRadius="full" />
          </HStack>
        </Box>
      )}

      {resolvedErrorMessage ? (
        <Text color="white" textAlign="center" fontSize="sm" opacity={0.85}>
          Details: {resolvedErrorMessage}
        </Text>
      ) : null}

      <Text color="whiteAlpha.800" textAlign="center" fontSize="sm">
        Last successful profile load: {formatTimestamp(lastProfileLoadAt)}
      </Text>

      <Button
        variant="primary"
        onClick={handleRetry}
        size="lg"
        isLoading={retrying}
        loadingText="Retrying..."
        isDisabled={profileLoading || retrying}
      >
        Retry
      </Button>

      <Divider borderColor="whiteAlpha.300" />

      <Button
        variant="secondary"
        onClick={handleSignOut}
        size="lg"
        isLoading={signingOut}
        loadingText="Signing out..."
      >
        Sign out and try again
      </Button>
      <Button variant="ghost" onClick={() => navigate('/login', { replace: true })} size="lg">
        Back to Login
      </Button>
    </VStack>
  )
}
