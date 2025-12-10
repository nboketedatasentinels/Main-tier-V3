import React from 'react'
import { Box, Heading, Text, Stack, SimpleGrid, Skeleton, SkeletonText } from '@chakra-ui/react'

export const MyCoursesPage: React.FC = () => {
  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Heading size="md" mb={2} color="brand.text">
          My Courses
        </Heading>
        <Text color="brand.subtleText">
          Explore enrolled and recommended courses. Interactive learning modules will appear here.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        {[1, 2, 3].map(item => (
          <Box key={item} p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="brand.border">
            <Skeleton height="160px" borderRadius="lg" mb={3} />
            <SkeletonText noOfLines={3} spacing={3} />
          </Box>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
