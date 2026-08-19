import React, { useEffect, useState } from 'react'
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
import { Calendar, CheckCircle2, ExternalLink, MessageSquare, XCircle } from 'lucide-react'
import { useMentorMentorshipSessions } from '@/hooks/useMentorshipSessions'
import {
  cancelMentorshipSession,
  completeMentorshipSession,
  confirmMentorshipSession,
  createMentorScheduledSession,
  declineMentorshipSession,
  type MentorshipSession,
  type MentorshipSessionStatus,
} from '@/services/mentorshipService'

type ActionMode = 'accept' | 'decline' | 'complete' | 'cancel'

interface ActionState {
  mode: ActionMode
  session: MentorshipSession
}

interface MentorSessionsPanelProps {
  mentorId: string
  mentorName?: string | null
  /** Mentees the mentor can schedule with directly. */
  mentees?: Array<{ id: string; name: string }>
  /** When false, attendance can still be confirmed but points messaging is suppressed. */
  pointsIssuanceEnabled?: boolean
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

const SessionRow: React.FC<{ session: MentorshipSession; actions?: React.ReactNode }> = ({
  session,
  actions,
}) => {
  const when = session.scheduledAt ?? session.proposedAt
  const badge = statusBadge(session.status)
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
              {session.learnerName ?? 'Learner'}
            </Text>
            <Badge colorScheme={badge.scheme}>{badge.label}</Badge>
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
        <HStack spacing={2} flexWrap="wrap">
          {actions}
        </HStack>
      )}
    </Flex>
  )
}

