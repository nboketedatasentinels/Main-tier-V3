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
import { AlertTriangle, CalendarRange, CheckCircle, Lock, Plus, ShieldCheck } from 'lucide-react'
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { addDays, format } from 'date-fns'
import { removeUndefinedFields } from '@/utils/firestore'
import { getIsoWeekNumber } from '@/utils/date'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { createApprovalRequest } from '@/services/approvalsService'
import { PointsVerificationRequest } from '@/services/pointsVerificationService'
import { CALENDAR_SYNC_TUTORIAL, WeeklyProgress } from '@/types'
import { isFreeUser } from '@/utils/membership'
import { JOURNEY_META, getMonthNumber, getActivitiesForJourney, type ActivityDef, type JourneyType } from '@/config/pointsConfig'
import { awardChecklistPoints, revokeChecklistPoints } from '@/services/pointsService'
import { SurfaceCard } from '@/components/primitives/SurfacePrimitives'
import { IoradTutorialModal } from '@/components/modals/IoradTutorialModal'
import { checkTutorialCompletion, markTutorialComplete } from '@/services/tutorialService'
import { ORG_COLLECTION } from '@/constants/organizations'
import {
  JOURNEY_LABELS,
  JOURNEY_MONTH_COUNTS,
  MONTH_BASED_JOURNEYS,
  resolveJourneyType,
} from '@/utils/journeyType'
import { getWindowNumber, getWindowRange, getWindowWeekNumber } from '@/utils/windowCalculations'
import {
  calculateActivityAvailability,
  getVisibleActivities,
  type ActivityAvailabilityReason,
  type ActivityAvailabilityResult,
} from '@/utils/activityStateManager'

const DEFAULT_WEEKLY_TARGET = JOURNEY_META['6W'].weeklyTarget

type ActivityStatus = 'not_started' | 'pending' | 'completed'

