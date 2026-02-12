import React, { useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Flex,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Progress,
  SimpleGrid,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Tag,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  Award,
  CalendarClock,
  CheckCircle,
  Circle,
  Compass,
  Flame,
  Rocket,
  Star,
  Swords,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ActivityCard } from '@/components/dashboard/ActivityCard'
import { BadgeCard } from '@/components/dashboard/BadgeCard'
import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'
import { useLeaderboardData } from '@/hooks/leaderboard/useLeaderboardData'
import { getLeaderboardContextLabels, useLeaderboardContext } from '@/hooks/leaderboard/useLeaderboardContext'
import { WeeklyInspirationCard } from './components/WeeklyInspirationCard'
import { JourneyCompletionBanner } from '@/components/journeys/JourneyCompletionBanner'
import pointsConfig from '@/config/pointsConfig'
import { useUserBadges } from '@/hooks/useUserBadges'

interface ActivityItem {
  title: string
  points: number
  completed?: boolean
}

const initialActivities: ActivityItem[] = [
  { title: 'Complete leadership reflection', points: 40, completed: true },
  { title: 'Review your weekly plan', points: 20 },
  { title: 'Check in with your mentor', points: 35 },
  { title: 'Log an impact action', points: 50 },
]

const achievements = [
  {
    name: 'Momentum Builder',
    description: 'Completed three activities in a single week.',
    earnedOn: 'Yesterday',
    isNew: true,
  },
  {
    name: 'Consistency Champion',
    description: 'Logged impact for four consecutive weeks.',
    earnedOn: 'Mar 8',
  },
  {
    name: 'Community Ally',
    description: 'Hosted a village roundtable.',
    earnedOn: 'Mar 1',
  },
]

const events = [
  { title: 'Village Roundtable', date: 'Mar 18 • 5:00 PM', location: 'Zoom', type: 'Community' },
  { title: 'Impact Lab', date: 'Mar 20 • 12:00 PM', location: 'HQ Campus', type: 'Workshop' },
  { title: 'Mentor Office Hours', date: 'Mar 22 • 3:00 PM', location: 'Zoom', type: 'Mentorship' },
]

const milestones = [
  { label: 'Ignition', status: 'complete' },
  { label: 'Discovery', status: 'complete' },
  { label: 'Experiment', status: 'active' },
  { label: 'Impact', status: 'up-next' },
  { label: 'Amplify', status: 'pending' },
]

const LEVEL_STEP_POINTS = 500
const MENTOR_BENCHMARK_COMPLETION = 80

