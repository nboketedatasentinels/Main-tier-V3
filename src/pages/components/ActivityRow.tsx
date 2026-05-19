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

const PROGRAMME_COMPONENTS_HREF = '/app/courses#programme-components'

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
  isActionInFlight,
}: ActivityRowProps) => {
  const navigate = useNavigate()

  const requiresPartnerApproval = Boolean(
    activity.approvalType === 'partner_approved' || activity.requiresApproval,
  )
  const isExternalAiToolSubmission =
    activity.id === 'ai_tool_review' && Boolean(activity.quickActionLink?.external)
  const isPartnerIssued = activity.approvalType === 'partner_issued'
  const awaitingPartnerIssue =
    isPartnerIssued &&
    !activity.issuedByPartner &&
    !isAdmin &&
    activity.status !== 'completed'

  const lockedByInteraction =
    Boolean(activity.hasInteracted) && activity.status !== 'rejected' && !isAdmin
  const lockedByWeek = isWeekLocked && !isAdmin
  const lockedByAvailability =
    activity.availability.state !== 'available' &&
    !isAdmin &&
    activity.status === 'not_started'

  const primaryActionDisabled =
    lockedByInteraction || activity.status === 'completed' || isActionInFlight

  const visualState = getVisualState(activity)
  const totalFrequency = activity.activityPolicy?.maxTotal ?? 1
  const completedCount = activity.completedCount ?? 0
  const hasFrequency = totalFrequency > 1

  const approvalLabel =
    APPROVAL_LABEL[activity.approvalType ?? ''] ?? 'Self'

  const lockReason = (() => {
    if (isAdmin) return null
    if (lockedByWeek) return `This activity opens after Week ${currentWeek}.`
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

  const ctaLabel = (() => {
    if (visualState === 'completed') return 'Completed'
    if (visualState === 'pending_review') return 'Submitted'
    if (visualState === 'rejected') return 'Try again'
    if (requiresPartnerApproval) return `Submit · +${activity.points} pts`
    if (isPartnerIssued)
      return activity.issuedByPartner
        ? `Claim · +${activity.points} pts`
        : 'Awaiting partner'
    if (activity.approvalType === 'self') return `I did this · +${activity.points} pts`
    if (activity.id === 'impact_log') return `Log impact · +${activity.points} pts`
    return `Done · +${activity.points} pts`
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

  return (
    <Box
      id={`activity-${activity.id}`}
      borderTop="1px solid"
      borderColor="gray.100"
      bg={isExpanded ? 'gray.50' : 'transparent'}
      _hover={{ bg: 'gray.50' }}
      transition="background-color 0.12s"
    >
      <Box
        as="button"
        type="button"
        onClick={onToggleExpand}
        w="100%"
        textAlign="left"
        px={{ base: 3, md: 4 }}
        py={3}
        cursor="pointer"
        _focusVisible={{ outline: '2px solid', outlineColor: '#350e6f', outlineOffset: '-2px' }}
      >
        <Grid
          templateColumns={{
            base: '20px 1fr auto 16px',
            md: '20px minmax(0,1fr) 70px 130px 90px 16px',
          }}
          gap={{ base: 3, md: 4 }}
          alignItems="center"
        >
          <StatusIcon state={visualState} />

          <Stack spacing={0.5} minW={0}>
            <Text
              fontSize="sm"
              fontWeight="medium"
              color={visualState === 'completed' ? 'gray.500' : 'gray.900'}
              textDecoration={visualState === 'completed' ? 'line-through' : 'none'}
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
              <Text color="#350e6f" fontWeight="semibold">
                +{activity.points.toLocaleString()} pts
              </Text>
              {hasFrequency && (
                <>
                  <Text>·</Text>
                  <Text>
                    {completedCount}/{totalFrequency}
                  </Text>
                </>
              )}
            </HStack>
          </Stack>

          {/* Frequency (desktop) */}
          <Text
            fontSize="xs"
            color="gray.600"
            display={{ base: 'none', md: 'block' }}
            textAlign="left"
          >
            {hasFrequency ? `${completedCount} / ${totalFrequency}` : '-'}
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
            color={visualState === 'completed' ? 'gray.400' : '#350e6f'}
            display={{ base: 'none', md: 'block' }}
            textAlign="right"
          >
            +{activity.points.toLocaleString()} pts
          </Text>

          <Icon
            as={isExpanded ? ChevronDown : ChevronRight}
            boxSize={4}
            color="gray.400"
          />
        </Grid>
      </Box>

      <Collapse in={isExpanded} animateOpacity>
        <Box px={{ base: 3, md: 4 }} pb={4} pl={{ base: 9, md: 11 }}>
          <Stack spacing={3}>
            <HStack spacing={2} fontSize="xs" color="gray.500" flexWrap="wrap">
              <Badge
                variant="subtle"
                colorScheme={
                  visualState === 'completed'
                    ? 'yellow'
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
                {STATUS_TEXT[visualState]}
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
                onAwardPoints={() => onMarkCompleted(activity)}
              />
            )}

            {activity.id !== 'podcast_workbook' && (
              <Flex
                direction={{ base: 'column', sm: 'row' }}
                gap={2}
                align={{ base: 'stretch', sm: 'center' }}
                justify="space-between"
                pt={1}
              >
                <HStack spacing={2} flexWrap="wrap">
                  {!isExternalAiToolSubmission && awaitingPartnerIssue && (
                    <Button
                      as={RouterLink}
                      to={PROGRAMME_COMPONENTS_HREF}
                      size="sm"
                      bg="#350e6f"
                      color="white"
                      _hover={{ bg: '#27062e' }}
                      rightIcon={<Icon as={ExternalLink} boxSize={3.5} />}
                      fontWeight="semibold"
                    >
                      View programme components
                    </Button>
                  )}
                  {!isExternalAiToolSubmission && !awaitingPartnerIssue && (
                    <Button
                      size="sm"
                      bg={visualState === 'completed' ? 'yellow.500' : '#350e6f'}
                      color="white"
                      _hover={{
                        bg: visualState === 'completed' ? 'yellow.600' : '#27062e',
                      }}
                      _disabled={{
                        bg:
                          visualState === 'completed'
                            ? 'yellow.500'
                            : visualState === 'pending_review'
                              ? '#27062e'
                              : 'gray.300',
                        color: 'white',
                        cursor: 'not-allowed',
                        opacity:
                          visualState === 'completed' || visualState === 'pending_review'
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
                        visualState === 'completed' ? (
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

                  {activity.quickActionLink &&
                    (activity.quickActionLink.external ? (
                      <Button
                        as="a"
                        href={activity.quickActionLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        variant="ghost"
                        color="#350e6f"
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
                        variant="ghost"
                        color="#350e6f"
                        fontWeight="semibold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {activity.quickActionLink.label}
                      </Button>
                    ))}

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
          </Stack>
        </Box>
      </Collapse>
    </Box>
  )
}

export default ActivityRow
