import React from 'react'
import { Box, Heading, Stack, Text } from '@chakra-ui/react'
import { EventsTab } from '@/pages/community/AnnouncementsPage'

export const EventsPage: React.FC = () => (
  <Stack spacing={6} pb={10}>
    <Box bg="white" p={6} borderRadius="3xl" borderWidth={1} borderColor="brand.border" boxShadow="sm">
      <Stack spacing={2}>
        <Heading size="lg" color="brand.text">
          Events
        </Heading>
        <Text color="brand.subtleText" fontSize="md">
          Upcoming workshops, gatherings, and live experiences from the T4L ecosystem.
        </Text>
      </Stack>
    </Box>
    <EventsTab />
  </Stack>
)

export default EventsPage
