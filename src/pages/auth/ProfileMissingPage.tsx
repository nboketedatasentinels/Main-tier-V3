import { Button, Text, VStack } from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'

export const ProfileMissingPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const errorMessage =
    typeof location.state === 'object' && location.state && 'error' in location.state
      ? String((location.state as { error?: string }).error || '')
      : ''

  return (
    <VStack spacing={6} align="stretch">
      <Text fontSize="2xl" fontWeight="bold" color="white" textAlign="center">
        We couldn't load your profile
      </Text>
      <Text color="white" textAlign="center">
        Your account is signed in, but we couldn't retrieve your profile details. This could be a temporary issue or a
        permissions problem. Please try again, or contact support if the issue persists.
      </Text>
      {errorMessage ? (
        <Text color="white" textAlign="center" fontSize="sm" opacity={0.85}>
          Details: {errorMessage}
        </Text>
      ) : null}
      <Button
        variant="primary"
        onClick={() => navigate('/app', { replace: true })}
        size="lg"
      >
        Retry
      </Button>
      <Button
        variant="secondary"
        onClick={() => navigate('/login', { replace: true })}
        size="lg"
      >
        Back to Login
      </Button>
    </VStack>
  )
}
