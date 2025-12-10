import React from 'react'
import { Box, Heading, Text, Stack, Divider } from '@chakra-ui/react'

export const WeeklyUpdatesPage: React.FC = () => {
  return (
    <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
      <Stack spacing={4}>
        <Heading size="md" color="brand.text">
          Weekly Updates
        </Heading>
        <Text color="brand.subtleText">
          Track your weekly milestones, review scheduled activities, and celebrate progress. Detailed functionality
          will plug in here.
        </Text>
        <Divider />
        <Text color="brand.subtleText">Select a week to view its activities and add new notes.</Text>
      </Stack>
    </Box>
  )
}
