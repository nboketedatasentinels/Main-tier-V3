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
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Skeleton,
  Stack,
  Tag,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { AlertTriangle, CheckCircle, Plus, ShieldCheck } from 'lucide-react'
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { addDays, format, differenceInDays } from 'date-fns'
import { useLocation } from 'react-router-dom'
import { removeUndefinedFields } from '@/utils/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { createApprovalRequest } from '@/services/approvalsService'
import { PointsVerificationRequest } from '@/services/pointsVerificationService'
import { WeeklyProgress } from '@/types'
import { isFreeUser } from '@/utils/membership'
import {
  JOURNEY_META,
  getActivitiesForJourney,
  resolveCanonicalActivityId,
  type ActivityDef,
  type JourneyType,
} from '@/config/pointsConfig'
import { awardChecklistPoints, revokeChecklistPoints } from '@/services/pointsService'
import { SurfaceCard } from '@/components/primitives/SurfacePrimitives'
import { ORG_COLLECTION } from '@/constants/organizations'
import {
  JOURNEY_LABELS,
  resolveJourneyType,
} from '@/utils/journeyType'
import { getWindowNumber, getWindowRange, getWindowWeekNumber, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'
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

interface WindowProgressData {
  pointsEarned: number;
  windowTarget: number;
  status: 'on_track' | 'warning' | 'alert' | 'recovery';
}


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
    'Publish an ecosystem post summarizing learnings',
  ],
  4: ['Finalize your Impact Log story', 'Close the loop on peer-to-peer actions', 'Submit proof for high-value missions'],
  5: ['Host or lead a meetup', 'Share a public celebration post', 'Review your streaks and keep them alive'],
  6: ['Record your transformation recap', 'Request endorsements from peers', 'Lock in final points to hit 100%'],
}


const statusLabelMap: Record<ActivityStatus, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  completed: 'Completed',
}

const availabilityReasonLabels: Record<ActivityAvailabilityReason, string> = {
  scheduled: 'Scheduled later this window',
  cooldown: 'Cooldown in effect',
  weekly_cooldown: 'Opens again in a few days',
  max_per_week: 'Weekly limit reached',
  max_per_window: 'Cycle limit reached',
  missing_mentor: 'Mentor required',
  missing_ambassador: 'Ambassador required',
  one_time_used: 'Activity already completed',
  window_cap_reached: 'Cycle limit reached',
}

