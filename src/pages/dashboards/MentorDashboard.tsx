import React, { useEffect, useMemo, useState } from 'react'
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
  Input,
  InputGroup,
  InputLeftElement,
  Progress,
  SimpleGrid,
  Stack,
  Stat,
  StatArrow,
  StatHelpText,
  Tag,
  TagLabel,
  Text,
  VStack,
  Wrap,
  WrapItem,
  useBreakpointValue,
} from '@chakra-ui/react'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock4,
  DatabaseZap,
  Filter,
  HeartHandshake,
  Inbox,
  Lightbulb,
  Loader2,
  MessageSquare,
  NotebookPen,
  Search,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface StatMetric {
  label: string
  value: string | number
  helper: string
  icon: React.ComponentType
  trend?: string
  highlight?: boolean
}

interface ScheduleItem {
  title: string
  mentee: string
  time: string
  type: string
  status: 'scheduled' | 'pending' | 'overdue'
}

interface PendingAction {
  label: string
  detail: string
  severity: 'warning' | 'info'
}

interface ActivityItem {
  action: string
  meta: string
  timeAgo: string
}

interface MenteeProfile {
  name: string
  email: string
  company: string
  progress: number
  stage: string
  sessionsThisMonth: number
}

interface SessionItem {
  title: string
  mentee: string
  date: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
}

interface ResourceItem {
  title: string
  type: string
  menteesAssigned: number
  usage: string
}

interface AnalyticsItem {
  label: string
  value: string
  change: string
  positive?: boolean
}

const summaryStats: StatMetric[] = [
  {
    label: 'Total mentees',
    value: 18,
    helper: '3 new assignments this month',
    icon: Users,
    trend: '+14%',
    highlight: true,
  },
  {
    label: 'Upcoming sessions',
    value: 7,
    helper: 'Next within 2 hours',
    icon: CalendarClock,
    trend: '+2 vs last week',
  },
  {
    label: 'Pending actions',
    value: 5,
    helper: 'Notes & follow-ups',
    icon: ClipboardList,
    trend: '2 overdue',
  },
  {
    label: 'Avg. mentee progress',
    value: '76%',
    helper: '↑ steady growth',
    icon: TrendingUp,
    trend: '+6% WoW',
    highlight: true,
  },
]

const schedule: ScheduleItem[] = [
  {
    title: 'Growth plan review',
    mentee: 'Amina Idris',
    time: '09:30 AM • Zoom',
    type: 'Coaching',
    status: 'scheduled',
  },
  {
    title: 'Portfolio feedback',
    mentee: 'Diego Martínez',
    time: '11:00 AM • In-person',
    type: 'Feedback',
    status: 'pending',
  },
  {
    title: 'Sprint retrospective',
    mentee: 'Nova Labs Team',
    time: '03:00 PM • Zoom',
    type: 'Team session',
    status: 'overdue',
  },
]

const pendingActions: PendingAction[] = [
  {
    label: 'Overdue session summary',
    detail: 'Send notes for Nova Labs retrospective',
    severity: 'warning',
  },
  {
    label: 'Needs notes',
    detail: 'Document outcomes for Diego portfolio review',
    severity: 'info',
  },
  {
    label: 'Unread notifications',
    detail: '4 new updates from mentees',
    severity: 'info',
  },
]

const weeklySnapshot = [
  {
    label: 'Sessions completed',
    current: 12,
    previous: 9,
  },
  {
    label: 'Resources shared',
    current: 18,
    previous: 15,
  },
  {
    label: 'Check-ins reviewed',
    current: 22,
    previous: 19,
  },
]

const activityFeed: ActivityItem[] = [
  {
    action: 'Shared "Career Map" resource with Lina Chen',
    meta: 'Resource Library',
    timeAgo: '12m ago',
  },
  {
    action: 'Reviewed check-in for Horizon Labs',
    meta: 'Weekly progress',
    timeAgo: '28m ago',
  },
  {
    action: 'Scheduled session: Leadership calibration',
    meta: 'Mentorship sessions',
    timeAgo: '1h ago',
  },
  {
    action: 'Saved filter "Top performers"',
    meta: 'Mentee management',
    timeAgo: '2h ago',
  },
]

