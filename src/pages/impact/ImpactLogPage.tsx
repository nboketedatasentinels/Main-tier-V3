import React from 'react'
import { Box, Button, Heading, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

export const ImpactLogPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <Box>
      <Heading mb={6} color="brand.gold">Impact Log</Heading>
      <Text color="brand.softGold">Track and visualize your leadership impact.</Text>
      <Button mt={8} variant="primary" onClick={() => navigate('/')}>Back to Homepage</Button>
    </Box>
  )
}
