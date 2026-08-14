import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Lock,
  Play,
  RotateCcw,
} from 'lucide-react'
import { getCatalogueCourseById } from '@/config/courseCatalogue'
import { getCoursePodcastPackByCatalogueId } from '@/config/coursePodcastCatalogue'
import { useAuth } from '@/hooks/useAuth'
import { usePodcastProgress } from '@/hooks/usePodcastProgress'
import type { ActivityState } from '@/hooks/useWeeklyChecklistViewModel'
import type { JourneyType } from '@/config/pointsConfig'
import {
  getPodcastState,
  markPodcastWatched,
  recordAssessmentAttempt,
} from '@/services/podcastProgressService'
import { awardChecklistPoints } from '@/services/pointsService'
import {
  listPlayableEpisodes,
  loadCoursePodcastPackForCatalogueCourse,
  loadCoursePodcastTranscript,
} from '@/services/coursePodcastAssetService'
import type { CoursePodcastEpisodeFilled, CoursePodcastPackMeta } from '@/types/coursePodcast'
import type { CoursePodcastPackRef } from '@/config/coursePodcastCatalogue'
import { CoursePodcastAssessmentModal } from './CoursePodcastAssessmentModal'

const FLAME = '#f4540c'
const FLAME_HOVER = '#d8430a'
const PLUM = '#27062e'
const GOLD = '#eab130'

const episodeProgressId = (packId: string, slot: string) => `${packId}-${slot}`

type PodcastStage = 'not_watched' | 'watched' | 'passed' | 'failed'

interface CoursePodcastSeriesPanelProps {
  activity: ActivityState
  currentWeek: number
  catalogueCourseId: string
  onPointsAwarded?: () => Promise<void> | void
}

