import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CircularProgress,
  CircularProgressLabel,
  Divider,
  Flex,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  IconButton,
  Link,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Stat,
  StatArrow,
  StatHelpText,
  StatLabel,
  StatNumber,
  Tag,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  ArrowUpRight,
  CheckCircle2,
  CalendarClock,
  Crown,
  Loader2,
  Mail,
  MessageCircle,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { format, formatDistanceToNow, startOfWeek } from 'date-fns'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Timestamp,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  DocumentData,
  Query,
  QueryConstraint,
  QuerySnapshot,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'

interface WeeklyAggregation {
  id: string
  weekStart: Timestamp
  totalPoints: number
  targetPoints: number
  impactBalance: number
  engagementBalance: number
  trend: number
  peopleImpacted: number
  peopleImpactedChange: number
}

interface Assignment {
  ambassador?: {
    name: string
    available?: boolean
    contact?: string
  }
  mentor?: {
    name: string
    available?: boolean
    calendar?: string
  }
}

interface ChecklistItem {
  id: string
  title: string
  points?: number
  completed?: boolean
}

interface LiftProgress {
  educationHours: number
  educationTarget: number
  verifiedHours: number
  selfAttestedHours: number
  givingTarget: number
}

interface PointTransaction {
  id: string
  reason: string
  points: number
  createdAt: Timestamp
}

interface LeaderboardEntry {
  id: string
  name: string
  totalPoints: number
}

interface FAQEntry {
  id: string
  question: string
  answer: string
}

const inspirationQuotes = [
  'You are never too small to make a difference. — Greta Thunberg',
  'Leadership is a choice, not a rank. — Simon Sinek',
  'Be the change you wish to see in the world. — Mahatma Gandhi',
  'Act as if what you do makes a difference. It does. — William James',
  'Small deeds done are better than great deeds planned. — Peter Marshall',
  'The future depends on what you do today. — Mahatma Gandhi',
  'Courage starts with showing up. — Brené Brown',
]

const faqFallback = {
  question: 'How do I keep momentum each week?',
  answer: 'Finish your checklist early, schedule your mentor session, and log small wins daily.',
}

const couponLink = 'https://www.t4leader.com/challenge-page/transformational-leadership'

const useRealtimeCollection = <T,>(
  path: string,
  constraints: QueryConstraint[],
  mapper: (docId: string, data: DocumentData) => T,
) => {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const constraintsKey = useMemo(() => JSON.stringify(constraints), [constraints])

  useEffect(() => {
    const baseQuery: Query<DocumentData> = constraints.length
      ? query(collection(db, path), ...constraints)
      : collection(db, path)

    const unsub = onSnapshot(baseQuery, (snapshot: QuerySnapshot<DocumentData>) => {
      setData(snapshot.docs.map((d) => mapper(d.id, d.data())))
      setLoading(false)
    })

    return () => unsub()
  }, [constraints, constraintsKey, mapper, path])

  return { data, loading }
}

