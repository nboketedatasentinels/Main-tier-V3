import React from 'react'
import { Box, Heading, Text, Stack, SimpleGrid, Image } from '@chakra-ui/react'

export const BookClubPage: React.FC = () => {
  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Heading size="md" color="brand.text">
          Global Book Club
        </Heading>
        <Text color="brand.subtleText">Discover what the community is reading and join upcoming discussions.</Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="brand.border">
          <Heading size="sm" mb={2} color="brand.text">
            Current Book
          </Heading>
          <Image src="https://via.placeholder.com/400x220" alt="Book cover" borderRadius="md" mb={2} />
          <Text color="brand.subtleText">Reading schedule and discussion links will appear here.</Text>
        </Box>
        <Box p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="brand.border">
          <Heading size="sm" mb={2} color="brand.text">
            Next Poll
          </Heading>
          <Text color="brand.subtleText">Vote on the next book selection soon.</Text>
        </Box>
      </SimpleGrid>
    </Stack>
  )
}