type ActivityState = ActivityDef & {
  status: ActivityStatus
  proofUrl?: string
  notes?: string
  hasInteracted?: boolean
  availability: ActivityAvailabilityResult
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

interface MonthMilestone {
  month: number;
  startWeek: number;
  endWeek: number;
  status: 'completed' | 'current' | 'locked';
  completionPercent: number;
}

interface WeekMilestone {
  week: number;
  status: 'completed' | 'current' | 'locked' | 'incomplete';
}

interface WindowProgressData {
  pointsEarned: number;
  windowTarget: number;
  status: 'on_track' | 'warning' | 'alert';
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

const availabilityReasonLabels: Record<ActivityAvailabilityReason, string> = {
  scheduled: 'Scheduled later this window',
  cooldown: 'Cooldown in effect',
  max_per_week: 'Weekly limit reached',
  max_per_window: 'Window limit reached',
  missing_mentor: 'Mentor required',
  missing_ambassador: 'Ambassador required',
  one_time_used: 'Activity already completed',
  window_cap_reached: 'Window limit reached',
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
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress | null>(null)
  const [windowProgressData, setWindowProgressData] = useState<WindowProgressData | null>(null);
  const [allWeeksProgress, setAllWeeksProgress] = useState<WeeklyProgress[]>([])
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
      activities: updatedActivities.map(({ id, status, proofUrl, notes, hasInteracted }) =>
        removeUndefinedFields({
          id,
          status,
          proofUrl,
          notes,
          hasInteracted,
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

  const weekProgressByNumber = useMemo(() => {
    const map = new Map<number, WeeklyProgress>();
    allWeeksProgress.forEach(week => map.set(week.weekNumber, week));
    return map;
  }, [allWeeksProgress]);

  const windowMeta = useMemo(() => {
    if (!journey) {
      return {
        windowNumber: 1,
        startWeek: selectedWeek,
        endWeek: selectedWeek,
        windowWeeks: 1,
      };
    }
    return getWindowRange(selectedWeek, journey.programDurationWeeks);
  }, [journey, selectedWeek]);

  const windowProgress = useMemo(() => {
    if (!journey) {
      return {
        windowNumber: 1,
        target: 0,
        earned: 0,
        pct: 0,
        startWeek: selectedWeek,
        endWeek: selectedWeek,
      };
    }
    const { windowNumber, startWeek, endWeek, windowWeeks } = windowMeta;
    const target = weeklyTarget * windowWeeks;
    const earned = allWeeksProgress.reduce((sum, week) => {
      if (week.weekNumber < startWeek || week.weekNumber > endWeek) return sum;
      return sum + (week.pointsEarned ?? 0);
    }, 0);
    const pct = target > 0 ? Math.min(100, Math.round((earned / target) * 100)) : 0;
    return { windowNumber, target, earned, pct, startWeek, endWeek };
  }, [allWeeksProgress, journey, selectedWeek, weeklyTarget, windowMeta]);

  const tierLabel = useMemo(() => {
    if (!profile) return 'Member';
    const tier = profile.transformationTier?.toString().toLowerCase() ?? '';
    if (tier.includes('corporate')) return 'Corporate';
    return isFreeUser(profile) ? 'Free Tier' : 'Premium';
  }, [profile]);

  const journeyStartDate = useMemo(() => {
    if (!journey || !profile) return null;
    if (profile.journeyStartDate) {
      return new Date(profile.journeyStartDate);
    }
    const offsetWeeks = journey.currentWeek - 1;
    return addDays(new Date(), -(offsetWeeks * 7));
  }, [journey, profile]);

  const journeyEndDate = useMemo(() => {
    if (!journeyStartDate || !journey) return null;
    return addDays(journeyStartDate, journey.programDurationWeeks * 7);
  }, [journeyStartDate, journey]);

  const isMonthBasedJourney = useMemo(() => {
    return journey ? MONTH_BASED_JOURNEYS.includes(journey.journeyType) : false;
  }, [journey]);

  const currentMonthNumber = useMemo(() => {
    if (!journey) return 1;
    return getMonthNumber(journey.currentWeek);
  }, [journey]);

  const totalMonths = useMemo(() => {
    if (!journey) return 1;
    if (!isMonthBasedJourney) return 1;
    return JOURNEY_MONTH_COUNTS[journey.journeyType];
  }, [journey, isMonthBasedJourney]);

  const getImpactLogDateRange = useCallback(
    (weekNumber: number) => {
      if (!journeyStartDate) return null;
      const weekStart = addDays(journeyStartDate, (weekNumber - 1) * 7);
      const weekEnd = addDays(weekStart, 7);
      return {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
      };
    },
    [journeyStartDate],
  );

  const normalizeWeeklyProgress = useCallback(
    (data: WeeklyProgress & { points_earned?: number; weekly_target?: number }) => ({
      ...data,
      pointsEarned: data.pointsEarned ?? data.points_earned ?? 0,
      weeklyTarget: data.weeklyTarget ?? data.weekly_target ?? weeklyTarget,
    }),
    [weeklyTarget],
  );

  const fetchJourney = useCallback(async () => {
    if (!user || !profile) return;
    try {
      // Free users are automatically assigned to the 4W journey.
      const isFreeTierUser = isFreeUser(profile);
      let orgJourneyType: JourneyType | null = null;

      if (profile.companyId) {
        const orgSnap = await getDoc(doc(db, ORG_COLLECTION, profile.companyId));
        if (orgSnap.exists()) {
          const orgData = orgSnap.data() as {
            journeyType?: JourneyType;
            programDurationWeeks?: number;
            programDuration?: number | string | null;
          };
          const rawDuration = orgData?.programDuration ?? null;
          const durationNumber = rawDuration === null ? null : Number(rawDuration);
          const programDurationWeeks = Number.isNaN(durationNumber)
            ? orgData?.programDurationWeeks ?? null
            : orgData?.programDurationWeeks ?? (durationNumber ? durationNumber * 4 : null);
          orgJourneyType = resolveJourneyType({
            journeyType: orgData?.journeyType,
            programDurationWeeks,
            programDuration: durationNumber,
          })
        }
      }

      const journeyType: JourneyType = isFreeTierUser && !profile.companyId
        ? '4W'
        : (orgJourneyType ?? (profile.journeyType as JourneyType) ?? '6W');
      const meta = JOURNEY_META[journeyType];

      const journeyConfig: JourneyConfig = {
        journeyType,
        currentWeek: profile.currentWeek || 1,
        programDurationWeeks: meta.weeks,
        isPaid: !isFreeTierUser,
      };

      setJourney(journeyConfig);
      setSelectedWeek(journeyConfig.currentWeek);

      if (profile.companyId && profile.journeyType !== journeyType) {
        await setDoc(
          doc(db, 'profiles', profile.id),
          { journeyType },
          { merge: true },
        );
      }
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
      const windowNumber = getWindowNumber(selectedWeek);
      const windowWeek = getWindowWeekNumber(selectedWeek);
      const hasMentor = Boolean(profile?.mentorId || profile?.mentorOverrideId);
      const hasAmbassador = Boolean(profile?.ambassadorId || profile?.ambassadorOverrideId);

      const ledgerQuery = query(
        collection(db, 'pointsLedger'),
        where('uid', '==', user.uid),
        where('weekNumber', '==', selectedWeek)
      );

      const windowLedgerQuery = query(
        collection(db, 'pointsLedger'),
        where('uid', '==', user.uid),
        where('monthNumber', '==', windowNumber),
      );

      const globalLedgerQuery = query(
        collection(db, 'pointsLedger'),
        where('uid', '==', user.uid)
      );

      const [ledgerSnapshot, windowLedgerSnapshot, globalLedgerSnapshot] = await Promise.all([
        getDocs(ledgerQuery),
        getDocs(windowLedgerQuery),
        getDocs(globalLedgerQuery)
      ]);

      const completedActivities = new Set(ledgerSnapshot.docs.map(d => d.data().activityId));
      const weekActivityCounts = ledgerSnapshot.docs.reduce<Record<string, number>>((acc, docItem) => {
        const activityId = docItem.data().activityId as string | undefined;
        if (!activityId) return acc;
        acc[activityId] = (acc[activityId] ?? 0) + 1;
        return acc;
      }, {});

      const windowActivityCounts = windowLedgerSnapshot.docs.reduce<Record<string, number>>((acc, docItem) => {
        const activityId = docItem.data().activityId as string | undefined;
        if (!activityId) return acc;
        acc[activityId] = (acc[activityId] ?? 0) + 1;
        return acc;
      }, {});

      const totalCompletedAllTime = globalLedgerSnapshot.docs.reduce<Record<string, number>>((acc, docItem) => {
        const activityId = docItem.data().activityId as string | undefined;
        if (!activityId) return acc;
        acc[activityId] = (acc[activityId] ?? 0) + 1;
        return acc;
      }, {});

      const lastCompletionWeekByActivity = windowLedgerSnapshot.docs.reduce<Record<string, number>>((acc, docItem) => {
        const activityId = docItem.data().activityId as string | undefined;
        const weekNumber = docItem.data().weekNumber as number | undefined;
        if (!activityId || !weekNumber) return acc;
        const current = acc[activityId] ?? 0;
        acc[activityId] = Math.max(current, weekNumber);
        return acc;
      }, {});

      const activityStates: ActivityState[] = activityDefs
        .map(def => ({
          ...def,
          status: completedActivities.has(def.id) ? 'completed' : 'not_started',
          availability: calculateActivityAvailability(def, {
            windowWeek,
            weekCount: weekActivityCounts[def.id] ?? 0,
            windowCount: windowActivityCounts[def.id] ?? 0,
            totalCompletedAllTime: totalCompletedAllTime[def.id] ?? 0,
            lastCompletedWeek: lastCompletionWeekByActivity[def.id],
            hasMentor,
            hasAmbassador,
          }),
        }));

      setActivities(activityStates);
    } catch (err) {
      console.error(err);
      setError('We could not load weekly activities. Try refreshing.');
    } finally {
      setActivityLoading(false);
    }
  }, [journey, profile?.ambassadorId, profile?.ambassadorOverrideId, profile?.mentorId, profile?.mentorOverrideId, selectedWeek, user]);

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

    const useWindowProgress = import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true';

    if (useWindowProgress) {
      const windowNumber = getWindowNumber(selectedWeek);
      const progressRef = doc(db, "windowProgress", `${user.uid}__${windowNumber}`);
      const unsubscribe = onSnapshot(progressRef, (doc) => {
        if (doc.exists()) {
          setWindowProgressData(doc.data() as WindowProgressData);
        } else {
          setWindowProgressData(null);
        }
      });
      return () => unsubscribe();
    } else {
      const progressRef = doc(db, "weeklyProgress", `${user.uid}__${selectedWeek}`);
      const unsubscribe = onSnapshot(progressRef, (doc) => {
        if (doc.exists()) {
          setWeeklyProgress(normalizeWeeklyProgress(doc.data() as WeeklyProgress & { points_earned?: number; weekly_target?: number }));
        } else {
          setWeeklyProgress(null);
        }
      });
      return () => unsubscribe();
    }
  }, [normalizeWeeklyProgress, selectedWeek, user]);

  useEffect(() => {
    if (!user || !journey) {
      setAllWeeksProgress([])
      return
    }
    const progressQuery = query(
      collection(db, 'weeklyProgress'),
      where('uid', '==', user.uid),
      where('weekNumber', '>=', 1),
      where('weekNumber', '<=', journey.programDurationWeeks),
    )
    const unsubscribe = onSnapshot(progressQuery, snapshot => {
      const progress = snapshot.docs.map(doc =>
        normalizeWeeklyProgress(doc.data() as WeeklyProgress & { points_earned?: number; weekly_target?: number }),
      )
      setAllWeeksProgress(progress)
    })
    return () => unsubscribe()
  }, [journey, normalizeWeeklyProgress, user])

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
    if (activity.availability.state !== 'available') {
      toast({
        title: 'Activity unavailable',
        description: availabilityReasonLabels[activity.availability.reason ?? 'scheduled'],
        status: 'warning',
      });
      return;
    }

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
      setActivities(prev => {
        const nextActivities = prev.map(act =>
          act.id === activity.id
            ? { ...act, status: nextStatus, hasInteracted: true }
            : act,
        )
        void persistChecklist(nextActivities)
        return nextActivities
      });
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
    if (proofModal.activity.availability.state !== 'available') {
      toast({
        title: 'Activity unavailable',
        description: availabilityReasonLabels[proofModal.activity.availability.reason ?? 'scheduled'],
        status: 'warning',
      })
      return
    }
    try {
      const { activity } = proofModal

      const sourcePayload: Omit<PointsVerificationRequest, 'id'> = {
        user_id: user.uid,
        week: selectedWeek,
        activity_id: activity.id,
        activity_title: activity.title,
        points: activity.points,
        proof_url: activity.proofUrl,
        notes: activity.notes,
        status: 'pending',
        created_at: serverTimestamp(),
      }

      await createApprovalRequest({
        userId: user.uid,
        type: 'points_verification',
        title: activity.title,
        source: sourcePayload,
        summary: activity.notes,
        points: activity.points,
      })

      await persistChecklist(
        activities.map(activity =>
          activity.id === proofModal.activity?.id
            ? {
              ...activity,
              status: 'pending' as ActivityStatus,
              proofUrl: proofModal.activity?.proofUrl,
              notes: proofModal.activity?.notes,
              hasInteracted: true,
            }
            : activity,
        ),
      )

      setActivities(prev =>
        prev.map(activity =>
          activity.id === proofModal.activity?.id
            ? {
              ...activity,
              status: 'pending',
              proofUrl: proofModal.activity?.proofUrl,
              notes: proofModal.activity?.notes,
              hasInteracted: true,
            }
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
    return selectedWeek > journey.currentWeek;
  }, [journey, selectedWeek]);

  const progressStatus = useMemo(() => {
    const useWindowProgress = import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true';

    if (useWindowProgress) {
      if (!windowProgressData) return { color: 'gray', label: 'Loading...', pct: 0 };
      const { pointsEarned, windowTarget } = windowProgressData;
      const pct = windowTarget > 0 ? Math.min(100, Math.round((pointsEarned / windowTarget) * 100)) : 0;
      if (pct >= 100) return { color: 'green', label: 'On Track', pct };
      if (pct >= 75) return { color: 'yellow', label: 'Warning', pct };
      return { color: 'red', label: 'Alert', pct };
    } else {
      if (!weeklyProgress) return { color: 'gray', label: 'Loading...', pct: 0 };
      const { pointsEarned, weeklyTarget } = weeklyProgress;
      const pct = weeklyTarget > 0 ? Math.min(100, Math.round((pointsEarned / weeklyTarget) * 100)) : 0;
      if (pct >= 100) return { color: 'green', label: 'On Track', pct };
      if (pct >= 75) return { color: 'yellow', label: 'Warning', pct };
      return { color: 'red', label: 'Alert', pct };
    }
  }, [weeklyProgress, windowProgressData]);

  const weeklyPointsEarned = useMemo(() => {
    const useWindowProgress = import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true';
    if (useWindowProgress) {
        return windowProgressData?.pointsEarned ?? pendingCounts.points;
    }
    if (weeklyProgress) return weeklyProgress.pointsEarned;
    return pendingCounts.points;
  }, [pendingCounts.points, weeklyProgress, windowProgressData]);

  const journeyProgress = useMemo(() => {
    if (!journey) {
      return { weeksAtTarget: 0, pct: 0, totalEarned: 0, totalTarget: 0 };
    }
    const totalTarget = weeklyTarget * journey.programDurationWeeks;
    const totalEarned = allWeeksProgress.reduce((sum, week) => sum + (week.pointsEarned ?? 0), 0);
    const pct = totalTarget > 0 ? Math.min(100, Math.round((totalEarned / totalTarget) * 100)) : 0;
    const weeksAtTarget = allWeeksProgress.filter(
      week => week.pointsEarned >= (week.weeklyTarget ?? weeklyTarget),
    ).length;
    return { weeksAtTarget, pct, totalEarned, totalTarget };
  }, [allWeeksProgress, journey, weeklyTarget]);

  const monthMeta = useCallback(
    (month: number): MonthMilestone => {
      if (!journey) {
        return {
          month,
          startWeek: 1,
          endWeek: 4,
          status: 'locked',
          completionPercent: 0,
        };
      }
      const startWeek = (month - 1) * 4 + 1;
      const endWeek = Math.min(journey.programDurationWeeks, startWeek + 3);
      const isCompleted = endWeek < journey.currentWeek;
      const isCurrent = month === currentMonthNumber;
      const status = isCompleted ? 'completed' : isCurrent ? 'current' : 'locked';
      const completedWeeks = isCompleted
        ? 4
        : isCurrent
          ? Math.max(0, Math.min(4, journey.currentWeek - startWeek))
          : 0;
      const completionPercent = Math.min(100, Math.round((completedWeeks / 4) * 100));
      return { month, startWeek, endWeek, status, completionPercent };
    },
    [currentMonthNumber, journey],
  );

  const renderJourneyHeader = () => {
    if (!journey) return null;
    const label = JOURNEY_LABELS[journey.journeyType];
    const startLabel = journeyStartDate ? format(journeyStartDate, 'MMM d, yyyy') : 'Not set';
    const endLabel = journeyEndDate ? format(journeyEndDate, 'MMM d, yyyy') : 'TBD';
    const overviewLabel = isMonthBasedJourney
      ? `Month ${currentMonthNumber} of ${totalMonths} · Week ${journey.currentWeek} of ${journey.programDurationWeeks}`
      : `Week ${journey.currentWeek} of ${journey.programDurationWeeks}`;
    const monthMilestones: MonthMilestone[] = isMonthBasedJourney
      ? Array.from({ length: totalMonths }, (_, idx) => monthMeta(idx + 1))
      : [];
    const weekMilestones: WeekMilestone[] = !isMonthBasedJourney
      ? Array.from({ length: journey.programDurationWeeks }, (_, idx) => ({
        week: idx + 1,
        status: (() => {
          const weekNumber = idx + 1;
          const progress = weekProgressByNumber.get(weekNumber);
          const target = progress?.weeklyTarget ?? weeklyTarget;
          const isAtTarget = progress ? progress.pointsEarned >= target : false;
          if (isAtTarget) return 'completed';
          if (weekNumber === selectedWeek) return 'current';
          if (weekNumber > journey.currentWeek) return 'locked';
          return 'incomplete';
        })(),
      }))
      : [];

    return (
      <SurfaceCard borderColor="border.card">
        <Stack spacing={4}>
          <Flex align="flex-start" justify="space-between" wrap="wrap" gap={4}>
            <Stack spacing={2}>
              <HStack spacing={2}>
                <Badge colorScheme="purple">{label}</Badge>
                <Badge colorScheme={journey.isPaid ? 'green' : 'gray'}>{tierLabel}</Badge>
              </HStack>
              <Heading size="md" color="text.primary">
                Journey Progress
              </Heading>
              <Text color="text.secondary">{overviewLabel}</Text>
              <Text color="text.secondary" fontSize="sm">
                {journey.programDurationWeeks} total weeks · {journeyProgress.weeksAtTarget} weeks at target
              </Text>
              <Text color="text.secondary" fontSize="sm">
                {journeyProgress.totalEarned.toLocaleString()} of {journeyProgress.totalTarget.toLocaleString()} points earned
              </Text>
            </Stack>
            <Stack spacing={1} align="flex-end">
              <Text color="text.muted" fontSize="sm">
                Started: {startLabel}
              </Text>
              <Text color="text.muted" fontSize="sm">
                Expected completion: {endLabel}
              </Text>
              <Text color="text.muted" fontSize="sm">
                Completion {journeyProgress.pct}%
              </Text>
            </Stack>
          </Flex>
          <Progress value={journeyProgress.pct} colorScheme="teal" borderRadius="full" />
          <HStack spacing={2} wrap="wrap">
            {isMonthBasedJourney
              ? monthMilestones.map((monthItem) => (
                <Tag
                  key={`month-${monthItem.month}`}
                  colorScheme={
                    monthItem.status === 'completed' ? 'green' : monthItem.status === 'current' ? 'teal' : 'gray'
                  }
                >
                  <HStack spacing={1}>
                    {monthItem.status === 'completed' && <Icon as={CheckCircle} />}
                    {monthItem.status === 'locked' && <Icon as={Lock} />}
                    <Text>Month {monthItem.month}</Text>
                  </HStack>
                </Tag>
              ))
              : weekMilestones.map((weekItem) => (
                <Tag
                  key={`week-${weekItem.week}`}
                  colorScheme={
                    weekItem.status === 'completed'
                      ? 'green'
                      : weekItem.status === 'current'
                        ? 'teal'
                        : weekItem.status === 'incomplete'
                          ? 'yellow'
                          : 'gray'
                  }
                >
                  <HStack spacing={1}>
                    {weekItem.status === 'completed' && <Icon as={CheckCircle} />}
                    {weekItem.status === 'locked' && <Icon as={Lock} />}
                    <Text>Week {weekItem.week}</Text>
                  </HStack>
                </Tag>
              ))}
          </HStack>
        </Stack>
      </SurfaceCard>
    );
  };

  const firstIncompleteActivity = useMemo(() => activities.find(activity => activity.status !== 'completed'), [activities])

  const scrollToActivity = () => {
    if (firstIncompleteActivity?.id && activityRefs.current[firstIncompleteActivity.id]) {
      activityRefs.current[firstIncompleteActivity.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      activityRefs.current[firstIncompleteActivity.id]?.classList.add('focus-ring')
      setTimeout(() => activityRefs.current[firstIncompleteActivity.id]?.classList.remove('focus-ring'), 2000)
    }
  }

  const getAvailabilityMessage = (activity: ActivityState) => {
    if (activity.availability.state === 'available') return null
    if (activity.availability.reason === 'scheduled') {
      return `Available in week ${activity.week} of this window.`
    }
    if (activity.availability.reason === 'cooldown' && activity.availability.cooldownRemainingWeeks) {
      return `Available in ${activity.availability.cooldownRemainingWeeks} week(s).`
    }
    if (activity.availability.reason) {
      return availabilityReasonLabels[activity.availability.reason]
    }
    return 'Locked'
  }

  const renderActivityCard = (activity: ActivityState) => {
    const disabled = isWeekLocked || activity.availability.state !== 'available'
    const requiresPartnerApproval = journey?.isPaid && activity.requiresApproval
    const isHonorBased = !activity.requiresApproval
    const yesDisabled = disabled || activity.status === 'completed'
    const noDisabled = disabled || activity.status === 'not_started'

    const showProofBadge = requiresPartnerApproval
    const showFreeBadge = activity.isFreeTier && !journey?.isPaid
    const availabilityMessage = getAvailabilityMessage(activity)

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
              {activity.availability.state === 'locked' && (
                <Badge colorScheme="gray">Locked</Badge>
              )}
              {activity.availability.state === 'exhausted' && (
                <Badge colorScheme="orange">Exhausted</Badge>
              )}
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
            {availabilityMessage && (
              <Text color="text.muted" fontSize="sm">
                {availabilityMessage}
              </Text>
            )}
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
          </Stack>
        ) : (
          <Stack spacing={2} align="flex-start">
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
            {activity.hasInteracted && (
              <Text fontSize="sm" color="text.muted">
                Selection locked. Contact support to make changes.
              </Text>
            )}
          </Stack>
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
        <Text color="text.secondary">
          Track your weekly activities and see how they roll up into your overall journey.
        </Text>
      </Stack>
      <Box p={4} borderWidth="1px" borderColor="gray.700" bg="white" borderRadius="lg">
        <Stack spacing={3}>
          <HStack justify="space-between">
            <Heading size="sm" color="#273240">
              Week {selectedWeek} summary · Window {windowProgress.windowNumber}
            </Heading>
            <Tag colorScheme={progressStatus.color}>
              {progressStatus.label} • {progressStatus.pct}%
            </Tag>
          </HStack>
          <Progress value={progressStatus.pct} colorScheme={progressStatus.color} borderRadius="full" />
          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
            <StatCard
              label="Activities completed"
              value={`${pendingCounts.completed} of ${pendingCounts.total}`}
              icon={<Icon as={CheckCircle} color="success.400" />}
            />
            <StatCard
              label="Weekly points"
              value={`${weeklyPointsEarned} / ${weeklyTarget}`}
              icon={<Icon as={Plus} color="accent.warning" />}
            />
            <StatCard
              label={`Window ${windowProgress.windowNumber} points`}
              value={`${windowProgress.earned} / ${windowProgress.target}`}
              icon={<Icon as={CalendarRange} color="purple.400" />}
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
      {renderJourneyHeader()}
      {renderWeekSummary()}
      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                  {activities.length ? getVisibleActivities(activities).map(renderActivityCard) : (
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
                    {weeklyPointsEarned} / {weeklyTarget} points earned
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
