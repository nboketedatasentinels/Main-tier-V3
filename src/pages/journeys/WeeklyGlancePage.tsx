import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
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
import { AssignedCourseCard } from '@/components/courses/AssignedCourseCard'
import { RulesOfEngagementVideo } from '@/components/courses/RulesOfEngagementVideo'
import { useAssignedCourses, type AssignedCourse } from '@/hooks/useAssignedCourses'
import { useCourseOpenGate } from '@/hooks/useCourseOpenGate'
import { resolveCourseCompletion, useUserCourseCompletions } from '@/hooks/useUserCourseCompletions'
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

const MotionBox = motion(Box)

function isCorporateUser(profile: UserProfile | null | undefined) {
  const tier = profile?.transformationTier
  return tier === TransformationTier.CORPORATE_MEMBER || tier === TransformationTier.CORPORATE_LEADER
}

function canCreateVillage(profile: UserProfile | null | undefined) {
  const hasVillageContext =
    !!profile?.villageId ||
    !!profile?.corporateVillageId ||
    !!profile?.companyId ||
    !!profile?.companyCode ||
    !!profile?.organizationId
  if (hasVillageContext) return false
  if (profile?.membershipStatus === 'paid') return false
  if (isCorporateUser(profile)) return false
  return true
}

interface PaceInfo {
  label: string
  detail: string
  tone: 'green' | 'yellow' | 'red'
}

/**
 * Pace measures the learner against a per-day linear target.
 *
 *   timeProgress       = daysElapsed / (totalWeeks * 7)
 *   expectedPointsNow  = timeProgress * journey max points
 *   delta%             = earned / expectedPointsNow - 1
 *
 * For a 6-week / 60,000-point journey the per-week ramp is:
 *   end of week 1 -> 10,000   week 4 -> 40,000
 *   end of week 2 -> 20,000   week 5 -> 50,000
 *   end of week 3 -> 30,000   week 6 -> 60,000
 *
 * Days 0-1 fall back to a "Just starting" label so a brand-new learner is not
 * flagged as 100% below pace on their first morning.
 */
function computeJourneyPace(params: {
  totalEarned: number
  journeyMax: number
  daysElapsed: number
  totalWeeks: number
}): PaceInfo {
  const { totalEarned, journeyMax, daysElapsed, totalWeeks } = params
  const totalDays = totalWeeks * 7

  if (journeyMax <= 0 || totalDays <= 0) {
    return { label: 'Just starting', detail: 'Tracking begins once your journey starts', tone: 'yellow' }
  }

  if (daysElapsed < 1) {
    return { label: 'Just starting', detail: 'Pace tracking starts after day 1', tone: 'yellow' }
  }

  const timeProgress = Math.min(1, daysElapsed / totalDays)
  const expectedPointsNow = timeProgress * journeyMax
  const deltaPct = expectedPointsNow > 0 ? Math.round((totalEarned / expectedPointsNow - 1) * 100) : 0

  if (deltaPct >= 5) {
    return { label: 'Ahead of pace', detail: `${Math.abs(deltaPct)}% above expected`, tone: 'green' }
  }
  if (deltaPct <= -10) {
    return { label: 'Behind pace', detail: `${Math.abs(deltaPct)}% below expected`, tone: 'red' }
  }
  return { label: 'On track', detail: 'Pace matches your journey timeline', tone: 'green' }
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
  helper: string
  /** True once the learner has recorded their result for this test. */
  hasResult: boolean
  /** Dropdown listing every possible outcome of this test. */
  resultPicker: ReactNode
}

