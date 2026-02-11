import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import { useAuth } from '@/hooks/useAuth'
import { isFreeUser } from '@/utils/membership'
import { useSearchParams } from 'react-router-dom'
import {
  JOURNEY_META,
  getActivitiesForJourney,
  resolveCanonicalActivityId,
  type ActivityDef,
  type JourneyType,
} from '@/config/pointsConfig'
import { resolveJourneyType } from '@/utils/journeyType'
import { calculateActivityAvailability } from '@/utils/activityStateManager'
import { db } from '@/services/firebase'
import {
  addDoc,
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

export type ActivityStatus = 'not_started' | 'pending' | 'rejected' | 'completed'

export interface ActivityState extends ActivityDef {
  status: ActivityStatus
  availability: ReturnType<typeof calculateActivityAvailability>
  proofUrl?: string
  notes?: string
  rejectionReason?: string | null
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
  rejectionReason?: string | null
}

type LedgerRow = {
  activityId?: string
  weekNumber?: number
  monthNumber?: number
}

function isAdminProfile(profile: { role?: string; userRole?: string } | null | undefined): boolean {
  const normalized = normalizeRole(profile?.role || profile?.userRole)
  return normalized === 'super_admin' || normalized === 'partner'
}

export function useWeeklyChecklistViewModel() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

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
    rejectionReason: null,
  })

  const deepLink = useMemo(() => {
    const weekRaw = searchParams.get('week')
    const weekNum = weekRaw ? Number.parseInt(weekRaw, 10) : NaN
    const week = Number.isFinite(weekNum) && weekNum > 0 ? weekNum : null
    const rawActivityId = searchParams.get('activityId') || searchParams.get('activity') || null
    const activityId = resolveCanonicalActivityId(rawActivityId) ?? rawActivityId
    const openProof = ['1', 'true', 'yes'].includes((searchParams.get('openProof') || '').toLowerCase())
    return { week, activityId, openProof }
  }, [searchParams])

  const handledDeepLinkRef = useRef<string | null>(null)

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
            rejectionReason: a.rejectionReason,
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

        const desiredWeek = deepLink.week
          ? Math.min(Math.max(1, deepLink.week), meta.weeks)
          : (profile.currentWeek || 1)
        setSelectedWeek(desiredWeek)
      } catch (e) {
        console.error(e)
        setError('Unable to load journey configuration.')
      }
    }

    resolve()
  }, [user, profile, deepLink.week])

  useEffect(() => {
    if (!journey) return
    if (!deepLink.week) return
    const desiredWeek = Math.min(Math.max(1, deepLink.week), journey.programDurationWeeks)
    if (desiredWeek !== selectedWeek) setSelectedWeek(desiredWeek)
  }, [deepLink.week, journey, selectedWeek])

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
    const globalQ = query(
      collection(db, 'pointsLedger'),
      where('uid', '==', user.uid),
    )

    // Window and Global counts remain one-time for efficiency
    const loadStaticCounts = async () => {
      try {
        const [windowSnap, globalSnap] = await Promise.all([
          getDocs(windowQ),
          getDocs(globalQ)
        ])

        const windowCounts: Record<string, number> = {}
        const lastCompletedWeekByActivity: Record<string, number> = {}
        windowSnap.docs.forEach(d => {
          const row = d.data() as LedgerRow
          if (!row.activityId) return
          const activityId = resolveCanonicalActivityId(row.activityId) ?? row.activityId
          windowCounts[activityId] = (windowCounts[activityId] ?? 0) + 1
          const wk = Number(row.weekNumber ?? 0)
          if (wk > 0) {
            lastCompletedWeekByActivity[activityId] = Math.max(
              lastCompletedWeekByActivity[activityId] ?? 0,
              wk,
            )
          }
        })

        const totalCompletedAllTime: Record<string, number> = {}
        globalSnap.docs.forEach(d => {
          const row = d.data() as LedgerRow
          if (!row.activityId) return
          const activityId = resolveCanonicalActivityId(row.activityId) ?? row.activityId
          totalCompletedAllTime[activityId] = (totalCompletedAllTime[activityId] ?? 0) + 1
        })

        setLedgerCache(prev => ({
          ...prev,
          windowCounts,
          totalCompletedAllTime,
          lastCompletedWeekByActivity,
        }))
      } catch (e) {
        console.error('[ledgerCache] static load failed', e)
      }
    }

    const unsubWeek = onSnapshot(weekQ, snap => {
      const weekCompleted = new Set<string>()
      const weekCounts: Record<string, number> = {}
      snap.docs.forEach(d => {
        const row = d.data() as LedgerRow
        if (!row.activityId) return
        const activityId = resolveCanonicalActivityId(row.activityId) ?? row.activityId
        weekCompleted.add(activityId)
        weekCounts[activityId] = (weekCounts[activityId] ?? 0) + 1
      })
      setLedgerCache(prev => ({
        ...prev,
        weekCompleted,
        weekCounts,
      }))
    }, (e) => console.error('[ledgerCache] week listener failed', e))

    loadStaticCounts()

    return () => {
      unsubWeek()
    }
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
    return onSnapshot(ref, snap => {
      setWeeklyProgress(snap.exists() ? (snap.data() as WeeklyProgress) : null)
    })
  }, [user, selectedWeek])

  /* ------------------------------------------------------------------ */
  /* Sync approval requests -> checklist (fallback for legacy records)    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!user) return

    const toMillis = (value: unknown): number => {
      if (!value) return 0
      if (
        typeof value === 'object' &&
        value !== null &&
        'toMillis' in value &&
        typeof (value as { toMillis?: () => number }).toMillis === 'function'
      ) {
        return (value as { toMillis: () => number }).toMillis()
      }
      if (
        typeof value === 'object' &&
        value !== null &&
        'toDate' in value &&
        typeof (value as { toDate?: () => Date }).toDate === 'function'
      ) {
        return (value as { toDate: () => Date }).toDate().getTime()
      }
      const parsed = new Date(String(value)).getTime()
      return Number.isFinite(parsed) ? parsed : 0
    }

    const sync = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'points_verification_requests'),
            where('user_id', '==', user.uid),
            where('week', '==', selectedWeek),
          ),
        )

        const latestByActivity = new Map<string, PointsVerificationRequest>()
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() as PointsVerificationRequest
          if (!data?.activity_id) return
          const row: PointsVerificationRequest = { ...data, id: docSnap.id }
          const activityId = resolveCanonicalActivityId(row.activity_id) ?? row.activity_id
          const prev = latestByActivity.get(activityId)
          if (!prev) {
            latestByActivity.set(activityId, row)
            return
          }
          if (toMillis(row.created_at) >= toMillis(prev.created_at)) {
            latestByActivity.set(activityId, row)
          }
        })

        setActivities((prev) => {
          let changed = false
          const next = prev.map((activity) => {
            if (activity.status === 'completed') return activity

            const req = latestByActivity.get(activity.id)
            if (!req) return activity

            if (req.status === 'pending') {
              const patch: Partial<ActivityState> = {
                status: 'pending',
                hasInteracted: true,
                proofUrl: req.proof_url,
                notes: req.notes,
                rejectionReason: null,
              }
              const differs =
                patch.status !== activity.status ||
                patch.hasInteracted !== activity.hasInteracted ||
                patch.proofUrl !== activity.proofUrl ||
                patch.notes !== activity.notes ||
                patch.rejectionReason !== activity.rejectionReason
              if (!differs) return activity
              changed = true
              return { ...activity, ...patch }
            }

            if (req.status === 'rejected') {
              const patch: Partial<ActivityState> = {
                status: 'rejected',
                hasInteracted: false,
                proofUrl: req.proof_url,
                notes: req.notes,
                rejectionReason: req.rejection_reason ?? null,
              }
              const differs =
                patch.status !== activity.status ||
                patch.hasInteracted !== activity.hasInteracted ||
                patch.proofUrl !== activity.proofUrl ||
                patch.notes !== activity.notes ||
                patch.rejectionReason !== activity.rejectionReason
              if (!differs) return activity
              changed = true
              return { ...activity, ...patch }
            }

            if (req.status === 'approved') {
              const patch: Partial<ActivityState> = {
                status: 'completed',
                hasInteracted: true,
                proofUrl: req.proof_url,
                notes: req.notes,
                rejectionReason: null,
              }
              const differs =
                patch.status !== activity.status ||
                patch.hasInteracted !== activity.hasInteracted ||
                patch.proofUrl !== activity.proofUrl ||
                patch.notes !== activity.notes ||
                patch.rejectionReason !== activity.rejectionReason
              if (!differs) return activity
              changed = true
              return { ...activity, ...patch }
            }

            return activity
          })

          if (changed) void persistChecklist(next)
          return next
        })
      } catch (error) {
        console.warn('[WeeklyChecklist] Request sync failed; continuing without it', error)
      }
    }

    sync()
  }, [persistChecklist, selectedWeek, user])

  /* ------------------------------------------------------------------ */
  /* Real-time Checklist Status Update                                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'checklists', `${user.uid}_${selectedWeek}`);
    return onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data() as { activities?: Array<Partial<ActivityState> & { id: string }> };
        if (Array.isArray(data.activities)) {
          setActivities(prev => {
            return prev.map(activity => {
              const remote = data.activities?.find((a) => a.id === activity.id);
              if (!remote) return activity

              const next = {
                status: remote.status ?? activity.status,
                hasInteracted: remote.hasInteracted ?? activity.hasInteracted,
                proofUrl: remote.proofUrl ?? activity.proofUrl,
                notes: remote.notes ?? activity.notes,
                rejectionReason: remote.rejectionReason ?? activity.rejectionReason,
              }

              const changed =
                next.status !== activity.status ||
                next.hasInteracted !== activity.hasInteracted ||
                next.proofUrl !== activity.proofUrl ||
                next.notes !== activity.notes ||
                next.rejectionReason !== activity.rejectionReason

              if (changed) {
                return {
                  ...activity,
                  ...next,
                };
              }
              return activity;
            });
          });
        }
      }
    });
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
    return onSnapshot(q, snap => {
      setAllWeeksProgress(snap.docs.map(d => d.data() as WeeklyProgress))
    })
  }, [user, journey])

  /* ------------------------------------------------------------------ */
  /* Derived selectors                                                    */
  /* ------------------------------------------------------------------ */
  const completedCount = useMemo(
    () => activities.filter(a => a.status === 'completed').length,
    [activities],
  )

  const earnedPoints = useMemo(
    () => weeklyProgress?.pointsEarned ?? 0,
    [weeklyProgress],
  )

  /* ------------------------------------------------------------------ */
  /* Admin-safe override policy                                           */
  /* ------------------------------------------------------------------ */
  const canMutateActivity = useCallback(
    (activity: ActivityState) => {
      if (isAdmin) return true
      if (!journey) return false
      if (isWeekLocked) return false
      if (activity.hasInteracted && activity.status !== 'rejected') return false
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
      rejectionReason: activity.rejectionReason ?? null,
    })
  }, [])

  useEffect(() => {
    if (!journey) return
    if (!deepLink.openProof || !deepLink.activityId) return

    const key = `${deepLink.week ?? selectedWeek}:${deepLink.activityId}`
    if (handledDeepLinkRef.current === key) return

    if (deepLink.week && deepLink.week !== selectedWeek) return

    const activity = activities.find((a) => a.id === deepLink.activityId)
    if (!activity) return

    const anchor = document.getElementById(`activity-${activity.id}`)
    anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    openProofModal(activity)
    handledDeepLinkRef.current = key

    const next = new URLSearchParams(searchParams)
    next.delete('openProof')
    setSearchParams(next, { replace: true })
  }, [
    activities,
    deepLink.activityId,
    deepLink.openProof,
    deepLink.week,
    journey,
    openProofModal,
    searchParams,
    selectedWeek,
    setSearchParams,
  ])

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
          await setActivityStatusLocal(activity.id, { status, hasInteracted: true, rejectionReason: null })
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
          rejectionReason: null,
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
    setProofModal({ isOpen: false, proofUrl: '', notes: '', rejectionReason: null })
  }, [])

  const updateProofModal = useCallback((patch: Partial<ProofModalState>) => {
    setProofModal(prev => ({ ...prev, ...patch }))
  }, [])

  const userOrganizationId = useMemo(
    () => profile?.organizationId || profile?.companyId || null,
    [profile?.companyId, profile?.organizationId],
  )

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
      if (activity.availability.state !== 'available' && activity.status !== 'rejected') {
        toast({ title: 'Activity unavailable', description: 'This activity is locked right now.', status: 'warning' })
        return
      }
      if (activity.hasInteracted && activity.status !== 'rejected') {
        toast({ title: 'Selection locked', description: 'Contact support to make changes.', status: 'warning' })
        return
      }
    }

    if (!proofModal.proofUrl?.trim()) {
      toast({ title: 'Proof required', description: 'Please provide a link before submitting.', status: 'warning' })
      return
    }

    try {
      // Prevent duplicate pending requests for the same activity/week (can happen if local checklist state got out of sync).
      try {
        const existingWeekRequests = await getDocs(
          query(
            collection(db, 'points_verification_requests'),
            where('user_id', '==', user.uid),
            where('week', '==', selectedWeek),
          ),
        )
        const hasPending = existingWeekRequests.docs.some((docSnap) => {
          const data = docSnap.data() as PointsVerificationRequest
          const requestActivityId = resolveCanonicalActivityId(data.activity_id) ?? data.activity_id
          return requestActivityId === activity.id && (data.status ?? 'pending') === 'pending'
        })
        if (hasPending) {
          toast({
            title: 'Already submitted',
            description: 'This activity is already pending verification for this week.',
            status: 'info',
            duration: 5000,
          })
          await setActivityStatusLocal(activity.id, {
            status: 'pending',
            hasInteracted: true,
          })
          closeProofModal()
          return
        }
      } catch (error) {
        console.warn('[WeeklyChecklist] Duplicate-check query failed; continuing submission', error)
      }

      const sourcePayload: PointsVerificationRequest = {
        id: '', // ID will be assigned by the server or is not used for creation
        user_id: user.uid,
        organizationId: userOrganizationId,
        week: selectedWeek,
        activity_id: activity.id,
        activity_title: activity.title,
        points: activity.points,
        proof_url: proofModal.proofUrl.trim(),
        notes: proofModal.notes?.trim(),
        status: 'pending',
        created_at: serverTimestamp(),
      }

      // Write to points_verification_requests collection (primary collection for dashboards)
      const verificationRequestRef = await addDoc(
        collection(db, 'points_verification_requests'),
        removeUndefinedFields({
          user_id: user.uid,
          organizationId: userOrganizationId,
          week: selectedWeek,
          activity_id: activity.id,
          activity_title: activity.title,
          points: activity.points,
          proof_url: proofModal.proofUrl.trim(),
          notes: proofModal.notes?.trim(),
          status: 'pending',
          created_at: serverTimestamp(),
        })
      )

      // Also write to approvals collection for backward compatibility
      await createApprovalRequest({
        userId: user.uid,
        organizationId: userOrganizationId,
        type: 'points_verification',
        approvalType: activity.approvalType,
        title: activity.title,
        source: { ...sourcePayload, id: verificationRequestRef.id },
        summary: proofModal.notes?.trim(),
        points: activity.points,
      })

      await setActivityStatusLocal(activity.id, {
        status: 'pending',
        proofUrl: proofModal.proofUrl.trim(),
        notes: proofModal.notes?.trim(),
        rejectionReason: null,
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
    userOrganizationId,
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
