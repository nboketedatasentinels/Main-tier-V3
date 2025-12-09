import React from 'react'
import { Box, Heading, Text, Button } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <Box minH="100vh" bg="brand.deepPlum" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box textAlign="center">
        <Heading size="4xl" color="brand.gold" mb={4}>404</Heading>
        <Heading size="xl" color="brand.softGold" mb={6}>Page Not Found</Heading>
        <Text color="brand.softGold" mb={8}>The page you're looking for doesn't exist.</Text>
        <Button variant="primary" onClick={() => navigate('/')}>Go Home</Button>
      </Box>
    </Box>
  )
}