const ResultSelectSlot = ({ label, helper, hasResult, resultPicker }: ResultSelectSlotProps) => {
  const hasProof = hasResult
  return (
    <Box
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={hasProof ? 'green.300' : 'gray.300'}
      bg={hasProof ? 'green.50' : 'gray.50'}
      borderRadius="md"
      p={2}
    >
      <Stack spacing={1.5}>
        <HStack spacing={2} align="center">
          <Flex
            w={6}
            h={6}
            borderRadius="sm"
            bg={hasProof ? 'green.100' : 'white'}
            borderWidth="1px"
            borderColor={hasProof ? 'green.300' : 'gray.200'}
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Box
              as={hasProof ? CheckCircle2 : Upload}
              w={3}
              h={3}
              color={hasProof ? 'green.600' : 'gray.500'}
            />
          </Flex>
          <Stack spacing={0} flex={1} minW={0}>
            <Text fontSize="xs" fontWeight="semibold" color="gray.800" noOfLines={1}>
              {label}
            </Text>
            <Text fontSize="2xs" color="gray.500" noOfLines={1}>
              {hasProof ? 'Saved - change below' : helper}
            </Text>
          </Stack>
        </HStack>

        {resultPicker}
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
    [profile?.id, toast, updateProfile],
  )

  // Both personality assessments done -> the "Complete now" CTA becomes "Completed".
  const bothTestsCompleted = Boolean(
    profile?.hasCompletedPersonalityTest && profile?.hasCompletedValuesTest,
  )

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

  const journeyMax = JOURNEY_META[effectiveJourneyType]?.maxPossiblePoints ?? 0
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
        journeyMax,
        daysElapsed,
        totalWeeks,
      }),
    [totalEarned, journeyMax, daysElapsed, totalWeeks],
  )

  // Courses sit beside the video; keep the column out of the layout entirely
  // when the learner has no programme courses to show.
  const showAssignedCourses =
    (assignedLoading && hasCourseOrganization) || assignedCourses.length > 0

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
      requestOpenCourse(course.link)
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
                  if (course.link) requestOpenCourse(course.link)
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
                      Upload proof of each test below, then click "Complete now" to fill in your results.
                    </Text>
                  </Stack>
                </HStack>
                {bothTestsCompleted ? (
                  <Button
                    bg="green.500"
                    color="white"
                    _hover={{ bg: 'green.500' }}
                    _active={{ bg: 'green.500' }}
                    leftIcon={<Box as={CheckCircle2} w={4} h={4} />}
                    size="md"
                    flexShrink={0}
                    isDisabled
                    cursor="default"
                    opacity={1}
                    _disabled={{ bg: 'green.500', color: 'white', opacity: 1, cursor: 'default' }}
                  >
                    Completed
                  </Button>
                ) : (
                  <Menu placement="bottom-end">
                    <MenuButton
                      as={Button}
                      bg="brand.primary"
                      color="white"
                      _hover={{ bg: 'brand.dark' }}
                      _active={{ bg: 'brand.dark' }}
                      rightIcon={<Box as={ArrowUpRight} w={4} h={4} />}
                      size="md"
                      flexShrink={0}
                    >
                      Complete now
                    </MenuButton>
                    <MenuList>
                      <MenuItem
                        onClick={() =>
                          window.open(
                            'https://www.16personalities.com/free-personality-test',
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                      >
                        16Personalities test
                      </MenuItem>
                      <MenuItem
                        onClick={() =>
                          window.open('https://personalvalu.es/', '_blank', 'noopener,noreferrer')
                        }
                      >
                        Personal Values test
                      </MenuItem>
                    </MenuList>
                  </Menu>
                )}
              </Flex>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <ResultSelectSlot
                  label="16Personalities result"
                  helper="Select the type you got"
                  hasResult={Boolean(profile?.personalityType)}
                  resultPicker={
                    <TestResultPicker
                      mode="single"
                      options={personalityOptions}
                      selected={profile?.personalityType ? [profile.personalityType] : []}
                      onChange={(next) => void handleResultSelect('personality', next)}
                      placeholder="Select your type"
                      isSaving={savingResult === 'personality'}
                    />
                  }
                />
                <ResultSelectSlot
                  label="Personal Values result"
                  helper="Select the 5 values you got"
                  hasResult={(profile?.coreValues?.length ?? 0) === 5}
                  resultPicker={
                    <TestResultPicker
                      mode="multi"
                      maxSelections={5}
                      options={valuesOptions}
                      selected={profile?.coreValues ?? []}
                      onChange={(next) => void handleResultSelect('values', next)}
                      placeholder="Select your values"
                      isSaving={savingResult === 'values'}
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
            <Skeleton isLoaded={!data.loading.points} rounded="md">
              <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                {journeyProgress}% of pass mark
              </Text>
            </Skeleton>
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
          <Skeleton isLoaded={!data.loading.points} rounded="xl">
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

        {/* Rules of Engagement player on the left, assigned courses stacked
            beside it on the right (first course on top). */}
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          align="flex-start"
          gap={{ base: 6, lg: 6 }}
        >
          <Box flex={{ base: '1 1 auto', lg: '1 1 0' }} minW={0} w="full">
            <RulesOfEngagementVideo showCopy={false} />
          </Box>

          {showAssignedCourses && (
            <Stack
              flex={{ base: '1 1 auto', lg: '0 0 360px' }}
              maxW={{ lg: '360px' }}
              minW={0}
              w="full"
              spacing={4}
            >
              {assignedLoading && !assignedCourses.length ? (
                <Stack spacing={4}>
                  <Skeleton h="170px" rounded="xl" />
                  <Skeleton h="170px" rounded="xl" />
                </Stack>
              ) : (
                <Stack spacing={4}>
                  {assignedCourses.map((course) => (
                    <AssignedCourseCard
                      key={`${course.periodLabel}-${course.id}`}
                      periodLabel={course.periodLabel}
                      periodNoun={course.periodNoun}
                      hasAssignment
                      course={course}
                      availability={course.availability}
                      dateRange={course.dateRange}
                      unlockDate={course.unlockDate}
                      points={course.points}
                      completion={resolveCourseCompletion(completionsByKey, course)}
                      hasAccess={canAccessCourse(profile, course.title, course.id)}
                      showProgress={false}
                      showAction={false}
                      density="compact"
                      onCardClick={() => handleCourseCardClick(course)}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </Flex>

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
