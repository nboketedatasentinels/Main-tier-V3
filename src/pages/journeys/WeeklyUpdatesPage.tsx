import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Center,
  CircularProgress,
  Flex,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  IconProps,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Tag,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { UserRole, UserProfile } from '@/types'

interface ActivityTemplate {
  id: string
  baseId: string
  title: string
  description: string
  points: number
  requiresApproval?: boolean
  isFreeTier?: boolean
  week: number
  category: string
  tags?: string[]
  frequency?: string
  monthlyMax?: number
}

type ActivityStatus = 'not_started' | 'pending' | 'completed'

interface ActivityState extends ActivityTemplate {
  status: ActivityStatus
  proofUrl?: string
  notes?: string
}

interface JourneyConfig {
  journeyType: string
  currentWeek: number
  programDuration?: number
  isPaid?: boolean
}

interface ProofModalState {
  isOpen: boolean
  activity?: ActivityState
}

interface ChecklistResponses {
  [activityId: string]: {
    proofUrl?: string
    notes?: string
  }
}

interface WeeklyChecklistRecord {
  completed_activities?: string[]
  pending_activities?: string[]
  responses?: ChecklistResponses
}

const rhythmItems = [
  'Sync T4L Calendar to Google/Outlook',
  'Add weekly time block for watching videos',
  'Add weekly time block for completing missions',
  'Add weekly time block for point tracking',
  'Accept first live session invite',
]

const weeklyGuidance: Record<number, string[]> = {
  1: [
    'Introduce yourself with forum posts, comments, and likes',
    'Share a progress update publicly',
    'Submit your weekly Impact Log',
  ],
  2: [
    'Complete your core leadership modules',
    'Engage with your peer pod twice this week',
    'Log a LinkedIn engagement and reflection',
  ],
  3: [
    'Schedule a mentor check-in',
    'Attend at least one live webinar',
    'Publish a community post summarizing learnings',
  ],
  4: ['Finalize your Impact Log story', 'Close the loop on peer-to-peer actions', 'Submit proof for high-value missions'],
  5: ['Host or lead a meetup', 'Share a public celebration post', 'Review your streaks and keep them alive'],
  6: ['Record your transformation recap', 'Request endorsements from peers', 'Lock in final points to hit 100%'],
}

const fullJourneyActivities: ActivityTemplate[] = [
  {
    id: 'watch-podcast',
    baseId: 'watch_listen_podcast',
    title: 'Watch/listen to podcast',
    description: 'Engage with up to three podcast episodes each month.',
    points: 1000,
    week: 1,
    category: 'Learning',
    frequency: '3 / month',
    monthlyMax: 3000,
  },
  {
    id: 'podcast-workbook',
    baseId: 'podcast_workbook',
    title: 'Complete podcast workbook',
    description: 'Submit reflections for the podcast episodes you watched.',
    points: 1000,
    week: 1,
    category: 'Reflection',
    frequency: '3 / month',
    monthlyMax: 3000,
  },
  {
    id: 'webinar-attend',
    baseId: 'attend_webinar',
    title: 'Attend webinar',
    description: 'Join one live webinar to unlock discussion points.',
    points: 2000,
    week: 1,
    category: 'Live',
    frequency: '1 / month',
    monthlyMax: 2000,
  },
  {
    id: 'webinar-workbook',
    baseId: 'webinar_workbook',
    title: 'Complete webinar workbook',
    description: 'Turn webinar insights into action via the workbook.',
    points: 2000,
    week: 1,
    category: 'Reflection',
    frequency: '1 / month',
    monthlyMax: 2000,
  },
  {
    id: 'peer-matching',
    baseId: 'peer_matching',
    title: 'Peer Matching',
    description: 'Connect with peers up to four times per month.',
    points: 1000,
    week: 1,
    category: 'Networking',
    frequency: '4 / month',
    monthlyMax: 4000,
  },
  {
    id: 'impact-log-entry',
    baseId: 'impact_log_entry',
    title: 'Impact Log Entry',
    description: 'Capture up to two measurable impact updates monthly.',
    points: 1000,
    week: 1,
    category: 'Impact',
    frequency: '2 / month',
    monthlyMax: 2000,
  },
  {
    id: 'book-club',
    baseId: 'book_club',
    title: 'Book Club Participation',
    description: 'Join the monthly book club discussion.',
    points: 1500,
    week: 1,
    category: 'Community',
    frequency: '1 / month',
    monthlyMax: 1500,
  },
  {
    id: 'peer-to-peer-monthly',
    baseId: 'monthly_peer_to_peer',
    title: 'Monthly Peer to Peer',
    description: 'Complete one peer-to-peer accountability session.',
    points: 2500,
    week: 1,
    category: 'Accountability',
    frequency: '1 / month',
    monthlyMax: 2500,
    requiresApproval: true,
  },
  {
    id: 'linkedin-engagement',
    baseId: 'linkedin_engagement',
    title: 'LinkedIn engagement (post/comment)',
    description: 'Post or comment to grow your public leadership signal.',
    points: 500,
    week: 1,
    category: 'Brand',
    frequency: '2 / month',
    monthlyMax: 1000,
  },
  {
    id: 'lift-course-module',
    baseId: 'lift_course_module',
    title: 'LIFT Course Module Completed',
    description: 'Complete one LIFT course module per month.',
    points: 3000,
    week: 1,
    category: 'Learning',
    frequency: '1 / month',
    monthlyMax: 3000,
    requiresApproval: true,
  },
]

