import React from 'react'
import {
  Badge,
  Box,
  Button,
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
} from '@chakra-ui/react'

const historyItems = [
  { id: 'n1', user: 'Jordan Lee', template: 'Initial Outreach', status: 'sent', sentAt: '2024-05-02 09:00' },
  { id: 'n2', user: 'Taylor Smith', template: 'Critical Alert', status: 'failed', sentAt: '2024-05-01 15:40' },
  { id: 'n3', user: 'Sam Patel', template: 'Encouragement', status: 'sent', sentAt: '2024-04-30 11:15' },
]

export const NudgeHistory: React.FC = () => {
  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center">
        <Text fontWeight="bold" color="brand.text">Nudge history</Text>
        <Button size="sm" variant="outline">Export CSV</Button>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
        <Input placeholder="Filter by user" />
        <Input placeholder="Filter by template" />
        <Input placeholder="Date range" />
      </SimpleGrid>

      <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>User</Th>
              <Th>Template</Th>
              <Th>Sent</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {historyItems.map((item) => (
              <Tr key={item.id}>
                <Td>{item.user}</Td>
                <Td>{item.template}</Td>
                <Td>{item.sentAt}</Td>
                <Td>
                  <Badge colorScheme={item.status === 'sent' ? 'green' : 'red'}>{item.status}</Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Stack>
  )
}

export default NudgeHistory