export const CompanyDashboard: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [upgradeDismissed, setUpgradeDismissed] = useState(false)
  const [faq, setFaq] = useState(faqFallback)
  const [liftProgress, setLiftProgress] = useState<LiftProgress | null>(null)

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])

  const { data: weeklyMetrics, loading: weeklyLoading } = useRealtimeCollection<WeeklyAggregation>(
    'weekly_aggregation',
    profile?.id
      ? [where('userId', '==', profile.id), where('weekStart', '==', Timestamp.fromDate(weekStart)), limit(1)]
      : [],
    (id, data) => ({
      id,
      weekStart: data.weekStart,
      totalPoints: data.totalPoints || 0,
      targetPoints: data.targetPoints || 12000,
      impactBalance: data.impactBalance || 0,
      engagementBalance: data.engagementBalance || 0,
      trend: data.trend || 0,
      peopleImpacted: data.peopleImpacted || 0,
      peopleImpactedChange: data.peopleImpactedChange || 0,
    }),
  )

  const { data: assignments } = useRealtimeCollection<Assignment>(
    'user_assignments',
    profile?.id ? [where('userId', '==', profile.id), limit(1)] : [],
    (_, data) => ({
      ambassador: data.ambassador,
      mentor: data.mentor,
    }),
  )

  const { data: checklistItems, loading: checklistLoading } = useRealtimeCollection<ChecklistItem>(
    'weekly_checklist',
    profile?.id
      ? [
          where('userId', '==', profile.id),
          where('weekStart', '==', Timestamp.fromDate(weekStart)),
          orderBy('createdAt', 'asc'),
        ]
      : [],
    (id, data) => ({
      id,
      title: data.title,
      points: data.points,
      completed: data.completed,
    }),
  )

  const { data: transactions, loading: transactionsLoading } = useRealtimeCollection<PointTransaction>(
    'points_transactions',
    profile?.id
      ? [where('userId', '==', profile.id), orderBy('createdAt', 'desc'), limit(5)]
      : [],
    (id, data) => ({
      id,
      reason: data.reason || 'Activity',
      points: data.points || 0,
      createdAt: data.createdAt,
    }),
  )

  const { data: leaderboard, loading: leaderboardLoading } = useRealtimeCollection<LeaderboardEntry>(
    'leaderboard_summary',
    profile?.companyCode
      ? [where('company_code', '==', profile.companyCode), orderBy('total_points', 'desc'), limit(10)]
      : [],
    (id, data) => ({ id, name: data.name || 'Teammate', totalPoints: data.total_points || 0 }),
  )

  const { data: faqEntries } = useRealtimeCollection<FAQEntry>(
    'faqs',
    [where('isVisible', '==', true)],
    (id, data) => ({ id, question: data.question || '', answer: data.answer || '' }),
  )

  useEffect(() => {
    const stored = localStorage.getItem('company-dashboard-upgrade-dismissed')
    if (stored === 'true') setUpgradeDismissed(true)
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    const unsub = onSnapshot(doc(db, 'lift_progress', profile.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<LiftProgress>
        setLiftProgress({
          educationHours: data.educationHours ?? 0,
          educationTarget: data.educationTarget ?? 10,
          verifiedHours: data.verifiedHours ?? 0,
          selfAttestedHours: data.selfAttestedHours ?? 0,
          givingTarget: data.givingTarget ?? 10,
        })
      }
    })
    return () => unsub()
  }, [profile?.id])

  useEffect(() => {
    const weekNumber = Number(format(weekStart, 'I'))
    if (faqEntries.length === 0) {
      setFaq({ question: faqFallback.question, answer: faqFallback.answer })
      return
    }

    const idx = weekNumber % faqEntries.length
    const entry = faqEntries[idx]
    setFaq({ question: entry.question, answer: entry.answer })
  }, [weekStart, faqEntries])

  const weekly = weeklyMetrics[0]
  const assignment = assignments[0]

  const checklistProgress = useMemo(() => {
    if (!checklistItems.length) return { completed: 0, total: 0, percent: 0 }
    const completed = checklistItems.filter((item) => item.completed).length
    const total = checklistItems.length
    const percent = Math.round((completed / total) * 100)
    return { completed, total, percent }
  }, [checklistItems])

  const statusColor: 'green' | 'orange' | 'red' =
    checklistProgress.percent >= 80 ? 'green' : checklistProgress.percent >= 50 ? 'orange' : 'red'

  const hideUpgrade = profile?.role !== UserRole.FREE_USER

  const villageDisplayName = profile?.companyName || profile?.companyCode

  const personalitySummary = profile?.personalityType
    ? `${profile.personalityType} • Your personality insights`
    : 'Take the 16Personalities assessment to unlock insights.'

  const weeklyQuote = useMemo(() => {
    const weekNumber = Number(format(weekStart, 'I'))
    return inspirationQuotes[weekNumber % inspirationQuotes.length]
  }, [weekStart])

  const weeklyTargetStatus = useMemo(() => {
    if (!weekly)
      return {
        label: 'Below Target',
        difference: 0,
        bg: 'red.50',
        text: 'red.700',
        border: 'red.200',
      }

    const diff = weekly.totalPoints - weekly.targetPoints
    if (weekly.totalPoints >= weekly.targetPoints * 1.1) {
      return { label: 'Exceeding Target', difference: diff, bg: 'green.50', text: 'green.700', border: 'green.200' }
    }
    if (weekly.totalPoints >= weekly.targetPoints) {
      return { label: 'On Track', difference: diff, bg: 'yellow.50', text: 'yellow.700', border: 'yellow.200' }
    }
    return { label: 'Below Target', difference: diff, bg: 'red.50', text: 'red.700', border: 'red.200' }
  }, [weekly])

  const handleDismissUpgrade = useCallback(() => {
    localStorage.setItem('company-dashboard-upgrade-dismissed', 'true')
    setUpgradeDismissed(true)
  }, [])

  const peerWeekRange = useMemo(() => {
    const start = weekStart
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
  }, [weekStart])

  const peerMatchName = useMemo(() => {
    if (!profile?.firstName) return 'Peer match pending'
    const seed = profile.id + format(weekStart, 'yyyy-MM-dd')
    const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const peers = ['Jordan', 'Taylor', 'Alex', 'Sam', 'Casey', 'Avery']
    return peers[hash % peers.length]
  }, [profile?.firstName, profile?.id, weekStart])

  const renderStat = (label: string, value: string | number, helper?: string) => (
    <Stat>
      <StatLabel color="brand.textOnDark">{label}</StatLabel>
      <StatNumber color="white">{value}</StatNumber>
      {helper && <StatHelpText color="brand.textOnDark">{helper}</StatHelpText>}
    </Stat>
  )

  const topTasks = useMemo(() => checklistItems.filter((item) => !item.completed).slice(0, 5), [checklistItems])

  const taskStatusLabel = useMemo(() => {
    if (checklistProgress.percent >= 80) return 'On track'
    if (checklistProgress.percent >= 50) return 'Making progress'
    return 'Needs attention'
  }, [checklistProgress])

  const totalLiftHours = useMemo(
    () => (liftProgress?.educationHours || 0) + (liftProgress?.verifiedHours || 0) + (liftProgress?.selfAttestedHours || 0),
    [liftProgress],
  )

  return (
    <Stack spacing={8} pb={16}>
      {!hideUpgrade && !upgradeDismissed && (
        <Flex
          align="center"
          justify="space-between"
          bgGradient="linear(to-r, blue.600, blue.800)"
          p={4}
          borderRadius="lg"
          color="white"
          boxShadow="lg"
        >
          <Box>
            <Heading size="md">Upgrade for the full experience</Heading>
            <Text opacity={0.9}>Unlock vlogs, premium courses, and community challenges</Text>
          </Box>
          <HStack spacing={3}>
            <Button as={RouterLink} to="/upgrade" colorScheme="yellow" rightIcon={<ArrowUpRight size={16} />}>
              Upgrade Now
            </Button>
            <IconButton aria-label="Dismiss upgrade banner" icon={<X size={16} />} onClick={handleDismissUpgrade} />
          </HStack>
        </Flex>
      )}

      <Box>
          <HStack spacing={3} align={{ base: 'flex-start', md: 'center' }} flexWrap="wrap" mb={2}>
            <Heading size="lg">This Week at a Glance</Heading>
            {villageDisplayName && (
              <Badge colorScheme="purple" borderRadius="full">
                for {villageDisplayName}
              </Badge>
            )}
          <HStack color="green.400" fontSize="sm">
            <CheckCircle2 size={16} />
            <Text>Updated {formatDistanceToNow(new Date(), { addSuffix: true })}</Text>
          </HStack>
        </HStack>
        <Text color="gray.500" mb={6}>
          Track your impact, progress, and community connections in one place
        </Text>

        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }} gap={4}>
          <GridItem colSpan={{ base: 1, xl: 2 }}>
            <Card h="100%" shadow="lg" borderColor="brand.border">
              <CardBody>
                <Flex justify="space-between" align="flex-start" mb={4}>
                  <Box>
                    <Text fontWeight="bold" color="gray.500" textTransform="uppercase" fontSize="sm">
                      Weekly Points
                    </Text>
                    <Heading size="lg">
                      {weeklyLoading ? <Skeleton height="28px" width="120px" /> : weekly?.totalPoints || 0}
                    </Heading>
                    <HStack spacing={2} color={weekly?.trend >= 0 ? 'green.500' : 'red.400'}>
                      <Icon as={weekly?.trend >= 0 ? TrendingUp : TrendingDown} />
                      <Text fontSize="sm">
                        {weekly?.trend ? `${weekly.trend.toFixed(1)}% change` : 'No change'}
                      </Text>
                    </HStack>
                  </Box>
                  <Tag colorScheme="yellow" size="lg">
                    Target: {weekly?.targetPoints || 12000} pts
                  </Tag>
                </Flex>

                <Flex p={4} borderRadius="md" bg={weeklyTargetStatus.bg} border="1px solid" borderColor={weeklyTargetStatus.border} justify="space-between" align="center" mb={4}>
                  <VStack align="flex-start" spacing={0}>
                    <Text fontWeight="semibold" color={weeklyTargetStatus.text}>
                      {weeklyTargetStatus.label}
                    </Text>
                    <Text fontSize="sm" color={weeklyTargetStatus.text}>
                      {weeklyTargetStatus.difference >= 0
                        ? `${weeklyTargetStatus.difference.toLocaleString()} pts above target`
                        : `${Math.abs(weeklyTargetStatus.difference).toLocaleString()} pts to reach baseline`}
                    </Text>
                  </VStack>
                  <Badge colorScheme="yellow">Weekly target status</Badge>
                </Flex>

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <Card bg="gray.50">
                    <CardBody>
                      {renderStat('Impact Balance', weekly?.impactBalance || 0, 'Last updated today')}
                    </CardBody>
                  </Card>
                  <Card bg="gray.50">
                    <CardBody>{renderStat('Engagement Balance', weekly?.engagementBalance || 0, 'Last updated today')}</CardBody>
                  </Card>
                </SimpleGrid>
              </CardBody>
            </Card>
          </GridItem>

          <Card shadow="lg">
            <CardBody>
              <Text fontWeight="bold" color="gray.500" mb={2}>
                Support Team
              </Text>
              <VStack align="stretch" spacing={4}>
                <Box>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="sm" color="gray.500" fontWeight="bold">
                      Ambassador Status
                    </Text>
                    {assignment?.ambassador?.available && <Badge colorScheme="green">Available</Badge>}
                  </HStack>
                  <Text fontWeight="semibold">
                    {assignment?.ambassador?.name || 'No ambassador assigned'}
                  </Text>
                  {assignment?.ambassador?.contact && (
                    <Button
                      as={Link}
                      href={`mailto:${assignment.ambassador.contact}`}
                      leftIcon={<Mail size={16} />}
                      size="sm"
                      variant="outline"
                      mt={2}
                    >
                      Message
                    </Button>
                  )}
                </Box>
                <Divider />
                <Box>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="sm" color="gray.500" fontWeight="bold">
                      Mentor
                    </Text>
                    {assignment?.mentor?.available && <Badge colorScheme="green">Available</Badge>}
                  </HStack>
                  <Text fontWeight="semibold">{assignment?.mentor?.name || 'No mentor assigned'}</Text>
                {assignment?.mentor?.calendar && (
                  <Button
                    as={Link}
                    href={assignment.mentor.calendar}
                    leftIcon={<CalendarClock size={16} />}
                      size="sm"
                      variant="outline"
                      mt={2}
                      target="_blank"
                    >
                      Schedule
                    </Button>
                  )}
                </Box>
              </VStack>
            </CardBody>
          </Card>

          <Card shadow="lg">
            <CardBody>
              <HStack justify="space-between" align="flex-start" mb={2}>
                <Text fontWeight="bold" color="gray.500">
                  Personality Profile
                </Text>
                <Badge colorScheme="purple">Metric</Badge>
              </HStack>
              <Text fontWeight="semibold">{profile?.firstName}</Text>
              <Text color="gray.600" mb={3}>
                {personalitySummary}
              </Text>
              <Button variant="outline" size="sm">
                View details
              </Button>
            </CardBody>
          </Card>

          <Card shadow="lg">
            <CardBody>
              <HStack justify="space-between" mb={2}>
                <Text fontWeight="bold" color="gray.500">
                  People Impacted
                </Text>
                <Icon as={Users} color="purple.500" />
              </HStack>
              {weeklyLoading ? (
                <Skeleton height="40px" />
              ) : (
                <Heading size="lg">{weekly?.peopleImpacted || 0}</Heading>
              )}
              <HStack color={weekly?.peopleImpactedChange && weekly.peopleImpactedChange >= 0 ? 'green.500' : 'gray.500'}>
                <StatArrow type={weekly?.peopleImpactedChange && weekly.peopleImpactedChange >= 0 ? 'increase' : 'decrease'} />
                <Text fontSize="sm">
                  {weekly?.peopleImpactedChange ? `${weekly.peopleImpactedChange}% vs last week` : 'No change'}
                </Text>
              </HStack>
              <Text color="gray.500" mt={2}>
                Individuals helped through your actions
              </Text>
            </CardBody>
          </Card>

          <Card shadow="lg">
            <CardBody>
              <HStack justify="space-between">
                <Text fontWeight="bold" color="gray.500">
                  Peer Matching
                </Text>
                <Badge colorScheme="blue">Week of {peerWeekRange}</Badge>
              </HStack>
              {profile?.companyCode ? (
                <>
                  <Text fontWeight="semibold" mt={2}>
                    {peerMatchName ? `You are matched with ${peerMatchName}` : 'No match yet'}
                  </Text>
                  <Text color="gray.500" fontSize="sm" mt={1}>
                    Deterministic weekly match based on your company cohort
                  </Text>
                  <Button
                    mt={3}
                    variant="outline"
                    colorScheme="blue"
                    onClick={() => navigate('/app/peer-connect?peerTab=sessions')}
                  >
                    Open Peer Connect
                  </Button>
                </>
              ) : (
                <>
                  <Text fontWeight="semibold" mt={2}>
                    No match yet
                  </Text>
                  <Text color="gray.500" fontSize="sm" mt={1}>
                    Weekly matching activates once you join a corporate village.
                  </Text>
                  <Button mt={3} variant="outline" colorScheme="blue" onClick={() => navigate('/app/peer-connect?peerTab=sessions')}>
                    Open Peer Connect
                  </Button>
                </>
              )}
            </CardBody>
          </Card>

          <Card shadow="lg">
            <CardBody>
              <HStack justify="space-between" align="center" mb={2}>
                <Text fontWeight="bold" color="gray.500">
                  Weekly Inspiration
                </Text>
                <Icon as={Sparkles} color="orange.400" />
              </HStack>
              <Text fontStyle="italic" mb={1}>
                "{weeklyQuote.split('—')[0].trim()}"
              </Text>
              <Text color="gray.600">— {weeklyQuote.split('—')[1]?.trim()}</Text>
              <Text mt={2} color="gray.500" fontSize="sm">
                Fresh perspective to share with your team
              </Text>
            </CardBody>
          </Card>
        </Grid>
      </Box>

      {profile?.role !== UserRole.FREE_USER && (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          <Card shadow="lg">
            <CardBody>
              <Text fontWeight="bold">Book 1-on-1</Text>
              <Text color="gray.500" fontSize="sm">
                Opens scheduling link
              </Text>
              <Button
                mt={3}
                as={Link}
                href="https://calendar.app.google/dPeRKYFBSQe5K7ya7"
                target="_blank"
                colorScheme="blue"
                rightIcon={<ArrowUpRight size={16} />}
              >
                Schedule
              </Button>
            </CardBody>
          </Card>

          <Card shadow="lg">
            <CardBody>
              <Text fontWeight="bold">Sync Calendar</Text>
              <Text color="gray.500" fontSize="sm">
                Keeps events in sync
              </Text>
              <Button mt={3} colorScheme="blue" variant="outline" onClick={() => navigate('/app/weekly-checklist')}>
                Open Calendar Sync
              </Button>
            </CardBody>
          </Card>

          <Card shadow="lg">
            <CardBody>
              <Text fontWeight="bold">Join WhatsApp Community</Text>
              <Text color="gray.500" fontSize="sm">
                Community accountability and updates
              </Text>
              <Button
                mt={3}
                as={Link}
                href="https://chat.whatsapp.com/GlioRkWeQ36LxxFeBZc8SW"
                target="_blank"
                colorScheme="green"
                rightIcon={<MessageCircle size={16} />}
              >
                Open WhatsApp
              </Button>
            </CardBody>
          </Card>
        </SimpleGrid>
      )}

      <Card shadow="lg">
        <CardBody>
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="bold">Weekly Tasks</Text>
              <Badge colorScheme={statusColor}>
                {checklistProgress.completed}/{checklistProgress.total} activities completed — {taskStatusLabel}
              </Badge>
            </HStack>
          <Progress value={checklistProgress.percent} colorScheme={statusColor} mb={3} />
          <Text color="gray.500" fontSize="sm" mb={2}>
            {checklistProgress.total - checklistProgress.completed} pending | {checklistProgress.percent}% complete
          </Text>
          {checklistLoading ? (
            <Skeleton height="20px" />
          ) : topTasks.length === 0 ? (
            <Text color="gray.500">You're all caught up! Keep the momentum going...</Text>
          ) : (
            <VStack align="stretch" spacing={3}>
              {topTasks.map((task) => (
                <Flex
                  key={task.id}
                  justify="space-between"
                  p={3}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="gray.100"
                  bg="gray.50"
                >
                  <Box>
                    <Text fontWeight="semibold">{task.title}</Text>
                    <Text fontSize="sm" color="gray.500">
                      {task.points ? `${task.points} pts` : 'Action needed'}
                    </Text>
                  </Box>
                  <Badge colorScheme="orange">Ready to finish</Badge>
                </Flex>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>

      {profile?.role === UserRole.FREE_USER && (
        <Card shadow="lg" bg="white">
          <CardBody>
            <HStack justify="space-between" align="center">
              <Box>
                <Heading size="md">Free Course Access</Heading>
                <Text color="gray.600">Transformational Leadership</Text>
                <Text fontWeight="bold" color="purple.600">
                  Coupon Code: T4LIFT
                </Text>
              </Box>
              <Button as={Link} href={couponLink} colorScheme="purple" target="_blank">
                Open Course
              </Button>
            </HStack>
          </CardBody>
        </Card>
      )}

      <Card shadow="lg">
        <CardBody>
          <HStack justify="space-between" align="flex-start" mb={4}>
              <Box>
                <Heading size="md">LIFT Progress</Heading>
                <Text color="gray.500">Track your annual 20 hour goal</Text>
              </Box>
            <Badge colorScheme="green">In good standing</Badge>
          </HStack>
          <Flex align="center" gap={6} flexWrap="wrap">
            <CircularProgress
              value={(totalLiftHours / 20) * 100}
              color="purple.500"
              size="140px"
              thickness="10px"
            >
              <CircularProgressLabel textAlign="center">
                <Text fontWeight="bold">
                  {totalLiftHours.toFixed(1)}
                  /20 hrs
                </Text>
                <Text fontSize="xs">Annual goal</Text>
              </CircularProgressLabel>
            </CircularProgress>

            <VStack align="stretch" spacing={3} flex="1">
              <Box>
                <HStack justify="space-between">
                  <Text fontWeight="semibold">Education</Text>
                  <Text color="gray.600">
                    {liftProgress?.educationHours || 0} / {liftProgress?.educationTarget || 10} hrs
                  </Text>
                </HStack>
                <Progress value={((liftProgress?.educationHours || 0) / (liftProgress?.educationTarget || 10)) * 100} mt={2} />
              </Box>

              <Box>
                <HStack justify="space-between">
                  <Text fontWeight="semibold">Giving Back</Text>
                  <Text color="gray.600">
                    {(liftProgress?.verifiedHours || 0) + (liftProgress?.selfAttestedHours || 0)} / {liftProgress?.givingTarget || 10} hrs
                  </Text>
                </HStack>
                <Progress
                  value={(((liftProgress?.verifiedHours || 0) + (liftProgress?.selfAttestedHours || 0)) / (liftProgress?.givingTarget || 10)) * 100}
                  mt={2}
                  colorScheme="green"
                />
                <HStack spacing={3} mt={1} color="gray.500" fontSize="sm">
                  <Badge colorScheme="green">Verified {(liftProgress?.verifiedHours || 0).toFixed(1)} hrs</Badge>
                  <Badge colorScheme="blue">Self-attested {(liftProgress?.selfAttestedHours || 0).toFixed(1)} hrs</Badge>
                </HStack>
              </Box>
              <Button alignSelf="flex-start" colorScheme="purple">
                Report Hours
              </Button>
            </VStack>
          </Flex>
        </CardBody>
      </Card>

      <Card shadow="lg">
        <CardBody>
          <Heading size="md" mb={2}>
            Pro Tip
          </Heading>
          <Text fontWeight="semibold">{faq.question}</Text>
          <Text color="gray.600">{faq.answer}</Text>
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={4}>
        <Card shadow="lg">
          <CardBody>
            <Flex justify="space-between" align="center" mb={4}>
              <HStack>
                <Icon as={Star} color="yellow.400" />
                <Heading size="md">Points & Activity</Heading>
              </HStack>
              <Badge colorScheme="yellow">{profile?.totalPoints || 0} XP</Badge>
            </Flex>

            <Stack spacing={4}>
              <Box>
                <Text fontWeight="bold" mb={1}>
                  Total Points
                </Text>
                <HStack spacing={3} align="center">
                  <Star size={18} color="#d69e2e" />
                  <Heading size="lg" color="yellow.600">
                    {(profile?.totalPoints || weekly?.totalPoints || 0).toLocaleString()} XP
                  </Heading>
                </HStack>
              </Box>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Box p={3} borderRadius="md" border="1px solid" borderColor="gray.100" bg="gray.50">
                  <Text fontWeight="bold">Ranking</Text>
                  {profile?.role === UserRole.FREE_USER ? (
                    <VStack align="flex-start" spacing={2} mt={1}>
                      <Text color="gray.600" fontSize="sm">
                        Unlock rankings when you upgrade.
                      </Text>
                      <Button size="sm" colorScheme="yellow" as={RouterLink} to="/upgrade">
                        Upgrade to view
                      </Button>
                    </VStack>
                  ) : (
                    <Text color="gray.600" fontSize="sm" mt={1}>
                      Coming soon
                    </Text>
                  )}
                </Box>
                <Box p={3} borderRadius="md" border="1px solid" borderColor="gray.100" bg="gray.50">
                  <Text fontWeight="bold">Upcoming Challenges</Text>
                  {profile?.role === UserRole.FREE_USER ? (
                    <VStack align="flex-start" spacing={2} mt={1}>
                      <Text color="gray.600" fontSize="sm">
                        Upgrade for premium challenges.
                      </Text>
                      <Button size="sm" colorScheme="purple" as={RouterLink} to="/upgrade">
                        View plans
                      </Button>
                    </VStack>
                  ) : (
                    <Text color="gray.600" fontSize="sm" mt={1}>
                      No upcoming challenges
                    </Text>
                  )}
                </Box>
              </SimpleGrid>

              <Box>
                <Text fontWeight="bold">Recent Wins</Text>
                <Text color="gray.500" fontSize="sm">
                  {transactionsLoading ? 'Loading...' : 'No recent wins'}
                </Text>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2}>
                  Recent Activity
                </Text>
                {transactionsLoading ? (
                  <Loader2 className="spin" />
                ) : transactions.length === 0 ? (
                  <Text color="gray.500">No recent activity</Text>
                ) : (
                  <VStack align="stretch" spacing={3}>
                    {transactions.map((tx) => (
                      <Flex key={tx.id} justify="space-between" align="center" borderBottom="1px solid" borderColor="gray.100" pb={2}>
                        <Box>
                          <Text fontWeight="semibold">{tx.reason}</Text>
                          <Text fontSize="sm" color="gray.500">
                            {tx.createdAt ? format(tx.createdAt.toDate(), 'MMM d, yyyy') : 'Pending'}
                          </Text>
                        </Box>
                        <Badge colorScheme={tx.points >= 0 ? 'green' : 'red'}>{tx.points} XP</Badge>
                      </Flex>
                    ))}
                    {profile?.companyCode && (
                      <Flex justify="space-between" align="center" borderBottom="1px solid" borderColor="gray.100" pb={2}>
                        <Box>
                          <Text fontWeight="semibold">Welcome to your corporate village</Text>
                          <Text fontSize="sm" color="gray.500">
                            Joining bonus
                          </Text>
                        </Box>
                        <Badge colorScheme="green">+200 XP</Badge>
                      </Flex>
                    )}
                  </VStack>
                )}
              </Box>
            </Stack>
          </CardBody>
        </Card>

        {profile?.companyCode && (
          <Card shadow="lg">
            <CardBody>
              <Flex justify="space-between" align="center" mb={3}>
                <HStack>
                  <Icon as={Crown} color="purple.500" />
                  <Heading size="md">Company Leaderboard</Heading>
                </HStack>
                {leaderboardLoading && <Loader2 className="spin" />}
              </Flex>
              {leaderboardLoading ? (
                <Skeleton height="80px" />
              ) : leaderboard.length === 0 ? (
                <Text color="gray.500">No teammates found in your company yet</Text>
              ) : (
                <VStack align="stretch" spacing={2}>
                  {leaderboard.map((entry, idx) => (
                    <Flex
                      key={entry.id}
                      align="center"
                      justify="space-between"
                      p={2}
                      borderRadius="md"
                      bg={idx === 0 ? 'purple.50' : 'gray.50'}
                      border="1px solid"
                      borderColor="gray.100"
                    >
                      <HStack spacing={3}>
                        <Badge colorScheme={idx === 0 ? 'purple' : 'gray'}>{idx + 1}</Badge>
                        <Avatar size="sm" name={entry.name} />
                        <Text fontWeight={idx === 0 ? 'bold' : 'semibold'}>{entry.name}</Text>
                      </HStack>
                      <Text fontWeight="bold">{entry.totalPoints} pts</Text>
                    </Flex>
                  ))}
                </VStack>
              )}
            </CardBody>
          </Card>
        )}
      </Grid>
    </Stack>
  )
}

export default CompanyDashboard
