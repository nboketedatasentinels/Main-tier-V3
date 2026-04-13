import { useEffect, useState } from 'react'
import { Badge, Box, Button, Collapse, HStack, Heading, Icon, Stack, Tag, Text, Tooltip, useBreakpointValue } from '@chakra-ui/react'
import { AlertTriangle, CalendarClock, CheckCircle, ChevronDown, ChevronUp, Circle, Lock, RotateCcw, ShieldCheck } from 'lucide-react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { getNextWindowAvailabilityMessage } from '@/utils/activityStateManager'
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'
import { Link as RouterLink } from 'react-router-dom'

const statusLabel: Record<ActivityState['status'], string> = {
  not_started: 'Not started',
  pending: 'Submitted - Awaiting Review',
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
  next_window: { label: 'Opens Next Cycle', colorScheme: 'blue', icon: CalendarClock },
  completed: { label: 'Completed', colorScheme: 'green', icon: CheckCircle },
  locked: { label: 'Locked', colorScheme: 'gray', icon: Lock },
  exhausted: { label: 'Cycle Cap Reached', colorScheme: 'teal', icon: RotateCcw },
}

export const WeeklyActivityCard = ({
  activity,
  selectedWeek,
  currentWeek,
  isWeekLocked,
  isAdmin,
  onOpenCurrentWeek,
  onFocusAvailableActivity,
  hasAvailableAlternative,
  onMarkCompleted,
  onMarkNotStarted,
  onOpenProof,
  isActionInFlight,
}: {
  activity: ActivityState
  selectedWeek: number
  currentWeek: number
  isWeekLocked: boolean
  isAdmin: boolean
  onOpenCurrentWeek: () => void
  onFocusAvailableActivity: () => void
  hasAvailableAlternative: boolean
  onMarkCompleted: (activity: ActivityState) => Promise<void>
  onMarkNotStarted: (activity: ActivityState) => Promise<void>
  onOpenProof: (activity: ActivityState) => void
  isActionInFlight: boolean
}) => {
  const requiresPartnerApproval = Boolean(activity.approvalType === 'partner_approved' || activity.requiresApproval)
  const isExternalAiToolSubmission = activity.id === 'ai_tool_review' && Boolean(activity.quickActionLink?.external)
  const isPartnerIssued = activity.approvalType === 'partner_issued'
  const lockedByPartnerIssue = isPartnerIssued && !activity.issuedByPartner && !isAdmin && activity.status !== 'completed'
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false
  const [detailsOpen, setDetailsOpen] = useState(!isMobile)

  useEffect(() => {
    setDetailsOpen(!isMobile)
  }, [isMobile])

  const lockedByWeek = isWeekLocked && !isAdmin
  const lockedByAvailability = activity.availability.state !== 'available' && !isAdmin && activity.status === 'not_started'
  const lockedByInteraction = Boolean(activity.hasInteracted) && activity.status !== 'rejected' && !isAdmin

  const disabled = lockedByWeek || lockedByAvailability || lockedByInteraction || lockedByPartnerIssue
  const primaryActionDisabled = disabled || activity.status === 'completed' || isActionInFlight
  const visibilityState = getVisibilityState(activity)

  // Check if activity is fully used (for done icon)
  const totalFrequency = activity.activityPolicy?.maxTotal ?? 1
  const completedCount = activity.completedCount ?? 0
  const remainingUses = Math.max(0, totalFrequency - completedCount)
  const visibilityBadge = (() => {
    if (lockedByWeek) {
      return {
        ...visibilityBadgeConfig.locked,
        label: 'Unlocks Soon',
      }
    }

    // Interaction/support constraints should be explicit neutral locks.
    if (lockedByInteraction) {
      return visibilityBadgeConfig.locked
    }

    if (
      lockedByAvailability &&
      (activity.availability.reason === 'missing_mentor' || activity.availability.reason === 'missing_ambassador')
    ) {
      return visibilityBadgeConfig.locked
    }

    return visibilityBadgeConfig[visibilityState]
  })()

  const showLockReason = () => {
    if (isAdmin) return null
    if (lockedByWeek) return `Week ${selectedWeek} opens after Week ${currentWeek}.`
    if (lockedByInteraction) return 'Submission saved for this week. Need a change? Support can help.'
    if (lockedByPartnerIssue) return 'Your partner needs to issue this activity before you can complete it.'
    if (activity.availability.reason === 'scheduled' && selectedWeek < activity.week) {
      return `This activity unlocks in Week ${activity.week}.`
    }

    if (activity.availability.state === 'next_window') {
      const currentWindow = getWindowNumber(selectedWeek, PARALLEL_WINDOW_SIZE_WEEKS)
      return getNextWindowAvailabilityMessage(activity, currentWindow)
    }

    if (activity.availability.state === 'exhausted') {
      return 'Nice work. You reached this activity cap for the current cycle.'
    }

    if (activity.availability.state === 'permanently_exhausted') {
      return 'Nice work. This one-time activity is already completed.'
    }

    if (lockedByAvailability) return 'This activity opens when schedule and support conditions are met.'
    return null
  }

  const lockReason = showLockReason()

  const renderExitAction = () => {
    if (isAdmin || !lockReason) return null

    if (lockedByWeek && selectedWeek > currentWeek) {
      return (
        <Button size="xs" variant="outline" onClick={onOpenCurrentWeek}>
          Go to Week {currentWeek}
        </Button>
      )
    }

    if (lockedByInteraction && activity.status === 'pending') {
      return (
        <Button as={RouterLink} size="xs" variant="outline" to="/app/weekly-checklist?focus=pending-approvals">
          Review submitted proofs
        </Button>
      )
    }

    if (activity.availability.reason === 'missing_mentor' || activity.availability.reason === 'missing_ambassador') {
      return (
        <Button as={RouterLink} size="xs" variant="outline" to="/app/weekly-glance">
          View support options
        </Button>
      )
    }

    if (hasAvailableAlternative && activity.availability.state !== 'available') {
      return (
        <Button size="xs" variant="outline" onClick={onFocusAvailableActivity}>
          Jump to available activity
        </Button>
      )
    }

    return null
  }

  const renderQuickActionButton = () => {
    if (!activity.quickActionLink) return null

    if (activity.quickActionLink.external) {
      return (
        <Button
          as="a"
          href={activity.quickActionLink.href}
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          colorScheme="blue"
          variant="outline"
        >
          {activity.quickActionLink.label}
        </Button>
      )
    }

    return (
      <Button
        as={RouterLink}
        to={activity.quickActionLink.href}
        size="sm"
        colorScheme="blue"
        variant="outline"
      >
        {activity.quickActionLink.label}
      </Button>
    )
  }

  const exitAction = renderExitAction()
  const showDetails = !isMobile || detailsOpen
  const showApprovalBadge = !isMobile || detailsOpen || requiresPartnerApproval || isPartnerIssued
  const showPolicyBadge = !isMobile || detailsOpen
  const showSecondaryActions = !isMobile || detailsOpen
  const showExitActionOutsideDetails = Boolean(exitAction && !showDetails && primaryActionDisabled)
  const showCollapsedAssist = Boolean(!showDetails && primaryActionDisabled && (lockReason || exitAction))

  const policyBadge = () => {
    // Show dynamic frequency: "X of Y left"
    const colorScheme = remainingUses === 0
      ? 'gray'
      : remainingUses === 1
        ? 'red'
        : totalFrequency === 1
          ? 'red'
          : 'blue'

    const label = remainingUses === 0
      ? 'Fully claimed'
      : totalFrequency === 1
        ? '1x only'
        : `${remainingUses} of ${totalFrequency} left`

    return (
      <Badge colorScheme={colorScheme} variant="solid" display="flex" alignItems="center" fontWeight="bold">
        {label}
      </Badge>
    )
  }

  const cardBg =
    activity.availability.state === 'next_window' || activity.availability.state === 'exhausted'
      ? 'blue.50'
      : 'white'

  const isFullyCompleted = activity.status === 'completed' || activity.availability.state === 'permanently_exhausted' || remainingUses === 0

  return (
    <Box borderWidth="1px" borderStyle="solid" borderColor="blue.200" borderRadius="lg" p={4} id={`activity-${activity.id}`} bg={cardBg} boxShadow="sm" position="relative">
      {/* Big Done checkmark for fully completed activities */}
      {isFullyCompleted && (
        <Box
          position="absolute"
          top={2}
          right={2}
          bg="green.500"
          borderRadius="full"
          p={2}
          boxShadow="md"
        >
          <Icon as={CheckCircle} color="white" boxSize={6} />
        </Box>
      )}
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

            {showApprovalBadge
              ? requiresPartnerApproval ? (
                <Tooltip
                  label={
                    isExternalAiToolSubmission
                      ? 'Submit this activity through the external tools portal.'
                      : 'Partner approval required. Submit proof for partner review.'
                  }
                >
                  <Badge colorScheme="purple">Partner approval</Badge>
                </Tooltip>
              ) : isPartnerIssued ? (
                <Tooltip label={activity.issuedByPartner ? 'Issued by your partner and ready for completion.' : 'Waiting for partner issuance.'}>
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
              )
              : null}

            {showPolicyBadge ? policyBadge() : null}

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
        </Stack>

        {isAdmin ? <Badge colorScheme="red" alignSelf="flex-start">Admin override</Badge> : null}
      </HStack>

      {isMobile ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDetailsOpen(prev => !prev)}
          aria-expanded={detailsOpen}
          aria-controls={`activity-details-${activity.id}`}
          rightIcon={<Icon as={detailsOpen ? ChevronUp : ChevronDown} />}
          mt={3}
        >
          {detailsOpen ? 'Hide details' : 'Details'}
        </Button>
      ) : null}

      {showCollapsedAssist ? (
        <Stack spacing={2} align="flex-start" mt={2}>
          {lockReason && !lockedByInteraction ? (
            <HStack spacing={2} color="blue.700">
              <Icon as={Lock} size={14} />
              <Text fontSize="xs" fontWeight="medium">
                {lockReason}
              </Text>
            </HStack>
          ) : null}
          {showExitActionOutsideDetails ? exitAction : null}
        </Stack>
      ) : null}

      <Collapse id={`activity-details-${activity.id}`} in={showDetails} animateOpacity>
        <Stack spacing={2} mt={3}>
          {activity.freeTierNotice ? (
            <HStack spacing={2} color="green.700">
              <Icon as={CheckCircle} size={14} />
              <Text fontSize="sm" fontWeight="medium">
                {activity.freeTierNotice}
              </Text>
            </HStack>
          ) : null}

          {lockReason && !lockedByInteraction ? (
            <Stack spacing={2} align="flex-start">
              <HStack spacing={2} color="blue.700">
                <Icon as={Lock} size={14} />
                <Text fontSize="sm" fontWeight="medium">
                  {lockReason}
                </Text>
              </HStack>
              {exitAction}
            </Stack>
          ) : null}

          {activity.status === 'rejected' ? (
            <HStack spacing={2} color="red.600" align="start">
              <Icon as={AlertTriangle} size={14} mt={0.5} />
              <Text fontSize="sm">
                Rejected{activity.rejectionReason ? `: ${activity.rejectionReason}` : ''}. Resubmit below.
              </Text>
            </HStack>
          ) : null}
        </Stack>
      </Collapse>

      <Stack
        direction={{ base: 'column', md: 'row' }}
        spacing={3}
        mt={showDetails && !isAdmin && !activity.hasInteracted && activity.status !== 'completed' ? 2 : 4}
      >
        {renderQuickActionButton()}

        {isExternalAiToolSubmission ? null : requiresPartnerApproval ? (
          <Button
            size="sm"
            colorScheme="purple"
            variant={activity.status === 'pending' || activity.status === 'completed' ? 'solid' : 'outline'}
            isDisabled={primaryActionDisabled}
            onClick={() => onOpenProof(activity)}
          >
            {activity.status === 'rejected'
              ? 'Resubmit proof'
              : activity.status === 'pending'
                ? 'Submitted'
                : 'Submit proof'}
          </Button>
        ) : isPartnerIssued ? (
          <Button
            size="sm"
            colorScheme="blue"
            variant={activity.status === 'completed' ? 'solid' : 'outline'}
            isDisabled={primaryActionDisabled}
            isLoading={isActionInFlight}
            onClick={() => onMarkCompleted(activity)}
          >
            {activity.status === 'completed'
              ? 'Completed'
              : activity.issuedByPartner
                ? 'Mark Complete'
                : 'Awaiting Assignment'}
          </Button>
        ) : (
          <Button
            size="sm"
            colorScheme="green"
            variant={activity.status === 'completed' ? 'solid' : 'outline'}
            isDisabled={primaryActionDisabled}
            isLoading={isActionInFlight}
            onClick={() => onMarkCompleted(activity)}
          >
            {activity.approvalType === 'self' ? 'Confirm (Honor System)' : activity.id === 'impact_log' ? 'Do your impact' : 'Mark Complete'}
          </Button>
        )}

        {showSecondaryActions ? (
          <Button
            size="sm"
            variant="outline"
            isDisabled={isActionInFlight || (!isAdmin && activity.hasInteracted && activity.status !== 'rejected') || lockedByWeek}
            onClick={() => onMarkNotStarted(activity)}
          >
            Reset status
          </Button>
        ) : null}
      </Stack>
    </Box>
  )
}
