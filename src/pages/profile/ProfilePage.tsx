import React from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'

export const ProfilePage: React.FC = () => {
  return (
    <Box>
      <Heading mb={6} color="brand.gold">Profile</Heading>
      <Text color="brand.softGold">Manage your profile and achievements.</Text>
    </Box>
  )
}
