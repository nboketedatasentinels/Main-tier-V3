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
  Icon,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { Award, CalendarCheck2, Users } from 'lucide-react'
import { getDisplayName } from '@/utils/displayName'
import { useMentorMentorshipSessions } from '@/hooks/useMentorshipSessions'
import {
  subscribeToAmbassadorBookings,
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

const PLUM = '#350e6f'
const PLUM_DEEP = '#27062e'

interface SessionPointsPanelProps {
  role: SessionPointsRole
  actorId: string
  learners: UserProfile[]
  /** Org-level purchased coach sessions (coach role only). */
  orgPurchasedCoachSessions?: number | null
}

type FilterMode = 'needs_marks' | 'by_learner'

/**
 * Inbox-style attendance → marks flow for mentors and coaches.
 * Default: every meeting that still needs a +2,000 award, across all learners.
 */
export const SessionPointsPanel: React.FC<SessionPointsPanelProps> = ({
  role,
  actorId,
  learners,
  orgPurchasedCoachSessions = null,
}) => {
  const toast = useToast()
  const [filter, setFilter] = useState<FilterMode>('needs_marks')
  const [learnerFilter, setLearnerFilter] = useState<string | null>(null)
  const [quotas, setQuotas] = useState<Record<string, SessionPointsQuota>>({})
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [awardingId, setAwardingId] = useState<string | null>(null)
  const [coachBookings, setCoachBookings] = useState<CoachBooking[]>([])
  const [coachLoading, setCoachLoading] = useState(role === 'coach')

  const { sessions: mentorSessions, loading: mentorLoading } = useMentorMentorshipSessions(
    role === 'mentor' ? actorId : null,
  )

  useEffect(() => {
    if (role !== 'coach' || !actorId) {
      setCoachBookings([])
      setCoachLoading(false)
      return
    }
    setCoachLoading(true)
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
  }, [role, actorId])

  const allPending: PendingSessionAward[] = useMemo(() => {
    if (role === 'mentor') return listPendingMentorAwards(mentorSessions)
    return listPendingCoachAwards(coachBookings)
  }, [role, mentorSessions, coachBookings])

  const visiblePending = useMemo(() => {
    if (filter === 'by_learner' && learnerFilter) {
      return allPending.filter((p) => p.learnerId === learnerFilter)
    }
    return allPending
  }, [allPending, filter, learnerFilter])

  const pendingByLearner = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of allPending) {
      map.set(item.learnerId, (map.get(item.learnerId) ?? 0) + 1)
    }
    return map
  }, [allPending])

  const refreshQuotas = async (learnerIds: string[]) => {
    const unique = [...new Set(learnerIds.filter(Boolean))]
    if (!unique.length) {
      setQuotas({})
      return
    }
    setQuotaLoading(true)
    try {
      const entries = await Promise.all(
        unique.map(async (learnerId) => {
          const learner = learners.find((l) => l.id === learnerId)
          const quota = await getSessionPointsQuota({
            role,
            learnerId,
            actorId,
            purchasedCoachSessions:
              role === 'coach'
                ? (learner as { purchasedCoachSessions?: number } | undefined)
                    ?.purchasedCoachSessions ?? orgPurchasedCoachSessions
                : null,
          })
          return [learnerId, quota] as const
        }),
      )
      setQuotas(Object.fromEntries(entries))
    } catch (err) {
      console.error('[SessionPointsPanel] quota failed', err)
    } finally {
      setQuotaLoading(false)
    }
  }

  useEffect(() => {
    const ids =
      filter === 'by_learner' && learnerFilter
        ? [learnerFilter]
        : allPending.map((p) => p.learnerId)
    void refreshQuotas(ids.length ? ids : learners.map((l) => l.id).slice(0, 8))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPending, filter, learnerFilter, role, actorId, orgPurchasedCoachSessions, learners])

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
          title: `+${result.pointsAmount.toLocaleString()} marks awarded`,
          description: `${item.learnerName} got credit for attending.`,
        })
      } else {
        toast({
          status: 'warning',
          title: 'Attendance saved',
          description:
            result.message ||
            'Marks were not issued. Check the remaining award limit for this journey.',
        })
      }
      await refreshQuotas([item.learnerId])
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not award marks',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setAwardingId(null)
    }
  }

  const loading =
    quotaLoading || (role === 'mentor' && mentorLoading) || (role === 'coach' && coachLoading)

  const roleLabel = role === 'mentor' ? 'mentee' : 'coachee'
  const meetingLabel = role === 'mentor' ? 'meet-up' : 'coaching session'

  if (!learners.length) {
    return (
      <Alert status="info" rounded="xl" border="1px solid" borderColor="blue.100">
        <AlertIcon />
        <Box>
          <AlertTitle>No {roleLabel}s assigned yet</AlertTitle>
          <AlertDescription>
            Once learners are linked to you, meetings they attend will show up here for marks.
          </AlertDescription>
        </Box>
      </Alert>
    )
  }

  return (
    <Stack spacing={6}>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
        {[
          {
            step: '1',
            title: 'They show up',
            body: `A booked ${meetingLabel} appears here when it still needs marks.`,
            icon: Users,
          },
          {
            step: '2',
            title: 'You confirm',
            body: 'One tap: confirm attendance only when they actually attended.',
            icon: CalendarCheck2,
          },
          {
            step: '3',
            title: 'Marks land',
            body: '+2,000 journey points, within their programme limit.',
            icon: Award,
          },
        ].map((card) => (
          <Box
            key={card.step}
            p={4}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            bg="white"
          >
            <HStack spacing={3} mb={2}>
              <Flex
                w={8}
                h={8}
                borderRadius="full"
                align="center"
                justify="center"
                bg="rgba(53,14,111,0.08)"
                color={PLUM}
                fontWeight="700"
                fontSize="sm"
              >
                {card.step}
              </Flex>
              <Icon as={card.icon} color={PLUM} boxSize={4} />
              <Text fontWeight="700" color="gray.900" fontSize="sm">
                {card.title}
              </Text>
            </HStack>
            <Text fontSize="sm" color="gray.600" lineHeight="1.55">
              {card.body}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      <Flex gap={2} flexWrap="wrap" align="center">
        <Button
          size="sm"
          variant={filter === 'needs_marks' ? 'solid' : 'outline'}
          bg={filter === 'needs_marks' ? PLUM : 'white'}
          color={filter === 'needs_marks' ? 'white' : 'gray.700'}
          borderColor="gray.300"
          _hover={{ bg: filter === 'needs_marks' ? PLUM_DEEP : 'gray.50' }}
          onClick={() => {
            setFilter('needs_marks')
            setLearnerFilter(null)
          }}
          rightIcon={
            <Badge
              ml={1}
              colorScheme={filter === 'needs_marks' ? 'blackAlpha' : 'purple'}
              borderRadius="full"
            >
              {allPending.length}
            </Badge>
          }
        >
          Needs marks
        </Button>
        {learners.map((l) => {
          const count = pendingByLearner.get(l.id) ?? 0
          const active = filter === 'by_learner' && learnerFilter === l.id
          return (
            <Button
              key={l.id}
              size="sm"
              variant={active ? 'solid' : 'outline'}
              bg={active ? PLUM : 'white'}
              color={active ? 'white' : 'gray.700'}
              borderColor="gray.300"
              _hover={{ bg: active ? PLUM_DEEP : 'gray.50' }}
              onClick={() => {
                setFilter('by_learner')
                setLearnerFilter(l.id)
              }}
            >
              {getDisplayName(l)}
              {count > 0 ? (
                <Badge ml={2} colorScheme={active ? 'blackAlpha' : 'orange'} borderRadius="full">
                  {count}
                </Badge>
              ) : null}
            </Button>
          )
        })}
      </Flex>

      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white" overflow="hidden">
        <Flex
          px={5}
          py={4}
          borderBottom="1px solid"
          borderColor="gray.100"
          justify="space-between"
          align="center"
          gap={3}
          flexWrap="wrap"
          bg="gray.50"
        >
          <Box>
            <Heading size="sm" color="gray.900">
              {filter === 'needs_marks'
                ? 'Meetings waiting for marks'
                : `Marks for ${
                    learners.find((l) => l.id === learnerFilter)
                      ? getDisplayName(learners.find((l) => l.id === learnerFilter)!)
                      : 'learner'
                  }`}
            </Heading>
            <Text mt={1} fontSize="sm" color="gray.600">
              Confirm only sessions that happened. No-shows stay unmarked.
            </Text>
          </Box>
          {loading ? <Spinner size="sm" /> : null}
        </Flex>

        <Box px={5} py={4}>
          {!loading && visiblePending.length === 0 ? (
            <Alert status="success" rounded="lg" variant="subtle">
              <AlertIcon />
              <Box>
                <AlertTitle>You&apos;re caught up</AlertTitle>
                <AlertDescription>
                  No meetings need marks right now. When someone attends, they&apos;ll appear here.
                </AlertDescription>
              </Box>
            </Alert>
          ) : null}

          <Stack spacing={3}>
            {visiblePending.map((item) => {
              const key = item.kind === 'mentor' ? item.sessionId : item.bookingId
              const quota = quotas[item.learnerId]
              const canAward = (quota?.remaining ?? 0) > 0
              const points = quota?.pointsEach ?? 2000
              return (
                <Flex
                  key={key}
                  p={4}
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="lg"
                  direction={{ base: 'column', md: 'row' }}
                  align={{ base: 'stretch', md: 'center' }}
                  gap={4}
                  justify="space-between"
                  bg="white"
                >
                  <Box minW={0} flex="1">
                    <HStack spacing={2} mb={1} flexWrap="wrap">
                      <Text fontWeight="700" color="gray.900">
                        {item.learnerName}
                      </Text>
                      <Badge
                        colorScheme={item.status === 'scheduled' || item.status === 'booked' ? 'blue' : 'green'}
                        textTransform="none"
                      >
                        {item.status === 'scheduled' || item.status === 'booked'
                          ? 'Booked'
                          : 'Attended · marks pending'}
                      </Badge>
                    </HStack>
                    <Text fontSize="sm" color="gray.800" noOfLines={2}>
                      {item.topic}
                    </Text>
                    <Text fontSize="sm" color="gray.500" mt={0.5}>
                      {formatSessionWhen(item.when)}
                    </Text>
                    {quota ? (
                      <Text fontSize="xs" color="gray.500" mt={2}>
                        {describeQuota(quota)}
                      </Text>
                    ) : null}
                  </Box>
                  <Button
                    leftIcon={<Award size={16} />}
                    bg={PLUM}
                    color="white"
                    _hover={{ bg: PLUM_DEEP }}
                    onClick={() => void handleAward(item)}
                    isLoading={awardingId === key}
                    isDisabled={!canAward || Boolean(awardingId)}
                    flexShrink={0}
                    size="md"
                  >
                    {canAward
                      ? `They attended · +${points.toLocaleString()}`
                      : 'Limit reached'}
                  </Button>
                </Flex>
              )
            })}
          </Stack>
        </Box>
      </Box>
    </Stack>
  )
}

export default SessionPointsPanel
