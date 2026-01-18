import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { isFreeUser } from '@/utils/membership'
import {
  JOURNEY_META,
  getActivitiesForJourney,
  type ActivityDef,
  type JourneyType,
} from '@/config/pointsConfig'
import { resolveJourneyType } from '@/utils/journeyType'
import { calculateActivityAvailability } from '@/utils/activityStateManager'
import { db } from '@/services/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import type { WeeklyProgress } from '@/types'
import { removeUndefinedFields } from '@/utils/firestore'
import { normalizeRole } from '@/utils/role'
import { getWindowNumber } from '@/utils/windowCalculations'
import { revokeChecklistPoints } from '@/services/pointsService'
import { createApprovalRequest } from '@/services/approvalsService'
import { handleActivityCompletion } from '@/utils/activityRouter'
import type { PointsVerificationRequest } from '@/services/pointsVerificationService'

export type ActivityStatus = 'not_started' | 'pending' | 'completed'

export interface ActivityState extends ActivityDef {
  status: ActivityStatus
  availability: ReturnType<typeof calculateActivityAvailability>
  proofUrl?: string
  notes?: string
  hasInteracted?: boolean
}

export interface JourneyConfig {
  journeyType: JourneyType
  currentWeek: number
  programDurationWeeks: number
  isPaid: boolean
}

export interface ProofModalState {
  isOpen: boolean
  activityId?: string
  proofUrl: string
  notes: string
}

type LedgerRow = {
  activityId?: string
  weekNumber?: number
  monthNumber?: number
}

function isAdminProfile(profile: any): boolean {
  const normalized = normalizeRole(profile?.role || profile?.userRole)
  return normalized === 'super_admin' || normalized === 'partner'
}

