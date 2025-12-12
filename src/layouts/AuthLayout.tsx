import React from 'react'
import { Box, Flex, VStack, Text, Container } from '@chakra-ui/react'

interface AuthLayoutProps {
  children: React.ReactNode
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <Flex
      minH="100vh"
      className="gradient-hero"
      align="center"
      justify="center"
      p={4}
    >
      <Container maxW="md">
        <VStack spacing={8} align="stretch">
          {/* Logo */}
          <Box textAlign="center">
            <Text fontSize="4xl" fontWeight="bold" color="white" mb={2}>
              T4L
            </Text>
            <Text fontSize="lg" color="white">
              Transformation 4 Leaders
            </Text>
          </Box>

          {/* Auth Form */}
          <Box
            bg="brand.deepPlum"
            p={8}
            borderRadius="xl"
            border="2px solid"
            borderColor="brand.gold"
            boxShadow="2xl"
          >
            {children}
          </Box>

          {/* Footer */}
          <Text textAlign="center" fontSize="sm" color="white">
            © 2024 T4L. All rights reserved.
          </Text>
        </VStack>
      </Container>
    </Flex>
  )
}
