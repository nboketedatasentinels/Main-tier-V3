import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
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
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { format, formatDistanceToNow, isValid } from 'date-fns'
import { Calendar, CheckCircle2, ExternalLink, MessageSquare, Plus, XCircle } from 'lucide-react'
import { useMentorMentorshipSessions } from '@/hooks/useMentorshipSessions'
import { getDefaultFutureScheduleSlot, parseLocalDateTime } from '@/utils/date'
import {
  cancelMentorshipMeetingGroup,
  cancelMentorshipSession,
  completeMentorshipSession,
  confirmMentorshipSession,
  createMentorScheduledSession,
  declineMentorshipSession,
  groupMentorshipMeetings,
  type MentorshipSession,
  type MentorshipSessionStatus,
} from '@/services/mentorshipService'

type ActionMode = 'accept' | 'decline' | 'complete' | 'cancel'

interface ActionState {
  mode: ActionMode
  session: MentorshipSession
  /** When cancelling a multi-attendee meeting, cancel every row. */
  groupSessions?: MentorshipSession[]
}

interface MentorSessionsPanelProps {
  mentorId: string
  mentorName?: string | null
  /** Mentees the mentor can schedule with directly. */
  mentees?: Array<{ id: string; name: string }>
  /** When false, attendance can still be confirmed but points messaging is suppressed. */
  pointsIssuanceEnabled?: boolean
  /** Increment to open the schedule meeting modal (header / Meeting schedule CTA). */
  scheduleOpenToken?: number
}

