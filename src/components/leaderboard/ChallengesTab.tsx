import React, { useMemo, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  SimpleGrid,
  Select,
  Center,
  Spinner,
  Icon,
  Badge,
} from '@chakra-ui/react';
import { Plus, Trophy, Swords, Clock } from 'lucide-react';
import { ChallengeCard } from '../challenges/ChallengeCard';

interface ChallengeRecord {
  id: string;
  opponentName: string;
  opponentId?: string;
  startDate: string;
  endDate: string;
  yourPoints: number;
  opponentPoints: number;
  status: 'pending' | 'active' | 'completed' | 'upcoming';
  result?: 'win' | 'loss' | 'draw';
}

interface ChallengesTabProps {
  challenges: ChallengeRecord[];
  challengesLoaded: boolean;
  onStartChallenge: () => void;
  onCancelChallenge?: (id: string) => void;
  leaderboardRank?: number;
}

export const ChallengesTab: React.FC<ChallengesTabProps> = ({
  challenges,
  challengesLoaded,
  onStartChallenge,
  onCancelChallenge,
  leaderboardRank,
}) => {
  const [sortBy, setSortBy] = useState<'date' | 'points'>('date');

  // Categorize challenges
  const { active, pending, completed, stats } = useMemo(() => {
    const now = new Date();
    const active: ChallengeRecord[] = [];
    const pending: ChallengeRecord[] = [];
    const completed: ChallengeRecord[] = [];

    challenges.forEach((c) => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);

      if (c.status === 'completed' || now > end) {
        completed.push({ ...c, status: 'completed' });
      } else if (now < start) {
        pending.push({ ...c, status: 'pending' });
      } else {
        active.push({ ...c, status: 'active' });
      }
    });

    // Sort by selected criteria
    const sortFn = sortBy === 'date'
      ? (a: ChallengeRecord, b: ChallengeRecord) =>
          new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
      : (a: ChallengeRecord, b: ChallengeRecord) => b.yourPoints - a.yourPoints;

    active.sort(sortFn);
    pending.sort(sortFn);
    completed.sort(sortFn);

    // Calculate stats
    const victories = completed.filter((c) => c.result === 'win').length;
    const totalPoints = challenges.reduce((sum, c) => sum + c.yourPoints, 0);

    return {
      active,
      pending,
      completed,
      stats: {
        activeCount: active.length + pending.length,
        victories,
        totalPoints,
      },
    };
  }, [challenges, sortBy]);

  // Empty state component
  const EmptyState = ({ message }: { message: string }) => (
    <Center
      py={8}
      flexDirection="column"
      color="white"
      textAlign="center"
      sx={{ '& p': { color: 'white' } }}
    >
      <Icon as={Swords} boxSize={8} mb={2} color="white" />
      <Text as="p" color="white">
        {message}
      </Text>
    </Center>
  );

  if (!challengesLoaded) {
    return (
      <Center py={12}>
        <Spinner size="lg" color="purple.500" />
      </Center>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Header Stats */}
      <Box
        bg="linear-gradient(135deg, #350e6f 0%, #27062e 100%)"
        borderRadius="xl"
        p={6}
        color="white"
      >
        <Flex justify="space-between" align="center" mb={4}>
          <Box>
            <Text fontSize="xs" textTransform="uppercase" color="whiteAlpha.800">
              Challenge Arena
            </Text>
            <Text fontSize="xl" fontWeight="bold">
              Friendly competitions to spark growth
            </Text>
          </Box>
          <Button
            leftIcon={<Plus size={16} />}
            colorScheme="orange"
            size="sm"
            onClick={onStartChallenge}
          >
            New Challenge
          </Button>
        </Flex>

        <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
          <Stat>
            <StatLabel color="whiteAlpha.800" fontSize="xs">Active & Pending</StatLabel>
            <StatNumber fontSize="2xl">{stats.activeCount}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel color="whiteAlpha.800" fontSize="xs">Victories</StatLabel>
            <StatNumber fontSize="2xl">{stats.victories}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel color="whiteAlpha.800" fontSize="xs">Points Earned</StatLabel>
            <StatNumber fontSize="2xl">{stats.totalPoints.toLocaleString()}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel color="whiteAlpha.800" fontSize="xs">Leaderboard Rank</StatLabel>
            <StatNumber fontSize="2xl">#{leaderboardRank ?? '—'}</StatNumber>
          </Stat>
        </SimpleGrid>
      </Box>

      {/* Challenge Lists */}
      <Box bg="white" borderRadius="lg" border="1px solid" borderColor="gray.200">
        <Flex justify="space-between" align="center" p={4} borderBottom="1px solid" borderColor="gray.100">
          <Text fontWeight="semibold">Your Challenges</Text>
          <Select
            size="sm"
            maxW="150px"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'points')}
          >
            <option value="date">Sort by Date</option>
            <option value="points">Sort by Points</option>
          </Select>
        </Flex>

        <Tabs variant="enclosed" colorScheme="purple">
          <TabList px={4} pt={2}>
            <Tab fontSize="sm">
              <HStack spacing={2}>
                <Swords size={14} />
                <Text>Active</Text>
                {active.length > 0 && (
                  <Badge colorScheme="green" borderRadius="full" fontSize="xs">
                    {active.length}
                  </Badge>
                )}
              </HStack>
            </Tab>
            <Tab fontSize="sm">
              <HStack spacing={2}>
                <Clock size={14} />
                <Text>Pending</Text>
                {pending.length > 0 && (
                  <Badge colorScheme="yellow" borderRadius="full" fontSize="xs">
                    {pending.length}
                  </Badge>
                )}
              </HStack>
            </Tab>
            <Tab fontSize="sm">
              <HStack spacing={2}>
                <Trophy size={14} />
                <Text>History</Text>
                {completed.length > 0 && (
                  <Badge colorScheme="gray" borderRadius="full" fontSize="xs">
                    {completed.length}
                  </Badge>
                )}
              </HStack>
            </Tab>
          </TabList>

          <TabPanels>
            {/* Active Challenges */}
            <TabPanel>
              {active.length === 0 ? (
                <EmptyState message="No active challenges. Start one to compete!" />
              ) : (
                <VStack spacing={3} align="stretch">
                  {active.map((challenge) => (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      onCancel={onCancelChallenge}
                    />
                  ))}
                </VStack>
              )}
            </TabPanel>

            {/* Pending Challenges */}
            <TabPanel>
              {pending.length === 0 ? (
                <EmptyState message="No pending challenges." />
              ) : (
                <VStack spacing={3} align="stretch">
                  {pending.map((challenge) => (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      onCancel={onCancelChallenge}
                    />
                  ))}
                </VStack>
              )}
            </TabPanel>

            {/* Completed Challenges */}
            <TabPanel>
              {completed.length === 0 ? (
                <EmptyState message="No completed challenges yet." />
              ) : (
                <VStack spacing={3} align="stretch">
                  {completed.map((challenge) => (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                    />
                  ))}
                </VStack>
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </VStack>
  );
};