const mentees: MenteeProfile[] = [
  {
    name: 'Lina Chen',
    email: 'lina.chen@aurora.dev',
    company: 'Aurora Dev',
    progress: 82,
    stage: 'Experimentation',
    sessionsThisMonth: 3,
  },
  {
    name: 'Amina Idris',
    email: 'amina.idris@uplink.io',
    company: 'Uplink',
    progress: 68,
    stage: 'Discovery',
    sessionsThisMonth: 2,
  },
  {
    name: 'Diego Martínez',
    email: 'diego.martinez@stellar.mx',
    company: 'Stellar Systems',
    progress: 74,
    stage: 'Experimentation',
    sessionsThisMonth: 4,
  },
  {
    name: 'Nova Labs Team',
    email: 'team@novalabs.ai',
    company: 'Nova Labs',
    progress: 59,
    stage: 'Ignition',
    sessionsThisMonth: 1,
  },
  {
    name: 'Harper Singh',
    email: 'harper.singh@orbit.co',
    company: 'Orbit Co.',
    progress: 91,
    stage: 'Impact',
    sessionsThisMonth: 3,
  },
]

const sessions: SessionItem[] = [
  {
    title: 'Leadership calibration',
    mentee: 'Harper Singh',
    date: 'Today • 4:00 PM',
    status: 'scheduled',
    notes: 'Focus on influence mapping & sponsor asks.',
  },
  {
    title: 'Sprint retrospective',
    mentee: 'Nova Labs Team',
    date: 'Today • 3:00 PM',
    status: 'scheduled',
  },
  {
    title: 'Portfolio feedback',
    mentee: 'Diego Martínez',
    date: 'Today • 11:00 AM',
    status: 'completed',
    notes: 'Highlight prototype storytelling & metrics.',
  },
  {
    title: 'Discovery path review',
    mentee: 'Amina Idris',
    date: 'Yesterday',
    status: 'completed',
    notes: 'Set experimentation targets for next week.',
  },
  {
    title: 'Expectation reset',
    mentee: 'Nova Labs Team',
    date: 'Monday',
    status: 'cancelled',
  },
]

const resources: ResourceItem[] = [
  {
    title: 'Career Narrative Canvas',
    type: 'Template',
    menteesAssigned: 9,
    usage: 'High engagement',
  },
  {
    title: 'Weekly Impact Log',
    type: 'Worksheet',
    menteesAssigned: 12,
    usage: 'Steady usage',
  },
  {
    title: 'Sponsorship Playbook',
    type: 'Guide',
    menteesAssigned: 6,
    usage: 'Trending',
  },
]

const analytics: AnalyticsItem[] = [
  {
    label: 'Session completion rate',
    value: '92%',
    change: '+4% vs last week',
    positive: true,
  },
  {
    label: 'Mentee engagement',
    value: '88%',
    change: '+6% vs last week',
    positive: true,
  },
  {
    label: 'Response time',
    value: '1.8h',
    change: '-0.6h vs last week',
    positive: true,
  },
  {
    label: 'Resource adoption',
    value: '74%',
    change: '-2% vs last week',
  },
]

const notificationSettings = [
  'Session reminders',
  'New mentee assignment',
  'Resource feedback',
  'Check-in submissions',
  'System alerts',
]

