import React from 'react'
import { Box, Heading, Text, Stack, VStack, HStack, Tag } from '@chakra-ui/react'

const announcements = [
  { title: 'System Update', body: 'New dashboard styling is live.', priority: 'High' },
  { title: 'Community Meetup', body: 'Join the next global meetup this Friday.', priority: 'Medium' },
]

export const AnnouncementsPage: React.FC = () => {
  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Heading size="md" color="brand.text">
          Announcements
        </Heading>
        <Text color="brand.subtleText">Stay updated with the latest news across the platform.</Text>
      </Box>

      <VStack align="stretch" spacing={4}>
        {announcements.map(item => (
          <Box key={item.title} p={4} bg="white" borderRadius="lg" border="1px solid" borderColor="brand.border">
            <HStack justify="space-between" align="start" mb={2}>
              <Heading size="sm" color="brand.text">
                {item.title}
              </Heading>
              <Tag colorScheme={item.priority === 'High' ? 'red' : 'purple'}>{item.priority}</Tag>
            </HStack>
            <Text color="brand.subtleText">{item.body}</Text>
          </Box>
        ))}
      </VStack>
    </Stack>
  )
}
