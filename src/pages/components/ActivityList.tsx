import { useMemo } from 'react'
import { Center, Heading, Stack, Text } from '@chakra-ui/react'
import type { ActivityState, JourneyConfig } from '@/hooks/useWeeklyChecklistViewModel'
import { getVisibleActivities } from '@/utils/activityStateManager'
import { WeeklyActivityCard } from './WeeklyActivityCard'

export const ActivityList = ({
  activities,
  journey,
  isWeekLocked,
  isAdmin,
  onMarkCompleted,
  onMarkNotStarted,
  onOpenProof,
}: {
  activities: ActivityState[]
  journey: JourneyConfig | null
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
              journey={journey}
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