const introJourneyActivities = [
  'watch-podcast',
  'podcast-workbook',
  'webinar-attend',
  'webinar-workbook',
  'impact-log-entry',
  'lift-course-module',
]

const journeyTargets = [
  { journey: '4-Week Intro', weeks: 4, weeklyTarget: 2500, target: 10000, maxPossible: 15000 },
  { journey: '6-Week Power', weeks: 6, weeklyTarget: 4000, target: 24000, maxPossible: 36000 },
  { journey: '3-Month', weeks: 12, weeklyTarget: 4000, target: 48000, maxPossible: 72000 },
  { journey: '6-Month', weeks: 24, weeklyTarget: 4000, target: 96000, maxPossible: 144000 },
  { journey: '9-Month', weeks: 36, weeklyTarget: 4000, target: 144000, maxPossible: 216000 },
  { journey: '12-Month', weeks: 48, weeklyTarget: 4000, target: 192000, maxPossible: 288000 },
]

const statusLegend = [
  { label: 'On Track', rule: '≥ 100% of weekly target', color: 'green' },
  { label: 'Warning', rule: '75-99% of weekly target', color: 'yellow' },
  { label: 'Alert', rule: '< 75% of weekly target', color: 'red' },
]

const getDefaultTemplatesForWeek = (week: number, journeyType: string) => {
  const isIntroJourney = journeyType === 'fourWeekIntro'
  const templateSource = isIntroJourney
    ? fullJourneyActivities.filter(activity => introJourneyActivities.includes(activity.id))
    : fullJourneyActivities

  return templateSource.map(template => ({ ...template, week }))
}

const getWeekKey = (week: number) => `week${week}`

const getIsoWeekNumber = (date: Date) => {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const useRhythmState = () => {
  const today = new Date()
  const calendarWeek = getIsoWeekNumber(today)
  const storageKey = `rhythm-${today.getFullYear()}-W${calendarWeek}`
  const [completed, setCompleted] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      setCompleted(JSON.parse(stored))
    }
  }, [storageKey])

  const toggleItem = (item: string) => {
    setCompleted(prev => {
      const next = { ...prev, [item]: !prev[item] }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  const totalPoints = useMemo(() => Object.values(completed).filter(Boolean).length * 50, [completed])

  return { completed, toggleItem, totalPoints, calendarWeek }
}

const statusLabelMap: Record<ActivityStatus, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  completed: 'Completed',
}

const AddIcon = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
)

const CheckCircleIcon = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
)

const ChevronLeftIcon = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
)

const ChevronRightIcon = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
)

const LockIcon = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <rect x="5" y="10" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M9 10V7a3 3 0 1 1 6 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Icon>
)

const WarningIcon = (props: IconProps) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      d="M12 4 3 19h18L12 4Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1" fill="currentColor" />
  </Icon>
)

