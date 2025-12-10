import React from 'react'
import { Box, Heading, Text, Stack, VStack, HStack, Avatar, IconButton } from '@chakra-ui/react'
import { Heart } from 'lucide-react'

const posts = [
  { name: 'Casey', message: 'Launched a new product today!', likes: 24 },
  { name: 'Morgan', message: 'Completed a marathon!', likes: 18 },
]

export const ShamelessCirclePage: React.FC = () => {
  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Heading size="md" color="brand.text">
          Shameless Circle
        </Heading>
        <Text color="brand.subtleText">Share your wins and celebrate the community.</Text>
      </Box>

      <VStack align="stretch" spacing={4}>
        {posts.map(post => (
          <Box key={post.message} p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="brand.border">
            <HStack spacing={3} mb={2}>
              <Avatar name={post.name} size="sm" />
              <Text fontWeight="semibold" color="brand.text">
                {post.name}
              </Text>
            </HStack>
            <Text color="brand.subtleText" mb={3}>
              {post.message}
            </Text>
            <HStack spacing={2}>
              <IconButton
                aria-label="like"
                icon={<Heart size={16} />}
                size="sm"
                variant="ghost"
                _hover={{ bg: 'brand.primaryMuted' }}
              />
              <Text color="brand.subtleText">{post.likes} likes</Text>
            </HStack>
          </Box>
        ))}
      </VStack>
    </Stack>
  )
}
