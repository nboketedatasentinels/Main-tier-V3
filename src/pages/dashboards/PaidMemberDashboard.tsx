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
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Tag,
  Text,
  VStack,
} from '@chakra-ui/react'
import { CalendarClock, Compass, Flame, Rocket, Star, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ActivityCard } from '@/components/dashboard/ActivityCard'
import { BadgeCard } from '@/components/dashboard/BadgeCard'
import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'
import { resolveOrgContext } from '@/utils/orgContext'
import { WeeklyInspirationCard } from './components/WeeklyInspirationCard'

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

export const PaidMemberDashboard: React.FC = () => {
  const { profile } = useAuth()
  const context = resolveOrgContext(profile)
  const { inspirationQuote } = useWeeklyGlanceData(context)
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities)
  const [activeBadgeIndex, setActiveBadgeIndex] = useState(0)

  const completedActivities = useMemo(
    () => activities.filter(activity => activity.completed).length,
    [activities],
  )

  const completionRate = useMemo(() => {
    if (!activities.length) return 0
    return Math.round((completedActivities / activities.length) * 100)
  }, [activities.length, completedActivities])

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

      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6}>
        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.goldLight">Total Points</StatLabel>
              <StatNumber color="brand.gold">{profile?.totalPoints || 0}</StatNumber>
              <StatHelpText color="brand.goldLight">This journey</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.goldLight">Level</StatLabel>
              <StatNumber color="brand.gold">{profile?.level || 1}</StatNumber>
              <StatHelpText color="brand.goldLight">Current level</StatHelpText>
            </Stat>
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
              <StatNumber color="brand.gold">0</StatNumber>
              <StatHelpText color="brand.goldLight">Earned</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
        <GridItem>
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
                            ? 'brand.flameOrange'
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
