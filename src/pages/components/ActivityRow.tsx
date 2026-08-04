import {
  Badge,
  Box,
  Button,
  Collapse,
  Flex,
  Grid,
  HStack,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ExternalLink,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { getNextWindowAvailabilityMessage } from '@/utils/activityStateManager'
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'
import { PodcastSeriesPanel } from '@/components/courses/PodcastSeriesPanel'
import { ProgrammeComponentPartsPanel } from '@/components/courses/ProgrammeComponentParts'
import type { ProgrammeComponentType } from '@/config/pillarProgrammeComponents'

const PROGRAMME_COMPONENTS_HREF = '/app/courses#programme-components'

/**
 * Checklist activities that are pillar programme components. Expanding one
 * lists the actual parts to work through (same rows as the courses page)
 * instead of only the generic description.
 */
const PROGRAMME_COMPONENT_ACTIVITIES: Record<string, ProgrammeComponentType> = {
  capstone: 'capstone',
  case_study: 'case_study',
  practical: 'practical',
}

type VisualState =
  | 'available'
  | 'completed'
  | 'pending_review'
  | 'rejected'
  | 'locked'
  | 'next_window'

const getVisualState = (activity: ActivityState): VisualState => {
  if (
    activity.status === 'completed' ||
    activity.availability.state === 'permanently_exhausted'
  )
    return 'completed'
  if (activity.status === 'pending') return 'pending_review'
  if (activity.status === 'rejected') return 'rejected'
  if (activity.availability.state === 'next_window') return 'next_window'
  if (activity.availability.state === 'available') return 'available'
  return 'locked'
}

const STATUS_TEXT: Record<VisualState, string> = {
  available: 'To do',
  pending_review: 'Awaiting review',
  rejected: 'Needs another try',
  completed: 'Completed',
  locked: 'Coming up',
  next_window: 'Opens next cycle',
}

const APPROVAL_LABEL: Record<string, string> = {
  self: 'Self',
  partner_approved: 'Partner approves',
  partner_issued: 'Partner issues',
  mentor_issued: 'Mentor issues',
  ambassador_issued: 'Ambassador issues',
}

const ordinalLabel = (n: number) => {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

const StatusIcon = ({ state }: { state: VisualState }) => {
  if (state === 'completed') {
    return <Icon as={CheckCircle2} boxSize={4.5} color="yellow.500" />
  }
  if (state === 'pending_review') {
    return <Icon as={ShieldCheck} boxSize={4.5} color="#350e6f" />
  }
  if (state === 'rejected') {
    return <Icon as={AlertTriangle} boxSize={4.5} color="red.500" />
  }
  if (state === 'locked' || state === 'next_window') {
    return <Icon as={Lock} boxSize={4} color="gray.400" />
  }
  return <Icon as={Circle} boxSize={4} color="gray.400" strokeWidth={2} />
}

interface ActivityRowProps {
  activity: ActivityState
  selectedWeek: number
  currentWeek: number
  isWeekLocked: boolean
  isAdmin: boolean
  isExpanded: boolean
  hasAvailableAlternative: boolean
  onToggleExpand: () => void
  onOpenCurrentWeek: () => void
  onFocusAvailableActivity: () => void
  onMarkCompleted: (activity: ActivityState) => Promise<void>
  onOpenProof: (activity: ActivityState) => void
  onRefreshLedger?: () => void
  /** 1-based claim index for this row when the activity allows multiple. */
  occurrenceNumber?: number
  occurrenceTotal?: number
  /** How many claims are awaiting partner review (count toward DONE progress). */
  pendingCount?: number
  /** This week's claim is consumed (submitted/approved) — not the same as fully maxed. */
  weekClaimComplete?: boolean
  isActionInFlight: boolean
}

export const ActivityRow = ({
  activity,
  selectedWeek,
  currentWeek,
  isWeekLocked,
  isAdmin,
  isExpanded,
  hasAvailableAlternative,
  onToggleExpand,
  onOpenCurrentWeek,
  onFocusAvailableActivity,
  onMarkCompleted,
  onOpenProof,
  onRefreshLedger,
  occurrenceNumber,
  occurrenceTotal,
  pendingCount = 0,
  weekClaimComplete = false,
  isActionInFlight,
}: ActivityRowProps) => {
  const navigate = useNavigate()

  const programmeComponentType = PROGRAMME_COMPONENT_ACTIVITIES[activity.id]
  const isProgrammeComponent = Boolean(programmeComponentType)

  const isExternalAiToolSubmission =
    activity.id === 'ai_tool_review' && Boolean(activity.quickActionLink?.external)
  const isPartnerIssued = activity.approvalType === 'partner_issued'
  // Capstone / case study / practical open their parts list instead of a
  // checklist "Submit" CTA — points are claimed from the part runtime itself.
  const requiresPartnerApproval = Boolean(
    !isProgrammeComponent &&
      (activity.approvalType === 'partner_approved' ||
        activity.requiresApproval ||
        // Non-programme partner_issued items still use proof → pending → reward.
        (isPartnerIssued && !activity.issuedByPartner)),
  )
  // No longer a passive state: non-issued partner_issued items are now
  // submittable via proof (see requiresPartnerApproval above).
  const awaitingPartnerIssue = false

  const lockedByInteraction =
    Boolean(activity.hasInteracted) && activity.status !== 'rejected' && !isAdmin
  const lockedByWeek = isWeekLocked && !isAdmin
  const lockedByAvailability =
    activity.availability.state !== 'available' &&
    !isAdmin &&
    activity.status === 'not_started'

  const primaryActionDisabled =
    lockedByInteraction ||
    lockedByWeek ||
    lockedByAvailability ||
    weekClaimComplete ||
    activity.status === 'completed' ||
    activity.status === 'pending' ||
    isActionInFlight

  const visualState = getVisualState(activity)
  const totalFrequency = occurrenceTotal ?? activity.activityPolicy?.maxTotal ?? 1
  const completedCount = activity.completedCount ?? 0
  const hasFrequency = totalFrequency > 1
  // Pending submissions count toward progress so DONE doesn't stay at 0/6
  // while the learner is locked out of re-submitting.
  const pendingClaims = Math.max(
    0,
    pendingCount,
    visualState === 'pending_review' ? 1 : 0,
  )
  const consumedCount = completedCount + pendingClaims
  // Line-through ONLY when every occurrence is fully approved (e.g. 3/3).
  const isFullyComplete =
    activity.availability.state === 'permanently_exhausted' ||
    (hasFrequency
      ? completedCount >= totalFrequency
      : visualState === 'completed' || (weekClaimComplete && visualState !== 'pending_review'))
  const showStrike = isFullyComplete
  // Journey-total progress (e.g. 1/2) must look the same in every week row —
  // never derive the numerator from the week-local occurrence index.
  const displayDoneCount = hasFrequency
    ? Math.min(totalFrequency, Math.max(0, consumedCount))
    : 0
  const occurrenceLabel = hasFrequency ? `${displayDoneCount} / ${totalFrequency}` : null
  const statusBadgeLabel = isFullyComplete
    ? 'Completed'
    : visualState === 'pending_review'
      ? STATUS_TEXT.pending_review
      : weekClaimComplete
        ? 'Done this week'
        : STATUS_TEXT[visualState]

  const approvalLabel =
    APPROVAL_LABEL[activity.approvalType ?? ''] ?? 'Self'

  const ptsSuffix =
    typeof activity.points === 'number' && activity.points > 0
      ? ` · +${activity.points} pts`
      : ''

  const lockReason = (() => {
    if (isAdmin) return null
    if (lockedByWeek) return `This activity opens after Week ${currentWeek}.`
    if (visualState === 'pending_review' && !isFullyComplete) {
      return hasFrequency
        ? `Submitted for this week (${displayDoneCount} of ${totalFrequency}) — awaiting partner review.`
        : 'Submitted for this week — awaiting partner review.'
    }
    if (weekClaimComplete && !isFullyComplete) {
      return hasFrequency
        ? `Done for this week (${displayDoneCount} of ${totalFrequency}). More occurrences unlock in later weeks.`
        : "You've already submitted this for the week."
    }
    if (lockedByInteraction) return "You've already submitted this for the week."
    if (awaitingPartnerIssue) return 'Your partner will issue this when ready.'
    if (
      activity.availability.reason === 'weekly_cooldown' &&
      activity.availability.cooldownUntil
    ) {
      const unlockDate = activity.availability.cooldownUntil
      const daysLeft = Math.max(
        1,
        Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      )
      return `Opens again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
    }
    if (activity.availability.reason === 'scheduled' && selectedWeek < activity.week) {
      return `Unlocks in Week ${activity.week}.`
    }
    if (activity.availability.state === 'next_window') {
      const currentWindow = getWindowNumber(selectedWeek, PARALLEL_WINDOW_SIZE_WEEKS)
      return getNextWindowAvailabilityMessage(activity, currentWindow)
    }
    if (activity.availability.state === 'exhausted') return 'Done for this cycle.'
    if (activity.availability.state === 'permanently_exhausted') return null
    if (
      activity.availability.reason === 'missing_mentor' ||
      activity.availability.reason === 'missing_ambassador'
    ) {
      return 'You need a mentor or ambassador first.'
    }
    if (lockedByAvailability) return 'This opens when conditions are met.'
    return null
  })()

  // Which claim this row is for (2 of 3 → "Do it a 2nd time").
  const claimAttempt =
    occurrenceNumber ??
    (hasFrequency ? Math.min(totalFrequency, Math.max(1, completedCount + 1)) : 1)
  const attemptSuffix =
    hasFrequency && claimAttempt > 1 ? ` a ${ordinalLabel(claimAttempt)} time` : ''

  const ctaLabel = (() => {
    if (isFullyComplete) return 'Completed'
    if (weekClaimComplete) return 'Done this week'
    if (visualState === 'pending_review') return 'Submitted'
    if (visualState === 'rejected') return 'Try again'
    if (requiresPartnerApproval) {
      return claimAttempt > 1
        ? `Submit${attemptSuffix}${ptsSuffix}`
        : `Submit${ptsSuffix}`
    }
    if (isPartnerIssued)
      return activity.issuedByPartner
        ? claimAttempt > 1
          ? `Claim${attemptSuffix}${ptsSuffix}`
          : `Claim${ptsSuffix}`
        : 'Awaiting partner'
    if (activity.approvalType === 'self') {
      return claimAttempt > 1
        ? `Do it${attemptSuffix}${ptsSuffix}`
        : `I did this${ptsSuffix}`
    }
    if (activity.id === 'impact_log') {
      return claimAttempt > 1
        ? `Log impact${attemptSuffix}${ptsSuffix}`
        : `Log impact${ptsSuffix}`
    }
    return claimAttempt > 1
      ? `Do it${attemptSuffix}${ptsSuffix}`
      : `Done${ptsSuffix}`
  })()

  const exitAction = (() => {
    if (isAdmin || !lockReason) return null
    if (lockedByWeek && selectedWeek > currentWeek) {
      return (
        <Button size="xs" variant="outline" onClick={onOpenCurrentWeek}>
          Go to Week {currentWeek}
        </Button>
      )
    }
    if (
      activity.availability.reason === 'missing_mentor' ||
      activity.availability.reason === 'missing_ambassador'
    ) {
      return (
        <Button as={RouterLink} size="xs" variant="outline" to="/app/weekly-glance">
          See support
        </Button>
      )
    }
    if (hasAvailableAlternative && activity.availability.state !== 'available') {
      return (
        <Button size="xs" variant="outline" onClick={onFocusAvailableActivity}>
          Jump to ready activity
        </Button>
      )
    }
    return null
  })()

  const handlePrimaryClick = () => {
    if (primaryActionDisabled) return
    if (requiresPartnerApproval) {
      onOpenProof(activity)
    } else if (!isExternalAiToolSubmission) {
      onMarkCompleted(activity)
    }
  }

  // Maxed activities stay collapsed — click should not open details/CTA.
  const canExpand = !isFullyComplete
  const showDetails = Boolean(isExpanded && canExpand)

  return (
    <Box
      id={`activity-${activity.id}`}
      borderTop="1px solid"
      borderColor="gray.100"
      bg={showDetails ? 'gray.50' : 'transparent'}
      _hover={canExpand ? { bg: 'gray.50' } : undefined}
      transition="background-color 0.12s"
      opacity={isFullyComplete ? 0.85 : 1}
    >
      <Box
        as="button"
        type="button"
        onClick={() => {
          if (!canExpand) return
          onToggleExpand()
        }}
        w="100%"
        textAlign="left"
        px={{ base: 3, md: 4 }}
        py={3}
        cursor={canExpand ? 'pointer' : 'default'}
        aria-disabled={!canExpand}
        _focusVisible={
          canExpand
            ? { outline: '2px solid', outlineColor: '#350e6f', outlineOffset: '-2px' }
            : { outline: 'none' }
        }
      >
        <Grid
          templateColumns={{
            base: '20px 1fr auto 16px',
            md: '20px minmax(0,1fr) 70px 130px 90px 16px',
          }}
          gap={{ base: 3, md: 4 }}
          alignItems="center"
        >
          <StatusIcon
            state={
              isFullyComplete
                ? 'completed'
                : weekClaimComplete
                  ? 'pending_review'
                  : visualState
            }
          />

          <Stack spacing={0.5} minW={0}>
            <Text
              fontSize="sm"
              fontWeight="medium"
              color={showStrike ? 'gray.500' : 'gray.900'}
              textDecoration={showStrike ? 'line-through' : 'none'}
              noOfLines={1}
            >
              {activity.title}
            </Text>
            <HStack
              spacing={2}
              fontSize="xs"
              color="gray.500"
              display={{ base: 'flex', md: 'none' }}
            >
              <Text>{approvalLabel}</Text>
              <Text>·</Text>
              <Text
                color={showStrike ? 'gray.400' : '#350e6f'}
                fontWeight="semibold"
                textDecoration={showStrike ? 'line-through' : 'none'}
              >
                +{activity.points.toLocaleString()} pts
              </Text>
              {occurrenceLabel && (
                <>
                  <Text>·</Text>
                  <Text
                    fontWeight="semibold"
                    color={showStrike ? 'gray.400' : 'gray.600'}
                    textDecoration={showStrike ? 'line-through' : 'none'}
                  >
                    {occurrenceLabel}
                  </Text>
                </>
              )}
            </HStack>
          </Stack>

          {/* Frequency / occurrence (desktop) */}
          <Text
            fontSize="xs"
            color={showStrike ? 'gray.400' : 'gray.600'}
            display={{ base: 'none', md: 'block' }}
            textAlign="left"
            fontWeight={hasFrequency ? 'semibold' : 'normal'}
            textDecoration={showStrike ? 'line-through' : 'none'}
          >
            {occurrenceLabel ?? '-'}
          </Text>

          {/* Approval type (desktop) */}
          <Box display={{ base: 'none', md: 'block' }}>
            <Badge
              variant="subtle"
              colorScheme="gray"
              fontSize="xs"
              fontWeight="medium"
              textTransform="none"
              px={2}
              py={0.5}
              rounded="md"
            >
              {approvalLabel}
            </Badge>
          </Box>

          {/* Points (desktop) */}
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color={showStrike ? 'gray.400' : '#350e6f'}
            display={{ base: 'none', md: 'block' }}
            textAlign="right"
            textDecoration={showStrike ? 'line-through' : 'none'}
          >
            +{activity.points.toLocaleString()} pts
          </Text>

          <Icon
            as={showDetails ? ChevronDown : ChevronRight}
            boxSize={4}
            color={canExpand ? 'gray.400' : 'gray.200'}
            visibility={canExpand ? 'visible' : 'hidden'}
          />
        </Grid>
      </Box>

      <Collapse in={showDetails} animateOpacity>
        <Box px={{ base: 3, md: 4 }} pb={4} pl={{ base: 9, md: 11 }}>
          <Stack spacing={3}>
            <HStack spacing={2} fontSize="xs" color="gray.500" flexWrap="wrap">
              <Badge
                variant="subtle"
                colorScheme={
                  isFullyComplete
                    ? 'yellow'
                    : weekClaimComplete
                      ? 'green'
                      : visualState === 'pending_review'
                        ? 'purple'
                        : visualState === 'rejected'
                          ? 'red'
                          : visualState === 'locked' || visualState === 'next_window'
                            ? 'gray'
                            : 'green'
                }
                fontSize="xs"
                textTransform="none"
                rounded="md"
              >
                {statusBadgeLabel}
              </Badge>
              {isAdmin && (
                <Badge colorScheme="red" variant="subtle" fontSize="xs">
                  Admin override
                </Badge>
              )}
            </HStack>

            {activity.description && (
              <Text fontSize="sm" color="gray.700" lineHeight="1.6">
                {activity.description}
              </Text>
            )}

            {activity.freeTierNotice && (
              <HStack spacing={2} color="#350e6f" fontSize="sm">
                <Icon as={CheckCircle2} boxSize={4} />
                <Text>{activity.freeTierNotice}</Text>
              </HStack>
            )}

            {lockReason && (
              <HStack spacing={2} color="gray.600" fontSize="sm" align="flex-start">
                <Icon as={Lock} boxSize={3.5} mt={0.5} color="gray.400" />
                <Text>{lockReason}</Text>
              </HStack>
            )}

            {activity.status === 'rejected' && (
              <HStack spacing={2} color="red.600" fontSize="sm" align="flex-start">
                <Icon as={AlertTriangle} boxSize={4} mt={0.5} />
                <Text>
                  {activity.rejectionReason
                    ? `Feedback: ${activity.rejectionReason}`
                    : 'Please review and resubmit.'}
                </Text>
              </HStack>
            )}

            {activity.id === 'podcast_workbook' && (
              <PodcastSeriesPanel
                activity={activity}
                currentWeek={currentWeek}
                onPointsAwarded={onRefreshLedger}
              />
            )}

            {isProgrammeComponent && programmeComponentType && (
              <ProgrammeComponentPartsPanel type={programmeComponentType} />
            )}

            {activity.id !== 'podcast_workbook' && !isProgrammeComponent && (
              <Flex
                direction={{ base: 'column', sm: 'row' }}
                gap={2}
                align={{ base: 'stretch', sm: 'center' }}
                justify="space-between"
                pt={1}
              >
                <HStack spacing={2} flexWrap="wrap">
                  {/* Quick action (e.g. "Register for webinar", "Find peer match")
                      renders first - it's the preparatory step the learner takes
                      before they can claim the primary action. */}
                  {activity.quickActionLink &&
                    (activity.quickActionLink.external ? (
                      <Button
                        as="a"
                        href={activity.quickActionLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        variant="outline"
                        color="#350e6f"
                        borderColor="#350e6f"
                        _hover={{ bg: '#f7f3fb', color: '#350e6f', textDecoration: 'none' }}
                        rightIcon={<Icon as={ExternalLink} boxSize={3.5} />}
                        fontWeight="semibold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {activity.quickActionLink.label}
                      </Button>
                    ) : (
                      <Button
                        as={RouterLink}
                        to={activity.quickActionLink.href}
                        size="sm"
                        variant="outline"
                        color="#350e6f"
                        borderColor="#350e6f"
                        _hover={{ bg: '#f7f3fb', color: '#350e6f', textDecoration: 'none' }}
                        fontWeight="semibold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {activity.quickActionLink.label}
                      </Button>
                    ))}

                  {!isExternalAiToolSubmission && awaitingPartnerIssue && (
                    <Button
                      as={RouterLink}
                      to={PROGRAMME_COMPONENTS_HREF}
                      size="sm"
                      bg="#350e6f"
                      color="white"
                      _hover={{ bg: '#27062e', color: 'white', textDecoration: 'none' }}
                      rightIcon={<Icon as={ExternalLink} boxSize={3.5} />}
                      fontWeight="semibold"
                    >
                      View programme components
                    </Button>
                  )}
                  {!isExternalAiToolSubmission && !awaitingPartnerIssue && (
                    <Button
                      size="sm"
                      bg={isFullyComplete ? 'yellow.500' : weekClaimComplete ? 'green.500' : '#350e6f'}
                      color="white"
                      _hover={{
                        bg: isFullyComplete
                          ? 'yellow.600'
                          : weekClaimComplete
                            ? 'green.600'
                            : '#27062e',
                      }}
                      _disabled={{
                        bg: isFullyComplete
                          ? 'yellow.500'
                          : weekClaimComplete
                            ? 'green.500'
                            : visualState === 'pending_review'
                              ? '#27062e'
                              : 'gray.300',
                        color: 'white',
                        cursor: 'not-allowed',
                        opacity:
                          isFullyComplete ||
                          weekClaimComplete ||
                          visualState === 'pending_review'
                            ? 1
                            : 0.6,
                      }}
                      isDisabled={primaryActionDisabled}
                      isLoading={isActionInFlight}
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePrimaryClick()
                      }}
                      leftIcon={
                        isFullyComplete || weekClaimComplete ? (
                          <Icon as={CheckCircle2} boxSize={4} />
                        ) : visualState === 'pending_review' ? (
                          <Icon as={ShieldCheck} boxSize={4} />
                        ) : undefined
                      }
                      fontWeight="semibold"
                    >
                      {ctaLabel}
                    </Button>
                  )}

                  {awaitingPartnerIssue && (
                    <Button
                      size="sm"
                      variant="ghost"
                      color="gray.600"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(PROGRAMME_COMPONENTS_HREF)
                      }}
                    >
                      Learn more
                    </Button>
                  )}
                </HStack>

                {exitAction}
              </Flex>
            )}

            {isProgrammeComponent && exitAction && (
              <Flex pt={1} justify="flex-start">
                {exitAction}
              </Flex>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  )
}

export default ActivityRow
