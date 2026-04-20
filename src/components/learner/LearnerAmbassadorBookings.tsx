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
  HStack,
  Heading,
  Icon,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { format, formatDistanceToNow } from 'date-fns'
import { Calendar, CheckCircle2, Users } from 'lucide-react'
import { useLearnerBookings, useOpenSlotsForOrg } from '@/hooks/useAmbassadorSessions'
import {
  bookAmbassadorSlot,
  cancelBooking,
  type AmbassadorBooking,
  type AmbassadorSlot,
} from '@/services/ambassadorSessionService'

interface LearnerAmbassadorBookingsProps {
  learnerId: string
  learnerName: string
  companyId: string | null
}

const bookingStatusBadge = (booking: AmbassadorBooking): { label: string; scheme: string } => {
  switch (booking.status) {
    case 'booked':
      return { label: 'Booked', scheme: 'blue' }
    case 'attended':
      return { label: 'Attended', scheme: 'green' }
    case 'no_show':
      return { label: 'No-show', scheme: 'red' }
    case 'cancelled':
      return { label: 'Cancelled', scheme: 'gray' }
    default:
      return { label: booking.status, scheme: 'gray' }
  }
}

export const LearnerAmbassadorBookings: React.FC<LearnerAmbassadorBookingsProps> = ({
  learnerId,
  learnerName,
  companyId,
}) => {
  const toast = useToast()
  const { slots, loading: slotsLoading, error: slotsError } = useOpenSlotsForOrg(companyId)
  const {
    bookings,
    byStatus,
    loading: bookingsLoading,
    error: bookingsError,
  } = useLearnerBookings(learnerId)
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const bookedSlotIds = useMemo(
    () =>
      new Set(
        bookings
          .filter((b) => b.status === 'booked' || b.status === 'attended')
          .map((b) => b.slotId),
      ),
    [bookings],
  )

  const availableSlots = useMemo(
    () =>
      slots
        .filter((slot) => slot.status === 'open')
        .filter((slot) => slot.scheduledAt.getTime() > now.getTime())
        .filter((slot) => !bookedSlotIds.has(slot.id)),
    [slots, bookedSlotIds, now],
  )

  const upcomingBookings = useMemo(
    () =>
      byStatus.booked
        .slice()
        .sort(
          (a, b) =>
            (a.slotScheduledAt?.getTime() ?? a.bookedAt.getTime()) -
            (b.slotScheduledAt?.getTime() ?? b.bookedAt.getTime()),
        ),
    [byStatus.booked],
  )

  const pastBookings = useMemo(
    () =>
      [...byStatus.attended, ...byStatus.no_show, ...byStatus.cancelled]
        .sort(
          (a, b) =>
            (b.slotScheduledAt?.getTime() ?? b.bookedAt.getTime()) -
            (a.slotScheduledAt?.getTime() ?? a.bookedAt.getTime()),
        )
        .slice(0, 5),
    [byStatus.attended, byStatus.no_show, byStatus.cancelled],
  )

  const handleBookSlot = async (slot: AmbassadorSlot) => {
    setBookingBusyId(slot.id)
    try {
      await bookAmbassadorSlot({
        slotId: slot.id,
        learnerId,
        learnerName,
        companyId: companyId ?? undefined,
      })
      toast({
        title: 'Booked',
        description: `You're in for ${slot.title}.`,
        status: 'success',
      })
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Try again in a moment.'
      toast({ title: 'Could not book', description, status: 'error' })
    } finally {
      setBookingBusyId(null)
    }
  }

  const handleCancelBooking = async (booking: AmbassadorBooking) => {
    setCancellingId(booking.id)
    try {
      await cancelBooking({ bookingId: booking.id, actorId: learnerId })
      toast({ title: 'Booking cancelled', status: 'info' })
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Try again in a moment.'
      toast({ title: 'Could not cancel booking', description, status: 'error' })
    } finally {
      setCancellingId(null)
    }
  }

  const renderSlotRow = (slot: AmbassadorSlot) => (
    <Flex
      key={slot.id}
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
        <HStack spacing={2} mb={1} flexWrap="wrap">
          <Text fontWeight="bold">{slot.title}</Text>
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
        {slot.ambassadorName && (
          <Text fontSize="sm" color="text.muted" mt={1}>
            Hosted by {slot.ambassadorName}
          </Text>
        )}
      </Box>
      <Button
        size="sm"
        colorScheme="primary"
        onClick={() => handleBookSlot(slot)}
        isLoading={bookingBusyId === slot.id}
        isDisabled={bookingBusyId !== null}
      >
        Book slot
      </Button>
    </Flex>
  )

  const renderBookingRow = (booking: AmbassadorBooking, allowCancel: boolean) => {
    const badge = bookingStatusBadge(booking)
    const when = booking.slotScheduledAt ?? booking.bookedAt
    return (
      <Flex
        key={booking.id}
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
          <HStack spacing={2} mb={1} flexWrap="wrap">
            <Text fontWeight="bold">{booking.slotTitle ?? 'Coaching session'}</Text>
            <Badge colorScheme={badge.scheme}>{badge.label}</Badge>
            {booking.pointsAwarded && (
              <Badge colorScheme="purple" variant="subtle">
                Points awarded
              </Badge>
            )}
          </HStack>
          <Text fontSize="sm" color="text.secondary">
            {format(when, 'EEE, MMM d · h:mm a')} · {formatDistanceToNow(when, { addSuffix: true })}
          </Text>
          {booking.cancelReason && (
            <Text fontSize="sm" color="text.muted" mt={1}>
              Reason: {booking.cancelReason}
            </Text>
          )}
        </Box>
        {allowCancel && (
          <Button
            size="sm"
            variant="outline"
            colorScheme="red"
            onClick={() => handleCancelBooking(booking)}
            isLoading={cancellingId === booking.id}
            isDisabled={cancellingId !== null}
          >
            Cancel booking
          </Button>
        )}
      </Flex>
    )
  }

  if (!companyId) {
    return (
      <Alert status="info" rounded="lg">
        <AlertIcon />
        <Box>
          <AlertTitle>Organization not linked</AlertTitle>
          <AlertDescription>
            Ambassador coaching sessions are set up per organization. Contact your admin.
          </AlertDescription>
        </Box>
      </Alert>
    )
  }

  const loading = slotsLoading || bookingsLoading
  const error = slotsError || bookingsError

  return (
    <Stack spacing={5}>
      <Box>
        <HStack justify="space-between" mb={2} flexWrap="wrap">
          <Heading size="sm">Available coaching sessions</Heading>
          <Text fontSize="sm" color="text.secondary">
            Book a slot — your ambassador will confirm attendance and award points.
          </Text>
        </HStack>
        {loading && (
          <Flex align="center" gap={3} p={4} border="1px dashed" borderColor="border.subtle" rounded="lg">
            <Spinner size="sm" />
            <Text color="text.secondary">Loading sessions...</Text>
          </Flex>
        )}
        {error && (
          <Alert status="warning" rounded="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>Could not load sessions.</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Box>
          </Alert>
        )}
        {!loading && !error && availableSlots.length === 0 && (
          <Flex
            direction="column"
            align="center"
            textAlign="center"
            p={5}
            gap={2}
            border="1px dashed"
            borderColor="border.subtle"
            rounded="lg"
          >
            <Icon as={Calendar} color="text.muted" />
            <Text fontWeight="semibold">No sessions open for booking</Text>
            <Text fontSize="sm" color="text.secondary">
              Check back soon — your ambassador will post new slots regularly.
            </Text>
          </Flex>
        )}
        {!loading && !error && availableSlots.length > 0 && (
          <Stack spacing={3}>{availableSlots.map((slot) => renderSlotRow(slot))}</Stack>
        )}
      </Box>

      {upcomingBookings.length > 0 && (
        <>
          <Divider />
          <Box>
            <Heading size="sm" mb={2}>
              <HStack spacing={2}>
                <Icon as={CheckCircle2} color="green.500" />
                <Text>Your upcoming bookings ({upcomingBookings.length})</Text>
              </HStack>
            </Heading>
            <Stack spacing={3}>
              {upcomingBookings.map((booking) => renderBookingRow(booking, true))}
            </Stack>
          </Box>
        </>
      )}

      {pastBookings.length > 0 && (
        <>
          <Divider />
          <Box>
            <Heading size="sm" mb={2}>
              Recent history
            </Heading>
            <Stack spacing={3}>{pastBookings.map((booking) => renderBookingRow(booking, false))}</Stack>
          </Box>
        </>
      )}
    </Stack>
  )
}

