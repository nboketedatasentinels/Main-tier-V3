import { Button, Heading, Text, VStack } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export const ProfileMissingPage = () => {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <VStack spacing={6} align="center" textAlign="center">
      <Heading size="lg" color="white">
        We couldn't load your profile
      </Heading>
      <Text color="white" maxW="lg">
        Your account is signed in, but we couldn't find your profile information. Please try signing out and
        signing back in. If the issue persists, contact support so we can restore your access.
      </Text>
      <Button variant="primary" onClick={() => navigate('/login', { replace: true })}>
        Return to Login
      </Button>
      <Button variant="secondary" onClick={handleSignOut}>
        Sign Out
      </Button>
    </VStack>
  )
}

export default ProfileMissingPage
