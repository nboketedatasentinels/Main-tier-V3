import React, { useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  HStack,
  Icon,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react'
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpAZ,
  Award,
  BookOpen,
  Clock,
  Crown,
  Info,
  Medal,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { LeaderboardTimeframe, UserProfile } from '@/types'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { PeerConnectPage } from '@/pages/peer/PeerConnectPage'

interface PointsTransaction {
  id: string
  userId: string
  points: number
  category?: string
  createdAt: string
  companyId?: string
}

interface ChallengeRecord {
  id: string
  opponentName: string
  opponentAvatar?: string
  opponentId?: string
  startDate: string
  endDate: string
  yourPoints: number
  opponentPoints: number
  status: 'active' | 'completed' | 'upcoming'
  result?: 'win' | 'loss' | 'draw'
}

interface LeaderboardRow {
  user: UserProfile
  activePoints: number
  totalPoints: number
  level: number
  badgeCount: number
  rank: number
}

const timeframeOptions = [
  { label: 'All Time', value: LeaderboardTimeframe.ALL_TIME },
  { label: 'Last 7 Days', value: LeaderboardTimeframe.LAST_7_DAYS },
  { label: 'Last 30 Days', value: LeaderboardTimeframe.LAST_30_DAYS },
  { label: 'My Journey', value: LeaderboardTimeframe.CURRENT_JOURNEY },
]

const sortOptions = [
  { label: 'Sort by Points', value: 'points' },
  { label: 'Sort by Level', value: 'level' },
  { label: 'Sort by Name', value: 'name' },
]

const pointsColors = ['#5d6bff', '#a855f7', '#f97316', '#22c55e', '#0ea5e9', '#facc15']

const rowHeight = 76
const virtualizationThreshold = 30
const pageSize = 25

const toDateFromTimeframe = (timeframe: LeaderboardTimeframe): Date | null => {
  const now = new Date()
  if (timeframe === LeaderboardTimeframe.LAST_7_DAYS) {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
  if (timeframe === LeaderboardTimeframe.LAST_30_DAYS) {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
  return null
}

const formatNumber = (value?: number | null) => {
  const safeValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return safeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export const LeadershipBoardPage: React.FC = () => {
  const { profile } = useAuth()
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>(LeaderboardTimeframe.ALL_TIME)
  const [sortField, setSortField] = useState<'points' | 'level' | 'name'>('points')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([])
  const [virtualOffset, setVirtualOffset] = useState(0)
  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const [breakdownPage, setBreakdownPage] = useState(1)
  const [showFilterTip, setShowFilterTip] = useState(() => {
    const stored = localStorage.getItem('leaderboard-filter-tip')
    return stored !== 'dismissed'
  })
  const [showPeerConnect, setShowPeerConnect] = useState(false)
  const timeframeStart = useMemo(() => toDateFromTimeframe(timeframe), [timeframe])

  useEffect(() => {
    const profileQuery = query(collection(db, 'profiles'))
    const unsubscribe = onSnapshot(profileQuery, (snapshot) => {
      const loadedProfiles: UserProfile[] = snapshot.docs.map((doc) => doc.data() as UserProfile)
      setProfiles(loadedProfiles)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const txQuery = query(collection(db, 'points_transactions'), orderBy('createdAt', 'desc'), limit(500))
    const unsubscribe = onSnapshot(txQuery, (snapshot) => {
      const loadedTx: PointsTransaction[] = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          userId: data.userId,
          points: data.points || 0,
          category: data.category,
          companyId: data.companyId,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        }
      })
      setTransactions(loadedTx)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!profile) return

    const challengeQuery = query(
      collection(db, 'challenges'),
      where('participants', 'array-contains', profile.id),
      orderBy('startDate', 'desc'),
      limit(25),
    )

    const unsubscribe = onSnapshot(challengeQuery, (snapshot) => {
      const loadedChallenges: ChallengeRecord[] = snapshot.docs.map((doc) => {
        const data = doc.data() as Record<string, unknown>
        return {
          id: doc.id,
          opponentName: (data.opponentName as string) || 'Peer Challenger',
          opponentAvatar: data.opponentAvatar as string | undefined,
          opponentId: data.opponentId as string | undefined,
          startDate: (data.startDate as string) || new Date().toISOString(),
          endDate: (data.endDate as string) || new Date().toISOString(),
          yourPoints: (data.yourPoints as number) || 0,
          opponentPoints: (data.opponentPoints as number) || 0,
          status: ((data.status as ChallengeRecord['status']) || 'active'),
          result: data.result as ChallengeRecord['result'],
        }
      })

      setChallenges(loadedChallenges)
    })

    return () => unsubscribe()
  }, [profile])

  useEffect(() => {
    if (profile && profile.privacySettings?.showOnLeaderboard === false) {
      toast({
        title: 'Privacy enabled',
        description: 'Your leaderboard visibility is limited by your privacy settings.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      })
    }
  }, [profile, toast])

  const dismissFilterTip = () => {
    setShowFilterTip(false)
    localStorage.setItem('leaderboard-filter-tip', 'dismissed')
  }

  const aggregatedPoints = useMemo(() => {
    const totals: Record<string, number> = {}
    transactions.forEach((tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
      if (timeframe === LeaderboardTimeframe.CURRENT_JOURNEY && tx.userId !== profile?.id) return
      if (timeframeStart && createdAt && createdAt < timeframeStart) return
      totals[tx.userId] = (totals[tx.userId] || 0) + tx.points
    })
    return totals
  }, [profile?.id, timeframe, timeframeStart, transactions])

  const weeklyPoints = useMemo(() => {
    if (!profile) return 0
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return transactions.reduce((sum, tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
      if (tx.userId === profile.id && createdAt && createdAt >= start) {
        return sum + tx.points
      }
      return sum
    }, 0)
  }, [profile, transactions])

  const monthlyPoints = useMemo(() => {
    if (!profile) return 0
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return transactions.reduce((sum, tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
      if (tx.userId === profile.id && createdAt && createdAt >= start) {
        return sum + tx.points
      }
      return sum
    }, 0)
  }, [profile, transactions])

  const companySize = useMemo(() => profiles.filter((p) => p.companyId === profile?.companyId).length, [profiles, profile])

  const leaderboardRows: LeaderboardRow[] = useMemo(() => {
    const rows = profiles
      .filter((p) => p.privacySettings?.showOnLeaderboard !== false)
      .map((user) => {
        const activePoints = timeframe === LeaderboardTimeframe.ALL_TIME ? user.totalPoints : aggregatedPoints[user.id] || 0
        const badgeCount = Math.max(1, Math.round((activePoints + user.totalPoints) / 500))

        return {
          user,
          activePoints,
          totalPoints: user.totalPoints || 0,
          level: user.level || 1,
          badgeCount,
          rank: 0,
        }
      })

    const sorted = rows.sort((a, b) => {
      if (sortField === 'name') {
        const aName = a.user.fullName || a.user.firstName
        const bName = b.user.fullName || b.user.firstName
        return sortDirection === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName)
      }

      if (sortField === 'level') {
        return sortDirection === 'asc' ? a.level - b.level : b.level - a.level
      }

      return sortDirection === 'asc' ? a.activePoints - b.activePoints : b.activePoints - a.activePoints
    })

    return sorted.map((row, index) => ({ ...row, rank: index + 1 }))
  }, [aggregatedPoints, profiles, sortDirection, sortField, timeframe])

  const percentile = useMemo(() => {
    if (!profile) return 'Top 100%'
    const companyRows = leaderboardRows.filter((row) => row.user.companyId === profile.companyId)
    const currentRank = companyRows.find((row) => row.user.id === profile.id)?.rank || companyRows.length
    if (!companyRows.length) return 'Top 100%'
    const pct = Math.round((currentRank / companyRows.length) * 100)
    return `Top ${pct}%`
  }, [leaderboardRows, profile])

  const userRow = useMemo(() => leaderboardRows.find((row) => row.user.id === profile?.id), [leaderboardRows, profile])

  const paginatedRows = useMemo(() => {
    const end = leaderboardPage * pageSize
    return leaderboardRows.slice(0, end)
  }, [leaderboardRows, leaderboardPage])

  const virtualized = useMemo(() => {
    if (leaderboardRows.length <= virtualizationThreshold) {
      return { rows: paginatedRows, paddingTop: 0, paddingBottom: 0 }
    }
    const start = Math.max(0, virtualOffset - 3)
    const end = Math.min(leaderboardRows.length, start + 25)
    return {
      rows: leaderboardRows.slice(start, end),
      paddingTop: start * rowHeight,
      paddingBottom: Math.max(0, (leaderboardRows.length - end) * rowHeight),
    }
  }, [leaderboardRows, paginatedRows, virtualOffset])

  const peerRows = useMemo(() => {
    const currentPoints = userRow?.activePoints || 0
    return leaderboardRows.slice(0, 12).map((row) => ({
      ...row,
      delta: row.activePoints - currentPoints,
    }))
  }, [leaderboardRows, userRow])

  const cohortStats = useMemo(() => {
    const active = userRow?.activePoints || 0
    const total = userRow?.totalPoints || 0
    const level = userRow?.level || profile?.level || 1
    const maxActive = Math.max(...leaderboardRows.map((row) => row.activePoints), active)
    const maxTotal = Math.max(...leaderboardRows.map((row) => row.totalPoints), total)
    const maxLevel = Math.max(...leaderboardRows.map((row) => row.level), level)

    const avgActive = leaderboardRows.length
      ? Math.round(leaderboardRows.reduce((sum, row) => sum + row.activePoints, 0) / leaderboardRows.length)
      : 0
    const avgTotal = leaderboardRows.length
      ? Math.round(leaderboardRows.reduce((sum, row) => sum + row.totalPoints, 0) / leaderboardRows.length)
      : 0
    const avgLevel = leaderboardRows.length
      ? Math.round(leaderboardRows.reduce((sum, row) => sum + row.level, 0) / leaderboardRows.length)
      : 1

    return {
      active,
      total,
      level,
      maxActive: maxActive || active,
      maxTotal: maxTotal || total,
      maxLevel: maxLevel || level,
      avgActive,
      avgTotal,
      avgLevel,
    }
  }, [leaderboardRows, profile?.level, userRow])

  const breakdownByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {}
    transactions.forEach((tx) => {
      if (tx.category) {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.points
      }
    })

    return Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value,
      percent: userRow?.activePoints ? Math.round((value / userRow.activePoints) * 100) : 0,
    }))
  }, [transactions, userRow?.activePoints])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(breakdownByCategory.length / 4))
    if (breakdownPage > maxPage) {
      setBreakdownPage(maxPage)
    }
  }, [breakdownByCategory.length, breakdownPage])

  const companyRows = useMemo(() => leaderboardRows.filter((row) => row.user.companyId === profile?.companyId), [leaderboardRows, profile?.companyId])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Icon as={Crown} color="yellow.400" />
    if (rank === 2) return <Icon as={Medal} color="text.muted" />
    if (rank === 3) return <Icon as={Medal} color="#cd7f32" />
    return <Badge colorScheme="purple">{rank}</Badge>
  }

  const companyStats = {
    weeklyPoints,
    monthlyPoints,
    activeChallenges: challenges.filter((c) => c.status === 'active').length,
    badgesEarned: userRow?.badgeCount || 0,
  }

  const handleApplyFilters = () => {
    setVirtualOffset(0)
    setLeaderboardPage(1)
    toast({
      title: 'Filters applied',
      description: 'Leaderboard recalculated with your selected filters.',
      status: 'success',
      duration: 2500,
      isClosable: true,
    })
  }

  const handleResetFilters = () => {
    setSortField('points')
    setSortDirection('desc')
    setTimeframe(LeaderboardTimeframe.ALL_TIME)
    setVirtualOffset(0)
    setLeaderboardPage(1)
  }

  const onScrollVirtual = (event: React.UIEvent<HTMLDivElement>) => {
    const offset = Math.floor(event.currentTarget.scrollTop / rowHeight)
    setVirtualOffset(offset)
  }

  const emptyChallenges = challenges.filter((challenge) => challenge.status === 'active').length === 0

  return (
    <Stack spacing={6}>
      <Flex align="center" justify="space-between">
        <Box>
          <HStack spacing={3}>
            <Icon as={Sparkles} color="brand.primary" />
            <Text fontSize="sm" color="brand.subtleText" textTransform="uppercase" letterSpacing="wide">
              Leadership Board
            </Text>
          </HStack>
          <Text fontSize="3xl" fontWeight="bold" color="brand.text" mt={1}>
            Competitive, social, and personalized rankings
          </Text>
          <Text color="brand.subtleText">Switch between leaderboard and challenge views with real-time Firebase data.</Text>
        </Box>
        <HStack spacing={3}>
          <Button variant="secondary" leftIcon={<Icon as={Info} />} onClick={onOpen}>
            Start a Challenge
          </Button>
          <Button onClick={() => setShowPeerConnect((prev) => !prev)} variant="primary">
            {showPeerConnect ? 'Hide Peer Connect' : 'Open Peer Connect'}
          </Button>
        </HStack>
      </Flex>

      <Tabs variant="enclosed">
        <TabList>
          <Tab>Leaderboard</Tab>
          <Tab>Challenges</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <Stack spacing={6}>
              <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={4}>
                <Card>
                  <CardHeader>
                    <HStack justify="space-between" align="center">
                      <Box>
                        <Text fontSize="lg" fontWeight="bold">Progress Overview</Text>
                        <Text color="brand.subtleText">Live updates from Firestore</Text>
                      </Box>
                      <Badge colorScheme="purple" display="flex" alignItems="center" gap={2}>
                        <Icon as={Trophy} /> {percentile}
                      </Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                      <Stat>
                        <StatLabel>Your Current Rank</StatLabel>
                        <StatNumber display="flex" alignItems="center" gap={2}>
                          {getRankIcon(userRow?.rank || companyRows.length || 1)}
                          {userRow?.rank || '—'}
                        </StatNumber>
                        <StatHelpText color="brand.subtleText">Across your company</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Total Points</StatLabel>
                        <StatNumber>{formatNumber(userRow?.totalPoints || profile?.totalPoints || 0)}</StatNumber>
                        <StatHelpText color="brand.subtleText">Lifetime XP</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Current Level</StatLabel>
                        <StatNumber>{userRow?.level || profile?.level || 1}</StatNumber>
                        <StatHelpText color="brand.subtleText">Keep climbing</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Weekly Points</StatLabel>
                        <StatNumber>{formatNumber(companyStats.weeklyPoints)}</StatNumber>
                        <StatHelpText color="brand.subtleText">Last 7 days</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Monthly Points</StatLabel>
                        <StatNumber>{formatNumber(companyStats.monthlyPoints)}</StatNumber>
                        <StatHelpText color="brand.subtleText">Last 30 days</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Active Challenges</StatLabel>
                        <StatNumber>{companyStats.activeChallenges}</StatNumber>
                        <StatHelpText color="brand.subtleText">Live battles</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Badges Earned</StatLabel>
                        <StatNumber>{companyStats.badgesEarned}</StatNumber>
                        <StatHelpText color="brand.subtleText">Achievement count</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Team Members</StatLabel>
                        <StatNumber>{companySize || 1}</StatNumber>
                        <StatHelpText color="brand.subtleText">Company size</StatHelpText>
                      </Stat>
                    </SimpleGrid>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader pb={2}>
                    <HStack justify="space-between">
                      <Text fontWeight="bold">Personal View</Text>
                      <Badge colorScheme="green">Private Controls</Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    <VStack align="stretch" spacing={4}>
                      <HStack spacing={4}>
                        <Avatar size="lg" name={profile?.fullName} src={profile?.avatarUrl} />
                        <Box>
                          <Text fontWeight="bold">{profile?.fullName || 'You'}</Text>
                          <Text color="brand.subtleText">Level {profile?.level || 1} · {formatNumber(profile?.totalPoints || 0)} pts</Text>
                        </Box>
                      </HStack>
                      <SimpleGrid columns={3} spacing={3}>
                        <Box p={3} border="1px solid" borderColor="brand.border" borderRadius="lg">
                          <Text fontSize="xs" color="brand.subtleText">Active Points</Text>
                          <Text fontWeight="bold">{formatNumber(userRow?.activePoints || 0)}</Text>
                        </Box>
                        <Box p={3} border="1px solid" borderColor="brand.border" borderRadius="lg">
                          <Text fontSize="xs" color="brand.subtleText">Total Points</Text>
                          <Text fontWeight="bold">{formatNumber(userRow?.totalPoints || profile?.totalPoints || 0)}</Text>
                        </Box>
                        <Box p={3} border="1px solid" borderColor="brand.border" borderRadius="lg">
                          <Text fontSize="xs" color="brand.subtleText">Featured Badges</Text>
                          <HStack spacing={2} mt={1}>
                            <Badge colorScheme="purple">Growth</Badge>
                            <Badge colorScheme="yellow">Impact</Badge>
                          </HStack>
                        </Box>
                      </SimpleGrid>
                      <Button variant="secondary" leftIcon={<Icon as={BookOpen} />}>Manage Visibility</Button>
                    </VStack>
                  </CardBody>
                </Card>
              </Grid>

              <Card>
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontWeight="bold">Filters & Sorting</Text>
                      <Text color="brand.subtleText">Timeframes, sorting, and tutorials</Text>
                    </Box>
                    <HStack spacing={2}>
                      <Button size="sm" onClick={handleApplyFilters}>Apply</Button>
                      <Button size="sm" variant="secondary" onClick={handleResetFilters}>Reset</Button>
                    </HStack>
                  </Flex>
                  {showFilterTip && (
                    <Flex mt={3} p={3} borderRadius="md" bg="brand.primaryMuted" align="center" gap={3}>
                      <Icon as={AlertCircle} color="brand.primary" />
                      <Text fontSize="sm" flex="1">First time? Adjust your timeframe, sort order, and admin filters here.</Text>
                      <Button size="xs" onClick={dismissFilterTip}>Got it</Button>
                    </Flex>
                  )}
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                    <Box>
                      <Text fontSize="sm" mb={1}>Timeframe</Text>
                      <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value as LeaderboardTimeframe)}>
                        {timeframeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </Box>
                    <Box>
                      <Text fontSize="sm" mb={1}>Sort Field</Text>
                      <Select value={sortField} onChange={(e) => setSortField(e.target.value as typeof sortField)}>
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </Box>
                    <Box>
                      <Text fontSize="sm" mb={1}>Direction</Text>
                      <Select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as typeof sortDirection)}>
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                      </Select>
                    </Box>
                    <Box>
                      <Text fontSize="sm" mb={1}>Admin Filters</Text>
                      <HStack spacing={3}>
                        <Switch size="lg" colorScheme="purple" />
                        <Text fontSize="sm">Company / Village / Cluster</Text>
                      </HStack>
                    </Box>
                  </SimpleGrid>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontWeight="bold">Company Leaderboard</Text>
                      <Text color="brand.subtleText">Sorted by points with live updates</Text>
                    </Box>
                    <HStack spacing={2}>
                      <Badge colorScheme="blue">Virtualized</Badge>
                      <Badge colorScheme="purple">Real-time</Badge>
                    </HStack>
                  </Flex>
                </CardHeader>
                <CardBody>
                  <Box border="1px solid" borderColor="brand.border" borderRadius="lg" overflow="hidden">
                    <Box
                      maxH="420px"
                      overflowY="auto"
                      onScroll={leaderboardRows.length > virtualizationThreshold ? onScrollVirtual : undefined}
                    >
                      <Table variant="simple" size="md">
                        <Thead position="sticky" top={0} bg="surface.default" zIndex={1}>
                          <Tr>
                            <Th>Rank</Th>
                            <Th>Member</Th>
                            <Th>Level</Th>
                            <Th>Badges</Th>
                            <Th isNumeric>Points</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {virtualized.paddingTop > 0 && (
                            <Tr height={`${virtualized.paddingTop}px`}>
                              <Td colSpan={5} p={0} borderBottom="none" />
                            </Tr>
                          )}
                          {virtualized.rows.map((row) => (
                            <Tr key={row.user.id} bg={row.user.id === profile?.id ? 'brand.primaryMuted' : 'transparent'} height={`${rowHeight}px`}>
                              <Td>{getRankIcon(row.rank)}</Td>
                              <Td>
                                <HStack spacing={3}>
                                  <Avatar size="sm" name={row.user.fullName} src={row.user.avatarUrl} />
                                  <Box>
                                    <Text fontWeight="bold">{row.user.fullName}</Text>
                                    <Text fontSize="xs" color="brand.subtleText">
                                      {row.user.companyId || 'Independent'} · {row.user.villageId || 'Village TBD'} · {row.user.clusterId || 'Cluster TBD'}
                                    </Text>
                                    <HStack spacing={2} mt={1}>
                                      <Badge colorScheme="green">Active</Badge>
                                      <Badge colorScheme="purple">{row.badgeCount} badges</Badge>
                                      <Badge colorScheme="orange">Level {row.level}</Badge>
                                    </HStack>
                                  </Box>
                                </HStack>
                              </Td>
                              <Td>Lvl {row.level}</Td>
                              <Td>
                                <HStack spacing={1}>
                                  {Array.from({ length: Math.min(row.badgeCount, 4) }).map((_, idx) => (
                                    <Icon key={idx} as={Star} color="yellow.400" size={14} />
                                  ))}
                                </HStack>
                              </Td>
                              <Td isNumeric>
                                <Text fontWeight="bold">{formatNumber(row.activePoints)}</Text>
                                <Text fontSize="xs" color="brand.subtleText">Total {formatNumber(row.totalPoints)}</Text>
                              </Td>
                            </Tr>
                          ))}
                          {virtualized.paddingBottom > 0 && (
                            <Tr height={`${virtualized.paddingBottom}px`}>
                              <Td colSpan={5} p={0} borderBottom="none" />
                            </Tr>
                          )}
                        </Tbody>
                      </Table>
                    </Box>
                    {leaderboardRows.length > leaderboardPage * pageSize && (
                      <Button
                        w="full"
                        variant="secondary"
                        onClick={() => setLeaderboardPage((prev) => prev + 1)}
                        borderTopRadius={0}
                      >
                        Load more (25 per page)
                      </Button>
                    )}
                  </Box>
                </CardBody>
              </Card>

              <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={4}>
                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">Peer Progress</Text>
                    <Text color="brand.subtleText">Compare with nearby ranks</Text>
                  </CardHeader>
                  <CardBody>
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th>Rank</Th>
                          <Th>Member</Th>
                          <Th>Active Points</Th>
                          <Th>Total</Th>
                          <Th>Level</Th>
                          <Th>Δ vs You</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {peerRows.map((row) => (
                          <Tr key={row.user.id} bg={row.user.id === profile?.id ? 'brand.primaryMuted' : 'transparent'}>
                            <Td>{row.rank}</Td>
                            <Td>
                              <HStack spacing={2}>
                                <Avatar size="xs" name={row.user.fullName} src={row.user.avatarUrl} />
                                <Text>{row.user.fullName}</Text>
                              </HStack>
                            </Td>
                            <Td>{formatNumber(row.activePoints)}</Td>
                            <Td>{formatNumber(row.totalPoints)}</Td>
                            <Td>{row.level}</Td>
                            <Td color={row.delta >= 0 ? 'green.500' : 'red.500'}>
                              {row.delta >= 0 ? '+' : ''}
                              {formatNumber(row.delta)}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <Text fontWeight="bold">Cohort Comparison</Text>
                    <Text color="brand.subtleText">Benchmarks vs cohort max & averages</Text>
                  </CardHeader>
                  <CardBody>
                    <Stack spacing={4}>
                      <Box>
                        <HStack justify="space-between">
                          <Text>Total Points</Text>
                          <Text color="brand.subtleText">Avg {formatNumber(cohortStats.avgTotal)}</Text>
                        </HStack>
                        <Progress value={(cohortStats.total / cohortStats.maxTotal) * 100} colorScheme="blue" borderRadius="full" />
                      </Box>
                      <Box>
                        <HStack justify="space-between">
                          <Text>Active Points</Text>
                          <Text color="brand.subtleText">Avg {formatNumber(cohortStats.avgActive)}</Text>
                        </HStack>
                        <Progress value={(cohortStats.active / cohortStats.maxActive) * 100} colorScheme="yellow" borderRadius="full" />
                      </Box>
                      <Box>
                        <HStack justify="space-between">
                          <Text>Level</Text>
                          <Text color="brand.subtleText">Avg {cohortStats.avgLevel}</Text>
                        </HStack>
                        <Progress value={(cohortStats.level / cohortStats.maxLevel) * 100} colorScheme="purple" borderRadius="full" />
                      </Box>
                    </Stack>
                  </CardBody>
                </Card>
              </Grid>

              <Card>
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontWeight="bold">Points Breakdown</Text>
                      <Text color="brand.subtleText">Corporate members only</Text>
                    </Box>
                    <HStack spacing={3}>
                      <IconButton
                        aria-label="Previous page"
                        icon={<ArrowUpAZ />}
                        variant="secondary"
                        size="sm"
                        onClick={() => setBreakdownPage((prev) => Math.max(1, prev - 1))}
                      />
                      <IconButton
                        aria-label="Next page"
                        icon={<ArrowDownAZ />}
                        variant="secondary"
                        size="sm"
                        onClick={() => setBreakdownPage((prev) => prev + 1)}
                      />
                    </HStack>
                  </Flex>
                </CardHeader>
                <CardBody>
                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4} alignItems="center">
                    <Box h="260px">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie dataKey="value" data={breakdownByCategory} innerRadius={60} outerRadius={90} label>
                            {breakdownByCategory.map((entry, index) => (
                              <Cell key={`cell-${entry.name}`} fill={pointsColors[index % pointsColors.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    <Stack spacing={3}>
                      {breakdownByCategory.slice((breakdownPage - 1) * 4, (breakdownPage - 1) * 4 + 4).map((category, idx) => (
                        <Flex key={category.name} align="center" gap={3}>
                          <Box w={2} h={12} borderRadius="full" bg={pointsColors[idx % pointsColors.length]} />
                          <Box flex="1">
                            <Flex justify="space-between">
                              <Text fontWeight="bold">{category.name}</Text>
                              <Text>{formatNumber(category.value)} pts</Text>
                            </Flex>
                            <Progress value={category.percent} colorScheme="purple" borderRadius="full" />
                            <Text fontSize="xs" color="brand.subtleText">{category.percent}% of active points</Text>
                          </Box>
                        </Flex>
                      ))}
                      <Text fontSize="sm" color="brand.subtleText">Page {breakdownPage} of {Math.max(1, Math.ceil(breakdownByCategory.length / 4))}</Text>
                    </Stack>
                  </Grid>
                </CardBody>
              </Card>

              {showPeerConnect && (
                <Card>
                  <CardHeader>
                    <Flex justify="space-between" align="center">
                      <Text fontWeight="bold">Peer Connect</Text>
                      <Button size="sm" variant="secondary" onClick={() => setShowPeerConnect(false)}>Back to Leaderboard</Button>
                    </Flex>
                  </CardHeader>
                  <CardBody>
                    <PeerConnectPage />
                  </CardBody>
                </Card>
              )}
            </Stack>
          </TabPanel>

          <TabPanel px={0}>
            <Stack spacing={5}>
              <Card bgGradient="linear(to-r, purple.500, purple.700)" color="text.inverse">
                <CardBody>
                  <Flex align="center" justify="space-between">
                    <Box>
                      <Text fontSize="sm" opacity={0.9}>Challenge Weeks are Live</Text>
                      <Text fontSize="2xl" fontWeight="bold">Friendly competitions to spark growth</Text>
                      <HStack spacing={3} mt={2}>
                        <Icon as={Clock} />
                        <Text>Join or launch a challenge today</Text>
                      </HStack>
                    </Box>
                    <Button variant="secondary" onClick={onOpen} rightIcon={<Icon as={Target} />}>Start a Challenge</Button>
                  </Flex>
                </CardBody>
              </Card>

              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Card>
                  <CardBody>
                    <Stat>
                      <StatLabel>Active Challenges</StatLabel>
                      <StatNumber>{challenges.filter((c) => c.status === 'active').length}</StatNumber>
                    </Stat>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <Stat>
                      <StatLabel>Victories</StatLabel>
                      <StatNumber>{challenges.filter((c) => c.result === 'win').length}</StatNumber>
                    </Stat>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <Stat>
                      <StatLabel>Points Earned</StatLabel>
                      <StatNumber>{formatNumber(challenges.reduce((sum, c) => sum + c.yourPoints, 0))}</StatNumber>
                    </Stat>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <Stat>
                      <StatLabel>Leaderboard Rank</StatLabel>
                      <StatNumber>{userRow?.rank || '—'}</StatNumber>
                    </Stat>
                  </CardBody>
                </Card>
              </SimpleGrid>

              <Card>
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Text fontWeight="bold">Your Challenges</Text>
                    <Button size="sm" onClick={onOpen}>New Challenge</Button>
                  </Flex>
                </CardHeader>
                <CardBody>
                  {emptyChallenges ? (
                    <VStack spacing={3} py={8} color="brand.subtleText">
                      <Icon as={Users} size={48} />
                      <Text fontWeight="bold">No Active Challenges</Text>
                      <Text>Start your first head-to-head battle to climb faster.</Text>
                    </VStack>
                  ) : (
                    <Stack spacing={3}>
                      {challenges
                        .filter((c) => c.status === 'active')
                        .map((challenge) => (
                          <Flex key={challenge.id} p={4} border="1px solid" borderColor="brand.border" borderRadius="lg" align="center" gap={4}>
                            <Avatar name={challenge.opponentName} src={challenge.opponentAvatar} />
                            <Box flex="1">
                              <Text fontWeight="bold">vs {challenge.opponentName}</Text>
                              <Text fontSize="sm" color="brand.subtleText">{challenge.startDate} → {challenge.endDate}</Text>
                              <Progress mt={2} value={(challenge.yourPoints / Math.max(challenge.yourPoints, challenge.opponentPoints || 1)) * 100} colorScheme="purple" borderRadius="full" />
                            </Box>
                            <VStack spacing={1} align="flex-end">
                              <Text fontWeight="bold">You {formatNumber(challenge.yourPoints)}</Text>
                              <Text color="brand.subtleText">Opponent {formatNumber(challenge.opponentPoints)}</Text>
                              <Badge colorScheme={challenge.yourPoints >= challenge.opponentPoints ? 'green' : 'red'}>{challenge.status}</Badge>
                            </VStack>
                          </Flex>
                        ))}
                    </Stack>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Text fontWeight="bold">Challenge History</Text>
                  <Text color="brand.subtleText">Wins, losses, and stats</Text>
                </CardHeader>
                <CardBody>
                  <Stack spacing={3}>
                    {challenges
                      .filter((c) => c.status === 'completed')
                      .map((challenge) => (
                        <Flex key={challenge.id} p={3} border="1px solid" borderColor="brand.border" borderRadius="lg" align="center" gap={3}>
                          <Icon as={Award} color={challenge.result === 'win' ? 'green.400' : 'red.400'} />
                          <Box flex="1">
                            <Text fontWeight="bold">{challenge.opponentName}</Text>
                            <Text fontSize="sm" color="brand.subtleText">{challenge.startDate} → {challenge.endDate}</Text>
                          </Box>
                          <Text fontWeight="bold">{challenge.result?.toUpperCase() || 'DRAW'}</Text>
                        </Flex>
                      ))}
                  </Stack>
                </CardBody>
              </Card>
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Start a Challenge</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Box>
                <Text fontSize="sm" mb={1}>Opponent</Text>
                <Select>
                  {leaderboardRows.map((row) => (
                    <option key={row.user.id} value={row.user.id}>{row.user.fullName}</option>
                  ))}
                </Select>
              </Box>
              <Box>
                <Text fontSize="sm" mb={1}>Challenge Type</Text>
                <Select>
                  <option>7-day sprint</option>
                  <option>30-day marathon</option>
                  <option>Custom goals</option>
                </Select>
              </Box>
              <Box>
                <Text fontSize="sm" mb={1}>Point Goal</Text>
                <Select>
                  <option>500 pts</option>
                  <option>1,000 pts</option>
                  <option>2,500 pts</option>
                </Select>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => toast({ title: 'Challenge created', status: 'success', duration: 2000 })}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}
