import React from 'react'
import { Badge, Box, HStack, SimpleGrid, Stack, Text, VStack } from '@chakra-ui/react'

export const RealTimeEffectivenessMonitor: React.FC = () => {
  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center">
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.text">Real-time effectiveness</Text>
          <Text fontSize="sm" color="brand.subtleText">Live snapshot of active campaigns.</Text>
        </VStack>
        <Badge colorScheme="green">Last 24h</Badge>
      </HStack>
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
        {[
          { label: 'Nudges delivered', value: '42' },
          { label: 'Immediate responses', value: '9' },
          { label: 'Open rate', value: '61%' },
          { label: 'Goal progress', value: '78%' },
        ].map((metric) => (
          <Box key={metric.label} border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
            <Text fontSize="sm" color="brand.subtleText">{metric.label}</Text>
            <Text fontSize="2xl" fontWeight="bold" color="brand.text">{metric.value}</Text>
          </Box>
        ))}
      </SimpleGrid>
      <Box border="1px dashed" borderColor="brand.border" borderRadius="lg" p={4} bg="brand.accent">
        <Text fontSize="sm" color="brand.subtleText">
          Alert: Critical Alert campaign is 12% away from its response rate goal. Notifications will trigger when the goal is met.
        </Text>
      </Box>
    </Stack>
  )
}

export default RealTimeEffectivenessMonitor