const WeeklyChecklistPage: React.FC = () => {
  const { user, profile } = useAuth()
  const location = useLocation()
  const [journey, setJourney] = useState<JourneyConfig | null>(null)
  const [activities, setActivities] = useState<ActivityState[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [activityLoading, setActivityLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [proofModal, setProofModal] = useState<ProofModalState>({ isOpen: false })

  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress | null>(null)
  const [windowProgressData, setWindowProgressData] = useState<WindowProgressData | null>(null);
  const [allWeeksProgress, setAllWeeksProgress] = useState<WeeklyProgress[]>([])

  const focusTarget = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('focus')
  }, [location.search])

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

  const isParallelWindowTrackingEnabled = import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true';
  const windowSizeWeeks = isParallelWindowTrackingEnabled ? PARALLEL_WINDOW_SIZE_WEEKS : 4;

  const weeklyTarget = useMemo(() => {
    if (!journey) return DEFAULT_WEEKLY_TARGET;
    return JOURNEY_META[journey.journeyType].weeklyTarget;
  }, [journey]);

  const windowMeta = useMemo(() => {
    if (!journey) {
      return {
        windowNumber: 1,
        startWeek: selectedWeek,
        endWeek: selectedWeek,
        windowWeeks: 1,
      };
    }
    return getWindowRange(selectedWeek, journey.programDurationWeeks, windowSizeWeeks);
  }, [journey, selectedWeek, windowSizeWeeks]);

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

      // Dynamically calculate current week from journeyStartDate
      let calculatedCurrentWeek = profile.currentWeek || 1;
      if (profile.journeyStartDate) {
        const startDate = new Date(profile.journeyStartDate);
        if (!isNaN(startDate.getTime())) {
          const daysSinceStart = differenceInDays(new Date(), startDate);
          calculatedCurrentWeek = Math.max(1, Math.min(meta.weeks, Math.floor(daysSinceStart / 7) + 1));
        }
      }

      const journeyConfig: JourneyConfig = {
        journeyType,
        currentWeek: calculatedCurrentWeek,
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
      const windowNumber = getWindowNumber(selectedWeek, windowSizeWeeks);
      const windowWeek = getWindowWeekNumber(selectedWeek, windowSizeWeeks);
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

      const completedActivities = new Set(
        ledgerSnapshot.docs
          .map((d) => d.data().activityId as string | undefined)
          .map((activityId) => (activityId ? resolveCanonicalActivityId(activityId) ?? activityId : null))
          .filter((activityId): activityId is string => Boolean(activityId)),
      );
      const weekActivityCounts = ledgerSnapshot.docs.reduce<Record<string, number>>((acc, docItem) => {
        const rawActivityId = docItem.data().activityId as string | undefined;
        const activityId = rawActivityId ? (resolveCanonicalActivityId(rawActivityId) ?? rawActivityId) : undefined;
        if (!activityId) return acc;
        acc[activityId] = (acc[activityId] ?? 0) + 1;
        return acc;
      }, {});

      const windowActivityCounts = windowLedgerSnapshot.docs.reduce<Record<string, number>>((acc, docItem) => {
        const rawActivityId = docItem.data().activityId as string | undefined;
        const activityId = rawActivityId ? (resolveCanonicalActivityId(rawActivityId) ?? rawActivityId) : undefined;
        if (!activityId) return acc;
        acc[activityId] = (acc[activityId] ?? 0) + 1;
        return acc;
      }, {});

      const totalCompletedAllTime: Record<string, number> = {};
      const lastCompletedTimestamp: Record<string, number> = {};
      globalLedgerSnapshot.docs.forEach(docItem => {
        const data = docItem.data();
        const rawActivityId = data.activityId as string | undefined;
        const activityId = rawActivityId ? (resolveCanonicalActivityId(rawActivityId) ?? rawActivityId) : undefined;
        if (!activityId) return;
        totalCompletedAllTime[activityId] = (totalCompletedAllTime[activityId] ?? 0) + 1;
        const ts = data.createdAt?.toMillis?.() ?? (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
        if (ts > 0) {
          lastCompletedTimestamp[activityId] = Math.max(lastCompletedTimestamp[activityId] ?? 0, ts);
        }
      });

      const lastCompletionWeekByActivity = windowLedgerSnapshot.docs.reduce<Record<string, number>>((acc, docItem) => {
        const rawActivityId = docItem.data().activityId as string | undefined;
        const activityId = rawActivityId ? (resolveCanonicalActivityId(rawActivityId) ?? rawActivityId) : undefined;
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
            lastCompletedTimestamp: lastCompletedTimestamp[def.id],
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
  }, [journey, profile?.ambassadorId, profile?.ambassadorOverrideId, profile?.mentorId, profile?.mentorOverrideId, selectedWeek, user, windowSizeWeeks]);

  useEffect(() => {
    if (!user) return;

    if (isParallelWindowTrackingEnabled) {
      const windowNumber = getWindowNumber(selectedWeek, windowSizeWeeks);
      const progressRef = doc(db, "windowProgress", `${user.uid}__${normalizedJourneyType}__${windowNumber}`);
      const unsubscribe = onSnapshot(progressRef, (snapshot) => {
        if (snapshot.exists()) {
          setWindowProgressData(snapshot.data() as WindowProgressData);
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
  }, [isParallelWindowTrackingEnabled, normalizeWeeklyProgress, normalizedJourneyType, selectedWeek, user, windowSizeWeeks]);

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

  useEffect(() => {
    fetchJourney()
  }, [fetchJourney])

  useEffect(() => {
    fetchWeeklyData()
  }, [fetchWeeklyData])

  const handleActivityUpdate = async (activity: ActivityState, nextStatus: ActivityStatus) => {
    if (!user || !journey) return;
    if (activity.availability.state !== 'available') {
      toast({
        title: 'Opens soon',
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

  const submitProof = async () => {
    if (!proofModal.activity || !user) return
    if (proofModal.activity.availability.state !== 'available') {
      toast({
        title: 'Opens soon',
        description: availabilityReasonLabels[proofModal.activity.availability.reason ?? 'scheduled'],
        status: 'warning',
      })
      return
    }
    try {
      const { activity } = proofModal

      // Get user's organizationId from profile for approval filtering
      const userOrganizationId = profile?.organizationId || profile?.companyId || null

      const sourcePayload: Omit<PointsVerificationRequest, 'id'> = {
        user_id: user.uid,
        organizationId: userOrganizationId,
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
        organizationId: userOrganizationId,
        type: 'points_verification',
        approvalType: activity.approvalType,
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

  const passMarkPoints = useMemo(() => {
    if (!journey) return 0;
    return JOURNEY_META[journey.journeyType].passMarkPoints;
  }, [journey]);

  const journeyUrgency = useMemo(() => {
    if (!journey) return null;
    const totalWeeks = journey.programDurationWeeks;
    const daysSinceStart = journeyStartDate ? differenceInDays(new Date(), journeyStartDate) : 0;
    const elapsedWeeks = Math.min(totalWeeks, Math.max(0, daysSinceStart) / 7);
    const timeProgress = totalWeeks > 0 ? elapsedWeeks / totalWeeks : 0;
    const journeyEnded = timeProgress >= 1;
    const expectedPointsNow = timeProgress * passMarkPoints;
    const paceRatio = expectedPointsNow > 0 ? journeyProgress.totalEarned / expectedPointsNow : 1;
    const deficit = Math.max(0, Math.round(expectedPointsNow - journeyProgress.totalEarned));
    const weeksLeft = Math.max(0, Math.ceil(totalWeeks - elapsedWeeks));
    const pointsNeeded = Math.max(0, passMarkPoints - journeyProgress.totalEarned);
    const weeklyNeeded = weeksLeft > 0 ? Math.ceil(pointsNeeded / weeksLeft) : 0;

    type UrgencyLevel = 'critical' | 'behind' | 'warning' | 'on_track';
    let level: UrgencyLevel = 'on_track';
    if (journeyEnded && journeyProgress.totalEarned < passMarkPoints) {
      level = 'critical';
    } else if (paceRatio < 0.4) {
      level = 'critical';
    } else if (paceRatio < 0.65) {
      level = 'behind';
    } else if (paceRatio < 0.85) {
      level = 'warning';
    }

    return { level, deficit, journeyEnded, pointsNeeded, weeksLeft, weeklyNeeded };
  }, [journey, journeyStartDate, journeyProgress.totalEarned, passMarkPoints]);

  const progressStatus = useMemo(() => {
    let pct = 0;

    if (isParallelWindowTrackingEnabled) {
      if (!windowProgressData) return { color: 'gray', label: 'Loading...', pct: 0 };
      const { pointsEarned, windowTarget } = windowProgressData;
      pct = windowTarget > 0 ? Math.min(100, Math.round((pointsEarned / windowTarget) * 100)) : 0;
    } else {
      if (!weeklyProgress) return { color: 'gray', label: 'Loading...', pct: 0 };
      const { pointsEarned, weeklyTarget: wt } = weeklyProgress;
      pct = wt > 0 ? Math.min(100, Math.round((pointsEarned / wt) * 100)) : 0;
    }

    // Journey-level urgency overrides cycle-level optimism
    if (journeyUrgency?.journeyEnded) {
      return { color: 'red', label: 'Journey ended', pct };
    }
    if (journeyUrgency?.level === 'critical') {
      return { color: 'red', label: 'Behind pace', pct };
    }
    if (journeyUrgency?.level === 'behind') {
      if (pct >= 100) return { color: 'orange', label: 'Catch-up needed', pct };
      return { color: 'orange', label: 'Falling behind', pct };
    }
    if (journeyUrgency?.level === 'warning') {
      if (pct >= 100) return { color: 'green', label: 'On Track', pct };
      return { color: 'yellow', label: 'Needs attention', pct };
    }

    if (pct >= 100) return { color: 'green', label: 'On Track', pct };
    if (pct >= 75) return { color: 'blue', label: 'Almost there', pct };
    return { color: 'teal', label: 'In progress', pct };
  }, [isParallelWindowTrackingEnabled, weeklyProgress, windowProgressData, journeyUrgency]);

  const journeyEndDate = useMemo(() => {
    if (!journeyStartDate || !journey) return null;
    return addDays(journeyStartDate, journey.programDurationWeeks * 7);
  }, [journeyStartDate, journey]);

  const weeksRemaining = useMemo(() => {
    if (!journey) return 0;
    return Math.max(0, journey.programDurationWeeks - journey.currentWeek);
  }, [journey]);

  // 37 days = 5 weeks + 2 days (not Week 6, Day 3)
  const weekDayLabel = useMemo(() => {
    if (!journeyStartDate || !journey) return `Week ${journey?.currentWeek ?? 1}`;
    const daysSinceStart = differenceInDays(new Date(), journeyStartDate);
    const weeks = Math.floor(daysSinceStart / 7);
    const days = daysSinceStart % 7;

    if (daysSinceStart >= journey.programDurationWeeks * 7) {
      return `${journey.programDurationWeeks} weeks`;
    } else if (weeks === 0) {
      return `${days} day${days === 1 ? '' : 's'}`;
    } else if (days === 0) {
      return `${weeks} week${weeks === 1 ? '' : 's'}`;
    } else {
      return `${weeks} week${weeks === 1 ? '' : 's'}, ${days} day${days === 1 ? '' : 's'}`;
    }
  }, [journeyStartDate, journey]);

  const renderJourneyHeader = () => {
    if (!journey) return null;
    const label = JOURNEY_LABELS[journey.journeyType];
    const startLabel = journeyStartDate ? format(journeyStartDate, 'MMM d, yyyy') : null;
    const endLabel = journeyEndDate ? format(journeyEndDate, 'MMM d, yyyy') : null;

    return (
      <SurfaceCard borderColor="border.card">
        <Stack spacing={3}>
          <Flex align="center" justify="space-between" wrap="wrap" gap={4}>
            <HStack spacing={4}>
              <Stack spacing={1}>
                <HStack spacing={2}>
                  <Badge colorScheme="purple" fontSize="sm">{label}</Badge>
                  <Badge colorScheme={journey.isPaid ? 'green' : 'gray'} fontSize="sm">{tierLabel}</Badge>
                </HStack>
                <Text color="text.primary" fontWeight="bold" fontSize="xl">
                  {weekDayLabel} of {journey.programDurationWeeks}
                </Text>
                <Text color="text.muted" fontSize="sm">
                  {weeksRemaining > 0 ? `${weeksRemaining} week${weeksRemaining === 1 ? '' : 's'} remaining` : 'Final week'}
                </Text>
              </Stack>
            </HStack>
            <HStack spacing={6} align="center">
              <Stack spacing={0} align="flex-end">
                <Text color="text.primary" fontWeight="bold" fontSize="2xl">
                  {journeyProgress.pct}%
                </Text>
                <Text color="text.muted" fontSize="sm">
                  {journeyProgress.totalEarned.toLocaleString()} pts earned
                </Text>
              </Stack>
              <Box w="100px">
                <Progress value={journeyProgress.pct} colorScheme="teal" borderRadius="full" size="md" />
              </Box>
            </HStack>
          </Flex>
          {(startLabel || endLabel) && (
            <Flex justify="space-between" wrap="wrap" gap={2}>
              {startLabel && (
                <Text color="text.muted" fontSize="sm">
                  Started: {startLabel}
                </Text>
              )}
              {endLabel && (
                <Text color="text.muted" fontSize="sm">
                  Ends: {endLabel}
                </Text>
              )}
            </Flex>
          )}
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

  useEffect(() => {
    if (focusTarget !== 'pending-approvals' || activityLoading) return
    const firstPendingApproval = activities.find(
      activity => activity.status === 'pending' || (activity.requiresApproval && activity.status !== 'completed')
    )
    const targetId = firstPendingApproval?.id
    const targetEl = targetId ? activityRefs.current[targetId] : null
    if (!targetId || !targetEl) return

    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    targetEl.classList.add('focus-ring')
    const timeoutId = window.setTimeout(() => {
      activityRefs.current[targetId]?.classList.remove('focus-ring')
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
      activityRefs.current[targetId]?.classList.remove('focus-ring')
    }
  }, [activities, activityLoading, focusTarget])

  const getAvailabilityMessage = (activity: ActivityState) => {
    if (activity.availability.state === 'available') return null
    if (activity.availability.reason === 'scheduled') {
      return `Available in week ${activity.week} of this window.`
    }
    if (activity.availability.reason === 'weekly_cooldown' && activity.availability.cooldownUntil) {
      const unlockDate = activity.availability.cooldownUntil
      const daysLeft = Math.max(1, Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      const dateLabel = unlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      return `Opens again on ${dateLabel} (${daysLeft} day${daysLeft === 1 ? '' : 's'}).`
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

    // Frequency info for clear display
    const totalFrequency = activity.activityPolicy?.maxTotal ?? 1
    const maxPoints = activity.points * totalFrequency
    const frequencyLabel = totalFrequency === 1
      ? '1x only'
      : `${totalFrequency}x over journey`

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
                <Badge colorScheme="teal">Cycle limit reached</Badge>
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
          <Stack align="flex-end" spacing={1}>
            <Box bg="green.100" p={2} borderRadius="md" border="2px solid" borderColor="green.500">
              <Text fontWeight="bold" color="green.800" fontSize="lg">
                +{activity.points.toLocaleString()} pts each
              </Text>
              <Text fontWeight="bold" color="blue.600" fontSize="md">
                {frequencyLabel}
              </Text>
              <Text fontWeight="bold" color="purple.600" fontSize="sm">
                MAX: {maxPoints.toLocaleString()} pts total
              </Text>
            </Box>
            {activity.status === 'pending' && (
              <Tooltip label="Pending partner verification. Points will post after approval.">
                <Icon as={AlertTriangle} color="danger.DEFAULT" />
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
                Selection saved for this week. Support can help if you need a change.
              </Text>
            )}
          </Stack>
        )}
      </Box>
    )
  }


  const renderGuidanceCard = () => {
    if (normalizedJourneyType !== '6W') return null
    const currentWeekNum = journey?.currentWeek ?? selectedWeek
    const bullets = weeklyGuidance[currentWeekNum]
    if (!bullets?.length) return null

    return (
      <Box borderWidth="1px" borderColor="accent.purpleBorder" p={4} borderRadius="lg" bg="accent.purpleSubtle">
        <Heading size="sm" color="text.primary" mb={2}>
          Week {currentWeekNum} - Focus Guidance
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
    <Stack spacing={3}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
        <Stack spacing={0}>
          <Heading size="lg" color="text.primary">
            {weekDayLabel} of {journey?.programDurationWeeks ?? 6}
          </Heading>
          <Text color="text.muted" fontSize="sm">
            Cycle {windowProgress.windowNumber}
          </Text>
        </Stack>
        <Tag colorScheme={progressStatus.color} size="lg" px={4} py={2}>
          {progressStatus.label}
        </Tag>
      </Flex>

      {/* Journey urgency banner */}
      {journeyUrgency && journeyUrgency.level !== 'on_track' && (
        <Alert
          status={journeyUrgency.level === 'critical' ? 'error' : 'warning'}
          borderRadius="md"
          variant="left-accent"
        >
          <AlertIcon />
          <Box flex="1">
            <Text fontWeight="semibold" fontSize="sm">
              {journeyUrgency.journeyEnded
                ? 'Your journey has ended'
                : journeyUrgency.level === 'critical'
                  ? 'You are significantly behind'
                  : journeyUrgency.level === 'behind'
                    ? 'You are falling behind pace'
                    : 'You are slightly off pace'}
            </Text>
            <Text fontSize="xs" color="text.secondary">
              {journeyUrgency.journeyEnded
                ? `You earned ${journeyProgress.totalEarned.toLocaleString()} of the ${passMarkPoints.toLocaleString()} points required to pass (${journeyUrgency.pointsNeeded.toLocaleString()} short).`
                : `${journeyUrgency.deficit.toLocaleString()} points behind expected pace.${journeyUrgency.weeksLeft > 0 ? ` You need ~${journeyUrgency.weeklyNeeded.toLocaleString()} pts/week across ${journeyUrgency.weeksLeft} remaining week${journeyUrgency.weeksLeft === 1 ? '' : 's'} to pass.` : ''}`}
            </Text>
          </Box>
        </Alert>
      )}
    </Stack>
  )

  if (!profile && !user) {
    return (
      <Center py={16}>
        <Stack spacing={3} align="center">
          <CircularProgress isIndeterminate color="brand.primary" />
          <Text color="text.secondary">Loading checklist activities...</Text>
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

      {isWeekLocked && (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Stack spacing={1}>
            <AlertTitle>Week {selectedWeek} is Locked</AlertTitle>
            <AlertDescription>
              Complete Week {journey?.currentWeek ?? 1} milestones to unlock this week.
              Week advancement is based on earning target points and completing pending approvals, not calendar time.
            </AlertDescription>
          </Stack>
        </Alert>
      )}

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6} alignItems="start">
        <GridItem>
          <Stack spacing={4}>
            <SurfaceCard borderColor="border.card">
              <Heading size="sm" color="text.primary" mb={3}>
                Current activities
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
                        <Text color="text.secondary">You are caught up for now. New activities appear as each cycle opens.</Text>
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
          </Stack>
        </GridItem>

        <GridItem>
          <SurfaceCard borderColor="border.card">
            <Heading size="sm" color="text.primary" mb={3}>
              Cycle {windowProgress.windowNumber} Progress
            </Heading>
            {activityLoading ? (
              <Skeleton height="100px" />
            ) : (
              <Stack spacing={4}>
                <Stack spacing={2}>
                  <Flex justify="space-between" align="baseline">
                    <Text color={journeyUrgency?.level === 'critical' ? 'red.600' : 'text.primary'} fontWeight="bold" fontSize="2xl">
                      {windowProgress.earned.toLocaleString()}
                    </Text>
                    <Text color="text.muted" fontSize="sm">
                      / {windowProgress.target.toLocaleString()} pts
                    </Text>
                  </Flex>
                  <Progress value={progressStatus.pct} colorScheme={progressStatus.color} borderRadius="full" size="lg" />
                </Stack>
                <Text color="text.secondary" fontSize="sm">
                  {journeyUrgency?.journeyEnded
                    ? 'Your journey has ended. Contact your partner for next steps.'
                    : journeyUrgency?.level === 'critical'
                      ? `You need ${journeyUrgency.pointsNeeded.toLocaleString()} more points to pass. Focus on high-value activities.`
                      : journeyUrgency?.level === 'behind'
                        ? `Aim for ~${journeyUrgency.weeklyNeeded.toLocaleString()} pts/week to get back on track.`
                        : progressStatus.pct >= 100
                          ? 'Target reached! Keep building momentum.'
                          : progressStatus.pct >= 75
                            ? 'Almost there. Close remaining activities.'
                            : 'Complete activities to reach your target.'}
                </Text>

                {/* Journey-level pass progress */}
                {passMarkPoints > 0 && (
                  <Stack spacing={1}>
                    <Flex justify="space-between" fontSize="xs" color="text.muted">
                      <Text>Pass progress</Text>
                      <Text>{Math.min(100, Math.round((journeyProgress.totalEarned / passMarkPoints) * 100))}%</Text>
                    </Flex>
                    <Progress
                      value={Math.min(100, Math.round((journeyProgress.totalEarned / passMarkPoints) * 100))}
                      colorScheme={journeyUrgency?.level === 'critical' ? 'red' : journeyUrgency?.level === 'behind' ? 'orange' : 'teal'}
                      borderRadius="full"
                      size="sm"
                    />
                    <Text fontSize="xs" color="text.muted">
                      {journeyProgress.totalEarned.toLocaleString()} / {passMarkPoints.toLocaleString()} pts to pass
                    </Text>
                  </Stack>
                )}

                {firstIncompleteActivity && (
                  <Button
                    colorScheme={journeyUrgency?.level === 'critical' ? 'red' : journeyUrgency?.level === 'behind' ? 'orange' : 'primary'}
                    size="sm"
                    onClick={scrollToActivity}
                    w="full"
                  >
                    Next: {firstIncompleteActivity.title}
                  </Button>
                )}
              </Stack>
            )}
          </SurfaceCard>
        </GridItem>
      </Grid>

      {renderProofModal()}
    </Stack>
  )
}

export const WeeklyUpdatesPage = WeeklyChecklistPage
export { WeeklyChecklistPage }

