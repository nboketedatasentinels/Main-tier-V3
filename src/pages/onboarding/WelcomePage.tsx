import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Button,
  useToast,
} from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { getLandingPathForRole } from '@/utils/roleRouting'

export const WelcomePage: React.FC = () => {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = React.useState(false)

  const handleCompleteOnboarding = async () => {
    if (!user || !profile) return

    setLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      const profileRef = doc(db, 'profiles', user.uid)
      const updatedProfile = {
        ...profile,
        onboardingComplete: true,
        onboardingSkipped: false,
      }

      // Use setDoc with merge: true to create or update documents
      await Promise.all([
        setDoc(userRef, {
          onboardingComplete: true,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(profileRef, {
          onboardingComplete: true,
          onboardingSkipped: false,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
      ])

      toast({
        title: 'Welcome!',
        description: 'Your onboarding is complete.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      // Navigate to role-based landing page
      const landingPath = getLandingPathForRole(updatedProfile)
      navigate(landingPath, { replace: true })
    } catch (error) {
      console.error('Error completing onboarding:', error)
      toast({
        title: 'Error',
        description: 'Failed to complete onboarding. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSkipOnboarding = async () => {
    if (!user || !profile) return

    setLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      const profileRef = doc(db, 'profiles', user.uid)
      const updatedProfile = {
        ...profile,
        onboardingComplete: false,
        onboardingSkipped: true,
      }

      // Use setDoc with merge: true to create or update documents
      await Promise.all([
        setDoc(userRef, {
          onboardingSkipped: true,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(profileRef, {
          onboardingComplete: false,
          onboardingSkipped: true,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
      ])

      // Navigate to role-based landing page
      const landingPath = getLandingPathForRole(updatedProfile)
      navigate(landingPath, { replace: true })
    } catch (error) {
      console.error('Error skipping onboarding:', error)
      toast({
        title: 'Error',
        description: 'Failed to skip onboarding. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxW="container.md" py={20}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="2xl" mb={4}>
            Welcome to Transformation 4 Leaders! 🎉
          </Heading>
          <Text fontSize="lg" color="gray.600">
            Let's get you started on your transformation journey.
          </Text>
        </Box>

        <VStack spacing={6} py={8}>
          <Box p={6} borderWidth={1} borderRadius="lg" w="full">
            <Heading size="md" mb={2}>
              Step 1: Complete Your Profile
            </Heading>
            <Text color="gray.600">
              Add your personal information and preferences to get a personalized experience.
            </Text>
          </Box>

          <Box p={6} borderWidth={1} borderRadius="lg" w="full">
            <Heading size="md" mb={2}>
              Step 2: Choose Your Journey
            </Heading>
            <Text color="gray.600">
              Select a transformation journey that aligns with your goals and timeline.
            </Text>
          </Box>

          <Box p={6} borderWidth={1} borderRadius="lg" w="full">
            <Heading size="md" mb={2}>
              Step 3: Start Learning
            </Heading>
            <Text color="gray.600">
              Engage with content, track your progress, and connect with mentors and peers.
            </Text>
          </Box>
        </VStack>

        <VStack spacing={4}>
          <Button
            colorScheme="blue"
            size="lg"
            w="full"
            onClick={handleCompleteOnboarding}
            isLoading={loading}
          >
            Get Started
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipOnboarding}
            isDisabled={loading}
          >
            Skip for now
          </Button>
        </VStack>
      </VStack>
    </Container>
  )
}