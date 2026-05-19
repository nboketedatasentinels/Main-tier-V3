import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { getNextWindowAvailabilityMessage } from '@/utils/activityStateManager'
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

const PROGRAMME_COMPONENTS_HREF = '/app/courses#programme-components'
import { PodcastSeriesPanel } from '@/components/courses/PodcastSeriesPanel'

type VisualState = 'available' | 'completed' | 'pending_review' | 'rejected' | 'locked' | 'next_window'

const getVisualState = (activity: ActivityState): VisualState => {
  if (activity.status === 'completed' || activity.availability.state === 'permanently_exhausted')
    return 'completed'
  if (activity.status === 'pending') return 'pending_review'
  if (activity.status === 'rejected') return 'rejected'
  if (activity.availability.state === 'next_window') return 'next_window'
  if (activity.availability.state === 'available') return 'available'
  return 'locked'
}

const stateStyles: Record<
  VisualState,
  { borderColor: string; bg: string; accent: string; statusLabel: string; statusColor: string }
> = {
  available: {
    borderColor: 'gray.200',
    bg: 'white',
    accent: '#350e6f',
    statusLabel: 'Ready',
    statusColor: 'purple',
  },
  completed: {
    borderColor: 'yellow.200',
    bg: 'yellow.50',
    accent: '#b45309',
    statusLabel: 'Completed',
    statusColor: 'yellow',
  },
  pending_review: {
    borderColor: '#27062e',
    bg: 'purple.50',
    accent: '#27062e',
    statusLabel: 'Awaiting review',
    statusColor: 'purple',
  },
  rejected: {
    borderColor: 'red.200',
    bg: 'red.50',
    accent: 'red.600',
    statusLabel: 'Needs another try',
    statusColor: 'red',
  },
  locked: {
    borderColor: 'gray.200',
    bg: 'gray.50',
    accent: 'gray.500',
    statusLabel: 'Locked',
    statusColor: 'gray',
  },
  next_window: {
    borderColor: 'blue.200',
    bg: 'blue.50',
    accent: 'blue.500',
    statusLabel: 'Opens next cycle',
    statusColor: 'blue',
  },
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
  onMarkNotStarted: _onMarkNotStarted,
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
  const requiresPartnerApproval = Boolean(
    activity.approvalType === 'partner_approved' || activity.requiresApproval
  )
  const isExternalAiToolSubmission =
    activity.id === 'ai_tool_review' && Boolean(activity.quickActionLink?.external)
  const isPartnerIssued = activity.approvalType === 'partner_issued'
  const navigate = useNavigate()
  const awaitingPartnerIssue =
    isPartnerIssued && !activity.issuedByPartner && !isAdmin && activity.status !== 'completed'
  // All activities are unlocked for the learner — week/availability/partner-issue
  // gates are informational hints only. Only block double-submission within
  // the same session and already-completed work.
  const lockedByInteraction =
    Boolean(activity.hasInteracted) && activity.status !== 'rejected' && !isAdmin
  // Retain these flags only to show friendly informational hints (lockReason)
  const lockedByWeek = isWeekLocked && !isAdmin
  const lockedByAvailability =
    activity.availability.state !== 'available' &&
    !isAdmin &&
    activity.status === 'not_started'
  const lockedByPartnerIssue =
    isPartnerIssued && !activity.issuedByPartner && !isAdmin && activity.status !== 'completed'

  const primaryActionDisabled =
    lockedByInteraction || activity.status === 'completed' || isActionInFlight

  const visualState = getVisualState(activity)
  const styles = stateStyles[visualState]

  // Frequency / remaining uses — shown as visual dot tracker (no words needed)
  const totalFrequency = activity.activityPolicy?.maxTotal ?? 1
  const completedCount = activity.completedCount ?? 0
  const showFrequencyDots = totalFrequency > 1

  // Human-readable lock reason
  const lockReason = (() => {
    if (isAdmin) return null
    if (lockedByWeek) return `This activity opens after Week ${currentWeek}.`
    if (lockedByInteraction) return 'You\'ve already submitted this for the week.'
    if (lockedByPartnerIssue) return 'Your partner will issue this when ready.'
    if (activity.availability.reason === 'weekly_cooldown' && activity.availability.cooldownUntil) {
      const unlockDate = activity.availability.cooldownUntil
      const daysLeft = Math.max(
        1,
        Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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

  // CTA label — short and outcome-driven
  const ctaLabel = (() => {
    if (visualState === 'completed') return 'Completed'
    if (visualState === 'pending_review') return 'Submitted'
    if (visualState === 'rejected') return 'Try again'
    if (requiresPartnerApproval) return `Submit · +${activity.points} pts`
    if (isPartnerIssued)
      return activity.issuedByPartner ? `Claim · +${activity.points} pts` : 'Awaiting partner'
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
      bg={styles.bg}
      borderRadius="xl"
      border="1px solid"
      borderColor={styles.borderColor}
      borderLeftWidth="4px"
      borderLeftColor={styles.accent}
      p={5}
      boxShadow="0 2px 8px rgba(0,0,0,0.04)"
      transition="all 0.2s"
      cursor={awaitingPartnerIssue ? 'pointer' : undefined}
      role={awaitingPartnerIssue ? 'link' : undefined}
      tabIndex={awaitingPartnerIssue ? 0 : undefined}
      onClick={
        awaitingPartnerIssue
          ? (e) => {
              const target = e.target as HTMLElement
              if (target.closest('button, a')) return
              navigate(PROGRAMME_COMPONENTS_HREF)
            }
          : undefined
      }
      onKeyDown={
        awaitingPartnerIssue
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(PROGRAMME_COMPONENTS_HREF)
              }
            }
          : undefined
      }
      _hover={
        awaitingPartnerIssue
          ? { transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(53,14,111,0.12)' }
          : visualState === 'available'
            ? { transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(53,14,111,0.12)' }
            : undefined
      }
      position="relative"
    >
      <Stack spacing={3}>
        {/* Top row: status + frequency + points */}
        <Flex justify="space-between" align="center" gap={2} flexWrap="wrap">
          <HStack spacing={2}>
            <Badge
              colorScheme={styles.statusColor}
              variant="subtle"
              fontSize="xs"
              rounded="full"
              px={2.5}
              py={0.5}
              textTransform="none"
              fontWeight="medium"
            >
              <HStack spacing={1.5}>
                {visualState === 'available' && <Icon as={Sparkles} boxSize={3} />}
                {visualState === 'completed' && <Icon as={CheckCircle2} boxSize={3} />}
                {visualState === 'locked' && <Icon as={Lock} boxSize={3} />}
                {visualState === 'next_window' && <Icon as={CalendarClock} boxSize={3} />}
                {visualState === 'rejected' && <Icon as={AlertTriangle} boxSize={3} />}
                {visualState === 'pending_review' && <Icon as={ShieldCheck} boxSize={3} />}
                <Text>{styles.statusLabel}</Text>
              </HStack>
            </Badge>
            {showFrequencyDots && (
              <HStack
                spacing={1}
                aria-label={`${completedCount} of ${totalFrequency} completed`}
              >
                {Array.from({ length: totalFrequency }).map((_, i) => (
                  <Box
                    key={i}
                    w={2}
                    h={2}
                    rounded="full"
                    bg={i < completedCount ? 'yellow.500' : 'transparent'}
                    border="1.5px solid"
                    borderColor={i < completedCount ? 'yellow.500' : 'gray.300'}
                  />
                ))}
              </HStack>
            )}
            {isAdmin && (
              <Badge colorScheme="red" variant="subtle" fontSize="xs">
                Admin override
              </Badge>
            )}
          </HStack>

          {/* Points pill */}
          {visualState !== 'completed' && (
            <Box
              px={3}
              py={1}
              bg="orange.50"
              border="1px solid"
              borderColor="orange.200"
              borderRadius="full"
              fontSize="xs"
              fontWeight="bold"
              color="orange.700"
            >
              +{activity.points.toLocaleString()} pts
            </Box>
          )}
        </Flex>

        {/* Title */}
        <Heading
          size="sm"
          color="gray.900"
          lineHeight="1.3"
          letterSpacing="-0.01em"
          fontWeight="semibold"
        >
          {activity.title}
        </Heading>

        {/* Friendly helper text or lock reason */}
        {(lockReason || activity.freeTierNotice || activity.status === 'rejected') && (
          <Stack spacing={1.5}>
            {activity.freeTierNotice && (
              <HStack spacing={2} color="#350e6f" fontSize="sm">
                <Icon as={CheckCircle2} boxSize={3.5} />
                <Text>{activity.freeTierNotice}</Text>
              </HStack>
            )}
            {lockReason && (
              <HStack spacing={2} color="gray.600" fontSize="sm">
                <Icon as={Lock} boxSize={3.5} color="gray.400" />
                <Text>{lockReason}</Text>
              </HStack>
            )}
            {activity.status === 'rejected' && (
              <HStack spacing={2} color="red.600" fontSize="sm" align="flex-start">
                <Icon as={AlertTriangle} boxSize={3.5} mt={0.5} />
                <Text>
                  {activity.rejectionReason
                    ? `Feedback: ${activity.rejectionReason}`
                    : 'Please review and resubmit.'}
                </Text>
              </HStack>
            )}
          </Stack>
        )}

        {/* Podcast series — inline experience for the podcast_workbook activity */}
        {activity.id === 'podcast_workbook' && (
          <PodcastSeriesPanel
            activity={activity}
            currentWeek={currentWeek}
            onAwardPoints={() => onMarkCompleted(activity)}
          />
        )}

        {/* CTAs (hidden for the podcast activity — the panel above drives the flow) */}
        {activity.id !== 'podcast_workbook' && (
        <Flex
          direction={{ base: 'column', sm: 'row' }}
          gap={2}
          align={{ base: 'stretch', sm: 'center' }}
          justify="space-between"
        >
          <HStack spacing={2} flexWrap="wrap">
            {/* Primary CTA */}
            {!isExternalAiToolSubmission && awaitingPartnerIssue && (
              <Button
                as={RouterLink}
                to={PROGRAMME_COMPONENTS_HREF}
                size="md"
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
                size="md"
                bg={
                  visualState === 'completed'
                    ? 'yellow.500'
                    : '#350e6f'
                }
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
                  opacity: visualState === 'completed' || visualState === 'pending_review' ? 1 : 0.6,
                }}
                isDisabled={primaryActionDisabled}
                isLoading={isActionInFlight}
                onClick={handlePrimaryClick}
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

            {/* Quick action link */}
            {activity.quickActionLink &&
              (activity.quickActionLink.external ? (
                <Button
                  as="a"
                  href={activity.quickActionLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="md"
                  variant="ghost"
                  color="brand.primary"
                  rightIcon={<Icon as={ExternalLink} boxSize={3.5} />}
                  fontWeight="semibold"
                  _hover={{ bg: 'transparent', color: 'brand.dark' }}
                >
                  {activity.quickActionLink.label}
                </Button>
              ) : (
                <Button
                  as={RouterLink}
                  to={activity.quickActionLink.href}
                  size="md"
                  variant="ghost"
                  color="brand.primary"
                  fontWeight="semibold"
                  _hover={{ bg: 'transparent', color: 'brand.dark' }}
                >
                  {activity.quickActionLink.label}
                </Button>
              ))}
          </HStack>

          {exitAction}
        </Flex>
        )}
      </Stack>

      {/* Celebratory checkmark for fully completed */}
      {visualState === 'completed' && (
        <Box position="absolute" top={3} right={3} aria-hidden>
          <Flex
            w={8}
            h={8}
            borderRadius="full"
            bg="yellow.500"
            color="white"
            align="center"
            justify="center"
            boxShadow="0 4px 12px rgba(180, 83, 9, 0.3)"
          >
            <Icon as={CheckCircle2} boxSize={5} />
          </Flex>
        </Box>
      )}
    </Box>
  )
}
