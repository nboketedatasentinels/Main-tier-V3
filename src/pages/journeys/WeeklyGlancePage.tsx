import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { motion, useReducedMotion } from 'framer-motion'
import { FirestoreError } from 'firebase/firestore'
import { supabase } from '@/services/supabase'
import { resolveJourneyType } from '@/utils/journeyType'
import { computeJourneyPace } from '@/utils/journeyPace'
import type { JourneyType } from '@/config/pointsConfig'
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Fingerprint,
  Star,
  TrendingUp,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'
import { RulesOfEngagementVideo } from '@/components/courses/RulesOfEngagementVideo'
import { AssignedCoursesCarousel } from '@/components/journeys/weeklyGlance/AssignedCoursesCarousel'
import { SelfCourseAssessment } from '@/components/assessments/SelfCourseAssessment'
import {
  PRE_COURSE_SURVEY_SECTION_ID,
  PreCourseSurveyButton,
} from '@/components/assessments/PreCourseSurveyButton'
import { resolveCourseSurveyKind, courseSurveySectionTitle } from '@/utils/courseSurveyWindow'
import { useAssignedCourses, type AssignedCourse } from '@/hooks/useAssignedCourses'
import { useCourseOpenGate } from '@/hooks/useCourseOpenGate'
import { useUserCourseCompletions } from '@/hooks/useUserCourseCompletions'
import { canAccessCourse } from '@/utils/membership'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier, type UserProfile } from '@/types'
import { getOrganizationJourney } from '@/services/supabaseOrgService'
import { updateUserVillageId } from '@/services/userProfileService'
import { checkVillageNameExists, createVillage } from '@/services/villageService'
import { getJourneyTiming } from '@/utils/weekCalculations'
import { JOURNEY_META } from '@/config/pointsConfig'
import { CORE_VALUES, PERSONALITY_TYPES } from '@/config/personality-data'
import {
  TestResultPicker,
  type ResultOption,
} from '@/components/personality/TestResultPicker'
import {
  buildTestUnlockMessage,
  formatRemainingWait,
  getTestUnlockState,
} from '@/utils/testResultUnlock'

const MotionBox = motion(Box)

function isCorporateUser(profile: UserProfile | null | undefined) {
  const tier = profile?.transformationTier
  return tier === TransformationTier.CORPORATE_MEMBER || tier === TransformationTier.CORPORATE_LEADER
}

function canCreateVillage(profile: UserProfile | null | undefined) {
  // Free learners auto-join the shared Free Learners Village - private create is disabled.
  void profile
  void isCorporateUser
  return false
}

type KpiTheme = 'purple' | 'orange' | 'green' | 'yellow' | 'red' | 'blue'

interface KpiThemeStyles {
  iconBg: string
  iconShadow: string
  ornamentBg: string
  hoverShadow: string
  hoverBorder: string
}

const kpiThemes: Record<KpiTheme, KpiThemeStyles> = {
  purple: {
    iconBg: '#350e6f',
    iconShadow: '0 4px 12px rgba(53, 14, 111, 0.3)',
    ornamentBg: 'purple.50',
    hoverShadow: '0 8px 25px rgba(139, 92, 246, 0.15)',
    hoverBorder: 'purple.200',
  },
  orange: {
    iconBg: 'linear-gradient(135deg, #f4540c 0%, #c2410c 100%)',
    iconShadow: '0 4px 12px rgba(244, 84, 12, 0.3)',
    ornamentBg: 'orange.50',
    hoverShadow: '0 8px 25px rgba(244, 84, 12, 0.15)',
    hoverBorder: 'orange.200',
  },
  green: {
    iconBg: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
    iconShadow: '0 4px 12px rgba(4, 120, 87, 0.3)',
    ornamentBg: 'green.50',
    hoverShadow: '0 8px 25px rgba(16, 185, 129, 0.15)',
    hoverBorder: 'green.200',
  },
  yellow: {
    iconBg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
    iconShadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
    ornamentBg: 'yellow.50',
    hoverShadow: '0 8px 25px rgba(217, 119, 6, 0.15)',
    hoverBorder: 'yellow.200',
  },
  red: {
    iconBg: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    iconShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
    ornamentBg: 'red.50',
    hoverShadow: '0 8px 25px rgba(220, 38, 38, 0.15)',
    hoverBorder: 'red.200',
  },
  blue: {
    iconBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    iconShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
    ornamentBg: 'blue.50',
    hoverShadow: '0 8px 25px rgba(37, 99, 235, 0.15)',
    hoverBorder: 'blue.200',
  },
}

const toneToTheme = (tone: 'default' | 'green' | 'yellow' | 'red'): KpiTheme => {
  if (tone === 'green') return 'green'
  if (tone === 'yellow') return 'yellow'
  if (tone === 'red') return 'red'
  return 'purple'
}

interface KpiTileProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  theme: KpiTheme
}

