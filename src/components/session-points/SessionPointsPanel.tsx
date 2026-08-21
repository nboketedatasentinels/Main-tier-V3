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
  Heading,
  HStack,
  Select,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { Award } from 'lucide-react'
import { getDisplayName } from '@/utils/displayName'
import { useLearnerMentorshipSessions, useMentorMentorshipSessions } from '@/hooks/useMentorshipSessions'
import {
  groupBookingsByStatus,
  subscribeToAmbassadorBookings,
  subscribeToLearnerBookings,
  type CoachBooking,
} from '@/services/ambassadorSessionService'
import {
  awardCoachSessionPoints,
  awardMentorSessionPoints,
  describeQuota,
  formatSessionWhen,
  getSessionPointsQuota,
  listPendingCoachAwards,
  listPendingMentorAwards,
  type PendingSessionAward,
  type SessionPointsQuota,
  type SessionPointsRole,
} from '@/services/sessionPointsService'
import type { UserProfile } from '@/types'

interface SessionPointsPanelProps {
  role: SessionPointsRole
  actorId: string
  learners: UserProfile[]
  /** Org-level purchased coach sessions (coach role only). */
  orgPurchasedCoachSessions?: number | null
}

export const SessionPointsPanel: React.FC<SessionPointsPanelProps> = ({
  role,
  actorId,
  learners,
  orgPurchasedCoachSessions = null,
}) => {
  const toast = useToast()
  const [selectedId, setSelectedId] = useState(learners[0]?.id ?? '')
  const [quota, setQuota] = useState<SessionPointsQuota | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [awardingId, setAwardingId] = useState<string | null>(null)
  const [coachBookings, setCoachBookings] = useState<CoachBooking[]>([])
  const [coachLoading, setCoachLoading] = useState(role === 'coach')

  useEffect(() => {
    if (!selectedId && learners[0]?.id) setSelectedId(learners[0].id)
  }, [learners, selectedId])

  const selected = learners.find((l) => l.id === selectedId) ?? learners[0] ?? null

  const { sessions: mentorSessionsForActor, loading: mentorActorLoading } =
    useMentorMentorshipSessions(role === 'mentor' ? actorId : null)
  const { sessions: mentorSessionsForLearner, loading: mentorLearnerLoading } =
    useLearnerMentorshipSessions(role === 'mentor' ? selectedId || null : null)

  useEffect(() => {
    if (role !== 'coach' || !actorId) {
      setCoachBookings([])
      setCoachLoading(false)
      return
    }
    setCoachLoading(true)
    // Prefer bookings for the selected learner when known; otherwise all coach bookings.
    if (selectedId) {
      return subscribeToLearnerBookings(
        selectedId,
        (rows) => {
          setCoachBookings(rows.filter((b) => b.ambassadorId === actorId))
          setCoachLoading(false)
        },
        () => {
          setCoachBookings([])
          setCoachLoading(false)
        },
      )
    }
    return subscribeToAmbassadorBookings(
      actorId,
      (rows) => {
        setCoachBookings(rows)
        setCoachLoading(false)
      },
      () => {
        setCoachBookings([])
        setCoachLoading(false)
      },
    )
  }, [role, actorId, selectedId])

  const pending: PendingSessionAward[] = useMemo(() => {
    if (role === 'mentor') {
      const sessions = mentorSessionsForLearner.length
        ? mentorSessionsForLearner
        : mentorSessionsForActor.filter((s) => s.learnerId === selectedId)
      return listPendingMentorAwards(sessions).filter((s) => s.learnerId === selectedId)
    }
    return listPendingCoachAwards(coachBookings).filter((b) => b.learnerId === selectedId)
  }, [
    role,
    selectedId,
    mentorSessionsForLearner,
    mentorSessionsForActor,
    coachBookings,
  ])

  const refreshQuota = async (learnerId: string) => {
    setQuotaLoading(true)
    try {
      const learner = learners.find((l) => l.id === learnerId)
      const next = await getSessionPointsQuota({
        role,
        learnerId,
        actorId,
        purchasedCoachSessions:
          role === 'coach'
            ? (learner as { purchasedCoachSessions?: number } | undefined)?.purchasedCoachSessions ??
              orgPurchasedCoachSessions
            : null,
      })
      setQuota(next)
    } catch (err) {
      console.error('[SessionPointsPanel] quota failed', err)
      setQuota(null)
    } finally {
      setQuotaLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setQuota(null)
      return
    }
    void refreshQuota(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, role, actorId, orgPurchasedCoachSessions])

  const handleAward = async (item: PendingSessionAward) => {
    const key = item.kind === 'mentor' ? item.sessionId : item.bookingId
    setAwardingId(key)
    try {
      const result =
        item.kind === 'mentor'
          ? await awardMentorSessionPoints(item.sessionId)
          : await awardCoachSessionPoints({
              bookingId: item.bookingId,
              coachId: actorId,
              purchasedCoachSessions:
                learners.find((l) => l.id === item.learnerId)?.purchasedCoachSessions ??
                orgPurchasedCoachSessions,
            })

      if (result.pointsAwarded) {
        toast({
          status: 'success',
          title: `+${result.pointsAmount.toLocaleString()} points awarded`,
          description: `${item.learnerName} received ${quota?.activityTitle ?? 'session'} points.`,
        })
      } else {
        toast({
          status: 'warning',
          title: 'Attendance saved',
          description:
            result.message ||
            'Points were not issued. Check the remaining award limit for this journey.',
        })
      }
      await refreshQuota(item.learnerId)
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not award points',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setAwardingId(null)
    }
  }

  const loading =
    quotaLoading ||
    (role === 'mentor' && (mentorActorLoading || mentorLearnerLoading)) ||
    (role === 'coach' && coachLoading)

  if (!learners.length) {
    return (
      <Alert status="info" rounded="lg">
        <AlertIcon />
        <Box>
          <AlertTitle>No learners assigned</AlertTitle>
          <AlertDescription>
            {role === 'mentor'
              ? 'Assign mentees first, then award Mentor Meet Up points here after sessions.'
              : 'Assign coachees first, then award Coach Session points here after attendance.'}
          </AlertDescription>
        </Box>
      </Alert>
    )
  }

  return (
    <Stack spacing={5}>
      <Box
        p={5}
        border="1px solid"
        borderColor="border.subtle"
        rounded="lg"
        bg="surface.default"
      >
        <Heading size="sm" mb={1}>
          Session points
        </Heading>
        <Text fontSize="sm" color="text.secondary" mb={4}>
          Award{' '}
          <Text as="span" fontWeight="semibold">
            +2,000
          </Text>{' '}
          points per attended {role === 'mentor' ? 'mentor meet-up' : 'coach session'}. Limits follow
          the learner&apos;s journey
          {role === 'coach' ? ' and purchased coaching sessions' : ''}.
        </Text>

        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          Learner
        </Text>
        <Select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          maxW="420px"
          bg="white"
        >
          {learners.map((l) => (
            <option key={l.id} value={l.id}>
              {getDisplayName(l)}
            </option>
          ))}
        </Select>

        <Box mt={4} p={4} bg="gray.50" rounded="md" border="1px solid" borderColor="gray.200">
          {quotaLoading || !quota ? (
            <HStack>
              <Spinner size="sm" />
              <Text fontSize="sm" color="text.secondary">
                Loading award limit…
              </Text>
            </HStack>
          ) : (
            <Stack spacing={2}>
              <HStack justify="space-between" flexWrap="wrap" gap={2}>
                <Text fontWeight="semibold">{quota.activityTitle}</Text>
                <Badge colorScheme={quota.remaining > 0 ? 'green' : 'gray'}>
                  {quota.remaining} remaining
                </Badge>
              </HStack>
              <Text fontSize="sm" color="text.secondary">
                {describeQuota(quota)}
              </Text>
              {quota.journeyType ? (
                <Text fontSize="xs" color="text.muted">
                  Journey: {quota.journeyType} · +{quota.pointsEach.toLocaleString()} pts each
                </Text>
              ) : null}
            </Stack>
          )}
        </Box>
      </Box>

      <Box
        p={5}
        border="1px solid"
        borderColor="border.subtle"
        rounded="lg"
        bg="surface.default"
      >
        <Flex justify="space-between" align="center" mb={3} gap={3} flexWrap="wrap">
          <Heading size="sm">Sessions awaiting points</Heading>
          {loading ? <Spinner size="sm" /> : null}
        </Flex>

        {!loading && pending.length === 0 ? (
          <Alert status="success" rounded="lg" variant="subtle">
            <AlertIcon />
            <Box>
              <AlertTitle>Nothing pending</AlertTitle>
              <AlertDescription>
                {selected
                  ? `No ${role === 'mentor' ? 'meet-ups' : 'bookings'} for ${getDisplayName(selected)} need points right now.`
                  : 'Select a learner to review pending awards.'}
              </AlertDescription>
            </Box>
          </Alert>
        ) : null}

        <Stack spacing={3}>
          {pending.map((item) => {
            const key = item.kind === 'mentor' ? item.sessionId : item.bookingId
            const canAward = (quota?.remaining ?? 0) > 0
            return (
              <Flex
                key={key}
                p={4}
                border="1px solid"
                borderColor="border.subtle"
                rounded="lg"
                direction={{ base: 'column', md: 'row' }}
                align={{ base: 'stretch', md: 'center' }}
                gap={3}
                justify="space-between"
              >
                <Box minW={0}>
                  <HStack spacing={2} mb={1} flexWrap="wrap">
                    <Text fontWeight="bold">{item.learnerName}</Text>
                    <Badge>{item.status}</Badge>
                  </HStack>
                  <Text fontSize="sm" color="text.primary">
                    {item.topic}
                  </Text>
                  <Text fontSize="sm" color="text.muted">
                    {formatSessionWhen(item.when)}
                  </Text>
                </Box>
                <Button
                  leftIcon={<Award size={16} />}
                  colorScheme="purple"
                  bg="#350e6f"
                  _hover={{ bg: '#27062e' }}
                  onClick={() => void handleAward(item)}
                  isLoading={awardingId === key}
                  isDisabled={!canAward || Boolean(awardingId)}
                >
                  {canAward
                    ? `Confirm attendance · +${(quota?.pointsEach ?? 2000).toLocaleString()}`
                    : 'Limit reached'}
                </Button>
              </Flex>
            )
          })}
        </Stack>

        {role === 'coach' && selectedId ? (
          <Text mt={4} fontSize="xs" color="text.muted">
            Booked:{' '}
            {groupBookingsByStatus(coachBookings.filter((b) => b.learnerId === selectedId)).booked
              .length}{' '}
            · Attended:{' '}
            {
              groupBookingsByStatus(coachBookings.filter((b) => b.learnerId === selectedId))
                .attended.length
            }
          </Text>
        ) : null}
      </Box>
    </Stack>
  )
}

export default SessionPointsPanel