export const PaidMemberDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { inspirationQuote } = useWeeklyGlanceData()
  const badgesState = useUserBadges()
  const userBadges = badgesState?.userBadges ?? []
  const badgeCount = userBadges.length

  const leaderboardContext = useLeaderboardContext(profile)
  const leaderboardLabels = useMemo(() => getLeaderboardContextLabels(leaderboardContext), [leaderboardContext])
  const { profiles, challenges } = useLeaderboardData({
    context: leaderboardContext,
    profileId: profile?.id,
  })

  const activeChallenges = useMemo(() => {
    return challenges.filter((c) => c.status === 'active' || c.status === 'pending')
  }, [challenges])

  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities)
  const [activeBadgeIndex, setActiveBadgeIndex] = useState(0)

  const totalPoints = Math.max(0, profile?.totalPoints || 0)
  const currentLevel = Math.max(1, profile?.level || 1)
  const pointsIntoCurrentLevel = totalPoints % LEVEL_STEP_POINTS
  const pointsToNextLevel = LEVEL_STEP_POINTS - pointsIntoCurrentLevel
  const nextLevel = currentLevel + 1
  const nextLevelProgress = Math.round((pointsIntoCurrentLevel / LEVEL_STEP_POINTS) * 100)

  const rankingProfiles = useMemo(
    () =>
      profiles.filter(
        (candidate) => candidate.id !== profile?.id && typeof candidate.totalPoints === 'number',
      ),
    [profile?.id, profiles],
  )
  const segmentRank = rankingProfiles.length
    ? rankingProfiles.filter((candidate) => (candidate.totalPoints || 0) > totalPoints).length + 1
    : null
  const segmentSize = segmentRank ? rankingProfiles.length + 1 : null
  const topPercent = segmentRank && segmentSize
    ? Math.max(1, Math.round((segmentRank / segmentSize) * 100))
    : null
  const peersAtOrAboveLevel = useMemo(
    () => rankingProfiles.filter((candidate) => candidate.level >= currentLevel).length,
    [currentLevel, rankingProfiles],
  )

  const journeyWeeks = useMemo(() => {
    if (profile?.programDurationWeeks) return profile.programDurationWeeks
    if (profile?.journeyType) return pointsConfig.JOURNEY_META[profile.journeyType].weeks
    return 6
  }, [profile?.journeyType, profile?.programDurationWeeks])
  const currentWeek = profile?.currentWeek || 1

  const completedActivities = useMemo(
    () => activities.filter(activity => activity.completed).length,
    [activities],
  )

  const completionRate = useMemo(() => {
    if (!activities.length) return 0
    return Math.round((completedActivities / activities.length) * 100)
  }, [activities.length, completedActivities])

  const journeyCompletionPct = useMemo(() => {
    if (!journeyWeeks) return 0
    return Math.min(100, Math.round((currentWeek / journeyWeeks) * 100))
  }, [currentWeek, journeyWeeks])

  const isJourneyComplete = journeyCompletionPct >= 100

  const completionSteps = [
    { label: 'Finish final week activities', complete: currentWeek >= journeyWeeks },
    { label: 'Submit final impact log', complete: completionRate >= MENTOR_BENCHMARK_COMPLETION },
    { label: 'Confirm mentor sign-off', complete: isJourneyComplete },
  ]

  const toggleActivity = (title: string) => {
    setActivities(prev =>
      prev.map(activity =>
        activity.title === title ? { ...activity, completed: !activity.completed } : activity,
      ),
    )
  }

  const prevBadge = () => {
    setActiveBadgeIndex(prev => (prev - 1 + achievements.length) % achievements.length)
  }

  const nextBadge = () => {
    setActiveBadgeIndex(prev => (prev + 1) % achievements.length)
  }

  return (
    <Stack spacing={8}>
      <JourneyCompletionBanner />
      <Flex
        aria-label="Dashboard welcome panel"
        align={{ base: 'flex-start', md: 'center' }}
        justify="space-between"
        gap={4}
      >
        <Box>
          <Tag size="lg" colorScheme="yellow" bg="rgba(234, 177, 48, 0.2)" color="brand.gold" mb={2}>
            Journey: Leadership Transformation
          </Tag>
          <Text fontSize="3xl" fontWeight="bold" color="brand.text">
            Welcome back, {profile?.firstName || 'Leader'}
          </Text>
          <Text color="brand.subtleText" opacity={0.9}>
            You are on track for week {profile?.currentWeek || 3}. Keep the momentum going today.
          </Text>
        </Box>
        <HStack spacing={4}>
          <VStack align="flex-end" spacing={1} display={{ base: 'none', md: 'flex' }}>
            <Text fontSize="sm" color="brand.subtleText" opacity={0.9}>
              Current level
            </Text>
            <Text fontSize="xl" fontWeight="bold" color="brand.text">
              {currentLevel}
            </Text>
          </VStack>
          <Avatar
            size="lg"
            name={`${profile?.firstName || 'T4L'} ${profile?.lastName || 'Member'}`}
            src={profile?.avatarUrl}
            bg="brand.royalPurple"
            color="brand.gold"
          />
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6}>
        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.goldLight">Total Points</StatLabel>
              <StatNumber color="brand.gold">{totalPoints}</StatNumber>
              <StatHelpText color="brand.goldLight">
                {segmentRank && segmentSize
                  ? `Rank #${segmentRank} of ${segmentSize} in ${leaderboardLabels.label}`
                  : `Build momentum in ${leaderboardLabels.label}`}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.goldLight">Level</StatLabel>
              <StatNumber color="brand.gold">{currentLevel}</StatNumber>
              <StatHelpText color="brand.goldLight">{pointsToNextLevel} pts to level {nextLevel}</StatHelpText>
            </Stat>
            <Progress value={nextLevelProgress} colorScheme="yellow" size="sm" borderRadius="full" />
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.goldLight">Current Week</StatLabel>
              <StatNumber color="brand.gold">{profile?.currentWeek || 1}</StatNumber>
              <StatHelpText color="brand.goldLight">of your journey</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.goldLight">Badges</StatLabel>
              <StatNumber color="brand.gold">{badgeCount}</StatNumber>
              <StatHelpText color="brand.goldLight">
                {topPercent
                  ? `Top ${topPercent}% in ${leaderboardLabels.label}`
                  : 'Earned so far'}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Card border="1px solid" borderColor="brand.border">
        <CardBody py={4}>
          <Stack spacing={2}>
            <HStack justify="space-between" flexWrap="wrap" gap={2}>
              <Text fontWeight="bold" color="brand.text">Momentum benchmark</Text>
              <Badge colorScheme={completionRate >= MENTOR_BENCHMARK_COMPLETION ? 'green' : 'blue'}>
                Mentor benchmark
              </Badge>
            </HStack>
            <Text fontSize="sm" color="brand.subtleText">
              {peersAtOrAboveLevel > 0
                ? `${peersAtOrAboveLevel} peers in your segment are already at level ${currentLevel} or above.`
                : 'You are setting the pace in your segment right now.'}
            </Text>
            <Text fontSize="sm" color="brand.subtleText">
              Mentor guidance: keep weekly completion at {MENTOR_BENCHMARK_COMPLETION}%+ and close your last {pointsToNextLevel} points to reach level {nextLevel}.
            </Text>
          </Stack>
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Stack spacing={6}>
            <Card aria-label="Weekly progress overview">
            <CardBody>
              <HStack justify="space-between" align="flex-start" mb={4}>
                <Box>
                  <Text fontWeight="bold" color="brand.text">
                    Weekly progress
                  </Text>
                  <Text fontSize="sm" color="brand.subtleText" opacity={0.8}>
                    Week {profile?.currentWeek ?? 3} completion status
                  </Text>
                </Box>
                <HStack spacing={2}>
                  <Icon as={TrendingUp} color="brand.gold" />
                  <Text color="brand.text" fontWeight="bold">
                    {completionRate}%
                  </Text>
                </HStack>
              </HStack>
              <Progress value={completionRate} borderRadius="full" mb={4} />
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Box>
                  <Text fontSize="sm" color="brand.subtleText" opacity={0.85}>
                    Activities completed
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color="brand.text">
                    {completedActivities} / {activities.length}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="brand.subtleText" opacity={0.85}>
                    Estimated points
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color="brand.text">
                    {activities.reduce((total, act) => total + (act.completed ? act.points : 0), 0)} pts
                  </Text>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>

          {activeChallenges.length > 0 && (
            <Card border="1px solid" borderColor="brand.border">
              <CardBody>
                <HStack justify="space-between" mb={4}>
                  <HStack spacing={2}>
                    <Icon as={Swords} color="brand.primary" />
                    <Text fontWeight="bold" color="brand.text">
                      Active Challenges
                    </Text>
                  </HStack>
                  <Button
                    size="xs"
                    variant="ghost"
                    rightIcon={<Icon as={Trophy} size={14} />}
                    onClick={() => navigate('/app/leadership-board')}
                  >
                    View All
                  </Button>
                </HStack>
                <Stack spacing={3}>
                  {activeChallenges.slice(0, 2).map((challenge) => (
                    <Flex
                      key={challenge.id}
                      p={3}
                      borderRadius="lg"
                      bg="brand.primaryMuted"
                      align="center"
                      justify="space-between"
                    >
                      <HStack spacing={3}>
                        <Avatar size="sm" name={challenge.opponentName} src={challenge.opponentAvatar} />
                        <Box>
                          <Text fontSize="sm" fontWeight="bold">vs {challenge.opponentName}</Text>
                          <Text fontSize="xs" color="brand.subtleText">
                            {challenge.status === 'pending' ? 'Waiting to start' : `${challenge.yourPoints} vs ${challenge.opponentPoints} XP`}
                          </Text>
                        </Box>
                      </HStack>
                      <Badge colorScheme={challenge.status === 'pending' ? 'orange' : 'purple'}>
                        {challenge.status.toUpperCase()}
                      </Badge>
                    </Flex>
                  ))}
                </Stack>
              </CardBody>
            </Card>
          )}
          </Stack>
        </GridItem>

        <GridItem>
          <Card bg="brand.royalPurple">
            <CardBody>
              <HStack mb={3} spacing={3}>
                <Icon as={Rocket} color="brand.gold" />
                <Text fontWeight="bold" color="white">
                  Quick actions
                </Text>
              </HStack>
              <Stack spacing={3}>
                <Button variant="secondary" leftIcon={<Icon as={Flame} />}>
                  Log new impact
                </Button>
                <Button variant="secondary" leftIcon={<Icon as={Compass} />}>
                  Review journey plan
                </Button>
                <Button variant="secondary" leftIcon={<Icon as={CalendarClock} />}>
                  Schedule mentor session
                </Button>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1.2fr' }} gap={6}>
        <GridItem>
          <Card>
            <CardBody>
              <HStack justify="space-between" align="center" mb={4}>
                <Text fontWeight="bold" color="brand.text">
                  Current week activities
                </Text>
                <Tag colorScheme="yellow" bg="rgba(234, 177, 48, 0.12)" color="brand.gold">
                  {completedActivities} of {activities.length} complete
                </Tag>
              </HStack>
              <Stack spacing={3}>
                {activities.map(activity => (
                  <ActivityCard
                    key={activity.title}
                    title={activity.title}
                    points={activity.points}
                    completed={activity.completed}
                    onToggle={() => toggleActivity(activity.title)}
                  />
                ))}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card aria-label="Badge highlights">
            <CardBody>
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="bold" color="brand.text">
                  Recent achievements
                </Text>
                <HStack>
                  <IconButton
                    aria-label="Previous badge"
                    icon={<Icon as={Star} />}
                    variant="ghost"
                    colorScheme="yellow"
                    onClick={prevBadge}
                  />
                  <IconButton
                    aria-label="Next badge"
                    icon={<Icon as={Star} />}
                    variant="ghost"
                    colorScheme="yellow"
                    onClick={nextBadge}
                  />
                </HStack>
              </HStack>
              <BadgeCard {...achievements[activeBadgeIndex]} />
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Card>
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <HStack spacing={2}>
                <Icon as={Award} color="brand.gold" />
                <Text fontWeight="bold" color="brand.text">
                  Journey completion badge
                </Text>
              </HStack>
              <Tag colorScheme={isJourneyComplete ? 'green' : 'purple'}>
                {isJourneyComplete ? 'Ready to claim' : 'In progress'}
              </Tag>
            </HStack>
            <Text fontSize="sm" color="brand.subtleText">
              Complete the steps below to unlock your final journey badge and celebrate your growth.
            </Text>
            <Progress value={journeyCompletionPct} borderRadius="full" />
            <HStack justify="space-between">
              <Text fontSize="sm" color="brand.subtleText">
                {journeyCompletionPct}% complete
              </Text>
              <Text fontSize="sm" color="brand.subtleText">
                Week {currentWeek} of {journeyWeeks}
              </Text>
            </HStack>
            <Stack spacing={2}>
              {completionSteps.map(step => (
                <HStack key={step.label} spacing={3}>
                  <Icon as={step.complete ? CheckCircle : Circle} color={step.complete ? 'green.400' : 'text.muted'} />
                  <Text color="brand.text" fontWeight="semibold">
                    {step.label}
                  </Text>
                </HStack>
              ))}
            </Stack>
            <Button colorScheme="purple" isDisabled={!isJourneyComplete}>
              Claim completion badge
            </Button>
          </Stack>
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: '1fr', xl: '3fr 2fr' }} gap={6}>
        <GridItem>
          <Card aria-label="Upcoming events list">
            <CardBody>
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="bold" color="brand.text">
                  Upcoming events
                </Text>
                <Tag variant="gold" color="brand.primary">
                  Next 3
                </Tag>
              </HStack>
              <Stack spacing={3}>
                {events.map(event => (
                  <Box
                    key={event.title}
                    p={4}
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="brand.border"
                    bg="brand.primaryMuted"
                  >
                    <HStack justify="space-between" mb={1}>
                      <Text fontWeight="semibold" color="brand.text">
                        {event.title}
                      </Text>
                      <Tag variant="gold" color="brand.primary">
                        {event.type}
                      </Tag>
                    </HStack>
                    <Text fontSize="sm" color="brand.subtleText" opacity={0.95}>
                      {event.date}
                    </Text>
                    <Text fontSize="sm" color="brand.subtleText" opacity={0.9}>
                      {event.location}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card>
            <CardBody>
              <Text fontWeight="bold" color="brand.text" mb={3}>
                Journey milestones
              </Text>
              <Stack spacing={3}>
                {milestones.map((milestone, index) => (
                  <Flex
                    key={milestone.label}
                    align="center"
                    gap={3}
                    opacity={milestone.status === 'pending' ? 0.6 : 1}
                  >
                    <Box
                      width="10px"
                      height="10px"
                      borderRadius="full"
                      bg={
                        milestone.status === 'complete'
                          ? 'brand.gold'
                          : milestone.status === 'active'
                            ? 'brand.primary'
                            : 'rgba(234, 177, 48, 0.3)'
                      }
                    />
                    <VStack align="flex-start" spacing={0} flex={1}>
                      <Text fontWeight="semibold" color="brand.text">
                        {milestone.label}
                      </Text>
                      <Text fontSize="xs" color="brand.subtleText" opacity={0.8}>
                        {milestone.status === 'complete'
                          ? 'Completed'
                          : milestone.status === 'active'
                            ? 'In progress'
                            : 'Coming up'}
                      </Text>
                    </VStack>
                    {index < milestones.length - 1 && (
                      <Divider orientation="vertical" borderColor="rgba(234, 177, 48, 0.3)" />
                    )}
                  </Flex>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <WeeklyInspirationCard
        quote={inspirationQuote?.quote_text ?? 'Join the movement. Take one small step today toward your goal.'}
        author={inspirationQuote?.author ?? 'T4L Community'}
      />
    </Stack>
  )
}