export const MentorDashboard: React.FC = () => {
  const { profile } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [savedFilters, setSavedFilters] = useState<string[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const isMobile = useBreakpointValue({ base: true, md: false })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedFilters = localStorage.getItem('mentor-dashboard-saved-filters')
    const storedHistory = localStorage.getItem('mentor-dashboard-search-history')

    if (storedFilters) setSavedFilters(JSON.parse(storedFilters))
    if (storedHistory) setSearchHistory(JSON.parse(storedHistory))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('mentor-dashboard-saved-filters', JSON.stringify(savedFilters))
  }, [savedFilters])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('mentor-dashboard-search-history', JSON.stringify(searchHistory))
  }, [searchHistory])

  const handleSaveFilter = () => {
    if (!searchTerm.trim() || savedFilters.includes(searchTerm.trim())) return
    setSavedFilters((prev) => [...prev, searchTerm.trim()])
  }

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    if (!term.trim()) return
    setSearchHistory((prev) => {
      const updated = [term.trim(), ...prev.filter((item) => item !== term.trim())]
      return updated.slice(0, 6)
    })
  }

  const filteredMentees = useMemo(() => {
    if (!searchTerm.trim()) return mentees
    const term = searchTerm.toLowerCase()
    return mentees.filter(
      (mentee) =>
        mentee.name.toLowerCase().includes(term) ||
        mentee.email.toLowerCase().includes(term) ||
        mentee.company.toLowerCase().includes(term)
    )
  }, [searchTerm])

  const searchSuggestions = useMemo(() => {
    if (!searchTerm) return []
    const term = searchTerm.toLowerCase()
    const suggestions = mentees
      .map((mentee) => [mentee.name, mentee.email, mentee.company])
      .flat()
      .filter((value) => value.toLowerCase().includes(term))
    return Array.from(new Set(suggestions)).slice(0, 5)
  }, [searchTerm])

  return (
    <Stack spacing={8} pb={8}>
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
        <Box>
          <HStack spacing={3} mb={2}>
            <Tag size="lg" colorScheme="yellow" bg="rgba(234, 177, 48, 0.16)" color="brand.gold">
              Mentor Dashboard
            </Tag>
            <HStack spacing={1} color="brand.softGold" fontWeight="semibold">
              <Icon as={DatabaseZap} />
              <Text>Real-time sync via Bolt subscriptions</Text>
            </HStack>
          </HStack>
          <Text fontSize="3xl" fontWeight="bold" color="brand.gold">
            Welcome back, {profile?.firstName || 'Mentor'}
          </Text>
          <Text color="brand.softGold" opacity={0.9}>
            Manage mentees, track sessions, and keep momentum strong today.
          </Text>
        </Box>
        <HStack spacing={3} w={{ base: 'full', md: 'auto' }}>
          <Button leftIcon={<Icon as={CalendarClock} />} colorScheme="purple" variant="solid" bg="brand.royalPurple" color="brand.gold" _hover={{ bg: 'purple.700' }} w={{ base: 'full', md: 'auto' }}>
            Schedule Session
          </Button>
          <Button leftIcon={<Icon as={MessageSquare} />} variant="outline" color="brand.softGold" borderColor="brand.softGold" _hover={{ borderColor: 'brand.gold', color: 'brand.gold' }} w={{ base: 'full', md: 'auto' }}>
            Send Quick Message
          </Button>
          {!isMobile && (
            <IconButton
              aria-label="Review reports"
              icon={<Icon as={ArrowRight} />}
              variant="ghost"
              color="brand.gold"
              border="1px solid"
              borderColor="brand.softGold"
              _hover={{ bg: 'whiteAlpha.200' }}
            />
          )}
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
        {summaryStats.map((stat) => (
          <Card key={stat.label} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="lg">
            <CardBody>
              <HStack justify="space-between" align="flex-start" mb={3}>
                <HStack spacing={3}>
                  <Box
                    p={2}
                    bg={stat.highlight ? 'rgba(234, 177, 48, 0.18)' : 'whiteAlpha.100'}
                    borderRadius="md"
                  >
                    <Icon as={stat.icon} color="brand.gold" />
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="brand.softGold" opacity={0.85}
                    >
                      {stat.label}
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold" color="brand.gold">
                      {stat.value}
                    </Text>
                  </Box>
                </HStack>
                {stat.trend && (
                  <Tag size="sm" colorScheme="yellow" bg="rgba(234, 177, 48, 0.16)" color="brand.gold">
                    {stat.trend}
                  </Tag>
                )}
              </HStack>
              <Text color="brand.softGold" opacity={0.8}>{stat.helper}</Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg="whiteAlpha.50" borderColor="whiteAlpha.200" border="1px solid" shadow="xl">
            <CardBody>
              <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb={4} direction={{ base: 'column', md: 'row' }} gap={3}>
                <Box>
                  <Text fontWeight="bold" color="brand.gold">
                    Today's schedule
                  </Text>
                  <Text color="brand.softGold" opacity={0.8}>
                    Prepare for your upcoming mentorship moments.
                  </Text>
                </Box>
                <Button size="sm" leftIcon={<Icon as={CalendarClock} />} variant="outline" color="brand.softGold" borderColor="brand.softGold">
                  View calendar
                </Button>
              </Flex>
              <Stack spacing={3}>
                {schedule.map((item) => (
                  <Flex
                    key={`${item.title}-${item.mentee}`}
                    justify="space-between"
                    align="center"
                    bg="whiteAlpha.100"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius="md"
                    p={3}
                  >
                    <Box>
                      <HStack spacing={3}>
                        <Icon as={Clock4} color="brand.gold" />
                        <Box>
                          <Text fontWeight="semibold" color="brand.gold">
                            {item.title}
                          </Text>
                          <Text color="brand.softGold" fontSize="sm">
                            {item.mentee} • {item.time}
                          </Text>
                          <Text color="brand.softGold" fontSize="xs" opacity={0.7}>
                            {item.type}
                          </Text>
                        </Box>
                      </HStack>
                    </Box>
                    <Badge
                      colorScheme={
                        item.status === 'overdue'
                          ? 'red'
                          : item.status === 'pending'
                            ? 'orange'
                            : 'green'
                      }
                      variant="subtle"
                    >
                      {item.status}
                    </Badge>
                  </Flex>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem>
          <Card bg="rgba(234, 177, 48, 0.06)" borderColor="rgba(234, 177, 48, 0.25)" border="1px solid" shadow="lg">
            <CardBody>
              <HStack justify="space-between" align="flex-start" mb={3}>
                <Box>
                  <Text fontWeight="bold" color="brand.gold">
                    Pending actions
                  </Text>
                  <Text color="brand.softGold" opacity={0.85}>
                    Overdue sessions, missing notes, unread alerts.
                  </Text>
                </Box>
                <Icon as={AlertTriangle} color="brand.gold" />
              </HStack>
              <Stack spacing={3}>
                {pendingActions.map((item) => (
                  <Flex
                    key={item.label}
                    justify="space-between"
                    align="center"
                    p={3}
                    bg="whiteAlpha.100"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius="md"
                  >
                    <Box>
                      <Text fontWeight="semibold" color="brand.gold">
                        {item.label}
                      </Text>
                      <Text color="brand.softGold" fontSize="sm">
                        {item.detail}
                      </Text>
                    </Box>
                    <Badge colorScheme={item.severity === 'warning' ? 'orange' : 'blue'}>{item.severity}</Badge>
                  </Flex>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
            <CardBody>
              <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb={4} direction={{ base: 'column', md: 'row' }} gap={3}>
                <Box>
                  <Text fontWeight="bold" color="brand.gold">
                    Weekly progress snapshot
                  </Text>
                  <Text color="brand.softGold" opacity={0.8}>
                    Current week compared to last week.
                  </Text>
                </Box>
                <HStack spacing={2} color="brand.softGold">
                  <Icon as={Sparkles} />
                  <Text fontSize="sm">AI-guided insight</Text>
                </HStack>
              </Flex>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                {weeklySnapshot.map((item) => {
                  const delta = item.current - item.previous
                  const percent = Math.round((delta / item.previous) * 100)
                  return (
                    <Box key={item.label} p={3} borderRadius="md" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200">
                      <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
                        {item.label}
                      </Text>
                      <HStack spacing={2} align="baseline" mb={1}>
                        <Text fontSize="2xl" fontWeight="bold" color="brand.gold">
                          {item.current}
                        </Text>
                        <Stat>
                          <StatHelpText color={percent >= 0 ? 'green.400' : 'red.300'}>
                            <StatArrow type={percent >= 0 ? 'increase' : 'decrease'} />
                            {Math.abs(percent)}% vs last week
                          </StatHelpText>
                        </Stat>
                      </HStack>
                      <Progress value={(item.current / Math.max(item.previous, 1)) * 60 + 30} borderRadius="full" />
                    </Box>
                  )
                })}
              </SimpleGrid>
              <Box mt={4} p={3} borderRadius="md" bg="rgba(88, 28, 135, 0.2)" border="1px solid" borderColor="purple.500">
                <HStack spacing={3}>
                  <Icon as={Lightbulb} color="brand.gold" />
                  <Box>
                    <Text fontWeight="semibold" color="brand.gold">
                      Motivational insight
                    </Text>
                    <Text color="brand.softGold" opacity={0.9}>
                      AI: "Your mentees respond fastest to feedback within 4 hours. Keep the cadence to lift engagement another 5% this week."
                    </Text>
                  </Box>
                </HStack>
              </Box>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem>
          <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
            <CardBody>
              <HStack justify="space-between" align="center" mb={4}>
                <Text fontWeight="bold" color="brand.gold">
                  Recent activity
                </Text>
                <IconButton aria-label="Refresh" icon={<Icon as={Loader2} />} variant="ghost" color="brand.softGold" />
              </HStack>
              <Stack spacing={3}>
                {activityFeed.map((item) => (
                  <Flex key={item.action} justify="space-between" align="center" p={3} borderRadius="md" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200">
                    <Box>
                      <Text color="brand.gold" fontWeight="semibold">
                        {item.action}
                      </Text>
                      <Text color="brand.softGold" fontSize="sm">
                        {item.meta}
                      </Text>
                    </Box>
                    <Text color="brand.softGold" fontSize="sm" opacity={0.8}>
                      {item.timeAgo}
                    </Text>
                  </Flex>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
            <CardBody>
              <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb={4} direction={{ base: 'column', md: 'row' }} gap={3}>
                <Box>
                  <Text fontWeight="bold" color="brand.gold">
                    Mentee management
                  </Text>
                  <Text color="brand.softGold" opacity={0.8}>
                    Search, filter, and monitor progress across mentees.
                  </Text>
                </Box>
                <HStack spacing={2}>
                  <Tag colorScheme="purple" variant="subtle">
                    <TagLabel>Advanced search</TagLabel>
                  </Tag>
                  <Tag colorScheme="yellow" variant="subtle">
                    <TagLabel>Autocomplete</TagLabel>
                  </Tag>
                </HStack>
              </Flex>
              <Stack spacing={4}>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={Search} color="brand.softGold" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search by name, email, or company"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    bg="whiteAlpha.100"
                    borderColor="whiteAlpha.200"
                    _placeholder={{ color: 'brand.softGold' }}
                  />
                  <Button ml={2} leftIcon={<Icon as={Filter} />} onClick={handleSaveFilter} colorScheme="yellow" variant="outline" color="brand.gold" borderColor="brand.gold">
                    Save filter
                  </Button>
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
                          onClick={() => handleSearch(suggestion)}
                        >
                          <TagLabel>{suggestion}</TagLabel>
                        </Tag>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}
                {searchHistory.length > 0 && (
                  <HStack spacing={2} align="center">
                    <Text fontSize="sm" color="brand.softGold" opacity={0.8}>
                      Recent searches:
                    </Text>
                    <Wrap>
                      {searchHistory.map((historyItem) => (
                        <WrapItem key={historyItem}>
                          <Tag size="sm" variant="subtle" colorScheme="gray" cursor="pointer" onClick={() => handleSearch(historyItem)}>
                            <TagLabel>{historyItem}</TagLabel>
                          </Tag>
                        </WrapItem>
                      ))}
                    </Wrap>
                  </HStack>
                )}
                {savedFilters.length > 0 && (
                  <HStack spacing={2} align="center">
                    <Text fontSize="sm" color="brand.softGold" opacity={0.8}>
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
                <Stack spacing={3}>
                  {filteredMentees.map((mentee) => (
                    <Flex
                      key={mentee.email}
                      p={3}
                      borderRadius="md"
                      bg="whiteAlpha.100"
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      justify="space-between"
                      align="center"
                    >
                      <HStack spacing={3} align="center">
                        <Avatar name={mentee.name} bg="brand.royalPurple" color="brand.gold" />
                        <Box>
                          <Text fontWeight="semibold" color="brand.gold">
                            {mentee.name}
                          </Text>
                          <Text fontSize="sm" color="brand.softGold">
                            {mentee.email} • {mentee.company}
                          </Text>
                          <HStack spacing={2} mt={1}>
                            <Badge colorScheme={mentee.progress >= 80 ? 'green' : mentee.progress >= 60 ? 'yellow' : 'red'}>
                              {mentee.progress}% progress
                            </Badge>
                            <Badge variant="outline" colorScheme="purple">
                              {mentee.stage}
                            </Badge>
                          </HStack>
                        </Box>
                      </HStack>
                      <VStack spacing={1} align="flex-end">
                        <Text fontSize="sm" color="brand.softGold">
                          Sessions this month
                        </Text>
                        <Text fontWeight="bold" color="brand.gold">
                          {mentee.sessionsThisMonth}
                        </Text>
                      </VStack>
                    </Flex>
                  ))}
                </Stack>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem>
          <Stack spacing={6}>
            <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
              <CardBody>
                <HStack justify="space-between" align="center" mb={3}>
                  <Text fontWeight="bold" color="brand.gold">
                    Quick access
                  </Text>
                  <Icon as={ArrowRight} color="brand.gold" />
                </HStack>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                  <Button leftIcon={<Icon as={CalendarClock} />} variant="outline" color="brand.softGold" borderColor="whiteAlpha.300">
                    Schedule session
                  </Button>
                  <Button leftIcon={<Icon as={Send} />} variant="outline" color="brand.softGold" borderColor="whiteAlpha.300">
                    Send quick message
                  </Button>
                  <Button leftIcon={<Icon as={NotebookPen} />} variant="outline" color="brand.softGold" borderColor="whiteAlpha.300">
                    Add session notes
                  </Button>
                  <Button leftIcon={<Icon as={TrendingUp} />} variant="outline" color="brand.softGold" borderColor="whiteAlpha.300">
                    Review reports
                  </Button>
                </SimpleGrid>
              </CardBody>
            </Card>

            <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
              <CardBody>
                <HStack justify="space-between" align="center" mb={3}>
                  <Text fontWeight="bold" color="brand.gold">
                    Notifications
                  </Text>
                  <Badge colorScheme="purple">4 unread</Badge>
                </HStack>
                <Stack spacing={3}>
                  <Flex justify="space-between" align="center">
                    <HStack spacing={2}>
                      <Icon as={Bell} color="brand.gold" />
                      <Text color="brand.softGold">Real-time updates enabled</Text>
                    </HStack>
                    <Button size="sm" variant="outline" color="brand.softGold" borderColor="whiteAlpha.300">
                      Mark all read
                    </Button>
                  </Flex>
                  <Divider borderColor="whiteAlpha.300" />
                  <Stack spacing={2}>
                    {[1, 2, 3].map((id) => (
                      <Flex key={id} justify="space-between" align="center" p={2} borderRadius="md" bg="whiteAlpha.100">
                        <HStack spacing={3}>
                          <Icon as={id === 1 ? Inbox : id === 2 ? CheckCircle2 : HeartHandshake} color="brand.gold" />
                          <Box>
                            <Text color="brand.gold" fontWeight="semibold">
                              {id === 1
                                ? 'New check-in submitted'
                                : id === 2
                                  ? 'Session summary saved'
                                  : 'Mentee shared progress update'}
                            </Text>
                            <Text color="brand.softGold" fontSize="sm" opacity={0.85}>
                              {id === 1 ? 'Nova Labs team' : id === 2 ? 'Diego Martínez' : 'Lina Chen'} • {id === 1 ? '5m ago' : id === 2 ? '32m ago' : '1h ago'}
                            </Text>
                          </Box>
                        </HStack>
                        <Icon as={ArrowRight} color="brand.softGold" />
                      </Flex>
                    ))}
                  </Stack>
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </GridItem>
      </Grid>

      <Grid templateColumns={{ base: '1fr', lg: '3fr 2fr' }} gap={6}>
        <GridItem>
          <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
            <CardBody>
              <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} mb={4} direction={{ base: 'column', md: 'row' }} gap={3}>
                <Box>
                  <Text fontWeight="bold" color="brand.gold">
                    Session management
                  </Text>
                  <Text color="brand.softGold" opacity={0.8}>
                    Track scheduled, completed, and cancelled mentorship sessions.
                  </Text>
                </Box>
                <Button size="sm" leftIcon={<Icon as={CalendarClock} />} colorScheme="purple" variant="outline" borderColor="brand.gold" color="brand.gold">
                  Schedule new session
                </Button>
              </Flex>
              <Stack spacing={3}>
                {sessions.map((session) => (
                  <Flex
                    key={`${session.title}-${session.mentee}`}
                    p={3}
                    borderRadius="md"
                    bg="whiteAlpha.100"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    justify="space-between"
                    align="center"
                  >
                    <Box>
                      <Text fontWeight="semibold" color="brand.gold">
                        {session.title}
                      </Text>
                      <Text fontSize="sm" color="brand.softGold">
                        {session.mentee} • {session.date}
                      </Text>
                      {session.notes && (
                        <Text fontSize="xs" color="brand.softGold" opacity={0.8} mt={1}>
                          Notes: {session.notes}
                        </Text>
                      )}
                    </Box>
                    <Badge
                      colorScheme={
                        session.status === 'completed'
                          ? 'green'
                          : session.status === 'cancelled'
                            ? 'red'
                            : 'blue'
                      }
                    >
                      {session.status}
                    </Badge>
                  </Flex>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem>
          <Stack spacing={6}>
            <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
              <CardBody>
                <HStack justify="space-between" align="center" mb={3}>
                  <Text fontWeight="bold" color="brand.gold">
                    Resource library
                  </Text>
                  <Button size="sm" leftIcon={<Icon as={BookOpen} />} variant="outline" color="brand.softGold" borderColor="whiteAlpha.300">
                    Share resource
                  </Button>
                </HStack>
                <Stack spacing={3}>
                  {resources.map((resource) => (
                    <Flex key={resource.title} justify="space-between" align="center" p={3} borderRadius="md" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200">
                      <Box>
                        <Text fontWeight="semibold" color="brand.gold">
                          {resource.title}
                        </Text>
                        <Text color="brand.softGold" fontSize="sm">
                          {resource.type} • Assigned to {resource.menteesAssigned} mentees
                        </Text>
                      </Box>
                      <Badge colorScheme="purple" variant="subtle">
                        {resource.usage}
                      </Badge>
                    </Flex>
                  ))}
                </Stack>
              </CardBody>
            </Card>

            <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
              <CardBody>
                <HStack justify="space-between" align="center" mb={3}>
                  <Text fontWeight="bold" color="brand.gold">
                    Notifications settings
                  </Text>
                  <Icon as={Settings} color="brand.gold" />
                </HStack>
                <Stack spacing={2}>
                  {notificationSettings.map((setting) => (
                    <Flex key={setting} justify="space-between" align="center" p={2} borderRadius="md" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200">
                      <Text color="brand.softGold">{setting}</Text>
                      <HStack spacing={2}>
                        <Badge colorScheme="green" variant="subtle">
                          Enabled
                        </Badge>
                        <IconButton aria-label="Edit" size="sm" icon={<Icon as={ChevronDown} />} variant="ghost" color="brand.softGold" />
                      </HStack>
                    </Flex>
                  ))}
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </GridItem>
      </Grid>

      <Grid templateColumns={{ base: '1fr', lg: '3fr 2fr' }} gap={6}>
        <GridItem>
          <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
            <CardBody>
              <HStack justify="space-between" align="center" mb={3}>
                <Text fontWeight="bold" color="brand.gold">
                  Analytics dashboard
                </Text>
                <Tag colorScheme="purple" variant="subtle">
                  Engagement insights
                </Tag>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                {analytics.map((item) => (
                  <Box key={item.label} p={3} borderRadius="md" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200">
                    <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
                      {item.label}
                    </Text>
                    <HStack justify="space-between" align="center">
                      <Text fontSize="2xl" fontWeight="bold" color="brand.gold">
                        {item.value}
                      </Text>
                      <Stat>
                        <StatHelpText color={item.positive ? 'green.400' : 'orange.300'}>
                          <StatArrow type={item.positive ? 'increase' : 'decrease'} />
                          {item.change}
                        </StatHelpText>
                      </Stat>
                    </HStack>
                    <Progress
                      value={item.positive ? 78 : 52}
                      mt={2}
                      borderRadius="full"
                      colorScheme={item.positive ? 'green' : 'orange'}
                    />
                  </Box>
                ))}
              </SimpleGrid>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem>
          <Card bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.200" shadow="xl">
            <CardBody>
              <Flex justify="space-between" align="center" mb={4}>
                <Text fontWeight="bold" color="brand.gold">
                  Search & collaboration
                </Text>
                <Badge colorScheme="yellow" variant="subtle">
                  Persistent history
                </Badge>
              </Flex>
              <Stack spacing={3}>
                <Flex align="center" justify="space-between" p={3} borderRadius="md" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200">
                  <HStack spacing={3}>
                    <Icon as={DatabaseZap} color="brand.gold" />
                    <Box>
                      <Text color="brand.gold" fontWeight="semibold">
                        Real-time data sync
                      </Text>
                      <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
                        Live Bolt Database subscriptions keep mentee data fresh.
                      </Text>
                    </Box>
                  </HStack>
                  <Badge colorScheme="green">Live</Badge>
                </Flex>
                <Flex align="center" justify="space-between" p={3} borderRadius="md" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200">
                  <HStack spacing={3}>
                    <Icon as={Search} color="brand.gold" />
                    <Box>
                      <Text color="brand.gold" fontWeight="semibold">
                        Advanced search
                      </Text>
                      <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
                        Autocomplete suggestions and saved filters stored locally.
                      </Text>
                    </Box>
                  </HStack>
                  <Badge colorScheme="purple">Autocomplete</Badge>
                </Flex>
                <Flex align="center" justify="space-between" p={3} borderRadius="md" bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200">
                  <HStack spacing={3}>
                    <Icon as={MessageSquare} color="brand.gold" />
                    <Box>
                      <Text color="brand.gold" fontWeight="semibold">
                        Collaboration shortcuts
                      </Text>
                      <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
                        Quick actions keep messages and reports a tap away.
                      </Text>
                    </Box>
                  </HStack>
                  <Badge colorScheme="blue" variant="subtle">
                    Action ready
                  </Badge>
                </Flex>
              </Stack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Stack>
  )
}
