import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Heading, Text } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { getDashboardRouteForRole } from '@/utils/auth'

export const OnboardingPage: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile?.isOnboarded) {
      navigate(getDashboardRouteForRole(profile.role), { replace: true })
    }
  }, [navigate, profile])

  return (
    <Box minH="100vh" bg="brand.deepPlum" p={8}>
      <Heading mb={6} color="brand.gold">Welcome to T4L!</Heading>
      <Text color="brand.softGold">Let's get you started on your transformation journey.</Text>
    </Box>
  )
}
