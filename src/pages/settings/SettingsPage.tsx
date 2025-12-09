import React from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'

export const SettingsPage: React.FC = () => {
  return (
    <Box>
      <Heading mb={6} color="brand.gold">Settings</Heading>
      <Text color="brand.softGold">Manage your account settings and preferences.</Text>
    </Box>
  )
}
