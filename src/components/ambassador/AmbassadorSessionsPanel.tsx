import React, { useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Divider,
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
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { format } from 'date-fns'
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MinusCircle,
  Plus,
  Users,
} from 'lucide-react'
import { useAmbassadorSlots, useSlotBookings } from '@/hooks/useAmbassadorSessions'
import {
  cancelAmbassadorSlot,
  createAmbassadorSlot,
  markAttendance,
  type AmbassadorSlot,
} from '@/services/ambassadorSessionService'

interface AmbassadorSessionsPanelProps {
  ambassadorId: string
  ambassadorName: string
  companyId: string | null
  companyCode?: string | null
}

const slotStatusBadge = (slot: AmbassadorSlot): { label: string; scheme: string } => {
  if (slot.status === 'cancelled') return { label: 'Cancelled', scheme: 'gray' }
  if (slot.status === 'completed') return { label: 'Completed', scheme: 'purple' }
  if (slot.status === 'full') return { label: 'Full', scheme: 'orange' }
  return { label: 'Open', scheme: 'green' }
}

const SlotBookingsRow: React.FC<{
  slotId: string
  ambassadorId: string
  canMarkAttendance: boolean
}> = ({ slotId, ambassadorId, canMarkAttendance }) => {
  const toast = useToast()
  const { bookings, loading } = useSlotBookings(slotId)
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleMark = async (bookingId: string, status: 'attended' | 'no_show') => {
    setBusyId(bookingId)
    try {
      const result = await markAttendance({ bookingId, status, markedBy: ambassadorId })
      toast({
        title:
          status === 'attended'
            ? result.pointsAwarded
              ? 'Marked attended · points awarded'
              : 'Already marked attended'
            : 'Marked as no-show',
        status: 'success',
      })
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Try again in a moment.'
      toast({ title: 'Failed to update attendance', description, status: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <HStack spacing={2} p={3}>
        <Spinner size="sm" />
        <Text fontSize="sm" color="text.secondary">
          Loading bookings...
        </Text>
      </HStack>
    )
  }

  if (bookings.length === 0) {
    return (
      <Text p={3} fontSize="sm" color="text.muted">
        No bookings yet.
      </Text>
    )
  }

  return (
    <Stack spacing={2} pt={2}>
      {bookings.map((booking) => (
        <Flex
          key={booking.id}
          p={3}
          border="1px solid"
          borderColor="border.subtle"
          rounded="md"
          align="center"
          gap={3}
          direction={{ base: 'column', md: 'row' }}
        >
          <Box flex="1" minW={0}>
            <HStack spacing={2} flexWrap="wrap">
              <Text fontWeight="semibold">{booking.learnerName ?? 'Learner'}</Text>
              {booking.status === 'booked' && <Badge colorScheme="blue">Booked</Badge>}
              {booking.status === 'attended' && <Badge colorScheme="green">Attended</Badge>}
              {booking.status === 'no_show' && <Badge colorScheme="red">No-show</Badge>}
              {booking.status === 'cancelled' && <Badge colorScheme="gray">Cancelled</Badge>}
              {booking.pointsAwarded && (
                <Badge colorScheme="purple" variant="subtle">
                  Points awarded
                </Badge>
              )}
            </HStack>
          </Box>
          {canMarkAttendance && booking.status !== 'cancelled' && (
            <HStack spacing={2}>
              <Button
                size="sm"
                colorScheme="green"
                variant={booking.status === 'attended' ? 'solid' : 'outline'}
                leftIcon={<CheckCircle2 size={14} />}
                onClick={() => handleMark(booking.id, 'attended')}
                isLoading={busyId === booking.id}
                isDisabled={busyId !== null}
              >
                Attended
              </Button>
              <Button
                size="sm"
                colorScheme="red"
                variant={booking.status === 'no_show' ? 'solid' : 'outline'}
                leftIcon={<MinusCircle size={14} />}
                onClick={() => handleMark(booking.id, 'no_show')}
                isLoading={busyId === booking.id}
                isDisabled={busyId !== null}
              >
                No-show
              </Button>
            </HStack>
          )}
        </Flex>
      ))}
    </Stack>
  )
}

export const AmbassadorSessionsPanel: React.FC<AmbassadorSessionsPanelProps> = ({
  ambassadorId,
  ambassadorName,
  companyId,
  companyCode,
}) => {
  const toast = useToast()
  const createModal = useDisclosure()
  const { slots, loading, error } = useAmbassadorSlots(ambassadorId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState<number>(60)
  const [capacity, setCapacity] = useState<number>(5)
  const [meetingLink, setMeetingLink] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const upcoming = useMemo(
    () =>
      slots
        .filter(
          (s) =>
            (s.status === 'open' || s.status === 'full') && s.scheduledAt.getTime() >= now.getTime(),
        )
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()),
    [slots, now],
  )
  const pastToReview = useMemo(
    () =>
      slots
        .filter((s) => s.status !== 'cancelled' && s.scheduledAt.getTime() < now.getTime())
        .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime()),
    [slots, now],
  )
  const cancelled = useMemo(() => slots.filter((s) => s.status === 'cancelled'), [slots])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setDate('')
    setTime('')
    setDuration(60)
    setCapacity(5)
    setMeetingLink('')
    setLocation('')
  }

  const handleCreateSlot = async () => {
    if (!companyId) {
      toast({
        title: 'No organization linked',
        description: 'Your account needs an organization before creating sessions.',
        status: 'warning',
      })
      return
    }
    if (!title.trim() || !date || !time) {
      toast({ title: 'Please complete title, date, and time.', status: 'error' })
      return
    }
    const scheduledAt = new Date(`${date}T${time}`)
    if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      toast({ title: 'Please choose a future date and time.', status: 'error' })
      return
    }

    setSubmitting(true)
    try {
      await createAmbassadorSlot({
        ambassadorId,
        ambassadorName,
        companyId,
        companyCode: companyCode ?? undefined,
        title,
        description,
        scheduledAt,
        durationMinutes: duration,
        capacity,
        meetingLink,
        location,
      })
      toast({ title: 'Session created', status: 'success' })
      resetForm()
      createModal.onClose()
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Try again in a moment.'
      toast({ title: 'Could not create session', description, status: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelSlot = async (slot: AmbassadorSlot) => {
    const confirmed = window.confirm(
      `Cancel "${slot.title}"? All ${slot.bookingCount} booking${slot.bookingCount === 1 ? '' : 's'} will be notified.`,
    )
    if (!confirmed) return
    setCancellingId(slot.id)
    try {
      await cancelAmbassadorSlot({ slotId: slot.id, actorId: ambassadorId })
      toast({ title: 'Session cancelled', status: 'info' })
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Try again in a moment.'
      toast({ title: 'Failed to cancel session', description, status: 'error' })
    } finally {
      setCancellingId(null)
    }
  }

  const renderSlot = (slot: AmbassadorSlot, mode: 'upcoming' | 'past' | 'cancelled') => {
    const badge = slotStatusBadge(slot)
    const isExpanded = expandedSlotId === slot.id
    return (
      <Box key={slot.id} border="1px solid" borderColor="border.subtle" rounded="lg" overflow="hidden">
        <Flex
          p={4}
          align={{ base: 'stretch', md: 'center' }}
          direction={{ base: 'column', md: 'row' }}
          gap={4}
          bg="surface.default"
        >
          <Box p={3} bg="tint.brandPrimary" rounded="lg" display="inline-flex" flexShrink={0}>
            <Icon as={Calendar} color="brand.primary" />
          </Box>
          <Box flex="1" minW={0}>
            <HStack spacing={2} mb={1} flexWrap="wrap">
              <Text fontWeight="bold">{slot.title}</Text>
              <Badge colorScheme={badge.scheme}>{badge.label}</Badge>
              <Badge colorScheme="blue" variant="subtle">
                <HStack spacing={1}>
                  <Icon as={Users} boxSize={3} />
                  <Text>
                    {slot.bookingCount}/{slot.capacity}
                  </Text>
                </HStack>
              </Badge>
            </HStack>
            <Text fontSize="sm" color="text.secondary">
              {format(slot.scheduledAt, 'EEE, MMM d · h:mm a')} · {slot.durationMinutes} min
            </Text>
            {slot.description && (
              <Text fontSize="sm" color="text.secondary" mt={1} noOfLines={2}>
                {slot.description}
              </Text>
            )}
            {slot.meetingLink && (
              <Link
                href={slot.meetingLink}
                isExternal
                color="brand.primary"
                fontSize="sm"
                mt={1}
                display="inline-flex"
                alignItems="center"
                gap={1}
              >
                <Icon as={ExternalLink} boxSize={3} /> Meeting link
              </Link>
            )}
            {slot.cancellationReason && (
              <Text fontSize="sm" color="red.500" mt={1}>
                Reason: {slot.cancellationReason}
              </Text>
            )}
          </Box>
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="ghost"
              rightIcon={isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              onClick={() => setExpandedSlotId(isExpanded ? null : slot.id)}
            >
              {isExpanded ? 'Hide bookings' : `View bookings (${slot.bookingCount})`}
            </Button>
            {mode === 'upcoming' && (
              <Button
                size="sm"
                variant="outline"
                colorScheme="red"
                onClick={() => handleCancelSlot(slot)}
                isLoading={cancellingId === slot.id}
                isDisabled={cancellingId !== null}
              >
                Cancel session
              </Button>
            )}
          </HStack>
        </Flex>
        {isExpanded && (
          <Box px={4} pb={4} bg="surface.subtle">
            <Divider mb={2} />
            <SlotBookingsRow
              slotId={slot.id}
              ambassadorId={ambassadorId}
              canMarkAttendance={slot.status !== 'cancelled'}
            />
          </Box>
        )}
      </Box>
    )
  }

  return (
    <>
      <Box p={5} border="1px solid" borderColor="border.subtle" rounded="lg" bg="surface.default">
        <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
          <Box>
            <Heading size="sm">Coaching sessions</Heading>
            <Text fontSize="sm" color="text.secondary">
              Create slots, track bookings, and mark attendance to award learner points.
            </Text>
          </Box>
          <Button
            leftIcon={<Plus size={16} />}
            colorScheme="primary"
            onClick={createModal.onOpen}
            isDisabled={!companyId}
          >
            Create session
          </Button>
        </Flex>

        {!companyId && (
          <Alert status="warning" rounded="lg" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Organization not linked</AlertTitle>
              <AlertDescription>
                Your account needs to be linked to an organization before you can create coaching
                sessions. Please contact your T4L partner.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {loading && (
          <Flex align="center" gap={3} p={4} border="1px dashed" borderColor="border.subtle" rounded="lg">
            <Spinner size="sm" />
            <Text color="text.secondary">Loading your sessions...</Text>
          </Flex>
        )}

        {error && (
          <Alert status="warning" rounded="lg" mb={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Could not load sessions.</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Box>
          </Alert>
        )}

        {!loading && !error && slots.length === 0 && (
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
            <Text fontWeight="semibold">No coaching sessions yet</Text>
            <Text fontSize="sm" color="text.secondary">
              Create your first session — learners will be able to self-book.
            </Text>
          </Flex>
        )}

        {!loading && !error && slots.length > 0 && (
          <Stack spacing={5}>
            {upcoming.length > 0 && (
              <Box>
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  color="text.muted"
                  fontWeight="semibold"
                  mb={2}
                >
                  Upcoming ({upcoming.length})
                </Text>
                <Stack spacing={3}>{upcoming.map((slot) => renderSlot(slot, 'upcoming'))}</Stack>
              </Box>
            )}

            {pastToReview.length > 0 && (
              <Box>
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  color="text.muted"
                  fontWeight="semibold"
                  mb={2}
                >
                  Past — attendance to review ({pastToReview.length})
                </Text>
                <Stack spacing={3}>{pastToReview.map((slot) => renderSlot(slot, 'past'))}</Stack>
              </Box>
            )}

            {cancelled.length > 0 && (
              <Box>
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  color="text.muted"
                  fontWeight="semibold"
                  mb={2}
                >
                  Cancelled
                </Text>
                <Stack spacing={3}>{cancelled.map((slot) => renderSlot(slot, 'cancelled'))}</Stack>
              </Box>
            )}
          </Stack>
        )}
      </Box>

      <Modal isOpen={createModal.isOpen} onClose={() => !submitting && createModal.onClose()} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create coaching session</ModalHeader>
          <ModalCloseButton isDisabled={submitting} />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Title</FormLabel>
                <Input
                  placeholder="e.g., Leadership coaching · April cohort"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Description (optional)</FormLabel>
                <Textarea
                  placeholder="What will you cover? Prep materials? Any prerequisites?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl isRequired>
                  <FormLabel>Date</FormLabel>
                  <Input
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Time</FormLabel>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl>
                  <FormLabel>Duration (minutes)</FormLabel>
                  <NumberInput
                    min={15}
                    max={240}
                    step={15}
                    value={duration}
                    onChange={(_, n) => setDuration(Number.isFinite(n) ? n : 60)}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Capacity (learners)</FormLabel>
                  <NumberInput
                    min={1}
                    max={50}
                    value={capacity}
                    onChange={(_, n) => setCapacity(Number.isFinite(n) ? n : 5)}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel>Meeting link (optional)</FormLabel>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                />
                <FormHelperText>Shared with learners once they book.</FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel>Location (optional)</FormLabel>
                <Input
                  placeholder="In-person venue, if applicable"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={createModal.onClose} isDisabled={submitting}>
              Cancel
            </Button>
            <Button colorScheme="primary" onClick={handleCreateSlot} isLoading={submitting}>
              Create session
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