const KpiTile = ({ label, value, sub, icon, theme }: KpiTileProps) => {
  const styles = kpiThemes[theme]
  return (
    <Box
      p={5}
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.100"
      boxShadow="0 2px 8px rgba(0,0,0,0.04)"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: styles.hoverShadow,
        borderColor: styles.hoverBorder,
      }}
      transition="all 0.3s ease"
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        top={0}
        right={0}
        w="60px"
        h="60px"
        bg={styles.ornamentBg}
        borderRadius="0 0 0 100%"
      />
      <Flex
        w={10}
        h={10}
        bg={styles.iconBg}
        borderRadius="xl"
        align="center"
        justify="center"
        mb={3}
        boxShadow={styles.iconShadow}
      >
        <Box as={icon} w={5} h={5} color="white" />
      </Flex>
      <Text
        fontSize="xs"
        color="gray.500"
        fontWeight="semibold"
        textTransform="uppercase"
        letterSpacing="wide"
        mb={1}
      >
        {label}
      </Text>
      <Text
        fontWeight="bold"
        fontSize="3xl"
        color="gray.800"
        lineHeight="1.1"
        letterSpacing="-0.02em"
      >
        {value}
      </Text>
      {sub && (
        <Text fontSize="xs" color="gray.500" mt={1}>
          {sub}
        </Text>
      )}
    </Box>
  )
}

interface ResultSelectSlotProps {
  label: string
  /** True once the learner has recorded their result for this test. */
  hasResult: boolean
  /** Unlock state driven by when they opened the external test. */
  unlockStatus: 'not_started' | 'waiting' | 'unlocked'
  /** CTA shown before the learner has started this test. */
  completeButtonLabel: string
  onCompleteTest: () => void
  /** Shown while the 1-hour cooldown is still running. */
  waitMessage: string
  /** Shown once results can be selected. */
  selectHelper: string
  /** Dropdown listing every possible outcome of this test. */
  resultPicker: ReactNode
}

const ResultSelectSlot = ({
  label,
  hasResult,
  unlockStatus,
  completeButtonLabel,
  onCompleteTest,
  waitMessage,
  selectHelper,
  resultPicker,
}: ResultSelectSlotProps) => {
  const hasProof = hasResult
  // Button first; after click the slot becomes an input (still locked until 1h).
  const showResultInput = hasProof || unlockStatus === 'waiting' || unlockStatus === 'unlocked'

  return (
    <Box
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={hasProof ? 'green.300' : unlockStatus === 'waiting' ? 'orange.200' : 'gray.300'}
      bg={hasProof ? 'green.50' : unlockStatus === 'waiting' ? 'orange.50' : 'gray.50'}
      borderRadius="md"
      p={2}
    >
      <Stack spacing={1.5}>
        <HStack spacing={2} align="center">
          <Flex
            w={6}
            h={6}
            borderRadius="sm"
            bg={hasProof ? 'green.100' : unlockStatus === 'waiting' ? 'orange.100' : 'white'}
            borderWidth="1px"
            borderColor={hasProof ? 'green.300' : unlockStatus === 'waiting' ? 'orange.200' : 'gray.200'}
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Box
              as={hasProof ? CheckCircle2 : unlockStatus === 'waiting' ? Clock : Upload}
              w={3}
              h={3}
              color={hasProof ? 'green.600' : unlockStatus === 'waiting' ? 'orange.500' : 'gray.500'}
            />
          </Flex>
          <Stack spacing={0} flex={1} minW={0}>
            <Text fontSize="xs" fontWeight="semibold" color="gray.800" noOfLines={1}>
              {label}
            </Text>
            <Text fontSize="2xs" color={unlockStatus === 'waiting' ? 'orange.700' : 'gray.500'} noOfLines={2}>
              {hasProof
                ? 'Saved - change below'
                : unlockStatus === 'waiting'
                  ? waitMessage
                  : unlockStatus === 'unlocked'
                    ? selectHelper
                    : 'Click below to start the test - results unlock after 1 hour'}
            </Text>
          </Stack>
        </HStack>

        {showResultInput ? (
          resultPicker
        ) : (
          <Button
            size="xs"
            bg="brand.primary"
            color="white"
            _hover={{ bg: 'brand.dark' }}
            rightIcon={<Box as={ArrowUpRight} w={3} h={3} />}
            onClick={onCompleteTest}
            w="full"
          >
            {completeButtonLabel}
          </Button>
        )}
      </Stack>
    </Box>
  )
}

