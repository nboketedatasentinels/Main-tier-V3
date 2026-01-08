import React from 'react'
import {
  Badge,
  Box,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react'

const campaigns = [
  { id: 'cmp-1', name: 'Week 6 Recovery', successRate: 42, responses: 18, status: 'Active' },
  { id: 'cmp-2', name: 'Critical Alert Sprint', successRate: 58, responses: 31, status: 'Paused' },
  { id: 'cmp-3', name: 'Quarterly Encouragement', successRate: 36, responses: 12, status: 'Active' },
]

export const NudgeEffectivenessDashboard: React.FC = () => {
  return (
    <Stack spacing={6}>
      <HStack justify="space-between" align="center">
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.text">Nudge effectiveness</Text>
          <Text fontSize="sm" color="brand.subtleText">Track engagement lifts after nudges.</Text>
        </VStack>
        <Badge colorScheme="green">Live</Badge>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
        {[
          { label: 'Total nudges sent', value: '284' },
          { label: 'Response rate', value: '43%' },
          { label: 'Avg engagement lift', value: '+18%' },
          { label: 'Task completion lift', value: '+12%' },
        ].map((metric) => (
          <Box key={metric.label} border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
            <Text fontSize="sm" color="brand.subtleText">{metric.label}</Text>
            <Text fontSize="2xl" fontWeight="bold" color="brand.text">{metric.value}</Text>
          </Box>
        ))}
      </SimpleGrid>

      <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
        <Stack spacing={3}>
          <Text fontWeight="semibold">Campaign performance</Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            <Input placeholder="Date range" />
            <Input placeholder="Template type" />
            <Input placeholder="Risk level" />
          </SimpleGrid>
          <Text fontSize="sm" color="brand.subtleText">
            Average days to response: 2.8 days
          </Text>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Campaign</Th>
                <Th>Response rate</Th>
                <Th>Responses</Th>
                <Th>Status</Th>
                <Th>Drill-down</Th>
              </Tr>
            </Thead>
            <Tbody>
              {campaigns.map((campaign) => (
                <Tr key={campaign.id}>
                  <Td>{campaign.name}</Td>
                  <Td>{campaign.successRate}%</Td>
                  <Td>{campaign.responses}</Td>
                  <Td>
                    <Badge colorScheme={campaign.status === 'Active' ? 'green' : 'yellow'}>{campaign.status}</Badge>
                  </Td>
                  <Td>
                    <Badge colorScheme="purple">View users</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Stack>
      </Box>
    </Stack>
  )
}

export default NudgeEffectivenessDashboard
