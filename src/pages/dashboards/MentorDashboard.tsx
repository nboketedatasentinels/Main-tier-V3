import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
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
  Input,
  InputGroup,
  InputLeftElement,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Tag,
  TagLabel,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Flag,
  History,
  Lightbulb,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Save,
  Target,
  TrendingUp,
  UserX,
  Users,
  Eye,
} from 'lucide-react'
import { differenceInCalendarDays, format, isToday } from 'date-fns'
import { MentorDashboardLayout } from '@/layouts/MentorDashboardLayout'
import { useAuth } from '@/hooks/useAuth'
import { deriveFallbackRisk, type RiskLevel } from '@/services/mentorDashboardService'

interface MenteeProfile {
  id: string
  name: string
  email: string
  company: string
  program: string
  programDuration: string
  timezone: string
  lastActive: string
  weeklyActivity: number
  goalsCompleted: number
  goalsTotal: number
  milestonesProgress: number
  checkIns: {
    status: 'on-time' | 'overdue' | 'pending'
    last: string
  }
  progress: number
  scheduleLink?: string
}

interface SessionItem {
  id: string
  menteeId: string
  topic: string
  start: Date
  status: 'upcoming' | 'completed' | 'cancelled' | 'rescheduled'
  requiresNotes?: boolean
}

interface NotificationItem {
  id: string
  message: string
  read: boolean
  createdAt: Date
}

interface ActivityItem {
  id: string
  message: string
  timeAgo: string
}

const riskStyles: Record<RiskLevel, { color: string; bg: string; label: string }> = {
  engaged: { color: 'green.700', bg: 'green.50', label: 'Engaged' },
  watch: { color: 'orange.700', bg: 'orange.50', label: 'Monitor' },
  concern: { color: 'red.700', bg: 'red.50', label: 'Concern' },
  critical: { color: 'red.800', bg: 'red.100', label: 'Critical' },
}

const weeklyComparison = [
  {
    label: 'Sessions Completed',
    current: 12,
    previous: 9,
    icon: CalendarClock,
  },
  {
    label: 'Resources Shared',
    current: 18,
    previous: 15,
    icon: BookOpen,
  },
  {
    label: 'Check-ins Reviewed',
    current: 22,
    previous: 19,
    icon: Activity,
  },
]

const formatPercentageChange = (current: number, previous: number) => {
  if (previous === 0) return '—'
  const delta = current - previous
  const percent = Math.round((delta / previous) * 100)
  if (percent === 0) return '0%'
  return `${percent > 0 ? '+' : ''}${percent}%`
}

const calcTrendIcon = (current: number, previous: number) => {
  if (current === previous) return null
  return current > previous ? 'up' : 'down'
}

