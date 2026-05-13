import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  ExternalLink,
  Lock,
  RefreshCcw,
  Shield,
  Target,
  Timer,
  User,
  UserCircle2,
} from 'lucide-react'
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationLeadership } from '@/hooks/useOrganizationLeadership'
import { MENTORSHIP_GOALS_MAX_LENGTH, useMentorshipGoals } from '@/hooks/useMentorshipGoals'
import { useLearnerMentorshipSessions } from '@/hooks/useMentorshipSessions'
import {
  cancelMentorshipSession,
  createMentorshipSessionRequest,
  type MentorshipSession,
} from '@/services/mentorshipService'
import { LearnerAmbassadorBookings } from '@/components/learner/LearnerAmbassadorBookings'
import { getDisplayName } from '@/utils/displayName'
import { getJourneyLabel, isLeadershipCouncilJourney } from '@/utils/journeyType'
import type { UserProfileExtended } from '@/services/userProfileService'

interface LeadershipProfile extends UserProfileExtended {
  availabilityStatus?: string
  companyCode?: string
  companyName?: string
  timezone?: string
  mentorId?: string
  ambassadorId?: string
  accountStatus?: string
  notes?: string
  lastActive?: string
  registrationDate?: string
  lastInteraction?: string
}

interface PartnerProfile extends UserProfileExtended {
  title?: string
  bio?: string
  rating?: number
  ratingCount?: number
  sessionsConducted?: number
  nextSession?: string
  resources?: { label: string; url: string }[]
  expertise?: string[]
  hobbies?: string[]
  funFact?: string
  officeLocation?: string
  xp?: number
  favoritePillar?: string
}

const formatDisplayDate = (date: Date) => format(date, 'EEE, MMM d')
const formatOptionalIsoDate = (value?: string | null): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = parseISO(value)
  if (!isValid(parsed)) return null
  return format(parsed, 'PPP')
}

const relativeTime = (date: Date) => {
  try {
    return formatDistanceToNow(date, { addSuffix: true })
  } catch (err) {
    return ''
  }
}

const displayNameForProfile = (profile?: UserProfileExtended | null) =>
  getDisplayName(profile, 'Member')

const badgeColor = (status?: string) => {
  if (!status) return 'secondary'
  const value = status.toLowerCase()
  if (value.includes('active') || value.includes('available')) return 'success'
  if (value.includes('limited')) return 'secondary'
  if (value.includes('leave')) return 'warning'
  return 'primary'
}

