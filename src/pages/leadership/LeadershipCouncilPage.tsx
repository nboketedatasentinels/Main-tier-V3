import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  VStack,
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
  RefreshCcw,
  Shield,
  Timer,
  User,
  UserCircle2,
  Users,
} from 'lucide-react'
import { Timestamp, addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { format, formatDistanceToNow, isAfter, isValid, parseISO } from 'date-fns'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationLeadership } from '@/hooks/useOrganizationLeadership'
import { getDisplayName } from '@/utils/displayName'
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

interface MentorshipSession {
  id: string
  mentorId: string
  learnerId: string
  scheduledAt: Date
  topic: string
  agenda?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  meetingLink?: string
  createdAt?: Date
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

  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)

  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleTopic, setScheduleTopic] = useState('')
  const [scheduleAgenda, setScheduleAgenda] = useState('')
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [scheduleLink, setScheduleLink] = useState('')
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  const sessionsModal = useDisclosure()
  const scheduleModal = useDisclosure()

  const hasOrganization = Boolean(profile?.companyId)
  const organizationReady = organization.loaded && organization.exists
  const supportAssignmentsReady = supportAssignmentStatus.loaded
  const showOrgDebug = import.meta.env.DEV && (organization.id || supportAssignmentStatus.id)
  const mentorSourceLabel =
    assignmentSources.mentor === 'user'
      ? 'User-specific mentor'
      : assignmentSources.mentor === 'organization'
        ? 'Organization mentor'
        : assignmentSources.mentor === 'profile'
          ? 'Profile mentor'
          : null
  const canScheduleSession = Boolean(mentorProfile) && hasOrganization && organizationReady && supportAssignmentsReady && !assignmentsLoading
  const scheduleDisabledReason = !hasOrganization
    ? 'Link your account to an organization to unlock mentor scheduling.'
    : !organizationReady
      ? 'We are still confirming your organization details.'
      : !supportAssignmentsReady
        ? 'Support assignments are still loading.'
        : !mentorProfile
          ? 'A mentor must be assigned before scheduling.'
          : null
  const gatingSteps = [
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
          ? 'User assignments loaded.'
          : 'No user-level assignments yet.'
        : 'Checking support assignments.',
      status: supportAssignmentsReady ? 'complete' : 'pending',
    },
    {
      id: 'mentor',
      title: 'Mentor ready',
      description: mentorProfile ? 'Mentor profile loaded.' : 'Mentor assignment needed.',
      status: mentorProfile ? 'complete' : assignmentsLoading ? 'pending' : 'blocked',
    },
    {
      id: 'ambassador',
      title: 'Ambassador ready',
      description: ambassadorProfile ? 'Ambassador profile loaded.' : 'Ambassador assignment needed.',
      status: ambassadorProfile ? 'complete' : assignmentsLoading ? 'pending' : 'blocked',
    },
  ] as const

  const gateStatusColor = (status: 'complete' | 'pending' | 'blocked') => {
    if (status === 'complete') return 'green'
    if (status === 'pending') return 'yellow'
    return 'red'
  }

  const gateStatusIcon = (status: 'complete' | 'pending' | 'blocked') => {
    if (status === 'complete') return CheckCircle2
    if (status === 'pending') return Clock3
    return AlertTriangle
  }

  const retryAssignments = useCallback(() => {
    refresh()
  }, [refresh])

  const loadSessions = useCallback(() => {
    if (!profile?.id) return () => undefined
    setSessionsLoading(true)
    setSessionsError(null)

    const sessionsQuery = query(
      collection(db, 'mentorship_sessions'),
      where('learner_id', '==', profile.id),
      where('status', '==', 'scheduled'),
      orderBy('scheduled_at', 'asc'),
    )

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const loadedSessions = snapshot.docs
          .reduce<MentorshipSession[]>((acc, docSnapshot) => {
            const data = docSnapshot.data()
            const scheduledAt = data.scheduled_at?.toDate?.() || (data.scheduled_at ? new Date(data.scheduled_at) : null)
            if (!scheduledAt || !isValid(scheduledAt)) return acc

            const session: MentorshipSession = {
              id: docSnapshot.id,
              mentorId: data.mentor_id,
              learnerId: data.learner_id,
              scheduledAt,
              topic: data.topic || 'Mentorship session',
              agenda: data.agenda || undefined,
              status: data.status || 'scheduled',
              meetingLink: data.meeting_link || undefined,
              createdAt: data.created_at?.toDate?.(),
            }

            if (isAfter(scheduledAt, new Date(Date.now() - 5 * 60 * 1000))) {
              acc.push(session)
            }
            return acc
          }, [])
          .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

        setSessions(loadedSessions)
        setSessionsLoading(false)
      },
      (error) => {
        setSessionsError(error.message)
        setSessionsLoading(false)
      },
    )

    return unsubscribe
  }, [profile?.id])

  useEffect(() => {
    const unsubscribe = loadSessions()
    return () => unsubscribe && unsubscribe()
  }, [loadSessions])

  const handleScheduleSession = async () => {
    if (!mentorProfile?.id) {
      toast({ title: 'Could not verify mentor assignment', status: 'error' })
      return
    }

    if (!scheduleDate || !scheduleTime || !scheduleTopic.trim()) {
      toast({ title: 'Please complete required fields', status: 'error' })
      return
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`)
    if (!isValid(scheduledAt) || scheduledAt.getTime() < Date.now()) {
      toast({ title: 'Please choose a future date and time', status: 'error' })
      return
    }

    if (scheduleLink && !/^https?:\/\//i.test(scheduleLink)) {
      toast({ title: 'Meeting link must be a valid URL', status: 'error' })
      return
    }

    setScheduleSubmitting(true)
    try {
      await addDoc(collection(db, 'mentorship_sessions'), {
        learner_id: profile?.id,
        mentor_id: mentorProfile.id,
        scheduled_at: Timestamp.fromDate(scheduledAt),
        topic: scheduleTopic.trim(),
        agenda: scheduleAgenda.trim() || null,
        notes: scheduleNotes.trim() || null,
        meeting_link: scheduleLink.trim() || null,
        status: 'scheduled',
        created_at: serverTimestamp(),
        created_by: 'learner',
      })

      toast({
        title: 'Session scheduled',
        description: `Your session with ${displayNameForProfile(mentorProfile)} is set for ${formatDisplayDate(
          scheduledAt,
        )} at ${format(scheduledAt, 'h:mm a')}.`,
        status: 'success',
      })

      setScheduleDate('')
      setScheduleTime('')
      setScheduleTopic('')
      setScheduleAgenda('')
      setScheduleNotes('')
      setScheduleLink('')
      scheduleModal.onClose()
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Try again in a moment.'
      toast({
        title: 'Failed to create session',
        description,
        status: 'error',
      })
    } finally {
      setScheduleSubmitting(false)
    }
  }

  const downloadIcs = (session: MentorshipSession) => {
    const start = session.scheduledAt
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:Mentorship session with ${mentorProfile ? displayNameForProfile(mentorProfile) : 'Mentor'}`,
      `DTSTART:${format(start, "yyyyMMdd'T'HHmmss")}`,
      `DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`,
      `DESCRIPTION:${session.topic}${session.agenda ? `\\n${session.agenda}` : ''}`,
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

  const renderSessionCards = (limitCount?: number) => {
    const items = limitCount ? sessions.slice(0, limitCount) : sessions
    return (
      <Stack spacing={3}>
        {items.map((session) => (
          <Flex
            key={session.id}
            p={4}
            border="1px dashed"
            borderColor="border.subtle"
            rounded="lg"
            align="center"
            gap={4}
            bg="surface.default"
          >
            <Box p={3} bg="tint.brandPrimary" rounded="lg" display="inline-flex">
              <Icon as={Calendar} color="brand.primary" />
            </Box>
            <Box flex="1">
              <HStack justify="space-between" align="start" mb={1} spacing={3} flexWrap="wrap">
                <HStack spacing={2}>
                  <Text fontWeight="bold" color="text.primary">
                    {formatDisplayDate(session.scheduledAt)}
                  </Text>
                  <Text color="text.secondary">{format(session.scheduledAt, 'h:mm a')}</Text>
                  <Badge colorScheme="success">{session.status}</Badge>
                </HStack>
                <Badge colorScheme="success" variant="subtle">
                  {relativeTime(session.scheduledAt).replace('about ', '')}
                </Badge>
              </HStack>
              <Text color="text.primary">{session.topic}</Text>
              {session.agenda && (
                <Text fontSize="sm" color="text.secondary" mt={1}>
                  {session.agenda}
                </Text>
              )}
            </Box>
            <Button size="sm" variant="ghost" leftIcon={<Download size={16} />} onClick={() => downloadIcs(session)}>
              Download
            </Button>
          </Flex>
        ))}
      </Stack>
    )
  }

  const mentorSessionsSummary = useMemo(() => {
    if (sessionsLoading) return 'Checking your schedule...'
    if (sessions.length === 0) return 'No sessions scheduled yet. Use the schedule button to plan your next conversation.'
    const mentorName = mentorProfile ? displayNameForProfile(mentorProfile) : 'your mentor'
    return `Your next ${sessions.length} session(s) with ${mentorName} at a glance`
  }, [sessions.length, sessionsLoading, mentorProfile])
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
      <Card bgGradient="linear(to-r, tint.brandPrimary, surface.default)" border="1px solid" borderColor="border.subtle">
        <CardBody>
          <Stack spacing={2}>
            <Badge colorScheme="primary" width="fit-content" rounded="full" px={3} py={1} fontWeight="semibold">
              Leadership Council
            </Badge>
            <Heading size="lg">Stay connected with the people supporting your transformation journey.</Heading>
            {profile?.companyName && (
              <HStack spacing={2} color="brand.primary" fontWeight="semibold">
                <Icon as={Building2} size={20} />
                <Text fontSize="lg">
                  {profile.companyName}
                  {profile.companyCode && ` (${profile.companyCode})`}
                </Text>
              </HStack>
            )}
            <Text color="text.secondary">
              Your dedicated mentor, ambassador, and transformation partner are highlighted below. Schedule sessions,
              review upcoming meetings, and explore your leadership network.
            </Text>
            {showOrgDebug && (
              <Stack spacing={1}>
                <Text fontSize="xs" color="text.muted">
                  Org ID: {organization.id ?? 'None'}
                </Text>
                <Text fontSize="xs" color="text.muted">
                  Support assignments: {supportAssignmentStatus.loaded ? (supportAssignmentStatus.exists ? 'Loaded' : 'None') : 'Not checked'}
                </Text>
                <Text fontSize="xs" color="text.muted">
                  Mentor source: {assignmentSources.mentor ?? 'None'}
                </Text>
                <Text fontSize="xs" color="text.muted">
                  Ambassador source: {assignmentSources.ambassador ?? 'None'}
                </Text>
              </Stack>
            )}
            <Button
              size="sm"
              alignSelf="flex-start"
              leftIcon={<RefreshCcw size={16} />}
              variant="outline"
              onClick={retryAssignments}
              isLoading={assignmentsLoading}
            >
              Refresh assignments
            </Button>
          </Stack>
        </CardBody>
      </Card>

      <Card borderColor="border.subtle" borderWidth="1px" bg="surface.default">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" flexWrap="wrap">
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                  Assignment readiness
                </Text>
                <Text fontSize="sm" color="text.secondary">
                  Complete each step to unlock mentor and ambassador connections.
                </Text>
              </Box>
              <Badge colorScheme={assignmentsLoading ? 'yellow' : 'green'} variant="subtle">
                {assignmentsLoading ? 'Checking assignments' : 'Status updated'}
              </Badge>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {gatingSteps.map((step) => (
                <Box key={step.id} p={4} border="1px solid" borderColor="border.subtle" rounded="lg" bg="surface.subtle">
                  <HStack justify="space-between" align="start">
                    <HStack spacing={3}>
                      <Icon as={gateStatusIcon(step.status)} color={`${gateStatusColor(step.status)}.500`} />
                      <Box>
                        <Text fontWeight="semibold" color="text.primary">
                          {step.title}
                        </Text>
                        <Text fontSize="sm" color="text.secondary">
                          {step.description}
                        </Text>
                      </Box>
                    </HStack>
                    <Badge colorScheme={gateStatusColor(step.status)} variant="subtle">
                      {step.status}
                    </Badge>
                  </HStack>
                </Box>
              ))}
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>

      <Grid templateColumns="1fr" gap={6} alignItems="start">
        <GridItem>
          <Tabs variant="unstyled" colorScheme="primary" isLazy>
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
                _selected={{ bg: 'brand.primary', color: 'text.inverse' }}
              >
                Mentor
              </Tab>
              <Tab
                whiteSpace="nowrap"
                fontWeight="semibold"
                rounded="md"
                _selected={{ bg: 'brand.primary', color: 'text.inverse' }}
              >
                Ambassador
              </Tab>
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
                <Card borderColor="border.subtle" borderWidth="1px" bg="surface.default">
                  <CardHeader pb={0}>
                    <HStack justify="space-between" align="start">
                      <Box>
                        <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="semibold">
                          {isSamePerson ? 'Mentor & Ambassador Assignment' : 'Mentor Assignment'}
                        </Text>
                        <Heading size="md" color="text.primary">
                          {mentorProfile ? displayNameForProfile(mentorProfile) : 'No mentor assigned'}
                        </Heading>
                        <HStack spacing={2} color="text.muted" mt={2}>
                          <Icon as={Building2} />
                          <Text>Supporting your organization</Text>
                        </HStack>
                        {isSamePerson && (
                          <HStack spacing={2} color="text.muted" mt={1}>
                            <Icon as={Users} />
                            <Text>Supporting your organization</Text>
                          </HStack>
                        )}
                        {mentorSourceLabel && (
                          <Badge mt={3} width="fit-content" colorScheme="purple" variant="subtle">
                            {mentorSourceLabel}
                          </Badge>
                        )}
                      </Box>
                      <VStack spacing={3} align="end">
                        <Avatar
                          size="lg"
                          name={mentorProfile ? displayNameForProfile(mentorProfile) : undefined}
                          src={mentorProfile?.avatarUrl}
                          bg="brand.primary"
                        />
                        {mentorProfile?.availabilityStatus && (
                          <Badge colorScheme={badgeColor(mentorProfile.availabilityStatus)} variant="subtle">
                            {mentorProfile.availabilityStatus}
                          </Badge>
                        )}
                        <Button
                          size="xs"
                          variant="outline"
                          leftIcon={<RefreshCcw size={14} />}
                          onClick={retryAssignments}
                          isLoading={assignmentsLoading}
                        >
                          Refresh
                        </Button>
                      </VStack>
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
                      <Flex direction="column" align="center" textAlign="center" p={6} gap={3}>
                        <Icon as={User} boxSize={10} color="text.muted" />
                        <Heading size="sm">No mentor assigned yet</Heading>
                        <Text color="text.secondary">
                          {hasOrganization
                            ? supportAssignmentStatus.loaded
                              ? 'We checked your user assignment and your organization. No mentor is assigned yet.'
                              : 'Please contact your administrator for support.'
                            : 'Your account is not linked to an organization yet. Please contact your administrator.'}
                        </Text>
                        {hasOrganization && supportAssignmentStatus.loaded && (
                          <Text color="text.secondary" fontSize="sm">
                            If you recently received a mentor, ask your administrator to confirm both your user-specific assignment and the organization-wide mentor.
                          </Text>
                        )}
                      </Flex>
                    )}

                    {mentorProfile && (
                      <Stack spacing={4}>
                        <HStack spacing={3} flexWrap="wrap">
                          <Tooltip
                            label={scheduleDisabledReason || 'Schedule with your assigned mentor'}
                            placement="top"
                          >
                            <Button
                              leftIcon={<Calendar size={18} />}
                              variant="outline"
                              isDisabled={!canScheduleSession || scheduleSubmitting}
                              onClick={scheduleModal.onOpen}
                            >
                              Schedule a session
                            </Button>
                          </Tooltip>
                          <Button
                            leftIcon={<Eye size={18} />}
                            variant="outline"
                            onClick={sessionsModal.onOpen}
                            isDisabled={sessionsLoading}
                          >
                            {sessionsLoading ? 'Loading...' : 'View calendar'}
                          </Button>
                        </HStack>

                        <Box p={4} border="1px solid" borderColor="border.subtle" rounded="lg" bg="surface.subtle">
                          <HStack justify="space-between" align="start" mb={3}>
                            <Text fontWeight="bold" color="text.primary">
                              Your mentor sessions
                            </Text>
                            {sessions.length > 3 && (
                              <Link color="brand.primary" fontWeight="semibold" onClick={sessionsModal.onOpen}>
                                View all upcoming sessions
                              </Link>
                            )}
                          </HStack>

                          <Text color="text.secondary" mb={3}>
                            {mentorSessionsSummary}
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
                              <Text>Checking for upcoming sessions...</Text>
                            </Flex>
                          )}

                          {sessionsError && (
                            <Alert status="warning" colorScheme="warning" rounded="lg">
                              <AlertIcon />
                              <Box>
                                <AlertTitle>We couldn't load your upcoming sessions.</AlertTitle>
                                <AlertDescription>{sessionsError}</AlertDescription>
                              </Box>
                            </Alert>
                          )}

                          {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                            <Flex
                              direction="column"
                              align="center"
                              textAlign="center"
                              p={5}
                              gap={2}
                              border="1px dashed"
                              borderColor="border.subtle"
                              rounded="lg"
                              bg="surface.default"
                            >
                              <Icon as={Calendar} color="text.muted" />
                              <Text>No sessions scheduled yet.</Text>
                              <Text fontSize="sm" color="text.secondary">
                                Use the schedule button to plan your next conversation.
                              </Text>
                            </Flex>
                          )}

                          {!sessionsLoading && !sessionsError && sessions.length > 0 && renderSessionCards(3)}

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
              </TabPanel>

              <TabPanel px={0} pt={4}>
                <Card borderColor="border.subtle" borderWidth="1px" bg="surface.default">
                  <CardHeader pb={0}>
                    <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="semibold">
                      Ambassador Assignment
                    </Text>
                    <Heading size="md" color="text.primary" mt={1}>
                      {ambassadorProfile ? displayNameForProfile(ambassadorProfile) : 'No ambassador assigned yet'}
                    </Heading>
                  </CardHeader>
                  <CardBody>
                    {assignmentsLoading && (
                      <Flex align="center" gap={3} p={4} border="1px dashed" borderColor="border.subtle" rounded="xl">
                        <Spinner />
                        <Text color="text.secondary">Loading your ambassador assignment...</Text>
                      </Flex>
                    )}

                    {ambassadorError && (
                      <Alert status="warning" rounded="lg" mb={4}>
                        <AlertIcon />
                        <Box>
                          <AlertTitle>We couldn't load your ambassador right now.</AlertTitle>
                          <AlertDescription>{ambassadorError}</AlertDescription>
                        </Box>
                        <Button size="sm" leftIcon={<RefreshCcw size={16} />} ml={4} onClick={retryAssignments}>
                          Try again
                        </Button>
                      </Alert>
                    )}

                    {!assignmentsLoading && !ambassadorProfile && !ambassadorError && (
                      <Flex direction="column" align="center" textAlign="center" p={6} gap={3}>
                        <Icon as={User} boxSize={10} color="text.muted" />
                        <Heading size="sm">No ambassador assigned yet</Heading>
                        <Text color="text.secondary">
                          {hasOrganization
                            ? "Your community hasn't been paired with an ambassador. Please contact your administrator for support."
                            : 'Your account is not linked to an organization yet. Please contact your administrator.'}
                        </Text>
                      </Flex>
                    )}

                    {ambassadorProfile && (
                      <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" gap={4} align="center">
                        <Box>
                          <Text color="text.primary">
                            {isSamePerson
                              ? 'Your mentor is also serving as your ambassador for this program.'
                              : 'Your ambassador is here to champion your progress and connect you with new opportunities.'}
                          </Text>
                          <HStack spacing={3} mt={3} color="text.secondary">
                            <Icon as={Users} />
                            <Text>Supporting your organization</Text>
                          </HStack>
                        </Box>
                        <VStack spacing={3} align="center">
                          <Avatar
                            size="lg"
                            name={displayNameForProfile(ambassadorProfile)}
                            src={ambassadorProfile.avatarUrl}
                            bg="brand.primary"
                          />
                          {ambassadorProfile.availabilityStatus && (
                            <Badge colorScheme={badgeColor(ambassadorProfile.availabilityStatus)} variant="subtle">
                              {ambassadorProfile.availabilityStatus}
                            </Badge>
                          )}
                        </VStack>
                      </Flex>
                    )}
                  </CardBody>
                </Card>
              </TabPanel>

              <TabPanel px={0} pt={4}>
                <Card borderColor="border.subtle" borderWidth="1px" bg="surface.default">
                  <CardHeader pb={2}>
                    <HStack spacing={3} align="center">
                      <Icon as={Shield} color="brand.primary" />
                      <Box>
                        <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="semibold">
                          Transformation Partner
                        </Text>
                        <Heading size="md">Program support & resources</Heading>
                      </Box>
                    </HStack>
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

                        <Text color="text.primary">{partnerProfile.bio || 'Dedicated program partner supporting your transformation journey.'}</Text>

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
                      <Flex direction="column" align="center" gap={3} p={6} textAlign="center">
                        <Icon as={Shield} boxSize={8} color="text.muted" />
                        <Heading size="sm">Transformation partner unavailable</Heading>
                        <Text color="text.secondary">
                          {partnerError || 'Your transformation partner profile is not set up yet. Please contact your administrator for support.'}
                        </Text>
                        <Button size="sm" leftIcon={<RefreshCcw size={16} />} onClick={retryAssignments}>
                          Try again
                        </Button>
                      </Flex>
                    )}
                  </CardBody>
                </Card>
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
                <Heading size="md">Upcoming mentor sessions</Heading>
                <Text color="text.secondary">
                  Your scheduled time with {mentorProfile ? displayNameForProfile(mentorProfile) : 'your mentor'}
                </Text>
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {sessions.length === 0 ? (
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
                <Heading size="sm">No sessions scheduled yet</Heading>
                <Text color="text.secondary" textAlign="center">
                  Use the schedule button to book your next conversation with your mentor.
                </Text>
              </Flex>
            ) : (
              <Stack spacing={4} maxH="60vh" overflowY="auto" pr={2}>
                {renderSessionCards()}
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
                <Heading size="md">Schedule a mentorship session</Heading>
                <Text color="text.inverse" fontSize="sm">
                  Your time: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </Text>
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton color="text.inverse" />
          <ModalBody pt={4}>
            <Stack spacing={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl isRequired>
                  <FormLabel>Date</FormLabel>
                  <Input type="date" min={format(new Date(), 'yyyy-MM-dd')} value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Time</FormLabel>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </FormControl>
              </SimpleGrid>

              <FormControl isRequired>
                <FormLabel>Topic</FormLabel>
                <Input
                  placeholder="What would you like to discuss?"
                  value={scheduleTopic}
                  onChange={(e) => setScheduleTopic(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Agenda (optional)</FormLabel>
                <Textarea
                  placeholder="Optional: Add details about what you'd like to cover"
                  value={scheduleAgenda}
                  onChange={(e) => setScheduleAgenda(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Notes (optional)</FormLabel>
                <Textarea
                  placeholder="Optional: Any additional context for your mentor"
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Meeting link (optional)</FormLabel>
                <Input
                  type="url"
                  placeholder="Optional: Zoom, Teams, or other meeting link"
                  value={scheduleLink}
                  onChange={(e) => setScheduleLink(e.target.value)}
                />
                <FormHelperText>Include https:// to enable quick join.</FormHelperText>
              </FormControl>

              {mentorProfile?.availabilityStatus && (
                <Alert status="info" variant="subtle" rounded="lg">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Availability</AlertTitle>
                    <AlertDescription>
                      Mentor is typically available {mentorProfile.availabilityStatus}. Availability is informational only and does not block scheduling.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={scheduleModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="primary" onClick={handleScheduleSession} isLoading={scheduleSubmitting}>
              Schedule Session
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}

