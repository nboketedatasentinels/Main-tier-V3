import React from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'

export const OnboardingPage: React.FC = () => {
  return (
    <Box minH="100vh" bg="brand.deepPlum" p={8}>
      <Heading mb={6} color="brand.gold">Welcome to T4L!</Heading>
      <Text color="brand.softGold">Let's get you started on your transformation journey.</Text>
    </Box>
  )
}