export const LeadershipCouncilPage: React.FC = () => {
  const { profile, user } = useAuth()
  const toast = useToast()

  const {
    profiles,
    errors,
    loading: assignmentsLoading,
    refresh,
    organization,
    assignmentSources,
    supportAssignment: supportAssignmentStatus,
  } = useOrganizationLeadership(profile?.companyId, profile?.id, profile)
  const mentorProfile = profiles.mentor as LeadershipProfile | null
  const ambassadorProfile = profiles.ambassador as LeadershipProfile | null
  const partnerProfile = profiles.partner as PartnerProfile | null
  const mentorError = errors.organization || errors.supportAssignments || errors.mentor
  const ambassadorError = errors.organization || errors.supportAssignments || errors.ambassador
  const partnerError = errors.organization || errors.partner
  const partnerLoading = assignmentsLoading

  const isSamePerson = Boolean(mentorProfile?.id && ambassadorProfile?.id && mentorProfile.id === ambassadorProfile.id)

  const {
    sessions,
    byStatus: sessionsByStatus,
    loading: sessionsLoading,
    error: sessionsError,
  } = useLearnerMentorshipSessions(profile?.id ?? null)
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null)

  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleTopic, setScheduleTopic] = useState('')
  const [scheduleMessage, setScheduleMessage] = useState('')
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  const [goalsDraft, setGoalsDraft] = useState('')
  const [goalsInitialized, setGoalsInitialized] = useState(false)

  const sessionsModal = useDisclosure()
  const scheduleModal = useDisclosure()

  const hasOrganization = Boolean(profile?.companyId)
  const organizationReady = organization.loaded && organization.exists
  const supportAssignmentsReady = supportAssignmentStatus.loaded
  const showOrgDebug = import.meta.env.DEV && (organization.id || supportAssignmentStatus.id)
  const isLeadershipEligible = isLeadershipCouncilJourney(profile?.journeyType)
  const journeyLockReason = !isLeadershipEligible
    ? 'Leadership Council unlocks on 3-month, 6-month, and 9-month journeys.'
    : null
  const currentJourneyLabel = profile?.journeyType ? getJourneyLabel(profile.journeyType) : null
  const mentorSourceLabel =
    assignmentSources.mentor === 'user'
      ? 'User-specific mentor'
      : assignmentSources.mentor === 'organization'
        ? 'Organization mentor'
        : assignmentSources.mentor === 'profile'
          ? 'Profile mentor'
          : null
  const canScheduleSession =
    isLeadershipEligible &&
    Boolean(mentorProfile) &&
    hasOrganization &&
    organizationReady &&
    supportAssignmentsReady &&
    !assignmentsLoading
  const scheduleDisabledReason = !isLeadershipEligible
    ? journeyLockReason
    : !hasOrganization
      ? 'Link your account to an organization to unlock mentor scheduling.'
      : !organizationReady
        ? 'We are still confirming your organization details.'
        : !supportAssignmentsReady
          ? 'Support assignments are still loading.'
          : !mentorProfile
            ? 'A mentor must be assigned before scheduling.'
            : null

  const {
    goals: savedGoals,
    updatedAt: goalsUpdatedAt,
    loading: goalsLoading,
    saving: goalsSaving,
    error: goalsError,
    save: saveGoals,
  } = useMentorshipGoals(
    isLeadershipEligible ? profile?.id ?? null : null,
    mentorProfile?.id ?? null,
  )

  const journeyBlockedDescription = currentJourneyLabel
    ? `Available on 3-month, 6-month, and 9-month journeys — you're on the ${currentJourneyLabel}.`
    : 'Available on 3-month, 6-month, and 9-month journeys.'
  const gatingSteps: ReadonlyArray<{
    id: 'organization' | 'support' | 'mentor' | 'ambassador'
    title: string
    description: string
    status: 'complete' | 'pending' | 'blocked'
  }> = !isLeadershipEligible
    ? [
        {
          id: 'organization',
          title: 'Organization linked',
          description: journeyBlockedDescription,
          status: 'blocked',
        },
        {
          id: 'support',
          title: 'Assignments checked',
          description: journeyBlockedDescription,
          status: 'blocked',
        },
        {
          id: 'mentor',
          title: 'Mentor ready',
          description: journeyBlockedDescription,
          status: 'blocked',
        },
        {
          id: 'ambassador',
          title: 'Ambassador ready',
          description: journeyBlockedDescription,
          status: 'blocked',
        },
      ]
    : [
        {
          id: 'organization',
          title: 'Organization linked',
          description: hasOrganization
            ? 'Organization connection confirmed.'
            : 'Add an organization to unlock assignments.',
          status: hasOrganization ? (organizationReady ? 'complete' : 'pending') : 'blocked',
        },
        {
          id: 'support',
          title: 'Assignments checked',
          description: supportAssignmentsReady
            ? supportAssignmentStatus.exists
              ? 'Your mentor and ambassador assignments are in place.'
              : 'Checked — your admin hasn’t recorded assignments yet.'
            : 'Checking your support assignments.',
          status: supportAssignmentsReady
            ? supportAssignmentStatus.exists
              ? 'complete'
              : 'blocked'
            : 'pending',
        },
        {
          id: 'mentor',
          title: 'Mentor ready',
          description: mentorProfile
            ? 'Mentor assigned — you can share goals and request a session.'
            : assignmentsLoading
              ? 'Loading your mentor assignment.'
              : 'Your admin hasn’t assigned a mentor yet.',
          status: mentorProfile ? 'complete' : assignmentsLoading ? 'pending' : 'blocked',
        },
        {
          id: 'ambassador',
          title: 'Ambassador ready',
          description: ambassadorProfile
            ? 'Ambassador ready — coaching sessions will appear here when scheduled.'
            : assignmentsLoading
              ? 'Loading your ambassador assignment.'
              : 'Ambassador coaching hasn’t been set up for your organization yet.',
          status: ambassadorProfile ? 'complete' : assignmentsLoading ? 'pending' : 'blocked',
        },
      ]

  const gateStatusIcon = (status: 'complete' | 'pending' | 'blocked') => {
    if (status === 'complete') return CheckCircle2
    if (status === 'pending') return Clock3
    return AlertTriangle
  }

  const retryAssignments = useCallback(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!isLeadershipEligible) {
      setGoalsDraft('')
      setGoalsInitialized(false)
      return
    }
    if (!goalsLoading && !goalsInitialized) {
      setGoalsDraft(savedGoals)
      setGoalsInitialized(true)
    }
  }, [isLeadershipEligible, goalsLoading, goalsInitialized, savedGoals])

  const goalsDirty = isLeadershipEligible && goalsInitialized && goalsDraft.trim() !== savedGoals.trim()
  const goalsTooLong = goalsDraft.length > MENTORSHIP_GOALS_MAX_LENGTH

  const handleSaveGoals = async () => {
    if (!goalsDirty || goalsTooLong || goalsSaving) return
    try {
      await saveGoals(goalsDraft)
      toast({
        title: 'Goals saved',
        description: 'Your mentor can now see what you want to achieve.',
        status: 'success',
      })
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Try again in a moment.'
      toast({ title: 'Could not save your goals', description, status: 'error' })
    }
  }

  const handleRequestSession = async () => {
    if (!mentorProfile?.id || !profile?.id) {
      toast({ title: 'Could not verify mentor assignment', status: 'error' })
      return
    }

    if (!scheduleDate || !scheduleTime || !scheduleTopic.trim()) {
      toast({ title: 'Please complete required fields', status: 'error' })
      return
    }

    const proposedAt = new Date(`${scheduleDate}T${scheduleTime}`)
    if (!isValid(proposedAt) || proposedAt.getTime() < Date.now()) {
      toast({ title: 'Please choose a future date and time', status: 'error' })
      return
    }

    setScheduleSubmitting(true)
    try {
      await createMentorshipSessionRequest({
        learnerId: profile.id,
        mentorId: mentorProfile.id,
        topic: scheduleTopic,
        requestMessage: scheduleMessage,
        goals: savedGoals || undefined,
        proposedAt,
        learnerName: displayNameForProfile(profile),
        mentorName: displayNameForProfile(mentorProfile),
      })

      toast({
        title: 'Request sent',
        description: `${displayNameForProfile(mentorProfile)} will see your request and respond.`,
        status: 'success',
      })

      setScheduleDate('')
      setScheduleTime('')
      setScheduleTopic('')
      setScheduleMessage('')
      scheduleModal.onClose()
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Try again in a moment.'
      toast({
        title: 'Failed to send request',
        description,
        status: 'error',
      })
    } finally {
      setScheduleSubmitting(false)
    }
  }

  const handleCancelSession = async (session: MentorshipSession) => {
    if (!profile?.id) return
    setCancellingSessionId(session.id)
    try {
      await cancelMentorshipSession({ sessionId: session.id, actorId: profile.id })
      toast({ title: 'Request withdrawn', status: 'info' })
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Try again in a moment.'
      toast({ title: 'Could not withdraw request', description, status: 'error' })
    } finally {
      setCancellingSessionId(null)
    }
  }

  const downloadIcs = (session: MentorshipSession) => {
    const start = session.scheduledAt ?? session.proposedAt
    if (!start) {
      toast({ title: 'No session time set yet', status: 'warning' })
      return
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:Mentorship session with ${mentorProfile ? displayNameForProfile(mentorProfile) : 'Mentor'}`,
      `DTSTART:${format(start, "yyyyMMdd'T'HHmmss")}`,
      `DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`,
      `DESCRIPTION:${session.topic}${session.requestMessage ? `\\n${session.requestMessage}` : ''}`,
      session.meetingLink ? `LOCATION:${session.meetingLink}` : 'LOCATION:Virtual meeting',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'mentorship-session.ics'
    link.click()
    URL.revokeObjectURL(url)
  }

  const sessionStatusBadge = (status: MentorshipSession['status']): { label: string; scheme: string } => {
    switch (status) {
      case 'requested':
        return { label: 'Awaiting mentor', scheme: 'yellow' }
      case 'scheduled':
        return { label: 'Confirmed', scheme: 'green' }
      case 'completed':
        return { label: 'Completed', scheme: 'purple' }
      case 'declined':
        return { label: 'Declined', scheme: 'red' }
      case 'cancelled':
        return { label: 'Cancelled', scheme: 'gray' }
      default:
        return { label: status, scheme: 'gray' }
    }
  }

  const renderSessionRow = (session: MentorshipSession, actions?: ReactNode) => {
    const when = session.scheduledAt ?? session.proposedAt
    const badge = sessionStatusBadge(session.status)
    return (
      <Flex
        key={session.id}
        p={4}
        border="1px dashed"
        borderColor="border.subtle"
        rounded="lg"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap={4}
        bg="surface.default"
      >
        <Box p={3} bg="tint.brandPrimary" rounded="lg" display="inline-flex" flexShrink={0}>
          <Icon as={Calendar} color="brand.primary" />
        </Box>
        <Box flex="1" minW={0}>
          <HStack justify="space-between" align="start" mb={1} spacing={3} flexWrap="wrap">
            <HStack spacing={2} flexWrap="wrap">
              {when && (
                <>
                  <Text fontWeight="bold" color="text.primary">
                    {formatDisplayDate(when)}
                  </Text>
                  <Text color="text.secondary">{format(when, 'h:mm a')}</Text>
                </>
              )}
              <Badge colorScheme={badge.scheme}>{badge.label}</Badge>
            </HStack>
            {when && (
              <Badge colorScheme={badge.scheme} variant="subtle">
                {relativeTime(when).replace('about ', '')}
              </Badge>
            )}
          </HStack>
          <Text color="text.primary">{session.topic}</Text>
          {session.requestMessage && (
            <Text fontSize="sm" color="text.secondary" mt={1}>
              {session.requestMessage}
            </Text>
          )}
          {session.declineReason && session.status === 'declined' && (
            <Text fontSize="sm" color="red.500" mt={1}>
              Reason: {session.declineReason}
            </Text>
          )}
          {session.cancellationReason && session.status === 'cancelled' && (
            <Text fontSize="sm" color="text.muted" mt={1}>
              Reason: {session.cancellationReason}
            </Text>
          )}
          {session.meetingLink && session.status === 'scheduled' && (
            <Link
              href={session.meetingLink}
              color="brand.primary"
              fontSize="sm"
              mt={1}
              isExternal
              display="inline-flex"
              alignItems="center"
              gap={1}
            >
              <Icon as={ExternalLink} boxSize={3} /> Join meeting
            </Link>
          )}
        </Box>
        {actions && <HStack spacing={2}>{actions}</HStack>}
      </Flex>
    )
  }

  const renderJourneyLockedTab = (title: string) => (
    <Card borderColor="border.subtle" borderWidth="1px" bg="surface.default">
      <CardBody>
        <Flex direction="column" align="center" textAlign="center" p={6} gap={3}>
          <Icon as={Lock} boxSize={10} color="text.muted" />
          <Heading size="sm">{title} unlocks on longer journeys</Heading>
          <Text color="text.secondary">
            Leadership Council pairings are part of the 3-month, 6-month, and 9-month programs.
            {currentJourneyLabel ? ` You're currently on the ${currentJourneyLabel}.` : ''}
          </Text>
        </Flex>
      </CardBody>
    </Card>
  )

  const pendingRequests = sessionsByStatus.requested
  const upcomingSessions = sessionsByStatus.scheduled
  const recentFinished = useMemo(
    () =>
      [...sessionsByStatus.completed, ...sessionsByStatus.declined, ...sessionsByStatus.cancelled]
        .sort((a, b) => {
          const aTime = (a.completedAt ?? a.updatedAt ?? a.createdAt)?.getTime() ?? 0
          const bTime = (b.completedAt ?? b.updatedAt ?? b.createdAt)?.getTime() ?? 0
          return bTime - aTime
        })
        .slice(0, 5),
    [sessionsByStatus.completed, sessionsByStatus.declined, sessionsByStatus.cancelled],
  )
  const hasAnySessions = sessions.length > 0

  const mentorSessionsSummary = useMemo(() => {
    if (sessionsLoading) return 'Checking your session history...'
    const mentorName = mentorProfile ? displayNameForProfile(mentorProfile) : 'your mentor'
    if (!hasAnySessions) {
      return `Request your first session with ${mentorName} to get points flowing.`
    }
    if (pendingRequests.length > 0) {
      return `${pendingRequests.length} request${pendingRequests.length === 1 ? '' : 's'} awaiting ${mentorName}`
    }
    if (upcomingSessions.length > 0) {
      return `${upcomingSessions.length} session${upcomingSessions.length === 1 ? '' : 's'} confirmed with ${mentorName}`
    }
    return `Your history with ${mentorName}`
  }, [hasAnySessions, mentorProfile, pendingRequests.length, sessionsLoading, upcomingSessions.length])
  const mentorLastInteraction = useMemo(
    () => formatOptionalIsoDate(mentorProfile?.lastInteraction),
    [mentorProfile?.lastInteraction],
  )

  if (!user) {
    return (
      <Card bg="surface.default" borderColor="border.subtle" borderWidth="1px">
        <CardBody>
          <Stack spacing={3} align="center" textAlign="center">
            <Icon as={UserCircle2} boxSize={10} color="text.muted" />
            <Heading size="md">Sign in to view your Leadership Council</Heading>
            <Text color="text.secondary">Create an account or sign in to connect with your mentor and ambassador.</Text>
          </Stack>
        </CardBody>
      </Card>
    )
  }

  return (
    <Stack spacing={6}>
      <Card
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="sm"
        borderRadius="2xl"
        overflow="hidden"
      >
        <Box h="3px" bg="#350e6f" />
        <CardBody px={{ base: 5, md: 7 }} py={{ base: 5, md: 6 }}>
          <Flex align={{ base: 'flex-start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
            <Box flex={1} minW={0}>
              <HStack spacing={2} mb={2} flexWrap="wrap">
                <Text
                  color="#350e6f"
                  textTransform="uppercase"
                  letterSpacing="0.16em"
                  fontSize="xs"
                  fontWeight="bold"
                >
                  Leadership Council
                </Text>
                {profile?.companyName && (
                  <>
                    <Box boxSize={1} borderRadius="full" bg="gray.300" />
                    <HStack spacing={1} color="gray.500">
                      <Icon as={Building2} boxSize={3} />
                      <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.04em">
                        {profile.companyName}
                      </Text>
                    </HStack>
                  </>
                )}
              </HStack>
              <Heading
                size="lg"
                color="#27062e"
                letterSpacing="-0.02em"
                fontWeight="bold"
                lineHeight="1.15"
                mb={1}
              >
                Your support team
              </Heading>
              <Text color="gray.600" fontSize="sm" lineHeight="1.6">
                Mentor, ambassador, and transformation partner — all in one place.
              </Text>
              {showOrgDebug && (
                <HStack spacing={3} mt={2} flexWrap="wrap">
                  <Text fontSize="xs" color="gray.500">ID: {organization.id ?? '—'}</Text>
                  <Text fontSize="xs" color="gray.500">Assignments: {supportAssignmentStatus.loaded ? (supportAssignmentStatus.exists ? 'Loaded' : 'None') : '…'}</Text>
                  <Text fontSize="xs" color="gray.500">Mentor: {assignmentSources.mentor ?? '—'}</Text>
                  <Text fontSize="xs" color="gray.500">Ambassador: {assignmentSources.ambassador ?? '—'}</Text>
                </HStack>
              )}
            </Box>
            <Button
              size="sm"
              flexShrink={0}
              leftIcon={<RefreshCcw size={14} />}
              variant="outline"
              borderColor="gray.300"
              color="gray.700"
              _hover={{ bg: 'gray.50', borderColor: '#350e6f', color: '#350e6f' }}
              onClick={retryAssignments}
              isLoading={assignmentsLoading}
            >
              Refresh
            </Button>
          </Flex>
        </CardBody>
      </Card>

      {!isLeadershipEligible && (
        <HStack
          spacing={3}
          bg="gray.50"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="xl"
          px={4}
          py={3}
          align="center"
        >
          <Icon as={Lock} color="#350e6f" boxSize={4} />
          <Text fontSize="sm" color="gray.700">
            <Text as="span" fontWeight="semibold" color="#27062e">
              Unlocks on 3M, 6M, and 9M journeys.
            </Text>
            {currentJourneyLabel ? ` You're on the ${currentJourneyLabel}.` : ''}
          </Text>
        </HStack>
      )}

      <Box
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="xl"
        px={{ base: 4, md: 5 }}
        py={4}
      >
        <Stack spacing={3}>
          <HStack justify="space-between" align="center" flexWrap="wrap" spacing={3}>
            <Text
              fontSize="xs"
              fontWeight="bold"
              textTransform="uppercase"
              letterSpacing="0.14em"
              color="gray.500"
            >
              Readiness
            </Text>
            {isLeadershipEligible && !assignmentsLoading && (
              <Text fontSize="xs" color="gray.600" fontWeight="medium">
                {gatingSteps.filter((s) => s.status === 'complete').length} of {gatingSteps.length} ready
              </Text>
            )}
          </HStack>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
            {gatingSteps.map((step) => {
              const tone =
                step.status === 'complete'
                  ? { bg: 'green.50', border: 'green.200', color: 'green.700', icon: 'green.500' }
                  : step.status === 'pending'
                    ? { bg: 'yellow.50', border: 'yellow.200', color: 'yellow.800', icon: 'yellow.500' }
                    : { bg: 'gray.50', border: 'gray.200', color: 'gray.500', icon: 'gray.400' }
              return (
                <Tooltip key={step.id} label={step.description} placement="top" hasArrow openDelay={200}>
                  <HStack
                    spacing={2}
                    bg={tone.bg}
                    border="1px solid"
                    borderColor={tone.border}
                    borderRadius="md"
                    px={3}
                    py={2}
                    align="center"
                    cursor="default"
                  >
                    <Icon as={gateStatusIcon(step.status)} color={tone.icon} boxSize={3.5} />
                    <Text fontSize="xs" fontWeight="semibold" color={tone.color} noOfLines={1}>
                      {step.title.replace(' ready', '').replace(' linked', '').replace(' checked', '')}
                    </Text>
                  </HStack>
                </Tooltip>
              )
            })}
          </SimpleGrid>
        </Stack>
      </Box>

      <Grid templateColumns="1fr" gap={6} alignItems="start">
        <GridItem>
          <Tabs
            variant="unstyled"
            colorScheme="primary"
            isLazy
            defaultIndex={isLeadershipEligible ? 0 : 2}
          >
            <TabList
              border="1px solid"
              borderColor="border.subtle"
              rounded="lg"
              p={1}
              bg="surface.default"
              gap={1}
              overflowX="auto"
            >
              <Tooltip
                label={journeyLockReason ?? ''}
                placement="top"
                isDisabled={isLeadershipEligible}
              >
                <Tab
                  whiteSpace="nowrap"
                  fontWeight="semibold"
                  rounded="md"
                  isDisabled={!isLeadershipEligible}
                  _selected={{ bg: 'brand.primary', color: 'text.inverse' }}
                  _disabled={{
                    color: 'text.muted',
                    bg: 'surface.subtle',
                    cursor: 'not-allowed',
                    opacity: 0.6,
                  }}
                >
                  <HStack spacing={2}>
                    {!isLeadershipEligible && <Icon as={Lock} boxSize={3} />}
                    <Text as="span">Mentor</Text>
                  </HStack>
                </Tab>
              </Tooltip>
              <Tooltip
                label={journeyLockReason ?? ''}
                placement="top"
                isDisabled={isLeadershipEligible}
              >
                <Tab
                  whiteSpace="nowrap"
                  fontWeight="semibold"
                  rounded="md"
                  isDisabled={!isLeadershipEligible}
                  _selected={{ bg: 'brand.primary', color: 'text.inverse' }}
                  _disabled={{
                    color: 'text.muted',
                    bg: 'surface.subtle',
                    cursor: 'not-allowed',
                    opacity: 0.6,
                  }}
                >
                  <HStack spacing={2}>
                    {!isLeadershipEligible && <Icon as={Lock} boxSize={3} />}
                    <Text as="span">Ambassador</Text>
                  </HStack>
                </Tab>
              </Tooltip>
              <Tab
                whiteSpace="nowrap"
                fontWeight="semibold"
                rounded="md"
                _selected={{ bg: 'brand.primary', color: 'text.inverse' }}
              >
                Transformation Partner
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel px={0} pt={4}>
                {!isLeadershipEligible ? (
                  renderJourneyLockedTab('Mentor Assignment')
                ) : (
                <Card borderColor="gray.200" borderWidth="1px" bg="white" borderRadius="2xl">
                  <CardHeader pb={0}>
                    <HStack justify="space-between" align="start" spacing={4}>
                      <Stack spacing={2} flex="1" minW={0}>
                        <Text
                          fontSize="xs"
                          textTransform="uppercase"
                          color="#350e6f"
                          fontWeight="bold"
                          letterSpacing="0.14em"
                        >
                          {isSamePerson ? 'Mentor & Ambassador' : 'Mentor'}
                        </Text>
                        <Heading size="md" color="#27062e" letterSpacing="-0.01em">
                          {mentorProfile ? displayNameForProfile(mentorProfile) : 'No mentor assigned'}
                        </Heading>
                        <HStack spacing={2} flexWrap="wrap">
                          {mentorProfile?.availabilityStatus && (
                            <Badge colorScheme={badgeColor(mentorProfile.availabilityStatus)} variant="subtle">
                              {mentorProfile.availabilityStatus}
                            </Badge>
                          )}
                          {mentorSourceLabel && (
                            <Badge colorScheme="purple" variant="subtle">
                              {mentorSourceLabel}
                            </Badge>
                          )}
                        </HStack>
                      </Stack>
                      <Avatar
                        size="lg"
                        name={mentorProfile ? displayNameForProfile(mentorProfile) : undefined}
                        src={mentorProfile?.avatarUrl}
                        bg="#350e6f"
                      />
                    </HStack>
                  </CardHeader>
                  <CardBody pt={4}>
                    {assignmentsLoading && (
                      <Flex direction="column" gap={3} p={4} border="1px dashed" borderColor="border.subtle" rounded="xl">
                        <Spinner />
                        <Text color="text.secondary">Loading your mentor assignment...</Text>
                      </Flex>
                    )}

                    {mentorError && (
                      <Alert status="error" rounded="lg" mb={4}>
                        <AlertIcon />
                        <Box>
                          <AlertTitle>We couldn't load your mentor right now.</AlertTitle>
                          <AlertDescription>{mentorError}</AlertDescription>
                        </Box>
                        <Button size="sm" leftIcon={<RefreshCcw size={16} />} ml={4} onClick={retryAssignments}>
                          Try again
                        </Button>
                      </Alert>
                    )}

                    {!assignmentsLoading && !mentorProfile && !mentorError && (
                      <Flex direction="column" align="center" textAlign="center" p={6} gap={2}>
                        <Icon as={User} boxSize={9} color="gray.400" />
                        <Heading size="sm" color="#27062e">No mentor assigned</Heading>
                        <Text color="gray.600" fontSize="sm">
                          {hasOrganization
                            ? 'Ask your admin to assign one.'
                            : 'Link your account to an organisation first.'}
                        </Text>
                      </Flex>
                    )}

                    {mentorProfile && (
                      <Stack spacing={4}>
                        <Box
                          p={4}
                          border="1px solid"
                          borderColor="gray.200"
                          rounded="lg"
                          bg="gray.50"
                        >
                          <HStack justify="space-between" align="center" mb={2} flexWrap="wrap" spacing={3}>
                            <HStack spacing={2}>
                              <Icon as={Target} color="#350e6f" boxSize={4} />
                              <Text fontWeight="bold" color="#27062e">
                                Your goals
                              </Text>
                            </HStack>
                            {goalsUpdatedAt && (
                              <Badge variant="subtle" colorScheme="purple">
                                Updated {formatDistanceToNow(goalsUpdatedAt, { addSuffix: true })}
                              </Badge>
                            )}
                          </HStack>
                          <Text fontSize="xs" color="gray.600" mb={3} lineHeight="1.6">
                            What do you want from this mentorship? Your mentor tailors sessions to this.
                          </Text>
                          {goalsLoading ? (
                            <Flex
                              align="center"
                              gap={3}
                              p={4}
                              border="1px dashed"
                              borderColor="border.subtle"
                              rounded="lg"
                              bg="surface.default"
                            >
                              <Spinner size="sm" />
                              <Text color="text.secondary">Loading your saved goals...</Text>
                            </Flex>
                          ) : (
                            <>
                              {goalsError && (
                                <Alert status="warning" rounded="lg" mb={3}>
                                  <AlertIcon />
                                  <Box>
                                    <AlertTitle>We couldn&apos;t sync your goals.</AlertTitle>
                                    <AlertDescription>{goalsError}</AlertDescription>
                                  </Box>
                                </Alert>
                              )}
                              <FormControl isInvalid={goalsTooLong}>
                                <Textarea
                                  placeholder="What outcomes do you want from this mentorship? What skills, behaviours, or leadership moves are you growing into?"
                                  value={goalsDraft}
                                  onChange={(event) => setGoalsDraft(event.target.value)}
                                  rows={5}
                                  bg="surface.default"
                                />
                                <FormHelperText>
                                  {goalsDraft.length}/{MENTORSHIP_GOALS_MAX_LENGTH} characters
                                  {goalsTooLong ? ' — please shorten your goals to save.' : ''}
                                </FormHelperText>
                              </FormControl>
                              <HStack justify="flex-end" mt={3} spacing={2}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setGoalsDraft(savedGoals)}
                                  isDisabled={!goalsDirty || goalsSaving}
                                >
                                  Reset
                                </Button>
                                <Button
                                  colorScheme="primary"
                                  size="sm"
                                  onClick={handleSaveGoals}
                                  isLoading={goalsSaving}
                                  isDisabled={!goalsDirty || goalsTooLong}
                                >
                                  Save goals
                                </Button>
                              </HStack>
                            </>
                          )}
                        </Box>

                        <HStack spacing={3} flexWrap="wrap">
                          <Tooltip
                            label={scheduleDisabledReason || 'Send a request to your mentor'}
                            placement="top"
                          >
                            <Button
                              leftIcon={<Calendar size={18} />}
                              colorScheme="primary"
                              isDisabled={!canScheduleSession || scheduleSubmitting}
                              onClick={scheduleModal.onOpen}
                            >
                              Request a session
                            </Button>
                          </Tooltip>
                          {hasAnySessions && (
                            <Button
                              leftIcon={<Eye size={18} />}
                              variant="outline"
                              onClick={sessionsModal.onOpen}
                            >
                              View all ({sessions.length})
                            </Button>
                          )}
                        </HStack>

                        <Box p={4} border="1px solid" borderColor="gray.200" rounded="lg" bg="gray.50">
                          <HStack justify="space-between" align="center" mb={3} flexWrap="wrap" spacing={3}>
                            <Text fontWeight="bold" color="#27062e">
                              Sessions
                            </Text>
                            <Text fontSize="xs" color="gray.600">
                              {mentorSessionsSummary}
                            </Text>
                          </HStack>

                          {sessionsLoading && (
                            <Flex
                              align="center"
                              gap={3}
                              p={4}
                              border="1px dashed"
                              borderColor="border.subtle"
                              rounded="lg"
                              bg="surface.default"
                            >
                              <Spinner />
                              <Text>Checking for sessions...</Text>
                            </Flex>
                          )}

                          {sessionsError && (
                            <Alert status="warning" colorScheme="warning" rounded="lg" mb={3}>
                              <AlertIcon />
                              <Box>
                                <AlertTitle>We couldn&apos;t load your sessions.</AlertTitle>
                                <AlertDescription>{sessionsError}</AlertDescription>
                              </Box>
                            </Alert>
                          )}

                          {!sessionsLoading && !sessionsError && !hasAnySessions && (
                            <Flex
                              direction="column"
                              align="center"
                              textAlign="center"
                              p={5}
                              gap={2}
                              border="1px dashed"
                              borderColor="gray.200"
                              rounded="lg"
                              bg="white"
                            >
                              <Icon as={Calendar} color="gray.400" boxSize={6} />
                              <Text fontWeight="semibold" color="#27062e">No sessions yet</Text>
                              <Text fontSize="xs" color="gray.500">
                                Propose a time. Your mentor confirms.
                              </Text>
                            </Flex>
                          )}

                          {!sessionsLoading && !sessionsError && hasAnySessions && (
                            <Stack spacing={5}>
                              {pendingRequests.length > 0 && (
                                <Box>
                                  <Text
                                    fontSize="xs"
                                    textTransform="uppercase"
                                    color="text.muted"
                                    fontWeight="semibold"
                                    mb={2}
                                  >
                                    Awaiting mentor ({pendingRequests.length})
                                  </Text>
                                  <Stack spacing={3}>
                                    {pendingRequests.map((session) =>
                                      renderSessionRow(
                                        session,
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          colorScheme="red"
                                          onClick={() => handleCancelSession(session)}
                                          isLoading={cancellingSessionId === session.id}
                                        >
                                          Withdraw
                                        </Button>,
                                      ),
                                    )}
                                  </Stack>
                                </Box>
                              )}

                              {upcomingSessions.length > 0 && (
                                <Box>
                                  <Text
                                    fontSize="xs"
                                    textTransform="uppercase"
                                    color="text.muted"
                                    fontWeight="semibold"
                                    mb={2}
                                  >
                                    Confirmed ({upcomingSessions.length})
                                  </Text>
                                  <Stack spacing={3}>
                                    {upcomingSessions.map((session) =>
                                      renderSessionRow(
                                        session,
                                        <>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            leftIcon={<Download size={16} />}
                                            onClick={() => downloadIcs(session)}
                                          >
                                            ICS
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            colorScheme="red"
                                            onClick={() => handleCancelSession(session)}
                                            isLoading={cancellingSessionId === session.id}
                                          >
                                            Cancel
                                          </Button>
                                        </>,
                                      ),
                                    )}
                                  </Stack>
                                </Box>
                              )}

                              {recentFinished.length > 0 && (
                                <Box>
                                  <Text
                                    fontSize="xs"
                                    textTransform="uppercase"
                                    color="text.muted"
                                    fontWeight="semibold"
                                    mb={2}
                                  >
                                    Recent history
                                  </Text>
                                  <Stack spacing={3}>
                                    {recentFinished.map((session) => renderSessionRow(session))}
                                  </Stack>
                                </Box>
                              )}
                            </Stack>
                          )}

                          {mentorLastInteraction && (
                            <Text mt={3} fontSize="sm" color="text.muted">
                              Last interaction: {mentorLastInteraction}
                            </Text>
                          )}
                        </Box>
                      </Stack>
                    )}
                  </CardBody>
                </Card>
                )}
              </TabPanel>

              <TabPanel px={0} pt={4}>
                {!isLeadershipEligible ? (
                  renderJourneyLockedTab('Ambassador Assignment')
                ) : (
                <Card borderColor="gray.200" borderWidth="1px" bg="white" borderRadius="2xl">
                  <CardHeader pb={0}>
                    <HStack justify="space-between" align="start" spacing={4}>
                      <Stack spacing={2} flex="1" minW={0}>
                        <Text
                          fontSize="xs"
                          textTransform="uppercase"
                          color="#350e6f"
                          fontWeight="bold"
                          letterSpacing="0.14em"
                        >
                          Ambassador
                        </Text>
                        <Heading size="md" color="#27062e" letterSpacing="-0.01em">
                          {ambassadorProfile ? displayNameForProfile(ambassadorProfile) : 'No ambassador assigned'}
                        </Heading>
                        {ambassadorProfile?.availabilityStatus && (
                          <Badge
                            colorScheme={badgeColor(ambassadorProfile.availabilityStatus)}
                            variant="subtle"
                            alignSelf="flex-start"
                          >
                            {ambassadorProfile.availabilityStatus}
                          </Badge>
                        )}
                      </Stack>
                      {ambassadorProfile && (
                        <Avatar
                          size="lg"
                          name={displayNameForProfile(ambassadorProfile)}
                          src={ambassadorProfile.avatarUrl}
                          bg="#350e6f"
                        />
                      )}
                    </HStack>
                  </CardHeader>
                  <CardBody>
                    {assignmentsLoading && (
                      <Flex align="center" gap={3} p={4} border="1px dashed" borderColor="gray.200" rounded="xl">
                        <Spinner size="sm" />
                        <Text color="gray.600" fontSize="sm">Loading ambassador…</Text>
                      </Flex>
                    )}

                    {ambassadorError && (
                      <Alert status="warning" rounded="lg" mb={4}>
                        <AlertIcon />
                        <Box>
                          <AlertTitle>Couldn't load ambassador.</AlertTitle>
                          <AlertDescription>{ambassadorError}</AlertDescription>
                        </Box>
                        <Button size="sm" leftIcon={<RefreshCcw size={16} />} ml={4} onClick={retryAssignments}>
                          Try again
                        </Button>
                      </Alert>
                    )}

                    {!assignmentsLoading && !ambassadorProfile && !ambassadorError && (
                      <Flex direction="column" align="center" textAlign="center" p={6} gap={2}>
                        <Icon as={User} boxSize={9} color="gray.400" />
                        <Heading size="sm" color="#27062e">No ambassador assigned</Heading>
                        <Text color="gray.600" fontSize="sm">
                          {hasOrganization
                            ? 'Ask your admin to assign one.'
                            : 'Link your account to an organisation first.'}
                        </Text>
                      </Flex>
                    )}

                    {ambassadorProfile && isSamePerson && (
                      <Text fontSize="sm" color="gray.600" mt={2}>
                        Your mentor is also your ambassador for this programme.
                      </Text>
                    )}

                    {profile?.id && (
                      <>
                        <Divider my={5} />
                        <LearnerAmbassadorBookings
                          learnerId={profile.id}
                          learnerName={displayNameForProfile(profile)}
                          companyId={profile.companyId ?? null}
                        />
                      </>
                    )}
                  </CardBody>
                </Card>
                )}
              </TabPanel>

              <TabPanel px={0} pt={4}>
                {!isLeadershipEligible ? (
                  renderJourneyLockedTab('Transformation Partner')
                ) : (
                <Card borderColor="gray.200" borderWidth="1px" bg="white" borderRadius="2xl">
                  <CardHeader pb={2}>
                    <Stack spacing={2}>
                      <Text
                        fontSize="xs"
                        textTransform="uppercase"
                        color="#350e6f"
                        fontWeight="bold"
                        letterSpacing="0.14em"
                      >
                        Transformation Partner
                      </Text>
                      <Heading size="md" color="#27062e" letterSpacing="-0.01em">
                        Programme support
                      </Heading>
                    </Stack>
                  </CardHeader>
                  <CardBody>
                    {partnerLoading && (
                      <Flex direction="column" align="center" gap={3} p={6}>
                        <Spinner />
                        <Text color="text.secondary">Loading transformation partner...</Text>
                      </Flex>
                    )}
                    {!partnerLoading && partnerProfile && (
                      <Stack spacing={4}>
                        <HStack justify="space-between" align="start" spacing={4} flexWrap="wrap">
                          <HStack spacing={3} align="start">
                            <Avatar
                              size="lg"
                              name={displayNameForProfile(partnerProfile)}
                              src={partnerProfile.avatarUrl}
                              bg="brand.primary"
                            />
                            <Box>
                              <Heading size="sm">{displayNameForProfile(partnerProfile)}</Heading>
                              <Text color="text.secondary">{partnerProfile.title || 'Transformation Partner'}</Text>
                              <Text color="text.muted" fontSize="sm">
                                {partnerProfile.officeLocation || partnerProfile.timezone || 'Global support'}
                              </Text>
                            </Box>
                          </HStack>
                          <HStack spacing={3}>
                            {partnerProfile.rating && (
                              <Badge colorScheme="secondary" variant="subtle">
                                Rating {partnerProfile.rating.toFixed(1)} / 5 ({partnerProfile.ratingCount || 0} reviews)
                              </Badge>
                            )}
                            {partnerProfile.xp && (
                              <Badge colorScheme="primary" variant="subtle">
                                XP {partnerProfile.xp.toLocaleString()}
                              </Badge>
                            )}
                          </HStack>
                        </HStack>

                        <Text color="gray.700" fontSize="sm" lineHeight="1.65">
                          {partnerProfile.bio || 'Dedicated programme partner.'}
                        </Text>

                        <Divider />

                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                          <Box>
                            <HStack spacing={2}>
                              <Icon as={Timer} color="text.muted" />
                              <Text color="text.secondary">Local time: {partnerProfile.timezone || 'Not provided'}</Text>
                            </HStack>
                            {partnerProfile.email && (
                              <HStack spacing={2} mt={2}>
                                <Icon as={ExternalLink} color="text.muted" />
                                <Link href={`mailto:${partnerProfile.email}`} color="brand.primary">
                                  {displayNameForProfile(partnerProfile) === partnerProfile.email ? 'Send email' : partnerProfile.email}
                                </Link>
                              </HStack>
                            )}
                          </Box>
                          <Stack spacing={2}>
                            {partnerProfile.hobbies && partnerProfile.hobbies.length > 0 && (
                              <Text color="text.secondary">Hobbies: {partnerProfile.hobbies.join(', ')}</Text>
                            )}
                            {partnerProfile.funFact && <Text color="text.secondary">Fun fact: {partnerProfile.funFact}</Text>}
                            {partnerProfile.favoritePillar && (
                              <Text color="text.secondary">Favorite LIFT pillar: {partnerProfile.favoritePillar}</Text>
                            )}
                          </Stack>
                        </SimpleGrid>
                      </Stack>
                    )}
                    {!partnerLoading && !partnerProfile && (
                      <Flex direction="column" align="center" gap={2} p={6} textAlign="center">
                        <Icon as={Shield} boxSize={9} color="gray.400" />
                        <Heading size="sm" color="#27062e">Partner not set up</Heading>
                        <Text color="gray.600" fontSize="sm">
                          {partnerError || 'Ask your admin to set up your partner profile.'}
                        </Text>
                        <Button size="sm" leftIcon={<RefreshCcw size={16} />} onClick={retryAssignments} mt={1}>
                          Try again
                        </Button>
                      </Flex>
                    )}
                  </CardBody>
                </Card>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </GridItem>
      </Grid>

      <Modal isOpen={sessionsModal.isOpen} onClose={sessionsModal.onClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack spacing={3}>
              <Box p={2} bg="tint.brandPrimary" rounded="lg">
                <Icon as={Calendar} color="brand.primary" />
              </Box>
              <Box>
                <Heading size="md">All mentor sessions</Heading>
                <Text color="text.secondary">
                  Your full history with {mentorProfile ? displayNameForProfile(mentorProfile) : 'your mentor'}
                </Text>
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {!hasAnySessions ? (
              <Flex
                direction="column"
                align="center"
                gap={2}
                p={6}
                border="1px dashed"
                borderColor="border.subtle"
                rounded="lg"
                bg="surface.subtle"
              >
                <Icon as={Calendar} color="text.muted" />
                <Heading size="sm">No sessions yet</Heading>
                <Text color="text.secondary" textAlign="center">
                  Request a session to get started.
                </Text>
              </Flex>
            ) : (
              <Stack spacing={3} maxH="60vh" overflowY="auto" pr={2}>
                {sessions.map((session) => renderSessionRow(session))}
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={sessionsModal.onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={scheduleModal.isOpen} onClose={scheduleModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader bg="brand.primary" color="text.inverse" borderTopRadius="lg">
            <HStack spacing={3}>
              <Icon as={Calendar} />
              <Box>
                <Heading size="md">Request a mentorship session</Heading>
                <Text color="text.inverse" fontSize="sm">
                  Your time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </Text>
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton color="text.inverse" />
          <ModalBody pt={4}>
            <Stack spacing={4}>
              <HStack
                spacing={3}
                bg="purple.50"
                border="1px solid"
                borderColor="purple.100"
                borderRadius="md"
                px={3}
                py={2}
                align="center"
              >
                <Icon as={Shield} color="#350e6f" boxSize={4} />
                <Text fontSize="xs" color="gray.700">
                  Propose a time. Your mentor confirms or suggests another. Points awarded after the session.
                </Text>
              </HStack>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl isRequired>
                  <FormLabel>Proposed date</FormLabel>
                  <Input
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Proposed time</FormLabel>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </FormControl>
              </SimpleGrid>

              <FormControl isRequired>
                <FormLabel>Topic</FormLabel>
                <Input
                  placeholder="What do you want to discuss in this session?"
                  value={scheduleTopic}
                  onChange={(e) => setScheduleTopic(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Message to mentor (optional)</FormLabel>
                <Textarea
                  placeholder="Share any context — what you&apos;re working through, what you&apos;d like to get out of the session, anything they should review beforehand."
                  value={scheduleMessage}
                  onChange={(e) => setScheduleMessage(e.target.value)}
                  rows={4}
                />
                <FormHelperText>
                  Your saved mentorship goals will also be shared with this request.
                </FormHelperText>
              </FormControl>

              {mentorProfile?.availabilityStatus && (
                <Text fontSize="sm" color="text.muted">
                  Mentor typically available: {mentorProfile.availabilityStatus}
                </Text>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={scheduleModal.onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="primary"
              onClick={handleRequestSession}
              isLoading={scheduleSubmitting}
            >
              Send request
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}

