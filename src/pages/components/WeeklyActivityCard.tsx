import { Badge, Box, Button, HStack, Heading, Icon, Stack, Tag, Text, Tooltip } from '@chakra-ui/react'
import { AlertTriangle, CalendarClock, CheckCircle, Circle, Infinity, Lock, RotateCcw, ShieldCheck, Zap } from 'lucide-react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { getNextWindowAvailabilityMessage } from '@/utils/activityStateManager'
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'

const statusLabel: Record<ActivityState['status'], string> = {
  not_started: 'Not started',
  pending: 'Pending',
  rejected: 'Rejected',
  completed: 'Completed',
}

type VisibilityState = 'available' | 'next_window' | 'completed' | 'locked' | 'exhausted'

const getVisibilityState = (activity: ActivityState): VisibilityState => {
  if (activity.status === 'completed') return 'completed'

  if (activity.availability.state === 'available') return 'available'
  if (activity.availability.state === 'next_window') return 'next_window'
  if (activity.availability.state === 'locked') return 'locked'

  // One-time activities that were already used in a prior window.
  if (activity.availability.state === 'permanently_exhausted') return 'completed'

  return 'exhausted'
}

const visibilityBadgeConfig: Record<VisibilityState, { label: string; colorScheme: string; icon: React.ElementType }> = {
  available: { label: 'Available', colorScheme: 'green', icon: Circle },
  next_window: { label: 'Next Window', colorScheme: 'yellow', icon: CalendarClock },
  completed: { label: 'Completed', colorScheme: 'green', icon: CheckCircle },
  locked: { label: 'Locked', colorScheme: 'gray', icon: Lock },
  exhausted: { label: 'Exhausted', colorScheme: 'orange', icon: AlertTriangle },
}

