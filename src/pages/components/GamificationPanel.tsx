import { useMemo } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Heading,
  Progress,
  Stack,
  Text,
} from '@chakra-ui/react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'

export const GamificationPanel = ({
  activities,
}: {
  activities: ActivityState[]
}) => {
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

  const progressPct = useMemo(() => {
    if (activities.length === 0) return 0
    const completed = activities.filter((a) => a.status === 'completed').length
    return Math.round((completed / activities.length) * 100)
  }, [activities])

  const progressStatus = useMemo(() => {
    if (progressPct >= 100) return { color: 'green', label: 'On Track' }
    if (progressPct >= 75) return { color: 'yellow', label: 'Warning' }
    return { color: 'red', label: 'Alert' }
  }, [progressPct])

  const scrollToActivity = () => {
    const target = firstActionableActivity ?? firstIncompleteActivity
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
              {firstActionableActivity
                ? 'Focus on your next available activity.'
                : 'No activities are claimable right now. Review lock reasons and next-window timing.'}
            </Text>
            <Text color="text.secondary" fontSize="sm">
              {firstActionableActivity
                ? 'Keep your streak alive by acting in the next 24 hours.'
                : 'Use this time to prepare proof and queue your next action.'}
            </Text>
          </Stack>
        </Alert>
        <Button colorScheme="primary" onClick={scrollToActivity} isDisabled={!firstActionableActivity && !firstIncompleteActivity}>
          {firstActionableActivity
            ? `Complete ${firstActionableActivity.title}`
            : firstIncompleteActivity
              ? `Review ${firstIncompleteActivity.title}`
              : 'All activities done'}
        </Button>
        <Stack spacing={1} color="text.secondary">
          <Text fontWeight="bold">Streak tracker</Text>
          <Progress value={progressPct} colorScheme={progressStatus.color} borderRadius="full" />
          <Text fontSize="sm" color="text.muted">Maintain daily check-ins to grow your streak.</Text>
        </Stack>
      </Stack>
    </Box>
  )
}
