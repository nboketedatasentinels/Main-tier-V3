import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  Spinner,
  Progress,
  Select,
  SimpleGrid,
  Stack,
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
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Crown,
  Medal,
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
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts'
import { Badge as BadgeDefinition, LeaderboardTimeframe, UserProfile, UserRole } from '@/types'
import { OrganizationRecord } from '@/types/admin'
import { db } from '@/services/firebase'
import { fetchOrganizationsByIds } from '@/services/organizationService'
import {
  fetchVillageById,
  fetchVillagesByIds,
  removeMemberFromVillage,
  VillageSummary,
} from '@/services/villageService'
import { useAuth } from '@/hooks/useAuth'
import { useLeaderboardContext, getLeaderboardContextLabels } from '@/hooks/leaderboard/useLeaderboardContext'
import { useLeaderboardData } from '@/hooks/leaderboard/useLeaderboardData'
import { useLeaderboardMetrics } from '@/hooks/leaderboard/useLeaderboardMetrics'
import { useUserActivityHistory } from '@/hooks/leaderboard/useUserActivityHistory'
import { getDisplayName } from '@/utils/displayName'
import { StartChallengeModal } from '@/components/modals/StartChallengeModal'
import { ChallengesTab } from '@/components/leaderboard/ChallengesTab'
import { cancelChallenge } from '@/services/challengeService'
import { isFreeUser } from '@/utils/membership'
import { UpgradePromptModal } from '@/components/UpgradePromptModal'
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
  const location = useLocation()
  const { profile: authProfile, refreshProfile } = useAuth()
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isUpgradeOpen,
    onOpen: onUpgradeOpen,
    onClose: onUpgradeClose,
  } = useDisclosure()
  const { isOpen: isFiltersOpen, onToggle: onToggleFilters } = useDisclosure({ defaultIsOpen: false })
  const { isOpen: isLeaveOpen, onOpen: onLeaveOpen, onClose: onLeaveClose } = useDisclosure()
  const supportEmail = 'transform@t4leader.com'
  const pointsColors = useToken('colors', [
    'brand.primary',
    'brand.dark',
    'danger.DEFAULT',
    'success.500',
    'purple.400',
    'tint.brandPrimary',
  ])
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>(LeaderboardTimeframe.LAST_7_DAYS)
  const [sortField, setSortField] = useState<'points' | 'name'>('points')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null)
  const [upgradeFeatureName, setUpgradeFeatureName] = useState('Premium Feature')
  const [upgradeBenefits, setUpgradeBenefits] = useState<string[]>([])
  const [virtualOffset, setVirtualOffset] = useState(0)
  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const [breakdownPage, setBreakdownPage] = useState(1)
  const [, setFeaturedBadges] = useState<FeaturedBadge[]>([])
  const [, setBadgesLoading] = useState(false)
  const [, setBadgesError] = useState<string | null>(null)
  const [pointsPulse, setPointsPulse] = useState(false)
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
  const [villageNames, setVillageNames] = useState<Record<string, string>>({})
  const villageNamesRef = useRef<Record<string, string>>({})
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
  const isFreeTierUser = useMemo(() => (profile ? isFreeUser(profile) : false), [profile])

  const promptPeerConnectUpgrade = useCallback(() => {
    setUpgradeFeatureName('Peer Connect')
    setUpgradeBenefits([
      'Access one-on-one peer matching',
      'Join guided peer accountability sessions',
      'Track weekly collaboration momentum',
      'Unlock premium networking workflows',
    ])
    onUpgradeOpen()
  }, [onUpgradeOpen])

  const context = useLeaderboardContext(profile)
  const contextLabels = useMemo(() => getLeaderboardContextLabels(context), [context])
  const supportsSegmentTimeframes = !context
    || context.type === 'organization'
    || context.type === 'village'
    || context.type === 'cluster'
    || context.type === 'admin_all'
  const availableTimeframes = supportsSegmentTimeframes
    ? timeframeOptions
    : timeframeOptions.filter((option) => option.value === LeaderboardTimeframe.ALL_TIME)
  const {
    label: segmentLabel,
    memberLabel: segmentMemberLabel,
    scopeText: segmentScopeText,
  } = contextLabels

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
    if (supportsSegmentTimeframes) return
    if (timeframe !== LeaderboardTimeframe.ALL_TIME) {
      setTimeframe(LeaderboardTimeframe.ALL_TIME)
    }
  }, [supportsSegmentTimeframes, timeframe])

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

  const activityHistoryByTitle = useMemo(() => {
    const map: Record<string, typeof activityHistoryByCategory[string]> = {}
    Object.values(activityHistoryByCategory).forEach((entries) => {
      entries.forEach((entry) => {
        const title = entry.activityTitle || 'Activity'
        if (!map[title]) map[title] = []
        map[title].push(entry)
      })
    })
    return map
  }, [activityHistoryByCategory])

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
    if (!profiles.length) return

    const villageIds = Array.from(
      new Set(
        profiles
          .map((p) => p.villageId)
          .filter((id): id is string => Boolean(id)),
      ),
    )

    const missingVillageIds = villageIds.filter((id) => !villageNamesRef.current[id])
    if (!missingVillageIds.length) return

    fetchVillagesByIds(missingVillageIds)
      .then((villages) => {
        if (!villages.length) return
        setVillageNames((prev) => {
          const merged = { ...prev }
          villages.forEach((village) => {
            merged[village.id] = village.name
          })
          villageNamesRef.current = merged
          return merged
        })
      })
      .catch((err) => {
        console.error('🔍 [Leaderboard] Failed to fetch villages', err)
      })
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
    if (profile && (profile.privacySettings?.showOnLeaderboard === false || profile.leaderboardVisibility === 'private')) {
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

  const userBreakdown = useMemo(() => {
    const activityTotals = new Map<string, { points: number; category: string }>()
    let totalPoints = 0

    Object.entries(activityHistoryByCategory).forEach(([category, entries]) => {
      const filteredEntries = timeframeStart
        ? entries.filter((e) => e.createdAt >= timeframeStart)
        : entries

      filteredEntries.forEach((entry) => {
        if (entry.points <= 0) return
        const title = entry.activityTitle || 'Activity'
        const existing = activityTotals.get(title)
        if (existing) {
          existing.points += entry.points
        } else {
          activityTotals.set(title, { points: entry.points, category })
        }
        totalPoints += entry.points
      })
    })

    if (!timeframeStart && displayTotalPoints > totalPoints) {
      const unaccounted = displayTotalPoints - totalPoints
      activityTotals.set('Other activities', {
        points: unaccounted,
        category: 'Uncategorized',
      })
      totalPoints = displayTotalPoints
    }

    return Array.from(activityTotals.entries())
      .map(([name, data]) => ({
        name,
        value: data.points,
        category: data.category,
        percent: totalPoints > 0 ? Math.round((data.points / totalPoints) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [activityHistoryByCategory, timeframeStart, displayTotalPoints])

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

  useEffect(() => {
    if (location.hash !== '#points-breakdown') return

    const scrollToBreakdown = () => {
      const target = document.getElementById('points-breakdown')
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const timeoutId = window.setTimeout(scrollToBreakdown, 0)
    return () => window.clearTimeout(timeoutId)
  }, [location.hash, userBreakdown.length])

  const getRankIcon = (rank: number) => {
    if (rank === 1) {
      return (
        <Flex
          w={10}
          h={10}
          align="center"
          justify="center"
          borderRadius="full"
          bg="tint.accentWarning"
          border="2px solid"
          borderColor="brand.primary"
        >
          <Icon as={Crown} boxSize={5} color="brand.primary" />
        </Flex>
      )
    }
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
    <Stack spacing={8}>
      {/* Hero Section */}
      <Box
        position="relative"
        overflow="hidden"
        borderRadius="2xl"
        bgGradient="linear(to-r, #350e6f, #8b5a3c)"
        p={{ base: 6, md: 10 }}
        color="white"
        boxShadow="0 10px 40px rgba(53, 14, 111, 0.3)"
      >
        {/* Decorative elements */}
        <Box
          position="absolute"
          top="-50%"
          right="-10%"
          w="400px"
          h="400px"
          borderRadius="full"
          bg="linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%)"
          filter="blur(60px)"
          pointerEvents="none"
        />
        <Box
          position="absolute"
          bottom="-30%"
          left="-5%"
          w="300px"
          h="300px"
          borderRadius="full"
          bg="linear-gradient(135deg, rgba(139, 90, 60, 0.3) 0%, rgba(53, 14, 111, 0.1) 100%)"
          filter="blur(50px)"
          pointerEvents="none"
        />

        <Flex justify="space-between" align="center" flexWrap="wrap" gap={6} position="relative">
          <Box flex="1" minW="300px">
            <HStack spacing={3} mb={4}>
              <Flex
                w={10}
                h={10}
                bg="whiteAlpha.200"
                backdropFilter="blur(10px)"
                borderRadius="lg"
                align="center"
                justify="center"
                border="1px solid"
                borderColor="whiteAlpha.300"
              >
                <Icon as={Trophy} boxSize={5} color="white" />
              </Flex>
              <Badge
                bg="whiteAlpha.200"
                color="white"
                px={3}
                py={1}
                borderRadius="full"
                fontSize="xs"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wide"
                backdropFilter="blur(10px)"
              >
                Leadership Board
              </Badge>
            </HStack>
            <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" lineHeight="1.2" mb={2} color="white">
              Compete. Rise. Lead.
            </Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} color="whiteAlpha.800" maxW="450px">
              Track your progress, challenge your peers, and climb the ranks to become a transformation leader.
            </Text>
          </Box>

          {/* Action Buttons - Right Side */}
          <VStack spacing={3} align="stretch">
            <HStack spacing={3}>
              <Button
                size="md"
                bg="whiteAlpha.200"
                color="white"
                leftIcon={<Icon as={Target} boxSize={4} />}
                onClick={() => navigate('/app/weekly-checklist')}
                _hover={{ bg: 'whiteAlpha.300' }}
                transition="all 0.2s"
                fontWeight="medium"
                px={6}
                borderRadius="lg"
                backdropFilter="blur(8px)"
                border="1px solid"
                borderColor="whiteAlpha.300"
              >
                Earn Points
              </Button>
              <Button
                size="md"
                bg="whiteAlpha.200"
                color="white"
                leftIcon={<Icon as={Trophy} boxSize={4} />}
                onClick={onOpen}
                _hover={{ bg: 'whiteAlpha.300' }}
                transition="all 0.2s"
                fontWeight="medium"
                px={6}
                borderRadius="lg"
                backdropFilter="blur(8px)"
                border="1px solid"
                borderColor="whiteAlpha.300"
              >
                Start Challenge
              </Button>
            </HStack>
            <HStack spacing={3} w="full">
              <Tooltip
                label="Upgrade to unlock peer matching and collaboration sessions."
                hasArrow
                openDelay={200}
                isDisabled={!isFreeTierUser}
              >
                <Button
                  size="md"
                  bg="whiteAlpha.200"
                  color="white"
                  leftIcon={<Icon as={Users} boxSize={4} />}
                  onClick={isFreeTierUser ? promptPeerConnectUpgrade : () => navigate('/app/peer-connect')}
                  opacity={isFreeTierUser ? 0.7 : 1}
                  _hover={{ bg: 'whiteAlpha.300' }}
                  transition="all 0.2s"
                  fontWeight="medium"
                  px={6}
                  borderRadius="lg"
                  backdropFilter="blur(8px)"
                  border="1px solid"
                  borderColor="whiteAlpha.300"
                  justifyContent="flex-start"
                  flex={1}
                >
                  Peer Connect
                </Button>
              </Tooltip>
              <Button
                size="md"
                bg="whiteAlpha.200"
                color="white"
                leftIcon={<Icon as={TrendingUp} boxSize={4} />}
                onClick={() => navigate('/app/impact')}
                _hover={{ bg: 'whiteAlpha.300' }}
                transition="all 0.2s"
                fontWeight="medium"
                px={6}
                borderRadius="lg"
                backdropFilter="blur(8px)"
                border="1px solid"
                borderColor="whiteAlpha.300"
                justifyContent="flex-start"
                flex={1}
              >
                Log Impact
              </Button>
            </HStack>
          </VStack>
        </Flex>
      </Box>

      <Tabs variant="unstyled" colorScheme="primary">
        <TabList
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="2xl"
          p={1.5}
          gap={2}
          boxShadow="sm"
        >
          <Tab
            _selected={{
              bg: '#350e6f',
              color: 'white',
              boxShadow: '0 4px 12px rgba(53, 14, 111, 0.3)',
            }}
            color="gray.600"
            borderRadius="xl"
            px={6}
            py={3}
            fontWeight="600"
            transition="all 0.2s"
            sx={{ '&[aria-selected=true] *': { color: 'white' } }}
          >
            <HStack spacing={2}>
              <Icon as={Medal} boxSize={4} />
              <Text>Leaderboard</Text>
            </HStack>
          </Tab>
          <Tab
            _selected={{
              bg: '#350e6f',
              color: 'white',
              boxShadow: '0 4px 12px rgba(53, 14, 111, 0.3)',
            }}
            color="gray.600"
            borderRadius="xl"
            px={6}
            py={3}
            fontWeight="600"
            transition="all 0.2s"
            sx={{ '&[aria-selected=true] *': { color: 'white' } }}
          >
            <HStack spacing={2}>
              <Icon as={Trophy} boxSize={4} />
              <Text>Challenges</Text>
            </HStack>
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <Stack spacing={6}>
              {shouldShowVillageSection && (
                <Card bg="white" border="1px solid" borderColor="gray.100" boxShadow="sm" borderRadius="xl">
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
                            ? 'Manage your village ecosystem and invite new members.'
                            : 'View your village ecosystem or leave anytime.'}
                        </Text>
                        <Stack
                          direction={{ base: 'column', sm: 'row' }}
                          spacing={3}
                          w="full"
                          justify="center"
                        >
                          <Button
                            bg="#350e6f"
                            color="white"
                            _hover={{ bg: '#4a1499' }}
                            leftIcon={<Icon as={Users} />}
                            onClick={() => navigate(`/app/villages/${villageRouteId}/manage`)}
                            isDisabled={villageActionDisabled}
                          >
                            {isVillageCreator ? 'Manage Village' : 'View Village'}
                          </Button>
                          {isVillageCreator ? (
                            <Button
                              bg="#350e6f"
                              color="white"
                              _hover={{ bg: '#4a1499' }}
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
                          Join a village or organization to see peer rankings and ecosystem benchmarks.
                        </Text>
                        <Button
                          bg="#350e6f"
                          color="white"
                          _hover={{ bg: '#4a1499' }}
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
              <Grid templateColumns="1fr" gap={4}>
                <Card bg="white" border="1px solid" borderColor="gray.100" boxShadow="sm" borderRadius="xl">
                  <CardHeader borderBottom="1px solid" borderColor="gray.100">
                    <HStack justify="space-between" align="center">
                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4} flex={1}>
                        <Box>
                          <Text fontSize="lg" fontWeight="bold" color="gray.800">Progress Overview</Text>
                          <Text color="gray.500" fontSize="sm">Live updates</Text>
                        </Box>
                        <Box pl={10}>
                          <Text fontSize="lg" fontWeight="bold" color="gray.800">Your Points Breakdown</Text>
                          <Text color="gray.500" fontSize="sm">Points earned per activity</Text>
                        </Box>
                      </Grid>
                      <HStack spacing={3} ml={4}>
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
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    <Stack spacing={6}>
                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                        <Box
                          p={5}
                          bg="white"
                          borderRadius="xl"
                          border="1px solid"
                          borderColor="purple.200"
                          boxShadow="0 2px 8px rgba(0,0,0,0.04)"
                          _hover={{ transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(139, 92, 246, 0.15)', borderColor: 'purple.300' }}
                          transition="all 0.3s ease"
                          position="relative"
                          overflow="hidden"
                        >
                          <Box position="absolute" top={0} right={0} w="90px" h="90px" bg="purple.50" borderRadius="0 0 0 100%" />
                          <Flex w={10} h={10} bg="#350e6f" borderRadius="xl" align="center" justify="center" mb={3} boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)">
                            <Icon as={Trophy} boxSize={5} color="white" />
                          </Flex>
                          <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase" letterSpacing="wide" mb={1}>
                            Primary Focus
                          </Text>
                          <Text fontSize="lg" fontWeight="bold" color="gray.800" mb={3}>
                            Your Rank Right Now
                          </Text>
                          <HStack spacing={3}>
                            <Box fontSize="2xl">{getRankIcon(userRow?.rank || leaderboardRows.length || 1)}</Box>
                            <Text fontSize="4xl" fontWeight="bold" color="gray.800">
                              {userRow?.rank || '—'}
                            </Text>
                          </HStack>
                          <Text color="gray.600" mt={2} fontSize="sm">
                            You're ahead of {aheadPercent}% of {(segmentLabel ?? 'segment').toLowerCase()} members.
                          </Text>
                          <HStack spacing={2} mt={3} flexWrap="wrap">
                            <Badge bg="purple.100" color="purple.700" borderRadius="full">{percentile}</Badge>
                            <Badge bg="gray.100" color="gray.600" borderRadius="full">{segmentScopeText}</Badge>
                          </HStack>
                        </Box>
                        <Box id="points-breakdown" scrollMarginTop="120px">
                          <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4} alignItems="center">
                            <Box h="260px">
                              {activityHistoryLoading ? (
                                <Flex h="full" align="center" justify="center">
                                  <Spinner size="lg" color="#350e6f" thickness="3px" />
                                </Flex>
                              ) : userBreakdown.length === 0 ? (
                                <Flex h="full" direction="column" align="center" justify="center" gap={3} px={4}>
                                  <Flex
                                    w={16}
                                    h={16}
                                    borderRadius="full"
                                    bg="purple.50"
                                    align="center"
                                    justify="center"
                                    border="2px dashed"
                                    borderColor="purple.200"
                                  >
                                    <Icon as={Target} boxSize={7} color="#350e6f" />
                                  </Flex>
                                  <Text fontSize="sm" fontWeight="semibold" color="gray.700" textAlign="center">
                                    No points yet
                                  </Text>
                                  <Text fontSize="xs" color="gray.500" textAlign="center" maxW="220px">
                                    Complete activities or log impact to see your points breakdown here.
                                  </Text>
                                </Flex>
                              ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie dataKey="value" data={userBreakdown} innerRadius={60} outerRadius={90} label>
                                      {userBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${entry.name}`} fill={pointsColors[index % pointsColors.length]} />
                                      ))}
                                    </Pie>
                                    <RechartsTooltip
                                      content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null
                                        const name = payload[0].name as string
                                        const value = payload[0].value as number
                                        const entries = activityHistoryByTitle[name] || []
                                        return (
                                          <Box bg="white" color="gray.800" p={3} borderRadius="md" fontSize="xs" maxW="260px" boxShadow="lg" border="1px solid" borderColor="gray.100">
                                            <Text fontWeight="bold" mb={2} color="gray.800">{name} — {formatNumber(value)} pts</Text>
                                            {activityHistoryLoading ? (
                                              <Text color="gray.500">Loading...</Text>
                                            ) : entries.length ? (
                                              <Stack spacing={2}>
                                                {entries.map((activity) => (
                                                  <Flex key={activity.id} justify="space-between" align="center" gap={4}>
                                                    <HStack spacing={2}>
                                                      <Icon as={CheckCircle} color="green.500" boxSize={3} />
                                                      <Text color="gray.800">{format(activity.createdAt, 'MMM d')}</Text>
                                                    </HStack>
                                                    <Text color="green.500" fontWeight="medium">+{formatNumber(activity.points)}</Text>
                                                  </Flex>
                                                ))}
                                              </Stack>
                                            ) : (
                                              <Text color="gray.500">No activity details</Text>
                                            )}
                                          </Box>
                                        )
                                      }}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              )}
                            </Box>
                            <Stack spacing={3}>
                              {activityHistoryLoading ? (
                                <Stack spacing={3}>
                                  <Skeleton height="48px" borderRadius="md" />
                                  <Skeleton height="48px" borderRadius="md" />
                                  <Skeleton height="48px" borderRadius="md" />
                                </Stack>
                              ) : userBreakdown.length === 0 ? (
                                <Box py={6} textAlign="center">
                                  <Text fontSize="sm" color="gray.500">
                                    Each activity you complete will appear here with its earned points.
                                  </Text>
                                </Box>
                              ) : (
                                <>
                              {userBreakdown.slice((breakdownPage - 1) * 4, (breakdownPage - 1) * 4 + 4).map((activity, idx) => {
                                const entries = activityHistoryByTitle[activity.name] || []
                                return (
                                <Box key={activity.name}>
                                  <Tooltip
                                    hasArrow
                                    placement="top"
                                    borderRadius="md"
                                    bg="white"
                                    p={3}
                                    label={
                                      activityHistoryLoading ? (
                                        <Text fontSize="xs">Loading...</Text>
                                      ) : entries.length ? (
                                        <Stack spacing={2}>
                                          {entries.map((entry) => (
                                            <Flex key={entry.id} justify="space-between" align="center" gap={4} fontSize="xs">
                                              <HStack spacing={2}>
                                                <Icon as={CheckCircle} color="green.500" boxSize={3} />
                                                <Text color="gray.800">{format(entry.createdAt, 'MMM d, yyyy')}</Text>
                                              </HStack>
                                              <Text color="green.500" fontWeight="medium">+{formatNumber(entry.points)}</Text>
                                            </Flex>
                                          ))}
                                        </Stack>
                                      ) : (
                                        <Text fontSize="xs">No detail available</Text>
                                      )
                                    }
                                  >
                                  <Flex
                                    align="center"
                                    gap={3}
                                    cursor="pointer"
                                    onClick={() => toggleCategory(activity.name)}
                                    _hover={{ bg: 'surface.subtle' }}
                                    borderRadius="md"
                                    p={1}
                                    mx={-1}
                                  >
                                    <Box w={2} h={12} borderRadius="full" bg={pointsColors[idx % pointsColors.length]} />
                                    <Box flex="1">
                                      <Flex justify="space-between" align="center">
                                        <HStack>
                                          <Text fontWeight="bold" noOfLines={1}>{activity.name}</Text>
                                          <Icon
                                            as={expandedCategories.has(activity.name) ? ChevronDown : ChevronRight}
                                            boxSize={4}
                                            color="text.secondary"
                                          />
                                        </HStack>
                                        <Text>{formatNumber(activity.value)} pts</Text>
                                      </Flex>
                                      <Progress value={activity.percent} colorScheme="primary" borderRadius="full" />
                                      <Text fontSize="xs" color="text.secondary">{activity.percent}% of active points · {activity.category}</Text>
                                    </Box>
                                  </Flex>
                                  </Tooltip>
                                  <Collapse in={expandedCategories.has(activity.name)} animateOpacity>
                                    <Stack pl={6} spacing={2} mt={2} mb={2}>
                                      {activityHistoryLoading ? (
                                        <Skeleton height="20px" />
                                      ) : entries.length ? (
                                        entries.map((entry) => (
                                          <Flex key={entry.id} justify="space-between" align="center" fontSize="sm">
                                            <HStack spacing={2}>
                                              <Icon as={CheckCircle} color="success.500" boxSize={3} />
                                              <Text color="text.secondary" fontSize="xs">
                                                {format(entry.createdAt, 'MMM d, yyyy')}
                                              </Text>
                                            </HStack>
                                            <Text fontWeight="medium" color="success.600">+{formatNumber(entry.points)}</Text>
                                          </Flex>
                                        ))
                                      ) : (
                                        <Text fontSize="sm" color="text.secondary">No detail available</Text>
                                      )}
                                    </Stack>
                                  </Collapse>
                                </Box>
                                )
                              })}
                              <Text fontSize="sm" color="text.secondary">Page {breakdownPage} of {Math.max(1, Math.ceil(userBreakdown.length / 4))}</Text>
                                </>
                              )}
                            </Stack>
                          </Grid>
                        </Box>
                      </Grid>
                      <SimpleGrid columns={{ base: 2, md: 2, lg: 4 }} spacing={4}>
                        <Box
                          p={5}
                          bg="white"
                          borderRadius="xl"
                          border="1px solid"
                          borderColor="gray.100"
                          boxShadow="0 2px 8px rgba(0,0,0,0.04)"
                          _hover={{ transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(139, 92, 246, 0.15)', borderColor: 'purple.200' }}
                          transition="all 0.3s ease"
                          position="relative"
                          overflow="hidden"
                        >
                          <Box position="absolute" top={0} right={0} w="60px" h="60px" bg="purple.50" borderRadius="0 0 0 100%" />
                          <Flex w={10} h={10} bg="#350e6f" borderRadius="xl" align="center" justify="center" mb={3} boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)">
                            <Icon as={Star} boxSize={5} color="white" />
                          </Flex>
                          <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase" letterSpacing="wide" mb={1}>Total Points</Text>
                          <Skeleton isLoaded={isPointsReady} height="32px">
                            <Text fontWeight="bold" fontSize="2xl" color="gray.800" animation={pointsPulseStyle}>
                              {formatNumber(displayTotalPoints)}
                            </Text>
                          </Skeleton>
                        </Box>
                        <Box
                          p={5}
                          bg="white"
                          borderRadius="xl"
                          border="1px solid"
                          borderColor="gray.100"
                          boxShadow="0 2px 8px rgba(0,0,0,0.04)"
                          _hover={{ transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)', borderColor: 'green.200' }}
                          transition="all 0.3s ease"
                          position="relative"
                          overflow="hidden"
                        >
                          <Box position="absolute" top={0} right={0} w="60px" h="60px" bg="green.50" borderRadius="0 0 0 100%" />
                          <Flex w={10} h={10} bg="linear-gradient(135deg, #047857 0%, #065f46 100%)" borderRadius="xl" align="center" justify="center" mb={3} boxShadow="0 4px 12px rgba(4, 120, 87, 0.3)">
                            <Icon as={TrendingUp} boxSize={5} color="white" />
                          </Flex>
                          <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase" letterSpacing="wide" mb={1}>This Month</Text>
                          <Skeleton isLoaded={isPointsReady} height="32px">
                            <Text fontWeight="bold" fontSize="2xl" color="gray.800">
                              {formatNumber(segmentStats.monthlyPoints)}
                            </Text>
                          </Skeleton>
                        </Box>
                        <Box
                          p={5}
                          bg="white"
                          borderRadius="xl"
                          border="1px solid"
                          borderColor="gray.100"
                          boxShadow="0 2px 8px rgba(0,0,0,0.04)"
                          _hover={{ transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(249, 115, 22, 0.15)', borderColor: 'orange.200' }}
                          transition="all 0.3s ease"
                          position="relative"
                          overflow="hidden"
                        >
                          <Box position="absolute" top={0} right={0} w="60px" h="60px" bg="orange.50" borderRadius="0 0 0 100%" />
                          <Flex w={10} h={10} bg="linear-gradient(135deg, #f97316 0%, #ea580c 100%)" borderRadius="xl" align="center" justify="center" mb={3} boxShadow="0 4px 12px rgba(249, 115, 22, 0.3)">
                            <Icon as={Target} boxSize={5} color="white" />
                          </Flex>
                          <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase" letterSpacing="wide" mb={1}>Challenges</Text>
                          <Text fontWeight="bold" fontSize="2xl" color="gray.800">{segmentStats.activeChallenges}</Text>
                        </Box>
                        <Box
                          p={5}
                          bg="white"
                          borderRadius="xl"
                          border="1px solid"
                          borderColor="gray.100"
                          boxShadow="0 2px 8px rgba(0,0,0,0.04)"
                          _hover={{ transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(59, 130, 246, 0.15)', borderColor: 'blue.200' }}
                          transition="all 0.3s ease"
                          position="relative"
                          overflow="hidden"
                        >
                          <Box position="absolute" top={0} right={0} w="60px" h="60px" bg="blue.50" borderRadius="0 0 0 100%" />
                          <Flex w={10} h={10} bg="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" borderRadius="xl" align="center" justify="center" mb={3} boxShadow="0 4px 12px rgba(59, 130, 246, 0.3)">
                            <Icon as={Users} boxSize={5} color="white" />
                          </Flex>
                          <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase" letterSpacing="wide" mb={1}>{segmentMemberLabel}</Text>
                          <Text fontWeight="bold" fontSize="2xl" color="gray.800">{segmentSize || 1}</Text>
                        </Box>
                      </SimpleGrid>
                    </Stack>
                  </CardBody>
                </Card>

              </Grid>

              {!isFreeContext && (
                <Card bg="white" border="1px solid" borderColor="gray.100" boxShadow="sm" borderRadius="xl">
                  <CardHeader>
                    <Flex justify="space-between" align="center">
                      <Box>
                        <Text fontWeight="bold" fontSize="lg" color="gray.800">Filters & Sorting</Text>
                        <Text color="gray.500" fontSize="sm">Customize your view</Text>
                      </Box>
                      <HStack spacing={2}>
                        <Button size="sm" variant="ghost" colorScheme="purple" onClick={handleResetFilters}>
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          bg="#350e6f"
                          color="white"
                          _hover={{ bg: '#4a1499' }}
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
                            <Button size="xs" bg="#350e6f" color="white" _hover={{ bg: '#4a1499' }} onClick={dismissFilterTip}>Got it</Button>
                          </Flex>
                        )}
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                          <Box>
                            <Text fontSize="sm" mb={1}>Timeframe</Text>
                            <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value as LeaderboardTimeframe)}>
                              {availableTimeframes.map((option) => (
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
                <Card bg="white" border="1px solid" borderColor="gray.100" boxShadow="sm" borderRadius="xl" overflow="hidden">
                  <CardHeader bg="linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)" borderBottom="1px solid" borderColor="gray.100">
                    <Flex justify="space-between" align="center">
                      <Box>
                        <HStack spacing={3}>
                          <Flex w={10} h={10} bg="#350e6f" borderRadius="xl" align="center" justify="center" boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)">
                            <Icon as={Crown} boxSize={5} color="white" />
                          </Flex>
                          <Box>
                            <Text fontWeight="bold" fontSize="lg" color="gray.800">{segmentLabel} Leaderboard</Text>
                            <Text color="gray.500" fontSize="sm">Live rankings with real-time updates</Text>
                          </Box>
                        </HStack>
                      </Box>
                      <HStack spacing={2}>
                        <Badge bg="green.50" color="green.600" px={3} py={1} borderRadius="full" fontSize="xs" fontWeight="semibold">
                          <HStack spacing={1}>
                            <Box w={2} h={2} bg="green.500" borderRadius="full" />
                            <Text>Live</Text>
                          </HStack>
                        </Badge>
                      </HStack>
                    </Flex>
                  </CardHeader>
                  <CardBody p={0}>
                    <Box
                      maxH="500px"
                      overflowY="auto"
                      onScroll={leaderboardRows.length > virtualizationThreshold ? onScrollVirtual : undefined}
                    >
                      <Table variant="simple" size="md">
                        <Thead position="sticky" top={0} bg="gray.50" zIndex={1}>
                          <Tr>
                            <Th color="gray.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" py={4}>Rank</Th>
                            <Th color="gray.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" py={4}>Member</Th>
                            <Th color="gray.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" py={4}>Gap vs You</Th>
                            <Th color="gray.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" py={4}>Vs Avg</Th>
                            <Th color="gray.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" py={4} isNumeric>Points</Th>
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
                            const organizationKey = row.user.companyId || row.user.organizationId || ''
                            const organizationRecord = organizationsMap[organizationKey]
                            const organizationLabel =
                              organizationRecord?.name || row.user.companyName || row.user.companyId || 'Independent'
                            const villageLabel =
                              villageNames[row.user.villageId ?? ''] ||
                              organizationRecord?.village ||
                              row.user.villageId ||
                              'Village not assigned'
                            const clusterLabel =
                              organizationRecord?.cluster || row.user.clusterId || 'Cluster not assigned'
                            const isTopThree = row.rank <= 3
                            const isCurrentUser = row.user.id === profile?.id
                            return (
                              <Tr
                                key={row.user.id}
                                bg={isCurrentUser ? 'purple.50' : 'white'}
                                borderLeft={isTopThree ? '4px solid' : 'none'}
                                borderLeftColor={
                                  row.rank === 1 ? '#fbbf24'
                                    : row.rank === 2 ? '#9ca3af'
                                    : row.rank === 3 ? '#cd7c2e'
                                    : 'transparent'
                                }
                                cursor={rowRoute ? 'pointer' : 'default'}
                                transition="all 0.2s"
                                _hover={{ bg: isCurrentUser ? 'purple.100' : 'gray.50' }}
                                onClick={() => {
                                  if (!rowRoute) return
                                  navigate(rowRoute)
                                }}
                                height={`${rowHeight}px`}
                              >
                                  <Td>{getRankIcon(row.rank)}</Td>
                                  <Td>
                                    <HStack spacing={3}>
                                      <Avatar size="sm" name={getDisplayName(row.user)} src={row.user.avatarUrl} />
                                      <Box>
                                        <Text fontWeight="bold" color="text.primary">{getDisplayName(row.user)}</Text>
                                        <Text fontSize="xs" color="text.secondary">
                                          {organizationLabel} · {villageLabel} · {clusterLabel}
                                        </Text>
                                        <HStack spacing={2} mt={1}>
                                          <Badge colorScheme="success">Active</Badge>
                                          <Badge colorScheme="primary">{row.badgeCount} badges</Badge>
                                        </HStack>
                                      </Box>
                                    </HStack>
                                  </Td>
                                  <Td>
                                    {(() => {
                                      const myPoints = userRow?.totalPoints ?? 0
                                      const gap = row.totalPoints - myPoints
                                      const isCurrentUserRow = isCurrentUser
                                      return (
                                        <Text
                                          fontWeight="bold"
                                          color={isCurrentUserRow ? 'green.500' : 'orange.500'}
                                        >
                                          {isCurrentUserRow ? '+0' : (gap >= 0 ? `+${formatNumber(gap)}` : `-${formatNumber(Math.abs(gap))}`)}
                                        </Text>
                                      )
                                    })()}
                                  </Td>
                                  <Td>
                                    <HStack spacing={2}>
                                      {row.totalPoints >= cohortStats.avgTotal ? (
                                        <Icon as={TrendingUp} color="success.500" boxSize={4} />
                                      ) : (
                                        <Icon as={TrendingDown} color="danger.DEFAULT" boxSize={4} />
                                      )}
                                      <Text fontSize="xs" color="text.secondary">
                                        {row.totalPoints >= cohortStats.avgTotal ? 'Above avg' : 'Below avg'}
                                      </Text>
                                    </HStack>
                                  </Td>
                                  <Td isNumeric>
                                    <Text fontWeight="bold" color="text.primary">{formatNumber(row.totalPoints)}</Text>
                                    <Progress
                                      value={(row.totalPoints / Math.max(cohortStats.maxTotal, 1)) * 100}
                                      size="xs"
                                      colorScheme="purple"
                                      borderRadius="full"
                                      mt={1}
                                    />
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
                          bg="#350e6f"
                          color="white"
                          _hover={{ bg: '#4a1499' }}
                          onClick={() => setLeaderboardPage((prev) => prev + 1)}
                          borderTopRadius={0}
                          py={4}
                        >
                          Load more (25 per page)
                        </Button>
                      )}
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

      <UpgradePromptModal
        featureName={upgradeFeatureName}
        benefits={upgradeBenefits.length ? upgradeBenefits : ['Unlock premium collaboration features']}
        isOpen={isUpgradeOpen}
        onClose={onUpgradeClose}
      />

      <StartChallengeModal
        isOpen={isOpen}
        onClose={onClose}
        onChallengeCreated={handleChallengeCreated}
      />
    </Stack>
  )
}
