import React from 'react'
import { Box, Heading, Text, Stack, SimpleGrid, Avatar, HStack, Tag } from '@chakra-ui/react'

const peers = [
  { name: 'Alex', match: '92%' },
  { name: 'Jordan', match: '87%' },
  { name: 'Sam', match: '85%' },
]

export const PeerConnectPage: React.FC = () => {
  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Heading size="md" mb={2} color="brand.text">
          Peer Connect
        </Heading>
        <Text color="brand.subtleText">
          Find peers to collaborate with based on interests and goals. Connection workflows will surface here.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        {peers.map(peer => (
          <Box key={peer.name} p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="brand.border">
            <HStack spacing={3} mb={2}>
              <Avatar name={peer.name} size="sm" />
              <Text fontWeight="semibold" color="brand.text">
                {peer.name}
              </Text>
            </HStack>
            <Tag colorScheme="purple" variant="subtle">
              Match {peer.match}
            </Tag>
          </Box>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
