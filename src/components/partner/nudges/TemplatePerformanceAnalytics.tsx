import React from 'react'
import {
  Badge,
  Box,
  HStack,
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

const templates = [
  { id: 't1', name: 'Critical Alert', sent: 80, response: '62%', engagementDelta: '+24%' },
  { id: 't2', name: 'Follow-up', sent: 60, response: '41%', engagementDelta: '+15%' },
  { id: 't3', name: 'Encouragement', sent: 44, response: '36%', engagementDelta: '+12%' },
]

export const TemplatePerformanceAnalytics: React.FC = () => {
  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center">
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.text">Template performance</Text>
          <Text fontSize="sm" color="brand.subtleText">Compare templates by response rate and engagement lift.</Text>
        </VStack>
        <Badge colorScheme="purple">Ranked</Badge>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
          <Text fontWeight="semibold" mb={3}>Top templates</Text>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Template</Th>
                <Th>Response</Th>
                <Th>Engagement lift</Th>
              </Tr>
            </Thead>
            <Tbody>
              {templates.map((template) => (
                <Tr key={template.id}>
                  <Td>{template.name}</Td>
                  <Td>{template.response}</Td>
                  <Td>{template.engagementDelta}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
          <Text fontWeight="semibold">Best send time</Text>
          <Text fontSize="sm" color="brand.subtleText" mt={2}>
            Heatmap insights suggest Tuesday and Wednesday mornings perform best for critical alerts.
          </Text>
          <Text fontSize="sm" color="brand.subtleText" mt={2}>
            A/B testing shows the Critical Alert subject line improves response rates by 14% over last quarter.
          </Text>
          <Text fontSize="sm" color="brand.subtleText" mt={2}>
            Recommendation engine: use Critical Alert for critical risk, Follow-up for watch-level learners.
          </Text>
        </Box>
      </SimpleGrid>
    </Stack>
  )
}

export default TemplatePerformanceAnalytics
