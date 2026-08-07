import { useEffect, useMemo, useState } from 'react'
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/hooks/useAuth'
import { JOURNEY_META } from '@/config/pointsConfig'
import { getJourneyLabel, isMonthBasedJourney, JOURNEY_MONTH_COUNTS } from '@/utils/journeyType'
import { getJourneyTiming } from '@/utils/weekCalculations'
import { calculatePassMark } from '@/utils/completion'
import type { JourneyConfig } from '@/hooks/useWeeklyChecklistViewModel'
import type { LeadershipAvailability } from '@/utils/leadershipAvailability'

const MotionBox = motion(Box)

/**
 * Journey progress header for weekly-checklist.
 * Kept in lockstep with Weekly Glance: same source (points_ledger), same
 * denominator (pass mark), same week/cycle copy, same thin progress bar.
 */
export const JourneyHeader = ({
  journey,
  leadershipAvailability,
}: {
  journey: JourneyConfig | null
  /** @deprecated Glance/checklist now read the ledger directly; kept for call-site compat. */
  progress?: unknown
  leadershipAvailability?: LeadershipAvailability
}) => {
  const { user, profile } = useAuth()
  const prefersReducedMotion = useReducedMotion()
  const [totalEarned, setTotalEarned] = useState(0)
  const [loading, setLoading] = useState(true)

  const journeyStartDate =
    journey?.journeyStartDate || profile?.journeyStartDate || null
  const totalWeeks = journey?.programDurationWeeks ?? JOURNEY_META[journey?.journeyType ?? '6W']?.weeks ?? 6

  const journeyTiming = useMemo(
    () => getJourneyTiming(journeyStartDate, totalWeeks),
    [journeyStartDate, totalWeeks],
  )

  const currentWeek = journeyTiming?.currentWeek ?? journey?.currentWeek ?? 1
  const cycleNumber = journeyTiming?.currentCycle ?? Math.ceil(currentWeek / 2)
  const totalCycles = journeyTiming?.totalCycles ?? Math.max(1, Math.ceil(totalWeeks / 2))
  const useMonths = Boolean(journey?.journeyType && isMonthBasedJourney(journey.journeyType))
  const currentMonth = Math.max(1, Math.ceil(currentWeek / 4))
  const totalMonths =
    journey?.journeyType && isMonthBasedJourney(journey.journeyType)
      ? JOURNEY_MONTH_COUNTS[journey.journeyType]
      : Math.max(1, Math.ceil(totalWeeks / 4))
  const timingLabel = useMonths
    ? `Month ${currentMonth} of ${totalMonths}`
    : `Week ${currentWeek} of ${totalWeeks} · Cycle ${cycleNumber} of ${totalCycles}`

  const passMark = useMemo(() => {
    if (!journey) return JOURNEY_META['6W']?.passMarkPoints ?? 0
    const adjusted = calculatePassMark(
      journey.journeyType,
      leadershipAvailability?.hasMentor ?? true,
      leadershipAvailability?.hasAmbassador ?? true,
    )
    return adjusted?.adjustedThreshold ?? JOURNEY_META[journey.journeyType]?.passMarkPoints ?? 0
  }, [journey, leadershipAvailability?.hasAmbassador, leadershipAvailability?.hasMentor])

  // Same source of truth as Weekly Glance: sum of points_ledger rows.
  useEffect(() => {
    const uid = user?.uid ?? profile?.id
    if (!uid) {
      setTotalEarned(0)
      setLoading(false)
      return
    }

    let active = true
    const load = async () => {
      const { data, error } = await supabase
        .from('points_ledger')
        .select('points')
        .eq('uid', uid)
      if (!active) return
      if (error) {
        console.error('[JourneyHeader] points_ledger read failed', error.message)
        setLoading(false)
        return
      }
      const sum = (data ?? []).reduce((acc, row) => {
        const p = typeof row.points === 'number' ? row.points : Number(row.points)
        return acc + (Number.isFinite(p) ? p : 0)
      }, 0)
      setTotalEarned(sum)
      setLoading(false)
    }

    void load()
    const channel = supabase
      .channel(`checklist_journey_progress_${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'points_ledger', filter: `uid=eq.${uid}` },
        () => void load(),
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [user?.uid, profile?.id])

  // Progress against the pass mark - identical formula to Weekly Glance.
  const journeyProgress =
    passMark > 0 ? Math.min(100, Math.round((totalEarned / passMark) * 100)) : 0

  if (!journey) return null

  return (
    <Stack spacing={2}>
      <Flex justify="space-between" align="baseline" gap={3} flexWrap="wrap">
        <HStack spacing={2} align="baseline">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wide"
            color="gray.500"
          >
            {getJourneyLabel(journey.journeyType)} · Journey progress
          </Text>
          <Text fontSize="xs" color="gray.400">
            {timingLabel}
          </Text>
        </HStack>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color="gray.600"
          opacity={loading ? 0.5 : 1}
        >
          {journeyProgress}% of pass mark
        </Text>
      </Flex>
      <Box h="6px" bg="gray.100" borderRadius="full" overflow="hidden">
        <MotionBox
          h="full"
          borderRadius="full"
          bgGradient={
            journeyProgress >= 100
              ? 'linear(to-r, #047857, #16a34a)'
              : 'linear(to-r, #350e6f, #f4540c)'
          }
          initial={prefersReducedMotion ? false : { width: 0 }}
          animate={{ width: `${journeyProgress}%` }}
          transition={
            prefersReducedMotion ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
          }
        />
      </Box>
    </Stack>
  )
}
