import React, { useMemo, useState } from 'react'
import {
  Avatar,
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
  Tag,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  Award,
  CalendarClock,
  CalendarDays,
  Compass,
  Crown,
  Flame,
  Rocket,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/dashboard/StatCard'
import { ActivityCard } from '@/components/dashboard/ActivityCard'
import { BadgeCard } from '@/components/dashboard/BadgeCard'
import { DashboardTourStep, useDashboardTour } from '@/hooks/useDashboardTour'

interface ActivityItem {
  title: string
  points: number
  completed?: boolean
}

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

export const PaidMemberDashboard: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [activities, setActivities] = useState<ActivityItem[]>([
    { title: 'Complete leadership reflection', points: 50 },
    { title: 'Submit weekly impact log', points: 75 },
    { title: 'Attend mentor session', points: 60 },
    { title: 'Host a peer learning huddle', points: 90 },
  ])

  const [activeBadgeIndex, setActiveBadgeIndex] = useState(0)

  const tourSteps = useMemo<DashboardTourStep[]>(
    () => [
      {
        element: '#dashboard-welcome',
        title: 'Welcome to your leadership dashboard',
        intro:
          'Track progress, celebrate achievements, and jump into your next leadership action.',
        position: 'bottom',
        buttons: [
          {
            text: 'Skip for now',
            className: 'introjs-skip',
            action: (intro) => intro.exit(),
          },
          {
            text: 'Next insight',
            action: (intro) => intro.nextStep(),
          },
        ],
      },
      {
        element: '#dashboard-stats',
        title: 'Your performance snapshot',
        intro:
          'These metrics show your points, level, and weekly journey momentum. You can always return here for a quick health check.',
        position: 'bottom',
        buttons: [
          {
            text: 'View leaderboard',
            className: 'introjs-secondary',
            action: () => navigate('/app/leadership-board'),
          },
          {
            text: 'Next',
            action: (intro) => intro.nextStep(),
          },
        ],
      },
      {
        element: '#weekly-progress',
        title: 'Weekly checklist',
        intro:
          'Complete these activities to keep your journey on track. You can toggle items here or open the full checklist.',
        position: 'right',
        buttons: [
          {
            text: 'Open weekly checklist',
            action: () => navigate('/app/weekly-checklist'),
          },
          {
            text: 'Next',
            action: (intro) => intro.nextStep(),
          },
        ],
      },
      {
        element: '#dashboard-events',
        title: 'Upcoming experiences',
        intro:
          'Join live events and mentorship sessions directly from here. We recommend saving one to your calendar.',
        position: 'left',
        buttons: [
          {
            text: 'Open event calendar',
            action: () => window.open('https://t4l.community/events', '_blank', 'noopener'),
          },
          {
            text: 'Next',
            action: (intro) => intro.nextStep(),
          },
        ],
      },
      {
        element: '#dashboard-badges',
        title: 'Celebrate your badges',
        intro:
          'Review the badges you have earned and preview what is coming next. Advance through them right from this tour.',
        position: 'top',
        buttons: [
          {
            text: 'Show next badge',
            action: () => setActiveBadgeIndex((prev) => (prev + 1) % achievements.length),
          },
          {
            text: 'Finish',
            action: (intro) => intro.nextStep(),
          },
        ],
      },
    ],
    [navigate]
  )

  const { startTour, currentStep, hasCompleted, announcementNode, isLoading } =
    useDashboardTour('paid', tourSteps, true)

  const completedActivities = useMemo(
    () => activities.filter((activity) => activity.completed).length,
    [activities]
  )

  const completionRate = Math.round((completedActivities / activities.length) * 100)

  const toggleActivity = (title: string) => {
    setActivities((prev) =>
      prev.map((activity) =>
        activity.title === title ? { ...activity, completed: !activity.completed } : activity
      )
    )
  }

  const nextBadge = () => setActiveBadgeIndex((prev) => (prev + 1) % achievements.length)
  const prevBadge = () => setActiveBadgeIndex((prev) => (prev - 1 + achievements.length) % achievements.length)

  return (
    <Stack spacing={8}>
      {announcementNode}
      <HStack
        justify="space-between"
        align={{ base: 'flex-start', md: 'center' }}
        spacing={4}
        bg="rgba(255, 255, 255, 0.04)"
        borderRadius="lg"
        border="1px solid"
        borderColor="brand.border"
        p={4}
      >
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.softGold">
            Dashboard tour
          </Text>
          <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
            {isLoading
              ? 'Preparing your guided walkthrough...'
              : hasCompleted
                ? 'Tour complete — replay anytime.'
                : `Resume where you left off at step ${currentStep + 1}.`}
          </Text>
        </VStack>
        <HStack spacing={2}>
          <Button
            aria-label="Start leadership dashboard tour"
            onClick={() => startTour(hasCompleted ? 0 : currentStep)}
            colorScheme="yellow"
            variant="outline"
            size="sm"
            isDisabled={isLoading}
          >
            {hasCompleted ? 'Replay tour' : 'Start guided tour'}
          </Button>
        </HStack>
      </HStack>

      <Flex
        id="dashboard-welcome"
        aria-label="Dashboard welcome panel"
        align={{ base: 'flex-start', md: 'center' }}
        justify="space-between"
        gap={4}
      >
        <Box>
          <Tag size="lg" colorScheme="yellow" bg="rgba(234, 177, 48, 0.2)" color="brand.gold" mb={2}>
            Journey: Leadership Transformation
          </Tag>
          <Text fontSize="3xl" fontWeight="bold" color="brand.gold">
            Welcome back, {profile?.firstName || 'Leader'}
          </Text>
          <Text color="brand.softGold" opacity={0.9}>
            You are on track for week {profile?.currentWeek || 3}. Keep the momentum going today.
          </Text>
        </Box>
        <HStack spacing={4}>
          <VStack align="flex-end" spacing={1} display={{ base: 'none', md: 'flex' }}>
            <Text fontSize="sm" color="brand.softGold" opacity={0.8}>
              Current level
            </Text>
            <Text fontSize="xl" fontWeight="bold" color="brand.gold">
              {profile?.level || 4}
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

      <SimpleGrid
        id="dashboard-stats"
        aria-label="Performance stats"
        columns={{ base: 1, md: 2, xl: 4 }}
        spacing={4}
      >
        <StatCard
          label="Total points"
          value={profile?.totalPoints ?? 1840}
          helper="Earn 160 more to reach the next level"
          icon={Sparkles}
          trendLabel="This week"
          trendValue="+240"
          highlight
        />
        <StatCard
          label="Current level"
          value={profile?.level ?? 4}
          helper="Leadership Catalyst"
          icon={Crown}
        />
        <StatCard
          label="Journey week"
          value={profile?.currentWeek ?? 3}
          helper="8-week program"
          icon={CalendarDays}
        />
        <StatCard
          label="Badges"
          value={12}
          helper="3 new this month"
          icon={Award}
          trendLabel="Next badge"
          trendValue="Complete 2 more activities"
        />
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Card id="weekly-progress" aria-label="Weekly progress overview">
            <CardBody>
              <HStack justify="space-between" align="flex-start" mb={4}>
                <Box>
                  <Text fontWeight="bold" color="brand.softGold">
                    Weekly progress
                  </Text>
                  <Text fontSize="sm" color="brand.softGold" opacity={0.8}>
                    Week {profile?.currentWeek ?? 3} completion status
                  </Text>
                </Box>
                <HStack spacing={2}>
                  <Icon as={TrendingUp} color="brand.gold" />
                  <Text color="brand.gold" fontWeight="bold">
                    {completionRate}%
                  </Text>
                </HStack>
              </HStack>
              <Progress value={completionRate} borderRadius="full" mb={4} />
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Box>
                  <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
                    Activities completed
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color="brand.gold">
                    {completedActivities} / {activities.length}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
                    Estimated points
                  </Text>
                  <Text fontSize="lg" fontWeight="bold" color="brand.gold">
                    {activities.reduce((total, act) => total + (act.completed ? act.points : 0), 0)} pts
                  </Text>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <Card bg="brand.royalPurple">
            <CardBody>
              <HStack mb={3} spacing={3}>
                <Icon as={Rocket} color="brand.gold" />
                <Text fontWeight="bold" color="brand.gold">
                  Quick actions
                </Text>
              </HStack>
              <Stack spacing={3}>
                <Button variant="secondary" leftIcon={<Icon as={Flame} />}>Log new impact</Button>
                <Button variant="secondary" leftIcon={<Icon as={Compass} />}>Review journey plan</Button>
                <Button variant="secondary" leftIcon={<Icon as={CalendarClock} />}>Schedule mentor session</Button>
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
                <Text fontWeight="bold" color="brand.softGold">
                  Current week activities
                </Text>
                <Tag colorScheme="yellow" bg="rgba(234, 177, 48, 0.12)" color="brand.gold">
                  {completedActivities} of {activities.length} complete
                </Tag>
              </HStack>
              <Stack spacing={3}>
                {activities.map((activity) => (
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
          <Card id="dashboard-badges" aria-label="Badge highlights">
            <CardBody>
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="bold" color="brand.softGold">
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

      <Grid templateColumns={{ base: '1fr', xl: '3fr 2fr' }} gap={6}>
        <GridItem>
          <Card id="dashboard-events" aria-label="Upcoming events list">
            <CardBody>
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="bold" color="brand.softGold">
                  Upcoming events
                </Text>
                <Tag variant="gold" color="brand.deepPlum">
                  Next 3
                </Tag>
              </HStack>
              <Stack spacing={3}>
                {events.map((event) => (
                  <Box
                    key={event.title}
                    p={4}
                    borderRadius="lg"
                    border="1px solid rgba(234, 177, 48, 0.2)"
                    bg="rgba(53, 14, 111, 0.5)"
                  >
                    <HStack justify="space-between" mb={1}>
                      <Text fontWeight="semibold" color="brand.softGold">
                        {event.title}
                      </Text>
                      <Tag variant="gold" color="brand.deepPlum">
                        {event.type}
                      </Tag>
                    </HStack>
                    <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
                      {event.date}
                    </Text>
                    <Text fontSize="sm" color="brand.softGold" opacity={0.8}>
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
              <Text fontWeight="bold" color="brand.softGold" mb={3}>
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
                            ? 'brand.flameOrange'
                            : 'rgba(234, 177, 48, 0.3)'
                      }
                    />
                    <VStack align="flex-start" spacing={0} flex={1}>
                      <Text fontWeight="semibold" color="brand.softGold">
                        {milestone.label}
                      </Text>
                      <Text fontSize="xs" color="brand.softGold" opacity={0.8}>
                        {milestone.status === 'complete'
                          ? 'Completed'
                          : milestone.status === 'active'
                            ? 'In progress'
                            : 'Coming up'}
                      </Text>
                    </VStack>
                    {index < milestones.length - 1 && <Divider orientation="vertical" borderColor="rgba(234, 177, 48, 0.3)" />}
                  </Flex>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Card bg="brand.royalPurple">
        <CardBody>
          <HStack spacing={4}>
            <Icon as={Sparkles} color="brand.gold" boxSize={6} />
            <VStack align="flex-start" spacing={1}>
              <Text fontWeight="bold" color="brand.gold">
                Tip of the day
              </Text>
              <Text color="brand.softGold" opacity={0.9}>
                Pair every weekly activity with a micro-reflection. Noting what shifted for you boosts
                retention and earns a bonus 25 points when you submit your impact log.
              </Text>
            </VStack>
          </HStack>
        </CardBody>
      </Card>
    </Stack>
  )
}