export function useWeeklyChecklistViewModel() {
  const { user, profile } = useAuth()
  const toast = useToast()

  const [journey, setJourney] = useState<JourneyConfig | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)

  const [activities, setActivities] = useState<ActivityState[]>([])
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress | null>(null)
  const [allWeeksProgress, setAllWeeksProgress] = useState<WeeklyProgress[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [proofModal, setProofModal] = useState<ProofModalState>({
    isOpen: false,
    proofUrl: '',
    notes: '',
  })

  /* ------------------------------------------------------------------ */
  /* Derived guards                                                      */
  /* ------------------------------------------------------------------ */
  const isAdmin = useMemo(() => isAdminProfile(profile), [profile])

  const isWeekLocked = useMemo(() => {
    if (!journey) return false
    return selectedWeek > (journey.currentWeek ?? 1)
  }, [journey, selectedWeek])

  const weeklyTarget = useMemo(() => {
    return journey ? JOURNEY_META[journey.journeyType].weeklyTarget : 0
  }, [journey])

  /* ------------------------------------------------------------------ */
  /* Persist checklist state                                              */
  /* ------------------------------------------------------------------ */
  const persistChecklist = useCallback(
    async (updated: ActivityState[]) => {
      if (!user) return
      const checklistState = removeUndefinedFields({
        activities: updated.map(a =>
          removeUndefinedFields({
            id: a.id,
            status: a.status,
            proofUrl: a.proofUrl,
            notes: a.notes,
            hasInteracted: a.hasInteracted,
          }),
        ),
        updatedAt: serverTimestamp(),
      })

      try {
        await setDoc(doc(db, 'checklists', `${user.uid}_${selectedWeek}`), checklistState, { merge: true })
      } catch (e) {
        console.error(e)
        toast({
          title: 'Sync Error',
          description: 'Could not save your checklist progress.',
          status: 'error',
        })
      }
    },
    [selectedWeek, toast, user],
  )

  /* ------------------------------------------------------------------ */
  /* Resolve journey                                                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!user || !profile) return

    const resolve = async () => {
      try {
        let journeyType: JourneyType = '6W'

        if (isFreeUser(profile) && !profile.companyId) {
          journeyType = '4W'
        } else if (profile.companyId) {
          const orgSnap = await getDoc(doc(db, 'organizations', profile.companyId))
          if (orgSnap.exists()) {
            journeyType = (resolveJourneyType(orgSnap.data()) as JourneyType) || '6W'
          }
        } else if (profile.journeyType) {
          journeyType = profile.journeyType as JourneyType
        }

        const meta = JOURNEY_META[journeyType]

        setJourney({
          journeyType,
          currentWeek: profile.currentWeek || 1,
          programDurationWeeks: meta.weeks,
          isPaid: !isFreeUser(profile),
        })

        setSelectedWeek(profile.currentWeek || 1)
      } catch (e) {
        console.error(e)
        setError('Unable to load journey configuration.')
      }
    }

    resolve()
  }, [user, profile])

  /* ------------------------------------------------------------------ */
  /* Ledger snapshot (availability caching source-of-truth)               */
  /* ------------------------------------------------------------------ */
  const [ledgerCache, setLedgerCache] = useState<{
    weekCompleted: Set<string>
    weekCounts: Record<string, number>
    windowCounts: Record<string, number>
    totalCompletedAllTime: Record<string, number>
    lastCompletedWeekByActivity: Record<string, number>
  }>({
    weekCompleted: new Set(),
    weekCounts: {},
    windowCounts: {},
    totalCompletedAllTime: {},
    lastCompletedWeekByActivity: {},
  })

  useEffect(() => {
    if (!user) return

    const load = async () => {
      try {
        const windowNumber = getWindowNumber(selectedWeek)

        const weekQ = query(
          collection(db, 'pointsLedger'),
          where('uid', '==', user.uid),
          where('weekNumber', '==', selectedWeek),
        )
        const windowQ = query(
          collection(db, 'pointsLedger'),
          where('uid', '==', user.uid),
          where('monthNumber', '==', windowNumber),
        )
        // Global query for all-time counts
        const globalQ = query(
          collection(db, 'pointsLedger'),
          where('uid', '==', user.uid),
        )

        const [weekSnap, windowSnap, globalSnap] = await Promise.all([
          getDocs(weekQ),
          getDocs(windowQ),
          getDocs(globalQ)
        ])

        const weekCompleted = new Set<string>()
        const weekCounts: Record<string, number> = {}
        weekSnap.docs.forEach(d => {
          const row = d.data() as LedgerRow
          if (!row.activityId) return
          weekCompleted.add(row.activityId)
          weekCounts[row.activityId] = (weekCounts[row.activityId] ?? 0) + 1
        })

        const windowCounts: Record<string, number> = {}
        const lastCompletedWeekByActivity: Record<string, number> = {}
        windowSnap.docs.forEach(d => {
          const row = d.data() as LedgerRow
          if (!row.activityId) return
          windowCounts[row.activityId] = (windowCounts[row.activityId] ?? 0) + 1
          const wk = Number(row.weekNumber ?? 0)
          if (wk > 0) {
            lastCompletedWeekByActivity[row.activityId] = Math.max(
              lastCompletedWeekByActivity[row.activityId] ?? 0,
              wk,
            )
          }
        })

        const totalCompletedAllTime: Record<string, number> = {}
        globalSnap.docs.forEach(d => {
          const row = d.data() as LedgerRow
          if (!row.activityId) return
          totalCompletedAllTime[row.activityId] = (totalCompletedAllTime[row.activityId] ?? 0) + 1
        })

        setLedgerCache({
          weekCompleted,
          weekCounts,
          windowCounts,
          totalCompletedAllTime,
          lastCompletedWeekByActivity,
        })
      } catch (e) {
        console.error(e)
        // don’t hard-fail UI; availability will still compute with empty counts
      }
    }

    load()
  }, [selectedWeek, user])

  /* ------------------------------------------------------------------ */
  /* Build activity state (fast, cached)                                  */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!journey || !user) return

    const defs = getActivitiesForJourney(journey.journeyType)

    const hasMentor = Boolean(profile?.mentorId || profile?.mentorOverrideId)
    const hasAmbassador = Boolean(profile?.ambassadorId || profile?.ambassadorOverrideId)

    const windowWeek = selectedWeek // your availability util expects windowWeek; adapt if you use getWindowWeekNumber

    const next: ActivityState[] = defs.map((def: ActivityDef) => ({
      ...def,
      status: ledgerCache.weekCompleted.has(def.id) ? 'completed' : 'not_started',
      availability: calculateActivityAvailability(def, {
        windowWeek,
        weekCount: ledgerCache.weekCounts[def.id] ?? 0,
        windowCount: ledgerCache.windowCounts[def.id] ?? 0,
        totalCompletedAllTime: ledgerCache.totalCompletedAllTime[def.id] ?? 0,
        lastCompletedWeek: ledgerCache.lastCompletedWeekByActivity[def.id],
        hasMentor,
        hasAmbassador,
      }),
    }))

    setActivities(next)
    setLoading(false)
  }, [journey, ledgerCache, profile, selectedWeek, user])

  /* ------------------------------------------------------------------ */
  /* Weekly progress (realtime)                                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'weeklyProgress', `${user.uid}__${selectedWeek}`)
    return onSnapshot(
      ref,
      snap => {
        setWeeklyProgress(snap.exists() ? (snap.data() as WeeklyProgress) : null)
      },
      (error) => {
        console.error('[useWeeklyChecklistViewModel] Error loading weekly progress:', error)
        setWeeklyProgress(null)
      }
    )
  }, [user, selectedWeek])

  /* ------------------------------------------------------------------ */
  /* Real-time Checklist Status Update                                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'checklists', `${user.uid}_${selectedWeek}`);
    return onSnapshot(
      ref,
      snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.activities) {
            setActivities(prev => {
              return prev.map(activity => {
                const remote = data.activities.find((a: any) => a.id === activity.id);
                if (remote && remote.status !== activity.status) {
                  return {
                    ...activity,
                    status: remote.status,
                    hasInteracted: remote.hasInteracted ?? activity.hasInteracted,
                    proofUrl: remote.proofUrl ?? activity.proofUrl,
                    notes: remote.notes ?? activity.notes
                  };
                }
                return activity;
              });
            });
          }
        }
      },
      (error) => {
        console.error('[useWeeklyChecklistViewModel] Error loading checklist status:', error)
        // Don't update activities on error - keep current state
      }
    );
  }, [user, selectedWeek]);

  /* ------------------------------------------------------------------ */
  /* All weeks progress (realtime)                                        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!user || !journey) return
    const q = query(
      collection(db, 'weeklyProgress'),
      where('uid', '==', user.uid),
      where('weekNumber', '<=', journey.programDurationWeeks),
    )
    return onSnapshot(
      q,
      snap => {
        setAllWeeksProgress(snap.docs.map(d => d.data() as WeeklyProgress))
      },
      (error) => {
        console.error('[useWeeklyChecklistViewModel] Error loading all weeks progress:', error)
        setAllWeeksProgress([])
      }
    )
  }, [user, journey])

  /* ------------------------------------------------------------------ */
  /* Derived selectors                                                    */
  /* ------------------------------------------------------------------ */
  const completedCount = useMemo(
    () => activities.filter(a => a.status === 'completed').length,
    [activities],
  )

  const earnedPoints = useMemo(
    () => activities.reduce((sum, a) => (a.status === 'completed' ? sum + a.points : sum), 0),
    [activities],
  )

  /* ------------------------------------------------------------------ */
  /* Admin-safe override policy                                           */
  /* ------------------------------------------------------------------ */
  const canMutateActivity = useCallback(
    (activity: ActivityState) => {
      if (isAdmin) return true
      if (!journey) return false
      if (isWeekLocked) return false
      if (activity.hasInteracted) return false // your original “selection locked” rule
      if (activity.availability.state !== 'available') return false
      return true
    },
    [isAdmin, isWeekLocked, journey],
  )

  /* ------------------------------------------------------------------ */
  /* Award / revoke points + persist                                      */
  /* ------------------------------------------------------------------ */
  const setActivityStatusLocal = useCallback(
    async (activityId: string, patch: Partial<ActivityState>) => {
      setActivities(prev => {
        const next = prev.map(a => (a.id === activityId ? { ...a, ...patch } : a))
        void persistChecklist(next)
        return next
      })
    },
    [persistChecklist],
  )

  /* ------------------------------------------------------------------ */
  /* Proof modal + approval flow                                          */
  /* ------------------------------------------------------------------ */
  const openProofModal = useCallback((activity: ActivityState) => {
    setProofModal({
      isOpen: true,
      activityId: activity.id,
      proofUrl: activity.proofUrl ?? '',
      notes: activity.notes ?? '',
    })
  }, [])

  const markCompleted = useCallback(
    async (activity: ActivityState | undefined) => {
      if (!user || !journey) return

      if (!activity?.id) {
        console.error('[WeeklyChecklist] markCompleted called with invalid activity', activity)
        toast({
          title: 'Internal error',
          description: 'Invalid activity selected.',
          status: 'error',
        })
        return
      }

      if (!canMutateActivity(activity)) {
        toast({
          title: 'Action not allowed',
          description: isAdmin
            ? 'Override is enabled but this item is currently blocked by policy.'
            : 'This activity is locked or unavailable.',
          status: 'warning',
        })
        return
      }

      await handleActivityCompletion({
        uid: user.uid,
        journeyType: journey.journeyType,
        weekNumber: selectedWeek,
        activity,
        onProofRequired: (act) => openProofModal(act),
        onSuccess: async (status) => {
          await setActivityStatusLocal(activity.id, { status, hasInteracted: true })
        },
        onError: (e) => {
          console.error(e)
          toast({
            title: 'Update Failed',
            description: 'Could not award points. Please try again.',
            status: 'error',
          })
        }
      })
    },
    [canMutateActivity, isAdmin, journey, selectedWeek, setActivityStatusLocal, toast, user, openProofModal],
  )

  const markNotStarted = useCallback(
    async (activity: ActivityState | undefined) => {
      if (!user || !journey) return

      if (!activity?.id) {
        console.error('[WeeklyChecklist] markNotStarted called with invalid activity', activity)
        toast({
          title: 'Internal error',
          description: 'Invalid activity selected.',
          status: 'error',
        })
        return
      }

      // Admin can revoke; non-admin must satisfy normal restrictions too (esp. lock/hasInteracted)
      if (!isAdmin && (!journey || isWeekLocked || activity.hasInteracted)) {
        toast({
          title: 'Selection locked',
          description: 'Contact support to make changes.',
          status: 'warning',
        })
        return
      }

      try {
        await revokeChecklistPoints({
          uid: user.uid,
          journeyType: journey.journeyType,
          weekNumber: selectedWeek,
          activity,
        })

        await setActivityStatusLocal(activity.id, {
          status: 'not_started',
          hasInteracted: true,
          proofUrl: undefined,
          notes: undefined,
        })
      } catch (e) {
        console.error(e)
        toast({
          title: 'Update Failed',
          description: 'Could not revoke points. Please try again.',
          status: 'error',
        })
      }
    },
    [isAdmin, isWeekLocked, journey, selectedWeek, setActivityStatusLocal, toast, user],
  )

  const closeProofModal = useCallback(() => {
    setProofModal({ isOpen: false, proofUrl: '', notes: '' })
  }, [])

  const updateProofModal = useCallback((patch: Partial<ProofModalState>) => {
    setProofModal(prev => ({ ...prev, ...patch }))
  }, [])

  const submitProofForApproval = useCallback(async () => {
    if (!user || !journey) return
    const activity = activities.find(a => a.id === proofModal.activityId)
    if (!activity) return

    // Non-admin must respect availability/lock rules; admin can override submission (but still needs proofUrl).
    if (!isAdmin) {
      if (isWeekLocked) {
        toast({ title: 'Week locked', description: 'You can’t submit proof for a future week.', status: 'warning' })
        return
      }
      if (activity.availability.state !== 'available') {
        toast({ title: 'Activity unavailable', description: 'This activity is locked right now.', status: 'warning' })
        return
      }
      if (activity.hasInteracted) {
        toast({ title: 'Selection locked', description: 'Contact support to make changes.', status: 'warning' })
        return
      }
    }

    if (!proofModal.proofUrl?.trim()) {
      toast({ title: 'Proof required', description: 'Please provide a link before submitting.', status: 'warning' })
      return
    }

    try {
        const sourcePayload: PointsVerificationRequest = {
          id: '', // ID will be assigned by the server or is not used for creation
        user_id: user.uid,
        week: selectedWeek,
        activity_id: activity.id,
        activity_title: activity.title,
        points: activity.points,
        proof_url: proofModal.proofUrl.trim(),
        notes: proofModal.notes?.trim(),
        status: 'pending',
          created_at: serverTimestamp() as any,
      }

      await createApprovalRequest({
        userId: user.uid,
        type: 'points_verification',
        title: activity.title,
          source: sourcePayload,
        summary: proofModal.notes?.trim(),
        points: activity.points,
      })

      await setActivityStatusLocal(activity.id, {
        status: 'pending',
        proofUrl: proofModal.proofUrl.trim(),
        notes: proofModal.notes?.trim(),
        hasInteracted: true,
      })

      toast({
        title: 'Proof submitted',
        description: 'Your proof was sent for verification. Points post after approval.',
        status: 'success',
        duration: 4000,
      })

      closeProofModal()
    } catch (e) {
      console.error(e)
      toast({
        title: 'Submission failed',
        description: 'Could not submit proof. Please try again.',
        status: 'error',
      })
    }
  }, [
    activities,
    closeProofModal,
    isAdmin,
    isWeekLocked,
    journey,
    proofModal.activityId,
    proofModal.notes,
    proofModal.proofUrl,
    selectedWeek,
    setActivityStatusLocal,
    toast,
    user,
  ])

  return {
    // state
    journey,
    selectedWeek,
    setSelectedWeek,
    activities,
    weeklyProgress,
    allWeeksProgress,

    // derived
    weeklyTarget,
    completedCount,
    earnedPoints,
    loading,
    error,
    isAdmin,
    isWeekLocked,

    // actions
    markCompleted,
    markNotStarted,

    // proof modal
    proofModal,
    openProofModal,
    closeProofModal,
    updateProofModal,
    submitProofForApproval,
  }
}