export const MentorSessionsPanel: React.FC<MentorSessionsPanelProps> = ({
  mentorId,
  mentorName = null,
  mentees = [],
  pointsIssuanceEnabled = true,
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
  const [scheduleLearnerId, setScheduleLearnerId] = useState(mentees[0]?.id ?? '')
  const [scheduleTopic, setScheduleTopic] = useState('Mentorship session')
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduleLink, setScheduleLink] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const modal = useDisclosure()

  useEffect(() => {
    if (!scheduleLearnerId && mentees[0]?.id) {
      setScheduleLearnerId(mentees[0].id)
    }
  }, [mentees, scheduleLearnerId])

  const handleScheduleMeeting = async () => {
    const mentee = mentees.find((m) => m.id === scheduleLearnerId)
    if (!mentee) {
      toast({ status: 'warning', title: 'Select a mentee first' })
      return
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`)
    if (!isValid(scheduledAt)) {
      toast({ status: 'warning', title: 'Pick a valid date and time' })
      return
    }
    setScheduling(true)
    try {
      await createMentorScheduledSession({
        learnerId: mentee.id,
        mentorId,
        topic: scheduleTopic,
        scheduledAt,
        meetingLink: scheduleLink,
        learnerName: mentee.name,
        mentorName: mentorName ?? undefined,
      })
      toast({
        status: 'success',
        title: 'Meeting scheduled',
        description: `${mentee.name} will see this in their notifications.`,
      })
      setScheduleTopic('Mentorship session')
      setScheduleLink('')
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
  const upcoming = byStatus.scheduled
  const history = [...byStatus.completed, ...byStatus.declined, ...byStatus.cancelled]
    .sort((a, b) => {
      const aTime = (a.completedAt ?? a.updatedAt ?? a.createdAt)?.getTime() ?? 0
      const bTime = (b.completedAt ?? b.updatedAt ?? b.createdAt)?.getTime() ?? 0
      return bTime - aTime
    })
    .slice(0, 8)

  const openAction = (mode: ActionMode, session: MentorshipSession) => {
    setAction({ mode, session })
    setAcceptedScheduleAt(
      session.proposedAt ? format(session.proposedAt, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    )
    setAcceptedTime(session.proposedAt ? format(session.proposedAt, 'HH:mm') : '09:00')
    setMeetingLink(session.meetingLink ?? '')
    setDeclineReason('')
    setCancelReason('')
    modal.onOpen()
  }

  const closeAction = () => {
    if (submitting) return
    setAction(null)
    modal.onClose()
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
        await confirmMentorshipSession({
          sessionId: session.id,
          scheduledAt: scheduledAt ?? undefined,
          meetingLink: meetingLink.trim() || undefined,
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
        await cancelMentorshipSession({
          sessionId: session.id,
          actorId: mentorId,
          reason: cancelReason,
        })
        toast({ title: 'Session cancelled', status: 'info' })
      }
      modal.onClose()
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
        return 'Cancel session'
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
          <HStack spacing={3}>
            {pending.length > 0 && (
              <Badge colorScheme="yellow" variant="subtle">
                {pending.length} pending
              </Badge>
            )}
            {upcoming.length > 0 && (
              <Badge colorScheme="green" variant="subtle">
                {upcoming.length} confirmed
              </Badge>
            )}
          </HStack>
        </Flex>

        <Box
          mb={5}
          p={4}
          border="1px solid"
          borderColor="border.subtle"
          rounded="lg"
          bg="gray.50"
        >
          <Text fontWeight="semibold" mb={3} fontSize="sm">
            Schedule a meeting
          </Text>
          {mentees.length === 0 ? (
            <Text fontSize="sm" color="text.secondary">
              Assign mentees first, then you can create meetings here.
            </Text>
          ) : (
            <>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mb={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Mentee</FormLabel>
                  <Select
                    value={scheduleLearnerId}
                    onChange={(e) => setScheduleLearnerId(e.target.value)}
                    bg="white"
                  >
                    {mentees.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Topic</FormLabel>
                  <Input
                    value={scheduleTopic}
                    onChange={(e) => setScheduleTopic(e.target.value)}
                    bg="white"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Date</FormLabel>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    bg="white"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Time</FormLabel>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    bg="white"
                  />
                </FormControl>
              </SimpleGrid>
              <FormControl mb={3}>
                <FormLabel fontSize="sm">Meeting link (optional)</FormLabel>
                <Input
                  value={scheduleLink}
                  onChange={(e) => setScheduleLink(e.target.value)}
                  placeholder="https://..."
                  bg="white"
                />
              </FormControl>
              <Button
                colorScheme="purple"
                bg="#350e6f"
                _hover={{ bg: '#27062e' }}
                onClick={() => void handleScheduleMeeting()}
                isLoading={scheduling}
                leftIcon={<Calendar size={16} />}
              >
                Schedule meeting
              </Button>
            </>
          )}
        </Box>

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
              Schedule a meeting above, or wait for a learner request - both appear here.
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
                      session={session}
                      actions={
                        <>
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
                        </>
                      }
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {upcoming.length > 0 && (
              <Box>
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  color="text.muted"
                  fontWeight="semibold"
                  mb={2}
                >
                  Confirmed upcoming ({upcoming.length})
                </Text>
                <Stack spacing={3}>
                  {upcoming.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      actions={
                        <>
                          <Button
                            size="sm"
                            colorScheme="purple"
                            leftIcon={<CheckCircle2 size={16} />}
                            onClick={() => openAction('complete', session)}
                          >
                            Mark complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            colorScheme="red"
                            onClick={() => openAction('cancel', session)}
                          >
                            Cancel
                          </Button>
                        </>
                      }
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {history.length > 0 && (
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
                  {history.map((session) => (
                    <SessionRow key={session.id} session={session} />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </Box>

      <Modal isOpen={modal.isOpen} onClose={closeAction} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{action ? actionTitle(action.mode) : ''}</ModalHeader>
          <ModalCloseButton isDisabled={submitting} />
          <ModalBody>
            {action && (
              <Stack spacing={4}>
                <Box p={3} bg="surface.subtle" rounded="md" border="1px dashed" borderColor="border.subtle">
                  <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="semibold">
                    Request from {action.session.learnerName ?? 'Learner'}
                  </Text>
                  <Text fontWeight="semibold" color="text.primary" mt={1}>
                    {action.session.topic}
                  </Text>
                  <Text fontSize="sm" color="text.secondary">
                    Proposed: {formatWhen(action.session.proposedAt ?? action.session.scheduledAt)}
                  </Text>
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
                    <FormControl>
                      <FormLabel>Meeting link (optional)</FormLabel>
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
              {action?.mode === 'cancel' && 'Cancel session'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
