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
  IconButton,
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
  Spinner,
  Stack,
  Tag,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Lock, Plus, ShieldCheck } from 'lucide-react'
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where, onSnapshot, addDoc } from 'firebase/firestore'
import { addDays, format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { removeUndefinedFields } from '@/utils/firestore'
import { getIsoWeekNumber } from '@/utils/date'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { CALENDAR_SYNC_TUTORIAL, UserRole, WeeklyProgress } from '@/types'
import { JOURNEY_META, getMonthNumber, getActivitiesForJourney, type ActivityDef, type JourneyType } from '@/config/pointsConfig'
import { awardChecklistPoints, revokeChecklistPoints } from '@/services/pointsService'
import { SurfaceCard } from '@/components/primitives/SurfacePrimitives'
import { IoradTutorialModal } from '@/components/modals/IoradTutorialModal'
import { checkTutorialCompletion, markTutorialComplete } from '@/services/tutorialService'

const DEFAULT_WEEKLY_TARGET = JOURNEY_META['6W'].weeklyTarget

type ActivityStatus = 'not_started' | 'pending' | 'completed'

type ActivityState = ActivityDef & {
  status: ActivityStatus
  proofUrl?: string
  notes?: string
}

interface JourneyConfig {
  journeyType: JourneyType;
  currentWeek: number;
  programDurationWeeks: number;
  isPaid?: boolean;
}

interface ProofModalState {
  isOpen: boolean;
  activity?: ActivityState;
}

const rhythmItems = [
  'Sync T4L Calendar to Google/Outlook',
  'Add weekly time block for watching videos',
  'Add weekly time block for completing missions',
  'Add weekly time block for point tracking',
  'Accept first live session invite',
]

const CALENDAR_SYNC_ITEM = 'Sync T4L Calendar to Google/Outlook'

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

  const setItemCompletion = (item: string, value: boolean) => {
    setCompleted(prev => {
      const next = { ...prev, [item]: value }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  const totalPoints = useMemo(() => Object.values(completed).filter(Boolean).length * 50, [completed])

  return { completed, toggleItem, setItemCompletion, totalPoints, calendarWeek }
}

const statusLabelMap: Record<ActivityStatus, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  completed: 'Completed',
}

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
  const navigate = useNavigate()
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress | null>(null)
  const {
    completed: rhythmCompleted,
    toggleItem,
    setItemCompletion,
    totalPoints: rhythmPoints,
    calendarWeek,
  } = useRhythmState()
  const {
    isOpen: isTutorialModalOpen,
    onOpen: openTutorialModal,
    onClose: closeTutorialModal,
  } = useDisclosure()
  const [tutorialCompleted, setTutorialCompleted] = useState(false)
  const [tutorialLoading, setTutorialLoading] = useState(false)
  const [tutorialError, setTutorialError] = useState<string | null>(null)
  const [tutorialSaving, setTutorialSaving] = useState(false)
  const [tutorialSaveError, setTutorialSaveError] = useState<string | null>(null)

  const persistChecklist = async (updatedActivities: ActivityState[]) => {
    if (!user) return
    const checklistState = removeUndefinedFields({
      activities: updatedActivities.map(({ id, status, proofUrl, notes }) =>
        removeUndefinedFields({
          id,
          status,
          proofUrl,
          notes,
        }),
      ),
      updatedAt: serverTimestamp(),
    })
    try {
      await setDoc(doc(db, 'checklists', `${user.uid}_${selectedWeek}`), checklistState, { merge: true })
    } catch (error) {
      console.error('Failed to persist checklist state:', error)
      toast({
        title: 'Sync Error',
        description: 'Could not save your checklist progress to the server.',
        status: 'error',
      })
    }
  }

  const normalizedJourneyType = useMemo(() => {
    return journey?.journeyType || '4W';
  }, [journey?.journeyType]);

  const weeklyTarget = useMemo(() => {
    if (!journey) return DEFAULT_WEEKLY_TARGET;
    return JOURNEY_META[journey.journeyType].weeklyTarget;
  }, [journey]);

  const getImpactLogDateRange = useCallback(
    (weekNumber: number) => {
      let journeyStart: Date | null = profile?.journeyStartDate ? new Date(profile.journeyStartDate) : null

      if (!journeyStart && profile?.currentWeek) {
        const offsetWeeks = profile.currentWeek - 1
        journeyStart = addDays(new Date(), -(offsetWeeks * 7))
      }

      if (!journeyStart) return null

      const weekStart = addDays(journeyStart, (weekNumber - 1) * 7)
      const weekEnd = addDays(weekStart, 7)
      return {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
      }
    },
    [profile?.currentWeek, profile?.journeyStartDate],
  )

  const fetchJourney = useCallback(async () => {
    if (!user || !profile) return;
    try {
      // Free users are automatically assigned to the 4W journey.
      const journeyType = profile.role === UserRole.FREE_USER ? "4W" : profile.journeyType || "6W";
      const meta = JOURNEY_META[journeyType];

      const journeyConfig: JourneyConfig = {
        journeyType,
        currentWeek: profile.currentWeek || 1,
        programDurationWeeks: meta.weeks,
        isPaid: profile.role !== UserRole.FREE_USER,
      };

      setJourney(journeyConfig);
      setSelectedWeek(journeyConfig.currentWeek);
    } catch (err) {
      console.error(err);
      setError('Unable to load your journey settings.');
    }
  }, [user, profile]);

  const fetchWeeklyData = useCallback(async () => {
    if (!journey || !user) return;
    setActivityLoading(true);
    setError('');
    try {
      const activityDefs = getActivitiesForJourney(journey.journeyType);

      const ledgerQuery = query(
        collection(db, 'pointsLedger'),
        where('uid', '==', user.uid),
        where('weekNumber', '==', selectedWeek)
      );

      const ledgerSnapshot = await getDocs(ledgerQuery);
      const completedActivities = new Set(ledgerSnapshot.docs.map(d => d.data().activityId));

      const impactRange = getImpactLogDateRange(selectedWeek)
      const hasImpactLog = activityDefs.some(def => def.id === 'impact_log')

      if (impactRange && hasImpactLog) {
        const impactQuery = query(
          collection(db, 'impact_logs'),
          where('userId', '==', user.uid),
          where('date', '>=', impactRange.start),
          where('date', '<', impactRange.end),
        )
        const impactSnapshot = await getDocs(impactQuery)
        if (!impactSnapshot.empty) {
          completedActivities.add('impact_log')
        }
      }

      const activityStates: ActivityState[] = activityDefs.map(def => ({
        ...def,
        status: completedActivities.has(def.id) ? 'completed' : 'not_started',
      }));

      setActivities(activityStates);
    } catch (err) {
      console.error(err);
      setError('We could not load weekly activities. Try refreshing.');
    } finally {
      setActivityLoading(false);
    }
  }, [journey, selectedWeek, user]);

  const checkCalendarSyncTutorial = useCallback(async () => {
    if (!user) return
    setTutorialLoading(true)
    setTutorialError(null)
    try {
      const completion = await checkTutorialCompletion(user.uid, CALENDAR_SYNC_TUTORIAL.id)
      setTutorialCompleted(Boolean(completion))
    } catch (err) {
      console.error(err)
      setTutorialError('Unable to load tutorial status. Please retry.')
    } finally {
      setTutorialLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return;
    const progressRef = doc(db, "weeklyProgress", `${user.uid}__${selectedWeek}`);
    const unsubscribe = onSnapshot(progressRef, (doc) => {
      if (doc.exists()) {
        setWeeklyProgress(doc.data() as WeeklyProgress);
      } else {
        setWeeklyProgress(null);
      }
    });
    return () => unsubscribe();
  }, [user, selectedWeek]);

  useEffect(() => {
    if (!user) return
    const impactRange = getImpactLogDateRange(selectedWeek)
    if (!impactRange) return

    const impactQuery = query(
      collection(db, 'impact_logs'),
      where('userId', '==', user.uid),
      where('date', '>=', impactRange.start),
      where('date', '<', impactRange.end),
    )

    const unsubscribe = onSnapshot(impactQuery, snapshot => {
      const hasEntry = !snapshot.empty
      setActivities(prev => {
        const impactActivity = prev.find(activity => activity.id === 'impact_log')
        if (!impactActivity) return prev
        const nextStatus: ActivityStatus = hasEntry ? 'completed' : 'not_started'
        if (impactActivity.status === nextStatus) return prev

        if (hasEntry) {
          toast({
            title: 'Impact Log recorded',
            description: 'Your weekly checklist was updated automatically.',
            status: 'success',
            duration: 3000,
          })
        }

        return prev.map(activity =>
          activity.id === 'impact_log' ? { ...activity, status: nextStatus } : activity,
        )
      })
    })

    return () => unsubscribe()
  }, [getImpactLogDateRange, selectedWeek, toast, user])

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
    checkCalendarSyncTutorial()
  }, [checkCalendarSyncTutorial])

  useEffect(() => {
    setProgressLoading(true)
    calculateProgress()
    setProgressLoading(false)
  }, [activities, calculateProgress])

  const handleActivityUpdate = async (activity: ActivityState, nextStatus: ActivityStatus) => {
    if (!user || !journey) return;

    try {
      if (nextStatus === 'completed') {
        await awardChecklistPoints({
          uid: user.uid,
          journeyType: journey.journeyType,
          weekNumber: selectedWeek,
          activity,
        });
      } else if (nextStatus === 'not_started') {
        await revokeChecklistPoints({
          uid: user.uid,
          journeyType: journey.journeyType,
          weekNumber: selectedWeek,
          activity,
        });
      }

      // UI optimistically updates
      setActivities(prev =>
        prev.map(act => (act.id === activity.id ? { ...act, status: nextStatus } : act))
      );
    } catch (error) {
      console.error("Failed to update activity:", error);
      toast({
        title: 'Update Failed',
        description: 'Could not update your activity. Please try again.',
        status: 'error',
      });
    }
  };

  const openProofModal = (activity: ActivityState) => {
    setProofModal({ isOpen: true, activity })
    onOpen()
  }

  const handleTutorialComplete = async () => {
    if (!user) return
    setTutorialSaving(true)
    setTutorialSaveError(null)
    try {
      await markTutorialComplete(user.uid, CALENDAR_SYNC_TUTORIAL.id)
      setTutorialCompleted(true)
      setItemCompletion(CALENDAR_SYNC_ITEM, true)
      toast({
        title: 'Tutorial complete',
        description: 'You can now mark the calendar sync item as done.',
        status: 'success',
      })
      closeTutorialModal()
    } catch (err) {
      console.error(err)
      setTutorialSaveError('Unable to save tutorial completion. Please retry.')
    } finally {
      setTutorialSaving(false)
    }
  }

  const handleOpenTutorialModal = () => {
    setTutorialSaveError(null)
    openTutorialModal()
  }

  const handleCloseTutorialModal = () => {
    setTutorialSaveError(null)
    closeTutorialModal()
  }

  const submitProof = async () => {
    if (!proofModal.activity || !user) return
    try {
      const payload = removeUndefinedFields({
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

      await addDoc(collection(db, 'points_verification_requests'), payload)

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
    if (!journey) return false;
    return selectedWeek < journey.currentWeek;
  }, [journey, selectedWeek]);

  const progressStatus = useMemo(() => {
    if (!weeklyProgress) return { color: 'gray', label: 'Loading...', pct: 0 };
    const { pointsEarned, weeklyTarget } = weeklyProgress;
    const pct = weeklyTarget > 0 ? Math.min(100, Math.round((pointsEarned / weeklyTarget) * 100)) : 0;

    if (pct >= 100) return { color: 'green', label: 'On Track', pct };
    if (pct >= 75) return { color: 'yellow', label: 'Warning', pct };
    return { color: 'red', label: 'Alert', pct };
  }, [weeklyProgress]);

  const firstIncompleteActivity = useMemo(() => activities.find(activity => activity.status !== 'completed'), [activities])

  const scrollToActivity = () => {
    if (firstIncompleteActivity?.id && activityRefs.current[firstIncompleteActivity.id]) {
      activityRefs.current[firstIncompleteActivity.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      activityRefs.current[firstIncompleteActivity.id]?.classList.add('focus-ring')
      setTimeout(() => activityRefs.current[firstIncompleteActivity.id]?.classList.remove('focus-ring'), 2000)
    }
  }

  const renderWeekSelector = () => {
    if (!journey) return null;

    const { journeyType, currentWeek } = journey;
    const meta = JOURNEY_META[journeyType];
    const totalWeeks = meta.weeks;

    if (journeyType === '4W' || journeyType === '6W') {
      const weeks = Array.from({ length: totalWeeks }, (_, idx) => idx + 1);
      return (
        <HStack spacing={2} wrap="wrap">
          {weeks.map(week => {
            const isLocked = week > currentWeek;
            const isCompleted = week < currentWeek;
            return (
              <Tooltip
                key={week}
                label={isLocked ? 'Locked until you reach this week' : isCompleted ? 'Completed week' : 'Current week'}
              >
                <Button
                  size="sm"
                  variant={selectedWeek === week ? 'solid' : 'outline'}
                  colorScheme={selectedWeek === week ? 'teal' : 'gray'}
                  leftIcon={isCompleted ? <Icon as={CheckCircle} /> : undefined}
                  rightIcon={isLocked ? <Icon as={Lock} /> : undefined}
                  onClick={() => setSelectedWeek(week)}
                  isDisabled={isLocked}
                >
                  Week {week}
                </Button>
              </Tooltip>
            );
          })}
        </HStack>
      );
    }

    const totalMonths = totalWeeks / 4;
    const currentMonth = getMonthNumber(selectedWeek);
    const weeksInMonth = Array.from({ length: 4 }, (_, i) => (currentMonth - 1) * 4 + i + 1);

    return (
      <Stack spacing={3} bg="gray.900" p={4} borderRadius="lg">
        <Flex align="center" justify="space-between">
          <Button
            size="sm"
            leftIcon={<Icon as={ChevronLeft} />}
            isDisabled={currentMonth <= 1}
            onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 4))}
          >
            Previous Month
          </Button>
          <Text color="white" fontWeight="bold">
            Month {currentMonth} of {totalMonths}
          </Text>
          <Button
            size="sm"
            rightIcon={<Icon as={ChevronRight} />}
            isDisabled={currentMonth >= totalMonths}
            onClick={() => setSelectedWeek(Math.min(totalWeeks, selectedWeek + 4))}
          >
            Next Month
          </Button>
        </Flex>
        <HStack spacing={2} justify="center" wrap="wrap">
          {weeksInMonth.map(weekNumber => {
             const isLocked = weekNumber > currentWeek;
             const isCompleted = weekNumber < currentWeek;
            return (
            <Tooltip key={weekNumber} label={isLocked ? 'Locked' : isCompleted ? 'Completed' : 'Current week'}>
              <Button
                variant={selectedWeek === weekNumber ? 'solid' : 'outline'}
                colorScheme={selectedWeek === weekNumber ? 'teal' : 'gray'}
                size="sm"
                leftIcon={isCompleted ? <Icon as={CheckCircle} /> : undefined}
                rightIcon={isLocked ? <Icon as={Lock} /> : undefined}
                isDisabled={isLocked}
                onClick={() => setSelectedWeek(weekNumber)}
              >
                {`Month ${getMonthNumber(weekNumber)} · Week ${weekNumber}`}
              </Button>
            </Tooltip>
          )})}
        </HStack>
      </Stack>
    );
  };

  const renderActivityCard = (activity: ActivityState) => {
    const disabled = isWeekLocked
    const requiresPartnerApproval = journey?.isPaid && activity.requiresApproval
    const isHonorBased = !activity.requiresApproval
    const isAutoTracked = activity.id === 'impact_log'
    const yesDisabled = disabled || activity.status === 'completed'
    const noDisabled = disabled || activity.status === 'not_started'

    const showProofBadge = requiresPartnerApproval
    const showFreeBadge = activity.isFreeTier && !journey?.isPaid

    return (
      <Box
        key={activity.id}
        ref={ref => (activityRefs.current[activity.id] = ref)}
        borderWidth="1px"
        borderColor="border.card"
        p={4}
        borderRadius="lg"
        bg="surface.default"
        className="activity-card"
      >
        <Flex justify="space-between" align="flex-start" mb={2}>
          <Stack spacing={1}>
            <HStack spacing={2}>
              {activity.status === 'completed' ? (
                <Badge colorScheme="success">{statusLabelMap[activity.status]}</Badge>
              ) : activity.status === 'pending' ? (
                <Badge colorScheme="secondary">{statusLabelMap[activity.status]}</Badge>
              ) : (
                <Badge bg="surface.subtle" color="text.secondary" border="1px solid" borderColor="border.subtle">
                  {statusLabelMap[activity.status]}
                </Badge>
              )}
              {showProofBadge && (
                <Tooltip
                  label={
                    activity.id === 'lift_module'
                      ? 'Complete the module, then upload proof for verification.'
                      : 'Partner approval required. Upload proof so the partner team can verify.'
                  }
                >
                  <Badge colorScheme="purple">Partner approval</Badge>
                </Tooltip>
              )}
              {showFreeBadge && <Badge colorScheme="secondary">Free tier</Badge>}
              <Tag colorScheme="primary">{activity.category}</Tag>
            </HStack>
            <HStack spacing={2}>
              <Heading size="sm" color="text.primary">
                {activity.title}
              </Heading>
              {isHonorBased ? (
                <Tooltip label="Self-verified">
                  <Icon as={CheckCircle} color="green.400" boxSize={4} />
                </Tooltip>
              ) : (
                <Tooltip label="Requires partner approval">
                  <Icon as={ShieldCheck} color="purple.400" boxSize={4} />
                </Tooltip>
              )}
            </HStack>
            <Text color="text.secondary" fontSize="sm">
              {activity.description}
            </Text>
          </Stack>
          <Stack align="flex-end" spacing={2}>
            <Tag
              bg="tint.accentWarning"
              color="text.primary"
              border="1px solid"
              borderColor="accent.warning"
            >
              +{activity.points} pts
            </Tag>
            {activity.status === 'pending' && (
              <Tooltip label="Pending partner verification. Points will post after approval.">
                <Icon as={AlertTriangle} color="yellow.300" />
              </Tooltip>
            )}
          </Stack>
        </Flex>
        {isHonorBased ? (
          <Stack spacing={2}>
            <Text color="text.muted" fontSize="sm">
              Status automatically updated when you submit this activity.
            </Text>
            {isAutoTracked && (
              <Button variant="outline" colorScheme="purple" onClick={() => navigate('/app/impact-log')}>
                Go to Impact Log
              </Button>
            )}
          </Stack>
        ) : (
          <HStack spacing={3}>
            <Button
              colorScheme="primary"
              variant={activity.status === 'completed' || activity.status === 'pending' ? 'solid' : 'outline'}
              isDisabled={yesDisabled}
              onClick={() =>
                requiresPartnerApproval
                  ? openProofModal(activity)
                  : handleActivityUpdate(activity, 'completed')
              }
            >
              Yes
            </Button>
            <Button
              variant="outline"
              borderColor="border.strong"
              color="text.primary"
              isDisabled={noDisabled}
              onClick={() => handleActivityUpdate(activity, 'not_started')}
            >
              No
            </Button>
          </HStack>
        )}
      </Box>
    )
  }

  const renderParticipationRhythm = () => (
    <Box borderWidth="1px" borderColor="border.card" p={4} borderRadius="lg" bg="surface.default">
      <HStack justify="space-between" mb={2}>
        <Heading size="sm" color="text.primary">
          Participation Rhythm
        </Heading>
        <Tag colorScheme="primary">+{rhythmPoints} pts</Tag>
      </HStack>
      {tutorialError && (
        <Alert status="warning" borderRadius="md" mb={3}>
          <AlertIcon />
          <AlertDescription>{tutorialError}</AlertDescription>
          <IconButton
            aria-label="Retry tutorial status"
            size="sm"
            ml="auto"
            onClick={checkCalendarSyncTutorial}
            icon={tutorialLoading ? <Spinner size="xs" /> : <Icon as={Plus} />}
            isDisabled={tutorialLoading}
            variant="outline"
          />
        </Alert>
      )}
      <Stack spacing={2}>
        {rhythmItems.map(item => (
          <Flex key={item} align="center" justify="space-between" p={2} borderRadius="md" bg="surface.subtle">
            <HStack spacing={2}>
              <Text color="text.secondary">{item}</Text>
              {item === CALENDAR_SYNC_ITEM && (
                <Badge colorScheme="orange" variant="subtle">
                  Tutorial Required
                </Badge>
              )}
            </HStack>
            <Tooltip
              label={
                item === CALENDAR_SYNC_ITEM
                  ? 'Complete the calendar sync tutorial before marking this as done.'
                  : ''
              }
              isDisabled={item !== CALENDAR_SYNC_ITEM}
            >
              <Button
                size="sm"
                leftIcon={
                  rhythmCompleted[item] ? (
                    <Icon as={CheckCircle} />
                  ) : tutorialLoading && item === CALENDAR_SYNC_ITEM ? (
                    <Spinner size="xs" />
                  ) : (
                    <Icon as={Plus} />
                  )
                }
                colorScheme={rhythmCompleted[item] ? 'primary' : undefined}
                borderColor={rhythmCompleted[item] ? undefined : 'border.strong'}
                color={rhythmCompleted[item] ? undefined : 'text.primary'}
                variant={rhythmCompleted[item] ? 'solid' : 'outline'}
                onClick={() => {
                  if (item === CALENDAR_SYNC_ITEM && !tutorialCompleted) {
                    handleOpenTutorialModal()
                    return
                  }
                  toggleItem(item)
                }}
                isDisabled={tutorialLoading && item === CALENDAR_SYNC_ITEM}
              >
                {rhythmCompleted[item] ? 'Completed' : 'Mark done'}
              </Button>
            </Tooltip>
          </Flex>
        ))}
      </Stack>
      <Text color="text.muted" fontSize="sm" mt={2}>
        Saved locally for calendar week {calendarWeek}. Perfect for building your weekly habits.
      </Text>
    </Box>
  )

  const renderGuidanceCard = () => {
    if (normalizedJourneyType !== '6W') return null
    const bullets = weeklyGuidance[selectedWeek]
    if (!bullets?.length) return null

    return (
      <Box borderWidth="1px" borderColor="accent.purpleBorder" p={4} borderRadius="lg" bg="accent.purpleSubtle">
        <Heading size="sm" color="text.primary" mb={2}>
          Week {selectedWeek} – Focus Guidance
        </Heading>
        <Stack spacing={2} color="text.secondary">
          {bullets.map(item => (
            <HStack key={item} spacing={2} align="flex-start">
              <Icon as={CheckCircle} color="brand.primary" />
              <Text>{item}</Text>
            </HStack>
          ))}
        </Stack>
      </Box>
    )
  }

  const renderGamificationPanel = () => (
    <Box borderWidth="1px" borderColor="border.card" p={4} borderRadius="lg" bg="surface.default">
      <Heading size="sm" color="text.primary" mb={3}>
        Workflow Gamification
      </Heading>
      <Stack spacing={3}>
        <Alert status="info" variant="subtle" borderRadius="md">
          <AlertIcon />
          <Stack spacing={1}>
            <Text color="text.secondary">Focus on your next incomplete activity.</Text>
            <Text color="text.secondary" fontSize="sm">
              Keep your streak alive by acting in the next 24 hours.
            </Text>
          </Stack>
        </Alert>
        <Button colorScheme="primary" onClick={scrollToActivity} isDisabled={!firstIncompleteActivity}>
          {firstIncompleteActivity ? `Complete ${firstIncompleteActivity.title}` : 'All activities done'}
        </Button>
        <Stack spacing={1} color="text.secondary">
          <Text fontWeight="bold">Streak tracker</Text>
          <Progress value={Math.min(100, progressStatus.pct)} colorScheme={progressStatus.color} borderRadius="full" />
          <Text fontSize="sm" color="text.muted">Maintain daily check-ins to grow your streak.</Text>
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
          <Text mb={2} color="text.secondary">
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
          <Button colorScheme="primary" onClick={submitProof} leftIcon={<Icon as={Plus} />}
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
        <Heading size="lg" color="text.primary">
          Weekly Checklist
        </Heading>
        <Text color="text.secondary">A comprehensive weekly activity tracker with Firebase-powered progress.</Text>
      </Stack>
      <Box p={4} borderWidth="1px" borderColor="gray.700" bg="white" borderRadius="lg">
        <Stack spacing={3}>
          <HStack justify="space-between">
            <Heading size="sm" color="#273240">
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
              icon={<Icon as={CheckCircle} color="success.400" />}
            />
            <StatCard
              label="Weekly points"
              value={`${pendingCounts.points} / ${weeklyTarget}`}
              icon={<Icon as={Plus} color="accent.warning" />}
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
          <CircularProgress isIndeterminate color="brand.primary" />
          <Text color="text.secondary">Loading weekly activities...</Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Stack spacing={6} color="text.primary">
      {renderWeekSummary()}
      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <SurfaceCard borderColor="border.card">
        <Stack spacing={4}>
          <Flex align="center" justify="space-between">
            <Heading size="sm" color="text.primary">
              Week navigation
            </Heading>
            {isWeekLocked && (
              <Tag colorScheme="warning" borderRadius="full" size="sm">
                <Icon as={Lock} mr={1} /> Locked for review
              </Tag>
            )}
          </Flex>
          {renderWeekSelector()}
        </Stack>
      </SurfaceCard>

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6} alignItems="start">
        <GridItem>
          <Stack spacing={4}>
            <SurfaceCard borderColor="border.card">
              <Heading size="sm" color="text.primary" mb={3}>
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
                        <Text color="text.secondary">No activities found for this week.</Text>
                        <Text color="text.secondary" fontSize="sm">
                          Templates will automatically sync from Firebase when available.
                        </Text>
                      </Stack>
                    </Center>
                  )}
                </Stack>
              )}
            </SurfaceCard>
            {renderGuidanceCard()}
            {renderParticipationRhythm()}
          </Stack>
        </GridItem>

        <GridItem>
          <Stack spacing={4}>
            <SurfaceCard borderColor="border.card">
              <Heading size="sm" color="text.primary" mb={3}>
                Weekly progress
              </Heading>
              {progressLoading ? (
                <Skeleton height="180px" />
              ) : (
                <Stack spacing={3}>
                  <Progress value={progressStatus.pct} colorScheme={progressStatus.color} borderRadius="full" />
                  <Text color="text.primary" fontWeight="bold">
                    {pendingCounts.points} / {weeklyTarget} points earned
                  </Text>
                  <Text color="text.secondary" fontSize="sm">
                    {progressStatus.pct >= 100
                      ? 'Amazing! You are ahead of your target.'
                      : progressStatus.pct >= 75
                        ? 'You are close. Aim to close remaining activities.'
                        : 'Critical: earn points to avoid falling behind.'}
                  </Text>
                </Stack>
              )}
            </SurfaceCard>
            {renderGamificationPanel()}
          </Stack>
        </GridItem>
      </Grid>

      {renderProofModal()}
      <IoradTutorialModal
        isOpen={isTutorialModalOpen}
        onClose={handleCloseTutorialModal}
        onComplete={handleTutorialComplete}
        tutorialUrl={CALENDAR_SYNC_TUTORIAL.url}
        isSubmitting={tutorialSaving}
        error={tutorialSaveError}
        onRetry={tutorialSaveError ? handleTutorialComplete : undefined}
      />
    </Stack>
  )
}

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <SurfaceCard borderColor="gray.700" borderRadius="lg" bg="white">
    <HStack justify="space-between" mb={1}>
      <Text color="#273240" fontSize="sm">
        {label}
      </Text>
      {icon}
    </HStack>
    <Heading size="md" color="#273240">
      {value}
    </Heading>
  </SurfaceCard>
)

const InfoPill: React.FC<{ color: string }> = ({ color }) => (
  <Box w={3} h={3} borderRadius="full" bg={`${color}.300`} />
)

export const WeeklyUpdatesPage = WeeklyChecklistPage
export { WeeklyChecklistPage }
