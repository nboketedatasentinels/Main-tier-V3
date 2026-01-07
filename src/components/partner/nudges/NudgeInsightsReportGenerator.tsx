import React from 'react'
import { Badge, Box, Button, HStack, Stack, Text, VStack } from '@chakra-ui/react'

export const NudgeInsightsReportGenerator: React.FC = () => {
  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center">
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.text">Nudge insights report</Text>
          <Text fontSize="sm" color="brand.subtleText">Generate executive summaries for stakeholders.</Text>
        </VStack>
        <Badge colorScheme="purple">PDF export</Badge>
      </HStack>

      <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
        <Stack spacing={3}>
          <Text fontWeight="semibold">Weekly summary</Text>
          <Text fontSize="sm" color="brand.subtleText">
            Includes response rates, engagement recovery, and ROI highlights by organization.
          </Text>
          <HStack spacing={3}>
            <Button colorScheme="purple">Generate report</Button>
            <Button variant="outline">Schedule weekly email</Button>
          </HStack>
        </Stack>
      </Box>
    </Stack>
  )
}

export default NudgeInsightsReportGenerator
