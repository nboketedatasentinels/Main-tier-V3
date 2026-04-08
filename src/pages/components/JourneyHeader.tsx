import { useMemo, useCallback } from 'react'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Flex,
  HStack,
  Heading,
  Icon,
  Progress,
  SimpleGrid,
  Stack,
  Tag,
  Text,
} from '@chakra-ui/react'
import { CheckCircle, Lock } from 'lucide-react'
import { format, addDays, differenceInDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import {
  JOURNEY_LABELS,
  MONTH_BASED_JOURNEYS,
  JOURNEY_MONTH_COUNTS,
} from '@/utils/journeyType'
import { JOURNEY_META, getMonthNumber } from '@/config/pointsConfig'
import { isFreeUser } from '@/utils/membership'
import { calculatePassMark } from '@/utils/completion'
import type { WeeklyProgress } from '@/types'
import type { JourneyConfig } from '@/hooks/useWeeklyChecklistViewModel'
import type { LeadershipAvailability } from '@/utils/leadershipAvailability'

interface MonthMilestone {
  month: number
  startWeek: number
  endWeek: number
  status: 'completed' | 'current' | 'locked'
  completionPercent: number
}

interface WeekMilestone {
  week: number
  status: 'completed' | 'current' | 'locked' | 'incomplete'
}

export const JourneyHeader = ({
  journey,
  progress,
  leadershipAvailability,
}: {
  journey: JourneyConfig | null
  progress: WeeklyProgress[]
  leadershipAvailability?: LeadershipAvailability
}) => {
  const { profile } = useAuth()

  const tierLabel = useMemo(() => {
    if (!profile) return 'Member'
    const tier = profile.transformationTier?.toString().toLowerCase() ?? ''
    if (tier.includes('corporate')) return 'Corporate'
    return isFreeUser(profile) ? 'Free Tier' : 'Premium'
  }, [profile])

  const isOrgManagedJourney = useMemo(() => Boolean(profile?.companyId), [profile?.companyId])

  const journeyStartDate = useMemo(() => {
    if (!journey) return null
    // Priority: org cohortStartDate (via JourneyConfig) > profile.journeyStartDate > fallback
    if (journey.journeyStartDate) {
      return new Date(journey.journeyStartDate)
    }
    if (profile?.journeyStartDate) {
      return new Date(profile.journeyStartDate)
    }
    // Fallback: estimate from currentWeek (inaccurate, kept for edge cases)
    const offsetWeeks = (journey.currentWeek || 1) - 1
    return addDays(new Date(), -(offsetWeeks * 7))
  }, [journey, profile])

  const journeyEndDate = useMemo(() => {
    if (!journeyStartDate || !journey) return null
    return addDays(journeyStartDate, journey.programDurationWeeks * 7)
  }, [journeyStartDate, journey])

  // Dynamically calculate current week and day from journeyStartDate
  // 37 days = 5 weeks + 2 days (not Week 6, Day 3)
  const { calculatedCurrentWeek, weekDayLabel } = useMemo(() => {
    if (!journeyStartDate || !journey) {
      const fallbackWeek = journey?.currentWeek ?? 1
      return { calculatedCurrentWeek: fallbackWeek, weekDayLabel: `Week ${fallbackWeek}` }
    }
    const daysSinceStart = differenceInDays(new Date(), journeyStartDate)
    const weeks = Math.floor(daysSinceStart / 7)
    const days = daysSinceStart % 7

    // For internal week tracking, use weeks + 1 (we're "in" the next week)
    const currentWeekForTracking = Math.max(1, Math.min(journey.programDurationWeeks, weeks + 1))

    // For display: "X weeks, Y days" format
    let label: string
    if (daysSinceStart >= journey.programDurationWeeks * 7) {
      label = `${journey.programDurationWeeks} weeks`
    } else if (weeks === 0) {
      label = `${days} day${days === 1 ? '' : 's'}`
    } else if (days === 0) {
      label = `${weeks} week${weeks === 1 ? '' : 's'}`
    } else {
      label = `${weeks} week${weeks === 1 ? '' : 's'}, ${days} day${days === 1 ? '' : 's'}`
    }

    return { calculatedCurrentWeek: currentWeekForTracking, weekDayLabel: label }
  }, [journeyStartDate, journey])

  const isMonthBasedJourney = useMemo(() => {
    return journey ? MONTH_BASED_JOURNEYS.includes(journey.journeyType) : false
  }, [journey])

  const currentMonthNumber = useMemo(() => {
    if (!journey) return 1
    return getMonthNumber(calculatedCurrentWeek)
  }, [journey, calculatedCurrentWeek])

  const totalMonths = useMemo(() => {
    if (!journey) return 1
    if (!isMonthBasedJourney) return 1
    return JOURNEY_MONTH_COUNTS[journey.journeyType]
  }, [journey, isMonthBasedJourney])

  const journeyMeta = useMemo(() => {
    if (!journey) return null
    return JOURNEY_META[journey.journeyType]
  }, [journey])

  const passMarkResult = useMemo(() => {
    if (!journey) return null
    return calculatePassMark(
      journey.journeyType,
      leadershipAvailability?.hasMentor ?? true,
      leadershipAvailability?.hasAmbassador ?? true,
    )
  }, [journey, leadershipAvailability?.hasAmbassador, leadershipAvailability?.hasMentor])

  const journeyProgress = useMemo(() => {
    if (!journey || !journeyMeta) {
      return { activeWeeks: 0, passPct: 0, totalEarned: 0, passMarkPoints: 0, maxPossiblePoints: 0 }
    }
    const totalEarned = progress.reduce((sum, week) => sum + (week.pointsEarned ?? 0), 0)
    const activeWeeks = progress.filter((week) => (week.pointsEarned ?? 0) > 0).length
    const passMarkPoints = passMarkResult?.adjustedThreshold ?? journeyMeta.passMarkPoints
    const maxPossiblePoints = passMarkResult?.totalTarget ?? journeyMeta.maxPossiblePoints
    const passPct = passMarkPoints > 0 ? Math.min(100, Math.round((totalEarned / passMarkPoints) * 100)) : 0
    return { activeWeeks, passPct, totalEarned, passMarkPoints, maxPossiblePoints }
  }, [journeyMeta, passMarkResult?.adjustedThreshold, passMarkResult?.totalTarget, progress, journey])

  const monthMeta = useCallback(
    (month: number): MonthMilestone => {
      if (!journey) {
        return {
          month,
          startWeek: 1,
          endWeek: 4,
          status: 'locked',
          completionPercent: 0,
        }
      }
      const startWeek = (month - 1) * 4 + 1
      const endWeek = Math.min(journey.programDurationWeeks, startWeek + 3)
      const isCompleted = endWeek < calculatedCurrentWeek
      const isCurrent = month === currentMonthNumber
      const status = isCompleted ? 'completed' : isCurrent ? 'current' : 'locked'
      const completedWeeks = isCompleted
        ? 4
        : isCurrent
        ? Math.max(0, Math.min(4, calculatedCurrentWeek - startWeek))
        : 0
      const completionPercent = Math.min(100, Math.round((completedWeeks / 4) * 100))
      return { month, startWeek, endWeek, status, completionPercent }
    },
    [calculatedCurrentWeek, currentMonthNumber, journey],
  )

  if (!journey) return null

  const label = JOURNEY_LABELS[journey.journeyType]
  const startLabel = journeyStartDate ? format(journeyStartDate, 'MMM d, yyyy') : 'Not set'
  const endLabel = journeyEndDate ? format(journeyEndDate, 'MMM d, yyyy') : 'Not set'
  const overviewLabel = isMonthBasedJourney
    ? `Month ${currentMonthNumber} of ${totalMonths} - ${weekDayLabel} of ${journey.programDurationWeeks}`
    : `${weekDayLabel} of ${journey.programDurationWeeks}`

  const monthMilestones: MonthMilestone[] = isMonthBasedJourney
    ? Array.from({ length: totalMonths }, (_, idx) => monthMeta(idx + 1))
    : []

  const weekMilestones: WeekMilestone[] = !isMonthBasedJourney
    ? Array.from({ length: journey.programDurationWeeks }, (_, idx) => {
        const weekNumber = idx + 1
        const weekProgress = progress.find((p) => p.weekNumber === weekNumber)
        const hasPoints = (weekProgress?.pointsEarned ?? 0) > 0

        let status: WeekMilestone['status'] = 'locked'
        if (hasPoints) {
          status = 'completed'
        } else if (weekNumber === calculatedCurrentWeek) {
          status = 'current'
        } else if (weekNumber < calculatedCurrentWeek) {
          status = 'incomplete'
        } else {
          status = 'locked'
        }

        return { week: weekNumber, status }
      })
    : []

  return (
    <Box
      borderWidth="1px"
      borderStyle="solid"
      borderColor="blue.200"
      borderRadius="xl"
      bg="white"
      boxShadow="md"
      overflow="hidden"
    >
      {/* Header Section */}
      <Box px={4} py={2} bg="gray.50" borderBottomWidth="1px" borderColor="gray.100">
        <Flex align="center" justify="space-between" wrap="wrap" gap={2}>
          <HStack spacing={2}>
            <Badge colorScheme="purple" fontSize="xs" px={2} borderRadius="full">{label}</Badge>
            <Badge colorScheme={journey.isPaid ? 'green' : 'gray'} fontSize="xs" px={2} borderRadius="full">{tierLabel}</Badge>
          </HStack>
          <HStack spacing={3} color="text.muted" fontSize="xs">
            <Text>Started: <Text as="span" fontWeight="semibold" color="text.primary">{startLabel}</Text></Text>
            <Text>Ends: <Text as="span" fontWeight="semibold" color="text.primary">{endLabel}</Text></Text>
          </HStack>
        </Flex>
      </Box>

      {/* Main Content */}
      <Box px={4} py={3}>
        <Stack spacing={3}>
          {/* Title and Progress */}
          <Flex align="center" justify="space-between" wrap="wrap" gap={2}>
            <HStack spacing={3}>
              <Heading size="sm" color="text.primary">Journey Progress</Heading>
              <Text color="text.secondary" fontSize="sm">{overviewLabel}</Text>
            </HStack>
            <HStack spacing={1}>
              <Text fontSize="lg" fontWeight="bold" color="teal.600">{journeyProgress.passPct}%</Text>
              <Text fontSize="xs" color="text.muted">pass</Text>
            </HStack>
          </Flex>

          {/* Progress Bar */}
          <Progress value={journeyProgress.passPct} colorScheme="teal" borderRadius="full" size="sm" />

          {/* Stats Grid */}
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
            <Box py={2} px={3} bg="gray.50" borderRadius="md" borderLeftWidth="3px" borderLeftColor="blue.400">
              <Text fontSize="xs" color="text.muted" textTransform="uppercase">Total Weeks</Text>
              <Text fontSize="md" fontWeight="bold" color="text.primary">{journey.programDurationWeeks}</Text>
            </Box>
            <Box py={2} px={3} bg="gray.50" borderRadius="md" borderLeftWidth="3px" borderLeftColor="green.400">
              <Text fontSize="xs" color="text.muted" textTransform="uppercase">Active Weeks</Text>
              <Text fontSize="md" fontWeight="bold" color="text.primary">{journeyProgress.activeWeeks}</Text>
            </Box>
            <Box py={2} px={3} bg="gray.50" borderRadius="md" borderLeftWidth="3px" borderLeftColor="purple.400">
              <Text fontSize="xs" color="text.muted" textTransform="uppercase">Points Earned</Text>
              <Text fontSize="md" fontWeight="bold" color="text.primary">{journeyProgress.totalEarned.toLocaleString()}</Text>
            </Box>
            <Box py={2} px={3} bg="gray.50" borderRadius="md" borderLeftWidth="3px" borderLeftColor="orange.400">
              <Text fontSize="xs" color="text.muted" textTransform="uppercase">Pass / Max</Text>
              <Text fontSize="md" fontWeight="bold" color="text.primary">{journeyProgress.passMarkPoints.toLocaleString()} / {journeyProgress.maxPossiblePoints.toLocaleString()}</Text>
            </Box>
          </SimpleGrid>

          {isOrgManagedJourney ? (
            <Alert status="info" borderRadius="md" variant="subtle" py={2}>
              <AlertIcon boxSize={4} />
              <Text fontSize="xs" color="text.secondary">
                Journey duration is managed by your organization. Your completed activity history remains recorded.
              </Text>
            </Alert>
          ) : null}

          {/* Week/Month Pills */}
          <HStack spacing={2} wrap="wrap" justify="center">
            {isMonthBasedJourney
              ? monthMilestones.map((monthItem) => (
                  <Tag
                    key={`month-${monthItem.month}`}
                    size="sm"
                    borderRadius="full"
                    colorScheme={
                      monthItem.status === 'completed' ? 'green' : monthItem.status === 'current' ? 'teal' : 'gray'
                    }
                  >
                    <HStack spacing={1}>
                      {monthItem.status === 'completed' && <Icon as={CheckCircle} boxSize={3} />}
                      {monthItem.status === 'locked' && <Icon as={Lock} boxSize={3} />}
                      <Text fontSize="xs">Month {monthItem.month}</Text>
                    </HStack>
                  </Tag>
                ))
              : weekMilestones.map((weekItem) => (
                  <Tag
                    key={`week-${weekItem.week}`}
                    size="sm"
                    borderRadius="full"
                    colorScheme={
                      weekItem.status === 'completed'
                        ? 'green'
                        : weekItem.status === 'current'
                          ? 'teal'
                          : weekItem.status === 'incomplete'
                            ? 'yellow'
                            : 'gray'
                    }
                  >
                    <HStack spacing={1}>
                      {weekItem.status === 'completed' && <Icon as={CheckCircle} boxSize={3} />}
                      {weekItem.status === 'locked' && <Icon as={Lock} boxSize={3} />}
                      <Text fontSize="xs">Week {weekItem.week}</Text>
                    </HStack>
                  </Tag>
                ))}
          </HStack>
        </Stack>
      </Box>
    </Box>
  )
}