const statusBadge = (status: MentorshipSessionStatus): { label: string; scheme: string } => {
  switch (status) {
    case 'requested':
      return { label: 'Awaiting your response', scheme: 'yellow' }
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

const formatWhen = (date: Date | null): string => {
  if (!date) return 'Time not set'
  try {
    return `${format(date, 'EEE, MMM d')} · ${format(date, 'h:mm a')}`
  } catch {
    return 'Time not set'
  }
}

const SessionRow: React.FC<{
  sessions: MentorshipSession[]
  actions?: React.ReactNode
}> = ({ sessions, actions }) => {
  const session = sessions[0]
  if (!session) return null
  const when = session.scheduledAt ?? session.proposedAt
  const badge = statusBadge(session.status)
  const names = sessions.map((s) => s.learnerName?.trim() || 'Learner')
  const isGroup = sessions.length > 1
  const title = isGroup
    ? names.length <= 2
      ? names.join(' · ')
      : `${names.slice(0, 2).join(' · ')} +${names.length - 2}`
    : names[0]
  return (
    <Flex
      p={4}
      border="1px solid"
      borderColor="border.subtle"
      rounded="lg"
      direction={{ base: 'column', md: 'row' }}
      align={{ base: 'stretch', md: 'center' }}
      gap={4}
      bg="surface.default"
    >
      <Box p={3} bg="tint.brandPrimary" rounded="lg" display="inline-flex" flexShrink={0}>
        <Icon as={Calendar} color="brand.primary" />
      </Box>
      <Box flex="1" minW={0}>
        <HStack justify="space-between" align="start" spacing={3} flexWrap="wrap" mb={1}>
          <HStack spacing={2} flexWrap="wrap">
            <Text fontWeight="bold" color="text.primary">
              {title}
            </Text>
            <Badge colorScheme={badge.scheme}>{badge.label}</Badge>
            {isGroup ? (
              <Badge colorScheme="purple" variant="subtle">
                {sessions.length} attendees
              </Badge>
            ) : null}
          </HStack>
          {when && (
            <Text fontSize="sm" color="text.muted">
              {formatDistanceToNow(when, { addSuffix: true })}
            </Text>
          )}
        </HStack>
        <Text fontSize="sm" color="text.secondary">
          {formatWhen(when)}
        </Text>
        <Text color="text.primary" mt={1}>
          {session.topic}
        </Text>
        {isGroup ? (
          <Text fontSize="sm" color="text.secondary" mt={1}>
            Attendees: {names.join(', ')}
          </Text>
        ) : null}
        {session.goals && (
          <Box mt={2} p={2} bg="surface.subtle" rounded="md" border="1px dashed" borderColor="border.subtle">
            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="semibold">
              Learner&apos;s mentorship goals
            </Text>
            <Text fontSize="sm" color="text.secondary" whiteSpace="pre-wrap">
              {session.goals}
            </Text>
          </Box>
        )}
        {session.requestMessage && (
          <HStack mt={2} align="start" spacing={2}>
            <Icon as={MessageSquare} boxSize={4} color="text.muted" mt={1} />
            <Text fontSize="sm" color="text.secondary" whiteSpace="pre-wrap">
              {session.requestMessage}
            </Text>
          </HStack>
        )}
        {session.meetingLink && session.status === 'scheduled' && (
          <Link
            href={session.meetingLink}
            isExternal
            color="brand.primary"
            fontSize="sm"
            mt={1}
            display="inline-flex"
            alignItems="center"
            gap={1}
          >
            <Icon as={ExternalLink} boxSize={3} /> Join meeting
          </Link>
        )}
        {session.declineReason && session.status === 'declined' && (
          <Text fontSize="sm" color="red.500" mt={1}>
            Decline reason: {session.declineReason}
          </Text>
        )}
        {session.cancellationReason && session.status === 'cancelled' && (
          <Text fontSize="sm" color="text.muted" mt={1}>
            Cancel reason: {session.cancellationReason}
          </Text>
        )}
      </Box>
      {actions && (
        <Stack spacing={2} align={{ base: 'stretch', md: 'flex-end' }}>
          {actions}
        </Stack>
      )}
    </Flex>
  )
}

export const MentorSessionsPanel: React.FC<MentorSessionsPanelProps> = ({
  mentorId,
  mentorName = null,
  mentees = [],
  pointsIssuanceEnabled = true,
  scheduleOpenToken = 0,
}) => {
  const toast = useToast()
  const { byStatus, sessions, loading, error } = useMentorMentorshipSessions(mentorId)
  const [action, setAction] = useState<ActionState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [acceptedScheduleAt, setAcceptedScheduleAt] = useState<string>('')
  const [acceptedTime, setAcceptedTime] = useState<string>('')
  const [meetingLink, setMeetingLink] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const ALL_MENTEES = '__all__'

  const [scheduleLearnerId, setScheduleLearnerId] = useState(mentees[0]?.id ?? '')
  const [scheduleTopic, setScheduleTopic] = useState('Mentorship session')
  const [scheduleDate, setScheduleDate] = useState(() => getDefaultFutureScheduleSlot().date)
  const [scheduleTime, setScheduleTime] = useState(() => getDefaultFutureScheduleSlot().time)
  const [scheduleLink, setScheduleLink] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const actionModal = useDisclosure()
  const scheduleModal = useDisclosure()

  const openScheduleModal = () => {
    const slot = getDefaultFutureScheduleSlot()
    setScheduleDate(slot.date)
    setScheduleTime(slot.time)
    scheduleModal.onOpen()
  }

  useEffect(() => {
    if (!scheduleLearnerId && mentees[0]?.id) {
      setScheduleLearnerId(mentees[0].id)
    }
  }, [mentees, scheduleLearnerId])

  useEffect(() => {
    if (scheduleOpenToken > 0) {
      openScheduleModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleOpenToken])

  const handleScheduleMeeting = async () => {
    const targets =
      scheduleLearnerId === ALL_MENTEES
        ? mentees
        : mentees.filter((m) => m.id === scheduleLearnerId)
    if (targets.length === 0) {
      toast({ status: 'warning', title: 'Select a mentee first' })
      return
    }
    const scheduledAt = parseLocalDateTime(scheduleDate, scheduleTime)
    if (!isValid(scheduledAt)) {
      toast({ status: 'warning', title: 'Pick a valid date and time' })
      return
    }
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      toast({
        status: 'warning',
        title: 'That time is already in the past',
        description: 'Pick a later time today, or choose another date.',
      })
      return
    }
    const link = scheduleLink.trim()
    if (!link) {
      toast({
        status: 'warning',
        title: 'Meeting link is required',
        description: 'Add a Zoom, Teams, or Meet link so mentees can join.',
      })
      return
    }
    setScheduling(true)
    try {
      let scheduled = 0
      let firstMailto: string | null = null
      const failures: string[] = []
      const meetingGroupId =
        targets.length > 1
          ? typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`
          : null
      for (const mentee of targets) {
        try {
          const result = await createMentorScheduledSession({
            learnerId: mentee.id,
            mentorId,
            topic: scheduleTopic,
            scheduledAt,
            meetingLink: link,
            learnerName: mentee.name,
            mentorName: mentorName ?? undefined,
            meetingGroupId,
          })
          scheduled += 1
          if (!firstMailto && result.mailtoHref) firstMailto = result.mailtoHref
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Unknown error'
          failures.push(`${mentee.name} (${reason})`)
          console.warn('[MentorSessions] schedule failed for', mentee.id, err)
        }
      }
      if (firstMailto && targets.length === 1) {
        try {
          window.location.href = firstMailto
        } catch {
          // no mail client
        }
      }
      if (scheduled === 0) {
        throw new Error(
          failures.length
            ? `Could not schedule for: ${failures.join('; ')}`
            : 'Could not schedule meeting',
        )
      }
      toast({
        status: failures.length ? 'warning' : 'success',
        title:
          targets.length > 1
            ? failures.length
              ? `Meeting created · ${scheduled} of ${targets.length} invited`
              : 'Meeting scheduled'
            : 'Meeting scheduled',
        description:
          targets.length > 1
            ? failures.length
              ? `One meeting with ${scheduled} attendees. Failed for: ${failures.join(', ')}.`
              : `One meeting with ${scheduled} attendees. Everyone was notified.`
            : firstMailto
              ? `In-app notice sent. Your email app opened so you can send the invite to ${targets[0].name}.`
              : `In-app notice sent to ${targets[0].name}.`,
        duration: 5000,
      })
      setScheduleTopic('Mentorship session')
      setScheduleLink('')
      scheduleModal.onClose()
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not schedule meeting',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setScheduling(false)
    }
  }

  const pending = byStatus.requested
  const upcomingGroups = useMemo(
    () => groupMentorshipMeetings(byStatus.scheduled),
    [byStatus.scheduled],
  )
  const historyGroups = useMemo(
    () =>
      groupMentorshipMeetings([
        ...byStatus.completed,
        ...byStatus.declined,
        ...byStatus.cancelled,
      ])
        .sort((a, b) => {
          const aSession = a.sessions[0]
          const bSession = b.sessions[0]
          const aTime =
            (aSession?.completedAt ?? aSession?.updatedAt ?? aSession?.createdAt)?.getTime() ?? 0
          const bTime =
            (bSession?.completedAt ?? bSession?.updatedAt ?? bSession?.createdAt)?.getTime() ?? 0
          return bTime - aTime
        })
        .slice(0, 8),
    [byStatus.completed, byStatus.declined, byStatus.cancelled],
  )

  const openAction = (
    mode: ActionMode,
    session: MentorshipSession,
    groupSessions?: MentorshipSession[],
  ) => {
    setAction({ mode, session, groupSessions })
    setAcceptedScheduleAt(
      session.proposedAt ? format(session.proposedAt, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    )
    setAcceptedTime(session.proposedAt ? format(session.proposedAt, 'HH:mm') : '09:00')
    setMeetingLink(session.meetingLink ?? '')
    setDeclineReason('')
    setCancelReason('')
    actionModal.onOpen()
  }

  const closeAction = () => {
    if (submitting) return
    setAction(null)
    actionModal.onClose()
  }

  const submitAction = async () => {
    if (!action) return
    const { mode, session } = action
    setSubmitting(true)
    try {
      if (mode === 'accept') {
        const scheduledAt = acceptedScheduleAt && acceptedTime
          ? new Date(`${acceptedScheduleAt}T${acceptedTime}`)
          : null
        if (scheduledAt && !isValid(scheduledAt)) {
          throw new Error('Please provide a valid date and time.')
        }
        const link = meetingLink.trim()
        if (!link) {
          throw new Error('Meeting link is required so the learner can join.')
        }
        await confirmMentorshipSession({
          sessionId: session.id,
          scheduledAt: scheduledAt ?? undefined,
          meetingLink: link,
        })
        toast({ title: 'Session confirmed', status: 'success' })
      } else if (mode === 'decline') {
        await declineMentorshipSession({
          sessionId: session.id,
          reason: declineReason,
        })
        toast({ title: 'Request declined', status: 'info' })
      } else if (mode === 'complete') {
        const result = await completeMentorshipSession({ sessionId: session.id })
        const awarded = pointsIssuanceEnabled && result.pointsAwarded
        const amount = result.pointsAmount ?? 2000
        toast({
          title: awarded
            ? `Attendance confirmed · +${amount.toLocaleString()} points issued`
            : result.message
              ? 'Attendance confirmed'
              : 'Session marked complete',
          description: awarded
            ? 'Learner earned mentor meetup points for attending.'
            : result.message,
          status: awarded ? 'success' : 'info',
        })
      } else if (mode === 'cancel') {
        const group = action.groupSessions
        if (group && group.length > 1) {
          await cancelMentorshipMeetingGroup({
            sessions: group,
            actorId: mentorId,
            reason: cancelReason,
          })
          toast({
            title: 'Meeting cancelled',
            description: `Cancelled for ${group.length} attendees.`,
            status: 'info',
          })
        } else {
          await cancelMentorshipSession({
            sessionId: session.id,
            actorId: mentorId,
            reason: cancelReason,
          })
          toast({ title: 'Session cancelled', status: 'info' })
        }
      }
      actionModal.onClose()
      setAction(null)
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Try again in a moment.'
      toast({ title: 'Something went wrong', description, status: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const actionTitle = (mode: ActionMode): string => {
    switch (mode) {
      case 'accept':
        return 'Confirm mentorship session'
      case 'decline':
        return 'Decline session request'
      case 'complete':
        return 'Mark session as completed'
      case 'cancel':
        return 'Cancel meeting'
    }
  }

  return (
    <>
      <Box
        p={5}
        border="1px solid"
        borderColor="border.subtle"
        rounded="lg"
        bg="surface.default"
      >
        <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
          <Box>
            <Heading size="sm">Mentorship sessions</Heading>
            <Text fontSize="sm" color="text.secondary">
              Schedule a meeting with a mentee, or accept learner requests. Mark attendance complete
              to issue +2,000 mentor meetup points - only when they attended.
            </Text>
          </Box>
          <HStack spacing={3} flexWrap="wrap">
            {pending.length > 0 && (
              <Badge colorScheme="yellow" variant="subtle">
                {pending.length} pending
              </Badge>
            )}
            {upcomingGroups.length > 0 && (
              <Badge colorScheme="green" variant="subtle">
                {upcomingGroups.length} confirmed
              </Badge>
            )}
            <Button
              leftIcon={<Plus size={16} />}
              colorScheme="primary"
              onClick={openScheduleModal}
              isDisabled={mentees.length === 0}
            >
              Schedule meeting
            </Button>
          </HStack>
        </Flex>

        {mentees.length === 0 && (
          <Alert status="info" rounded="lg" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>No mentees assigned</AlertTitle>
              <AlertDescription>
                Assign mentees first, then you can create meetings from here.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {loading && (
          <Flex align="center" gap={3} p={4} border="1px dashed" borderColor="border.subtle" rounded="lg">
            <Spinner size="sm" />
            <Text color="text.secondary">Loading sessions...</Text>
          </Flex>
        )}

        {error && (
          <Alert status="warning" rounded="lg" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>We couldn&apos;t load your sessions.</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Box>
          </Alert>
        )}

        {!loading && !error && sessions.length === 0 && (
          <Flex
            direction="column"
            align="center"
            textAlign="center"
            p={6}
            gap={2}
            border="1px dashed"
            borderColor="border.subtle"
            rounded="lg"
          >
            <Icon as={Calendar} color="text.muted" boxSize={6} />
            <Text fontWeight="semibold">No sessions yet</Text>
            <Text fontSize="sm" color="text.secondary">
              Schedule a meeting, or wait for a learner request - both appear here.
            </Text>
          </Flex>
        )}

        {!loading && !error && sessions.length > 0 && (
          <Stack spacing={5}>
            {pending.length > 0 && (
              <Box>
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  color="text.muted"
                  fontWeight="semibold"
                  mb={2}
                >
                  Awaiting your response ({pending.length})
                </Text>
                <Stack spacing={3}>
                  {pending.map((session) => (
                    <SessionRow
                      key={session.id}
                      sessions={[session]}
                      actions={
                        <HStack spacing={2} flexWrap="wrap">
                          <Button
                            size="sm"
                            colorScheme="green"
                            leftIcon={<CheckCircle2 size={16} />}
                            onClick={() => openAction('accept', session)}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            colorScheme="red"
                            leftIcon={<XCircle size={16} />}
                            onClick={() => openAction('decline', session)}
                          >
                            Decline
                          </Button>
                        </HStack>
                      }
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {upcomingGroups.length > 0 && (
              <Box>
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  color="text.muted"
                  fontWeight="semibold"
                  mb={2}
                >
                  Confirmed upcoming ({upcomingGroups.length})
                </Text>
                <Stack spacing={3}>
                  {upcomingGroups.map((group) => {
                    const primary = group.sessions[0]
                    if (!primary) return null
                    const isGroup = group.sessions.length > 1
                    return (
                      <SessionRow
                        key={group.key}
                        sessions={group.sessions}
                        actions={
                          <>
                            {isGroup ? (
                              <Stack spacing={1} align="stretch">
                                <Text fontSize="xs" color="text.muted" fontWeight="semibold">
                                  Mark attendance per person
                                </Text>
                                {group.sessions.map((attendee) =>
                                  attendee.status === 'completed' ? (
                                    <Button
                                      key={attendee.id}
                                      size="sm"
                                      colorScheme="green"
                                      variant="outline"
                                      leftIcon={<CheckCircle2 size={16} />}
                                      isDisabled
                                    >
                                      Attended · {attendee.learnerName ?? 'Learner'}
                                      {attendee.pointsAwarded ? ' · +2,000' : ''}
                                    </Button>
                                  ) : (
                                    <Button
                                      key={attendee.id}
                                      size="sm"
                                      colorScheme="purple"
                                      leftIcon={<CheckCircle2 size={16} />}
                                      onClick={() => openAction('complete', attendee)}
                                    >
                                      Complete · {attendee.learnerName ?? 'Learner'}
                                    </Button>
                                  ),
                                )}
                              </Stack>
                            ) : primary.status === 'completed' ? (
                              <Button
                                size="sm"
                                colorScheme="green"
                                variant="outline"
                                leftIcon={<CheckCircle2 size={16} />}
                                isDisabled
                              >
                                Attended
                                {primary.pointsAwarded ? ' · +2,000 points' : ''}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                colorScheme="purple"
                                leftIcon={<CheckCircle2 size={16} />}
                                onClick={() => openAction('complete', primary)}
                              >
                                Mark complete
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              colorScheme="red"
                              onClick={() => openAction('cancel', primary, group.sessions)}
                            >
                              Cancel meeting
                            </Button>
                          </>
                        }
                      />
                    )
                  })}
                </Stack>
              </Box>
            )}

            {historyGroups.length > 0 && (
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
                  {historyGroups.map((group) => {
                    const needsPointsRetry =
                      pointsIssuanceEnabled &&
                      group.sessions.some((s) => s.status === 'completed' && !s.pointsAwarded)
                    return (
                      <SessionRow
                        key={group.key}
                        sessions={group.sessions}
                        actions={
                          needsPointsRetry ? (
                            <Stack spacing={1} align="stretch">
                              {group.sessions
                                .filter((s) => s.status === 'completed' && !s.pointsAwarded)
                                .map((s) => (
                                  <Button
                                    key={s.id}
                                    size="sm"
                                    colorScheme="purple"
                                    leftIcon={<CheckCircle2 size={16} />}
                                    onClick={() => openAction('complete', s)}
                                  >
                                    Issue +2,000 · {s.learnerName ?? 'Learner'}
                                  </Button>
                                ))}
                            </Stack>
                          ) : undefined
                        }
                      />
                    )
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </Box>

      <Modal
        isOpen={scheduleModal.isOpen}
        onClose={() => !scheduling && scheduleModal.onClose()}
        size="lg"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Schedule mentorship meeting</ModalHeader>
          <ModalCloseButton isDisabled={scheduling} />
          <ModalBody>
            {mentees.length === 0 ? (
              <Text fontSize="sm" color="text.secondary">
                Assign mentees first, then you can create meetings here.
              </Text>
            ) : (
              <Stack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Who will attend</FormLabel>
                  <Select
                    value={scheduleLearnerId}
                    onChange={(e) => setScheduleLearnerId(e.target.value)}
                  >
                    {mentees.length > 1 ? (
                      <option value={ALL_MENTEES}>
                        All mentees ({mentees.length})
                      </option>
                    ) : null}
                    {mentees.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                  {scheduleLearnerId === ALL_MENTEES ? (
                    <FormHelperText>
                      Creates one shared meeting. Everyone selected is invited and notified.
                    </FormHelperText>
                  ) : null}
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Topic</FormLabel>
                  <Input
                    value={scheduleTopic}
                    onChange={(e) => setScheduleTopic(e.target.value)}
                    placeholder="e.g., Leadership check-in"
                  />
                </FormControl>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <FormControl isRequired>
                    <FormLabel>Date</FormLabel>
                    <Input
                      type="date"
                      min={format(new Date(), 'yyyy-MM-dd')}
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Time</FormLabel>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </FormControl>
                </SimpleGrid>
                <Text fontSize="xs" color="text.muted">
                  Choose a future date and time. Same-day slots only work if the time is still ahead.
                </Text>
                <FormControl isRequired>
                  <FormLabel>Meeting link</FormLabel>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={scheduleLink}
                    onChange={(e) => setScheduleLink(e.target.value)}
                  />
                  <FormHelperText>Shared with the mentee once the meeting is scheduled.</FormHelperText>
                </FormControl>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={scheduleModal.onClose} isDisabled={scheduling}>
              Cancel
            </Button>
            <Button
              colorScheme="primary"
              onClick={() => void handleScheduleMeeting()}
              isLoading={scheduling}
              isDisabled={mentees.length === 0}
            >
              Schedule meeting
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={actionModal.isOpen} onClose={closeAction} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{action ? actionTitle(action.mode) : ''}</ModalHeader>
          <ModalCloseButton isDisabled={submitting} />
          <ModalBody>
            {action && (
              <Stack spacing={4}>
                <Box p={3} bg="surface.subtle" rounded="md" border="1px dashed" borderColor="border.subtle">
                  <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="semibold">
                    {action.mode === 'cancel' && (action.groupSessions?.length ?? 0) > 1
                      ? `Meeting · ${action.groupSessions!.length} attendees`
                      : `Request from ${action.session.learnerName ?? 'Learner'}`}
                  </Text>
                  <Text fontWeight="semibold" color="text.primary" mt={1}>
                    {action.session.topic}
                  </Text>
                  <Text fontSize="sm" color="text.secondary">
                    Proposed: {formatWhen(action.session.proposedAt ?? action.session.scheduledAt)}
                  </Text>
                  {action.mode === 'cancel' && (action.groupSessions?.length ?? 0) > 1 ? (
                    <Text fontSize="sm" color="text.secondary" mt={1}>
                      Cancels this meeting for everyone:{' '}
                      {action.groupSessions!
                        .map((s) => s.learnerName?.trim() || 'Learner')
                        .join(', ')}
                    </Text>
                  ) : null}
                </Box>

                {action.mode === 'accept' && (
                  <>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <FormControl>
                        <FormLabel>Date</FormLabel>
                        <Input
                          type="date"
                          value={acceptedScheduleAt}
                          onChange={(e) => setAcceptedScheduleAt(e.target.value)}
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Time</FormLabel>
                        <Input
                          type="time"
                          value={acceptedTime}
                          onChange={(e) => setAcceptedTime(e.target.value)}
                        />
                      </FormControl>
                    </SimpleGrid>
                    <FormControl isRequired>
                      <FormLabel>Meeting link</FormLabel>
                      <Input
                        type="url"
                        placeholder="Zoom, Teams, Meet..."
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                      />
                      <FormHelperText>
                        Adjust the proposed time if needed and share a meeting link.
                      </FormHelperText>
                    </FormControl>
                  </>
                )}

                {action.mode === 'decline' && (
                  <FormControl>
                    <FormLabel>Reason (optional)</FormLabel>
                    <Textarea
                      placeholder="Let the learner know why - and suggest another time."
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      rows={4}
                    />
                  </FormControl>
                )}

                {action.mode === 'complete' && (
                  <Alert status="info" rounded="lg">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>+2,000 points if they attended</AlertTitle>
                      <AlertDescription>
                        Marking complete confirms attendance and issues mentor meetup points to the
                        learner. This can&apos;t be undone from this view.
                      </AlertDescription>
                    </Box>
                  </Alert>
                )}

                {action.mode === 'cancel' && (
                  <FormControl>
                    <FormLabel>Reason (optional)</FormLabel>
                    <Textarea
                      placeholder="Share a reason so the learner knows what happened."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={4}
                    />
                  </FormControl>
                )}
              </Stack>
            )}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={closeAction} isDisabled={submitting}>
              Cancel
            </Button>
            <Button
              colorScheme={
                action?.mode === 'decline' || action?.mode === 'cancel'
                  ? 'red'
                  : action?.mode === 'complete'
                    ? 'purple'
                    : 'green'
              }
              onClick={submitAction}
              isLoading={submitting}
            >
              {action?.mode === 'accept' && 'Confirm session'}
              {action?.mode === 'decline' && 'Decline request'}
              {action?.mode === 'complete' && 'Mark complete · award points'}
              {action?.mode === 'cancel' &&
                ((action.groupSessions?.length ?? 0) > 1 ? 'Cancel meeting' : 'Cancel session')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
