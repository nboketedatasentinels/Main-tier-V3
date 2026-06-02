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
import { getVisibleActivities } from '@/utils/activityStateManager'
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'
import { useUserPillar } from '@/hooks/useUserPillar'
import {
  PILLAR_PROGRAMME_COMPONENTS,
  type ProgrammeComponentPart,
  type ProgrammeComponentType,
} from '@/config/pillarProgrammeComponents'
import { ActivityRow } from './ActivityRow'

type TodoRow = { activity: ActivityState; weekOverride: number }

type Bucket = 'todo' | 'pending' | 'done' | 'locked'

const projectForWeek = (activity: ActivityState): ActivityState => {
  // Each per-week duplicate is, by construction, a week the activity has not
  // been completed in yet. Strip the global completion flags that the VM sets
  // off the activity-id (status from selectedWeek, hasInteracted from the
  // optimistic mutation) so the row renders as actionable in its own week.
  // Also clear the 7-day client-side cooldown and "next_window" lock - those
  // were per-completion gates from the old single-week view; in the new
  // week-grouped model the per-week filter already enforces "not yet done
  // in this specific week / window".
  let next: ActivityState = activity
  if (activity.status === 'completed' || activity.hasInteracted) {
    next = { ...next, status: 'not_started', hasInteracted: false }
  }
  const reason = activity.availability.reason
  const isTransientLock =
    activity.availability.state === 'next_window' ||
    reason === 'weekly_cooldown' ||
    reason === 'window_cap_reached'
  if (isTransientLock) {
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

/**
 * Full points still claimable for an activity = per-claim points x remaining
 * claims. With one row per activity we surface this aggregate (e.g. a 6x3,000
 * weekly session = "up to 18,000 pts") so the section totals still add up to
 * the journey max instead of just one claim each.
 */
const remainingValue = (activity: ActivityState): number => {
  const cap = activity.activityPolicy?.maxTotal
  const total = typeof cap === 'number' && Number.isFinite(cap) ? cap : 1
  const remaining = Math.max(0, total - (activity.completedCount ?? 0))
  return (activity.points ?? 0) * remaining
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
  completedWeeksByActivity: Record<string, Set<number>>
  pendingWeeksByActivity: Record<string, Set<number>>
  isWeekLocked: boolean
  isAdmin: boolean
  onOpenCurrentWeek: () => void
  onMarkCompleted: (activity: ActivityState, weekOverride?: number) => Promise<void>
  onMarkNotStarted: (activity: ActivityState) => Promise<void>
  onOpenProof: (activity: ActivityState) => void
  isActivityBusy?: (activityId: string) => boolean
}

const ColumnHeader = () => (
  <Grid
    templateColumns="20px minmax(0,1fr) 70px 130px 116px 16px"
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
  completedWeeksByActivity,
  pendingWeeksByActivity,
  isWeekLocked,
  isAdmin,
  onOpenCurrentWeek,
  onMarkCompleted,
  onOpenProof,
  isActivityBusy,
}: ActivityListProps) => {
  // Resolved once here (one org-doc listener) and threaded to every row, so the
  // Peer to Peer / Capstone / Case Study rows can show their parts inline on the
  // weekly checklist. Keyed by the matching checklist activity id.
  const { pillar } = useUserPillar()
  const programmePartsByActivity = useMemo<Record<string, ProgrammeComponentPart[] | null>>(() => {
    const entries = pillar ? PILLAR_PROGRAMME_COMPONENTS[pillar] ?? [] : []
    const byType: Partial<Record<ProgrammeComponentType, ProgrammeComponentPart[]>> = {}
    entries.forEach((e) => {
      if (e.parts && e.parts.length > 0) byType[e.type] = e.parts
    })
    return {
      peer_to_peer: byType.practical ?? null,
      capstone: byType.capstone ?? null,
      case_study: byType.case_study ?? null,
    }
  }, [pillar])

  const visibleActivities = useMemo(() => getVisibleActivities(activities), [activities])

  const ordered = useMemo(
    () => visibleActivities.filter((activity) => activity?.id),
    [visibleActivities],
  )

  const grouped = useMemo(() => {
    const todoByWeek = new Map<number, TodoRow[]>()
    const doneByWeek = new Map<number, ActivityState[]>()
    const pendingByWeek = new Map<number, ActivityState[]>()
    const locked: ActivityState[] = []
    let todoTotalCount = 0
    let todoPointsTotal = 0
    let doneTotalCount = 0
    let donePointsTotal = 0
    let pendingTotalCount = 0
    let pendingPointsTotal = 0

    const totalWeeks = Math.max(1, programDurationWeeks)

    const pushDone = (week: number, activity: ActivityState) => {
      const list = doneByWeek.get(week) ?? []
      list.push(activity)
      doneByWeek.set(week, list)
      doneTotalCount += 1
      donePointsTotal += activity.points ?? 0
    }

    const pushPending = (week: number, activity: ActivityState) => {
      const list = pendingByWeek.get(week) ?? []
      list.push(activity)
      pendingByWeek.set(week, list)
      pendingTotalCount += 1
      pendingPointsTotal += activity.points ?? 0
    }

    ordered.forEach((activity) => {
      const startWeek = Math.max(1, activity.week ?? 1)
      const isRecurring = isRecurringActivity(activity)
      const completedWeeks =
        completedWeeksByActivity[activity.id] ?? new Set<number>()
      const pendingWeeks =
        pendingWeeksByActivity[activity.id] ?? new Set<number>()

      // Every recorded completion goes into Done under its actual weekNumber.
      // This works the same for one-time and recurring activities - the source
      // of truth is the canonical pointsLedger entries.
      completedWeeks.forEach((cw) => pushDone(cw, activity))

      // Every pending submission goes into the In Review bucket under its
      // submitted weekNumber. Source of truth: points_verification_requests.
      pendingWeeks.forEach((pw) => {
        // Don't double-bucket if the request was actually approved and the
        // ledger already has an entry for that week.
        if (completedWeeks.has(pw)) return
        pushPending(pw, activity)
      })

      if (!isRecurring) {
        // One-time activities (policy type 'one_time'). Cap is usually 1, but
        // some - like Case Study - allow a small number of claims
        // (maxTotal > 1). Use the ledger count vs the cap to decide "fully
        // done", NOT the per-selectedWeek `status === 'completed'` flag (which
        // would prematurely move a half-done multi-claim activity to Done).
        const totalDone = activity.completedCount ?? 0
        const totalCap = activity.activityPolicy?.maxTotal ?? 1
        const isFullyDone =
          totalDone >= totalCap ||
          activity.availability.state === 'permanently_exhausted'
        if (isFullyDone) {
          // Fallback: if completions exist but no ledger weekNumber resolved,
          // surface under the catalog week so it does not vanish from Done.
          if (completedWeeks.size === 0) pushDone(startWeek, activity)
          return
        }
        // Anything currently in review must NOT appear in To-do. The In Review
        // bucket either already has rows (from pendingWeeks.forEach above) or
        // we fall back to surfacing one under the catalog week so the learner
        // still sees what they're waiting on.
        if (pendingWeeks.size > 0 || activity.status === 'pending') {
          if (pendingWeeks.size === 0) pushPending(startWeek, activity)
          return
        }
        // Show one To-do row at the catalog week. For one-time-with-cap-not-hit
        // (e.g. case_study after the first claim), `availability.state` stays
        // 'available' because the policy isn't exhausted, so this branch fires.
        const isTodo =
          activity.status === 'rejected' ||
          activity.availability.state === 'available'
        if (isTodo) {
          const list = todoByWeek.get(startWeek) ?? []
          list.push({ activity, weekOverride: startWeek })
          todoByWeek.set(startWeek, list)
          todoTotalCount += 1
          todoPointsTotal += remainingValue(activity)
          return
        }
        locked.push(activity)
        return
      }

      // Recurring activity (window_limited or ongoing).
      const totalDone = activity.completedCount ?? 0
      const totalCap = activity.activityPolicy?.maxTotal ?? Infinity
      const isPermExhausted =
        activity.availability.state === 'permanently_exhausted' ||
        totalDone >= totalCap
      if (isPermExhausted) {
        // Fully consumed; no more To-do rows. Done rows were already pushed
        // above from completedWeeks.
        return
      }

      // Race-window guard: an optimistic submit flips status='pending' before
      // the pending-requests listener resolves the per-week mapping. During
      // that gap, fall back to a single In Review row at the catalog week
      // and skip distributing the activity across To-do entirely - never let
      // a re-submit reach the learner while a request is in review.
      if (activity.status === 'pending' && pendingWeeks.size === 0) {
        pushPending(startWeek, activity)
        return
      }

      // Genuine locks (mentor missing, schedule, cooldownWeeks) keep the
      // activity in "Coming up". A 7-day post-claim cooldown is not a genuine
      // block here - we let the per-week duplicates surface as actionable in
      // future weeks the user hasn't claimed yet.
      if (
        activity.availability.state === 'locked' &&
        activity.availability.reason !== 'weekly_cooldown'
      ) {
        locked.push(activity)
        return
      }

      const policyType = activity.activityPolicy?.type
      const maxPerWindow = activity.activityPolicy?.maxPerWindow ?? null
      const maxPerWeek = activity.activityPolicy?.maxPerWeek ?? null

      // Cache window-completion counts so we filter per-window correctly.
      const completionsByWindow = new Map<number, number>()
      completedWeeks.forEach((cw) => {
        const win = getWindowNumber(cw, PARALLEL_WINDOW_SIZE_WEEKS)
        completionsByWindow.set(win, (completionsByWindow.get(win) ?? 0) + 1)
      })

      for (let w = startWeek; w <= totalWeeks; w++) {
        if (completedWeeks.has(w)) continue
        // A pending submission already owns this week - it lives in the
        // In Review bucket, not To-do. Avoid offering a re-submit.
        if (pendingWeeks.has(w)) continue
        if (maxPerWeek !== null) {
          // Already at per-week cap for this specific week.
          const inWeek = completedWeeks.has(w) ? 1 : 0
          if (inWeek >= maxPerWeek) continue
        }
        if (policyType === 'window_limited' && maxPerWindow !== null) {
          const win = getWindowNumber(w, PARALLEL_WINDOW_SIZE_WEEKS)
          if ((completionsByWindow.get(win) ?? 0) >= maxPerWindow) continue
        }
        const list = todoByWeek.get(w) ?? []
        list.push({ activity, weekOverride: w })
        todoByWeek.set(w, list)
        todoTotalCount += 1
        todoPointsTotal += remainingValue(activity)
        // One row per activity: surface only the next claimable instance, not a
        // duplicate row for every remaining week.
        break
      }
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
    pendingWeeksByActivity,
    programDurationWeeks,
  ])

  const sortedTodoWeeks = useMemo(
    () => Array.from(grouped.todoByWeek.keys()).sort((a, b) => a - b),
    [grouped.todoByWeek],
  )

  const sortedDoneWeeks = useMemo(
    () => Array.from(grouped.doneByWeek.keys()).sort((a, b) => a - b),
    [grouped.doneByWeek],
  )

  const sortedPendingWeeks = useMemo(
    () => Array.from(grouped.pendingByWeek.keys()).sort((a, b) => a - b),
    [grouped.pendingByWeek],
  )

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
  const [collapsedDoneWeeks, setCollapsedDoneWeeks] = useState<Record<number, boolean>>({})

  const toggleSection = (bucket: Bucket) =>
    setCollapsedSections((prev) => ({ ...prev, [bucket]: !prev[bucket] }))

  const toggleTodoWeek = (week: number) =>
    setCollapsedTodoWeeks((prev) => ({ ...prev, [week]: !prev[week] }))

  const togglePendingWeek = (week: number) =>
    setCollapsedPendingWeeks((prev) => ({ ...prev, [week]: !prev[week] }))

  const toggleDoneWeek = (week: number) =>
    setCollapsedDoneWeeks((prev) => ({ ...prev, [week]: !prev[week] }))

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
            New activities will unlock as each week opens. Come back soon.
          </Text>
        </Center>
      </Box>
    )
  }

  const renderFlatRow = (activity: ActivityState) => (
    <ActivityRow
      key={activity.id}
      activity={activity}
      programmeParts={programmePartsByActivity[activity.id] ?? null}
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
      isActionInFlight={Boolean(isActivityBusy?.(activity.id))}
    />
  )

  const renderTodoSection = () => {
    if (grouped.todoTotalCount === 0) return null
    const isCollapsed = collapsedSections.todo
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
            {grouped.todoTotalCount}
          </Text>
          {grouped.todoPointsTotal > 0 && (
            <Text fontSize="xs" color="#350e6f" fontWeight="semibold" ml="auto">
              +{grouped.todoPointsTotal.toLocaleString()} pts available
            </Text>
          )}
        </Flex>

        <Collapse in={!isCollapsed} animateOpacity>
          <ColumnHeader />
          {sortedTodoWeeks.map((week) => {
            const weekRows = grouped.todoByWeek.get(week) ?? []
            if (weekRows.length === 0) return null
            const isWeekCollapsed = Boolean(collapsedTodoWeeks[week])
            const weekPoints = weekRows.reduce(
              (sum, r) => sum + remainingValue(r.activity),
              0,
            )
            const isCurrent = week === currentWeek
            return (
              <Box key={`todo-week-${week}`}>
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
                  onClick={() => toggleTodoWeek(week)}
                  _hover={{ bg: isCurrent ? '#f0e8f7' : 'gray.100' }}
                  _focusVisible={{
                    outline: '2px solid',
                    outlineColor: '#350e6f',
                    outlineOffset: '-2px',
                  }}
                >
                  <Icon
                    as={isWeekCollapsed ? ChevronRight : ChevronDown}
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
                    Week {week}
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
                  <Text fontSize="xs" color={isCurrent ? '#350e6f' : 'gray.500'}>
                    {weekRows.length}
                  </Text>
                  {weekPoints > 0 && (
                    <Text
                      fontSize="xs"
                      color="#350e6f"
                      fontWeight="semibold"
                      ml="auto"
                    >
                      +{weekPoints.toLocaleString()} pts
                    </Text>
                  )}
                </Flex>
                <Collapse in={!isWeekCollapsed} animateOpacity>
                  {weekRows.map(({ activity, weekOverride }) => {
                    const rowKey = `${activity.id}-week-${weekOverride}`
                    const rowActivity = projectForWeek(activity)
                    return (
                      <ActivityRow
                        key={rowKey}
                        activity={rowActivity}
                        programmeParts={programmePartsByActivity[rowActivity.id] ?? null}
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
                        onMarkCompleted={(a) => onMarkCompleted(a, weekOverride)}
                        onOpenProof={onOpenProof}
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
          {sortedPendingWeeks.map((week) => {
            const weekItems = grouped.pendingByWeek.get(week) ?? []
            if (weekItems.length === 0) return null
            const isWeekCollapsed = Boolean(collapsedPendingWeeks[week])
            const weekPoints = weekItems.reduce(
              (sum, a) => sum + (a.points ?? 0),
              0,
            )
            const isCurrent = week === currentWeek
            return (
              <Box key={`pending-week-${week}`}>
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
                  onClick={() => togglePendingWeek(week)}
                  _hover={{ bg: isCurrent ? '#f0e8f7' : 'gray.100' }}
                  _focusVisible={{
                    outline: '2px solid',
                    outlineColor: '#350e6f',
                    outlineOffset: '-2px',
                  }}
                >
                  <Icon
                    as={isWeekCollapsed ? ChevronRight : ChevronDown}
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
                    Week {week}
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
                  <Text fontSize="xs" color={isCurrent ? '#350e6f' : 'gray.500'}>
                    {weekItems.length}
                  </Text>
                  {weekPoints > 0 && (
                    <Text
                      fontSize="xs"
                      color="#350e6f"
                      fontWeight="semibold"
                      ml="auto"
                    >
                      +{weekPoints.toLocaleString()} pts
                    </Text>
                  )}
                </Flex>
                <Collapse in={!isWeekCollapsed} animateOpacity>
                  {weekItems.map((activity, idx) => {
                    const rowKey = `${activity.id}-pending-week-${week}-${idx}`
                    const rowActivity: ActivityState = {
                      ...activity,
                      status: 'pending',
                      hasInteracted: true,
                    }
                    return (
                      <ActivityRow
                        key={rowKey}
                        activity={rowActivity}
                        programmeParts={programmePartsByActivity[rowActivity.id] ?? null}
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
                        onOpenProof={onOpenProof}
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

  const renderDoneSection = () => {
    if (grouped.doneTotalCount === 0) return null
    const isCollapsed = collapsedSections.done
    return (
      <Box key="done">
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
          onClick={() => toggleSection('done')}
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
            {SECTION_TITLES.done}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {grouped.doneTotalCount}
          </Text>
          {grouped.donePointsTotal > 0 && (
            <Text fontSize="xs" color="#eab130" fontWeight="semibold" ml="auto">
              +{grouped.donePointsTotal.toLocaleString()} pts earned
            </Text>
          )}
        </Flex>

        <Collapse in={!isCollapsed} animateOpacity>
          {sortedDoneWeeks.map((week) => {
            const weekItems = grouped.doneByWeek.get(week) ?? []
            if (weekItems.length === 0) return null
            const isWeekCollapsed = Boolean(collapsedDoneWeeks[week])
            const weekPoints = weekItems.reduce(
              (sum, a) => sum + (a.points ?? 0),
              0,
            )
            const isCurrent = week === currentWeek
            return (
              <Box key={`done-week-${week}`}>
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
                  onClick={() => toggleDoneWeek(week)}
                  _hover={{ bg: isCurrent ? '#f0e8f7' : 'gray.100' }}
                  _focusVisible={{
                    outline: '2px solid',
                    outlineColor: '#350e6f',
                    outlineOffset: '-2px',
                  }}
                >
                  <Icon
                    as={isWeekCollapsed ? ChevronRight : ChevronDown}
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
                    Week {week}
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
                  <Text fontSize="xs" color={isCurrent ? '#350e6f' : 'gray.500'}>
                    {weekItems.length}
                  </Text>
                  {weekPoints > 0 && (
                    <Text
                      fontSize="xs"
                      color="#eab130"
                      fontWeight="semibold"
                      ml="auto"
                    >
                      +{weekPoints.toLocaleString()} pts
                    </Text>
                  )}
                </Flex>
                <Collapse in={!isWeekCollapsed} animateOpacity>
                  {weekItems.map((activity, idx) => {
                    const rowKey = `${activity.id}-done-week-${week}-${idx}`
                    const rowActivity: ActivityState = {
                      ...activity,
                      status: 'completed',
                      hasInteracted: false,
                    }
                    return (
                      <ActivityRow
                        key={rowKey}
                        activity={rowActivity}
                        programmeParts={programmePartsByActivity[rowActivity.id] ?? null}
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
                        onOpenProof={onOpenProof}
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
        {renderDoneSection()}
      </Box>
    </Stack>
  )
}
