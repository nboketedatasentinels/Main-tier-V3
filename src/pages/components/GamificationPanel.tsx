import { useMemo } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Heading,
  Stack,
  Text,
} from '@chakra-ui/react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'

export const GamificationPanel = ({
  activities,
}: {
  activities: ActivityState[]
}) => {
  const firstCompletedActivity = useMemo(
    () => activities.find((activity) => activity.status === 'completed'),
    [activities],
  )

  const firstActionableActivity = useMemo(
    () =>
      activities.find(
        (activity) =>
          activity.availability.state === 'available' &&
          (activity.status === 'not_started' || activity.status === 'rejected'),
      ),
    [activities],
  )

  const firstIncompleteActivity = useMemo(
    () => activities.find((activity) => activity.status !== 'completed'),
    [activities],
  )

  const hasCompletedAll = useMemo(
    () => activities.length > 0 && firstIncompleteActivity == null,
    [activities.length, firstIncompleteActivity],
  )

  const scrollToActivity = () => {
    const target = firstActionableActivity ?? firstIncompleteActivity ?? firstCompletedActivity
    if (target?.id) {
      const el = document.getElementById(`activity-${target.id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  return (
    <Box borderWidth="1px" borderColor="border.card" p={4} borderRadius="lg" bg="surface.default">
      <Heading size="sm" color="text.primary" mb={3}>
        Workflow Gamification
      </Heading>
      <Stack spacing={3}>
        <Alert status="info" variant="subtle" borderRadius="md">
          <AlertIcon />
          <Stack spacing={1}>
            <Text color="text.secondary">
              {hasCompletedAll
                ? 'Week complete. Nice execution.'
                : firstActionableActivity
                  ? 'Nice momentum. Your next available activity is ready.'
                  : firstIncompleteActivity
                    ? 'You are between unlock windows right now.'
                    : 'Your next activities will appear as this journey updates.'}
            </Text>
            <Text color="text.secondary" fontSize="sm">
              {hasCompletedAll
                ? 'Take a breath and celebrate this checkpoint.'
                : firstActionableActivity
                  ? 'Finish it now to keep momentum rolling.'
                  : firstIncompleteActivity
                    ? 'Use this time to prepare proof and queue your next move.'
                    : 'Check back soon for new options.'}
            </Text>
          </Stack>
        </Alert>
        <Button colorScheme="primary" onClick={scrollToActivity} isDisabled={!firstActionableActivity && !firstIncompleteActivity && !firstCompletedActivity}>
          {firstActionableActivity
            ? `Continue with ${firstActionableActivity.title}`
            : firstIncompleteActivity
              ? `Preview ${firstIncompleteActivity.title}`
              : hasCompletedAll
                ? 'Celebrate this win'
                : 'No activities yet'}
        </Button>
      </Stack>
    </Box>
  )
}
