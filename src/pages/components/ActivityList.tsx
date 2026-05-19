import { useMemo } from 'react'
import {
  Box,
  Center,
  Flex,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react'
import { PartyPopper, Sparkles } from 'lucide-react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { getVisibleActivities } from '@/utils/activityStateManager'
import { WeeklyActivityCard } from './WeeklyActivityCard'

const isCompleted = (activity: ActivityState): boolean =>
  activity.status === 'completed' ||
  activity.availability.state === 'permanently_exhausted'

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

  const ordered = useMemo(
    () => visibleActivities.filter((activity) => activity?.id),
    [visibleActivities],
  )

  const firstActionableActivityId =
    ordered.find(
      (a) =>
        a.availability.state === 'available' &&
        (a.status === 'not_started' || a.status === 'rejected') &&
        !(a.approvalType === 'partner_issued' && !a.issuedByPartner),
    )?.id ?? null

  const todoCount = ordered.filter((a) => !isCompleted(a)).length
  const todoPointsTotal = ordered
    .filter((a) => !isCompleted(a))
    .reduce((sum, a) => sum + (a.points ?? 0), 0)

  const focusFirstActionableActivity = () => {
    if (!firstActionableActivityId) return
    const target = document.getElementById(`activity-${firstActionableActivityId}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

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
        <Box position="absolute" top={0} right={0} w="90px" h="90px" bg="yellow.50" borderRadius="0 0 0 100%" />
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
          <Heading size="sm" color="gray.800">You're all caught up</Heading>
          <Text color="gray.500" fontSize="sm" textAlign="center">
            New activities will unlock as each week opens. Come back soon.
          </Text>
        </Center>
      </Box>
    )
  }

  return (
    <Stack spacing={6}>
      {/* Activities in their curated journey order */}
      <Stack spacing={3}>
        <Flex justify="space-between" align="center">
          <HStack spacing={3} align="center">
            <Flex
              w={9}
              h={9}
              borderRadius="lg"
              bg="linear-gradient(135deg, #350e6f 0%, #27062e 100%)"
              align="center"
              justify="center"
              boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
            >
              <Icon as={Sparkles} boxSize={4} color="white" />
            </Flex>
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
              <Heading size="sm" color="gray.800">
                {todoCount} of {ordered.length} to complete
              </Heading>
            </Stack>
          </HStack>
          {todoCount > 0 && (
            <Box
              px={3}
              py={1}
              bg="yellow.50"
              border="1px solid"
              borderColor="yellow.200"
              borderRadius="full"
              fontSize="xs"
              fontWeight="semibold"
              color="#b45309"
            >
              +{todoPointsTotal.toLocaleString()} pts available
            </Box>
          )}
        </Flex>

        <Stack spacing={3}>
          {ordered.map((activity) => (
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
      </Stack>

    </Stack>
  )
}
