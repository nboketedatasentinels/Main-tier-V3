import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Lock,
  Play,
  RotateCcw,
} from 'lucide-react'
import { getPodcastsForWeek, getModuleForWeek, type Podcast } from '@/config/podcasts'
import { usePodcastProgress } from '@/hooks/usePodcastProgress'
import {
  markPodcastWatched,
  recordAssessmentAttempt,
  getPodcastState,
} from '@/services/podcastProgressService'
import { useAuth } from '@/hooks/useAuth'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import { PodcastAssessmentModal } from './PodcastAssessmentModal'

interface PodcastSeriesPanelProps {
  activity: ActivityState
  currentWeek: number
  onAwardPoints?: () => Promise<void> | void
}

type PodcastStage = 'not_watched' | 'watched' | 'passed' | 'failed'

const FLAME = '#f4540c'
const FLAME_HOVER = '#d8430a'
const PLUM = '#27062e'
const GOLD = '#eab130'

export function PodcastSeriesPanel({
  activity,
  currentWeek,
  onAwardPoints,
}: PodcastSeriesPanelProps) {
  const { profile } = useAuth()
  const uid = profile?.id ?? null
  const toast = useToast()
  const { progress, loading } = usePodcastProgress(uid)

  const podcasts = useMemo(() => getPodcastsForWeek(currentWeek), [currentWeek])
  const module = useMemo(() => getModuleForWeek(currentWeek), [currentWeek])

  const [quizPodcast, setQuizPodcast] = useState<Podcast | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [watchingId, setWatchingId] = useState<string | null>(null)

  const getStage = (podcast: Podcast): PodcastStage => {
    const s = getPodcastState(progress, podcast.id)
    if (s.passed) return 'passed'
    if (s.attempts > 0 && !s.passed) return 'failed'
    if (s.watched) return 'watched'
    return 'not_watched'
  }

  const passedCount = podcasts.filter((p) => getStage(p) === 'passed').length

  const handleWatch = async (podcast: Podcast) => {
    if (!uid) return
    if (podcast.youtubeUrl) {
      window.open(podcast.youtubeUrl, '_blank', 'noopener,noreferrer')
    }
    setWatchingId(podcast.id)
    try {
      await markPodcastWatched(uid, podcast.id)
    } catch (err) {
      console.error('[PodcastSeriesPanel] markWatched failed', err)
      toast({ status: 'error', title: 'Could not save progress', description: 'Try again in a moment.' })
    } finally {
      setWatchingId(null)
    }
  }

  const handleQuizSubmit = async ({ score, passed }: { score: number; passed: boolean }) => {
    if (!uid || !quizPodcast) return
    setSubmittingId(quizPodcast.id)
    try {
      const prev = getPodcastState(progress, quizPodcast.id)
      const wasAlreadyPaid = Boolean(prev.pointsAwardedAt)
      const shouldAwardPoints = passed && !wasAlreadyPaid

      await recordAssessmentAttempt(uid, quizPodcast.id, score, passed, shouldAwardPoints, prev.bestScore)

      if (shouldAwardPoints && onAwardPoints) {
        try {
          await onAwardPoints()
        } catch (err) {
          console.error('[PodcastSeriesPanel] points award failed', err)
        }
      }

      if (passed) {
        toast({
          status: 'success',
          title: `+${activity.points.toLocaleString()} points`,
          description: `Quiz passed for ${quizPodcast.episodeCode}.`,
          duration: 3500,
        })
      }
    } catch (err) {
      console.error('[PodcastSeriesPanel] submit failed', err)
      toast({ status: 'error', title: 'Could not save your quiz' })
    } finally {
      setSubmittingId(null)
    }
  }

  if (podcasts.length === 0) {
    return (
      <Box p={4} bg="gray.50" rounded="md" border="1px solid" borderColor="gray.200">
        <Text fontSize="sm" color="gray.600">
          No podcasts are mapped to your current week ({currentWeek}). New ones unlock when you reach
          the next module.
        </Text>
      </Box>
    )
  }

  return (
    <Stack spacing={4}>
      {/* Module header */}
      {module && (
        <Flex
          justify="space-between"
          align="center"
          gap={3}
          p={3}
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderLeftWidth="3px"
          borderLeftColor={GOLD}
          rounded="md"
        >
          <Stack spacing={0.5} minW={0}>
            <Text
              fontSize="xs"
              fontWeight="semibold"
              letterSpacing="wide"
              color="gray.500"
            >
              Weeks {module.weekRange[0]}–{module.weekRange[1]}
            </Text>
            <Text fontSize="sm" fontWeight="bold" color={PLUM} noOfLines={1}>
              {module.label}
            </Text>
          </Stack>
          <Box
            px={3}
            py={1}
            bg="gray.50"
            border="1px solid"
            borderColor="gray.200"
            rounded="full"
            fontSize="xs"
            fontWeight="bold"
            color={PLUM}
            flexShrink={0}
          >
            {passedCount} of {podcasts.length} passed
          </Box>
        </Flex>
      )}

      {/* Podcast rows */}
      <Stack spacing={2}>
        {podcasts.map((podcast) => {
          const stage = getStage(podcast)
          const isWatchBusy = watchingId === podcast.id
          const isQuizBusy = submittingId === podcast.id
          const isPassed = stage === 'passed'
          const hasUrl = Boolean(podcast.youtubeUrl)
          const accentColor =
            stage === 'passed'
              ? 'yellow.500'
              : stage === 'failed'
                ? 'red.400'
                : stage === 'watched'
                  ? FLAME
                  : 'gray.300'

          return (
            <Box
              key={podcast.id}
              p={4}
              bg={isPassed ? 'yellow.50' : 'white'}
              border="1px solid"
              borderColor={isPassed ? 'yellow.200' : 'gray.200'}
              borderLeftWidth="3px"
              borderLeftColor={accentColor}
              rounded="md"
              transition="all 0.15s"
              _hover={{ borderColor: isPassed ? 'yellow.300' : 'gray.300' }}
            >
              <Flex
                justify="space-between"
                align="flex-start"
                gap={3}
                direction={{ base: 'column', md: 'row' }}
              >
                <Stack spacing={1.5} flex={1} minW={0}>
                  <HStack spacing={2} flexWrap="wrap">
                    <Box
                      px={2}
                      py={0.5}
                      bg="gray.100"
                      rounded="sm"
                      fontSize="xs"
                      fontWeight="bold"
                      color="gray.700"
                      letterSpacing="wide"
                    >
                      {podcast.episodeCode}
                    </Box>
                    {stage === 'failed' && (
                      <Badge
                        colorScheme="red"
                        variant="subtle"
                        fontSize="xs"
                        rounded="full"
                        px={2}
                        textTransform="none"
                        fontWeight="semibold"
                      >
                        Try again
                      </Badge>
                    )}
                  </HStack>
                  <Text fontWeight="semibold" color={PLUM} fontSize="sm" lineHeight="1.4">
                    {podcast.title}
                  </Text>
                  {!hasUrl && !isPassed && (
                    <HStack spacing={1} color="gray.500" fontSize="xs">
                      <Icon as={Lock} boxSize={3} />
                      <Text>Episode coming soon — quiz available now</Text>
                    </HStack>
                  )}
                </Stack>

                <HStack spacing={2} flexShrink={0}>
                  {/* Watch podcast — always shown; disabled until the episode URL is live */}
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="gray.300"
                    color={PLUM}
                    _hover={{ bg: 'gray.50', borderColor: 'gray.400' }}
                    leftIcon={<Icon as={hasUrl ? Play : Lock} boxSize={3.5} />}
                    rightIcon={hasUrl ? <Icon as={ExternalLink} boxSize={3} /> : undefined}
                    isDisabled={!hasUrl || loading}
                    isLoading={isWatchBusy}
                    onClick={() => handleWatch(podcast)}
                    title={hasUrl ? undefined : 'Episode coming soon'}
                  >
                    {!hasUrl ? 'Coming soon' : isPassed ? 'Replay' : 'Watch podcast'}
                  </Button>

                  {/* Take / retry quiz */}
                  {!isPassed && (
                    <Button
                      size="sm"
                      bg={FLAME}
                      color="white"
                      _hover={{ bg: FLAME_HOVER }}
                      leftIcon={
                        <Icon as={stage === 'failed' ? RotateCcw : ClipboardCheck} boxSize={3.5} />
                      }
                      isLoading={isQuizBusy}
                      isDisabled={loading}
                      onClick={async () => {
                        if (!hasUrl && stage === 'not_watched') {
                          await handleWatch(podcast)
                        }
                        setQuizPodcast(podcast)
                      }}
                    >
                      {stage === 'failed' ? 'Retry quiz' : 'Take quiz'}
                    </Button>
                  )}

                  {/* Passed */}
                  {isPassed && (
                    <HStack
                      spacing={1.5}
                      px={3}
                      py={1.5}
                      bg="yellow.500"
                      color="white"
                      rounded="full"
                      fontSize="xs"
                      fontWeight="bold"
                    >
                      <Icon as={CheckCircle2} boxSize={3.5} />
                      <Text>+{activity.points.toLocaleString()}</Text>
                    </HStack>
                  )}
                </HStack>
              </Flex>
            </Box>
          )
        })}
      </Stack>

      <PodcastAssessmentModal
        isOpen={quizPodcast !== null}
        podcast={quizPodcast}
        isSubmitting={submittingId === quizPodcast?.id}
        onClose={() => setQuizPodcast(null)}
        onSubmit={handleQuizSubmit}
      />
    </Stack>
  )
}

export default PodcastSeriesPanel
