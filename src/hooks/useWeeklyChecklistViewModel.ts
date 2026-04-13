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
  type ActivityId,
  type JourneyType,
} from '@/config/pointsConfig'
import { resolveJourneyType } from '@/utils/journeyType'
import { calculateActivityAvailability } from '@/utils/activityStateManager'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
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
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'
import { revokeChecklistPoints } from '@/services/pointsService'
import { handleActivityCompletion } from '@/utils/activityRouter'
import { triggerHaptic } from '@/utils/haptics'
import type { PointsVerificationRequest } from '@/services/pointsVerificationService'
import {
  PendingRequestExistsError,
  submitPointsVerificationRequestAtomic,
} from '@/services/pointsRequestSubmissionService'
import { resolveLeadershipAvailability, type LeadershipAvailability } from '@/utils/leadershipAvailability'

export type ActivityStatus = 'not_started' | 'pending' | 'rejected' | 'completed'

export interface ActivityQuickActionLink {
  label: string
  href: string
  external?: boolean
}

export interface ActivityState extends ActivityDef {
  status: ActivityStatus
  availability: ReturnType<typeof calculateActivityAvailability>
  freeTierNotice?: string
  issuedByPartner?: boolean
  issuedBy?: string | null
  issuedAt?: string | null
  proofUrl?: string
  notes?: string
  rejectionReason?: string | null
  hasInteracted?: boolean
  quickActionLink?: ActivityQuickActionLink
  /** Number of times this activity has been completed across all time */
  completedCount?: number
}

