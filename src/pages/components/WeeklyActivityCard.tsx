import { Badge, Box, Button, HStack, Heading, Icon, Stack, Tag, Text, Tooltip } from '@chakra-ui/react'
import { AlertTriangle, Lock, ShieldCheck, CheckCircle } from 'lucide-react'
import type { ActivityState, JourneyConfig } from '@/hooks/useWeeklyChecklistViewModel'

const statusLabel: Record<ActivityState['status'], string> = {
  not_started: 'Not started',
  pending: 'Pending',
  completed: 'Completed',
}

export const WeeklyActivityCard = ({
  activity,
  journey,
  isWeekLocked,
  isAdmin,
  onMarkCompleted,
  onMarkNotStarted,
  onOpenProof,
}: {
  activity: ActivityState
  journey: JourneyConfig | null
  isWeekLocked: boolean
  isAdmin: boolean
  onMarkCompleted: (activity: ActivityState) => Promise<void>
  onMarkNotStarted: (activity: ActivityState) => Promise<void>
  onOpenProof: (activity: ActivityState) => void
}) => {
  const isPaid = Boolean(journey?.isPaid)
  const requiresPartnerApproval = Boolean(isPaid && activity.requiresApproval)

  const lockedByWeek = isWeekLocked && !isAdmin
  const lockedByAvailability = activity.availability.state !== 'available' && !isAdmin
  const lockedByInteraction = Boolean(activity.hasInteracted) && !isAdmin

  const disabled = lockedByWeek || lockedByAvailability || lockedByInteraction

  const showLockReason = () => {
    if (isAdmin) return null
    if (lockedByWeek) return 'This week is locked (future week).'
    if (lockedByInteraction) return 'Selection locked. Contact support to change.'
    if (lockedByAvailability) return 'This activity is locked or exhausted right now.'
    return null
  }

  const lockReason = showLockReason()

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} id={`activity-${activity.id}`}>
      <HStack justify="space-between" align="flex-start">
        <Stack spacing={1}>
          <HStack spacing={2}>
            <Badge>{statusLabel[activity.status]}</Badge>

            {requiresPartnerApproval ? (
              <Tooltip label="Partner approval required. Submit proof for verification.">
                <Badge colorScheme="purple">Partner approval</Badge>
              </Tooltip>
            ) : (
              <Tooltip label="Self-verified (honor based)">
                <Badge colorScheme="green">Self-verified</Badge>
              </Tooltip>
            )}

            {activity.availability.state !== 'available' ? <Badge colorScheme="orange">Locked</Badge> : null}
            <Tag>+{activity.points} pts</Tag>
          </HStack>

          <HStack spacing={2}>
            <Heading size="sm">{activity.title}</Heading>
            {requiresPartnerApproval ? (
              <Icon as={ShieldCheck} />
            ) : (
              <Icon as={CheckCircle} />
            )}
          </HStack>

          <Text fontSize="sm" color="gray.500">
            {activity.description}
          </Text>

          {lockReason ? (
            <HStack spacing={2}>
              <Icon as={Lock} />
              <Text fontSize="sm" color="gray.500">
                {lockReason}
              </Text>
            </HStack>
          ) : null}

          {activity.status === 'pending' ? (
            <HStack spacing={2}>
              <Icon as={AlertTriangle} />
              <Text fontSize="sm" color="gray.500">
                Pending verification. Points post after approval.
              </Text>
            </HStack>
          ) : null}
        </Stack>

        {isAdmin ? <Badge colorScheme="red">Admin override</Badge> : null}
      </HStack>

      <Stack direction="row" spacing={3} mt={4}>
        {requiresPartnerApproval ? (
          <Button
            colorScheme="purple"
            variant={activity.status === 'pending' || activity.status === 'completed' ? 'solid' : 'outline'}
            isDisabled={disabled || activity.status === 'completed'}
            onClick={() => onOpenProof(activity)}
          >
            Submit proof
          </Button>
        ) : (
          <Button
            colorScheme="green"
            variant={activity.status === 'completed' ? 'solid' : 'outline'}
            isDisabled={disabled || activity.status === 'completed'}
            onClick={() => onMarkCompleted(activity)}
          >
            Yes
          </Button>
        )}

        <Button
          variant="outline"
          isDisabled={(!isAdmin && activity.hasInteracted) || lockedByWeek}
          onClick={() => onMarkNotStarted(activity)}
        >
          No / Reset
        </Button>
      </Stack>
    </Box>
  )
}
