import { useMemo } from 'react'
import { Center, Heading, Stack, Text } from '@chakra-ui/react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { getVisibleActivities } from '@/utils/activityStateManager'
import { WeeklyActivityCard } from './WeeklyActivityCard'

export const ActivityList = ({
  activities,
  selectedWeek,
  isWeekLocked,
  isAdmin,
  onMarkCompleted,
  onMarkNotStarted,
  onOpenProof,
}: {
  activities: ActivityState[]
  selectedWeek: number
  isWeekLocked: boolean
  isAdmin: boolean
  onMarkCompleted: (activity: ActivityState) => Promise<void>
  onMarkNotStarted: (activity: ActivityState) => Promise<void>
  onOpenProof: (activity: ActivityState) => void
}) => {
  const visibleActivities = useMemo(() => getVisibleActivities(activities), [activities])

  return (
    <Stack spacing={4}>
      <Heading size="sm">Weekly activities</Heading>

      {!visibleActivities?.length ? (
        <Center py={8}>
          <Text color="text.muted">No activities available for this week.</Text>
        </Center>
      ) : (
        <Stack spacing={3}>
          {visibleActivities.filter(a => a?.id).map(activity => (
            <WeeklyActivityCard
              key={activity.id}
              activity={activity}
              selectedWeek={selectedWeek}
              isWeekLocked={isWeekLocked}
              isAdmin={isAdmin}
              onMarkCompleted={onMarkCompleted}
              onMarkNotStarted={onMarkNotStarted}
              onOpenProof={onOpenProof}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
