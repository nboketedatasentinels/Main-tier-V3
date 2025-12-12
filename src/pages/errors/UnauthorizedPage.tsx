import React from 'react'
import { Box, Heading, Text, Button, VStack, Alert, AlertIcon } from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as {
    reason?: string
    rawRole?: unknown
  }

  const getMessage = () => {
    if (state.reason === 'missing-role') {
      return "We couldn't confirm your role. Please verify your account details or contact support."
    }

    if (state.reason === 'role-mismatch') {
      return 'Your account role does not allow access to this area.'
    }

    return "You don't have permission to access this page."
  }

  return (
    <Box minH="100vh" bg="brand.deepPlum" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box textAlign="center" maxW="lg">
        <Heading size="2xl" color="brand.flameOrange" mb={4}>Access Denied</Heading>
        <VStack spacing={4} align="center">
          <Text color="brand.softGold">{getMessage()}</Text>
          {state.rawRole !== undefined && (
            <Alert status="warning" variant="subtle" bg="orange.900" color="brand.gold" rounded="md">
              <AlertIcon />
              Detected role value: {String(state.rawRole || 'none')}
            </Alert>
          )}
          <Text color="brand.subtleText" fontSize="sm">
            If you believe this is a mistake, please reach out to support with your registered email.
          </Text>
          <Button variant="primary" onClick={() => navigate('/')}>Go Home</Button>
        </VStack>
      </Box>
    </Box>
  )
}