export const WeeklyGlancePage = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { profile, refreshProfile, updateProfile } = useAuth()
  const data = useWeeklyGlanceData()
  const prefersReducedMotion = useReducedMotion()

  // Programme courses, rendered with the same card as the My Courses timeline.
  const {
    courses: assignedCourses,
    loading: assignedLoading,
    hasOrganization: hasCourseOrganization,
  } = useAssignedCourses()
  const { completionsByKey } = useUserCourseCompletions(profile?.id)
  const { requestOpenCourse, surveyModal } = useCourseOpenGate()

  const orgCourseTitles = useMemo(() => {
    const titles: string[] = []
    const seen = new Set<string>()
    for (const course of assignedCourses) {
      const title = course.title?.trim()
      if (!title) continue
      const key = title.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      titles.push(title)
    }
    return titles
  }, [assignedCourses])

  // Course a learner tried to open before finishing their personality profile,
  // so we can offer it back to them the moment they finish.
  const [pendingCourse, setPendingCourse] = useState<AssignedCourse | null>(null)
  const [highlightPersonality, setHighlightPersonality] = useState(false)
  const highlightTimer = useRef<number>()
  const {
    isOpen: isPersonalityPromptOpen,
    onOpen: openPersonalityPrompt,
    onClose: closePersonalityPrompt,
  } = useDisclosure()

  const [isBuildVillageOpen, setIsBuildVillageOpen] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')
  const [isCreatingVillage, setIsCreatingVillage] = useState(false)
  const [villageError, setVillageError] = useState<string | undefined>()

  const [orgCohortStartDate, setOrgCohortStartDate] = useState<string | null>(null)
  const [orgJourneyType, setOrgJourneyType] = useState<JourneyType | null>(null)

  const [savingResult, setSavingResult] = useState<'personality' | 'values' | null>(null)
  const [proofError, setProofError] = useState<string | null>(null)
  // Tick so "wait X minutes" helpers stay accurate while the page is open.
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // Every possible outcome of each test, so learners select what they got.
  const personalityOptions = useMemo<ResultOption[]>(
    () =>
      PERSONALITY_TYPES.map((pt) => ({
        value: pt.type,
        label: `${pt.type} - ${pt.name}`,
        group: pt.group,
      })),
    [],
  )
  const valuesOptions = useMemo<ResultOption[]>(
    () => CORE_VALUES.map((value) => ({ value, label: value })),
    [],
  )

  /**
   * Persist a picked test result. Writes the same profile fields the
   * "Complete now" modal uses (personalityType / coreValues), so the card and
   * the modal always show the same answer.
   */
  const handleResultSelect = useCallback(
    async (kind: 'personality' | 'values', next: string[]) => {
      if (!profile?.id) {
        setProofError('You need to be signed in to save your result.')
        return
      }

      const startedAt =
        kind === 'personality' ? profile.personalityTestStartedAt : profile.valuesTestStartedAt
      const alreadySaved =
        kind === 'personality'
          ? Boolean(profile.personalityType)
          : (profile.coreValues?.length ?? 0) > 0
      const unlock = getTestUnlockState(startedAt, Date.now())
      if (!alreadySaved && unlock.status !== 'unlocked') {
        const label = kind === 'personality' ? '16Personalities test' : 'Personal Values test'
        const message = buildTestUnlockMessage(unlock, label)
        setProofError(message)
        toast({
          title: 'Finish your test first',
          description: message,
          status: 'info',
          duration: 6000,
          isClosable: true,
        })
        return
      }

      setProofError(null)
      setSavingResult(kind)
      // The completion flags used to be set when a results link was saved. The
      // link inputs are gone, so selecting a result is now what marks the test
      // done - these flags gate the MainLayout prompt, the profile modal and
      // partner reporting. Values needs all 5 before it counts as complete.
      const updates: Partial<UserProfile> =
        kind === 'personality'
          ? {
              personalityType: next[0] ?? '',
              hasCompletedPersonalityTest: Boolean(next[0]),
            }
          : {
              coreValues: next,
              hasCompletedValuesTest: next.length === 5,
            }
      const { error: saveErr } = await updateProfile(updates)
      if (saveErr) {
        console.error('[WeeklyGlance] result select save failed', saveErr)
        setProofError('Could not save your result. Please try again.')
        setSavingResult(null)
        return
      }

      // Tell the org's transformation partner, exactly as saving a results link
      // used to. A direct insert is blocked by RLS (notifications_insert
      // requires is_partner_or_admin), so this SECURITY DEFINER RPC resolves the
      // partner and writes server-side. Only fires once the test is actually
      // complete, so picking values one at a time sends a single notification.
      const isComplete = kind === 'personality' ? Boolean(next[0]) : next.length === 5
      if (isComplete) {
        void supabase
          .rpc('notify_partner_test_result', { p_kind: kind, p_results_url: next.join(', ') })
          .then(({ error }) => {
            if (error) console.warn('[WeeklyGlance] partner notification failed (non-fatal)', error)
          })
        toast({
          title: 'Result saved',
          description: 'Your partner has been notified of your results.',
          status: 'success',
          duration: 3500,
        })
      }
      setSavingResult(null)
    },
    [profile, toast, updateProfile],
  )

  /**
   * Open the external assessment and stamp the start time (once) so result
   * selection unlocks 1 hour later for that specific test.
   */
  const handleOpenExternalTest = useCallback(
    async (kind: 'personality' | 'values') => {
      const url =
        kind === 'personality'
          ? 'https://www.16personalities.com/free-personality-test'
          : 'https://personalvalu.es/'
      window.open(url, '_blank', 'noopener,noreferrer')

      if (!profile?.id) return
      const field = kind === 'personality' ? 'personalityTestStartedAt' : 'valuesTestStartedAt'
      if (profile[field]) {
        const unlock = getTestUnlockState(profile[field], Date.now())
        if (unlock.status === 'waiting') {
          toast({
            title: 'Test already started',
            description: `Wait until ${formatRemainingWait(unlock.remainingMs)} to select your results.`,
            status: 'info',
            duration: 5000,
            isClosable: true,
          })
        }
        return
      }

      const { error } = await updateProfile({ [field]: new Date().toISOString() })
      if (error) {
        console.warn('[WeeklyGlance] could not record test start time', error)
        toast({
          title: 'Could not start the unlock timer',
          description: 'Open the test again so we can unlock results in 1 hour.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        })
        return
      }

      toast({
        title: 'Test started',
        description: 'Come back in 1 hour to select your results.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
    },
    [profile, toast, updateProfile],
  )

  const personalityUnlock = useMemo(
    () => getTestUnlockState(profile?.personalityTestStartedAt, nowTick),
    [nowTick, profile?.personalityTestStartedAt],
  )
  const valuesUnlock = useMemo(
    () => getTestUnlockState(profile?.valuesTestStartedAt, nowTick),
    [nowTick, profile?.valuesTestStartedAt],
  )
  const personalityResultLocked =
    !profile?.personalityType && personalityUnlock.status !== 'unlocked'
  const valuesResultLocked =
    (profile?.coreValues?.length ?? 0) === 0 && valuesUnlock.status !== 'unlocked'

  const personalityResultHelper = useMemo(() => {
    if (personalityUnlock.status === 'waiting') {
      return `Wait until ${formatRemainingWait(personalityUnlock.remainingMs)} to select your results`
    }
    return 'Select the type you got'
  }, [personalityUnlock])

  const valuesResultHelper = useMemo(() => {
    if (valuesUnlock.status === 'waiting') {
      return `Wait until ${formatRemainingWait(valuesUnlock.remainingMs)} to select your results`
    }
    return 'Select the 5 values you got'
  }, [valuesUnlock])

  const showLockedAttempt = useCallback(
    (kind: 'personality' | 'values') => {
      const unlock = kind === 'personality' ? personalityUnlock : valuesUnlock
      const label = kind === 'personality' ? '16Personalities test' : 'Personal Values test'
      const message = buildTestUnlockMessage(unlock, label)
      setProofError(message)
      toast({
        title: 'Finish your test first',
        description: message,
        status: 'info',
        duration: 6000,
        isClosable: true,
      })
    },
    [personalityUnlock, toast, valuesUnlock],
  )

  // Both assessments done - used to unlock course access gated on this profile.
  const bothTestsCompleted = Boolean(
    profile?.hasCompletedPersonalityTest && profile?.hasCompletedValuesTest,
  )

  // Checklist stays hidden until the learner has entered both test results on
  // this page (type + all 5 values). Same gate as the result slots below.
  const canOpenWeeklyChecklist =
    Boolean(profile?.personalityType) && (profile?.coreValues?.length ?? 0) === 5

  useEffect(() => {
    if (!profile?.companyId) {
      setOrgCohortStartDate(null)
      setOrgJourneyType(null)
      return
    }
    let cancelled = false
    // Org journey + cohort start now live in Supabase (the Firebase org doc was
    // deleted in the migration). getOrganizationJourney reads the journey_type /
    // cohort_start_date columns directly.
    void getOrganizationJourney(profile.companyId).then((info) => {
      if (cancelled || !info) return
      if (info.cohortStartDate) setOrgCohortStartDate(info.cohortStartDate)
      const resolved = info.journeyType
        ? (resolveJourneyType({ journeyType: info.journeyType }) as JourneyType | undefined)
        : undefined
      if (resolved) setOrgJourneyType(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.companyId])

  const effectiveJourneyType = (orgJourneyType ?? profile?.journeyType ?? '6W') as JourneyType
  const effectiveStartDate = orgCohortStartDate ?? profile?.journeyStartDate ?? null
  const effectiveDurationWeeks = JOURNEY_META[effectiveJourneyType]?.weeks ?? profile?.programDurationWeeks ?? 6

  const journeyTiming = useMemo(
    () => getJourneyTiming(effectiveStartDate, effectiveDurationWeeks),
    [effectiveStartDate, effectiveDurationWeeks]
  )

  const currentWeek = journeyTiming?.currentWeek ?? data.weekNumber
  const totalWeeks = effectiveDurationWeeks
  const cycleNumber = journeyTiming?.currentCycle ?? Math.ceil(currentWeek / 2)
  const totalCycles = journeyTiming?.totalCycles ?? Math.max(1, Math.ceil(totalWeeks / 2))

  // Pending items awaiting partner reward: everything the learner has submitted
  // (capstone/case study/any partner-approved activity) that the partner hasn't
  // actioned yet. Source of truth is the Supabase `point_verifications` store
  // (status = 'pending'). Live-refreshed so a fresh submission shows up at once.
  const [pending, setPending] = useState<{ count: number; points: number }>({ count: 0, points: 0 })
  useEffect(() => {
    const uid = profile?.id
    if (!uid) {
      setPending({ count: 0, points: 0 })
      return
    }
    let active = true
    const load = async () => {
      const { data: rows, error } = await supabase
        .from('point_verifications')
        .select('points')
        .eq('uid', uid)
        .eq('status', 'pending')
      if (!active || error) return
      const list = rows ?? []
      const points = list.reduce((sum, r) => {
        const p = typeof r.points === 'number' ? r.points : Number(r.points)
        return sum + (Number.isFinite(p) ? p : 0)
      }, 0)
      setPending({ count: list.length, points })
    }
    void load()
    const channel = supabase
      .channel(`glance_pending_${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'point_verifications', filter: `uid=eq.${uid}` },
        () => void load(),
      )
      .subscribe()
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [profile?.id])

  const passMark = JOURNEY_META[effectiveJourneyType]?.passMarkPoints ?? 0
  const totalEarned = useMemo(
    () => (data.ledgerEntries ?? []).reduce((sum, entry) => sum + (entry.points ?? 0), 0),
    [data.ledgerEntries],
  )
  // Progress against the pass mark - the number that decides whether a learner
  // graduates, and the same denominator the "Points earned" tile quotes.
  const journeyProgress =
    passMark > 0 ? Math.min(100, Math.round((totalEarned / passMark) * 100)) : 0
  const daysElapsed = journeyTiming?.totalDaysElapsed ?? 0
  const pace = useMemo(
    () =>
      computeJourneyPace({
        totalEarned,
        passMark,
        daysElapsed,
        totalWeeks,
        journeyType: effectiveJourneyType,
        currentWeek,
      }),
    [totalEarned, passMark, daysElapsed, totalWeeks, effectiveJourneyType, currentWeek],
  )

  // Courses sit beside the video; keep the column out of the layout entirely
  // when the learner has no programme courses to show.
  const showAssignedCourses =
    (assignedLoading && hasCourseOrganization) || assignedCourses.length > 0

  const courseSurveyKind = useMemo(
    () =>
      resolveCourseSurveyKind({
        journeyStartDate: journeyTiming?.journeyStart ?? profile?.journeyStartDate,
        programDurationWeeks: totalWeeks,
        currentWeek,
      }),
    [journeyTiming?.journeyStart, profile?.journeyStartDate, totalWeeks, currentWeek],
  )

  /** Scroll the personality card into view and flash a ring around it. */
  const focusPersonalityCard = useCallback(() => {
    closePersonalityPrompt()
    window.requestAnimationFrame(() => {
      document
        .getElementById('personality-profile-card')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    setHighlightPersonality(true)
    window.clearTimeout(highlightTimer.current)
    highlightTimer.current = window.setTimeout(() => setHighlightPersonality(false), 2600)
  }, [closePersonalityPrompt])

  useEffect(() => () => window.clearTimeout(highlightTimer.current), [])

  /**
   * Card click. Courses open only once the personality profile is done - the
   * results shape the course experience - so an unfinished profile is bounced
   * to the card at the top of this page rather than to another route.
   */
  const handleCourseCardClick = useCallback(
    (course: AssignedCourse) => {
      if (course.availability === 'locked') {
        toast({
          status: 'info',
          title: 'Not open yet',
          description: course.unlockDate
            ? `This course unlocks on ${format(course.unlockDate, 'MMM d')}.`
            : 'This course is not open yet.',
          duration: 3500,
        })
        return
      }

      if (!canAccessCourse(profile, course.title, course.id)) {
        navigate('/upgrade')
        return
      }

      if (!course.link) {
        toast({
          status: 'info',
          title: 'Course link unavailable',
          description: 'Your partner has not added the link for this course yet.',
          duration: 3500,
        })
        return
      }

      if (!bothTestsCompleted) {
        setPendingCourse(course)
        openPersonalityPrompt()
        return
      }

      setPendingCourse(null)
      requestOpenCourse(course.link, course.title)
    },
    [bothTestsCompleted, navigate, openPersonalityPrompt, profile, requestOpenCourse, toast],
  )

  /**
   * Finished the profile with a course waiting? Offer it straight back. The
   * open has to come from a click (a background window.open is blocked), so
   * the toast carries the button.
   */
  useEffect(() => {
    if (!pendingCourse || !bothTestsCompleted) return
    const course = pendingCourse
    setPendingCourse(null)
    setHighlightPersonality(false)
    toast({
      status: 'success',
      duration: 12000,
      isClosable: true,
      position: 'bottom-right',
      render: ({ onClose }) => (
        <Box bg="white" borderWidth="1px" borderColor="green.200" borderRadius="xl" boxShadow="lg" p={4}>
          <Stack spacing={3}>
            <Stack spacing={0.5}>
              <Text fontWeight="semibold" color="gray.900">
                Profile complete
              </Text>
              <Text fontSize="sm" color="gray.600">
                {course.title} is ready when you are.
              </Text>
            </Stack>
            <HStack spacing={2}>
              <Button
                size="sm"
                bg="brand.primary"
                color="white"
                _hover={{ bg: 'brand.dark' }}
                rightIcon={<Box as={ArrowUpRight} w={4} h={4} />}
                onClick={() => {
                  onClose()
                  if (course.link) requestOpenCourse(course.link, course.title)
                }}
              >
                Open course
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Later
              </Button>
            </HStack>
          </Stack>
        </Box>
      ),
    })
  }, [bothTestsCompleted, pendingCourse, requestOpenCourse, toast])

  const shouldShowBuildVillageCard = canCreateVillage(profile)

  const personalityIncomplete = useMemo(() => {
    if (data.loading.profile) return false
    const hasPersonalityType = Boolean(profile?.hasCompletedPersonalityTest) && Boolean(data.personality?.personalityType)
    const hasCoreValues = Boolean(profile?.hasCompletedValuesTest) && (data.personality?.coreValues?.length ?? 0) > 0
    return !hasPersonalityType || !hasCoreValues
  }, [data.loading.profile, data.personality, profile?.hasCompletedPersonalityTest, profile?.hasCompletedValuesTest])

  const firstName = useMemo(() => {
    const name = profile?.firstName ?? profile?.fullName ?? profile?.email ?? ''
    return name.split(' ')[0] || 'there'
  }, [profile?.firstName, profile?.fullName, profile?.email])

  const today = useMemo(() => format(new Date(), 'EEEE, MMMM d'), [])

  const resetVillageForm = useCallback(() => {
    setVillageName('')
    setVillagePurpose('')
    setVillageError(undefined)
  }, [])

  const openVillageModal = useCallback(() => {
    setVillageError(undefined)
    setIsBuildVillageOpen(true)
  }, [])

  const closeVillageModal = useCallback(() => {
    if (isCreatingVillage) return
    setIsBuildVillageOpen(false)
    setVillageError(undefined)
  }, [isCreatingVillage])

  const resolveVillageErrorMessage = useCallback((error: unknown): string => {
    if (error && typeof error === 'object' && 'code' in error) {
      const firestoreError = error as FirestoreError
      switch (firestoreError.code) {
        case 'permission-denied':
          return "You don't have permission to create a village. Please contact support."
        case 'unavailable':
        case 'deadline-exceeded':
          return 'Unable to create village. Please check your connection and try again.'
        default:
          return 'Something went wrong. Please try again.'
      }
    }
    if (error instanceof Error) return error.message
    return 'Something went wrong. Please try again.'
  }, [])

  const handleCreateVillage = useCallback(async () => {
    const trimmedName = villageName.trim()
    const trimmedPurpose = villagePurpose.trim()
    const profileId = profile?.id?.trim()

    if (!trimmedName) {
      setVillageError('Please enter a village name.')
      return
    }
    if (!profileId) {
      const message = 'We could not verify your profile. Please refresh and try again.'
      setVillageError(message)
      toast({ status: 'error', title: 'Unable to create village', description: message })
      return
    }

    setIsCreatingVillage(true)
    setVillageError(undefined)

    try {
      const nameExists = await checkVillageNameExists(trimmedName)
      if (nameExists) {
        const message = 'A village with this name already exists. Please choose a different name.'
        setVillageError(message)
        toast({ status: 'error', title: 'Village name taken', description: message })
        return
      }

      const villageId = await createVillage({
        name: trimmedName,
        description: trimmedPurpose,
        creatorId: profileId,
      })
      await updateUserVillageId(profileId, villageId)
      await refreshProfile({ reason: 'village-created' })

      toast({
        status: 'success',
        title: `Your village "${trimmedName}" has been created!`,
        description: 'You can access your village anytime from the navigation.',
      })

      setIsBuildVillageOpen(false)
      resetVillageForm()
    } catch (error) {
      console.error('Failed to create village', error)
      const message = resolveVillageErrorMessage(error)
      setVillageError(message)
      toast({ status: 'error', title: 'Unable to create village', description: message })
    } finally {
      setIsCreatingVillage(false)
    }
  }, [
    profile?.id,
    refreshProfile,
    resetVillageForm,
    resolveVillageErrorMessage,
    toast,
    villageName,
    villagePurpose,
  ])

  const handleNavigateChecklist = useCallback(() => {
    navigate('/app/weekly-checklist')
  }, [navigate])

  return (
    <Box bg="gray.50" minH="100%" p={{ base: 4, md: 8 }} pt={{ base: 4, md: 6 }}>
      <Stack spacing={8} maxW="1400px" mx="auto">
        {/* Header */}
        <Flex
          justify="space-between"
          align={{ base: 'flex-start', md: 'flex-end' }}
          direction={{ base: 'column', md: 'row' }}
          gap={3}
        >
          <Stack spacing={1}>
            <Heading
              size="lg"
              color="gray.900"
              letterSpacing="-0.02em"
              fontWeight="bold"
            >
              Hello, {firstName}
            </Heading>
            <HStack spacing={2} color="gray.500" fontSize="sm">
              <Box as={Calendar} w={4} h={4} />
              <Text>{today}</Text>
              <Text color="gray.300">·</Text>
              <Text>
                Week {currentWeek} of {totalWeeks} · Cycle {cycleNumber} of {totalCycles}
              </Text>
            </HStack>
          </Stack>
          {canOpenWeeklyChecklist && (
            <Button
              onClick={handleNavigateChecklist}
              bg="brand.primary"
              color="white"
              _hover={{ bg: 'brand.dark' }}
              rightIcon={<Box as={ArrowUpRight} w={4} h={4} />}
              size="md"
            >
              Open weekly checklist
            </Button>
          )}
        </Flex>

        {personalityIncomplete && (
          <Box
            id="personality-profile-card"
            bg="white"
            p={5}
            borderRadius="xl"
            // Flashes a ring when a course click sends the learner up here.
            boxShadow={
              highlightPersonality
                ? '0 0 0 3px rgba(53, 14, 111, 0.45), 0 12px 30px rgba(53, 14, 111, 0.18)'
                : '0 2px 8px rgba(0,0,0,0.04)'
            }
            transition="box-shadow 0.35s ease"
            position="relative"
            overflow="hidden"
            borderLeftWidth="4px"
            borderLeftColor="brand.primary"
          >
            <Box position="absolute" top={0} right={0} w="60px" h="60px" bg="purple.50" borderRadius="0 0 0 100%" />
            <Stack spacing={4} position="relative" zIndex={1}>
              <Flex
                justify="space-between"
                align={{ base: 'flex-start', md: 'center' }}
                direction={{ base: 'column', md: 'row' }}
                gap={4}
              >
                <HStack spacing={3} align="center">
                  <Flex
                    w={10}
                    h={10}
                    bg="#350e6f"
                    borderRadius="xl"
                    align="center"
                    justify="center"
                    boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
                    flexShrink={0}
                  >
                    <Box as={Fingerprint} w={5} h={5} color="white" />
                  </Flex>
                  <Stack spacing={0}>
                    <Text
                      fontSize="xs"
                      fontWeight="semibold"
                      textTransform="uppercase"
                      letterSpacing="wide"
                      color="orange.600"
                    >
                      Action required
                    </Text>
                    <Heading size="sm" color="gray.900">
                      Complete your personality profile
                    </Heading>
                    <Text fontSize="sm" color="gray.600" mt={0.5}>
                      Complete each test below. After 1 hour you can select your results.
                    </Text>
                  </Stack>
                </HStack>
              </Flex>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <ResultSelectSlot
                  label="16Personalities result"
                  hasResult={Boolean(profile?.personalityType)}
                  unlockStatus={
                    profile?.personalityType ? 'unlocked' : personalityUnlock.status
                  }
                  completeButtonLabel="Complete personality test"
                  onCompleteTest={() => void handleOpenExternalTest('personality')}
                  waitMessage={personalityResultHelper}
                  selectHelper="Select the type you got"
                  resultPicker={
                    <TestResultPicker
                      mode="single"
                      options={personalityOptions}
                      selected={profile?.personalityType ? [profile.personalityType] : []}
                      onChange={(next) => void handleResultSelect('personality', next)}
                      placeholder={
                        personalityResultLocked
                          ? personalityResultHelper
                          : 'Select your type'
                      }
                      isSaving={savingResult === 'personality'}
                      isLocked={personalityResultLocked}
                      onLockedAttempt={() => showLockedAttempt('personality')}
                    />
                  }
                />
                <ResultSelectSlot
                  label="Personal Values result"
                  hasResult={(profile?.coreValues?.length ?? 0) === 5}
                  unlockStatus={
                    (profile?.coreValues?.length ?? 0) > 0 ? 'unlocked' : valuesUnlock.status
                  }
                  completeButtonLabel="Complete the values test"
                  onCompleteTest={() => void handleOpenExternalTest('values')}
                  waitMessage={valuesResultHelper}
                  selectHelper="Select the 5 values you got"
                  resultPicker={
                    <TestResultPicker
                      mode="multi"
                      maxSelections={5}
                      options={valuesOptions}
                      selected={profile?.coreValues ?? []}
                      onChange={(next) => void handleResultSelect('values', next)}
                      placeholder={
                        valuesResultLocked ? valuesResultHelper : 'Select your values'
                      }
                      isSaving={savingResult === 'values'}
                      isLocked={valuesResultLocked}
                      onLockedAttempt={() => showLockedAttempt('values')}
                    />
                  }
                />
              </SimpleGrid>

              {proofError && (
                <Text fontSize="xs" color="red.500">
                  {proofError}
                </Text>
              )}
            </Stack>
          </Box>
        )}

        {/* Journey progress - thin bar sitting above the KPI tiles */}
        <Stack spacing={2}>
          <Flex justify="space-between" align="baseline" gap={3} flexWrap="wrap">
            <HStack spacing={2} align="baseline">
              <Text
                fontSize="xs"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wide"
                color="gray.500"
              >
                Journey progress
              </Text>
              <Text fontSize="xs" color="gray.400">
                Week {currentWeek} of {totalWeeks} · Cycle {cycleNumber} of {totalCycles}
              </Text>
            </HStack>
            <HStack spacing={3} flexWrap="wrap">
              {hasCourseOrganization ? <PreCourseSurveyButton size="sm" kind={courseSurveyKind} /> : null}
              <Skeleton isLoaded={!data.loading.ledger} rounded="md">
                <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                  {journeyProgress}% of pass mark
                </Text>
              </Skeleton>
            </HStack>
          </Flex>
          <Box h="6px" bg="gray.100" borderRadius="full" overflow="hidden">
            <MotionBox
              h="full"
              borderRadius="full"
              bgGradient={
                journeyProgress >= 100
                  ? 'linear(to-r, #047857, #16a34a)'
                  : 'linear(to-r, #350e6f, #f4540c)'
              }
              initial={prefersReducedMotion ? false : { width: 0 }}
              animate={{ width: `${journeyProgress}%` }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
              }
            />
          </Box>
        </Stack>

        {/* KPI Strip */}
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
          <Skeleton isLoaded={!data.loading.ledger} rounded="xl">
            <KpiTile
              label="Points earned"
              value={totalEarned.toLocaleString()}
              sub={`of ${passMark.toLocaleString()} pass mark`}
              icon={Star}
              theme="purple"
            />
          </Skeleton>
          <KpiTile
            label="Pending items"
            value={pending.count}
            sub={
              pending.count === 0
                ? 'Nothing awaiting review'
                : `+${pending.points.toLocaleString()} pts awaiting partner`
            }
            icon={Clock}
            theme={pending.count > 0 ? 'yellow' : 'orange'}
          />
          <Skeleton isLoaded={!data.loading.points} rounded="xl">
            <KpiTile
              label="Pace"
              value={pace.label}
              sub={pace.detail}
              icon={TrendingUp}
              theme={toneToTheme(pace.tone)}
            />
          </Skeleton>
        </SimpleGrid>

        {/* Rules of Engagement (~2/3) flex-left; assigned courses (~1/3) flex-right. */}
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align="stretch"
          gap={{ base: 6, md: 6 }}
          w="full"
        >
          <Box flex={{ base: 'none', md: showAssignedCourses ? '2 1 0%' : '1 1 auto' }} minW={0} w="full">
            <RulesOfEngagementVideo showCopy={false} />
          </Box>

          {showAssignedCourses && (
            <Stack flex={{ base: 'none', md: '1 1 0%' }} minW={0} w="full" spacing={4}>
              <AssignedCoursesCarousel
                courses={assignedCourses}
                loading={assignedLoading}
                completionsByKey={completionsByKey}
                profile={profile}
                onCourseClick={handleCourseCardClick}
              />
            </Stack>
          )}
        </Flex>

        {profile?.id && hasCourseOrganization ? (
          <Box
            id={PRE_COURSE_SURVEY_SECTION_ID}
            scrollMarginTop="96px"
            bg="white"
            borderRadius="xl"
            border="1px solid"
            borderColor="gray.200"
            p={{ base: 4, md: 6 }}
          >
            <Box mb={5}>
              <Text
                fontSize="xs"
                fontWeight="semibold"
                letterSpacing="0.12em"
                textTransform="uppercase"
                color="gray.500"
              >
                Course assessments
              </Text>
              <Heading size="sm" mt={1} color="gray.900">
                {courseSurveySectionTitle(courseSurveyKind)}
              </Heading>
              <Text mt={1} fontSize="sm" color="gray.600" maxW="640px">
                {courseSurveyKind === 'post'
                  ? orgCourseTitles.length
                    ? `You are in the final stretch. Complete Post for your organisation programme (${orgCourseTitles.join(', ')}).`
                    : 'You are in the final stretch. Complete the Post-course survey for your programme courses.'
                  : orgCourseTitles.length
                    ? `Complete Pre for each course on your organisation programme (${orgCourseTitles.join(', ')}). Post unlocks in the last 3 weeks.`
                    : 'Complete Pre for each course. Post unlocks in the last 3 weeks of the journey.'}
              </Text>
            </Box>
            {orgCourseTitles.length > 0 ? (
              <SelfCourseAssessment
                userId={profile.id}
                forcedKind={courseSurveyKind}
                allowedCourseTitles={orgCourseTitles}
              />
            ) : (
              <Text fontSize="sm" color="gray.500">
                No programme courses assigned yet. Ask your partner or admin to set monthly course
                assignments.
              </Text>
            )}
          </Box>
        ) : null}

        {shouldShowBuildVillageCard && (
          <Box
            bg="white"
            p={6}
            borderRadius="xl"
            border="1px solid"
            borderColor="purple.200"
            boxShadow="0 2px 8px rgba(0,0,0,0.04)"
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(139, 92, 246, 0.15)',
              borderColor: 'purple.300',
            }}
            transition="all 0.3s ease"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={0}
              right={0}
              w="60px"
              h="60px"
              bg="purple.50"
              borderRadius="0 0 0 100%"
            />
            <Flex
              direction={{ base: 'column', md: 'row' }}
              justify="space-between"
              align={{ base: 'flex-start', md: 'center' }}
              gap={4}
            >
              <HStack spacing={3} align="flex-start">
                <Flex
                  w={10}
                  h={10}
                  bg="#350e6f"
                  borderRadius="xl"
                  align="center"
                  justify="center"
                  boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
                  flexShrink={0}
                >
                  <Box as={Users} w={5} h={5} color="white" />
                </Flex>
                <Stack spacing={1}>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    color="brand.primary"
                  >
                    Optional
                  </Text>
                  <Heading size="sm" color="gray.900">
                    Build your village
                  </Heading>
                  <Text fontSize="sm" color="gray.600">
                    Rally your peers into a private group to collaborate and track collective impact.
                  </Text>
                </Stack>
              </HStack>
              <Button
                onClick={openVillageModal}
                bg="brand.primary"
                color="white"
                _hover={{ bg: 'brand.dark' }}
                size="md"
                flexShrink={0}
              >
                Create village
              </Button>
            </Flex>
          </Box>
        )}
      </Stack>

      <BuildVillageModal
        isOpen={isBuildVillageOpen}
        onCreate={handleCreateVillage}
        onSkip={closeVillageModal}
        villageName={villageName}
        villagePurpose={villagePurpose}
        onVillageNameChange={setVillageName}
        onVillagePurposeChange={setVillagePurpose}
        isLoading={isCreatingVillage}
        error={villageError}
      />

      {/* Personality profile gate - shown when a course is clicked too early. */}
      <Modal isOpen={isPersonalityPromptOpen} onClose={closePersonalityPrompt} isCentered size="md">
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" overflow="hidden">
          <Box h="4px" bg="brand.primary" />
          <ModalHeader pb={2}>
            <HStack spacing={3} align="center">
              <Flex
                w={10}
                h={10}
                bg="#350e6f"
                borderRadius="xl"
                align="center"
                justify="center"
                boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
                flexShrink={0}
              >
                <Box as={Fingerprint} w={5} h={5} color="white" />
              </Flex>
              <Stack spacing={0}>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  color="orange.600"
                >
                  One step first
                </Text>
                <Heading size="sm" color="gray.900">
                  Complete your personality profile
                </Heading>
              </Stack>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={2}>
            <Stack spacing={3}>
              <Text fontSize="sm" color="gray.600">
                Your 16Personalities type and your five Personal Values shape how the
                programme is tailored to you, so they need to be on file before you start
                a course.
              </Text>
              {pendingCourse && (
                <Box bg="gray.50" borderWidth="1px" borderColor="gray.200" borderRadius="lg" px={3} py={2}>
                  <Text fontSize="xs" color="gray.500">
                    Waiting for you
                  </Text>
                  <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                    {pendingCourse.title}
                  </Text>
                </Box>
              )}
              <Text fontSize="sm" color="gray.600">
                It takes a couple of minutes - finish it and we&apos;ll bring you straight
                back to this course.
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={closePersonalityPrompt}>
              Not now
            </Button>
            <Button
              bg="brand.primary"
              color="white"
              _hover={{ bg: 'brand.dark' }}
              rightIcon={<Box as={ArrowUpRight} w={4} h={4} />}
              onClick={focusPersonalityCard}
            >
              Complete it now
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {surveyModal}
    </Box>
  )
}