export function CoursePodcastSeriesPanel({
  activity,
  currentWeek,
  catalogueCourseId,
  onPointsAwarded,
}: CoursePodcastSeriesPanelProps) {
  const { user, profile, updateProfile } = useAuth()
  const uid = user?.uid ?? profile?.id ?? null
  const journeyType = (profile?.journeyType as JourneyType | undefined) ?? '3M'
  const toast = useToast()
  const { progress, loading: progressLoading, patchProgress } = usePodcastProgress(uid)

  const course = getCatalogueCourseById(catalogueCourseId)
  const packRef = getCoursePodcastPackByCatalogueId(catalogueCourseId)

  const [meta, setMeta] = useState<CoursePodcastPackMeta | null>(null)
  const [ref, setRef] = useState<CoursePodcastPackRef | null>(null)
  const [loadingPack, setLoadingPack] = useState(true)
  const [packError, setPackError] = useState<string | null>(null)

  const [quizEpisode, setQuizEpisode] = useState<CoursePodcastEpisodeFilled | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [watchingId, setWatchingId] = useState<string | null>(null)
  const [lastSaveOk, setLastSaveOk] = useState(false)

  const [transcriptSlot, setTranscriptSlot] = useState<CoursePodcastEpisodeFilled | null>(null)
  const [transcriptText, setTranscriptText] = useState<string>('')
  const [transcriptLoading, setTranscriptLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingPack(true)
    setPackError(null)
    setMeta(null)
    setRef(null)

    void loadCoursePodcastPackForCatalogueCourse(catalogueCourseId)
      .then((loaded) => {
        if (cancelled) return
        if (!loaded) {
          setPackError(
            packRef?.status === 'hold'
              ? packRef.note || 'Podcast pack for this course is on hold.'
              : 'No podcast pack is mapped to this course yet.',
          )
          return
        }
        setMeta(loaded.meta)
        setRef(loaded.ref)
      })
      .catch((err) => {
        if (cancelled) return
        setPackError(err instanceof Error ? err.message : 'Could not load course podcasts.')
      })
      .finally(() => {
        if (!cancelled) setLoadingPack(false)
      })

    return () => {
      cancelled = true
    }
  }, [catalogueCourseId, packRef?.note, packRef?.status])

  const episodes = useMemo(() => (meta ? listPlayableEpisodes(meta) : []), [meta])

  const getStage = (episode: CoursePodcastEpisodeFilled): PodcastStage => {
    if (!ref) return 'not_watched'
    const s = getPodcastState(progress, episodeProgressId(ref.packId, episode.slot))
    if (s.passed) return 'passed'
    if (s.attempts > 0 && !s.passed) return 'failed'
    if (s.watched) return 'watched'
    return 'not_watched'
  }

  const passedCount = episodes.filter((e) => getStage(e) === 'passed').length

  const handleWatch = async (episode: CoursePodcastEpisodeFilled) => {
    if (!uid || !ref) return
    if (episode.url) {
      window.open(episode.url, '_blank', 'noopener,noreferrer')
    }
    const podcastId = episodeProgressId(ref.packId, episode.slot)
    setWatchingId(podcastId)
    try {
      const next = await markPodcastWatched(uid, podcastId)
      patchProgress(podcastId, next)
    } catch (err) {
      console.error('[CoursePodcastSeriesPanel] markWatched failed', err)
      toast({
        status: 'error',
        title: 'Could not save progress',
        description: 'Try again in a moment.',
      })
    } finally {
      setWatchingId(null)
    }
  }

  const handleOpenTranscript = async (episode: CoursePodcastEpisodeFilled) => {
    if (!ref || !episode.transcript_file) return
    setTranscriptSlot(episode)
    setTranscriptText('')
    setTranscriptLoading(true)
    try {
      const text = await loadCoursePodcastTranscript({
        packId: ref.packId,
        slot: episode.slot,
      })
      setTranscriptText(text)
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not load transcript',
        description: err instanceof Error ? err.message : 'Try again.',
      })
      setTranscriptSlot(null)
    } finally {
      setTranscriptLoading(false)
    }
  }

  const handleQuizSubmit = async ({
    answers,
    score,
    passed,
  }: {
    answers: string[]
    score: number
    passed: boolean
  }): Promise<boolean> => {
    if (!uid || !ref || !quizEpisode) return false
    const podcastId = episodeProgressId(ref.packId, quizEpisode.slot)
    setSubmittingId(podcastId)
    setLastSaveOk(false)
    try {
      const prev = getPodcastState(progress, podcastId)
      const wasAlreadyPaid = Boolean(prev.pointsAwardedAt)
      const shouldAwardPoints = passed && !wasAlreadyPaid

      // Persist written answers for later AI/partner review (Nono compliance).
      const existingAnswers = profile?.coursePodcastAnswers ?? {}
      await updateProfile({
        coursePodcastAnswers: {
          ...existingAnswers,
          [podcastId]: {
            catalogueCourseId,
            packId: ref.packId,
            slot: quizEpisode.slot,
            answers,
            submittedAt: new Date().toISOString(),
          },
        },
      })

      const next = await recordAssessmentAttempt(
        uid,
        podcastId,
        score,
        passed,
        shouldAwardPoints,
        prev.bestScore,
        prev.attempts,
      )
      patchProgress(podcastId, next)
      setLastSaveOk(true)

      if (shouldAwardPoints) {
        try {
          await awardChecklistPoints({
            uid,
            journeyType,
            weekNumber: currentWeek,
            activity,
            source: 'podcast_quiz',
            claimRef: podcastId,
          })
          await onPointsAwarded?.()
        } catch (err) {
          console.error('[CoursePodcastSeriesPanel] points award failed', err)
        }
      }

      if (passed) {
        toast({
          status: 'success',
          title: `+${activity.points.toLocaleString()} points`,
          description: `Assessment submitted for ${quizEpisode.slot}.`,
          duration: 3500,
        })
      }
      return true
    } catch (err) {
      console.error('[CoursePodcastSeriesPanel] submit failed', err)
      toast({
        status: 'error',
        title: 'Could not save your assessment',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
      setLastSaveOk(false)
      return false
    } finally {
      setSubmittingId(null)
    }
  }

  if (loadingPack || progressLoading) {
    return (
      <Box p={4} bg="gray.50" rounded="md" border="1px solid" borderColor="gray.200">
        <Text fontSize="sm" color="gray.600">
          Loading podcasts for this course…
        </Text>
      </Box>
    )
  }

  if (packError || !meta || !ref) {
    return (
      <Box p={4} bg="gray.50" rounded="md" border="1px solid" borderColor="gray.200">
        <Text fontSize="sm" color="gray.600">
          {packError || 'No podcasts available for this course yet.'}
        </Text>
      </Box>
    )
  }

  if (episodes.length === 0) {
    return (
      <Box p={4} bg="gray.50" rounded="md" border="1px solid" borderColor="gray.200">
        <Text fontSize="sm" color="gray.600">
          This course’s podcast pack has no playable episodes yet.
        </Text>
      </Box>
    )
  }

  return (
    <Stack spacing={4}>
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
          <Text fontSize="xs" fontWeight="semibold" letterSpacing="wide" color="gray.500">
            Course podcasts · {ref.packId}
            {ref.status === 'partial' ? ' · partial pack' : ''}
          </Text>
          <Text fontSize="sm" fontWeight="bold" color={PLUM} noOfLines={2}>
            {course?.title || meta.course_name}
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
          {passedCount} of {episodes.length} passed
        </Box>
      </Flex>

      <Stack spacing={2}>
        {episodes.map((episode) => {
          const podcastId = episodeProgressId(ref.packId, episode.slot)
          const stage = getStage(episode)
          const isWatchBusy = watchingId === podcastId
          const isQuizBusy = submittingId === podcastId
          const isPassed = stage === 'passed'
          const hasUrl = Boolean(episode.url)
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
              key={podcastId}
              p={4}
              bg={isPassed ? 'yellow.50' : 'white'}
              border="1px solid"
              borderColor={isPassed ? 'yellow.200' : 'gray.200'}
              borderLeftWidth="3px"
              borderLeftColor={accentColor}
              rounded="md"
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
                      textTransform="capitalize"
                    >
                      {episode.slot}
                    </Box>
                    {episode.show_name ? (
                      <Text fontSize="xs" color="gray.500" noOfLines={1}>
                        {episode.show_name}
                      </Text>
                    ) : null}
                    {stage === 'failed' && (
                      <Badge colorScheme="red" variant="subtle" fontSize="xs" rounded="full" px={2}>
                        Try again
                      </Badge>
                    )}
                  </HStack>
                  <Text fontWeight="semibold" color={PLUM} fontSize="sm" lineHeight="1.4">
                    {episode.episode_title}
                  </Text>
                  {episode.guest ? (
                    <Text fontSize="xs" color="gray.500">
                      {episode.guest}
                      {episode.duration_minutes ? ` · ~${episode.duration_minutes} min` : ''}
                    </Text>
                  ) : null}
                  {!hasUrl && !isPassed && (
                    <HStack spacing={1} color="gray.500" fontSize="xs">
                      <Icon as={Lock} boxSize={3} />
                      <Text>Episode link unavailable</Text>
                    </HStack>
                  )}
                </Stack>

                <HStack spacing={2} flexShrink={0} flexWrap="wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="gray.300"
                    color={PLUM}
                    _hover={{ bg: 'gray.50', borderColor: 'gray.400' }}
                    leftIcon={<Icon as={hasUrl ? Play : Lock} boxSize={3.5} />}
                    rightIcon={hasUrl ? <Icon as={ExternalLink} boxSize={3} /> : undefined}
                    isDisabled={!hasUrl}
                    isLoading={isWatchBusy}
                    onClick={() => void handleWatch(episode)}
                  >
                    {!hasUrl ? 'Unavailable' : isPassed ? 'Replay' : 'Watch'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="gray.300"
                    color={PLUM}
                    _hover={{ bg: 'gray.50' }}
                    leftIcon={<Icon as={BookOpen} boxSize={3.5} />}
                    isLoading={transcriptLoading && transcriptSlot?.slot === episode.slot}
                    onClick={() => void handleOpenTranscript(episode)}
                  >
                    Transcript
                  </Button>

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
                      onClick={async () => {
                        if (hasUrl && stage === 'not_watched') {
                          await handleWatch(episode)
                        }
                        setLastSaveOk(false)
                        setQuizEpisode(episode)
                      }}
                    >
                      {stage === 'failed' ? 'Retry test' : 'Take test'}
                    </Button>
                  )}

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

      <CoursePodcastAssessmentModal
        isOpen={quizEpisode !== null}
        episode={quizEpisode}
        isSubmitting={Boolean(quizEpisode && submittingId === episodeProgressId(ref.packId, quizEpisode.slot))}
        saveSucceeded={lastSaveOk}
        onClose={() => {
          setQuizEpisode(null)
          setLastSaveOk(false)
        }}
        onSubmit={handleQuizSubmit}
      />

      <Drawer
        isOpen={Boolean(transcriptSlot)}
        placement="right"
        size="lg"
        onClose={() => setTranscriptSlot(null)}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">
            <Text fontSize="sm" color="gray.500" textTransform="capitalize">
              {transcriptSlot?.slot} transcript
            </Text>
            <Text fontSize="md" color={PLUM} noOfLines={2}>
              {transcriptSlot?.episode_title}
            </Text>
          </DrawerHeader>
          <DrawerBody>
            {transcriptLoading ? (
              <Text fontSize="sm" color="gray.500">
                Loading transcript…
              </Text>
            ) : (
              <Text
                as="pre"
                whiteSpace="pre-wrap"
                fontFamily="inherit"
                fontSize="sm"
                color="gray.700"
                lineHeight="1.7"
              >
                {transcriptText}
              </Text>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Stack>
  )
}

export default CoursePodcastSeriesPanel
