import { useMemo, useState } from 'react'
import {
  Box,
  Center,
  Collapse,
  Flex,
  Grid,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react'
import { ChevronDown, ChevronRight, PartyPopper } from 'lucide-react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import type { JourneyType } from '@/config/pointsConfig'
import { getVisibleActivities } from '@/utils/activityStateManager'
import {
  getMonthOccurrenceQuota,
  getMonthWeekRange,
  isMonthBasedJourney,
  JOURNEY_MONTH_COUNTS,
  weekToMonth,
  WEEKS_PER_MONTH,
} from '@/utils/journeyType'
import {
  PARALLEL_WINDOW_SIZE_WEEKS,
} from '@/utils/windowCalculations'
import { ActivityRow } from './ActivityRow'
import { PillarProgrammeComponentsSection } from '@/components/courses/PillarProgrammeComponentsSection'
import { useUserPillar } from '@/hooks/useUserPillar'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import { resolvePillarForMonth, isProgrammePassFailMonth } from '@/utils/monthCoursePillar'
import type { Pillar } from '@/types/pillar'

/** Checklist activity ids that mirror the Capstone / Case Study / Practical cards. */
const PROGRAMME_COMPONENT_ACTIVITY_IDS = new Set(['capstone', 'case_study', 'practical'])

type WeekRowKind = 'todo' | 'pending' | 'done'

type TodoRow = {
  activity: ActivityState
  weekOverride: number
  occurrence?: number
  /** 1-based claim number for this row (e.g. 2 of 3). */
  occurrenceNumber?: number
  occurrenceTotal?: number
  /** Month-local completed count for display (month journeys). */
  occurrenceDone?: number
  rowKind?: WeekRowKind
}

type Bucket = 'todo' | 'pending' | 'done' | 'locked'

/** Points still available on a checklist row (honours month quotas). */
const rowAvailablePoints = (row: TodoRow): number => {
  const pts = row.activity.points ?? 0
  if (typeof row.occurrenceDone === 'number' && typeof row.occurrenceTotal === 'number') {
    return pts * Math.max(0, row.occurrenceTotal - row.occurrenceDone)
  }
  return pts
}

const projectForWeek = (activity: ActivityState): ActivityState => {
  // Each actionable duplicate is a claim slot that has not been completed yet.
  // Strip global completion flags the VM sets from the selected-week ledger so
  // the row renders as actionable for its own occurrence.
  let next: ActivityState = activity
  if (activity.status === 'completed' || activity.hasInteracted) {
    next = { ...next, status: 'not_started', hasInteracted: false }
  }
  const reason = activity.availability.reason
  const isSoftCapLock =
    activity.availability.state === 'next_window' ||
    reason === 'window_cap_reached' ||
    reason === 'weekly_cooldown'
  if (isSoftCapLock) {
    next = {
      ...next,
      availability: { state: 'available', isScheduledForWeek: true },
    }
  }
  return next
}

const isRecurringActivity = (activity: ActivityState): boolean => {
  const t = activity.activityPolicy?.type
  return t === 'window_limited' || t === 'ongoing'
}

const SECTION_TITLES: Record<Bucket, string> = {
  todo: 'To do',
  pending: 'In review',
  done: 'Done',
  locked: 'Coming up',
}

interface ActivityListProps {
  activities: ActivityState[]
  selectedWeek: number
  currentWeek: number
  programDurationWeeks: number
  /** When 3M/6M/9M, checklist sections are labelled by month instead of week. */
  journeyType?: JourneyType | null
  completedWeeksByActivity: Record<string, Set<number>>
  /** Claim counts by activity → month (1-based). Used for month-local 0/3 style progress. */
  completedCountByActivityMonth?: Record<string, Record<number, number>>
  pendingWeeksByActivity: Record<string, Set<number>>
  isWeekLocked: boolean
  isAdmin: boolean
  onOpenCurrentWeek: () => void
  onMarkCompleted: (
    activity: ActivityState,
    weekOverride?: number,
    claimRef?: string,
  ) => Promise<void>
  onMarkNotStarted: (activity: ActivityState) => Promise<void>
  onOpenProof: (activity: ActivityState, weekOverride?: number) => void
  onRefreshLedger?: () => void
  isActivityBusy?: (activityId: string) => boolean
}

const ColumnHeader = () => (
  <Grid
    templateColumns="20px minmax(0,1fr) 70px 130px 90px 16px"
    gap={4}
    alignItems="center"
    px={4}
    py={2}
    borderBottom="1px solid"
    borderColor="gray.200"
    bg="gray.50"
    display={{ base: 'none', md: 'grid' }}
  >
    <Box />
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="0.04em"
    >
      Name
    </Text>
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="0.04em"
    >
      Done
    </Text>
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="0.04em"
    >
      Approval
    </Text>
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="0.04em"
      textAlign="right"
    >
      Points
    </Text>
    <Box />
  </Grid>
)

export const ActivityList = ({
  activities,
  selectedWeek,
  currentWeek,
  programDurationWeeks,
  journeyType = null,
  completedWeeksByActivity,
  completedCountByActivityMonth = {},
  pendingWeeksByActivity,
  isWeekLocked,
  isAdmin,
  onOpenCurrentWeek,
  onMarkCompleted,
  onOpenProof,
  onRefreshLedger,
  isActivityBusy,
}: ActivityListProps) => {
  const { profile } = useAuth()
  const organizationId =
    (profile as { organizationId?: string | null; orgId?: string | null } | null)
      ?.organizationId ??
    (profile as { organizationId?: string | null; orgId?: string | null } | null)?.orgId ??
    null
  const { program } = useOrganizationProgramCourses(organizationId)
  const { pillar } = useUserPillar()
  // Free practitioners (Starter Kit) see the same Capstone / Case Study /
  // Practical cards under Week 1 as on My Courses - not as scattered rows.
  const showProgrammeCardsUnderWeek1 = pillar === 'starter_kit'
  const useMonths = Boolean(journeyType && isMonthBasedJourney(journeyType))
  // 3M only: Capstone / Case Study / Practical cards (same CSS as My Courses)
  // as the last block under each month, pillar from that month's course.
  const showProgrammeCardsUnderMonths = journeyType === '3M'
  const periodNoun = useMonths ? 'month' : 'week'
  const currentPeriod = useMonths ? weekToMonth(currentWeek) : currentWeek

  const pillarForMonth = (month: number): Pillar | null =>
    resolvePillarForMonth(month, program?.monthlyAssignments) ??
    (useMonths ? null : pillar)

  const visibleActivities = useMemo(() => getVisibleActivities(activities), [activities])

  const ordered = useMemo(() => {
    const withId = visibleActivities.filter((activity) => activity?.id)
    // Starter Kit + 3M: cards carry Capstone / Case Study / Practical.
    // 6M / 9M keep checklist rows with month-local pillar content.
    if (!showProgrammeCardsUnderWeek1 && !showProgrammeCardsUnderMonths) return withId
    return withId.filter((activity) => !PROGRAMME_COMPONENT_ACTIVITY_IDS.has(activity.id))
  }, [visibleActivities, showProgrammeCardsUnderWeek1, showProgrammeCardsUnderMonths])

  // Full journey capacity (points × occurrence caps) - e.g. 60,000 for 6W.
  // Week-based journeys keep this for the To-do header: only the next claim
  // sits in To-do rows, so summing open rows would under-count.
  const journeyPointsTotal = useMemo(
    () =>
      ordered.reduce((sum, activity) => {
        const freq = Math.max(1, activity.activityPolicy?.maxTotal ?? 1)
        return sum + (activity.points ?? 0) * freq
      }, 0),
    [ordered],
  )

  const grouped = useMemo(() => {
    const todoByWeek = new Map<number, TodoRow[]>()
    const doneByWeek = new Map<number, ActivityState[]>()
    const pendingByWeek = new Map<number, ActivityState[]>()
    const locked: ActivityState[] = []
    const lockedIds = new Set<string>()
    let todoTotalCount = 0
    let todoPointsTotal = 0
    let doneTotalCount = 0
    let donePointsTotal = 0
    let pendingTotalCount = 0
    let pendingPointsTotal = 0

    const totalWeeks = Math.max(1, programDurationWeeks)

    const pushLocked = (activity: ActivityState) => {
      if (lockedIds.has(activity.id)) return
      lockedIds.add(activity.id)
      locked.push(activity)
    }

    const pushWeekRow = (week: number, row: TodoRow) => {
      const list = todoByWeek.get(week) ?? []
      list.push(row)
      todoByWeek.set(week, list)
    }

    const pushDone = (week: number, activity: ActivityState, occurrenceNumber?: number) => {
      const list = doneByWeek.get(week) ?? []
      list.push(activity)
      doneByWeek.set(week, list)
      doneTotalCount += 1
      donePointsTotal += activity.points ?? 0

      const totalCap = activity.activityPolicy?.maxTotal ?? 1
      // Keep the completed claim visible in its week with strikethrough -
      // do not let maxed-out activities vanish from the week list.
      pushWeekRow(week, {
        activity,
        weekOverride: week,
        occurrence: occurrenceNumber,
        occurrenceNumber: occurrenceNumber ?? Math.min(activity.completedCount ?? 1, totalCap),
        occurrenceTotal: Math.max(1, totalCap),
        rowKind: 'done',
      })
    }

    const pushPending = (week: number, activity: ActivityState, occurrenceNumber?: number) => {
      const list = pendingByWeek.get(week) ?? []
      list.push(activity)
      pendingByWeek.set(week, list)
      pendingTotalCount += 1
      pendingPointsTotal += activity.points ?? 0

      const totalCap = activity.activityPolicy?.maxTotal ?? 1
      pushWeekRow(week, {
        activity,
        weekOverride: week,
        occurrence: occurrenceNumber,
        occurrenceNumber: occurrenceNumber ?? Math.min((activity.completedCount ?? 0) + 1, totalCap),
        occurrenceTotal: Math.max(1, totalCap),
        rowKind: 'pending',
      })
    }

    ordered.forEach((activity) => {
      const startWeek = Math.max(1, activity.week ?? 1)
      const isRecurring = isRecurringActivity(activity)
      const isMonthProgrammeComponent =
        PROGRAMME_COMPONENT_ACTIVITY_IDS.has(activity.id)
      const completedWeeks =
        completedWeeksByActivity[activity.id] ?? new Set<number>()
      const pendingWeeks =
        pendingWeeksByActivity[activity.id] ?? new Set<number>()
      const totalCap = activity.activityPolicy?.maxTotal ?? 1
      const sortedCompleted = Array.from(completedWeeks).sort((a, b) => a - b)
      const journeyDone = activity.completedCount ?? 0

      // Month-based journeys: one row per month with that month's quota
      // (podcast 9 → 0/3 each month, weekly session 12 → 0/4 each month).
      // Capstone / case study / practical are one_time in config but still need
      // one month-local row so content can follow that month's course pillar.
      if (useMonths && (isRecurring || isMonthProgrammeComponent) && totalCap > 1) {
        const monthCount =
          (journeyType && JOURNEY_MONTH_COUNTS[journeyType]) ||
          Math.max(1, Math.ceil(totalWeeks / WEEKS_PER_MONTH))

        for (let month = 1; month <= monthCount; month += 1) {
          const monthCap = getMonthOccurrenceQuota(totalCap, month, monthCount)
          if (monthCap <= 0) continue

          const monthDone =
            completedCountByActivityMonth[activity.id]?.[month] ?? 0
          const { start: monthStart, end: monthEnd } = getMonthWeekRange(month)
          let monthPending = 0
          pendingWeeks.forEach((w) => {
            if (w >= monthStart && w <= monthEnd) monthPending += 1
          })
          const usedInMonth = monthDone + monthPending
          const claimWeek =
            selectedWeek >= monthStart && selectedWeek <= monthEnd
              ? selectedWeek
              : monthStart
          const occurrenceNumber =
            totalCap > 1 ? Math.min(Math.max(1, journeyDone + 1), totalCap) : undefined

          if (monthDone >= monthCap) {
            pushWeekRow(claimWeek, {
              activity,
              weekOverride: claimWeek,
              occurrence: month,
              occurrenceNumber,
              occurrenceTotal: monthCap,
              occurrenceDone: monthCap,
              rowKind: 'done',
            })
            doneTotalCount += 1
            donePointsTotal += (activity.points ?? 0) * monthCap
            continue
          }

          if (monthPending > 0 && usedInMonth >= monthCap) {
            const pendingPts =
              (activity.points ?? 0) * Math.max(0, monthCap - monthDone)
            pushWeekRow(claimWeek, {
              activity,
              weekOverride: claimWeek,
              occurrence: month,
              occurrenceNumber,
              occurrenceTotal: monthCap,
              occurrenceDone: Math.min(monthCap, usedInMonth),
              rowKind: 'pending',
            })
            pendingTotalCount += 1
            pendingPointsTotal += pendingPts
            continue
          }

          if (
            activity.availability.state === 'locked' &&
            activity.availability.reason !== 'weekly_cooldown'
          ) {
            pushLocked(activity)
            continue
          }

          const remainingInMonth = Math.max(0, monthCap - monthDone)
          pushWeekRow(claimWeek, {
            activity,
            weekOverride: claimWeek,
            occurrence: month,
            occurrenceNumber,
            occurrenceTotal: monthCap,
            occurrenceDone: Math.min(monthCap, monthDone),
            rowKind: 'todo',
          })
          todoTotalCount += 1
          todoPointsTotal += (activity.points ?? 0) * remainingInMonth
        }
        return
      }

      // Every recorded completion goes into Done under its actual weekNumber
      // AND stays visible in that week row (strikethrough + occurrence).
      sortedCompleted.forEach((cw, idx) => {
        pushDone(cw, activity, totalCap > 1 ? idx + 1 : undefined)
      })

      // Every pending submission goes into In Review and stays in its week.
      Array.from(pendingWeeks)
        .sort((a, b) => a - b)
        .forEach((pw, idx) => {
          if (completedWeeks.has(pw)) return
          const occurrenceNumber =
            totalCap > 1 ? sortedCompleted.length + idx + 1 : undefined
          pushPending(pw, activity, occurrenceNumber)
        })

      if (!isRecurring) {
        const totalDone = activity.completedCount ?? 0
        const isFullyDone =
          totalDone >= totalCap ||
          activity.availability.state === 'permanently_exhausted'
        if (isFullyDone) {
          if (completedWeeks.size === 0) pushDone(startWeek, activity, totalCap > 1 ? totalCap : undefined)
          return
        }
        if (pendingWeeks.size > 0 || activity.status === 'pending') {
          if (pendingWeeks.size === 0) {
            pushPending(
              startWeek,
              activity,
              totalCap > 1 ? Math.min(totalDone + 1, totalCap) : undefined,
            )
          }
          return
        }
        const isTodo =
          activity.status === 'rejected' ||
          activity.availability.state === 'available'
        if (isTodo) {
          const used = (activity.completedCount ?? 0) + pendingWeeks.size
          const remaining = Math.max(1, totalCap - used)
          const usedWeeks = new Set<number>([...completedWeeks, ...pendingWeeks])
          for (let i = 0; i < remaining; i++) {
            let targetWeek = Math.min(totalWeeks, startWeek + i * PARALLEL_WINDOW_SIZE_WEEKS)
            while (usedWeeks.has(targetWeek) && targetWeek < totalWeeks) targetWeek += 1
            usedWeeks.add(targetWeek)
            const occurrenceNumber = totalCap > 1 ? used + i + 1 : undefined
            pushWeekRow(targetWeek, {
              activity,
              weekOverride: targetWeek,
              occurrence: i,
              occurrenceNumber,
              occurrenceTotal: Math.max(1, totalCap),
              rowKind: 'todo',
            })
            todoTotalCount += 1
            todoPointsTotal += activity.points ?? 0
          }
          return
        }
        pushLocked(activity)
        return
      }

      // Recurring activity (window_limited or ongoing).
      const totalDone = activity.completedCount ?? 0
      const isPermExhausted =
        activity.availability.state === 'permanently_exhausted' ||
        totalDone >= totalCap
      if (isPermExhausted) {
        // Fully consumed - completed weeks already pushed above with
        // strikethrough. Do not drop them from the week list.
        return
      }

      if (activity.status === 'pending' && pendingWeeks.size === 0) {
        pushPending(
          startWeek,
          activity,
          totalCap > 1 ? Math.min(totalDone + 1, totalCap) : undefined,
        )
        return
      }

      if (
        activity.availability.state === 'locked' &&
        activity.availability.reason !== 'weekly_cooldown'
      ) {
        pushLocked(activity)
        return
      }

      const pendingCount = pendingWeeks.size
      const usedTotal = totalDone + pendingCount
      const remaining = Math.max(0, totalCap - usedTotal)
      if (remaining === 0) return

      // Keep offering the next occurrence on the week/month the learner is
      // viewing until maxTotal is reached — do not wait for a later week.
      const claimWeek = Math.max(startWeek, selectedWeek)
      const occurrenceNumber = totalCap > 1 ? usedTotal + 1 : undefined
      pushWeekRow(claimWeek, {
        activity,
        weekOverride: claimWeek,
        occurrence: 0,
        occurrenceNumber,
        occurrenceTotal: Math.max(1, totalCap),
        rowKind: 'todo',
      })
      todoTotalCount += 1
      todoPointsTotal += activity.points ?? 0
    })

    // Deduplicate within the same kind only so a completed claim can sit beside
    // the next actionable occurrence in the same week.
    const kindRank: Record<WeekRowKind, number> = { done: 3, pending: 2, todo: 1 }
    todoByWeek.forEach((rows, week) => {
      const best = new Map<string, TodoRow>()
      rows.forEach((row) => {
        const key = `${row.activity.id}::${row.weekOverride}::${row.occurrence ?? ''}::${row.rowKind ?? 'todo'}`
        const prev = best.get(key)
        const rank = kindRank[row.rowKind ?? 'todo']
        if (!prev || rank > kindRank[prev.rowKind ?? 'todo']) {
          best.set(key, row)
        }
      })
      // Stable order: open work first, then in-review, then completed
      // (completed stays visible with strikethrough at the bottom of the week).
      const next = Array.from(best.values()).sort((a, b) => {
        const rankDiff = kindRank[a.rowKind ?? 'todo'] - kindRank[b.rowKind ?? 'todo']
        if (rankDiff !== 0) return rankDiff
        return (a.occurrenceNumber ?? 0) - (b.occurrenceNumber ?? 0)
      })
      todoByWeek.set(week, next)
    })

    return {
      todoByWeek,
      doneByWeek,
      pendingByWeek,
      locked,
      todoTotalCount,
      todoPointsTotal,
      doneTotalCount,
      donePointsTotal,
      pendingTotalCount,
      pendingPointsTotal,
    }
  }, [
    ordered,
    completedWeeksByActivity,
    completedCountByActivityMonth,
    pendingWeeksByActivity,
    programDurationWeeks,
    selectedWeek,
    useMonths,
    journeyType,
  ])

  // Month journeys: header = remaining To-do capacity (+ Coming up), so it
  // matches the sum of Month 1/2/3 row totals. Week journeys keep full journey
  // capacity (see journeyPointsTotal).
  const todoSectionAvailablePoints = useMemo(() => {
    if (!useMonths) return journeyPointsTotal
    const lockedPts = grouped.locked.reduce((sum, activity) => {
      const freq = Math.max(1, activity.activityPolicy?.maxTotal ?? 1)
      const done = activity.completedCount ?? 0
      return sum + (activity.points ?? 0) * Math.max(0, freq - done)
    }, 0)
    return grouped.todoPointsTotal + lockedPts
  }, [
    useMonths,
    journeyPointsTotal,
    grouped.locked,
    grouped.todoPointsTotal,
  ])

  const sortedTodoWeeks = useMemo(
    () => Array.from(grouped.todoByWeek.keys()).sort((a, b) => a - b),
    [grouped.todoByWeek],
  )

  const sortedPendingWeeks = useMemo(
    () => Array.from(grouped.pendingByWeek.keys()).sort((a, b) => a - b),
    [grouped.pendingByWeek],
  )

  /** Week or month keys used as section headers in To do / In review. */
  const sortedTodoPeriods = useMemo(() => {
    if (!useMonths) return sortedTodoWeeks
    return Array.from(new Set(sortedTodoWeeks.map(weekToMonth))).sort((a, b) => a - b)
  }, [sortedTodoWeeks, useMonths])

  const sortedPendingPeriods = useMemo(() => {
    if (!useMonths) return sortedPendingWeeks
    return Array.from(new Set(sortedPendingWeeks.map(weekToMonth))).sort((a, b) => a - b)
  }, [sortedPendingWeeks, useMonths])

  const rowsForTodoPeriod = (period: number): TodoRow[] => {
    if (!useMonths) return grouped.todoByWeek.get(period) ?? []
    const rows: TodoRow[] = []
    const startWeek = (period - 1) * WEEKS_PER_MONTH + 1
    const endWeek = period * WEEKS_PER_MONTH
    for (let week = startWeek; week <= endWeek; week += 1) {
      rows.push(...(grouped.todoByWeek.get(week) ?? []))
    }
    return rows
  }

  const itemsForPendingPeriod = (
    period: number,
  ): Array<{ activity: ActivityState; week: number }> => {
    if (!useMonths) {
      return (grouped.pendingByWeek.get(period) ?? []).map((activity) => ({
        activity,
        week: period,
      }))
    }
    const items: Array<{ activity: ActivityState; week: number }> = []
    const startWeek = (period - 1) * WEEKS_PER_MONTH + 1
    const endWeek = period * WEEKS_PER_MONTH
    for (let week = startWeek; week <= endWeek; week += 1) {
      for (const activity of grouped.pendingByWeek.get(week) ?? []) {
        items.push({ activity, week })
      }
    }
    return items
  }

  const periodLabel = (period: number) =>
    useMonths ? `Month ${period}` : `Week ${period}`

  const firstActionableRow = useMemo<TodoRow | null>(() => {
    for (const week of sortedTodoWeeks) {
      const rows = grouped.todoByWeek.get(week) ?? []
      for (const row of rows) {
        const a = projectForWeek(row.activity)
        if (
          a.availability.state === 'available' &&
          (a.status === 'not_started' || a.status === 'rejected') &&
          !(a.approvalType === 'partner_issued' && !a.issuedByPartner)
        ) {
          return row
        }
      }
    }
    return null
  }, [sortedTodoWeeks, grouped.todoByWeek])

  const firstActionableActivityId = firstActionableRow?.activity.id ?? null

  const focusFirstActionableActivity = () => {
    if (!firstActionableActivityId) return
    const target = document.getElementById(`activity-${firstActionableActivityId}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<Bucket, boolean>>({
    todo: false,
    pending: false,
    done: true,
    locked: true,
  })
  const [collapsedTodoWeeks, setCollapsedTodoWeeks] = useState<Record<number, boolean>>({})
  const [collapsedPendingWeeks, setCollapsedPendingWeeks] = useState<Record<number, boolean>>({})

  const toggleSection = (bucket: Bucket) =>
    setCollapsedSections((prev) => ({ ...prev, [bucket]: !prev[bucket] }))

  const toggleTodoWeek = (week: number) =>
    setCollapsedTodoWeeks((prev) => ({ ...prev, [week]: !prev[week] }))

  const togglePendingWeek = (week: number) =>
    setCollapsedPendingWeeks((prev) => ({ ...prev, [week]: !prev[week] }))

  if (!visibleActivities?.length) {
    return (
      <Box
        bg="white"
        p={8}
        borderRadius="xl"
        boxShadow="0 2px 8px rgba(0,0,0,0.04)"
        position="relative"
        overflow="hidden"
      >
        <Center flexDirection="column" gap={3} position="relative" zIndex={1}>
          <Flex
            w={12}
            h={12}
            borderRadius="xl"
            bg="linear-gradient(135deg, #350e6f 0%, #27062e 100%)"
            align="center"
            justify="center"
            boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
          >
            <Icon as={PartyPopper} boxSize={6} color="white" />
          </Flex>
          <Heading size="sm" color="gray.800">
            You're all caught up
          </Heading>
          <Text color="gray.500" fontSize="sm" textAlign="center">
            New activities will unlock as each {periodNoun} opens. Come back soon.
          </Text>
        </Center>
      </Box>
    )
  }

  const renderFlatRow = (activity: ActivityState) => (
    <ActivityRow
      key={activity.id}
      activity={activity}
      selectedWeek={selectedWeek}
      currentWeek={currentWeek}
      isWeekLocked={isWeekLocked}
      isAdmin={isAdmin}
      isExpanded={expandedRowKey === activity.id}
      hasAvailableAlternative={Boolean(
        firstActionableActivityId &&
          firstActionableActivityId !== activity.id,
      )}
      onToggleExpand={() =>
        setExpandedRowKey((prev) => (prev === activity.id ? null : activity.id))
      }
      onOpenCurrentWeek={onOpenCurrentWeek}
      onFocusAvailableActivity={focusFirstActionableActivity}
      onMarkCompleted={onMarkCompleted}
      onOpenProof={onOpenProof}
      onRefreshLedger={onRefreshLedger}
      isActionInFlight={Boolean(isActivityBusy?.(activity.id))}
    />
  )

  const renderTodoSection = () => {
    // Ensure Week 1 / every month appears when programme cards belong there,
    // even if no other To-do rows are scheduled for that period yet.
    const monthCount =
      showProgrammeCardsUnderMonths && journeyType
        ? JOURNEY_MONTH_COUNTS[journeyType] ?? 0
        : 0
    const displayPeriodKeys = (() => {
      if (showProgrammeCardsUnderWeek1 && !sortedTodoPeriods.includes(1)) {
        return [1, ...sortedTodoPeriods]
      }
      if (showProgrammeCardsUnderMonths && monthCount > 0) {
        const keys = new Set(sortedTodoPeriods)
        for (let m = 1; m <= monthCount; m += 1) keys.add(m)
        return Array.from(keys).sort((a, b) => a - b)
      }
      return sortedTodoPeriods
    })()
    if (displayPeriodKeys.length === 0) return null
    const isCollapsed = collapsedSections.todo
    const visibleRowCount = displayPeriodKeys.reduce(
      (sum, period) => sum + rowsForTodoPeriod(period).length,
      0,
    )
    const programmeCardCount = showProgrammeCardsUnderWeek1
      ? 3
      : showProgrammeCardsUnderMonths
        ? displayPeriodKeys.filter((period) => Boolean(pillarForMonth(period))).length * 3
        : 0
    return (
      <Box key="todo">
        <Flex
          as="button"
          type="button"
          align="center"
          gap={2}
          w="100%"
          textAlign="left"
          px={4}
          py={2.5}
          bg="white"
          borderBottom={isCollapsed ? 'none' : '1px solid'}
          borderColor="gray.200"
          onClick={() => toggleSection('todo')}
          _hover={{ bg: 'gray.50' }}
          _focusVisible={{
            outline: '2px solid',
            outlineColor: '#350e6f',
            outlineOffset: '-2px',
          }}
        >
          <Icon
            as={isCollapsed ? ChevronRight : ChevronDown}
            boxSize={4}
            color="gray.500"
          />
          <Text fontSize="sm" fontWeight="semibold" color="gray.800">
            {SECTION_TITLES.todo}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {visibleRowCount + programmeCardCount}
          </Text>
          {todoSectionAvailablePoints > 0 && (
            <Text fontSize="xs" color="#350e6f" fontWeight="semibold" ml="auto">
              +{todoSectionAvailablePoints.toLocaleString()} pts available
            </Text>
          )}
        </Flex>

        <Collapse in={!isCollapsed} animateOpacity>
          <ColumnHeader />
          {displayPeriodKeys.map((period) => {
            const periodRows = rowsForTodoPeriod(period)
            const monthPillar = useMonths ? pillarForMonth(period) : null
            const showWeek1Cards = showProgrammeCardsUnderWeek1 && period === 1
            const showMonthCards =
              showProgrammeCardsUnderMonths && Boolean(monthPillar)
            const showCards = showWeek1Cards || showMonthCards
            if (periodRows.length === 0 && !showCards) return null
            const isPeriodCollapsed = Boolean(collapsedTodoWeeks[period])
            const periodPoints = periodRows
              .filter((row) => (row.rowKind ?? 'todo') === 'todo')
              .reduce((sum, row) => sum + rowAvailablePoints(row), 0)
            const isCurrent = period === currentPeriod
            const monthPassFail =
              showMonthCards && isProgrammePassFailMonth(period)
            return (
              <Box key={`todo-period-${period}`}>
                <Flex
                  as="button"
                  type="button"
                  align="center"
                  gap={2}
                  w="100%"
                  textAlign="left"
                  pl={10}
                  pr={4}
                  py={isCurrent ? 2.5 : 2}
                  bg={isCurrent ? '#f7f3fb' : 'gray.50'}
                  boxShadow={isCurrent ? 'inset 4px 0 0 #350e6f' : undefined}
                  borderTop="1px solid"
                  borderColor={isCurrent ? '#e8dcf4' : 'gray.100'}
                  onClick={() => toggleTodoWeek(period)}
                  _hover={{ bg: isCurrent ? '#f0e8f7' : 'gray.100' }}
                  _focusVisible={{
                    outline: '2px solid',
                    outlineColor: '#350e6f',
                    outlineOffset: '-2px',
                  }}
                >
                  <Icon
                    as={isPeriodCollapsed ? ChevronRight : ChevronDown}
                    boxSize={3.5}
                    color={isCurrent ? '#350e6f' : 'gray.500'}
                  />
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color={isCurrent ? '#350e6f' : 'gray.700'}
                    textTransform="uppercase"
                    letterSpacing="0.06em"
                  >
                    {periodLabel(period)}
                  </Text>
                  {isCurrent && (
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      color="white"
                      bg="#350e6f"
                      px={2}
                      py={0.5}
                      borderRadius="full"
                      textTransform="uppercase"
                      letterSpacing="0.04em"
                    >
                      Current
                    </Text>
                  )}
                  {monthPassFail && (
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      color="#350e6f"
                      bg="#f4f0fb"
                      px={2}
                      py={0.5}
                      borderRadius="full"
                      textTransform="uppercase"
                      letterSpacing="0.04em"
                    >
                      Pass / Fail
                    </Text>
                  )}
                  {periodPoints > 0 && (
                    <Text
                      fontSize="xs"
                      color="#350e6f"
                      fontWeight="semibold"
                      ml="auto"
                    >
                      +{periodPoints.toLocaleString()} pts
                    </Text>
                  )}
                </Flex>
                <Collapse in={!isPeriodCollapsed} animateOpacity>
                  {showWeek1Cards && (
                    <PillarProgrammeComponentsSection pillar={pillar} cardsOnly />
                  )}
                  {periodRows.map(
                    ({
                      activity,
                      weekOverride,
                      occurrence,
                      occurrenceNumber,
                      occurrenceTotal,
                      occurrenceDone,
                      rowKind,
                    }) => {
                      const kind = rowKind ?? 'todo'
                      const rowKey = `${activity.id}-week-${weekOverride}-${occurrence ?? 0}-${kind}`
                      const totalCap =
                        occurrenceTotal ?? activity.activityPolicy?.maxTotal ?? 1
                      const journeyCap = activity.activityPolicy?.maxTotal ?? 1
                      const fullyDone =
                        (typeof occurrenceDone === 'number'
                          ? occurrenceDone >= totalCap
                          : (activity.completedCount ?? 0) >= journeyCap) ||
                        activity.availability.state === 'permanently_exhausted'
                      const rowActivity =
                        kind === 'done'
                          ? {
                              ...activity,
                              // Only mark the activity fully completed at max
                              // occurrence (e.g. 3/3). A single week claim stays
                              // "done this week" without strikethrough.
                              status: fullyDone
                                ? ('completed' as const)
                                : ('not_started' as const),
                              hasInteracted: true,
                            }
                          : kind === 'pending'
                            ? {
                                ...projectForWeek(activity),
                                status: 'pending' as const,
                                hasInteracted: true,
                              }
                            : projectForWeek(activity)
                      const rowPillar =
                        useMonths &&
                        !showProgrammeCardsUnderMonths &&
                        PROGRAMME_COMPONENT_ACTIVITY_IDS.has(activity.id) &&
                        typeof occurrence === 'number'
                          ? pillarForMonth(occurrence)
                          : null
                      const rowPassFail =
                        useMonths &&
                        !showProgrammeCardsUnderMonths &&
                        PROGRAMME_COMPONENT_ACTIVITY_IDS.has(activity.id) &&
                        typeof occurrence === 'number' &&
                        isProgrammePassFailMonth(occurrence)
                      return (
                        <ActivityRow
                          key={rowKey}
                          activity={rowActivity}
                          selectedWeek={selectedWeek}
                          currentWeek={currentWeek}
                          isWeekLocked={isWeekLocked}
                          isAdmin={isAdmin}
                          isExpanded={expandedRowKey === rowKey}
                          hasAvailableAlternative={Boolean(
                            firstActionableActivityId &&
                              firstActionableActivityId !== activity.id,
                          )}
                          onToggleExpand={() =>
                            setExpandedRowKey((prev) =>
                              prev === rowKey ? null : rowKey,
                            )
                          }
                          onOpenCurrentWeek={onOpenCurrentWeek}
                          onFocusAvailableActivity={focusFirstActionableActivity}
                          onMarkCompleted={(a) =>
                            onMarkCompleted(
                              a,
                              weekOverride,
                              // First claim keeps the legacy ledger id (no claimRef).
                              // Later same-activity claims need a distinct ref.
                              occurrenceNumber != null && occurrenceNumber > 1
                                ? `occ-${occurrenceNumber}`
                                : undefined,
                            )
                          }
                          onOpenProof={(a) => onOpenProof(a, weekOverride)}
                          onRefreshLedger={onRefreshLedger}
                          occurrenceNumber={occurrenceNumber}
                          occurrenceTotal={Math.max(1, totalCap)}
                          occurrenceDone={occurrenceDone}
                          pendingCount={
                            typeof occurrenceDone === 'number'
                              ? 0
                              : pendingWeeksByActivity[activity.id]?.size ?? 0
                          }
                          weekClaimComplete={kind === 'done'}
                          programmePillar={rowPillar}
                          programmePassFail={rowPassFail}
                          isActionInFlight={Boolean(isActivityBusy?.(activity.id))}
                        />
                      )
                    },
                  )}
                  {/* 3M only: Capstone / Case Study / Practical as last activities each month */}
                  {showMonthCards && monthPillar && (
                    <PillarProgrammeComponentsSection
                      pillar={monthPillar}
                      cardsOnly
                      passFailMark={monthPassFail}
                    />
                  )}
                </Collapse>
              </Box>
            )
          })}
        </Collapse>
      </Box>
    )
  }

  const renderFlatSection = (bucket: 'locked', items: ActivityState[]) => {
    if (items.length === 0) return null
    const isCollapsed = collapsedSections[bucket]
    return (
      <Box key={bucket}>
        <Flex
          as="button"
          type="button"
          align="center"
          gap={2}
          w="100%"
          textAlign="left"
          px={4}
          py={2.5}
          bg="white"
          borderBottom={isCollapsed ? 'none' : '1px solid'}
          borderColor="gray.200"
          onClick={() => toggleSection(bucket)}
          _hover={{ bg: 'gray.50' }}
          _focusVisible={{
            outline: '2px solid',
            outlineColor: '#350e6f',
            outlineOffset: '-2px',
          }}
        >
          <Icon
            as={isCollapsed ? ChevronRight : ChevronDown}
            boxSize={4}
            color="gray.500"
          />
          <Text fontSize="sm" fontWeight="semibold" color="gray.800">
            {SECTION_TITLES[bucket]}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {items.length}
          </Text>
        </Flex>
        <Collapse in={!isCollapsed} animateOpacity>
          {items.map(renderFlatRow)}
        </Collapse>
      </Box>
    )
  }

  const renderPendingSection = () => {
    if (grouped.pendingTotalCount === 0) return null
    const isCollapsed = collapsedSections.pending
    return (
      <Box key="pending">
        <Flex
          as="button"
          type="button"
          align="center"
          gap={2}
          w="100%"
          textAlign="left"
          px={4}
          py={2.5}
          bg="white"
          borderBottom={isCollapsed ? 'none' : '1px solid'}
          borderColor="gray.200"
          onClick={() => toggleSection('pending')}
          _hover={{ bg: 'gray.50' }}
          _focusVisible={{
            outline: '2px solid',
            outlineColor: '#350e6f',
            outlineOffset: '-2px',
          }}
        >
          <Icon
            as={isCollapsed ? ChevronRight : ChevronDown}
            boxSize={4}
            color="gray.500"
          />
          <Text fontSize="sm" fontWeight="semibold" color="gray.800">
            {SECTION_TITLES.pending}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {grouped.pendingTotalCount}
          </Text>
          {grouped.pendingPointsTotal > 0 && (
            <Text fontSize="xs" color="#350e6f" fontWeight="semibold" ml="auto">
              +{grouped.pendingPointsTotal.toLocaleString()} pts pending
            </Text>
          )}
        </Flex>

        <Collapse in={!isCollapsed} animateOpacity>
          {sortedPendingPeriods.map((period) => {
            const periodItems = itemsForPendingPeriod(period)
            if (periodItems.length === 0) return null
            const isPeriodCollapsed = Boolean(collapsedPendingWeeks[period])
            const periodPoints = periodItems.reduce(
              (sum, { activity }) => sum + (activity.points ?? 0),
              0,
            )
            const isCurrent = period === currentPeriod
            return (
              <Box key={`pending-period-${period}`}>
                <Flex
                  as="button"
                  type="button"
                  align="center"
                  gap={2}
                  w="100%"
                  textAlign="left"
                  pl={10}
                  pr={4}
                  py={isCurrent ? 2.5 : 2}
                  bg={isCurrent ? '#f7f3fb' : 'gray.50'}
                  boxShadow={isCurrent ? 'inset 4px 0 0 #350e6f' : undefined}
                  borderTop="1px solid"
                  borderColor={isCurrent ? '#e8dcf4' : 'gray.100'}
                  onClick={() => togglePendingWeek(period)}
                  _hover={{ bg: isCurrent ? '#f0e8f7' : 'gray.100' }}
                  _focusVisible={{
                    outline: '2px solid',
                    outlineColor: '#350e6f',
                    outlineOffset: '-2px',
                  }}
                >
                  <Icon
                    as={isPeriodCollapsed ? ChevronRight : ChevronDown}
                    boxSize={3.5}
                    color={isCurrent ? '#350e6f' : 'gray.500'}
                  />
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color={isCurrent ? '#350e6f' : 'gray.700'}
                    textTransform="uppercase"
                    letterSpacing="0.06em"
                  >
                    {periodLabel(period)}
                  </Text>
                  {isCurrent && (
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      color="white"
                      bg="#350e6f"
                      px={2}
                      py={0.5}
                      borderRadius="full"
                      textTransform="uppercase"
                      letterSpacing="0.04em"
                    >
                      Current
                    </Text>
                  )}
                  {periodPoints > 0 && (
                    <Text
                      fontSize="xs"
                      color="#350e6f"
                      fontWeight="semibold"
                      ml="auto"
                    >
                      +{periodPoints.toLocaleString()} pts
                    </Text>
                  )}
                </Flex>
                <Collapse in={!isPeriodCollapsed} animateOpacity>
                  {periodItems.map(({ activity, week }, idx) => {
                    const rowKey = `${activity.id}-pending-period-${period}-${week}-${idx}`
                    const rowActivity: ActivityState = {
                      ...activity,
                      status: 'pending',
                      hasInteracted: true,
                    }
                    return (
                      <ActivityRow
                        key={rowKey}
                        activity={rowActivity}
                        selectedWeek={selectedWeek}
                        currentWeek={currentWeek}
                        isWeekLocked={isWeekLocked}
                        isAdmin={isAdmin}
                        isExpanded={expandedRowKey === rowKey}
                        hasAvailableAlternative={false}
                        onToggleExpand={() =>
                          setExpandedRowKey((prev) =>
                            prev === rowKey ? null : rowKey,
                          )
                        }
                        onOpenCurrentWeek={onOpenCurrentWeek}
                        onFocusAvailableActivity={focusFirstActionableActivity}
                        onMarkCompleted={(a) => onMarkCompleted(a, week)}
                        onOpenProof={(a) => onOpenProof(a, week)}
                        onRefreshLedger={onRefreshLedger}
                        isActionInFlight={Boolean(isActivityBusy?.(activity.id))}
                      />
                    )
                  })}
                </Collapse>
              </Box>
            )
          })}
        </Collapse>
      </Box>
    )
  }

  return (
    <Stack spacing={3}>
      <Flex justify="space-between" align="center" px={1}>
        <Stack spacing={0}>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wide"
            color="gray.500"
          >
            Your activities
          </Text>
          <HStack spacing={3}>
            <Heading size="sm" color="gray.800">
              {grouped.todoTotalCount} to complete
            </Heading>
            <Text fontSize="sm" color="gray.500">
              {grouped.pendingTotalCount > 0
                ? `· ${grouped.pendingTotalCount} in review `
                : ''}
              · {grouped.locked.length} coming up · {grouped.doneTotalCount} done
            </Text>
          </HStack>
        </Stack>
      </Flex>

      <Box
        bg="white"
        borderRadius="lg"
        border="1px solid"
        borderColor="gray.200"
        overflow="hidden"
        boxShadow="0 1px 3px rgba(0,0,0,0.03)"
      >
        {renderTodoSection()}
        {renderPendingSection()}
        {renderFlatSection('locked', grouped.locked)}
      </Box>
    </Stack>
  )
}
