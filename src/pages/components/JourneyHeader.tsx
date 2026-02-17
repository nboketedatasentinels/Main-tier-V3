import { useMemo, useCallback } from 'react'
import {
  Alert,
  AlertIcon,
  Badge,
  Flex,
  HStack,
  Heading,
  Icon,
  Progress,
  Stack,
  Tag,
  Text,
} from '@chakra-ui/react'
import { CheckCircle, Lock } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { SurfaceCard } from '@/components/primitives/SurfacePrimitives'
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

  const isMonthBasedJourney = useMemo(() => {
    return journey ? MONTH_BASED_JOURNEYS.includes(journey.journeyType) : false
  }, [journey])

  const currentMonthNumber = useMemo(() => {
    if (!journey) return 1
    return getMonthNumber(journey.currentWeek)
  }, [journey])

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
      const isCompleted = endWeek < (journey.currentWeek || 1)
      const isCurrent = month === currentMonthNumber
      const status = isCompleted ? 'completed' : isCurrent ? 'current' : 'locked'
      const completedWeeks = isCompleted
        ? 4
        : isCurrent
        ? Math.max(0, Math.min(4, (journey.currentWeek || 1) - startWeek))
        : 0
      const completionPercent = Math.min(100, Math.round((completedWeeks / 4) * 100))
      return { month, startWeek, endWeek, status, completionPercent }
    },
    [currentMonthNumber, journey],
  )

  if (!journey) return null

  const label = JOURNEY_LABELS[journey.journeyType]
  const startLabel = journeyStartDate ? format(journeyStartDate, 'MMM d, yyyy') : 'Not set'
  const endLabel = journeyEndDate ? format(journeyEndDate, 'MMM d, yyyy') : 'Not set'
  const overviewLabel = isMonthBasedJourney
    ? `Month ${currentMonthNumber} of ${totalMonths} - Week ${journey.currentWeek} of ${journey.programDurationWeeks}`
    : `Week ${journey.currentWeek} of ${journey.programDurationWeeks}`

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
        } else if (weekNumber === journey.currentWeek) {
          status = 'current'
        } else if (weekNumber < journey.currentWeek) {
          status = 'incomplete'
        } else {
          status = 'locked'
        }

        return { week: weekNumber, status }
      })
    : []

  return (
    <SurfaceCard borderColor="border.card">
      <Stack spacing={4}>
        <Flex align="flex-start" justify="space-between" wrap="wrap" gap={4}>
          <Stack spacing={2}>
            <HStack spacing={2}>
              <Badge colorScheme="purple">{label}</Badge>
              <Badge colorScheme={journey.isPaid ? 'green' : 'gray'}>{tierLabel}</Badge>
            </HStack>
            <Heading size="md" color="text.primary">
              Journey Progress
            </Heading>
            <Text color="text.secondary">{overviewLabel}</Text>
            <Text color="text.secondary" fontSize="sm">
              {journey.programDurationWeeks} total weeks · {journeyProgress.activeWeeks} weeks with points
            </Text>
            <Text color="text.secondary" fontSize="sm">
              {journeyProgress.totalEarned.toLocaleString()} points accumulated · Pass mark {journeyProgress.passMarkPoints.toLocaleString()}
            </Text>
            <Text color="text.secondary" fontSize="sm">
              Max possible {journeyProgress.maxPossiblePoints.toLocaleString()} points
            </Text>
          </Stack>
          <Stack spacing={1} align="flex-end">
            <Text color="text.muted" fontSize="sm">
              Started: {startLabel}
            </Text>
            <Text color="text.muted" fontSize="sm">
              Expected completion: {endLabel}
            </Text>
            <Text color="text.muted" fontSize="sm">
              Pass progress {journeyProgress.passPct}%
            </Text>
          </Stack>
        </Flex>
        <Progress value={journeyProgress.passPct} colorScheme="teal" borderRadius="full" />
        {isOrgManagedJourney ? (
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Text fontSize="sm" color="text.secondary">
              Journey duration is managed by your organization for this cohort. If the schedule changes, your completed activity history remains recorded.
            </Text>
          </Alert>
        ) : null}
        <HStack spacing={2} wrap="wrap">
          {isMonthBasedJourney
            ? monthMilestones.map((monthItem) => (
                <Tag
                  key={`month-${monthItem.month}`}
                  colorScheme={
                    monthItem.status === 'completed' ? 'green' : monthItem.status === 'current' ? 'teal' : 'gray'
                  }
                >
                  <HStack spacing={1}>
                    {monthItem.status === 'completed' && <Icon as={CheckCircle} />}
                    {monthItem.status === 'locked' && <Icon as={Lock} />}
                    <Text>Month {monthItem.month}</Text>
                  </HStack>
                </Tag>
              ))
            : weekMilestones.map((weekItem) => (
                <Tag
                  key={`week-${weekItem.week}`}
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
                    {weekItem.status === 'completed' && <Icon as={CheckCircle} />}
                    {weekItem.status === 'locked' && <Icon as={Lock} />}
                    <Text>Week {weekItem.week}</Text>
                  </HStack>
                </Tag>
              ))}
        </HStack>
      </Stack>
    </SurfaceCard>
  )
}