export const WeeklyActivityCard = ({
  activity,
  selectedWeek,
  isWeekLocked,
  isAdmin,
  onMarkCompleted,
  onMarkNotStarted,
  onOpenProof,
}: {
  activity: ActivityState
  selectedWeek: number
  isWeekLocked: boolean
  isAdmin: boolean
  onMarkCompleted: (activity: ActivityState) => Promise<void>
  onMarkNotStarted: (activity: ActivityState) => Promise<void>
  onOpenProof: (activity: ActivityState) => void
}) => {
  const requiresPartnerApproval = Boolean(activity.approvalType === 'partner_approved' || activity.requiresApproval)
  const isPartnerIssued = activity.approvalType === 'partner_issued'

  const lockedByWeek = isWeekLocked && !isAdmin
  const lockedByAvailability = activity.availability.state !== 'available' && !isAdmin && activity.status === 'not_started'
  const lockedByInteraction = Boolean(activity.hasInteracted) && activity.status !== 'rejected' && !isAdmin

  const disabled = lockedByWeek || lockedByAvailability || lockedByInteraction
  const visibilityState = getVisibilityState(activity)
  const visibilityBadge = visibilityBadgeConfig[visibilityState]

  const showLockReason = () => {
    if (isAdmin) return null
    if (lockedByWeek) return 'This week is locked (future week).'
    if (lockedByInteraction) return 'Selection locked. Contact support to change.'

    if (activity.availability.state === 'next_window') {
      const currentWindow = getWindowNumber(selectedWeek, PARALLEL_WINDOW_SIZE_WEEKS)
      return getNextWindowAvailabilityMessage(activity, currentWindow)
    }

    if (activity.availability.state === 'exhausted') {
      return 'Cap reached for this window.'
    }

    if (activity.availability.state === 'permanently_exhausted') {
      return 'This one-time activity has already been completed.'
    }

    if (isPartnerIssued && activity.status === 'not_started') {
      return 'Your partner will assign this activity to you.'
    }

    if (lockedByAvailability) return 'This activity is locked or exhausted right now.'
    return null
  }

  const lockReason = showLockReason()

  const policyBadge = () => {
    const policy = activity.activityPolicy
    if (policy?.type === 'one_time') {
      return (
        <Badge colorScheme="red" variant="subtle" display="flex" alignItems="center">
          <Icon as={Zap} size={12} mr={1} /> One-time
        </Badge>
      )
    }
    if (policy?.type === 'window_limited') {
      return (
        <Badge colorScheme="blue" variant="subtle" display="flex" alignItems="center">
          <Icon as={RotateCcw} size={12} mr={1} /> Resets each window
        </Badge>
      )
    }
    if (policy?.type === 'ongoing') {
      return (
        <Badge colorScheme="teal" variant="subtle" display="flex" alignItems="center">
          <Icon as={Infinity} size={12} mr={1} /> Ongoing
        </Badge>
      )
    }
    return null
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} id={`activity-${activity.id}`} bg={activity.availability.state === 'next_window' || activity.availability.state === 'exhausted' || activity.availability.state === 'permanently_exhausted' ? 'gray.50' : 'white'}>
      <HStack justify="space-between" align="flex-start">
        <Stack spacing={1} flex={1}>
          <HStack spacing={2} wrap="wrap">
            <Badge
              colorScheme={
                activity.status === 'completed'
                  ? 'green'
                  : activity.status === 'pending'
                    ? 'blue'
                    : activity.status === 'rejected'
                      ? 'red'
                      : 'gray'
              }
            >
              {statusLabel[activity.status]}
            </Badge>

            <Badge colorScheme={visibilityBadge.colorScheme} variant="subtle" display="flex" alignItems="center">
              <Icon as={visibilityBadge.icon} size={12} mr={1} />
              {visibilityBadge.label}
            </Badge>

            {requiresPartnerApproval ? (
              <Tooltip label="Partner approval required. Submit proof for verification.">
                <Badge colorScheme="purple">Partner approval</Badge>
              </Tooltip>
            ) : isPartnerIssued ? (
              <Tooltip label="Assigned directly by your partner.">
                <Badge colorScheme="blue">Partner issued</Badge>
              </Tooltip>
            ) : activity.approvalType === 'auto' ? (
              <Tooltip label="Automatically verified by the system.">
                <Badge colorScheme="teal">Auto verified</Badge>
              </Tooltip>
            ) : (
              <Tooltip label="Self-verified (honor based)">
                <Badge colorScheme="green">Self-verified</Badge>
              </Tooltip>
            )}

            {policyBadge()}

            <Tag variant="subtle" colorScheme="orange">+{activity.points} pts</Tag>
          </HStack>

          <HStack spacing={2} mt={1}>
            <Heading size="sm">{activity.title}</Heading>
            {requiresPartnerApproval ? (
              <Icon as={ShieldCheck} color="purple.500" />
            ) : (
              <Icon as={CheckCircle} color="green.500" />
            )}
          </HStack>

          <Text fontSize="sm" color="gray.600">
            {activity.description}
          </Text>

          {lockReason ? (
            <HStack spacing={2} color="orange.600">
              <Icon as={Lock} size={14} />
              <Text fontSize="sm" fontWeight="medium">
                {lockReason}
              </Text>
            </HStack>
          ) : null}

          {activity.status === 'pending' ? (
            <HStack spacing={2} color="blue.600">
              <Icon as={AlertTriangle} size={14} />
              <Text fontSize="sm">
                Pending verification. Points post after approval.
              </Text>
            </HStack>
          ) : null}

          {activity.status === 'rejected' ? (
            <HStack spacing={2} color="red.600" align="start">
              <Icon as={AlertTriangle} size={14} mt={0.5} />
              <Text fontSize="sm">
                Submission rejected{activity.rejectionReason ? `: ${activity.rejectionReason}` : '.'} You can resubmit proof.
              </Text>
            </HStack>
          ) : null}
        </Stack>

        {isAdmin ? <Badge colorScheme="red" alignSelf="flex-start">Admin override</Badge> : null}
      </HStack>

      <Stack direction="row" spacing={3} mt={4}>
        {requiresPartnerApproval ? (
          <Button
            size="sm"
            colorScheme="purple"
            variant={activity.status === 'pending' || activity.status === 'completed' ? 'solid' : 'outline'}
            isDisabled={disabled || activity.status === 'completed'}
            onClick={() => onOpenProof(activity)}
          >
            {activity.status === 'rejected' ? 'Resubmit proof' : 'Submit proof'}
          </Button>
        ) : isPartnerIssued ? (
          <Button
            size="sm"
            colorScheme="blue"
            variant="outline"
            isDisabled={true}
          >
            {activity.status === 'completed' ? 'Assigned' : 'Awaiting Assignment'}
          </Button>
        ) : (
          <Button
            size="sm"
            colorScheme="green"
            variant={activity.status === 'completed' ? 'solid' : 'outline'}
            isDisabled={disabled || activity.status === 'completed'}
            onClick={() => onMarkCompleted(activity)}
          >
            {activity.approvalType === 'self' ? 'Confirm (Honor System)' : 'Mark Complete'}
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          isDisabled={(!isAdmin && activity.hasInteracted && activity.status !== 'rejected') || lockedByWeek}
          onClick={() => onMarkNotStarted(activity)}
        >
          No / Reset
        </Button>
      </Stack>
    </Box>
  )
}
