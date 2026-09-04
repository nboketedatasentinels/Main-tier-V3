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
  Collapse,
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
  Calendar,
  Download,
  Eye,
  ExternalLink,
  Lock,
  RefreshCcw,
  Shield,
  User,
  UserCircle2,
} from 'lucide-react'
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationLeadership } from '@/hooks/useOrganizationLeadership'
import { useMentorshipGoals } from '@/hooks/useMentorshipGoals'
import { LeaderSessionPrep } from '@/components/session-prep/LeaderSessionPrep'
import { useLearnerMentorshipSessions } from '@/hooks/useMentorshipSessions'
import {
  cancelMentorshipSession,
  createMentorshipSessionRequest,
  type MentorshipSession,
} from '@/services/mentorshipService'
import { LearnerAmbassadorBookings } from '@/components/learner/LearnerAmbassadorBookings'
import { MentorshipGoalsCard } from '@/components/leadership/MentorshipGoalsCard'
import { getDisplayName } from '@/utils/displayName'
import { buildGoogleCalendarUrl, buildIcsCalendar, downloadIcsFile } from '@/utils/meetingInvite'
import { getJourneyLabel, isLeadershipCouncilJourney, isPartnerVisibleJourney } from '@/utils/journeyType'
import { requiresMandatoryLiftAssessment } from '@/utils/liftRequirement'
import { hasCompletedLiftAssessment } from '@/services/liftAssessmentService'
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
    pending,
  } = useOrganizationLeadership(profile?.companyId, profile?.id, profile)
  const mentorProfile = profiles.mentor as LeadershipProfile | null
  const ambassadorProfile = profiles.ambassador as LeadershipProfile | null
  const partnerProfile = profiles.partner as PartnerProfile | null
  const pendingPartnerEmail = pending.partnerEmail
  const pendingMentorEmail = pending.mentorEmail
  const pendingAmbassadorEmail = pending.ambassadorEmail
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
  } = useLearnerMentorshipSessions(mentorProfile?.id ? profile?.id ?? null : null)
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null)

  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleTopic, setScheduleTopic] = useState('')
  const [scheduleMessage, setScheduleMessage] = useState('')
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  const [showSessionContext, setShowSessionContext] = useState(false)
  const [goalsDraft, setGoalsDraft] = useState('')
  const [goalsInitialized, setGoalsInitialized] = useState(false)
  const [liftCompleted, setLiftCompleted] = useState<boolean | null>(null)

  const liftRequired = requiresMandatoryLiftAssessment({
    role: profile?.role,
    journeyType: profile?.journeyType,
  })

  useEffect(() => {
    let active = true
    if (!liftRequired || !profile?.id) {
      setLiftCompleted(true)
      return
    }
    setLiftCompleted(null)
    hasCompletedLiftAssessment(profile.id)
      .then((done) => {
        if (active) setLiftCompleted(done)
      })
      .catch(() => {
        // Fail open for scheduling checks if the lookup errors.
        if (active) setLiftCompleted(true)
      })
    return () => {
      active = false
    }
  }, [liftRequired, profile?.id])

  const sessionsModal = useDisclosure()
  const scheduleModal = useDisclosure()

  const hasOrganization = Boolean(profile?.companyId)
  const organizationReady = organization.loaded && organization.exists
  const supportAssignmentsReady = supportAssignmentStatus.loaded
  const showOrgDebug = import.meta.env.DEV && (organization.id || supportAssignmentStatus.id)
  const isLeadershipEligible = isLeadershipCouncilJourney(profile?.journeyType)
  const isPartnerVisible = isPartnerVisibleJourney(profile?.journeyType)
  const journeyLockReason = !isLeadershipEligible
    ? 'Mentor and Coach unlock on 3-month, 6-month, and 9-month journeys.'
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
    !assignmentsLoading &&
    (!liftRequired || liftCompleted === true)
  const scheduleDisabledReason = !isLeadershipEligible
    ? journeyLockReason
    : liftRequired && liftCompleted === false
      ? 'Complete your LIFT assessment first - it unlocks mentor and coach sessions.'
      : liftRequired && liftCompleted === null
        ? 'Checking your LIFT assessment…'
        : !hasOrganization
          ? 'Link your account to an organization to unlock mentor scheduling.'
          : !organizationReady
            ? 'We are still confirming your organization details.'
            : !supportAssignmentsReady
              ? 'Support assignments are still loading.'
              : !mentorProfile
                ? 'A mentor must be assigned before scheduling.'
                : null

  const { goals: savedGoals, loading: goalsLoading } = useMentorshipGoals(
    isLeadershipEligible ? profile?.id ?? null : null,
    mentorProfile?.id ?? null,
  )

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

  const handleGoalsSaved = useCallback((next: string) => {
    setGoalsDraft(next)
    setGoalsInitialized(true)
  }, [])

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

  const openGoogleCalendar = (session: MentorshipSession) => {
    const start = session.scheduledAt ?? session.proposedAt
    if (!start) {
      toast({ title: 'No session time set yet', status: 'warning' })
      return
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const title = `Mentorship session with ${mentorProfile ? displayNameForProfile(mentorProfile) : 'Mentor'}`
    const googleUrl = buildGoogleCalendarUrl({
      title,
      start,
      end,
      description: `${session.topic}${session.meetingLink ? `\nJoin: ${session.meetingLink}` : ''}`,
      location: session.meetingLink || undefined,
    })
    window.open(googleUrl, '_blank', 'noopener,noreferrer')
  }

  const downloadIcs = (session: MentorshipSession) => {
    const start = session.scheduledAt ?? session.proposedAt
    if (!start) {
      toast({ title: 'No session time set yet', status: 'warning' })
      return
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const title = `Mentorship session with ${mentorProfile ? displayNameForProfile(mentorProfile) : 'Mentor'}`
    const ics = buildIcsCalendar({
      title,
      start,
      end,
      description: `${session.topic}${session.requestMessage ? `\n${session.requestMessage}` : ''}${
        session.meetingLink ? `\nJoin: ${session.meetingLink}` : ''
      }`,
      location: session.meetingLink || 'Virtual meeting',
      uid: `mentorship-${session.id}@t4leader.com`,
    })
    downloadIcsFile(ics, 'mentorship-session.ics')
  }

  const sessionCalendarActions = (session: MentorshipSession) => (
    <>
      <Button
        size="sm"
        variant="outline"
        leftIcon={<Calendar size={16} />}
        onClick={() => openGoogleCalendar(session)}
      >
        Add to Google
      </Button>
      <Button size="sm" variant="ghost" leftIcon={<Download size={16} />} onClick={() => downloadIcs(session)}>
        Add to Outlook / Apple
      </Button>
    </>
  )

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

  const renderJourneyLockedTab = (title: string, availableFromLabel = '3-month, 6-month, and 9-month journeys') => (
    <Card borderColor="gray.200" borderWidth="1px" bg="white" borderRadius="2xl">
      <CardBody>
        <Flex direction="column" align="center" textAlign="center" p={6} gap={2}>
          <Icon as={Lock} boxSize={9} color="gray.400" />
          <Heading size="sm" color="#27062e">{title} unlocks on longer journeys</Heading>
          <Text color="gray.600" fontSize="sm">
            Available on {availableFromLabel}.
            {currentJourneyLabel ? ` You're on the ${currentJourneyLabel}.` : ''}
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
            <Text color="text.secondary">Create an account or sign in to connect with your mentor and coach.</Text>
          </Stack>
        </CardBody>
      </Card>
    )
  }

  return (
    <Stack spacing={4}>
      <Card
        bgGradient="linear(to-r, #350e6f, #8b5a3c)"
        border="none"
        boxShadow="sm"
        borderRadius="2xl"
        overflow="hidden"
      >
        <CardBody px={{ base: 4, md: 6 }} py={{ base: 3, md: 4 }}>
          <Flex align="center" gap={3} justify="space-between" flexWrap="wrap">
            <Box minW={0}>
              <Text
                color="whiteAlpha.900"
                textTransform="uppercase"
                letterSpacing="0.14em"
                fontSize="xs"
                fontWeight="bold"
              >
                Leadership Council
                {profile?.companyName ? ` · ${profile.companyName}` : ''}
              </Text>
              <Heading size="md" color="white" letterSpacing="-0.02em" mt={0.5} lineHeight="1.2">
                Prep your goal, then meet your mentor
              </Heading>
            </Box>
            <Button
              size="sm"
              flexShrink={0}
              leftIcon={<RefreshCcw size={14} />}
              bg="whiteAlpha.200"
              color="white"
              border="1px solid"
              borderColor="whiteAlpha.300"
              _hover={{ bg: 'whiteAlpha.300' }}
              onClick={retryAssignments}
              isLoading={assignmentsLoading}
            >
              Refresh
            </Button>
          </Flex>
          {showOrgDebug && (
            <HStack spacing={3} mt={2} flexWrap="wrap">
              <Text fontSize="xs" color="whiteAlpha.700">ID: {organization.id ?? '-'}</Text>
              <Text fontSize="xs" color="whiteAlpha.700">Assignments: {supportAssignmentStatus.loaded ? (supportAssignmentStatus.exists ? 'Loaded' : 'None') : '…'}</Text>
              <Text fontSize="xs" color="whiteAlpha.700">Mentor: {assignmentSources.mentor ?? '-'}</Text>
              <Text fontSize="xs" color="whiteAlpha.700">Coach: {assignmentSources.ambassador ?? '-'}</Text>
            </HStack>
          )}
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
              {isPartnerVisible
                ? 'Mentor and Coach unlock on 3M, 6M, and 9M journeys.'
                : 'Unlocks on 3M, 6M, and 9M journeys.'}
            </Text>
            {isPartnerVisible
              ? ' Your Transformation Partner is available below.'
              : currentJourneyLabel
                ? ` You're on the ${currentJourneyLabel}.`
                : ''}
          </Text>
        </HStack>
      )}

      {isLeadershipEligible && liftRequired && liftCompleted === false && (
        <Alert status="warning" borderRadius="xl" variant="left-accent">
          <AlertIcon />
          <Box>
            <AlertTitle>LIFT assessment required</AlertTitle>
            <AlertDescription>
              Complete your LIFT Index to unlock mentor scheduling, coach bookings, and Session Prep
              for your leadership team.
            </AlertDescription>
          </Box>
        </Alert>
      )}

      <Grid templateColumns="1fr" gap={6} alignItems="start">
        <GridItem>
          <Tabs
            variant="unstyled"
            colorScheme="primary"
            isLazy
            defaultIndex={isLeadershipEligible ? 2 : 0}
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
              <Tab
                whiteSpace="nowrap"
                fontWeight="semibold"
                rounded="md"
                color="text.primary"
                _selected={{
                  bg: 'brand.primary',
                  color: 'white',
                  '& *': { color: 'white' },
                }}
              >
                Transformation Partner
              </Tab>
              <Tooltip
                label={journeyLockReason ?? ''}
                placement="top"
                isDisabled={isLeadershipEligible}
              >
                <Tab
                  whiteSpace="nowrap"
                  fontWeight="semibold"
                  rounded="md"
                  color="text.primary"
                  isDisabled={!isLeadershipEligible}
                  _selected={{
                    bg: 'brand.primary',
                    color: 'white',
                    '& *': { color: 'white' },
                  }}
                  _disabled={{
                    color: 'text.muted',
                    bg: 'surface.subtle',
                    cursor: 'not-allowed',
                    opacity: 0.6,
                  }}
                >
                  <HStack spacing={2}>
                    {!isLeadershipEligible && <Icon as={Lock} boxSize={3} color="inherit" />}
                    <Text as="span" color="inherit">
                      Coach
                    </Text>
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
                  color="text.primary"
                  isDisabled={!isLeadershipEligible}
                  _selected={{
                    bg: 'brand.primary',
                    color: 'white',
                    '& *': { color: 'white' },
                  }}
                  _disabled={{
                    color: 'text.muted',
                    bg: 'surface.subtle',
                    cursor: 'not-allowed',
                    opacity: 0.6,
                  }}
                >
                  <HStack spacing={2}>
                    {!isLeadershipEligible && <Icon as={Lock} boxSize={3} color="inherit" />}
                    <Text as="span" color="inherit">
                      Mentor
                    </Text>
                  </HStack>
                </Tab>
              </Tooltip>
            </TabList>

            <TabPanels>
              <TabPanel px={0} pt={4}>
                {!isPartnerVisible ? (
                  renderJourneyLockedTab(
                    'Transformation Partner',
                    '6-week, 3-month, 6-month, and 9-month journeys',
                  )
                ) : (
                <Card borderColor="gray.200" borderWidth="1px" bg="white" borderRadius="2xl" overflow="hidden">
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
                        {partnerProfile
                          ? displayNameForProfile(partnerProfile)
                          : pendingPartnerEmail
                            ? pendingPartnerEmail
                            : 'No partner assigned'}
                      </Heading>
                    </Stack>
                  </CardHeader>
                  <CardBody>
                    {partnerLoading && (
                      <Flex direction="column" align="center" gap={3} p={6}>
                        <Spinner color="#350e6f" />
                        <Text color="gray.600">Loading transformation partner...</Text>
                      </Flex>
                    )}
                    {!partnerLoading && partnerProfile && (
                      <Stack spacing={4}>
                        <HStack justify="space-between" align="center" spacing={4} flexWrap="wrap">
                          <HStack spacing={3} align="center">
                            <Avatar
                              size="lg"
                              name={displayNameForProfile(partnerProfile)}
                              src={partnerProfile.avatarUrl}
                              bg="#350e6f"
                            />
                            <Stack spacing={0.5}>
                              <Text color="gray.800" fontSize="sm" fontWeight="medium">
                                {partnerProfile.title || 'Transformation Partner'}
                              </Text>
                              <Text color="gray.500" fontSize="xs">
                                {partnerProfile.officeLocation || partnerProfile.timezone || 'Global support'}
                              </Text>
                            </Stack>
                          </HStack>
                          <HStack spacing={2} flexWrap="wrap">
                            {partnerProfile.rating && (
                              <Badge colorScheme="purple" variant="solid">
                                Rating {partnerProfile.rating.toFixed(1)} / 5 ({partnerProfile.ratingCount || 0} reviews)
                              </Badge>
                            )}
                            {partnerProfile.xp && (
                              <Badge colorScheme="purple" variant="solid">
                                XP {partnerProfile.xp.toLocaleString()}
                              </Badge>
                            )}
                          </HStack>
                        </HStack>

                        {partnerProfile.bio && (
                          <Text color="gray.700" fontSize="sm" lineHeight="1.65">
                            {partnerProfile.bio}
                          </Text>
                        )}

                        {partnerProfile.email && (
                          <HStack spacing={2} pt={1}>
                            <Icon as={ExternalLink} color="gray.500" boxSize={3.5} />
                            <Link
                              href={`mailto:${partnerProfile.email}`}
                              color="#350e6f"
                              fontSize="sm"
                              fontWeight="medium"
                              textDecoration="underline"
                            >
                              {partnerProfile.email}
                            </Link>
                          </HStack>
                        )}
                      </Stack>
                    )}
                    {!partnerLoading && !partnerProfile && pendingPartnerEmail && (
                      <Flex direction="column" align="center" gap={2} p={6} textAlign="center">
                        <Icon as={Shield} boxSize={9} color="gray.400" />
                        <Heading size="sm" color="#27062e">Partner assigned</Heading>
                        <Text color="gray.700" fontSize="sm" fontWeight="medium">
                          {pendingPartnerEmail}
                        </Text>
                        <Button
                          size="sm"
                          mt={1}
                          bg="#350e6f"
                          color="white"
                          _hover={{ bg: '#27062e' }}
                          onClick={() => {
                            const to = pendingPartnerEmail.trim()
                            if (!to) return
                            // Open Gmail compose in the browser (not the OS mail app).
                            const subject = encodeURIComponent('Message from Transformation Leader')
                            const body = encodeURIComponent('Please write your email here')
                            const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${subject}&body=${body}`
                            window.open(url, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          Email partner
                        </Button>
                      </Flex>
                    )}
                    {!partnerLoading && !partnerProfile && !pendingPartnerEmail && (
                      <Flex direction="column" align="center" gap={2} p={6} textAlign="center">
                        <Icon as={Shield} boxSize={9} color="gray.400" />
                        <Heading size="sm" color="#27062e">Partner not set up</Heading>
                        <Text color="gray.600" fontSize="sm">
                          {partnerError || 'Ask your admin to set up your partner profile.'}
                        </Text>
                        <Button
                          size="sm"
                          leftIcon={<RefreshCcw size={16} />}
                          onClick={retryAssignments}
                          mt={1}
                          bg="#350e6f"
                          color="white"
                          _hover={{ bg: '#27062e' }}
                        >
                          Try again
                        </Button>
                      </Flex>
                    )}
                  </CardBody>
                </Card>
                )}
              </TabPanel>

              <TabPanel px={0} pt={4}>
                {!isLeadershipEligible ? (
                  renderJourneyLockedTab('Coach Assignment')
                ) : (
                <Card borderColor="gray.200" borderWidth="1px" bg="white" borderRadius="2xl">
                  <CardHeader pb={0}>
                    <HStack justify="space-between" align="start" spacing={4}>
                      <HStack
                        spacing={{ base: 2, md: 3 }}
                        flex="1"
                        minW={0}
                        align="center"
                        flexWrap="wrap"
                      >
                        <Text
                          fontSize="xs"
                          textTransform="uppercase"
                          color="#350e6f"
                          fontWeight="bold"
                          letterSpacing="0.14em"
                          flexShrink={0}
                        >
                          Coach
                        </Text>
                        <Heading size="md" color="#27062e" letterSpacing="-0.01em" noOfLines={1}>
                          {ambassadorProfile
                            ? displayNameForProfile(ambassadorProfile)
                            : pendingAmbassadorEmail
                              ? pendingAmbassadorEmail
                              : 'No coach assigned'}
                        </Heading>
                        {(ambassadorProfile?.availabilityStatus ||
                          (!ambassadorProfile && pendingAmbassadorEmail)) && (
                          <Badge
                            colorScheme={
                              ambassadorProfile?.availabilityStatus
                                ? badgeColor(ambassadorProfile.availabilityStatus)
                                : 'orange'
                            }
                            variant="subtle"
                          >
                            {ambassadorProfile?.availabilityStatus || 'Pending signup'}
                          </Badge>
                        )}
                      </HStack>
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
                        <Text color="gray.600" fontSize="sm">Loading coach…</Text>
                      </Flex>
                    )}

                    {ambassadorError && (
                      <Alert status="warning" rounded="lg" mb={4}>
                        <AlertIcon />
                        <Box>
                          <AlertTitle>Couldn't load coach.</AlertTitle>
                          <AlertDescription>{ambassadorError}</AlertDescription>
                        </Box>
                        <Button size="sm" leftIcon={<RefreshCcw size={16} />} ml={4} onClick={retryAssignments}>
                          Try again
                        </Button>
                      </Alert>
                    )}

                    {!assignmentsLoading && !ambassadorProfile && !ambassadorError && pendingAmbassadorEmail && (
                      <Flex direction="column" align="center" textAlign="center" p={6} gap={2}>
                        <Icon as={User} boxSize={9} color="gray.400" />
                        <Heading size="sm" color="#27062e">Coach invited</Heading>
                        <Text color="gray.700" fontSize="sm" fontWeight="medium">
                          {pendingAmbassadorEmail}
                        </Text>
                        <Text color="gray.600" fontSize="sm">
                          They’re assigned as your coach. Once they accept the invite and join,
                          their full profile will appear here.
                        </Text>
                      </Flex>
                    )}

                    {!assignmentsLoading && !ambassadorProfile && !ambassadorError && !pendingAmbassadorEmail && (
                      <Flex direction="column" align="center" textAlign="center" p={6} gap={2}>
                        <Icon as={User} boxSize={9} color="gray.400" />
                        <Heading size="sm" color="#27062e">No coach assigned</Heading>
                        <Text color="gray.600" fontSize="sm">
                          {hasOrganization
                            ? 'Ask your admin to assign one.'
                            : 'Link your account to an organisation first.'}
                        </Text>
                      </Flex>
                    )}

                    {ambassadorProfile && isSamePerson && (
                      <Text fontSize="sm" color="gray.600" mt={2}>
                        Your mentor is also your coach for this programme.
                      </Text>
                    )}

                    {ambassadorProfile && !mentorProfile && profile?.id && (
                      <Box
                        p={4}
                        border="1px solid"
                        borderColor="gray.200"
                        rounded="lg"
                        bg="gray.50"
                        mt={4}
                      >
                        <MentorshipGoalsCard
                          learnerId={profile.id}
                          mentorId={null}
                          audience="coach"
                        />
                      </Box>
                    )}

                    {profile?.id && ambassadorProfile && (
                      <>
                        <Divider my={5} />
                        <LearnerAmbassadorBookings
                          learnerId={profile.id}
                          learnerName={displayNameForProfile(profile)}
                          companyId={profile.companyId ?? null}
                          bookingLockedReason={
                            liftRequired && liftCompleted === false
                              ? 'Complete your LIFT assessment first to book coaching sessions.'
                              : liftRequired && liftCompleted === null
                                ? 'Checking your LIFT assessment…'
                                : null
                          }
                        />
                      </>
                    )}
                  </CardBody>
                </Card>
                )}
              </TabPanel>

              <TabPanel px={0} pt={2}>
                {!isLeadershipEligible ? (
                  renderJourneyLockedTab('Mentor Assignment')
                ) : (
                <Card borderColor="rgba(53, 14, 111, 0.16)" borderWidth="1px" bg="white" borderRadius="2xl">
                  <CardHeader pb={0} pt={2.5} px={{ base: 4, md: 5 }}>
                    <HStack spacing={2} align="center" flexWrap="wrap" minW={0}>
                      <Text
                        fontSize="xs"
                        textTransform="uppercase"
                        color="#350e6f"
                        fontWeight="bold"
                        letterSpacing="0.14em"
                        flexShrink={0}
                      >
                        {isSamePerson ? 'Mentor & Coach' : 'Mentor'}
                      </Text>
                      <Heading size="sm" color="#27062e" letterSpacing="-0.01em" noOfLines={1}>
                        {mentorProfile
                          ? displayNameForProfile(mentorProfile)
                          : pendingMentorEmail
                            ? pendingMentorEmail
                            : 'No mentor assigned'}
                      </Heading>
                      {mentorProfile?.availabilityStatus && (
                        <Badge colorScheme={badgeColor(mentorProfile.availabilityStatus)} variant="subtle">
                          {mentorProfile.availabilityStatus}
                        </Badge>
                      )}
                      {!mentorProfile && pendingMentorEmail && (
                        <Badge colorScheme="orange" variant="subtle">
                          Pending signup
                        </Badge>
                      )}
                      {mentorSourceLabel && (
                        <Badge colorScheme="purple" variant="subtle">
                          {mentorSourceLabel}
                        </Badge>
                      )}
                    </HStack>
                  </CardHeader>
                  <CardBody pt={2} px={{ base: 4, md: 5 }} pb={4}>
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

                    {!assignmentsLoading && !mentorProfile && !mentorError && pendingMentorEmail && (
                      <Flex direction="column" align="center" textAlign="center" p={6} gap={2}>
                        <Icon as={User} boxSize={9} color="gray.400" />
                        <Heading size="sm" color="#27062e">Mentor invited</Heading>
                        <Text color="gray.700" fontSize="sm" fontWeight="medium">
                          {pendingMentorEmail}
                        </Text>
                        <Text color="gray.600" fontSize="sm">
                          They’re assigned as your mentor. Once they join the platform, their
                          full profile will appear here.
                        </Text>
                      </Flex>
                    )}

                    {!assignmentsLoading && !mentorProfile && !mentorError && !pendingMentorEmail && (
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

                    {mentorProfile && profile?.id && (
                      <Stack spacing={3}>
                        <MentorshipGoalsCard
                          learnerId={profile.id}
                          mentorId={mentorProfile.id}
                          audience="mentor"
                          primary
                          onSaved={handleGoalsSaved}
                        />

                        <Flex
                          justify="space-between"
                          align={{ base: 'stretch', sm: 'center' }}
                          gap={2}
                          flexWrap="wrap"
                        >
                          <Tooltip
                            label={scheduleDisabledReason || 'Send a request to your mentor'}
                            placement="top"
                          >
                            <Button
                              size="md"
                              leftIcon={<Calendar size={16} />}
                              colorScheme="primary"
                              isDisabled={!canScheduleSession || scheduleSubmitting}
                              onClick={scheduleModal.onOpen}
                            >
                              Request a session
                            </Button>
                          </Tooltip>
                          <HStack spacing={2} flexWrap="wrap">
                            {hasAnySessions && (
                              <Button
                                size="md"
                                leftIcon={<Eye size={16} />}
                                variant="outline"
                                borderColor="rgba(53, 14, 111, 0.28)"
                                color="#350e6f"
                                onClick={sessionsModal.onOpen}
                              >
                                View all ({sessions.length})
                              </Button>
                            )}
                            <Button
                              size="md"
                              variant="ghost"
                              color="gray.600"
                              onClick={() => setShowSessionContext((v) => !v)}
                              aria-expanded={showSessionContext}
                            >
                              {showSessionContext ? 'Hide session context' : 'Show session context'}
                            </Button>
                          </HStack>
                        </Flex>

                        <Collapse in={showSessionContext} animateOpacity>
                          <LeaderSessionPrep
                            learner={profile}
                            mentor={mentorProfile}
                            goals={goalsDraft || savedGoals}
                          />
                        </Collapse>

                        <Box
                          p={4}
                          borderWidth="1px"
                          borderStyle="solid"
                          borderColor="rgba(53, 14, 111, 0.16)"
                          borderRadius="xl"
                          bg="white"
                        >
                          <HStack justify="space-between" align="center" mb={2} flexWrap="wrap" spacing={3}>
                            <Text fontWeight="bold" color="#27062e" fontSize="sm">
                              Upcoming sessions
                            </Text>
                            <Text fontSize="xs" color="gray.600">
                              {mentorSessionsSummary}
                            </Text>
                          </HStack>
                          <Text fontSize="xs" color="gray.500" mb={3}>
                            After a session is confirmed, use Add to Google or Add to Outlook / Apple so it lands in your real calendar with a reminder.
                          </Text>

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
                                        <>
                                          {(session.scheduledAt || session.proposedAt) && sessionCalendarActions(session)}
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            colorScheme="red"
                                            onClick={() => handleCancelSession(session)}
                                            isLoading={cancellingSessionId === session.id}
                                          >
                                            Withdraw
                                          </Button>
                                        </>,
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
                                          {sessionCalendarActions(session)}
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
                  placeholder="Share any context - what you&apos;re working through, what you&apos;d like to get out of the session, anything they should review beforehand."
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