export interface JourneyConfig {
  journeyType: JourneyType
  currentWeek: number
  programDurationWeeks: number
  isPaid: boolean
  journeyStartDate?: string | null
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

const FREE_TIER_HONOR_NOTICE = 'Free tier uses self-reported honor completion (no proof upload required).'
const FREE_TIER_SUPER_ADMIN_REVIEW_NOTICE =
  'Free tier AI tool submissions are reviewed by super admin.'
const ACTIVITY_QUICK_LINKS: Partial<Record<ActivityId, ActivityQuickActionLink>> = {
  shameless_circle: {
    label: 'Join Shameless Circle',
    href: '/app/shameless-circle',
  },
  book_club: {
    label: 'Join Book Club',
    href: '/app/book-club',
  },
  ai_tool_review: {
    label: 'Submit AI Tool',
    href: 'https://www.t4leader.com/tools',
    external: true,
  },
}

function shouldRequireSuperAdminReviewForFreeUser(activity: ActivityDef, isFreeTierMember: boolean): boolean {
  return isFreeTierMember && activity.id === 'ai_tool_review'
}

function shouldUseHonorSystemForFreeUser(activity: ActivityDef, isFreeTierMember: boolean): boolean {
  if (!isFreeTierMember) return false
  if (shouldRequireSuperAdminReviewForFreeUser(activity, isFreeTierMember)) return false
  return (
    activity.approvalType === 'partner_approved' ||
    activity.approvalType === 'partner_issued' ||
    Boolean(activity.requiresApproval)
  )
}

export function useWeeklyChecklistViewModel() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [journey, setJourney] = useState<JourneyConfig | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)

  const [activities, setActivities] = useState<ActivityState[]>([])
  const activitiesRef = useRef<ActivityState[]>([])
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress | null>(null)
  const [allWeeksProgress, setAllWeeksProgress] = useState<WeeklyProgress[]>([])
  const [leadershipAvailability, setLeadershipAvailability] = useState<LeadershipAvailability>({
    hasMentor: false,
    hasAmbassador: false,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [proofModal, setProofModal] = useState<ProofModalState>({
    isOpen: false,
    proofUrl: '',
    notes: '',
    rejectionReason: null,
  })
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const isSubmittingProofRef = useRef(false)
  const activityMutationsRef = useRef(new Set<string>())
  const [activityMutations, setActivityMutations] = useState<Record<string, boolean>>({})

  const setActivityMutationInFlight = useCallback((activityId: string, inFlight: boolean) => {
    setActivityMutations((prev) => {
      if (inFlight) {
        if (prev[activityId]) return prev
        return { ...prev, [activityId]: true }
      }
      if (!prev[activityId]) return prev
      const next = { ...prev }
      delete next[activityId]
      return next
    })
  }, [])

  const isActivityBusy = useCallback((activityId: string) => Boolean(activityMutations[activityId]), [activityMutations])

  useEffect(() => {
    activitiesRef.current = activities
  }, [activities])

  const deepLink = useMemo(() => {
    const weekRaw = searchParams.get('week')
    const weekNum = weekRaw ? Number.parseInt(weekRaw, 10) : NaN
    const week = Number.isFinite(weekNum) && weekNum > 0 ? weekNum : null
    const rawActivityId = searchParams.get('activityId') || searchParams.get('activity') || null
    const activityId = resolveCanonicalActivityId(rawActivityId) ?? rawActivityId
    const openProof = ['1', 'true', 'yes'].includes((searchParams.get('openProof') || '').toLowerCase())
    const focusPendingApprovals = (searchParams.get('focus') || '').toLowerCase() === 'pending-approvals'
    return { week, activityId, openProof, focusPendingApprovals }
  }, [searchParams])

  const handledDeepLinkRef = useRef<string | null>(null)
  const handledFocusRef = useRef<string | null>(null)

  /* ------------------------------------------------------------------ */
  /* Derived guards                                                      */
  /* ------------------------------------------------------------------ */
  const isAdmin = useMemo(() => isAdminProfile(profile), [profile])
  const isFreeTierMember = useMemo(() => isFreeUser(profile), [profile])

  const isWeekLocked = useMemo(() => {
    if (!journey) return false
    return selectedWeek > (journey.currentWeek ?? 1)
  }, [journey, selectedWeek])

  useEffect(() => {
    if (!profile?.companyId) {
      setLeadershipAvailability(resolveLeadershipAvailability({ profile }))
      return
    }

    const orgRef = doc(db, ORG_COLLECTION, profile.companyId)
    return onSnapshot(
      orgRef,
      (snapshot) => {
        const organizationData = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null
        setLeadershipAvailability(
          resolveLeadershipAvailability({
            organizationData,
            profile,
          }),
        )
      },
      () => {
        setLeadershipAvailability(resolveLeadershipAvailability({ profile }))
      },
    )
  }, [
    profile?.companyId,
    profile?.mentorId,
    profile?.mentorOverrideId,
    profile?.ambassadorId,
    profile?.ambassadorOverrideId,
  ])

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
            issuedByPartner: a.issuedByPartner,
            issuedBy: a.issuedBy,
            issuedAt: a.issuedAt,
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
        let orgCohortStartDate: string | null = null

        if (isFreeUser(profile) && !profile.companyId) {
          journeyType = '4W'
        } else if (profile.companyId) {
          const orgSnap = await getDoc(doc(db, ORG_COLLECTION, profile.companyId))
          if (orgSnap.exists()) {
            const orgData = orgSnap.data()
            journeyType = (resolveJourneyType(orgData) as JourneyType) || '6W'
            const rawStartDate = orgData.cohortStartDate
            if (rawStartDate) {
              if (typeof rawStartDate === 'string') {
                orgCohortStartDate = rawStartDate
              } else if (rawStartDate.toDate) {
                orgCohortStartDate = rawStartDate.toDate().toISOString()
              }
            }
          }
        } else if (profile.journeyType) {
          journeyType = profile.journeyType as JourneyType
        }

        const meta = JOURNEY_META[journeyType]
        const journeyStartDate = orgCohortStartDate || profile.journeyStartDate || null

        setJourney({
          journeyType,
          currentWeek: profile.currentWeek || 1,
          programDurationWeeks: meta.weeks,
          isPaid: !isFreeUser(profile),
          journeyStartDate,
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
  const [ledgerLoaded, setLedgerLoaded] = useState(false)

  useEffect(() => {
    if (!user) return

    const windowNumber = getWindowNumber(selectedWeek, PARALLEL_WINDOW_SIZE_WEEKS)

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

    // Reset ledgerLoaded when week changes
    setLedgerLoaded(false)

    // Real-time listener for current week completions
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
      setLedgerLoaded(true)
    }, (e) => console.error('[ledgerCache] week listener failed', e))

    // Real-time listener for window counts (cycle-based)
    const unsubWindow = onSnapshot(windowQ, snap => {
      const windowCounts: Record<string, number> = {}
      const lastCompletedWeekByActivity: Record<string, number> = {}
      snap.docs.forEach(d => {
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
      setLedgerCache(prev => ({
        ...prev,
        windowCounts,
        lastCompletedWeekByActivity,
      }))
    }, (e) => console.error('[ledgerCache] window listener failed', e))

    // Real-time listener for ALL-TIME completions (persisted data - critical for frequency display)
    const unsubGlobal = onSnapshot(globalQ, snap => {
      const totalCompletedAllTime: Record<string, number> = {}
      snap.docs.forEach(d => {
        const row = d.data() as LedgerRow
        if (!row.activityId) return
        const activityId = resolveCanonicalActivityId(row.activityId) ?? row.activityId
        totalCompletedAllTime[activityId] = (totalCompletedAllTime[activityId] ?? 0) + 1
      })
      setLedgerCache(prev => ({
        ...prev,
        totalCompletedAllTime,
      }))
    }, (e) => console.error('[ledgerCache] global listener failed', e))

    return () => {
      unsubWeek()
      unsubWindow()
      unsubGlobal()
    }
  }, [selectedWeek, user])

  /* ------------------------------------------------------------------ */
  /* Build activity state (fast, cached)                                  */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!journey || !user) return

    const defs = getActivitiesForJourney(journey.journeyType)

    const { hasMentor, hasAmbassador } = leadershipAvailability
    const previousById = new Map(activitiesRef.current.map((activity) => [activity.id, activity]))

    const windowWeek = selectedWeek // Availability currently uses the selected journey week.

    const next: ActivityState[] = defs.map((def: ActivityDef) => {
      const previous = previousById.get(def.id)
      const honorSystemForFreeUser = shouldUseHonorSystemForFreeUser(def, isFreeTierMember)
      const effectiveDef: ActivityDef = honorSystemForFreeUser
        ? {
            ...def,
            approvalType: 'self',
            requiresApproval: false,
            verification: 'honor',
          }
        : def

      const availability = calculateActivityAvailability(effectiveDef, {
        windowWeek,
        weekCount: ledgerCache.weekCounts[def.id] ?? 0,
        windowCount: ledgerCache.windowCounts[def.id] ?? 0,
        totalCompletedAllTime: ledgerCache.totalCompletedAllTime[def.id] ?? 0,
        lastCompletedWeek: ledgerCache.lastCompletedWeekByActivity[def.id],
        hasMentor,
        hasAmbassador,
      })

      // One-time activities exhausted in prior windows should present as completed.
      const status: ActivityStatus =
        ledgerCache.weekCompleted.has(def.id) || availability.state === 'permanently_exhausted'
          ? 'completed'
          : 'not_started'

      return {
        ...effectiveDef,
        status,
        availability,
        quickActionLink: ACTIVITY_QUICK_LINKS[def.id as ActivityId],
        issuedByPartner:
          previous?.issuedByPartner ??
          (effectiveDef.approvalType === 'partner_issued' ? false : undefined),
        issuedBy: previous?.issuedBy ?? undefined,
        issuedAt: previous?.issuedAt ?? undefined,
        freeTierNotice: shouldRequireSuperAdminReviewForFreeUser(def, isFreeTierMember)
          ? FREE_TIER_SUPER_ADMIN_REVIEW_NOTICE
          : honorSystemForFreeUser
            ? FREE_TIER_HONOR_NOTICE
            : undefined,
        completedCount: ledgerCache.totalCompletedAllTime[def.id] ?? 0,
      }
    })

    setActivities(next)
    // Only stop loading once ledger data has been loaded from Firestore
    if (ledgerLoaded) {
      setLoading(false)
    }
  }, [isFreeTierMember, journey, ledgerCache, ledgerLoaded, leadershipAvailability, selectedWeek, user])

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

        const prev = activitiesRef.current
        let changed = false
        const next = prev.map((activity) => {
          if (activity.status === 'completed') return activity
          const requiresPartnerApprovalNow =
            activity.approvalType === 'partner_approved' || Boolean(activity.requiresApproval)
          if (!requiresPartnerApprovalNow) return activity

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

        activitiesRef.current = next
        setActivities(next)
        if (changed) void persistChecklist(next)
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
                status:
                  activity.availability.state === 'permanently_exhausted'
                    ? 'completed'
                    : (remote.status ?? activity.status),
                hasInteracted: remote.hasInteracted ?? activity.hasInteracted,
                issuedByPartner: remote.issuedByPartner ?? activity.issuedByPartner,
                issuedBy: remote.issuedBy ?? activity.issuedBy,
                issuedAt: remote.issuedAt ?? activity.issuedAt,
                proofUrl: remote.proofUrl ?? activity.proofUrl,
                notes: remote.notes ?? activity.notes,
                rejectionReason: remote.rejectionReason ?? activity.rejectionReason,
              }

              const changed =
                next.status !== activity.status ||
                next.hasInteracted !== activity.hasInteracted ||
                next.issuedByPartner !== activity.issuedByPartner ||
                next.issuedBy !== activity.issuedBy ||
                next.issuedAt !== activity.issuedAt ||
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

  const currentCycleNumber = useMemo(
    () => getWindowNumber(selectedWeek, PARALLEL_WINDOW_SIZE_WEEKS),
    [selectedWeek],
  )

  const cyclePoints = useMemo(
    () =>
      allWeeksProgress
        .filter((week) => (week.monthNumber ?? getWindowNumber(week.weekNumber, PARALLEL_WINDOW_SIZE_WEEKS)) === currentCycleNumber)
        .reduce((sum, week) => sum + (week.pointsEarned ?? 0), 0),
    [allWeeksProgress, currentCycleNumber],
  )

  const cycleTarget = useMemo(() => {
    return journey ? JOURNEY_META[journey.journeyType].windowTarget : 0
  }, [journey])

  const accumulatedPoints = useMemo(
    () => allWeeksProgress.reduce((sum, week) => sum + (week.pointsEarned ?? 0), 0),
    [allWeeksProgress],
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
      if (activity.approvalType === 'partner_issued' && !activity.issuedByPartner) return false
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
      const next = activitiesRef.current.map(a => (a.id === activityId ? { ...a, ...patch } : a))
      activitiesRef.current = next
      setActivities(next)
      await persistChecklist(next)
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
    const requiresPartnerApproval =
      activity.approvalType === 'partner_approved' || Boolean(activity.requiresApproval)

    const anchor = document.getElementById(`activity-${activity.id}`)
    anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    if (requiresPartnerApproval && activity.id !== 'ai_tool_review') {
      openProofModal(activity)
    }
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

  useEffect(() => {
    if (!deepLink.focusPendingApprovals) return
    if (deepLink.week && deepLink.week !== selectedWeek) return
    if (!activities.length) return

    const key = `${deepLink.week ?? selectedWeek}:pending-approvals`
    if (handledFocusRef.current === key) return

    const firstPendingApproval = activities.find(
      (activity) =>
        activity.status === 'pending' ||
        ((activity.approvalType === 'partner_approved' || activity.requiresApproval) && activity.status !== 'completed'),
    )
    if (!firstPendingApproval) return

    const anchor = document.getElementById(`activity-${firstPendingApproval.id}`)
    if (!anchor) return

    anchor.scrollIntoView({ behavior: 'smooth', block: 'center' })
    handledFocusRef.current = key

    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
  }, [
    activities,
    deepLink.focusPendingApprovals,
    deepLink.week,
    searchParams,
    selectedWeek,
    setSearchParams,
  ])

  const markCompleted = useCallback(
    async (activity: ActivityState | undefined) => {
      if (!user || !journey) return

      if (!activity?.id) {
        console.error('[WeeklyChecklist] markCompleted called with invalid activity', activity)
        triggerHaptic('error')
        toast({
          title: 'Internal error',
          description: 'Invalid activity selected.',
          status: 'error',
        })
        return
      }

      if (!canMutateActivity(activity)) {
        triggerHaptic('warning')
        toast({
          title: 'Not available yet',
          description: isAdmin
            ? 'Admin override is enabled, but this action is currently blocked by policy.'
            : 'This activity is not open right now. Try another available activity.',
          status: 'warning',
        })
        return
      }

      if (activityMutationsRef.current.has(activity.id)) return
      activityMutationsRef.current.add(activity.id)
      setActivityMutationInFlight(activity.id, true)

      try {
        await handleActivityCompletion({
          uid: user.uid,
          journeyType: journey.journeyType,
          weekNumber: selectedWeek,
          activity,
          onProofRequired: (act) => openProofModal(act),
          onSuccess: async (status) => {
            await setActivityStatusLocal(activity.id, { status, hasInteracted: true, rejectionReason: null })
            if (status === 'completed') {
              triggerHaptic('success')
              toast({
                title: 'Activity completed',
                description: `Great work. ${activity.points} points were added.`,
                status: 'success',
                duration: 3500,
              })
            }
          },
          onError: (e) => {
            console.error(e)
            triggerHaptic('error')
            toast({
              title: 'Update Failed',
              description: 'Could not award points. Please try again.',
              status: 'error',
            })
          }
        })
      } finally {
        activityMutationsRef.current.delete(activity.id)
        setActivityMutationInFlight(activity.id, false)
      }
    },
    [
      activityMutationsRef,
      canMutateActivity,
      isAdmin,
      journey,
      openProofModal,
      selectedWeek,
      setActivityMutationInFlight,
      setActivityStatusLocal,
      toast,
      user,
    ],
  )

  const markNotStarted = useCallback(
    async (activity: ActivityState | undefined) => {
      if (!user || !journey) return

      if (!activity?.id) {
        console.error('[WeeklyChecklist] markNotStarted called with invalid activity', activity)
        triggerHaptic('error')
        toast({
          title: 'Internal error',
          description: 'Invalid activity selected.',
          status: 'error',
        })
        return
      }

      // Admin can revoke; non-admin must satisfy normal restrictions too (esp. lock/hasInteracted)
      if (!isAdmin && (!journey || isWeekLocked || activity.hasInteracted)) {
        triggerHaptic('warning')
        toast({
          title: 'Selection saved',
          description: 'This selection is already saved for this week. Support can help if you need a change.',
          status: 'warning',
        })
        return
      }

      if (activityMutationsRef.current.has(activity.id)) return
      activityMutationsRef.current.add(activity.id)
      setActivityMutationInFlight(activity.id, true)

      try {
        await revokeChecklistPoints({
          uid: user.uid,
          journeyType: journey.journeyType,
          weekNumber: selectedWeek,
          activity,
        })

        await setActivityStatusLocal(activity.id, {
          status: 'not_started',
          hasInteracted: false,
          proofUrl: undefined,
          notes: undefined,
          rejectionReason: null,
        })
        triggerHaptic('success')
      } catch (e) {
        console.error(e)
        triggerHaptic('error')
        toast({
          title: 'Update Failed',
          description: 'Could not revoke points. Please try again.',
          status: 'error',
        })
      } finally {
        activityMutationsRef.current.delete(activity.id)
        setActivityMutationInFlight(activity.id, false)
      }
    },
    [isAdmin, isWeekLocked, journey, selectedWeek, setActivityMutationInFlight, setActivityStatusLocal, toast, user],
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
    if (isSubmittingProofRef.current) return
    isSubmittingProofRef.current = true
    setIsSubmittingProof(true)
    let activity: ActivityState | undefined
    try {
      activity = activities.find(a => a.id === proofModal.activityId)
      if (!activity) {
        const invalidActivityId = proofModal.activityId || 'unknown'
        console.error('[WeeklyChecklist] submitProofForApproval called with invalid activity', invalidActivityId)
        triggerHaptic('error')
        toast({
          title: 'Internal error',
          description: `Invalid activity selected for proof submission (${invalidActivityId}).`,
          status: 'error',
        })
        return
      }

      // Non-admin must respect availability/lock rules; admin can override submission (but still needs proofUrl).
      if (!isAdmin) {
        if (isWeekLocked) {
          triggerHaptic('warning')
          toast({ title: 'Future week', description: 'Proof submission opens when this week becomes active.', status: 'warning' })
          return
        }
        if (activity.availability.state !== 'available' && activity.status !== 'rejected') {
          triggerHaptic('warning')
          toast({ title: 'Opens soon', description: 'This activity is not open for proof submission yet.', status: 'warning' })
          return
        }
        if (activity.hasInteracted && activity.status !== 'rejected') {
          triggerHaptic('warning')
          toast({ title: 'Selection saved', description: 'This submission is already in progress for this week.', status: 'warning' })
          return
        }
      }

      const rawProofUrl = proofModal.proofUrl?.trim()
      if (!rawProofUrl) {
        triggerHaptic('warning')
        toast({ title: 'Proof required', description: 'Please provide a link before submitting.', status: 'warning' })
        return
      }

      const rawProofUrlLower = rawProofUrl.toLowerCase()
      const normalizedProofUrl =
        rawProofUrlLower.startsWith('http://') || rawProofUrlLower.startsWith('https://')
          ? rawProofUrl
          : `https://${rawProofUrl}`

      let parsedProofUrl: URL
      try {
        parsedProofUrl = new URL(normalizedProofUrl)
      } catch {
        triggerHaptic('warning')
        toast({
          title: 'Invalid link',
          description: 'Please enter a valid URL, like https://example.com/proof.',
          status: 'warning',
        })
        return
      }

      if (parsedProofUrl.protocol !== 'http:' && parsedProofUrl.protocol !== 'https:') {
        triggerHaptic('warning')
        toast({
          title: 'Invalid link',
          description: 'Only http:// or https:// links are supported.',
          status: 'warning',
        })
        return
      }

      const proofUrl = parsedProofUrl.toString()
      const submissionOrganizationId = shouldRequireSuperAdminReviewForFreeUser(activity, isFreeTierMember)
        ? null
        : userOrganizationId

      await submitPointsVerificationRequestAtomic({
        userId: user.uid,
        organizationId: submissionOrganizationId,
        week: selectedWeek,
        activityId: activity.id,
        activityTitle: activity.title,
        activityPoints: activity.points,
        proofUrl,
        notes: proofModal.notes?.trim(),
        approvalType: activity.approvalType,
      })

      await setActivityStatusLocal(activity.id, {
        status: 'pending',
        proofUrl,
        notes: proofModal.notes?.trim(),
        rejectionReason: null,
        hasInteracted: true,
      })

      triggerHaptic('success')
      toast({
        title: 'Proof submitted',
        description: 'Nice work. Your proof is submitted for partner review and points will post after approval.',
        status: 'success',
        duration: 4000,
      })

      closeProofModal()
    } catch (e) {
      if (e instanceof PendingRequestExistsError || (e instanceof Error && e.message === 'pending_request_exists')) {
        triggerHaptic('warning')
        toast({
          title: 'Submitted for partner review',
          description: 'This activity already has a submitted proof awaiting partner review this week.',
          status: 'info',
          duration: 5000,
        })
        if (activity) {
          await setActivityStatusLocal(activity.id, {
            status: 'pending',
            rejectionReason: null,
            hasInteracted: true,
          })
        }
        closeProofModal()
        return
      }
      console.error(e)
      triggerHaptic('error')
      toast({
        title: 'Submission failed',
        description: 'Could not submit proof. Please try again.',
        status: 'error',
      })
    } finally {
      isSubmittingProofRef.current = false
      setIsSubmittingProof(false)
    }
  }, [
    activities,
    closeProofModal,
    isAdmin,
    isWeekLocked,
    isFreeTierMember,
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
    leadershipAvailability,

    // derived
    completedCount,
    earnedPoints,
    cycleTarget,
    cyclePoints,
    accumulatedPoints,
    loading,
    error,
    isAdmin,
    isWeekLocked,
    isSubmittingProof,
    isActivityBusy,

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

