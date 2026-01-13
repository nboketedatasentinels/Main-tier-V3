import React from 'react'
import { Box, Heading, Text, Button } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <Box minH="100vh" bg="brand.accent" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box textAlign="center">
        <Heading size="2xl" color="brand.primary" mb={4}>Access Denied</Heading>
        <Text color="brand.subtleText" mb={8}>You don't have permission to access this page.</Text>
        <Button variant="primary" onClick={() => navigate('/')}>Go Home</Button>
      </Box>
    </Box>
  )
}
