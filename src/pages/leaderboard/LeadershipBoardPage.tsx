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
  Collapse,
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
  Skeleton,
  SkeletonCircle,
  Spinner,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
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
  Award,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Crown,
  Lock,
  Medal,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
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
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Badge as BadgeDefinition, LeaderboardTimeframe, UserProfile, UserRole } from '@/types'
import { OrganizationRecord } from '@/types/admin'
import { db } from '@/services/firebase'
import { fetchOrganizationsByIds } from '@/services/organizationService'
import { fetchVillageById, removeMemberFromVillage, VillageSummary } from '@/services/villageService'
import { useAuth } from '@/hooks/useAuth'
import { useLeaderboardContext, getLeaderboardContextLabels } from '@/hooks/leaderboard/useLeaderboardContext'
import { useLeaderboardData } from '@/hooks/leaderboard/useLeaderboardData'
import { useLeaderboardMetrics } from '@/hooks/leaderboard/useLeaderboardMetrics'
import { useUserActivityHistory } from '@/hooks/leaderboard/useUserActivityHistory'
import { getDisplayName } from '@/utils/displayName'
import { StartChallengeModal } from '@/components/modals/StartChallengeModal'
import { ChallengesTab } from '@/components/leaderboard/ChallengesTab'
import { cancelChallenge } from '@/services/challengeService'
import { format } from 'date-fns'

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
  const { isOpen: isFiltersOpen, onToggle: onToggleFilters } = useDisclosure({ defaultIsOpen: false })
  const { isOpen: isLeaveOpen, onOpen: onLeaveOpen, onClose: onLeaveClose } = useDisclosure()
  const supportEmail = 'transform@t4leader.com'
  const pointsColors = useToken('colors', [
    'brand.primary',
    'brand.dark',
    'accent.warning',
    'success.500',
    'warning.500',
    'tint.brandPrimary',
  ])
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>(LeaderboardTimeframe.LAST_7_DAYS)
  const [sortField, setSortField] = useState<'points' | 'name'>('points')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null)
  const [virtualOffset, setVirtualOffset] = useState(0)
  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const [breakdownPage, setBreakdownPage] = useState(1)
  const [featuredBadges, setFeaturedBadges] = useState<FeaturedBadge[]>([])
  const [badgesLoading, setBadgesLoading] = useState(false)
  const [badgesError, setBadgesError] = useState<string | null>(null)
  const [pointsPulse, setPointsPulse] = useState(false)
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false)
  const [villageDetails, setVillageDetails] = useState<VillageSummary | null>(null)
  const [isVillageLoading, setIsVillageLoading] = useState(false)
  const [villageError, setVillageError] = useState<string | null>(null)
  const [isVillageCreator, setIsVillageCreator] = useState(false)
  const [isLeavingVillage, setIsLeavingVillage] = useState(false)
  const [showFilterTip, setShowFilterTip] = useState(() => {
    const stored = localStorage.getItem('leaderboard-filter-tip')
    return stored !== 'dismissed'
  })
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, OrganizationRecord>>({})
  const previousTotalPoints = useRef<number | null>(null)
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

  const context = useLeaderboardContext(profile)
  const contextLabels = useMemo(() => getLeaderboardContextLabels(context), [context])
  const isAdminAll = context?.type === 'admin_all'
  const {
    label: segmentLabel,
    memberLabel: segmentMemberLabel,
    scopeText: segmentScopeText,
    badgeLabel: segmentBadgeLabel,
  } = contextLabels

  const segmentIssue = useMemo(() => {
    if (!profile || !context) return null
    if (context.type === 'free') {
      return 'Join a village to see your peers. Contact support.'
    }
    if (context.type === 'organization' && !context.organizationId && !context.organizationCode) {
      return 'Organization assignment required to view this leaderboard.'
    }
    if (context.type === 'village' && !context.villageId) {
      return 'Please contact support to join a village.'
    }
    if (context.type === 'cluster' && !context.clusterId) {
      return 'Cluster assignment required to view this leaderboard.'
    }
    return null
  }, [context, profile])

  const {
    profiles,
    transactions,
    challenges,
    profilesLoaded,
    transactionsLoaded,
    challengesLoaded,
    errorMessage,
  } = useLeaderboardData({
    context,
    profileId: profile?.id,
  })

  useEffect(() => {
    if (!errorMessage) return
    toast({
      title: 'Unable to load leaderboard data.',
      description: errorMessage,
      status: 'error',
      duration: 6000,
      isClosable: true,
    })
  }, [errorMessage, toast])

  const { activityHistoryByCategory, isLoading: activityHistoryLoading } = useUserActivityHistory(profile?.id)

  const userBreakdown = useMemo(() => {
    const categoryTotals: Record<string, number> = {}
    let totalPoints = 0

    Object.entries(activityHistoryByCategory).forEach(([category, entries]) => {
      const filteredEntries = timeframeStart
        ? entries.filter((e) => e.createdAt >= timeframeStart)
        : entries

      const catTotal = filteredEntries.reduce((sum, e) => sum + e.points, 0)
      if (catTotal > 0) {
        categoryTotals[category] = catTotal
        totalPoints += catTotal
      }
    })

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({
        name,
        value,
        percent: totalPoints > 0 ? Math.round((value / totalPoints) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [activityHistoryByCategory, timeframeStart])

  const toggleCategory = useCallback((categoryName: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName)
      } else {
        newSet.add(categoryName)
      }
      return newSet
    })
  }, [])

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

  const handleChallengeCreated = useCallback(() => {
    toast({
      title: 'Challenge created',
      description: 'Your opponent will receive a notification.',
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }, [toast])

  useEffect(() => {
    void fetchFeaturedBadges()
  }, [fetchFeaturedBadges])

  useEffect(() => {
    if (profiles.length > 0) {
      const orgIds = Array.from(
        new Set(
          profiles
            .map((p) => p.companyId || p.organizationId)
            .filter((id): id is string => Boolean(id))
        )
      )

      if (orgIds.length > 0) {
        fetchOrganizationsByIds(orgIds)
          .then((orgs) => {
            const newMap: Record<string, OrganizationRecord> = {}
            orgs.forEach((org) => {
              if (org.id) newMap[org.id] = org
            })
            setOrganizationsMap((prev) => ({ ...prev, ...newMap }))
          })
          .catch((err) => {
            console.error('🔴 [Leaderboard] Failed to fetch organizations', err)
          })
      }
    }
  }, [profiles])


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

  const handleManualRefresh = async () => {
    setIsRefreshingProfile(true)
    const result = await refreshProfile({ reason: 'leaderboard-manual', isManual: true })
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

  const handleCancelChallenge = async (challengeId: string) => {
    if (!profile?.id) return

    const confirmed = window.confirm(
      'Are you sure you want to cancel this challenge? This cannot be undone.'
    )
    if (!confirmed) return

    const result = await cancelChallenge(challengeId, profile.id)

    if (result.success) {
      toast({
        title: 'Challenge cancelled',
        status: 'success',
        duration: 3000,
      })
    } else {
      toast({
        title: 'Failed to cancel',
        description: result.error,
        status: 'error',
        duration: 5000,
      })
    }
  }

  const {
    leaderboardRows,
    userRow,
    percentile,
    segmentSize,
    peerRows,
    cohortStats,
    segmentStats,
  } = useLeaderboardMetrics({
    context,
    profiles,
    transactions,
    challenges,
    profile,
    timeframe,
    sortField,
    sortDirection,
    timeframeStart,
  })

  const isPointsReady = Boolean(profile) && profilesLoaded && transactionsLoaded
  const displayTotalPoints = userRow?.totalPoints ?? profile?.totalPoints ?? 0
  const weeklyTarget = 200
  const weeklyProgress = Math.min(100, (segmentStats.weeklyPoints / weeklyTarget) * 100)
  const percentileValue = leaderboardRows.length
    ? Math.round(((userRow?.rank ?? leaderboardRows.length) / leaderboardRows.length) * 100)
    : 100
  const aheadPercent = Math.max(0, 100 - percentileValue)
  const profileRouteBase = profile?.role === UserRole.SUPER_ADMIN
    ? '/admin/user'
    : profile?.role === UserRole.PARTNER
      ? '/partner/user'
      : profile?.role === UserRole.MENTOR
        ? '/mentor/user'
        : null

  useEffect(() => {
    if (!profile) return

    if (previousTotalPoints.current === null) {
      previousTotalPoints.current = displayTotalPoints
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

    previousTotalPoints.current = displayTotalPoints
  }, [displayTotalPoints, profile, toast])

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

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(userBreakdown.length / 4))
    if (breakdownPage > maxPage) {
      setBreakdownPage(maxPage)
    }
  }, [userBreakdown.length, breakdownPage])

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

  const handleResetFilters = () => {
    setSortField('points')
    setSortDirection('desc')
    setTimeframe(LeaderboardTimeframe.LAST_7_DAYS)
    setVirtualOffset(0)
    setLeaderboardPage(1)
  }

  const onScrollVirtual = (event: React.UIEvent<HTMLDivElement>) => {
    const offset = Math.floor(event.currentTarget.scrollTop / rowHeight)
    setVirtualOffset(offset)
  }

  const isFreeContext = context?.type === 'free'
  const isVillageContext = context?.type === 'village'
  const shouldShowVillageSection = isFreeContext || isVillageContext
  const villageId = profile?.villageId ?? null

  useEffect(() => {
    let isActive = true

    if (!shouldShowVillageSection || !villageId) {
      setVillageDetails(null)
      setVillageError(null)
      setIsVillageCreator(false)
      setIsVillageLoading(false)
      return () => {
        isActive = false
      }
    }

    const loadVillage = async () => {
      setIsVillageLoading(true)
      setVillageError(null)
      try {
        const village = await fetchVillageById(villageId)
        if (!isActive) return
        if (!village) {
          setVillageDetails(null)
          setIsVillageCreator(false)
          setVillageError('Village not found')
          toast({ title: 'Village not found', status: 'error' })
          return
        }
        setVillageDetails(village)
        setIsVillageCreator(Boolean(profile?.id && village.creatorId === profile.id))
      } catch (error) {
        if (!isActive) return
        console.error('Failed to fetch village details', error)
        setVillageDetails(null)
        setIsVillageCreator(false)
        setVillageError('Unable to load village details')
        toast({ title: 'Unable to load village details', status: 'error' })
      } finally {
        if (isActive) {
          setIsVillageLoading(false)
        }
      }
    }

    void loadVillage()

    return () => {
      isActive = false
    }
  }, [shouldShowVillageSection, profile?.id, toast, villageId])

  const handleLeaveVillage = useCallback(async () => {
    if (!profile?.id || !villageId) return
    setIsLeavingVillage(true)
    try {
      await removeMemberFromVillage({ villageId, userId: profile.id })
      await Promise.all([
        updateDoc(doc(db, 'users', profile.id), { villageId: null, updatedAt: serverTimestamp() }),
        updateDoc(doc(db, 'profiles', profile.id), { villageId: null, updatedAt: serverTimestamp() }),
      ])
      toast({ title: 'You have left the village', status: 'success' })
      onLeaveClose()
      setVillageDetails(null)
      setIsVillageCreator(false)
      await refreshProfile({ reason: 'leave-village', isManual: true })
    } catch (error) {
      console.error('Failed to leave village', error)
      toast({
        title: 'Unable to leave village',
        description: error instanceof Error ? error.message : undefined,
        status: 'error',
      })
    } finally {
      setIsLeavingVillage(false)
    }
  }, [onLeaveClose, profile?.id, refreshProfile, toast, villageId])

  const villageRouteId = villageDetails?.id ?? villageId
  const villageActionDisabled = isVillageLoading || isLeavingVillage
  const shouldShowVillageCard = Boolean(villageDetails && villageId && !villageError)

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
            <Badge colorScheme="purple">Context: {context?.type ?? 'unknown'}</Badge>
            {isAdminAll && (
              <Badge colorScheme="purple">Admin view: All segments</Badge>
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
        </HStack>
      </Flex>

      <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
        <CardBody>
          <Grid templateColumns={{ base: '1fr', lg: '1.2fr 1fr' }} gap={6} alignItems="center">
            <Box>
              <Text fontSize="lg" fontWeight="bold">Choose your next move</Text>
              <Text color="text.secondary">
                Earn points, climb the ranks, and unlock rewards with a focused action today.
              </Text>
            </Box>
            <HStack spacing={3} flexWrap="wrap" justify={{ base: 'flex-start', lg: 'flex-end' }}>
              <Button variant="primary" leftIcon={<Icon as={Target} />} onClick={() => navigate('/app/impact')}>
                Earn points now
              </Button>
              <Button variant="secondary" leftIcon={<Icon as={Trophy} />} onClick={onOpen}>
                Join a challenge
              </Button>
              <Button variant="outline" leftIcon={<Icon as={Users} />} onClick={() => navigate('/app/peer-connect')}>
                Improve rank
              </Button>
            </HStack>
          </Grid>
        </CardBody>
      </Card>

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
              {shouldShowVillageSection && (
                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardBody>
                    {isVillageLoading && villageId ? (
                      <VStack spacing={3} py={6} textAlign="center">
                        <Spinner color="brand.primary" />
                        <Text fontSize="sm" color="text.secondary">
                          Loading your village details...
                        </Text>
                      </VStack>
                    ) : shouldShowVillageCard && villageRouteId ? (
                      <VStack spacing={4} py={4} textAlign="center">
                        <Icon as={isVillageCreator ? Crown : Users} color="brand.primary" boxSize={7} />
                        <Text fontSize="xl" fontWeight="bold" color="text.primary">
                          {isVillageCreator ? 'Village Creator' : 'Village Member'}
                        </Text>
                        <Text color="text.secondary">
                          {isVillageCreator
                            ? 'Manage your village community and invite new members.'
                            : 'View your village community or leave anytime.'}
                        </Text>
                        <Stack
                          direction={{ base: 'column', sm: 'row' }}
                          spacing={3}
                          w="full"
                          justify="center"
                        >
                          <Button
                            variant="primary"
                            leftIcon={<Icon as={Users} />}
                            onClick={() => navigate(`/app/villages/${villageRouteId}/manage`)}
                            isDisabled={villageActionDisabled}
                          >
                            {isVillageCreator ? 'Manage Village' : 'View Village'}
                          </Button>
                          {isVillageCreator ? (
                            <Button
                              variant="secondary"
                              leftIcon={<Icon as={Sparkles} />}
                              onClick={() => navigate(`/app/villages/${villageRouteId}/invite`)}
                              isDisabled={villageActionDisabled}
                            >
                              Invite Members
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              colorScheme="red"
                              onClick={onLeaveOpen}
                              isLoading={isLeavingVillage}
                              isDisabled={villageActionDisabled}
                            >
                              Leave Village
                            </Button>
                          )}
                        </Stack>
                      </VStack>
                    ) : (
                      <VStack spacing={3} py={4} textAlign="center">
                        <Icon as={Sparkles} color="brand.primary" boxSize={7} />
                        <Text fontSize="xl" fontWeight="bold" color="text.primary">
                          Personal leaderboard view
                        </Text>
                        <Text color="text.secondary">
                          Join a village or organization to see peer rankings and community benchmarks.
                        </Text>
                        <Button
                          variant="primary"
                          as="a"
                          href={`mailto:${supportEmail}`}
                        >
                          Contact support to join a village
                        </Button>
                      </VStack>
                    )}
                  </CardBody>
                </Card>
              )}
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
                    <Stack spacing={6}>
                      <Grid templateColumns={{ base: '1fr', md: '1.4fr 1fr' }} gap={4}>
                        <Box
                          p={4}
                          borderRadius="xl"
                          bg="tint.brandPrimary"
                          border="1px solid"
                          borderColor="brand.primary"
                        >
                          <Text fontSize="sm" color="brand.primary" textTransform="uppercase" letterSpacing="wide">
                            Primary Focus
                          </Text>
                          <Text fontSize="lg" fontWeight="bold" color="text.primary">
                            Your Rank Right Now
                          </Text>
                          <HStack spacing={3} mt={2}>
                            <Box fontSize="2xl">{getRankIcon(userRow?.rank || leaderboardRows.length || 1)}</Box>
                            <Text fontSize="4xl" fontWeight="bold" color="text.primary">
                              {userRow?.rank || '—'}
                            </Text>
                          </HStack>
                          <Text color="text.secondary">
                            You’re ahead of {aheadPercent}% of {(segmentLabel ?? 'segment').toLowerCase()} members.
                          </Text>
                          <HStack spacing={2} mt={3} flexWrap="wrap">
                            <Badge colorScheme="primary">{percentile}</Badge>
                            <Badge colorScheme="green">{segmentScopeText}</Badge>
                          </HStack>
                        </Box>
                        <Stack spacing={4}>
                          <Box>
                            <HStack justify="space-between">
                              <Text fontWeight="semibold">Weekly momentum</Text>
                              <Text fontSize="sm" color="text.secondary">
                                Goal {formatNumber(weeklyTarget)}
                              </Text>
                            </HStack>
                            <Progress value={weeklyProgress} colorScheme="green" borderRadius="full" mt={2} />
                            <Text fontSize="xs" color="text.secondary" mt={1}>
                              {segmentStats.weeklyPoints > 0
                                ? `${formatNumber(segmentStats.weeklyPoints)} points earned this week.`
                                : 'Start an activity to earn your first points this week.'}
                            </Text>
                          </Box>
                        </Stack>
                      </Grid>
                      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3}>
                        <Stat>
                          <StatLabel color="text.muted">Total Points</StatLabel>
                          <Skeleton isLoaded={isPointsReady} height="28px">
                            <StatNumber color="text.primary" fontSize="lg" animation={pointsPulseStyle}>
                              {formatNumber(displayTotalPoints)}
                            </StatNumber>
                          </Skeleton>
                          <StatHelpText color="text.secondary">Lifetime XP earned</StatHelpText>
                        </Stat>
                        <Stat>
                          <StatLabel color="text.muted">Monthly Points</StatLabel>
                          <Skeleton isLoaded={isPointsReady} height="28px">
                            <StatNumber color="text.primary" fontSize="lg">
                              {formatNumber(segmentStats.monthlyPoints)}
                            </StatNumber>
                          </Skeleton>
                          <StatHelpText color="text.secondary">Last 30 days</StatHelpText>
                        </Stat>
                        <Stat>
                          <StatLabel color="text.muted">Active & Pending</StatLabel>
                          <StatNumber color="text.primary" fontSize="lg">{segmentStats.activeChallenges}</StatNumber>
                          <StatHelpText color="text.secondary">Live matchups</StatHelpText>
                        </Stat>
                        <Stat>
                          <StatLabel color="text.muted">Badges Earned</StatLabel>
                          <StatNumber color="text.primary" fontSize="lg">{segmentStats.badgesEarned}</StatNumber>
                          <StatHelpText color="text.secondary">Celebrated wins</StatHelpText>
                        </Stat>
                        <Stat>
                          <StatLabel color="text.muted">{segmentMemberLabel}</StatLabel>
                          <StatNumber color="text.primary" fontSize="lg">{segmentSize || 1}</StatNumber>
                          <StatHelpText color="text.secondary">{segmentLabel} size</StatHelpText>
                        </Stat>
                      </SimpleGrid>
                    </Stack>
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
                            {formatNumber(displayTotalPoints)} pts
                          </Text>
                        </Box>
                      </HStack>
                      <SimpleGrid columns={2} spacing={3}>
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
                            <VStack align="start" spacing={2} mt={2}>
                              <HStack spacing={2}>
                                {Array.from({ length: 3 }).map((_, index) => (
                                  <Avatar
                                    key={index}
                                    size="xs"
                                    bg="surface.subtle"
                                    icon={<Icon as={Lock} />}
                                    color="text.muted"
                                    border="1px dashed"
                                    borderColor="border.subtle"
                                  />
                                ))}
                              </HStack>
                            </VStack>
                          )}
                        </Box>
                      </SimpleGrid>
                      <HStack spacing={3} flexWrap="wrap">
                        <Button variant="primary" leftIcon={<Icon as={Sparkles} />} onClick={() => navigate('/app/impact')}>
                          Earn your next badge
                        </Button>
                        <Button variant="secondary" leftIcon={<Icon as={Trophy} />} onClick={() => navigate('/app/badge-gallery')}>
                          View badge roadmap
                        </Button>
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
              </Grid>

              {!isFreeContext && (
                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardHeader>
                    <Flex justify="space-between" align="center">
                      <Box>
                        <Text fontWeight="bold">Filters & Sorting</Text>
                        <Text color="text.secondary">Smart defaults for this week</Text>
                      </Box>
                      <HStack spacing={2}>
                        <Button size="sm" variant="ghost" onClick={handleResetFilters}>
                          Reset defaults
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          rightIcon={<Icon as={isFiltersOpen ? ChevronUp : ChevronDown} />}
                          onClick={onToggleFilters}
                        >
                          {isFiltersOpen ? 'Hide filters' : 'Show filters'}
                        </Button>
                      </HStack>
                    </Flex>
                  </CardHeader>
                  <CardBody>
                    <Collapse in={isFiltersOpen} animateOpacity>
                      <Stack spacing={4}>
                        {showFilterTip && (
                          <Flex p={3} borderRadius="md" bg="tint.brandPrimary" align="center" gap={3}>
                            <Icon as={AlertCircle} color="brand.primary" />
                            <Text fontSize="sm" flex="1">Tip: adjust timeframe and sorting to change your ranking view.</Text>
                            <Button size="xs" onClick={dismissFilterTip}>Got it</Button>
                          </Flex>
                        )}
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
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
                        </SimpleGrid>
                      </Stack>
                    </Collapse>
                  </CardBody>
                </Card>
              )}

              {!isFreeContext && (
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
                              <Th color="text.muted">Badges</Th>
                              <Th color="text.muted">Trend</Th>
                              <Th color="text.muted" isNumeric>Points</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {virtualized.paddingTop > 0 && (
                              <Tr height={`${virtualized.paddingTop}px`}>
                                <Td colSpan={5} p={0} borderBottom="none" />
                              </Tr>
                            )}
                            {virtualized.rows.map((row) => {
                              const rowRoute = profileRouteBase
                                ? `${profileRouteBase}/${row.user.id}`
                                : row.user.id === profile?.id
                                  ? '/app/profile'
                                  : null
                              return (
                                <Tr
                                  key={row.user.id}
                                  bg={row.user.id === profile?.id ? 'tint.brandPrimary' : 'transparent'}
                                  borderLeftWidth={row.rank <= 3 ? '4px' : '0px'}
                                  borderLeftColor={
                                    row.rank === 1
                                      ? 'accent.warning'
                                      : row.rank === 2
                                        ? 'brand.primary'
                                        : row.rank === 3
                                          ? 'success.500'
                                          : 'transparent'
                                  }
                                  cursor={rowRoute ? 'pointer' : 'default'}
                                  onClick={() => {
                                    if (!rowRoute) return
                                    navigate(rowRoute)
                                  }}
                                  _hover={{ bg: row.user.id === profile?.id ? 'tint.brandPrimary' : 'surface.subtle' }}
                                  height={`${rowHeight}px`}
                                >
                                  <Td>{getRankIcon(row.rank)}</Td>
                                  <Td>
                                    <HStack spacing={3}>
                                      <Avatar size="sm" name={getDisplayName(row.user)} src={row.user.avatarUrl} />
                                      <Box>
                                        <Text fontWeight="bold" color="text.primary">{getDisplayName(row.user)}</Text>
                                        <Text fontSize="xs" color="text.secondary">
                                          {organizationsMap[row.user.companyId || row.user.organizationId || '']?.name || row.user.companyName || row.user.companyId || 'Independent'} · {organizationsMap[row.user.companyId || row.user.organizationId || '']?.village || row.user.villageId || 'Village TBD'} · {organizationsMap[row.user.companyId || row.user.organizationId || '']?.cluster || row.user.clusterId || 'Cluster TBD'}
                                        </Text>
                                        <HStack spacing={2} mt={1}>
                                          <Badge colorScheme="success">Active</Badge>
                                          <Badge colorScheme="primary">{row.badgeCount} badges</Badge>
                                        </HStack>
                                      </Box>
                                    </HStack>
                                  </Td>
                                  <Td>
                                    <HStack spacing={1}>
                                      {Array.from({ length: Math.min(row.badgeCount, 4) }).map((_, idx) => (
                                        <Icon key={idx} as={Star} color="accent.warning" boxSize={4} />
                                      ))}
                                    </HStack>
                                  </Td>
                                  <Td>
                                    <HStack spacing={2}>
                                      {row.activePoints >= cohortStats.avgActive ? (
                                        <Icon as={TrendingUp} color="success.500" boxSize={4} />
                                      ) : (
                                        <Icon as={TrendingDown} color="danger.DEFAULT" boxSize={4} />
                                      )}
                                      <Text fontSize="xs" color="text.secondary">
                                        {row.activePoints >= cohortStats.avgActive ? 'Above avg' : 'Below avg'}
                                      </Text>
                                    </HStack>
                                  </Td>
                                  <Td isNumeric>
                                    <Text fontWeight="bold" color="text.primary">{formatNumber(row.activePoints)}</Text>
                                    <Progress
                                      value={(row.activePoints / Math.max(cohortStats.maxActive, 1)) * 100}
                                      size="xs"
                                      colorScheme="purple"
                                      borderRadius="full"
                                      mt={1}
                                    />
                                    <Text fontSize="xs" color="text.secondary">Total {formatNumber(row.totalPoints)}</Text>
                                  </Td>
                                </Tr>
                              )
                            })}
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
              )}

              {!isFreeContext && (
                <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={4}>
                  <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                    <CardHeader>
                      <Text fontWeight="bold">Peer Progress</Text>
                      <Text color="text.secondary">You’re highlighted for quick comparison</Text>
                    </CardHeader>
                    <CardBody>
                      <Table size="sm" color="text.primary">
                        <Thead bg="surface.default">
                          <Tr>
                            <Th color="text.muted">Rank</Th>
                            <Th color="text.muted">Member</Th>
                            <Th color="text.muted">Active Points</Th>
                            <Th color="text.muted">Total</Th>
                            <Th color="text.muted">Gap vs You</Th>
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
                                  <Avatar size="xs" name={getDisplayName(row.user)} src={row.user.avatarUrl} />
                                  <Text>{getDisplayName(row.user)}</Text>
                                </HStack>
                              </Td>
                              <Td>{formatNumber(row.activePoints)}</Td>
                              <Td>{formatNumber(row.totalPoints)}</Td>
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
                      <Text color="text.secondary">You’re ahead of {aheadPercent}% of your cohort</Text>
                    </CardHeader>
                    <CardBody>
                      <Stack spacing={4}>
                        <Box>
                          <HStack justify="space-between" mb={1}>
                            <Text>Total Points</Text>
                            <HStack spacing={2}>
                              <Text fontWeight="semibold">{formatNumber(cohortStats.total)}</Text>
                              <Text color="text.secondary" fontSize="sm">
                                of {formatNumber(cohortStats.maxTotal)} top score
                              </Text>
                            </HStack>
                          </HStack>
                          <Progress
                            value={(cohortStats.total / Math.max(cohortStats.maxTotal, 1)) * 100}
                            colorScheme="primary"
                            borderRadius="full"
                          />
                          <Text color="text.secondary" fontSize="xs" mt={1}>Cohort avg: {formatNumber(cohortStats.avgTotal)}</Text>
                        </Box>
                        <Box>
                          <HStack justify="space-between" mb={1}>
                            <Text>Active Points</Text>
                            <HStack spacing={2}>
                              <Text fontWeight="semibold">{formatNumber(cohortStats.active)}</Text>
                              <Text color="text.secondary" fontSize="sm">
                                of {formatNumber(cohortStats.maxActive)} top score
                              </Text>
                            </HStack>
                          </HStack>
                          <Progress
                            value={(cohortStats.active / Math.max(cohortStats.maxActive, 1)) * 100}
                            colorScheme="secondary"
                            borderRadius="full"
                          />
                          <Text color="text.secondary" fontSize="xs" mt={1}>Cohort avg: {formatNumber(cohortStats.avgActive)}</Text>
                        </Box>
                      </Stack>
                    </CardBody>
                  </Card>
                </Grid>
              )}

              {!isFreeContext && (
                <Card bg="surface.default" border="1px solid" borderColor="border.subtle">
                  <CardHeader>
                    <Flex justify="space-between" align="center">
                      <Box>
                        <Text fontWeight="bold">Your Points Breakdown</Text>
                        <Text color="text.secondary">Personal insights across categories</Text>
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
                            <Pie dataKey="value" data={userBreakdown} innerRadius={60} outerRadius={90} label>
                              {userBreakdown.map((entry, index) => (
                                <Cell key={`cell-${entry.name}`} fill={pointsColors[index % pointsColors.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                      <Stack spacing={3}>
                        {userBreakdown.slice((breakdownPage - 1) * 4, (breakdownPage - 1) * 4 + 4).map((category, idx) => (
                          <Box key={category.name}>
                            <Flex
                              align="center"
                              gap={3}
                              cursor="pointer"
                              onClick={() => toggleCategory(category.name)}
                              _hover={{ bg: 'surface.subtle' }}
                              borderRadius="md"
                              p={1}
                              mx={-1}
                            >
                              <Box w={2} h={12} borderRadius="full" bg={pointsColors[idx % pointsColors.length]} />
                              <Box flex="1">
                                <Flex justify="space-between" align="center">
                                  <HStack>
                                    <Text fontWeight="bold">{category.name}</Text>
                                    <Icon
                                      as={expandedCategories.has(category.name) ? ChevronDown : ChevronRight}
                                      boxSize={4}
                                      color="text.secondary"
                                    />
                                  </HStack>
                                  <Text>{formatNumber(category.value)} pts</Text>
                                </Flex>
                                <Progress value={category.percent} colorScheme="primary" borderRadius="full" />
                                <Text fontSize="xs" color="text.secondary">{category.percent}% of active points</Text>
                              </Box>
                            </Flex>
                            <Collapse in={expandedCategories.has(category.name)} animateOpacity>
                              <Stack pl={6} spacing={2} mt={2} mb={2}>
                                {activityHistoryLoading ? (
                                  <Skeleton height="20px" />
                                ) : activityHistoryByCategory[category.name]?.length ? (
                                  activityHistoryByCategory[category.name].map((activity) => (
                                    <Flex key={activity.id} justify="space-between" align="center" fontSize="sm">
                                      <HStack spacing={2}>
                                        <Icon as={CheckCircle} color="success.500" boxSize={3} />
                                        <Text>{activity.activityTitle}</Text>
                                      </HStack>
                                      <HStack spacing={4}>
                                        <Text color="text.secondary" fontSize="xs">
                                          {format(activity.createdAt, 'MMM d')}
                                        </Text>
                                        <Text fontWeight="medium" color="success.600">+{formatNumber(activity.points)}</Text>
                                      </HStack>
                                    </Flex>
                                  ))
                                ) : (
                                  <Text fontSize="sm" color="text.secondary">No activities in this category yet</Text>
                                )}
                              </Stack>
                            </Collapse>
                          </Box>
                        ))}
                        <Text fontSize="sm" color="text.secondary">Page {breakdownPage} of {Math.max(1, Math.ceil(userBreakdown.length / 4))}</Text>
                      </Stack>
                    </Grid>
                  </CardBody>
                </Card>
              )}

            </Stack>
          </TabPanel>

          <TabPanel px={0}>
            <ChallengesTab
              challenges={challenges}
              challengesLoaded={challengesLoaded}
              onStartChallenge={onOpen}
              onCancelChallenge={handleCancelChallenge}
              leaderboardRank={userRow?.rank}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>

      {shouldShowVillageSection && (
        <Modal isOpen={isLeaveOpen} onClose={onLeaveClose} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Leave village</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text fontWeight="semibold" mb={2}>
                Are you sure you want to leave this village?
              </Text>
              <Text color="text.secondary">
                You will need an invitation to rejoin.
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onLeaveClose} isDisabled={isLeavingVillage}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleLeaveVillage} isLoading={isLeavingVillage}>
                Leave Village
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      <StartChallengeModal
        isOpen={isOpen}
        onClose={onClose}
        onChallengeCreated={handleChallengeCreated}
      />
    </Stack>
  )
}
