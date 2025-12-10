import React from 'react'
import { Box, Heading, Text, Stack, Table, Thead, Tbody, Tr, Th, Td, Tag } from '@chakra-ui/react'

const sampleLeaders = [
  { rank: 1, name: 'You', points: 1200 },
  { rank: 2, name: 'Kevin', points: 1150 },
  { rank: 3, name: 'Joker', points: 980 },
]

export const LeadershipBoardPage: React.FC = () => {
  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <Heading size="md" color="brand.text">
          Leadership Board
        </Heading>
        <Text color="brand.subtleText">Compare your progress with peers across multiple leaderboards.</Text>
      </Box>

      <Box bg="white" p={4} borderRadius="lg" border="1px solid" borderColor="brand.border">
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>Rank</Th>
              <Th>Name</Th>
              <Th isNumeric>Points</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sampleLeaders.map(leader => (
              <Tr key={leader.rank} bg={leader.name === 'You' ? 'brand.primaryMuted' : 'transparent'}>
                <Td>
                  {leader.rank <= 3 ? <Tag colorScheme="purple">{leader.rank}</Tag> : leader.rank}
                </Td>
                <Td>{leader.name}</Td>
                <Td isNumeric>{leader.points}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Stack>
  )
}
