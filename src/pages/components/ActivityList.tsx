import { useMemo } from 'react'
import { Center, Heading, Stack, Text } from '@chakra-ui/react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { getVisibleActivities } from '@/utils/activityStateManager'
import { WeeklyActivityCard } from './WeeklyActivityCard'

export const ActivityList = ({
  activities,
  selectedWeek,
  currentWeek,
  isWeekLocked,
  isAdmin,
  onOpenCurrentWeek,
  onMarkCompleted,
  onMarkNotStarted,
  onOpenProof,
  isActivityBusy,
}: {
  activities: ActivityState[]
  selectedWeek: number
  currentWeek: number
  isWeekLocked: boolean
  isAdmin: boolean
  onOpenCurrentWeek: () => void
  onMarkCompleted: (activity: ActivityState) => Promise<void>
  onMarkNotStarted: (activity: ActivityState) => Promise<void>
  onOpenProof: (activity: ActivityState) => void
  isActivityBusy?: (activityId: string) => boolean
}) => {
  const visibleActivities = useMemo(() => getVisibleActivities(activities), [activities])
  const firstActionableActivityId = useMemo(
    () =>
      visibleActivities.find(
        (activity) =>
          activity.availability.state === 'available' &&
          (activity.status === 'not_started' || activity.status === 'rejected') &&
          !(activity.approvalType === 'partner_issued' && !activity.issuedByPartner),
      )?.id ?? null,
    [visibleActivities],
  )

  const focusFirstActionableActivity = () => {
    if (!firstActionableActivityId) return
    const target = document.getElementById(`activity-${firstActionableActivityId}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <Stack spacing={4}>
      <Heading size="sm">Current activities</Heading>

      {!visibleActivities?.length ? (
        <Center py={8}>
          <Text color="text.muted">You are caught up for now. New activities unlock as each journey week opens.</Text>
        </Center>
      ) : (
        <Stack spacing={3}>
          {visibleActivities.filter(a => a?.id).map(activity => (
            <WeeklyActivityCard
              key={activity.id}
              activity={activity}
              selectedWeek={selectedWeek}
              currentWeek={currentWeek}
              isWeekLocked={isWeekLocked}
              isAdmin={isAdmin}
              onOpenCurrentWeek={onOpenCurrentWeek}
              onFocusAvailableActivity={focusFirstActionableActivity}
              hasAvailableAlternative={Boolean(firstActionableActivityId && firstActionableActivityId !== activity.id)}
              onMarkCompleted={onMarkCompleted}
              onMarkNotStarted={onMarkNotStarted}
              onOpenProof={onOpenProof}
              isActionInFlight={Boolean(isActivityBusy?.(activity.id))}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
