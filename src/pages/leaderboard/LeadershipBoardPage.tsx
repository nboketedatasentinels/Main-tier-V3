import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Skeleton,
  SkeletonCircle,
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
  Tooltip,
  useDisclosure,
  useToken,
  useToast,
  VStack,
} from '@chakra-ui/react'
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpRight,
  Award,
  Clock,
  Crown,
  Info,
  Medal,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  QueryConstraint,
  query,
  where,
} from 'firebase/firestore'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Badge as BadgeDefinition, LeaderboardTimeframe, UserProfile } from '@/types'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { StartChallengeModal } from '@/components/modals/StartChallengeModal'
import { isAdminRole } from '@/utils/role'
import {
  filterProfilesBySegment,
  getSegmentContext,
  isProfileInSegment,
} from '@/utils/leaderboardSegmentation'

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

interface FeaturedBadge {
  id: string
  name: string
  description?: string
  iconUrl?: string
  color?: string
  type?: BadgeDefinition['type']
  earnedAt?: string
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
  const navigate = useNavigate()
  const { profile: authProfile, refreshProfile } = useAuth()
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const pointsColors = useToken('colors', [
    'brand.primary',
    'brand.dark',
    'accent.warning',
    'success.500',
    'warning.500',
    'tint.brandPrimary',
  ])
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>(LeaderboardTimeframe.ALL_TIME)
  const [sortField, setSortField] = useState<'points' | 'level' | 'name'>('points')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null)
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([])
  const [virtualOffset, setVirtualOffset] = useState(0)
  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const [breakdownPage, setBreakdownPage] = useState(1)
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [transactionsLoaded, setTransactionsLoaded] = useState(false)
  const [featuredBadges, setFeaturedBadges] = useState<FeaturedBadge[]>([])
  const [badgesLoading, setBadgesLoading] = useState(false)
  const [badgesError, setBadgesError] = useState<string | null>(null)
  const [pointsPulse, setPointsPulse] = useState(false)
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false)
  const [adminViewAll, setAdminViewAll] = useState(false)
  const [showFilterTip, setShowFilterTip] = useState(() => {
    const stored = localStorage.getItem('leaderboard-filter-tip')
    return stored !== 'dismissed'
  })
  const previousTotalPoints = useRef<number | null>(null)
  const previousLevel = useRef<number | null>(null)
  const timeframeStart = useMemo(() => toDateFromTimeframe(timeframe), [timeframe])
  const enableProfileRealtime = import.meta.env.VITE_ENABLE_PROFILE_REALTIME === 'true'

  const profile = useMemo(() => {
    if (!authProfile && !currentProfile) return null
    return {
      ...(authProfile ?? {}),
      ...(currentProfile ?? {}),
      id: currentProfile?.id ?? authProfile?.id,
    } as UserProfile
  }, [authProfile, currentProfile])

  const segmentContext = useMemo(() => getSegmentContext(profile), [profile])
  const segmentLabel = segmentContext?.label ?? 'Leaderboard'
  const segmentMemberLabel = segmentContext?.memberLabel ?? 'Members'
  const segmentScopeText = segmentContext?.scopeText ?? 'Across your community'
  const segmentBadgeLabel = segmentContext ? `${segmentContext.label} View` : 'Segment View'
  const isAdminViewer = isAdminRole(profile?.role)

  const segmentIssue = useMemo(() => {
    if (!profile || !segmentContext) return null
    if (!segmentContext.filterValue) {
      if (segmentContext.type === 'free_village') {
        return 'Please contact support to join a village.'
      }
      if (segmentContext.type === 'corporate_org') {
        return 'Organization assignment required to view this leaderboard.'
      }
      return 'Segment details are missing. Please refresh your profile.'
    }
    return null
  }, [profile, segmentContext])

  useEffect(() => {
    if (!isAdminViewer && adminViewAll) {
      setAdminViewAll(false)
    }
  }, [adminViewAll, isAdminViewer])

  const pointsPulseStyle = pointsPulse ? 'pointsPulse 1.2s ease-in-out' : 'none'

  const fetchFeaturedBadges = useCallback(async () => {
    if (!profile?.id) return
    setBadgesLoading(true)
    setBadgesError(null)

    const normalizeEarnedAt = (value: unknown) => {
      if (!value) return undefined
      if (typeof value === 'string') return value
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'object' && 'toDate' in value) {
        return (value as { toDate: () => Date }).toDate().toISOString()
      }
      return undefined
    }

    try {
      const userBadgeQuery = query(
        collection(db, 'user_badges'),
        where('userId', '==', profile.id),
        orderBy('earnedAt', 'desc'),
        limit(5),
      )
      const userBadgeSnapshot = await getDocs(userBadgeQuery)
      const userBadges = userBadgeSnapshot.docs.map((docItem) => {
        const data = docItem.data() as { badgeId?: string; earnedAt?: unknown }
        return {
          id: docItem.id,
          badgeId: data.badgeId ?? docItem.id,
          earnedAt: normalizeEarnedAt(data.earnedAt),
        }
      })

      if (!userBadges.length) {
        setFeaturedBadges([])
        return
      }

      const badgeIds = Array.from(new Set(userBadges.map((badge) => badge.badgeId).filter(Boolean))) as string[]
      const badgeDefsMap = new Map<string, BadgeDefinition>()

      if (badgeIds.length) {
        const badgeDefsSnapshot = await getDocs(
          query(collection(db, 'badges'), where(documentId(), 'in', badgeIds))
        )
        badgeDefsSnapshot.docs.forEach((docItem) => {
          const data = docItem.data() as Partial<BadgeDefinition> & { title?: string }
          badgeDefsMap.set(docItem.id, {
            id: docItem.id,
            name: data.name ?? data.title ?? 'Badge',
            description: data.description ?? '',
            iconUrl: data.iconUrl ?? '',
            color: data.color ?? 'gray.500',
            type: data.type ?? 'special',
            criteria: data.criteria ?? '',
            pointsRequired: data.pointsRequired,
            createdAt: data.createdAt ?? '',
          })
        })
      }

      const mergedBadges = userBadges.map((userBadge) => {
        const definition = badgeDefsMap.get(userBadge.badgeId)
        return {
          id: definition?.id ?? userBadge.badgeId,
          name: definition?.name ?? 'Badge',
          description: definition?.description,
          iconUrl: definition?.iconUrl,
          color: definition?.color,
          type: definition?.type,
          earnedAt: userBadge.earnedAt,
        }
      })

      setFeaturedBadges(mergedBadges)
    } catch (error) {
      console.error('🔴 [Leaderboard] Failed to load badges', error)
      setBadgesError('Badges unavailable right now.')
    } finally {
      setBadgesLoading(false)
    }
  }, [profile?.id])

  const refetchChallenges = useCallback(async () => {
    if (!profile) return

    const challengeQuery = query(
      collection(db, 'challenges'),
      where('participants', 'array-contains', profile.id),
      orderBy('startDate', 'desc'),
      limit(25),
    )

    const snapshot = await getDocs(challengeQuery)
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
  }, [profile])

  const handleChallengeCreated = useCallback(() => {
    refetchChallenges()
    toast({
      title: 'Challenge created',
      description: 'Your opponent will receive a notification.',
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }, [refetchChallenges, toast])

  useEffect(() => {
    if (!profile) return undefined

    const canViewAll = isAdminViewer && adminViewAll
    if (!segmentContext && !canViewAll) {
      setProfiles([])
      setProfilesLoaded(true)
      return undefined
    }

    if (!segmentContext?.filterValue && !canViewAll) {
      setProfiles([])
      setProfilesLoaded(true)
      return undefined
    }

    setProfilesLoaded(false)
    const profileQuery = canViewAll
      ? query(collection(db, 'profiles'))
      : query(collection(db, 'profiles'), where(segmentContext!.filterField, '==', segmentContext!.filterValue))

    const unsubscribe = onSnapshot(profileQuery, (snapshot) => {
      const loadedProfiles: UserProfile[] = snapshot.docs.map((doc) => doc.data() as UserProfile)
      setProfiles(loadedProfiles)
      setProfilesLoaded(true)
    })

    return () => unsubscribe()
  }, [
    adminViewAll,
    isAdminViewer,
    profile,
    segmentContext,
    segmentContext?.filterField,
    segmentContext?.filterValue,
  ])

  useEffect(() => {
    void fetchFeaturedBadges()
  }, [fetchFeaturedBadges])

  useEffect(() => {
    if (!profile) return undefined

    const canViewAll = isAdminViewer && adminViewAll
    if (!segmentContext && !canViewAll) {
      setTransactions([])
      setTransactionsLoaded(true)
      return undefined
    }

    if (!segmentContext?.filterValue && !canViewAll) {
      setTransactions([])
      setTransactionsLoaded(true)
      return undefined
    }

    setTransactionsLoaded(false)
    const constraints: QueryConstraint[] = []

    if (!canViewAll && segmentContext?.type === 'corporate_org' && profile.companyId) {
      constraints.push(where('companyId', '==', profile.companyId))
    }

    constraints.push(orderBy('createdAt', 'desc'))
    constraints.push(limit(500))

    const txQuery = query(collection(db, 'points_transactions'), ...constraints)
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
      setTransactionsLoaded(true)
    })

    return () => unsubscribe()
  }, [adminViewAll, isAdminViewer, profile, segmentContext])

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
    if (!profile?.id) return undefined

    const profileRef = doc(db, 'profiles', profile.id)
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (!snapshot.exists()) return
        const data = snapshot.data() as UserProfile
        setCurrentProfile({
          ...data,
          id: snapshot.id,
          journeyType: data.journeyType || profile.journeyType || '4W',
          role: profile.role || data.role,
        })
      },
      (error) => {
        console.error('🔴 [Leaderboard] Profile listener error', error)
      }
    )

    return () => unsubscribe()
  }, [profile?.id, profile?.journeyType, profile?.role])

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

  useEffect(() => {
    if (!profile?.id) return undefined

    if (enableProfileRealtime) {
      console.log('🟢 [Leaderboard] Profile realtime enabled')
      return undefined
    }

    console.log('🟠 [Leaderboard] Profile realtime disabled, polling every 60s')
    const interval = setInterval(() => {
      void refreshProfile({ reason: 'leaderboard-interval' })
    }, 60_000)

    return () => clearInterval(interval)
  }, [enableProfileRealtime, profile?.id, refreshProfile])

  useEffect(() => {
    if (!segmentContext || (adminViewAll && isAdminViewer)) return
    const invalidProfiles = profiles.filter((candidate) => !isProfileInSegment(candidate, segmentContext))
    if (invalidProfiles.length) {
      console.warn('🟠 [Leaderboard] Segment mismatch detected', invalidProfiles.map((p) => p.id))
    }
  }, [adminViewAll, isAdminViewer, profiles, segmentContext])

  const handleManualRefresh = async () => {
    setIsRefreshingProfile(true)
    const result = await refreshProfile({ reason: 'leaderboard-manual' })
    setIsRefreshingProfile(false)

    if (result.error) {
      toast({
        title: 'Refresh failed',
        description: result.error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    toast({
      title: 'Profile refreshed',
      description: 'Latest points have been synced.',
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }

  const dismissFilterTip = () => {
    setShowFilterTip(false)
    localStorage.setItem('leaderboard-filter-tip', 'dismissed')
  }

  const segmentProfiles = useMemo(() => {
    if (adminViewAll && isAdminViewer) return profiles
    return filterProfilesBySegment(profiles, profile)
  }, [adminViewAll, isAdminViewer, profiles, profile])

  const segmentProfileIds = useMemo(() => new Set(segmentProfiles.map((item) => item.id)), [segmentProfiles])

  const segmentTransactions = useMemo(() => {
    if (adminViewAll && isAdminViewer) return transactions
    if (!segmentProfileIds.size) return []
    return transactions.filter((tx) => segmentProfileIds.has(tx.userId))
  }, [adminViewAll, isAdminViewer, segmentProfileIds, transactions])

  const segmentChallenges = useMemo(() => {
    if (adminViewAll && isAdminViewer) return challenges
    if (!segmentProfileIds.size) return []
    return challenges.filter((challenge) => {
      if (!challenge.opponentId) return true
      return segmentProfileIds.has(challenge.opponentId)
    })
  }, [adminViewAll, challenges, isAdminViewer, segmentProfileIds])

  const aggregatedPoints = useMemo(() => {
    const totals: Record<string, number> = {}
    segmentTransactions.forEach((tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
      if (timeframe === LeaderboardTimeframe.CURRENT_JOURNEY && tx.userId !== profile?.id) return
      if (timeframeStart && createdAt && createdAt < timeframeStart) return
      totals[tx.userId] = (totals[tx.userId] || 0) + tx.points
    })
    return totals
  }, [profile?.id, segmentTransactions, timeframe, timeframeStart])

  const weeklyPoints = useMemo(() => {
    if (!profile) return 0
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return segmentTransactions.reduce((sum, tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
      if (tx.userId === profile.id && createdAt && createdAt >= start) {
        return sum + tx.points
      }
      return sum
    }, 0)
  }, [profile, segmentTransactions])

  const monthlyPoints = useMemo(() => {
    if (!profile) return 0
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return segmentTransactions.reduce((sum, tx) => {
      const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
      if (tx.userId === profile.id && createdAt && createdAt >= start) {
        return sum + tx.points
      }
      return sum
    }, 0)
  }, [profile, segmentTransactions])

  const segmentSize = useMemo(() => segmentProfiles.length, [segmentProfiles])

  const leaderboardRows: LeaderboardRow[] = useMemo(() => {
    const visibleProfiles = adminViewAll && isAdminViewer ? profiles : segmentProfiles
    const validatedProfiles = adminViewAll && isAdminViewer
      ? visibleProfiles
      : visibleProfiles.filter((candidate) => (segmentContext ? isProfileInSegment(candidate, segmentContext) : false))

    const rows = validatedProfiles
      .filter((p) => p.privacySettings?.showOnLeaderboard !== false)
      .map((user) => {
        const activePoints = timeframe === LeaderboardTimeframe.ALL_TIME ? user.totalPoints : aggregatedPoints[user.id] || 0
        const badgeCount = Math.max(
          1,
          Math.round((timeframe === LeaderboardTimeframe.ALL_TIME ? user.totalPoints : activePoints) / 500),
        )

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
  }, [
    adminViewAll,
    aggregatedPoints,
    isAdminViewer,
    profiles,
    segmentContext,
    segmentProfiles,
    sortDirection,
    sortField,
    timeframe,
  ])

  const percentile = useMemo(() => {
    if (!profile) return 'Top 100%'
    const currentRank = leaderboardRows.find((row) => row.user.id === profile.id)?.rank || leaderboardRows.length
    if (!leaderboardRows.length) return 'Top 100%'
    const pct = Math.round((currentRank / leaderboardRows.length) * 100)
    return `Top ${pct}%`
  }, [leaderboardRows, profile])

  const userRow = useMemo(() => leaderboardRows.find((row) => row.user.id === profile?.id), [leaderboardRows, profile])

  const isPointsReady = Boolean(profile) && profilesLoaded && transactionsLoaded
  const displayTotalPoints = userRow?.totalPoints ?? profile?.totalPoints ?? 0
  const displayLevel = userRow?.level ?? profile?.level ?? 1

  useEffect(() => {
    if (!profile) return

    if (previousTotalPoints.current === null || previousLevel.current === null) {
      previousTotalPoints.current = displayTotalPoints
      previousLevel.current = displayLevel
      return
    }

    if (displayTotalPoints > previousTotalPoints.current) {
      const delta = displayTotalPoints - previousTotalPoints.current
      setPointsPulse(true)
      toast({
        title: 'Points earned!',
        description: `+${formatNumber(delta)} points added to your total.`,
        status: 'success',
        duration: 2500,
        isClosable: true,
      })
    }

    if (displayLevel > (previousLevel.current ?? 0)) {
      toast({
        title: 'Level up!',
        description: `You reached level ${displayLevel}.`,
        status: 'success',
        duration: 2500,
        isClosable: true,
      })
    }

    previousTotalPoints.current = displayTotalPoints
    previousLevel.current = displayLevel
  }, [displayLevel, displayTotalPoints, profile, toast])

  useEffect(() => {
    if (!pointsPulse) return undefined
    const timeout = setTimeout(() => setPointsPulse(false), 1200)
    return () => clearTimeout(timeout)
  }, [pointsPulse])

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
    const level = displayLevel
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
  }, [displayLevel, leaderboardRows, userRow])

  const breakdownByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {}
    segmentTransactions.forEach((tx) => {
      if (tx.category) {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.points
      }
    })

    return Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value,
      percent: userRow?.activePoints ? Math.round((value / userRow.activePoints) * 100) : 0,
    }))
  }, [segmentTransactions, userRow?.activePoints])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(breakdownByCategory.length / 4))
    if (breakdownPage > maxPage) {
      setBreakdownPage(maxPage)
    }
  }, [breakdownByCategory.length, breakdownPage])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Icon as={Crown} color="accent.warning" />
    if (rank === 2) return <Icon as={Medal} color="text.muted" />
    if (rank === 3) return <Icon as={Medal} color="brand.primary" />
    return (
      <Badge bg="tint.brandPrimary" color="brand.primary" border="1px solid" borderColor="brand.primary">
        {rank}
      </Badge>
    )
  }

  const segmentStats = {
    weeklyPoints,
    monthlyPoints,
    activeChallenges: segmentChallenges.filter((c) => c.status === 'active').length,
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

  const emptyChallenges = segmentChallenges.filter((challenge) => challenge.status === 'active').length === 0

  return (
    <Stack spacing={6}>
      <Flex align="center" justify="space-between">
        <Box>
          <HStack spacing={3}>
            <Icon as={Sparkles} color="brand.primary" />
            <Text fontSize="sm" color="text.secondary" textTransform="uppercase" letterSpacing="wide">
              Leadership Board
            </Text>
          </HStack>
          <Text fontSize="3xl" fontWeight="bold" color="text.primary" mt={1}>
            Competitive, social, and personalized rankings
          </Text>
          <Text color="text.secondary">Switch between leaderboard and challenge views with real-time data.</Text>
          <HStack spacing={2} mt={3} flexWrap="wrap">
            <Badge colorScheme="primary">{segmentBadgeLabel}</Badge>
            {segmentIssue ? (
              <Badge colorScheme="orange">{segmentIssue}</Badge>
            ) : (
              <Badge colorScheme="green">Segmented privacy enabled</Badge>
            )}
            {isAdminViewer && adminViewAll && (
              <Badge colorScheme="purple">Admin override: All segments</Badge>
            )}
          </HStack>
        </Box>
        <HStack spacing={3}>
          <Button
            variant="outline"
            colorScheme="brand"
            leftIcon={<Icon as={RefreshCw} />}
            isLoading={isRefreshingProfile}
            onClick={handleManualRefresh}
          >
            Refresh
          </Button>
          <Button
            bg="surface.default"
            color="brand.primary"
            border="1px solid"
            borderColor="brand.primary"
            _hover={{ bg: 'tint.brandPrimary' }}
            leftIcon={<Icon as={Info} />}
            onClick={onOpen}
          >
            Start a Challenge
          </Button>
          <Button
            onClick={() => navigate('/app/peer-connect')}
            variant="primary"
            rightIcon={<Icon as={ArrowUpRight} />}
          >
            Open Peer Connect
          </Button>
        </HStack>
      </Flex>

      <Tabs variant="unstyled" colorScheme="primary">
        <TabList
          bg="surface.default"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="lg"
          p={1}
          gap={1}
        >
          <Tab
            _selected={{ bg: 'tint.brandPrimary', color: 'text.primary' }}
            color="text.secondary"
            borderRadius="md"
            px={4}
            py={2}
            fontWeight="600"
          >
            Leaderboard
          </Tab>
          <Tab
            _selected={{ bg: 'tint.brandPrimary', color: 'text.primary' }}
            color="text.secondary"
            borderRadius="md"
            px={4}
            py={2}
            fontWeight="600"
          >
            Challenges
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <Stack spacing={6}>
              <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={4}>
                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardHeader>
                    <HStack justify="space-between" align="center">
                      <Box>
                        <Text fontSize="lg" fontWeight="bold">Progress Overview</Text>
                        <Text color="text.secondary">Live updates</Text>
                      </Box>
                      <Badge colorScheme="primary" display="flex" alignItems="center" gap={2}>
                        <Icon as={Trophy} /> {percentile}
                      </Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                      <Stat>
                        <StatLabel color="text.muted">Your Current Rank</StatLabel>
                        <StatNumber color="text.primary" display="flex" alignItems="center" gap={2}>
                          {getRankIcon(userRow?.rank || leaderboardRows.length || 1)}
                          {userRow?.rank || '—'}
                        </StatNumber>
                        <StatHelpText color="text.secondary">{segmentScopeText}</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel color="text.muted">Total Points</StatLabel>
                        <Skeleton isLoaded={isPointsReady} height="32px">
                          <StatNumber color="text.primary" animation={pointsPulseStyle}>
                            {formatNumber(displayTotalPoints)}
                          </StatNumber>
                        </Skeleton>
                        <StatHelpText color="text.secondary">Lifetime XP</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel color="text.muted">Current Level</StatLabel>
                        <Skeleton isLoaded={isPointsReady} height="32px">
                          <StatNumber color="text.primary" animation={pointsPulseStyle}>
                            {displayLevel}
                          </StatNumber>
                        </Skeleton>
                        <StatHelpText color="text.secondary">Keep climbing</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel color="text.muted">Weekly Points</StatLabel>
                        <Skeleton isLoaded={isPointsReady} height="32px">
                          <StatNumber color="text.primary">{formatNumber(segmentStats.weeklyPoints)}</StatNumber>
                        </Skeleton>
                        <StatHelpText color="text.secondary">Last 7 days</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel color="text.muted">Monthly Points</StatLabel>
                        <Skeleton isLoaded={isPointsReady} height="32px">
                          <StatNumber color="text.primary">{formatNumber(segmentStats.monthlyPoints)}</StatNumber>
                        </Skeleton>
                        <StatHelpText color="text.secondary">Last 30 days</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel color="text.muted">Active Challenges</StatLabel>
                        <StatNumber color="text.primary">{segmentStats.activeChallenges}</StatNumber>
                        <StatHelpText color="text.secondary">Live battles</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel color="text.muted">Badges Earned</StatLabel>
                        <StatNumber color="text.primary">{segmentStats.badgesEarned}</StatNumber>
                        <StatHelpText color="text.secondary">Achievement count</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel color="text.muted">{segmentMemberLabel}</StatLabel>
                        <StatNumber color="text.primary">{segmentSize || 1}</StatNumber>
                        <StatHelpText color="text.secondary">{segmentLabel} size</StatHelpText>
                      </Stat>
                    </SimpleGrid>
                  </CardBody>
                </Card>

                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardHeader pb={2}>
                    <HStack justify="space-between">
                      <Text fontWeight="bold">Personal View</Text>
                      <Badge colorScheme="success">Private Controls</Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    <VStack align="stretch" spacing={4}>
                      <HStack spacing={4}>
                        <Avatar size="lg" name={profile?.fullName} src={profile?.avatarUrl} />
                        <Box>
                          <Text fontWeight="bold">{profile?.fullName || 'You'}</Text>
                          <Text color="text.secondary">
                            Level {displayLevel} · {formatNumber(displayTotalPoints)} pts
                          </Text>
                        </Box>
                      </HStack>
                      <SimpleGrid columns={3} spacing={3}>
                        <Box p={3} border="1px solid" borderColor="border.subtle" borderRadius="lg">
                          <Text fontSize="xs" color="text.secondary">Active Points</Text>
                          <Text fontWeight="bold">{formatNumber(userRow?.activePoints || 0)}</Text>
                        </Box>
                        <Box p={3} border="1px solid" borderColor="border.subtle" borderRadius="lg">
                          <Text fontSize="xs" color="text.secondary">Total Points</Text>
                          <Text fontWeight="bold" animation={pointsPulseStyle}>
                            {formatNumber(displayTotalPoints)}
                          </Text>
                        </Box>
                        <Box p={3} border="1px solid" borderColor="border.subtle" borderRadius="lg">
                          <Text fontSize="xs" color="text.secondary">Featured Badges</Text>
                          {badgesLoading ? (
                            <HStack spacing={2} mt={2}>
                              {Array.from({ length: 3 }).map((_, index) => (
                                <SkeletonCircle key={index} size="8" />
                              ))}
                            </HStack>
                          ) : badgesError ? (
                            <Text fontSize="xs" color="text.secondary" mt={2}>
                              {badgesError}
                            </Text>
                          ) : featuredBadges.length ? (
                            <HStack spacing={2} mt={2}>
                              {featuredBadges.map((badge) => {
                                const earnedAtLabel = badge.earnedAt
                                  ? new Date(badge.earnedAt).toLocaleDateString()
                                  : 'Date unavailable'
                                return (
                                  <Tooltip
                                    key={badge.id}
                                    label={`${badge.name} • ${earnedAtLabel}`}
                                    hasArrow
                                  >
                                    <Avatar
                                      size="xs"
                                      name={badge.name}
                                      src={badge.iconUrl}
                                      bg={badge.color ?? 'gray.500'}
                                      color="white"
                                      icon={<Icon as={Award} />}
                                      border="1px solid"
                                      borderColor="border.subtle"
                                    />
                                  </Tooltip>
                                )
                              })}
                            </HStack>
                          ) : (
                            <HStack spacing={2} mt={2} color="text.secondary">
                              <Icon as={Award} boxSize={4} />
                              <Text fontSize="xs">No badges earned yet.</Text>
                            </HStack>
                          )}
                        </Box>
                      </SimpleGrid>
                    </VStack>
                  </CardBody>
                </Card>
              </Grid>

              <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontWeight="bold">Filters & Sorting</Text>
                      <Text color="text.secondary">Timeframes, sorting, and tutorials</Text>
                    </Box>
                    <HStack spacing={2}>
                      <Button size="sm" onClick={handleApplyFilters}>Apply</Button>
                      <Button size="sm" variant="secondary" onClick={handleResetFilters}>Reset</Button>
                    </HStack>
                  </Flex>
                  {showFilterTip && (
                    <Flex mt={3} p={3} borderRadius="md" bg="tint.brandPrimary" align="center" gap={3}>
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
                      <Tooltip
                        label={isAdminViewer ? 'Toggle to view all segments (admin only).' : 'Admin access required.'}
                        hasArrow
                      >
                        <HStack spacing={3}>
                          <Switch
                            size="lg"
                            colorScheme="primary"
                            isChecked={adminViewAll}
                            isDisabled={!isAdminViewer}
                            onChange={(event) => setAdminViewAll(event.target.checked)}
                          />
                          <Text fontSize="sm">
                            {isAdminViewer ? 'Company / Village / Cluster' : 'Segment locked'}
                          </Text>
                        </HStack>
                      </Tooltip>
                    </Box>
                  </SimpleGrid>
                </CardBody>
              </Card>

              <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontWeight="bold">{segmentLabel} Leaderboard</Text>
                      <Text color="text.secondary">Sorted by points with live updates</Text>
                    </Box>
                    <HStack spacing={2}>
                      <Badge colorScheme="primary">Virtualized</Badge>
                      <Badge colorScheme="primary">Real-time</Badge>
                    </HStack>
                  </Flex>
                </CardHeader>
                <CardBody>
                  <Box border="1px solid" borderColor="border.subtle" borderRadius="lg" overflow="hidden">
                    <Box
                      maxH="420px"
                      overflowY="auto"
                      onScroll={leaderboardRows.length > virtualizationThreshold ? onScrollVirtual : undefined}
                    >
                      <Table variant="simple" size="md" color="text.primary">
                        <Thead position="sticky" top={0} bg="surface.default" zIndex={1}>
                          <Tr>
                            <Th color="text.muted">Rank</Th>
                            <Th color="text.muted">Member</Th>
                            <Th color="text.muted">Level</Th>
                            <Th color="text.muted">Badges</Th>
                            <Th color="text.muted" isNumeric>Points</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {virtualized.paddingTop > 0 && (
                            <Tr height={`${virtualized.paddingTop}px`}>
                              <Td colSpan={5} p={0} borderBottom="none" />
                            </Tr>
                          )}
                          {virtualized.rows.map((row) => (
                            <Tr
                              key={row.user.id}
                              bg={row.user.id === profile?.id ? 'tint.brandPrimary' : 'transparent'}
                              _hover={{ bg: row.user.id === profile?.id ? 'tint.brandPrimary' : 'surface.subtle' }}
                              height={`${rowHeight}px`}
                            >
                              <Td>{getRankIcon(row.rank)}</Td>
                              <Td>
                                <HStack spacing={3}>
                                  <Avatar size="sm" name={row.user.fullName} src={row.user.avatarUrl} />
                                  <Box>
                                    <Text fontWeight="bold" color="text.primary">{row.user.fullName}</Text>
                                    <Text fontSize="xs" color="text.secondary">
                                      {row.user.companyId || 'Independent'} · {row.user.villageId || 'Village TBD'} · {row.user.clusterId || 'Cluster TBD'}
                                    </Text>
                                    <HStack spacing={2} mt={1}>
                                      <Badge colorScheme="success">Active</Badge>
                                      <Badge colorScheme="primary">{row.badgeCount} badges</Badge>
                                      <Badge
                                        bg="tint.accentWarning"
                                        color="text.primary"
                                        border="1px solid"
                                        borderColor="accent.warning"
                                      >
                                        Level {row.level}
                                      </Badge>
                                    </HStack>
                                  </Box>
                                </HStack>
                              </Td>
                              <Td color="text.primary">Lvl {row.level}</Td>
                              <Td>
                                <HStack spacing={1}>
                                  {Array.from({ length: Math.min(row.badgeCount, 4) }).map((_, idx) => (
                                    <Icon key={idx} as={Star} color="accent.warning" boxSize={4} />
                                  ))}
                                </HStack>
                              </Td>
                              <Td isNumeric>
                                <Text fontWeight="bold" color="text.primary">{formatNumber(row.activePoints)}</Text>
                                <Text fontSize="xs" color="text.secondary">Total {formatNumber(row.totalPoints)}</Text>
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
                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardHeader>
                    <Text fontWeight="bold">Peer Progress</Text>
                    <Text color="text.secondary">Compare with nearby ranks</Text>
                  </CardHeader>
                  <CardBody>
                    <Table size="sm" color="text.primary">
                      <Thead bg="surface.default">
                        <Tr>
                          <Th color="text.muted">Rank</Th>
                          <Th color="text.muted">Member</Th>
                          <Th color="text.muted">Active Points</Th>
                          <Th color="text.muted">Total</Th>
                          <Th color="text.muted">Level</Th>
                          <Th color="text.muted">Δ vs You</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {peerRows.map((row) => (
                          <Tr
                            key={row.user.id}
                            bg={row.user.id === profile?.id ? 'tint.brandPrimary' : 'transparent'}
                            _hover={{ bg: row.user.id === profile?.id ? 'tint.brandPrimary' : 'surface.subtle' }}
                          >
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
                            <Td color={row.delta >= 0 ? 'success.500' : 'danger.DEFAULT'}>
                              {row.delta >= 0 ? '+' : ''}
                              {formatNumber(row.delta)}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </CardBody>
                </Card>

                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardHeader>
                    <Text fontWeight="bold">Cohort Comparison</Text>
                    <Text color="text.secondary">Benchmarks vs cohort max & averages</Text>
                  </CardHeader>
                  <CardBody>
                    <Stack spacing={4}>
                      <Box>
                        <HStack justify="space-between">
                          <Text>Total Points</Text>
                          <Text color="text.secondary">Avg {formatNumber(cohortStats.avgTotal)}</Text>
                        </HStack>
                        <Progress value={(cohortStats.total / cohortStats.maxTotal) * 100} colorScheme="primary" borderRadius="full" />
                      </Box>
                      <Box>
                        <HStack justify="space-between">
                          <Text>Active Points</Text>
                          <Text color="text.secondary">Avg {formatNumber(cohortStats.avgActive)}</Text>
                        </HStack>
                        <Progress value={(cohortStats.active / cohortStats.maxActive) * 100} colorScheme="secondary" borderRadius="full" />
                      </Box>
                      <Box>
                        <HStack justify="space-between">
                          <Text>Level</Text>
                          <Text color="text.secondary">Avg {cohortStats.avgLevel}</Text>
                        </HStack>
                        <Progress value={(cohortStats.level / cohortStats.maxLevel) * 100} colorScheme="primary" borderRadius="full" />
                      </Box>
                    </Stack>
                  </CardBody>
                </Card>
              </Grid>

              <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontWeight="bold">Points Breakdown</Text>
                      <Text color="text.secondary">{segmentLabel} member insights</Text>
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
                            <Progress value={category.percent} colorScheme="primary" borderRadius="full" />
                            <Text fontSize="xs" color="text.secondary">{category.percent}% of active points</Text>
                          </Box>
                        </Flex>
                      ))}
                      <Text fontSize="sm" color="text.secondary">Page {breakdownPage} of {Math.max(1, Math.ceil(breakdownByCategory.length / 4))}</Text>
                    </Stack>
                  </Grid>
                </CardBody>
              </Card>

            </Stack>
          </TabPanel>

          <TabPanel px={0}>
            <Stack spacing={5}>
              <Card bgGradient="linear(to-r, brand.primary, brand.dark)" color="text.inverse">
                <CardBody>
                  <Stack color="text.inverse">
                    <Flex align="center" justify="space-between">
                      <Box>
                        <Text fontSize="sm" opacity={0.9} color="white">Challenge Weeks are Live</Text>
                        <Text fontSize="2xl" fontWeight="bold" color="white">Friendly competitions to spark growth</Text>
                        <HStack spacing={3} mt={2}>
                          <Icon as={Clock} color="white" />
                          <Text color="white">Join or launch a challenge today</Text>
                        </HStack>
                      </Box>
                      <Button
                        bg="surface.default"
                        color="brand.primary"
                        _hover={{ bg: 'surface.subtle' }}
                        onClick={onOpen}
                        rightIcon={<Icon as={Target} />}
                      >
                        Start a Challenge
                      </Button>
                    </Flex>
                  </Stack>
                </CardBody>
              </Card>

              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardBody>
                    <Stat>
                      <StatLabel color="text.muted">Active Challenges</StatLabel>
                      <StatNumber color="text.primary">{segmentChallenges.filter((c) => c.status === 'active').length}</StatNumber>
                    </Stat>
                  </CardBody>
                </Card>
                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardBody>
                    <Stat>
                      <StatLabel color="text.muted">Victories</StatLabel>
                      <StatNumber color="text.primary">{segmentChallenges.filter((c) => c.result === 'win').length}</StatNumber>
                    </Stat>
                  </CardBody>
                </Card>
                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardBody>
                    <Stat>
                      <StatLabel color="text.muted">Points Earned</StatLabel>
                      <StatNumber color="text.primary">{formatNumber(segmentChallenges.reduce((sum, c) => sum + c.yourPoints, 0))}</StatNumber>
                    </Stat>
                  </CardBody>
                </Card>
                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardBody>
                    <Stat>
                      <StatLabel color="text.muted">Leaderboard Rank</StatLabel>
                      <StatNumber color="text.primary">{userRow?.rank || '—'}</StatNumber>
                    </Stat>
                  </CardBody>
                </Card>
              </SimpleGrid>

              <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Text fontWeight="bold">Your Challenges</Text>
                    <Button size="sm" onClick={onOpen}>New Challenge</Button>
                  </Flex>
                </CardHeader>
                <CardBody>
                  {emptyChallenges ? (
                    <VStack spacing={3} py={8} color="text.secondary">
                      <Icon as={Users} boxSize={12} />
                      <Text fontWeight="bold">No Active Challenges</Text>
                      <Text>Start your first head-to-head battle to climb faster.</Text>
                    </VStack>
                  ) : (
                    <Stack spacing={3}>
                      {segmentChallenges
                        .filter((c) => c.status === 'active')
                        .map((challenge) => (
                          <Flex key={challenge.id} p={4} border="1px solid" borderColor="border.subtle" borderRadius="lg" align="center" gap={4}>
                            <Avatar name={challenge.opponentName} src={challenge.opponentAvatar} />
                            <Box flex="1">
                              <Text fontWeight="bold">vs {challenge.opponentName}</Text>
                              <Text fontSize="sm" color="text.secondary">{challenge.startDate} → {challenge.endDate}</Text>
                              <Progress mt={2} value={(challenge.yourPoints / Math.max(challenge.yourPoints, challenge.opponentPoints || 1)) * 100} colorScheme="primary" borderRadius="full" />
                            </Box>
                            <VStack spacing={1} align="flex-end">
                              <Text fontWeight="bold">You {formatNumber(challenge.yourPoints)}</Text>
                              <Text color="text.secondary">Opponent {formatNumber(challenge.opponentPoints)}</Text>
                              <Badge colorScheme={challenge.yourPoints >= challenge.opponentPoints ? 'success' : 'error'}>{challenge.status}</Badge>
                            </VStack>
                          </Flex>
                        ))}
                    </Stack>
                  )}
                </CardBody>
              </Card>

              <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                <CardHeader>
                  <Text fontWeight="bold">Challenge History</Text>
                  <Text color="text.secondary">Wins, losses, and stats</Text>
                </CardHeader>
                <CardBody>
                  <Stack spacing={3}>
                    {segmentChallenges
                      .filter((c) => c.status === 'completed')
                      .map((challenge) => (
                        <Flex key={challenge.id} p={3} border="1px solid" borderColor="border.subtle" borderRadius="lg" align="center" gap={3}>
                          <Icon as={Award} color={challenge.result === 'win' ? 'success.400' : 'danger.DEFAULT'} />
                          <Box flex="1">
                            <Text fontWeight="bold">{challenge.opponentName}</Text>
                            <Text fontSize="sm" color="text.secondary">{challenge.startDate} → {challenge.endDate}</Text>
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

      <StartChallengeModal
        isOpen={isOpen}
        onClose={onClose}
        onChallengeCreated={handleChallengeCreated}
      />
    </Stack>
  )
}
