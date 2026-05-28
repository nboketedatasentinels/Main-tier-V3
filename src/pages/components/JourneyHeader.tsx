import { useMemo } from 'react'
import {
  Box,
  Flex,
  HStack,
  Heading,
  Progress,
  Stack,
  Text,
} from '@chakra-ui/react'
import { addDays, differenceInDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { JOURNEY_META } from '@/config/pointsConfig'
import { calculatePassMark } from '@/utils/completion'
import type { WeeklyProgress } from '@/types'
import type { JourneyConfig } from '@/hooks/useWeeklyChecklistViewModel'
import type { LeadershipAvailability } from '@/utils/leadershipAvailability'

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

  const calculatedCurrentWeek = useMemo(() => {
    if (!journeyStartDate || !journey) return journey?.currentWeek ?? 1
    const daysSinceStart = differenceInDays(new Date(), journeyStartDate)
    const weeks = Math.floor(daysSinceStart / 7)
    return Math.max(1, Math.min(journey.programDurationWeeks, weeks + 1))
  }, [journeyStartDate, journey])

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
      return { activeWeeks: 0, completePct: 0, totalEarned: 0, passMarkPoints: 0, maxPossiblePoints: 0 }
    }
    const totalEarned = progress.reduce((sum, week) => sum + (week.pointsEarned ?? 0), 0)
    const activeWeeks = progress.filter((week) => (week.pointsEarned ?? 0) > 0).length
    const passMarkPoints = passMarkResult?.adjustedThreshold ?? journeyMeta.passMarkPoints
    const maxPossiblePoints = passMarkResult?.totalTarget ?? journeyMeta.maxPossiblePoints
    const completePct = maxPossiblePoints > 0 ? Math.min(100, Math.round((totalEarned / maxPossiblePoints) * 100)) : 0
    return { activeWeeks, completePct, totalEarned, passMarkPoints, maxPossiblePoints }
  }, [journeyMeta, passMarkResult?.adjustedThreshold, passMarkResult?.totalTarget, progress, journey])

  // ── Urgency: compare actual points vs expected at this point in time ──
  const urgency = useMemo(() => {
    if (!journey || !journeyMeta) return null
    const { totalEarned, passMarkPoints } = journeyProgress
    const totalWeeks = journey.programDurationWeeks
    const daysSinceStart = journeyStartDate ? differenceInDays(new Date(), journeyStartDate) : 0
    const elapsedWeeks = Math.min(totalWeeks, daysSinceStart / 7)
    const timeProgress = elapsedWeeks / totalWeeks // 0..1
    const journeyEnded = timeProgress >= 1
    const expectedPointsNow = timeProgress * passMarkPoints
    const paceRatio = expectedPointsNow > 0 ? totalEarned / expectedPointsNow : 1
    const deficit = Math.max(0, Math.round(expectedPointsNow - totalEarned))
    const weeksLeft = Math.max(0, Math.ceil(totalWeeks - elapsedWeeks))
    const pointsNeeded = Math.max(0, passMarkPoints - totalEarned)
    const weeklyNeeded = weeksLeft > 0 ? Math.ceil(pointsNeeded / weeksLeft) : 0

    type UrgencyLevel = 'critical' | 'behind' | 'warning' | 'on_track'
    let level: UrgencyLevel = 'on_track'
    let message = ''
    let color = 'teal'

    if (journeyEnded && totalEarned < passMarkPoints) {
      level = 'critical'
      message = `Your journey has ended. You earned ${totalEarned.toLocaleString()} of the ${passMarkPoints.toLocaleString()} points required to pass.`
      color = 'red'
    } else if (paceRatio < 0.4) {
      level = 'critical'
      message = `You're significantly behind - ${deficit.toLocaleString()} points below where you should be. You need ~${weeklyNeeded.toLocaleString()} pts/week to pass.`
      color = 'red'
    } else if (paceRatio < 0.65) {
      level = 'behind'
      message = `You're falling behind pace by ${deficit.toLocaleString()} points. Aim for ~${weeklyNeeded.toLocaleString()} pts/week to catch up.`
      color = 'orange'
    } else if (paceRatio < 0.85) {
      level = 'warning'
      message = `You're slightly behind - ${deficit.toLocaleString()} points off target. Stay consistent to close the gap.`
      color = 'yellow'
    }

    return { level, message, color, deficit, paceRatio, journeyEnded, weeksLeft, weeklyNeeded, pointsNeeded }
  }, [journey, journeyMeta, journeyProgress, journeyStartDate])

  if (!journey) return null

  const totalCycles = Math.max(1, Math.ceil(journey.programDurationWeeks / 2))
  const cycleNumber = Math.min(totalCycles, Math.max(1, Math.ceil(calculatedCurrentWeek / 2)))
  const overviewLabel = `Week ${calculatedCurrentWeek} of ${journey.programDurationWeeks} · Cycle ${cycleNumber} of ${totalCycles}`

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
      <Box px={4} py={3}>
        <Stack spacing={3}>
          <Flex align="center" justify="space-between" wrap="wrap" gap={2}>
            <HStack spacing={3}>
              <Heading size="sm" color="text.primary">Journey Progress</Heading>
              <Text color="text.secondary" fontSize="sm">{overviewLabel}</Text>
            </HStack>
            <HStack spacing={1}>
              <Text fontSize="lg" fontWeight="bold" color={urgency?.level === 'critical' ? 'red.600' : urgency?.level === 'behind' ? 'orange.600' : urgency?.level === 'warning' ? 'yellow.700' : 'teal.600'}>{journeyProgress.completePct}%</Text>
              <Text fontSize="xs" color="text.muted">complete</Text>
            </HStack>
          </Flex>

          <Progress value={journeyProgress.completePct} colorScheme={urgency?.level === 'critical' ? 'red' : urgency?.level === 'behind' ? 'orange' : urgency?.level === 'warning' ? 'yellow' : 'teal'} borderRadius="full" size="sm" />
        </Stack>
      </Box>
    </Box>
  )
}