const WeeklyChecklistPage: React.FC = () => {
  const { user, profile } = useAuth()
  const [journey, setJourney] = useState<JourneyConfig | null>(null)
  const [activities, setActivities] = useState<ActivityState[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [progressLoading, setProgressLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [proofModal, setProofModal] = useState<ProofModalState>({ isOpen: false })
  const [pendingCounts, setPendingCounts] = useState<{ completed: number; total: number; points: number }>({
    completed: 0,
    total: 0,
    points: 0,
  })

  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { completed: rhythmCompleted, toggleItem, totalPoints: rhythmPoints, calendarWeek } = useRhythmState()

  const normalizedJourneyType = useMemo(() => {
    const rawType = journey?.journeyType?.toLowerCase() || ''
    if (['sixweeksprint', 'six_week_sprint', 'sprint', 'sixweeks'].includes(rawType)) return 'sixWeekSprint'
    if (['fourweekintro', '4_week_intro', 'intro_4_week', 'fourweek'].includes(rawType)) return 'fourWeekIntro'
    return rawType
  }, [journey?.journeyType])

  const isShortJourney = normalizedJourneyType === 'sixWeekSprint' || normalizedJourneyType === 'fourWeekIntro'
  const totalWeeks = normalizedJourneyType === 'fourWeekIntro' ? 4 : normalizedJourneyType === 'sixWeekSprint' ? 6 : 12

  const weeklyTarget = useMemo(() => {
    if (normalizedJourneyType === 'fourWeekIntro') return 2500
    return 4000
  }, [normalizedJourneyType])

  const fetchJourney = useCallback(async () => {
    if (!user) return
    try {
      const profileRef = doc(db, 'profiles', user.uid)
      const profileSnap = await getDoc(profileRef)
      if (profileSnap.exists()) {
        const data = profileSnap.data() as Partial<JourneyConfig> & { journey_type?: string; current_week?: number; program_duration?: number; isPaid?: boolean }
        const profileWithPayment = profile as (UserProfile & { isPaid?: boolean }) | null
        const journeyConfig: JourneyConfig = {
          journeyType: data.journeyType || data.journey_type || 'sixWeekSprint',
          currentWeek: data.currentWeek || data.current_week || 1,
          programDuration: data.programDuration || data.program_duration || totalWeeks,
          isPaid: profileWithPayment?.isPaid ?? data.isPaid ?? profile?.role !== UserRole.FREE_USER,
        }
        setJourney(journeyConfig)
        setSelectedWeek(journeyConfig.currentWeek || 1)
      }
    } catch (err) {
      console.error(err)
      setError('Unable to load your journey settings from Firebase.')
    }
  }, [profile, totalWeeks, user])

  const buildActivitiesFromTemplates = (
    templates: ActivityTemplate[],
    checklist: WeeklyChecklistRecord,
  ) => {
    return templates.map(template => {
      let status: ActivityStatus = 'not_started'
      if (checklist.completed_activities?.includes(template.id)) status = 'completed'
      if (checklist.pending_activities?.includes(template.id)) status = 'pending'

      const response = checklist.responses?.[template.id]
      return {
        ...template,
        status,
        proofUrl: response?.proofUrl,
        notes: response?.notes,
      }
    })
  }

  const fetchWeeklyData = useCallback(async () => {
    if (!journey || !user) return
    setActivityLoading(true)
    setError('')
    try {
      const templateQuery = query(
        collection(db, 'weekly_activity_templates'),
        where('week', '==', selectedWeek),
      )
      const templateSnapshot = await getDocs(templateQuery)
      const templates: ActivityTemplate[] = templateSnapshot.empty
        ? getDefaultTemplatesForWeek(selectedWeek, normalizedJourneyType)
        : templateSnapshot.docs.map(docSnap => {
            const data = docSnap.data() as ActivityTemplate
            return { ...data, id: docSnap.id }
          })

      const checklistRef = doc(collection(db, 'weekly_checklist'), `${user.uid}-${getWeekKey(selectedWeek)}`)
      const checklistSnap = await getDoc(checklistRef)
      const checklistData: WeeklyChecklistRecord = checklistSnap.exists()
        ? (checklistSnap.data() as WeeklyChecklistRecord)
        : { completed_activities: [], pending_activities: [], responses: {} }

      const filtered = templates.filter(template => (journey.isPaid ? true : template.isFreeTier ?? true))
      setActivities(buildActivitiesFromTemplates(filtered, checklistData))
    } catch (err) {
      console.error(err)
      setError('We could not load weekly activities from Firebase. Try refreshing.')
      setActivities(
        getDefaultTemplatesForWeek(selectedWeek, normalizedJourneyType).map(template => ({ ...template, status: 'not_started' })),
      )
    } finally {
      setActivityLoading(false)
    }
  }, [journey, normalizedJourneyType, selectedWeek, user])

  const calculateProgress = useCallback(() => {
    const completedActivities = activities.filter(a => a.status === 'completed')
    const pendingActivities = activities.filter(a => a.status === 'pending')
    const earnedPoints = completedActivities.reduce((sum, activity) => sum + activity.points, 0) + rhythmPoints
    setPendingCounts({ completed: completedActivities.length, total: activities.length, points: earnedPoints })
    return { completedActivities, pendingActivities, earnedPoints }
  }, [activities, rhythmPoints])

  useEffect(() => {
    fetchJourney()
  }, [fetchJourney])

  useEffect(() => {
    fetchWeeklyData()
  }, [fetchWeeklyData])

  useEffect(() => {
    setProgressLoading(true)
    calculateProgress()
    setProgressLoading(false)
  }, [activities, calculateProgress])

  const persistChecklist = async (updatedActivities: ActivityState[]) => {
    if (!user) return
    const weekKey = getWeekKey(selectedWeek)
    const completed = updatedActivities.filter(a => a.status === 'completed').map(a => a.id)
    const pending = updatedActivities.filter(a => a.status === 'pending').map(a => a.id)
    const responses = updatedActivities.reduce<Record<string, { proofUrl?: string; notes?: string }>>((acc, activity) => {
      if (activity.proofUrl || activity.notes) acc[activity.id] = { proofUrl: activity.proofUrl, notes: activity.notes }
      return acc
    }, {})

    const payload = {
      user_id: user.uid,
      week_key: weekKey,
      week: selectedWeek,
      completed_activities: completed,
      pending_activities: pending,
      responses,
      updated_at: serverTimestamp(),
    }

    await setDoc(doc(collection(db, 'weekly_checklist'), `${user.uid}-${weekKey}`), payload, { merge: true })
  }

  const handleActivityUpdate = async (activityId: string, nextStatus: ActivityStatus) => {
    setActivities(prev => {
      const updated = prev.map(activity =>
        activity.id === activityId ? { ...activity, status: nextStatus, proofUrl: nextStatus === 'not_started' ? undefined : activity.proofUrl, notes: activity.notes } : activity,
      )
      persistChecklist(updated)
      return updated
    })
    calculateProgress()
  }

  const openProofModal = (activity: ActivityState) => {
    setProofModal({ isOpen: true, activity })
    onOpen()
  }

  const submitProof = async () => {
    if (!proofModal.activity || !user) return
    try {
      await addDoc(collection(db, 'points_verification_requests'), {
        user_id: user.uid,
        week: selectedWeek,
        activity_id: proofModal.activity.id,
        activity_title: proofModal.activity.title,
        points: proofModal.activity.points,
        proof_url: proofModal.activity.proofUrl,
        notes: proofModal.activity.notes,
        status: 'pending',
        created_at: serverTimestamp(),
      })

      await persistChecklist(
        activities.map(activity =>
          activity.id === proofModal.activity?.id
            ? { ...activity, status: 'pending' as ActivityStatus }
            : activity,
        ),
      )

      setActivities(prev =>
        prev.map(activity =>
          activity.id === proofModal.activity?.id
            ? { ...activity, status: 'pending', proofUrl: proofModal.activity?.proofUrl, notes: proofModal.activity?.notes }
            : activity,
        ),
      )
      calculateProgress()
      toast({
        title: 'Proof submitted',
        description: 'Your proof has been sent for verification. Points will be awarded once approved.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Submission failed',
        description: 'We could not submit your proof to Firebase. Please retry.',
        status: 'error',
      })
    } finally {
      setProofModal({ isOpen: false })
      onClose()
    }
  }

  const handleProofInput = (field: 'proofUrl' | 'notes', value: string) => {
    setProofModal(prev => ({
      ...prev,
      activity: prev.activity ? { ...prev.activity, [field]: value } : undefined,
    }))
  }

  const isWeekLocked = useMemo(() => {
    if (!journey) return false
    if (!isShortJourney) return selectedWeek < (journey.currentWeek || 1)
    return selectedWeek < (journey.currentWeek || 1)
  }, [isShortJourney, journey, selectedWeek])

  const progressStatus = useMemo(() => {
    const pct = Math.min(100, Math.round((pendingCounts.points / weeklyTarget) * 100))
    if (pct >= 100) return { color: 'green', label: 'On Track', pct }
    if (pct >= 75) return { color: 'yellow', label: 'Warning', pct }
    return { color: 'red', label: 'Alert', pct }
  }, [pendingCounts.points, weeklyTarget])

  const activityReference = useMemo(
    () =>
      normalizedJourneyType === 'fourWeekIntro'
        ? fullJourneyActivities.filter(activity => introJourneyActivities.includes(activity.id))
        : fullJourneyActivities,
    [normalizedJourneyType],
  )

  const activeJourneyTarget = useMemo(() => {
    if (normalizedJourneyType === 'fourWeekIntro') return journeyTargets[0]
    return journeyTargets.find(target => target.weeks === (journey?.programDuration || totalWeeks)) || journeyTargets[1]
  }, [journey?.programDuration, normalizedJourneyType, totalWeeks])

  const firstIncompleteActivity = useMemo(() => activities.find(activity => activity.status !== 'completed'), [activities])

  const scrollToActivity = () => {
    if (firstIncompleteActivity?.id && activityRefs.current[firstIncompleteActivity.id]) {
      activityRefs.current[firstIncompleteActivity.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      activityRefs.current[firstIncompleteActivity.id]?.classList.add('focus-ring')
      setTimeout(() => activityRefs.current[firstIncompleteActivity.id]?.classList.remove('focus-ring'), 2000)
    }
  }

  const renderWeekSelector = () => {
    if (!isShortJourney) {
      const months = journey?.programDuration || 3
      const monthIndex = Math.ceil(selectedWeek / 4)
      const weeksInMonth = [1, 2, 3, 4].map(offset => (monthIndex - 1) * 4 + offset)
      const isMonthLocked = selectedWeek < (journey?.currentWeek || 1)

      return (
        <Stack spacing={3} bg="gray.900" p={4} borderRadius="lg">
          <Flex align="center" justify="space-between">
            <Button
              size="sm"
              leftIcon={<ChevronLeftIcon />}
              isDisabled={monthIndex <= 1}
              onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 4))}
            >
              Previous Month
            </Button>
            <Stack spacing={0} textAlign="center">
              <Text color="brand.gold" fontWeight="bold">
                Month {monthIndex} of {months}
              </Text>
              <Text color="gray.300" fontSize="sm">
                Unlock the next month by completing all activities.
              </Text>
            </Stack>
            <Button
              size="sm"
              rightIcon={<ChevronRightIcon />}
              isDisabled={monthIndex >= months}
              onClick={() => setSelectedWeek(Math.min(totalWeeks, selectedWeek + 4))}
            >
              Next Month
            </Button>
          </Flex>
          <HStack spacing={2} justify="center" wrap="wrap">
            {weeksInMonth.map(weekNumber => (
              <Tooltip key={weekNumber} label={weekNumber > (journey?.currentWeek || 1) ? 'Locked until you finish this month' : 'Open week'}>
                <Button
                  variant={selectedWeek === weekNumber ? 'solid' : 'outline'}
                  colorScheme={selectedWeek === weekNumber ? 'teal' : 'gray'}
                  size="sm"
                  leftIcon={weekNumber < (journey?.currentWeek || 1) ? <CheckCircleIcon /> : undefined}
                  rightIcon={weekNumber > (journey?.currentWeek || 1) ? <LockIcon /> : undefined}
                  isDisabled={weekNumber > (journey?.currentWeek || 1) + 3}
                  onClick={() => setSelectedWeek(weekNumber)}
                >
                  Week {weekNumber}
                </Button>
              </Tooltip>
            ))}
          </HStack>
          {isMonthLocked && (
            <Alert status="warning" variant="left-accent" borderRadius="md">
              <AlertIcon />
              <AlertTitle>Previous month locked</AlertTitle>
              <AlertDescription color="gray.200">
                Great job advancing! You can review past weeks but cannot change submissions.
              </AlertDescription>
            </Alert>
          )}
        </Stack>
      )
    }

    const weeks = Array.from({ length: totalWeeks }, (_, idx) => idx + 1)
    return (
      <HStack spacing={2} wrap="wrap">
        {weeks.map(week => {
          const isLocked = week > (journey?.currentWeek || 1)
          const isCompleted = week < (journey?.currentWeek || 1)
          return (
            <Tooltip
              key={week}
              label={isLocked ? 'Locked until you reach this week' : isCompleted ? 'Completed week' : 'Current week'}
            >
              <Button
                size="sm"
                variant={selectedWeek === week ? 'solid' : 'outline'}
                colorScheme={selectedWeek === week ? 'teal' : 'gray'}
                leftIcon={isCompleted ? <CheckCircleIcon /> : undefined}
                rightIcon={isLocked ? <LockIcon /> : undefined}
                onClick={() => setSelectedWeek(week)}
                isDisabled={isLocked}
              >
                Week {week}
              </Button>
            </Tooltip>
          )
        })}
      </HStack>
    )
  }

  const renderActivityCard = (activity: ActivityState) => {
    const disabled = isWeekLocked
    const requiresProof = journey?.isPaid && activity.requiresApproval
    const yesDisabled = disabled || activity.status === 'completed'
    const noDisabled = disabled || activity.status === 'not_started'

    const showProofBadge = requiresProof
    const showFreeBadge = activity.isFreeTier && !journey?.isPaid

    return (
      <Box
        key={activity.id}
        ref={ref => (activityRefs.current[activity.id] = ref)}
        borderWidth="1px"
        borderColor="gray.700"
        p={4}
        borderRadius="lg"
        bg="gray.900"
        className="activity-card"
      >
        <Flex justify="space-between" align="flex-start" mb={2}>
          <Stack spacing={1}>
            <HStack spacing={2}>
              <Badge colorScheme={activity.status === 'completed' ? 'green' : activity.status === 'pending' ? 'yellow' : 'gray'}>
                {statusLabelMap[activity.status]}
              </Badge>
              {showProofBadge && (
                <Tooltip label="Proof required for paid tier activities">
                  <Badge colorScheme="purple">Requires proof</Badge>
                </Tooltip>
              )}
              {showFreeBadge && <Badge colorScheme="blue">Free tier</Badge>}
              <Tag colorScheme="cyan">{activity.category}</Tag>
            </HStack>
            <Heading size="sm" color="white">
              {activity.title}
            </Heading>
            <Text color="gray.300" fontSize="sm">
              {activity.description}
            </Text>
          </Stack>
          <Stack align="flex-end" spacing={2}>
            <Tag colorScheme="orange" fontWeight="bold">
              +{activity.points} pts
            </Tag>
            {activity.status === 'pending' && (
              <Tooltip label="Pending verification. Points will post after approval.">
                <WarningIcon color="yellow.300" />
              </Tooltip>
            )}
          </Stack>
        </Flex>
        <HStack spacing={3}>
          <Button
            colorScheme="teal"
            variant={activity.status === 'completed' || activity.status === 'pending' ? 'solid' : 'outline'}
            isDisabled={yesDisabled}
            onClick={() => (requiresProof ? openProofModal(activity) : handleActivityUpdate(activity.id, 'completed'))}
          >
            Yes
          </Button>
          <Button
            variant="outline"
            colorScheme="gray"
            isDisabled={noDisabled}
            onClick={() => handleActivityUpdate(activity.id, 'not_started')}
          >
            No
          </Button>
        </HStack>
      </Box>
    )
  }

  const renderParticipationRhythm = () => (
    <Box borderWidth="1px" borderColor="gray.700" p={4} borderRadius="lg" bg="gray.900">
      <HStack justify="space-between" mb={2}>
        <Heading size="sm" color="brand.gold">
          Participation Rhythm
        </Heading>
        <Tag colorScheme="teal">+{rhythmPoints} pts</Tag>
      </HStack>
      <Stack spacing={2}>
        {rhythmItems.map(item => (
          <Flex key={item} align="center" justify="space-between" p={2} borderRadius="md" bg="gray.800">
            <Text color="gray.200">{item}</Text>
            <Button
              size="sm"
              leftIcon={rhythmCompleted[item] ? <CheckCircleIcon /> : <AddIcon />}
              colorScheme={rhythmCompleted[item] ? 'teal' : 'gray'}
              variant={rhythmCompleted[item] ? 'solid' : 'outline'}
              onClick={() => toggleItem(item)}
            >
              {rhythmCompleted[item] ? 'Completed' : 'Mark done'}
            </Button>
          </Flex>
        ))}
      </Stack>
      <Text color="gray.300" fontSize="sm" mt={2}>
        Saved locally for calendar week {calendarWeek}. Perfect for building your weekly habits.
      </Text>
    </Box>
  )

  const renderPointsReference = () => (
    <Box borderWidth="1px" borderColor="gray.700" p={4} borderRadius="lg" bg="gray.900">
      <Heading size="sm" color="brand.gold" mb={2}>
        Points system reference
      </Heading>
      <Text color="gray.300" fontSize="sm" mb={3}>
        Calibrated to the latest journey-based points model (weekly targets, monthly caps, and approval rules).
      </Text>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} mb={4}>
        <StatCard
          label="Weekly target"
          value={`${weeklyTarget.toLocaleString()} pts`}
          icon={<InfoPill color="teal" />}
        />
        <StatCard
          label="Journey target (67%)"
          value={activeJourneyTarget ? `${activeJourneyTarget.target.toLocaleString()} pts` : 'See table'}
          icon={<InfoPill color="orange" />}
        />
        <StatCard
          label="Max possible"
          value={activeJourneyTarget ? `${activeJourneyTarget.maxPossible.toLocaleString()} pts` : 'See table'}
          icon={<InfoPill color="purple" />}
        />
      </SimpleGrid>
      <Stack spacing={2} mb={3}>
        <Text color="gray.200" fontWeight="bold">
          Weekly status automation
        </Text>
        {statusLegend.map(status => (
          <HStack key={status.label} spacing={2} align="center" color={`${status.color}.200`}>
            <InfoPill color={status.color} />
            <Text>{status.label}</Text>
            <Tag size="sm" colorScheme={status.color} variant="subtle">
              {status.rule}
            </Tag>
          </HStack>
        ))}
      </Stack>
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th color="gray.400">Activity</Th>
            <Th color="gray.400">Frequency</Th>
            <Th color="gray.400">Points</Th>
            <Th color="gray.400">Monthly max</Th>
          </Tr>
        </Thead>
        <Tbody>
          {activityReference.map(activity => (
            <Tr key={activity.id}>
              <Td color="gray.200">{activity.title}</Td>
              <Td color="gray.300">{activity.frequency || '—'}</Td>
              <Td color="gray.200">{activity.points.toLocaleString()}</Td>
              <Td color="gray.300">{activity.monthlyMax ? activity.monthlyMax.toLocaleString() : '—'}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      {normalizedJourneyType === 'fourWeekIntro' && (
        <Text color="gray.400" fontSize="sm" mt={3}>
          4-week intro journeys have limited activities and a 2,500 pts/week goal. Peer Matching, Book Club, Peer to Peer, and
          LinkedIn engagement unlock after graduation.
        </Text>
      )}
    </Box>
  )

  const renderGuidanceCard = () => {
    if (normalizedJourneyType !== 'sixWeekSprint') return null
    const bullets = weeklyGuidance[selectedWeek]
    if (!bullets?.length) return null

    return (
      <Box borderWidth="1px" borderColor="purple.500" p={4} borderRadius="lg" bg="purple.900/50">
        <Heading size="sm" color="purple.100" mb={2}>
          Week {selectedWeek} – Focus Guidance
        </Heading>
        <Stack spacing={2} color="purple.50">
          {bullets.map(item => (
            <HStack key={item} spacing={2} align="flex-start">
              <CheckCircleIcon color="purple.200" />
              <Text>{item}</Text>
            </HStack>
          ))}
        </Stack>
      </Box>
    )
  }

  const renderGamificationPanel = () => (
    <Box borderWidth="1px" borderColor="gray.700" p={4} borderRadius="lg" bg="gray.900">
      <Heading size="sm" color="brand.gold" mb={3}>
        Workflow Gamification
      </Heading>
      <Stack spacing={3}>
        <Alert status="info" variant="subtle" borderRadius="md">
          <AlertIcon />
          <Stack spacing={1}>
            <Text color="gray.200">Focus on your next incomplete activity.</Text>
            <Text color="gray.300" fontSize="sm">
              Keep your streak alive by acting in the next 24 hours.
            </Text>
          </Stack>
        </Alert>
        <Button colorScheme="teal" onClick={scrollToActivity} isDisabled={!firstIncompleteActivity}>
          {firstIncompleteActivity ? `Complete ${firstIncompleteActivity.title}` : 'All activities done'}
        </Button>
        <Stack spacing={1} color="gray.300">
          <Text fontWeight="bold">Streak tracker</Text>
          <Progress value={Math.min(100, progressStatus.pct)} colorScheme={progressStatus.color} borderRadius="full" />
          <Text fontSize="sm">Maintain daily check-ins to grow your streak.</Text>
        </Stack>
      </Stack>
    </Box>
  )

  const renderProofModal = () => (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Upload proof</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={2} color="gray.600">
            Provide a link or short notes so admins can approve your points.
          </Text>
          <Stack spacing={3}>
            <Textarea
              placeholder="Paste a link to your screenshot or deliverable"
              value={proofModal.activity?.proofUrl || ''}
              onChange={e => handleProofInput('proofUrl', e.target.value)}
            />
            <Textarea
              placeholder="Add context or notes"
              value={proofModal.activity?.notes || ''}
              onChange={e => handleProofInput('notes', e.target.value)}
            />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="teal" onClick={submitProof} leftIcon={<AddIcon />}
            isDisabled={!proofModal.activity?.proofUrl}
          >
            Submit for verification
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )

  const renderWeekSummary = () => (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Heading size="lg" color="white">
          Weekly Checklist
        </Heading>
        <Text color="gray.300">A comprehensive weekly activity tracker with Firebase-powered progress.</Text>
      </Stack>
      <Box p={4} borderWidth="1px" borderColor="gray.700" bg="gray.900" borderRadius="lg">
        <Stack spacing={3}>
          <HStack justify="space-between">
            <Heading size="sm" color="brand.gold">
              Week {selectedWeek} summary
            </Heading>
            <Tag colorScheme={progressStatus.color}>
              {progressStatus.label} • {progressStatus.pct}%
            </Tag>
          </HStack>
          <Progress value={progressStatus.pct} colorScheme={progressStatus.color} borderRadius="full" />
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <StatCard
              label="Activities completed"
              value={`${pendingCounts.completed} of ${pendingCounts.total}`}
              icon={<CheckCircleIcon color="green.300" />}
            />
            <StatCard
              label="Weekly points"
              value={`${pendingCounts.points} / ${weeklyTarget}`}
              icon={<AddIcon color="orange.300" />}
            />
            <StatCard
              label="Status"
              value={progressStatus.label}
              icon={<InfoPill color={progressStatus.color} />}
            />
          </SimpleGrid>
        </Stack>
      </Box>
    </Stack>
  )

  if (!profile && !user) {
    return (
      <Center py={16}>
        <Stack spacing={3} align="center">
          <CircularProgress isIndeterminate color="brand.gold" />
          <Text color="gray.400">Loading weekly activities...</Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Stack spacing={6}>
      {renderWeekSummary()}
      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Box borderWidth="1px" borderColor="gray.700" p={4} borderRadius="lg" bg="gray.900">
        <Stack spacing={4}>
          <Flex align="center" justify="space-between">
            <Heading size="sm" color="gray.100">
              Week navigation
            </Heading>
            {isWeekLocked && (
              <Tag colorScheme="red" borderRadius="full" size="sm">
                <LockIcon mr={1} /> Locked for review
              </Tag>
            )}
          </Flex>
          {renderWeekSelector()}
        </Stack>
      </Box>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6} alignItems="start">
        <GridItem>
          <Stack spacing={4}>
            <Box borderWidth="1px" borderColor="gray.700" p={4} borderRadius="lg" bg="gray.900">
              <Heading size="sm" color="brand.gold" mb={3}>
                Weekly activities
              </Heading>
              {activityLoading ? (
                <Stack spacing={3}>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Skeleton key={idx} height="120px" />
                  ))}
                </Stack>
              ) : (
                <Stack spacing={3}>
                  {activities.length ? activities.map(renderActivityCard) : (
                    <Center py={8}>
                      <Stack spacing={2} align="center">
                        <Text color="gray.400">No activities found for this week.</Text>
                        <Text color="gray.500" fontSize="sm">
                          Templates will automatically sync from Firebase when available.
                        </Text>
                      </Stack>
                    </Center>
                  )}
                </Stack>
              )}
            </Box>
            {renderGuidanceCard()}
            {renderParticipationRhythm()}
          </Stack>
        </GridItem>

        <GridItem>
          <Stack spacing={4}>
            <Box borderWidth="1px" borderColor="gray.700" p={4} borderRadius="lg" bg="gray.900">
              <Heading size="sm" color="brand.gold" mb={3}>
                Weekly progress
              </Heading>
              {progressLoading ? (
                <Skeleton height="180px" />
              ) : (
                <Stack spacing={3}>
                  <Progress value={progressStatus.pct} colorScheme={progressStatus.color} borderRadius="full" />
                  <Text color="gray.200" fontWeight="bold">
                    {pendingCounts.points} / {weeklyTarget} points earned
                  </Text>
                  <Text color="gray.400" fontSize="sm">
                    {progressStatus.pct >= 100
                      ? 'Amazing! You are ahead of your target.'
                      : progressStatus.pct >= 75
                        ? 'You are close. Aim to close remaining activities.'
                        : 'Alert: earn points now to avoid falling behind.'}
                  </Text>
                </Stack>
              )}
            </Box>
            {renderGamificationPanel()}
            {renderPointsReference()}
          </Stack>
        </GridItem>
      </Grid>

      {renderProofModal()}
    </Stack>
  )
}

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <Box borderWidth="1px" borderColor="gray.700" p={4} borderRadius="lg" bg="gray.900">
    <HStack justify="space-between" mb={1}>
      <Text color="gray.400" fontSize="sm">
        {label}
      </Text>
      {icon}
    </HStack>
    <Heading size="md" color="white">
      {value}
    </Heading>
  </Box>
)

const InfoPill: React.FC<{ color: string }> = ({ color }) => (
  <Box w={3} h={3} borderRadius="full" bg={`${color}.300`} />
)

export { WeeklyChecklistPage, WeeklyChecklistPage as WeeklyUpdatesPage }
