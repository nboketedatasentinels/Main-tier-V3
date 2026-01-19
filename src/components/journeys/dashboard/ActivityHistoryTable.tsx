
import React from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from '@chakra-ui/react';

// Mock data for the activity history
const mockActivityHistory = [
  { id: 1, activity: 'Completed Leadership Module', date: '2024-07-22', points: 100 },
  { id: 2, activity: 'Mentor Session', date: '2024-07-20', points: 50 },
  { id: 3, activity: 'Peer Connect', date: '2024-07-19', points: 30 },
  { id: 4, activity: 'Impact Log', date: '2024-07-18', points: 70 },
];

export const ActivityHistoryTable: React.FC = () => {
  return (
    <Box>
      <Heading size="md" mb={4}>
        Activity History
      </Heading>
      <TableContainer>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Activity</Th>
              <Th>Date</Th>
              <Th isNumeric>Points</Th>
            </Tr>
          </Thead>
          <Tbody>
            {mockActivityHistory.map((item) => (
              <Tr key={item.id}>
                <Td>{item.activity}</Td>
                <Td>{item.date}</Td>
                <Td isNumeric>{item.points}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};
