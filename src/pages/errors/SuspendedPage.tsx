import React from 'react'
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Button,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export const SuspendedPage: React.FC = () => {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <Container maxW="container.md" py={20}>
      <VStack spacing={8} align="center">
        <Box textAlign="center">
          <Heading size="2xl" mb={4} color="red.500">
            Account Suspended
          </Heading>
          <Text fontSize="lg" color="gray.600">
            Your account has been suspended. If you believe this is an error, please contact support.
          </Text>
        </Box>

        <VStack spacing={4} w="full" maxW="md">
          <Text fontSize="md" color="gray.700">
            Possible reasons for suspension:
          </Text>
          <Box as="ul" textAlign="left" pl={6}>
            <li>Violation of terms of service</li>
            <li>Suspicious activity detected</li>
            <li>Administrative action</li>
            <li>Payment issues</li>
          </Box>

          <Text fontSize="sm" color="gray.600" mt={4}>
            For assistance, please contact us at support@transformation4leaders.com
          </Text>

          <Button
            colorScheme="red"
            variant="outline"
            size="lg"
            w="full"
            onClick={handleSignOut}
            mt={8}
          >
            Sign Out
          </Button>
        </VStack>
      </VStack>
    </Container>
  )
}
