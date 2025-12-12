import React from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'

export const LeaderboardPage: React.FC = () => {
  return (
    <Box>
      <Heading mb={6} color="brand.text">Leaderboard</Heading>
      <Text color="brand.subtleText">See how you rank among your peers.</Text>
    </Box>
  )
}