export const MentorDashboard: React.FC = () => {
  const { profile } = useAuth()
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [savedFilters, setSavedFilters] = useState<string[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null)

  const menteeDirectory: MenteeProfile[] = useMemo(
    () => [
      {
        id: '1',
        name: 'Lina Chen',
        email: 'lina.chen@aurora.dev',
        company: 'Aurora Dev',
        program: 'Impact Accelerator',
        programDuration: '12 weeks',
        timezone: 'GMT+1',
        lastActive: '2024-04-09T12:00:00Z',
        weeklyActivity: 3,
        goalsCompleted: 4,
        goalsTotal: 6,
        milestonesProgress: 72,
        checkIns: {
          status: 'on-time',
          last: '2024-04-08T09:00:00Z',
        },
        progress: 82,
        scheduleLink: 'https://calendar.app/lina',
      },
      {
        id: '2',
        name: 'Diego Martínez',
        email: 'diego.martinez@stellar.mx',
        company: 'Stellar Systems',
        program: 'Leadership Sprint',
        programDuration: '10 weeks',
        timezone: 'GMT-6',
        lastActive: '2024-04-02T18:00:00Z',
        weeklyActivity: 1,
        goalsCompleted: 3,
        goalsTotal: 7,
        milestonesProgress: 54,
        checkIns: {
          status: 'pending',
          last: '2024-03-29T14:00:00Z',
        },
        progress: 64,
        scheduleLink: 'https://calendar.app/diego',
      },
      {
        id: '3',
        name: 'Amina Idris',
        email: 'amina.idris@uplink.io',
        company: 'Uplink',
        program: 'Discovery Path',
        programDuration: '8 weeks',
        timezone: 'GMT+3',
        lastActive: '2024-03-15T10:00:00Z',
        weeklyActivity: 0,
        goalsCompleted: 2,
        goalsTotal: 6,
        milestonesProgress: 38,
        checkIns: {
          status: 'overdue',
          last: '2024-03-10T10:00:00Z',
        },
        progress: 48,
      },
      {
        id: '4',
        name: 'Nova Labs Team',
        email: 'team@novalabs.ai',
        company: 'Nova Labs',
        program: 'Team Growth',
        programDuration: '16 weeks',
        timezone: 'GMT-5',
        lastActive: '2024-04-06T11:00:00Z',
        weeklyActivity: 2,
        goalsCompleted: 5,
        goalsTotal: 8,
        milestonesProgress: 66,
        checkIns: {
          status: 'on-time',
          last: '2024-04-05T11:00:00Z',
        },
        progress: 70,
      },
    ],
    []
  )

  const sessionSchedule: SessionItem[] = useMemo(
    () => [
      {
        id: 's1',
        menteeId: '1',
        topic: 'Career Narrative Review',
        start: new Date(),
        status: 'upcoming',
        requiresNotes: false,
      },
      {
        id: 's2',
        menteeId: '2',
        topic: 'Portfolio Feedback',
        start: new Date(new Date().setHours(new Date().getHours() + 3)),
        status: 'upcoming',
        requiresNotes: true,
      },
      {
        id: 's3',
        menteeId: '3',
        topic: 'Expectation Reset',
        start: new Date(new Date().setDate(new Date().getDate() - 1)),
        status: 'completed',
        requiresNotes: true,
      },
      {
        id: 's4',
        menteeId: '4',
        topic: 'Sprint Retrospective',
        start: new Date(new Date().setDate(new Date().getDate() + 2)),
        status: 'rescheduled',
        requiresNotes: false,
      },
    ],
    []
  )

  const notifications: NotificationItem[] = useMemo(
    () => [
      { id: 'n1', message: 'New check-in from Nova Labs Team', read: false, createdAt: new Date() },
      { id: 'n2', message: 'Amina missed her weekly check-in', read: false, createdAt: new Date() },
      { id: 'n3', message: 'Session summary needed for Diego', read: true, createdAt: new Date() },
    ],
    []
  )

  const recentActivity: ActivityItem[] = useMemo(
    () => [
      { id: 'a1', message: 'Shared resource "Career Map" with Lina', timeAgo: '12m ago' },
      { id: 'a2', message: 'Reviewed Nova Labs check-in', timeAgo: '30m ago' },
      { id: 'a3', message: 'Scheduled session with Diego', timeAgo: '1h ago' },
      { id: 'a4', message: 'Saved filter "Top performers"', timeAgo: '2h ago' },
    ],
    []
  )

  useEffect(() => {
    const storageKey = `mentor-dashboard:${profile?.id || 'guest'}:search-history`
    const savedKey = `mentor-dashboard:${profile?.id || 'guest'}:saved-filters`
    if (typeof window === 'undefined') return
    const storedHistory = localStorage.getItem(storageKey)
    const storedFilters = localStorage.getItem(savedKey)
    if (storedHistory) setSearchHistory(JSON.parse(storedHistory))
    if (storedFilters) setSavedFilters(JSON.parse(storedFilters))
  }, [profile?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = `mentor-dashboard:${profile?.id || 'guest'}:search-history`
    localStorage.setItem(storageKey, JSON.stringify(searchHistory.slice(0, 8)))
  }, [profile?.id, searchHistory])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedKey = `mentor-dashboard:${profile?.id || 'guest'}:saved-filters`
    localStorage.setItem(savedKey, JSON.stringify(savedFilters.slice(0, 8)))
  }, [profile?.id, savedFilters])

  useEffect(() => {
    const handle = setTimeout(() => setSearchTerm(searchInput.trim()), 250)
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    const timer = setTimeout(() => {
      setActivityLoading(false)
      setActivityError(null)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  const menteesWithRisk = useMemo(
    () =>
      menteeDirectory.map((mentee) => {
        const daysSinceLastActive = differenceInCalendarDays(new Date(), new Date(mentee.lastActive))
        const risk = deriveFallbackRisk({
          daysSinceLastActive,
          weeklyActivity: mentee.weeklyActivity,
        })
        return {
          ...mentee,
          risk,
          daysSinceLastActive,
        }
      }),
    [menteeDirectory]
  )

  const filteredMentees = useMemo(() => {
    let results = menteesWithRisk
    if (riskFilter !== 'all') {
      results = results.filter((mentee) => mentee.risk.level === riskFilter)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      results = results.filter(
        (mentee) =>
          mentee.name.toLowerCase().includes(term) ||
          mentee.email.toLowerCase().includes(term) ||
          mentee.company.toLowerCase().includes(term) ||
          mentee.program.toLowerCase().includes(term)
      )
    }
    return results
  }, [menteesWithRisk, riskFilter, searchTerm])

  const selectedMentee = useMemo(() => {
    if (selectedMenteeId) return menteesWithRisk.find((mentee) => mentee.id === selectedMenteeId)
    return menteesWithRisk[0]
  }, [menteesWithRisk, selectedMenteeId])

  const todaysSessions = useMemo(
    () => sessionSchedule.filter((session) => isToday(session.start)),
    [sessionSchedule]
  )

  const upcomingSessions = useMemo(
    () => sessionSchedule.filter((session) => session.start > new Date()),
    [sessionSchedule]
  )

  const pendingSummary = useMemo(() => {
    const overdue = sessionSchedule.filter((session) => session.status === 'rescheduled').length
    const needsNotes = sessionSchedule.filter((session) => session.requiresNotes).length
    const unreadNotifications = notifications.filter((notification) => !notification.read).length
    return {
      overdue,
      needsNotes,
      unreadNotifications,
      total: overdue + needsNotes + unreadNotifications,
    }
  }, [notifications, sessionSchedule])

  const averageProgress = useMemo(() => {
    const total = menteesWithRisk.reduce((sum, mentee) => sum + mentee.progress, 0)
    return Math.round(total / menteesWithRisk.length)
  }, [menteesWithRisk])

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total mentees',
        value: menteesWithRisk.length,
        helper: 'Assigned mentees',
        icon: Users,
      },
      {
        label: 'Upcoming sessions',
        value: upcomingSessions.length,
        helper: 'Next 7 days',
        icon: Calendar,
      },
      {
        label: 'Pending actions',
        value: pendingSummary.total,
        helper: 'Overdue + missing notes + unread',
        icon: AlertCircle,
      },
      {
        label: 'Avg. mentee progress',
        value: `${averageProgress}%`,
        helper: 'Across all mentees',
        icon: TrendingUp,
      },
    ],
    [averageProgress, menteesWithRisk.length, pendingSummary.total, upcomingSessions.length]
  )

  const motivationalMessage = useMemo(() => {
    if (weeklyComparison[0].current > weeklyComparison[0].previous) {
      return 'Sessions are trending up. Keep the momentum with quick follow-ups today.'
    }
    if (weeklyComparison[1].current > weeklyComparison[1].previous) {
      return 'Resources are resonating. Share one more playbook with a mentee on the fence.'
    }
    if (averageProgress > 75) {
      return 'Most mentees are on track. Focus on those who are slipping behind to keep balance.'
    }
    return 'Consistency wins. A focused check-in today can unblock an at-risk mentee.'
  }, [averageProgress])

  const searchSuggestions = useMemo(() => {
    if (!searchInput) return []
    const term = searchInput.toLowerCase()
    const suggestions = menteeDirectory
      .map((mentee) => [mentee.name, mentee.email, mentee.company, mentee.program])
      .flat()
      .filter((value) => value.toLowerCase().includes(term))
    return Array.from(new Set(suggestions)).slice(0, 5)
  }, [menteeDirectory, searchInput])

  const handleSaveFilter = () => {
    if (!searchTerm) return
    if (savedFilters.includes(searchTerm)) return
    const next = [searchTerm, ...savedFilters].slice(0, 8)
    setSavedFilters(next)
  }

  const handleSearchSelect = (value: string) => {
    setSearchInput(value)
    const updatedHistory = [value, ...searchHistory.filter((item) => item !== value)].slice(0, 8)
    setSearchHistory(updatedHistory)
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length

  return (
    <MentorDashboardLayout
      unreadCount={unreadCount}
      mentorName={`${profile?.firstName || 'Mentor'} ${profile?.lastName || ''}`.trim()}
    >
      <Stack spacing={6}>
        <Card>
          <CardBody>
            <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={4}>
              <Box>
                <Text fontSize="2xl" fontWeight="bold">
                  Welcome back, {profile?.firstName || 'Mentor'}!
                </Text>
                <Text color="brand.subtleText">
                  {todaysSessions.length > 0
                    ? `You have ${todaysSessions.length} session(s) on the calendar today.`
                    : "Here's your personalized mentor overview."}
                </Text>
              </Box>
              <HStack spacing={3} w={{ base: 'full', md: 'auto' }}>
                <Button leftIcon={<Icon as={CalendarClock} />} w={{ base: 'full', md: 'auto' }}>
                  Schedule new session
                </Button>
                <Button
                  leftIcon={<Icon as={MessageSquare} />}
                  variant="secondary"
                  w={{ base: 'full', md: 'auto' }}
                >
                  Send quick message
                </Button>
              </HStack>
            </Flex>
          </CardBody>
        </Card>

        <Alert status="info" bg="#3D0C69" color="white" borderRadius="xl" alignItems="center">
          <AlertIcon />
          Mentor accounts are focused on mentee support. Community competitions and paid member upgrades are hidden to reduce distractions and protect mentee privacy.
        </Alert>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          {summaryCards.map((card) => (
            <Card key={card.label} shadow="md">
              <CardBody>
                <HStack justify="space-between" align="flex-start">
                  <HStack spacing={3}>
                    <Box p={3} bg="brand.primaryMuted" borderRadius="lg">
                      <Icon as={card.icon} color="brand.primary" />
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="brand.subtleText">
                        {card.label}
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold">
                        {card.value}
                      </Text>
                    </Box>
                  </HStack>
                  <Badge colorScheme="purple">{card.helper}</Badge>
                </HStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>

        <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={4}>
          <GridItem>
            <Card shadow="lg">
              <CardBody>
                <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb={4} direction={{ base: 'column', md: 'row' }} gap={3}>
                  <Box>
                    <Text fontWeight="bold">Today's schedule</Text>
                    <Text color="brand.subtleText">Sessions scheduled for today.</Text>
                  </Box>
                  <Button variant="secondary" leftIcon={<Icon as={Calendar} />}>View calendar</Button>
                </Flex>
                {todaysSessions.length === 0 && (
                  <Box p={4} borderRadius="md" bg="brand.primaryMuted" color="brand.subtleText">
                    You have no sessions scheduled for today.
                  </Box>
                )}
                <Stack spacing={3}>
                  {todaysSessions.map((session) => {
                    const mentee = menteesWithRisk.find((item) => item.id === session.menteeId)
                    return (
                      <Flex
                        key={session.id}
                        justify="space-between"
                        align={{ base: 'flex-start', md: 'center' }}
                        p={4}
                        borderRadius="lg"
                        bg="brand.primaryMuted"
                        border="1px solid"
                        borderColor="brand.border"
                        direction={{ base: 'column', md: 'row' }}
                        gap={2}
                      >
                        <HStack spacing={3} align="flex-start">
                          <Box p={2} bg="white" borderRadius="md" border="1px solid" borderColor="brand.border">
                            <Icon as={Clock} color="brand.primary" />
                          </Box>
                          <Box>
                            <Text fontWeight="semibold">{session.topic}</Text>
                            <Text color="brand.subtleText">{mentee?.name || 'Mentee'} • {format(session.start, 'p')}</Text>
                          </Box>
                        </HStack>
                        <Badge colorScheme={session.status === 'completed' ? 'green' : session.status === 'rescheduled' ? 'yellow' : 'purple'}>
                          {session.status === 'completed' ? 'Completed' : session.status === 'rescheduled' ? 'Rescheduled' : 'Upcoming'}
                        </Badge>
                      </Flex>
                    )
                  })}
                </Stack>
              </CardBody>
            </Card>
          </GridItem>
          <GridItem>
            <Card shadow="lg" bg="linear-gradient(135deg, rgba(61, 12, 105, 0.08), white)">
              <CardBody>
                <HStack justify="space-between" align="flex-start" mb={3}>
                  <Box>
                    <Text fontWeight="bold">Pending actions</Text>
                    <Text color="brand.subtleText">Overdue sessions, missing notes, unread alerts.</Text>
                  </Box>
                  <Icon as={AlertTriangle} color="orange.500" />
                </HStack>
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
                  <Box p={3} borderRadius="lg" bg="white" border="1px solid" borderColor="brand.border">
                    <Text fontSize="sm" color="brand.subtleText">Overdue sessions</Text>
                    <Text fontSize="2xl" fontWeight="bold">{pendingSummary.overdue}</Text>
                  </Box>
                  <Box p={3} borderRadius="lg" bg="white" border="1px solid" borderColor="brand.border">
                    <Text fontSize="sm" color="brand.subtleText">Needs notes</Text>
                    <Text fontSize="2xl" fontWeight="bold">{pendingSummary.needsNotes}</Text>
                  </Box>
                  <Box p={3} borderRadius="lg" bg="white" border="1px solid" borderColor="brand.border">
                    <Text fontSize="sm" color="brand.subtleText">Unread</Text>
                    <Text fontSize="2xl" fontWeight="bold">{pendingSummary.unreadNotifications}</Text>
                  </Box>
                </SimpleGrid>
                <Divider my={4} />
                <Stack spacing={2}>
                  {notifications.slice(0, 3).map((notification) => (
                    <Flex key={notification.id} align="center" justify="space-between" p={3} borderRadius="md" bg="white">
                      <HStack spacing={2}>
                        <Icon as={Bell} color="brand.primary" />
                        <Text>{notification.message}</Text>
                      </HStack>
                      {!notification.read && (
                        <Badge colorScheme="yellow" variant="solid">
                          New
                        </Badge>
                      )}
                    </Flex>
                  ))}
                </Stack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={4}>
          <GridItem>
            <Card>
              <CardBody>
                <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb={4} direction={{ base: 'column', md: 'row' }} gap={3}>
                  <Box>
                    <Text fontWeight="bold">Weekly progress snapshot</Text>
                    <Text color="brand.subtleText">Compare this week to last week.</Text>
                  </Box>
                  <HStack spacing={2} color="brand.subtleText">
                    <Icon as={Sparkles} />
                    <Text fontSize="sm">Automated insight</Text>
                  </HStack>
                </Flex>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  {weeklyComparison.map((item) => {
                    const change = formatPercentageChange(item.current, item.previous)
                    const trend = calcTrendIcon(item.current, item.previous)
                    return (
                      <Box key={item.label} p={4} borderRadius="lg" border="1px solid" borderColor="brand.border" bg="brand.primaryMuted">
                        <HStack justify="space-between" align="center" mb={2}>
                          <HStack spacing={2}>
                            <Icon as={item.icon} color="brand.primary" />
                            <Text fontWeight="semibold">{item.label}</Text>
                          </HStack>
                          {trend && (
                            <Badge colorScheme={trend === 'up' ? 'green' : 'red'}>{change}</Badge>
                          )}
                        </HStack>
                        <HStack spacing={2} align="baseline">
                          <Text fontSize="2xl" fontWeight="bold">{item.current}</Text>
                          <Text color="brand.subtleText">prev {item.previous}</Text>
                        </HStack>
                        <Progress value={(item.current / Math.max(item.previous, 1)) * 60 + 30} borderRadius="full" mt={2} />
                      </Box>
                    )
                  })}
                </SimpleGrid>
                <Box mt={4} p={4} borderRadius="lg" bg="linear-gradient(135deg, #3D0C69, #6A0DAD)" color="white">
                  <HStack spacing={3} align="flex-start">
                    <Icon as={Lightbulb} />
                    <Box>
                      <Text fontWeight="semibold">Motivational insight</Text>
                      <Text>{motivationalMessage}</Text>
                    </Box>
                  </HStack>
                </Box>
              </CardBody>
            </Card>
          </GridItem>
          <GridItem>
            <Stack spacing={4}>
              <Card>
                <CardBody>
                  <HStack justify="space-between" align="center" mb={3}>
                    <Text fontWeight="bold">Quick access</Text>
                    <Icon as={ChevronRight} color="brand.subtleText" />
                  </HStack>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                    <Button leftIcon={<Icon as={CalendarClock} />} minH="44px" variant="secondary">
                      Schedule a session
                    </Button>
                    <Button leftIcon={<Icon as={Users} />} minH="44px" variant="secondary">
                      View mentee directory
                    </Button>
                    <Button leftIcon={<Icon as={BarChart3} />} minH="44px" variant="secondary">
                      Review reports
                    </Button>
                    <Button leftIcon={<Icon as={Mail} />} minH="44px" variant="secondary">
                      Send quick message
                    </Button>
                  </SimpleGrid>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <HStack justify="space-between" align="center" mb={3}>
                    <Text fontWeight="bold">Recent activity</Text>
                    <IconButton aria-label="Refresh" icon={<Icon as={RefreshCw} />} variant="ghost" />
                  </HStack>
                  {activityError && (
                    <Alert status="error" borderRadius="md" mb={3}>
                      <AlertIcon />
                      <Flex justify="space-between" align="center" w="full">
                        <Text>{activityError}</Text>
                        <Button size="sm" onClick={() => setActivityError(null)}>
                          Retry
                        </Button>
                      </Flex>
                    </Alert>
                  )}
                  {activityLoading ? (
                    <Stack spacing={3}>
                      {[1, 2, 3].map((item) => (
                        <Skeleton key={item} height="60px" borderRadius="md" />
                      ))}
                    </Stack>
                  ) : recentActivity.length === 0 ? (
                    <Box p={3} borderRadius="md" bg="brand.primaryMuted" color="brand.subtleText">
                      No recent activity to display.
                    </Box>
                  ) : (
                    <Stack spacing={3}>
                      {recentActivity.slice(0, 6).map((activity) => (
                        <Flex key={activity.id} justify="space-between" align="center" p={3} borderRadius="md" border="1px solid" borderColor="brand.border">
                          <Text>{activity.message}</Text>
                          <Text color="brand.subtleText" fontSize="sm">
                            {activity.timeAgo}
                          </Text>
                        </Flex>
                      ))}
                    </Stack>
                  )}
                </CardBody>
              </Card>
            </Stack>
          </GridItem>
        </Grid>

        <Card>
          <CardBody>
            <Stack spacing={3}>
              <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
                <Box>
                  <Text fontWeight="bold">Search mentees</Text>
                  <Text color="brand.subtleText">Search mentees by name, email, company, or program.</Text>
                </Box>
                <HStack spacing={2}>
                  <Button variant="secondary" leftIcon={<Icon as={History} />}>Recent searches</Button>
                  <Button variant="secondary" leftIcon={<Icon as={Save} />} onClick={handleSaveFilter}>
                    Save filter
                  </Button>
                </HStack>
              </Flex>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <Icon as={Search} color="brand.subtleText" />
                </InputLeftElement>
                <Input
                  placeholder="Search mentees by name, email, company, or program..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  bg="white"
                />
              </InputGroup>
              {searchSuggestions.length > 0 && (
                <Wrap spacing={2}>
                  {searchSuggestions.map((suggestion) => (
                    <WrapItem key={suggestion}>
                      <Tag
                        size="sm"
                        colorScheme="purple"
                        variant="subtle"
                        cursor="pointer"
                        onClick={() => handleSearchSelect(suggestion)}
                      >
                        <TagLabel>{suggestion}</TagLabel>
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
              )}
              {searchHistory.length > 0 && (
                <HStack spacing={2} wrap="wrap">
                  <Text fontSize="sm" color="brand.subtleText">
                    Recent:
                  </Text>
                  <Wrap>
                    {searchHistory.map((term) => (
                      <WrapItem key={term}>
                        <Tag
                          size="sm"
                          variant="subtle"
                          colorScheme="gray"
                          cursor="pointer"
                          onClick={() => handleSearchSelect(term)}
                        >
                          <TagLabel>{term}</TagLabel>
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                </HStack>
              )}
              {savedFilters.length > 0 && (
                <HStack spacing={2} wrap="wrap">
                  <Text fontSize="sm" color="brand.subtleText">
                    Saved filters:
                  </Text>
                  <Wrap>
                    {savedFilters.map((filter) => (
                      <WrapItem key={filter}>
                        <Tag size="sm" colorScheme="yellow" variant="subtle">
                          <TagLabel>{filter}</TagLabel>
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                </HStack>
              )}
              <Wrap spacing={2}>
                {['all', 'engaged', 'watch', 'concern', 'critical'].map((risk) => {
                  const isActive = riskFilter === risk
                  const palette = risk !== 'all' ? riskStyles[risk as RiskLevel] : { color: 'brand.text', bg: 'brand.primaryMuted', label: 'All' }
                  return (
                    <WrapItem key={risk}>
                      <Button
                        size="sm"
                        variant={isActive ? 'primary' : 'secondary'}
                        bg={isActive ? '#3D0C69' : palette.bg}
                        color={isActive ? 'white' : palette.color}
                        onClick={() => setRiskFilter(risk as RiskLevel | 'all')}
                        leftIcon={risk === 'all' ? <Icon as={Filter} /> : <Icon as={AlertCircle} />}
                      >
                        {risk === 'all' ? 'All' : palette.label}
                      </Button>
                    </WrapItem>
                  )
                })}
              </Wrap>
              {searchTerm && (
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  Showing results for "{searchTerm}" ({filteredMentees.length} matches)
                </Alert>
              )}
            </Stack>
          </CardBody>
        </Card>

        <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
          <GridItem>
            <Stack spacing={3}>
              {filteredMentees.map((mentee) => {
                const palette = riskStyles[mentee.risk.level]
                const isSelected = selectedMentee?.id === mentee.id
                return (
                  <Flex
                    key={mentee.id}
                    p={4}
                    borderRadius="lg"
                    border="2px solid"
                    borderColor={isSelected ? 'brand.primary' : 'brand.border'}
                    bg={isSelected ? 'brand.primaryMuted' : 'white'}
                    direction="column"
                    gap={3}
                    onClick={() => setSelectedMenteeId(mentee.id)}
                    cursor="pointer"
                  >
                    <Flex justify="space-between" align="flex-start" gap={3} direction={{ base: 'column', md: 'row' }}>
                      <HStack spacing={3} align="flex-start">
                        <Avatar size="lg" name={mentee.name} src={`https://i.pravatar.cc/150?u=${mentee.email}`} />
                        <Box>
                          <Text fontWeight="bold">{mentee.name}</Text>
                          <Text color="brand.subtleText" fontSize="sm">
                            {mentee.email}
                          </Text>
                          <Wrap mt={2} spacing={2}>
                            <Tag size="sm" colorScheme="purple" variant="subtle">
                              <TagLabel>Program: {mentee.programDuration}</TagLabel>
                            </Tag>
                            <Tag size="sm" bg={palette.bg} color={palette.color}>
                              <TagLabel>
                                <Icon as={AlertTriangle} mr={1} /> {palette.label} • Avg {mentee.weeklyActivity.toFixed(1)} / wk
                              </TagLabel>
                            </Tag>
                          </Wrap>
                        </Box>
                      </HStack>
                      <VStack align="flex-end" spacing={1}>
                        <Text color="brand.subtleText" fontSize="sm">
                          Last active
                        </Text>
                        <Text fontWeight="bold">{mentee.daysSinceLastActive}d ago</Text>
                        <Text color="brand.subtleText" fontSize="sm">
                          Timezone: {mentee.timezone}
                        </Text>
                      </VStack>
                    </Flex>

                    <HStack spacing={3}>
                      <Badge colorScheme="purple" variant="subtle" display="flex" alignItems="center" gap={1}>
                        <Icon as={Building2} /> {mentee.company}
                      </Badge>
                      <Badge colorScheme="green" variant="subtle" display="flex" alignItems="center" gap={1}>
                        <Icon as={MapPin} /> Village cohort
                      </Badge>
                      <Badge colorScheme="yellow" variant="subtle" display="flex" alignItems="center" gap={1}>
                        <Icon as={Sparkles} /> {mentee.program}
                      </Badge>
                    </HStack>

                    <Box>
                      <Text fontSize="sm" color="brand.subtleText" mb={1}>
                        Progress: {mentee.progress}%
                      </Text>
                      <Progress value={mentee.progress} borderRadius="full" />
                    </Box>

                    <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
                      <Box p={3} borderRadius="md" bg="brand.primaryMuted">
                        <HStack spacing={2}>
                          <Icon as={Target} color="brand.primary" />
                          <Text fontWeight="semibold">Goals</Text>
                        </HStack>
                        <Text color="brand.subtleText">{mentee.goalsCompleted}/{mentee.goalsTotal} goals</Text>
                      </Box>
                      <Box p={3} borderRadius="md" bg="brand.primaryMuted">
                        <HStack spacing={2}>
                          <Icon as={Flag} color="brand.primary" />
                          <Text fontWeight="semibold">Milestones</Text>
                        </HStack>
                        <Text color="brand.subtleText">{mentee.milestonesProgress}% complete</Text>
                      </Box>
                      <Box p={3} borderRadius="md" bg="brand.primaryMuted">
                        <HStack spacing={2}>
                          <Icon as={Activity} color="brand.primary" />
                          <Text fontWeight="semibold">Check-ins</Text>
                        </HStack>
                        <Text color={mentee.checkIns.status === 'overdue' ? 'red.500' : 'green.600'}>
                          {mentee.checkIns.status === 'overdue' ? 'Overdue' : 'On track'} • {differenceInCalendarDays(new Date(), new Date(mentee.checkIns.last))}d ago
                        </Text>
                      </Box>
                    </SimpleGrid>

                    <Wrap spacing={2}>
                      <WrapItem>
                        <Button size="sm" variant="secondary" leftIcon={<Icon as={Eye} />}>
                          View profile
                        </Button>
                      </WrapItem>
                      <WrapItem>
                        <Button size="sm" variant="secondary" leftIcon={<Icon as={MessageSquare} />}>
                          Send message
                        </Button>
                      </WrapItem>
                      <WrapItem>
                        <Button size="sm" colorScheme="red" variant="ghost" leftIcon={<Icon as={UserX} />}>
                          Unassign
                        </Button>
                      </WrapItem>
                      {mentee.scheduleLink && (
                        <WrapItem>
                          <Button size="sm" variant="secondary" leftIcon={<Icon as={Link2} />}>
                            Schedule link
                          </Button>
                        </WrapItem>
                      )}
                    </Wrap>
                  </Flex>
                )
              })}
            </Stack>
          </GridItem>
          <GridItem>
            <Card shadow="lg">
              <CardBody>
                <Text fontWeight="bold" mb={2}>
                  Mentee detail
                </Text>
                {selectedMentee ? (
                  <Stack spacing={3}>
                    <HStack spacing={3}>
                      <Avatar name={selectedMentee.name} src={`https://i.pravatar.cc/150?u=${selectedMentee.email}`} />
                      <Box>
                        <Text fontWeight="bold">{selectedMentee.name}</Text>
                        <Text color="brand.subtleText" fontSize="sm">
                          {selectedMentee.email}
                        </Text>
                        <Badge colorScheme="purple" mt={1}>
                          {selectedMentee.program}
                        </Badge>
                      </Box>
                    </HStack>
                    <Divider />
                    <Text color="brand.subtleText">
                      Insights and activity for this mentee load when selected. Use this panel to review goals, milestones, and recent session history.
                    </Text>
                    <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                      <Box p={3} borderRadius="md" bg="brand.primaryMuted">
                        <Text fontSize="sm" color="brand.subtleText">
                          Engagement level
                        </Text>
                        <Text fontWeight="bold" color={riskStyles[selectedMentee.risk.level].color}>
                          {riskStyles[selectedMentee.risk.level].label}
                        </Text>
                      </Box>
                      <Box p={3} borderRadius="md" bg="brand.primaryMuted">
                        <Text fontSize="sm" color="brand.subtleText">
                          Weekly activity
                        </Text>
                        <Text fontWeight="bold">{selectedMentee.weeklyActivity} completed</Text>
                      </Box>
                    </SimpleGrid>
                    <Button variant="primary" leftIcon={<Icon as={CheckCircle2} />}>
                      Mark alerts resolved
                    </Button>
                  </Stack>
                ) : (
                  <Box p={4} borderRadius="md" bg="brand.primaryMuted" color="brand.subtleText">
                    Select a mentee to see details.
                  </Box>
                )}
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </Stack>
    </MentorDashboardLayout>
  )
}
