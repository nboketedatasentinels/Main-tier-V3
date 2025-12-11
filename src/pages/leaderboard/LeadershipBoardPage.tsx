import React, { useMemo, useState } from 'react'
import {
  Box,
  Heading,
  Text,
  Stack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  Button,
  HStack,
  Badge,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { StartChallengeModal, ChallengeConfig } from '@/components/modals/StartChallengeModal'

export const LeadershipBoardPage: React.FC = () => {
  const leaderboardRows = useMemo(
    () => [
      { rank: 1, name: 'You', points: 1200 },
      { rank: 2, name: 'Kevin', points: 1150 },
      { rank: 3, name: 'Joker', points: 980 },
    ],
    [],
  )

  const [challenges, setChallenges] = useState<
    Array<ChallengeConfig & { id: string; status: string }>
  >([
    {
      id: 'challenge-1',
      opponent: 'Kevin',
      duration: '7 days',
      wager: 'Loser shares a tactical playbook.',
      focus: 'Impact',
      kickoff: '2024-06-01',
      status: 'Active',
    },
    {
      id: 'challenge-2',
      opponent: 'Amina',
      duration: '14 days',
      wager: 'Public learning recap.',
      focus: 'Learning',
      kickoff: '2024-06-15',
      status: 'Pending kickoff',
    },
  ])

  const { isOpen, onOpen, onClose } = useDisclosure()
  const opponents = useMemo(() => ['Kevin', 'Joker', 'Amina', 'Jordan'], [])

  const handleChallengeCreated = (config: ChallengeConfig) => {
    setChallenges(prev => [
      {
        ...config,
        id: `challenge-${Date.now()}`,
        status: 'Pending kickoff',
      },
      ...prev,
    ])
  }

  return (
    <Stack spacing={6}>
      <Box bg="white" p={6} borderRadius="xl" border="1px solid" borderColor="brand.border" boxShadow="sm">
        <HStack justify="space-between" align={{ base: 'start', md: 'center' }} spacing={4} flexDir={{ base: 'column', md: 'row' }}>
          <Box>
            <Heading size="md" color="brand.text">
              Leadership Board
            </Heading>
            <Text color="brand.subtleText">Compare your progress with peers across multiple leaderboards.</Text>
          </Box>
          <Button colorScheme="purple" onClick={onOpen} alignSelf={{ base: 'stretch', md: 'center' }}>
            Start Challenge
          </Button>
        </HStack>
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
            {leaderboardRows.map(leader => (
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

      <Box bg="white" p={4} borderRadius="lg" border="1px solid" borderColor="brand.border">
        <HStack justify="space-between" mb={3}>
          <Heading size="sm" color="brand.text">
            Active challenges
          </Heading>
          <Badge colorScheme="purple" variant="subtle">
            Auto-refreshes on new battles
          </Badge>
        </HStack>
        <VStack align="stretch" spacing={3}>
          {challenges.map(challenge => (
            <Box
              key={challenge.id}
              p={3}
              borderRadius="md"
              border="1px solid"
              borderColor="brand.border"
              bg="brand.primaryMuted"
            >
              <HStack justify="space-between" align={{ base: 'start', md: 'center' }} spacing={3} flexDir={{ base: 'column', md: 'row' }}>
                <Box>
                  <Text fontWeight="semibold" color="brand.text">
                    You vs. {challenge.opponent}
                  </Text>
                  <Text color="brand.subtleText" fontSize="sm">
                    Focus: {challenge.focus} · Duration: {challenge.duration} · Kickoff: {challenge.kickoff}
                  </Text>
                  {challenge.wager && (
                    <Text color="brand.subtleText" fontSize="sm">
                      Stakes: {challenge.wager}
                    </Text>
                  )}
                </Box>
                <Badge colorScheme={challenge.status === 'Active' ? 'green' : 'purple'}>{challenge.status}</Badge>
              </HStack>
            </Box>
          ))}
        </VStack>
      </Box>

      <StartChallengeModal
        isOpen={isOpen}
        onClose={onClose}
        opponents={opponents}
        onCreate={handleChallengeCreated}
      />
    </Stack>
  )
}
