import { useEffect, useMemo, useState } from 'react'
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationLeadership } from '@/hooks/useOrganizationLeadership'
import { ORG_COLLECTION } from '@/constants/organizations'
import { getWeekKey, getCurrentWeekNumber } from '@/utils/weekCalculations'
import { JOURNEY_META, getMonthNumber, getActivityDefinitionById } from '@/config/pointsConfig'
import { InspirationQuote } from '@/types'
import { leadershipQuotes } from '@/services/quotes'
import { UserProfileExtended } from '@/services/userProfileService'
import type { WeeklyProgress } from '@/types'

export interface WeeklyPoints {
  id: string
  points_earned: number
  target_points: number
  status?: 'on_track' | 'warning' | 'at_risk'
  engagement_count?: number
  week_number: number
}

export interface SupportAssignment {
  id: string
  user_id?: string
  mentor_id?: string | null
  ambassador_id?: string | null
  assigned_date?: Timestamp
  mentorProfile?: UserProfileExtended | null
  mentorProfileError?: string
  ambassadorProfile?: UserProfileExtended | null
  ambassadorProfileError?: string
}

export interface PersonalityProfile {
  personalityType?: string
  personalityStrengths?: string[]
  personalityDescription?: string
  coreValues?: string[]
}

export type PeerMatchStatus = 'new' | 'viewed' | 'contacted' | 'completed' | 'expired'

export interface PeerMatch {
  id: string
  peerId?: string
  matchReason?: string
  matchStatus: PeerMatchStatus
  matchKey?: string
  matchRefreshPreference?: string
  preferredMatchDay?: number
  refreshCount?: number
  automatedMatch?: boolean
  createdAt?: Date
  lastRefreshAt?: Date
  lastManualRefreshAt?: Date
}

export interface WeeklyHabit {
  id: string
  habit_id?: string
  title: string
  completed: boolean
  completed_at?: Timestamp | null
}

export interface FocusArea {
  id: string;
  title: string;
}

export interface LedgerEntry {
  id: string
  activityId: string
  activityTitle: string
  points: number
  createdAt: Date
  weekNumber: number
}

const toDateValue = (value: unknown): Date | undefined => {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date }
    if (typeof candidate.toDate === 'function') {
      return candidate.toDate()
    }
  }
  return undefined
}

const PEER_MATCH_STATUS_VALUES: PeerMatchStatus[] = ['new', 'viewed', 'contacted', 'completed', 'expired']

const normalizePeerMatchStatus = (status?: string | null): PeerMatchStatus => {
  if (!status) return 'new'
  const normalized = status.toLowerCase()
  if (PEER_MATCH_STATUS_VALUES.includes(normalized as PeerMatchStatus)) {
    return normalized as PeerMatchStatus
  }
  if (normalized === 'matched') return 'completed'
  if (normalized === 'pending') return 'new'
  return 'new'
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

interface WeeklyGlanceLoadingState {
  points: boolean
  support: boolean
  profile: boolean
  matches: boolean
  habits: boolean
  inspiration: boolean
  impact: boolean
  focus: boolean
  ledger: boolean
}

interface WeeklyGlanceErrorState {
  points?: Error
  support?: Error
  profile?: Error
  matches?: Error
  habits?: Error
  inspiration?: Error
  impact?: Error
  focus?: Error
  ledger?: Error
}

// NOTE: Weekly naming is intentional for now because Firestore collections/doc ids are week-based.
// TODO(periods): add a period abstraction before renaming `weekly*` fields to generic period terms.

export const useWeeklyGlanceData = () => {
  const { profile } = useAuth()
  const [weeklyPoints, setWeeklyPoints] = useState<WeeklyPoints | null>(null)
  const [supportAssignment, setSupportAssignment] = useState<SupportAssignment | null>(null)
  const [personality, setPersonality] = useState<PersonalityProfile | null>(null)
  const [peerMatches, setPeerMatches] = useState<PeerMatch[]>([])
  const [weeklyHabits, setWeeklyHabits] = useState<WeeklyHabit[]>([])
  const [inspirationQuote, setInspirationQuote] = useState<InspirationQuote | null>(null)
  const [impactCount, setImpactCount] = useState<number>(0)
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([])
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState<WeeklyGlanceLoadingState>({
    points: true,
    support: true,
    profile: true,
    matches: true,
    habits: true,
    inspiration: true,
    impact: true,
    focus: true,
    ledger: true,
  })
  const [errors, setErrors] = useState<WeeklyGlanceErrorState>({})
  const {
    assignments: leadershipAssignments,
    profiles: leadershipProfiles,
    errors: leadershipErrors,
    loading: leadershipLoading,
  } = useOrganizationLeadership(profile?.companyId, profile?.id, profile)

  // Week-level keys remain the source of truth until non-weekly periods are supported.
  const weekNumber = useMemo(
    () => profile?.currentWeek || 1,
    [profile?.currentWeek],
  )
  const weekKey = useMemo(() => getWeekKey(), [])
  const calendarWeekNumber = useMemo(() => getCurrentWeekNumber(), [])

  useEffect(() => {
    if (!profile?.id) return

    const initializeWeeklyProgress = async () => {
      const journeyType = profile.journeyType
      const weeklyTarget = journeyType ? JOURNEY_META[journeyType].weeklyTarget : 0
      const progressRef = doc(db, 'weeklyProgress', `${profile.id}__${weekNumber}`)
      const monthNumber = getMonthNumber(weekNumber)
      const payload = {
        uid: profile.id,
        weekNumber,
        monthNumber,
        weeklyTarget,
        pointsEarned: 0,
        engagementCount: 0,
        status: 'alert',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const maxAttempts = 2
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const existing = await getDoc(progressRef)
          if (!existing.exists()) {
            await setDoc(progressRef, payload, { merge: true })
          }
          return
        } catch (error) {
          if (attempt === maxAttempts) {
            console.warn('Unable to initialize weekly progress document.', error)
          } else {
            await new Promise(resolve => setTimeout(resolve, 150 * attempt))
          }
        }
      }
    }

    initializeWeeklyProgress()
  }, [profile?.id, profile?.journeyType, weekNumber])

  useEffect(() => {
    if (!profile?.id) return

    const progressRef = doc(db, 'weeklyProgress', `${profile.id}__${weekNumber}`)
    const defaultTarget = profile?.journeyType ? JOURNEY_META[profile.journeyType].weeklyTarget : 0
    const mapStatus = (status?: WeeklyProgress['status']): WeeklyPoints['status'] => {
      switch (status) {
        case 'on_track':
          return 'on_track'
        case 'warning':
          return 'warning'
        case 'alert':
          return 'at_risk'
        case 'recovery':
          return 'on_track'
        default:
          return 'at_risk'
      }
    }
    const toWeeklyPoints = (data: WeeklyProgress, id: string): WeeklyPoints => ({
      id,
      points_earned: data.pointsEarned ?? 0,
      target_points: data.weeklyTarget ?? defaultTarget,
      status: mapStatus(data.status),
      engagement_count: data.engagementCount ?? 0,
      week_number: data.weekNumber ?? weekNumber,
    })
    const backfillEngagementCount = async () => {
      const ledgerQuery = query(
        collection(db, 'pointsLedger'),
        where('uid', '==', profile.id),
        where('weekNumber', '==', weekNumber),
      )
      const ledgerSnapshot = await getDocs(ledgerQuery)
      return ledgerSnapshot.size
    }

    const unsubscribe = onSnapshot(
      progressRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data() as WeeklyProgress
          setWeeklyPoints(toWeeklyPoints(data, snapshot.id))
          if (data.engagementCount == null) {
            void (async () => {
              try {
                const engagementCount = await backfillEngagementCount()
                await updateDoc(progressRef, {
                  engagementCount,
                  updatedAt: serverTimestamp(),
                })
                setWeeklyPoints(prev =>
                  prev ? { ...prev, engagement_count: engagementCount } : prev,
                )
              } catch (error) {
                console.warn('Unable to backfill engagement count.', error)
              }
            })()
          }
        } else {
          setWeeklyPoints({
            id: progressRef.id,
            points_earned: 0,
            target_points: defaultTarget,
            status: 'at_risk',
            engagement_count: 0,
            week_number: weekNumber,
          })
        }
        setLoading(prev => ({ ...prev, points: false }))
      },
      error => {
        setErrors(prev => ({ ...prev, points: error as Error }))
        setLoading(prev => ({ ...prev, points: false }))
      },
    )

    return () => unsubscribe()
  }, [profile?.id, profile?.journeyType, weekNumber])

  useEffect(() => {
    setLoading(prev => ({ ...prev, support: leadershipLoading }))
  }, [leadershipLoading])

  useEffect(() => {
    setErrors(prev => ({
      ...prev,
      support: leadershipErrors.organization ? new Error(leadershipErrors.organization) : undefined,
    }))
  }, [leadershipErrors.organization])

  useEffect(() => {
    if (!profile?.id) {
      setSupportAssignment(null)
      return
    }

    setSupportAssignment({
      id: profile.id,
      user_id: profile.id,
      mentor_id: leadershipAssignments.mentorId,
      ambassador_id: leadershipAssignments.ambassadorId,
      mentorProfile: leadershipProfiles.mentor,
      mentorProfileError: leadershipErrors.mentor,
      ambassadorProfile: leadershipProfiles.ambassador,
      ambassadorProfileError: leadershipErrors.ambassador,
    })
  }, [
    leadershipAssignments.ambassadorId,
    leadershipAssignments.mentorId,
    leadershipErrors.ambassador,
    leadershipErrors.mentor,
    leadershipProfiles.ambassador,
    leadershipProfiles.mentor,
    profile?.id,
  ])

  useEffect(() => {
    const fetchProfile = async () => {
      if (!profile?.id) return
      setLoading(prev => ({ ...prev, profile: true }))
      try {
        const profileDoc = await getDoc(doc(db, 'profiles', profile.id))
        if (profileDoc.exists()) {
          const data = profileDoc.data()
          const personalityStrengths = toStringArray(data.personalityStrengths)
          const legacyPersonalityStrengths = toStringArray(data.personality_strengths)
          const coreValues = toStringArray(data.coreValues)
          const legacyCoreValues = toStringArray(data.core_values)
          const resolvedPersonalityType =
            (typeof data.personalityType === 'string' ? data.personalityType.trim() : '') ||
            (typeof data.personality_type === 'string' ? data.personality_type.trim() : '') ||
            (typeof profile.personalityType === 'string' ? profile.personalityType.trim() : '')
          const resolvedStrengths =
            personalityStrengths.length > 0 ? personalityStrengths : legacyPersonalityStrengths
          const resolvedCoreValues =
            coreValues.length > 0 ? coreValues : legacyCoreValues
          const resolvedDescription =
            (typeof data.personalityDescription === 'string' ? data.personalityDescription : undefined) ||
            (typeof data.personality_description === 'string' ? data.personality_description : undefined)

          setPersonality({
            personalityType: resolvedPersonalityType || undefined,
            personalityStrengths: resolvedStrengths,
            personalityDescription: resolvedDescription,
            coreValues: resolvedCoreValues.length > 0 ? resolvedCoreValues : (profile.coreValues ?? []),
          })
        } else {
          setPersonality(
            profile.personalityType || (profile.coreValues && profile.coreValues.length > 0)
              ? {
                  personalityType: profile.personalityType,
                  personalityStrengths: [],
                  personalityDescription: undefined,
                  coreValues: profile.coreValues ?? [],
                }
              : null,
          )
        }
      } catch (error) {
        setErrors(prev => ({ ...prev, profile: error as Error }))
      } finally {
        setLoading(prev => ({ ...prev, profile: false }))
      }
    }

    fetchProfile()
  }, [profile?.id])

  useEffect(() => {
    const fetchMatches = async () => {
      if (!profile?.id) return
      setLoading(prev => ({ ...prev, matches: true }))
      try {
        const matchesCollection = collection(db, 'peer_weekly_matches')
        const primarySnapshot = await getDocs(
          query(matchesCollection, where('user_id', '==', profile.id)),
        )
        let matchDocs = primarySnapshot.docs

        if (!matchDocs.length) {
          const fallbackSnapshot = await getDocs(
            query(matchesCollection, where('userId', '==', profile.id)),
          )
          matchDocs = fallbackSnapshot.docs
        }

        const matchesData: PeerMatch[] = matchDocs
          .map(docItem => {
            const record = docItem.data() as Record<string, unknown>
            const rawStatus =
              (record.matchStatus as string | undefined) || (record.status as string | undefined)
            return {
              id: docItem.id,
              peerId:
                (record.peerId as string | undefined) ||
                (record.peer_id as string | undefined),
              matchReason: typeof record.matchReason === 'string' ? record.matchReason : undefined,
              matchStatus: normalizePeerMatchStatus(rawStatus),
              matchKey: typeof record.matchKey === 'string' ? record.matchKey : undefined,
              matchRefreshPreference:
                typeof record.matchRefreshPreference === 'string'
                  ? record.matchRefreshPreference
                  : undefined,
              preferredMatchDay:
                typeof record.preferredMatchDay === 'number' ? record.preferredMatchDay : undefined,
              refreshCount:
                typeof record.refreshCount === 'number' ? record.refreshCount : undefined,
              automatedMatch:
                typeof record.automatedMatch === 'boolean' ? record.automatedMatch : undefined,
              createdAt: toDateValue(record.createdAt),
              lastRefreshAt: toDateValue(record.lastRefreshAt),
              lastManualRefreshAt: toDateValue(record.lastManualRefreshAt),
            }
          })
          .filter(match => match.matchStatus !== 'expired')
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        setPeerMatches(matchesData)
      } catch (error) {
        setErrors(prev => ({ ...prev, matches: error as Error }))
      } finally {
        setLoading(prev => ({ ...prev, matches: false }))
      }
    }

    fetchMatches()
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    setLoading(prev => ({ ...prev, habits: true }))
    const habitsQuery = query(
      collection(db, 'weekly_habits'),
      where('user_id', '==', profile.id),
      where('week_key', '==', weekKey),
    )

    const unsubscribe = onSnapshot(
      habitsQuery,
      snapshot => {
        const habits = snapshot.docs.map(docItem => ({
          ...(docItem.data() as WeeklyHabit),
          id: docItem.id,
        }))
        setWeeklyHabits(habits)
        setLoading(prev => ({ ...prev, habits: false }))
      },
      error => {
        setErrors(prev => ({ ...prev, habits: error as Error }))
        setLoading(prev => ({ ...prev, habits: false }))
      },
    )

    return () => unsubscribe()
  }, [profile?.id, weekKey])

  useEffect(() => {
    const fetchQuote = () => {
      setLoading(prev => ({ ...prev, inspiration: true }))
      const quoteCount = leadershipQuotes.length
      const quoteIndex = quoteCount > 0 ? (calendarWeekNumber - 1) % quoteCount : 0
      const fallbackQuote =
        leadershipQuotes[quoteIndex] ?? {
          week_number: calendarWeekNumber,
          quote_text: 'Join the movement. Take one small step today toward your goal.',
          author: 'T4L Community',
          category: 'Inspiration',
        }

      setInspirationQuote({ ...fallbackQuote, id: `fallback-${calendarWeekNumber}` })
      setLoading(prev => ({ ...prev, inspiration: false }))
    }

    fetchQuote()
  }, [calendarWeekNumber])

  useEffect(() => {
    if (!profile?.id) {
      setLoading(prev => ({ ...prev, impact: false }));
      setImpactCount(0);
      return;
    }

    setLoading(prev => ({ ...prev, impact: true }));
    const impactQuery = query(collection(db, 'impact_logs'), where('userId', '==', profile.id));

    const unsubscribe = onSnapshot(
      impactQuery,
      snapshot => {
        const total = snapshot.docs.reduce((sum, docItem) => {
          const data = docItem.data() as { peopleImpacted?: number };
          return sum + (data.peopleImpacted || 0);
        }, 0);
        setImpactCount(total);
        setLoading(prev => ({ ...prev, impact: false }));
      },
      error => {
        setErrors(prev => ({ ...prev, impact: error as Error }));
        setLoading(prev => ({ ...prev, impact: false }));
      }
    );

    return () => unsubscribe();
  }, [profile?.id])

  const handleHabitToggle = async (habit: WeeklyHabit) => {
    const nextState = !habit.completed
    setWeeklyHabits(prev => prev.map(item => (item.id === habit.id ? { ...item, completed: nextState } : item)))
    try {
      await updateDoc(doc(db, 'weekly_habits', habit.id), {
        completed: nextState,
        completed_at: nextState ? Timestamp.now() : null,
      })
    } catch (error) {
      setErrors(prev => ({ ...prev, habits: error as Error }))
      setWeeklyHabits(prev =>
        prev.map(item => (item.id === habit.id ? { ...item, completed: habit.completed, completed_at: habit.completed_at } : item)),
      )
    }
  }

  useEffect(() => {
    if (!profile?.id) {
      setLoading(prev => ({ ...prev, ledger: false }))
      return
    }

    const ledgerQuery = query(
      collection(db, 'pointsLedger'),
      where('uid', '==', profile.id),
      orderBy('createdAt', 'desc'),
      limit(10)
    )

    const unsubscribe = onSnapshot(
      ledgerQuery,
      snapshot => {
        const entries = snapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data()
          const activityDef = getActivityDefinitionById({ activityId: data.activityId, journeyType: profile.journeyType })
          return {
            id: docSnapshot.id,
            activityId: data.activityId,
            activityTitle: activityDef?.title || data.activityId,
            points: data.points,
            createdAt: data.createdAt?.toDate() || new Date(),
            weekNumber: data.weekNumber,
          }
        })
        setLedgerEntries(entries)
        setLoading(prev => ({ ...prev, ledger: false }))
      },
      error => {
        console.error('Error fetching ledger entries:', error)
        setErrors(prev => ({ ...prev, ledger: error as Error }))
        setLoading(prev => ({ ...prev, ledger: false }))
      }
    )

    return () => unsubscribe()
  }, [profile?.id])

  useEffect(() => {
    const fetchFocusAreas = async () => {
      if (!profile?.id) {
        setFocusAreas([])
        setLoading(prev => ({ ...prev, focus: false }))
        return
      }
      setLoading(prev => ({ ...prev, focus: true }))
      try {
        const resolvedFocusAreas = new Set<string>()

        if (profile.companyId) {
          const organizationSnapshot = await getDoc(doc(db, ORG_COLLECTION, profile.companyId))
          if (organizationSnapshot.exists()) {
            const organizationData = organizationSnapshot.data() as Record<string, unknown>
            const leadership =
              organizationData.leadership && typeof organizationData.leadership === 'object'
                ? (organizationData.leadership as Record<string, unknown>)
                : null

            const focusCandidates = [
              ...toStringArray(organizationData.focusAreas),
              ...toStringArray(organizationData.ambassadorFocusAreas),
              ...toStringArray(organizationData.partnerProgramFocus),
              ...toStringArray(leadership?.ambassadorFocusAreas),
              ...toStringArray(leadership?.partnerProgramFocus),
            ]

            for (const focusArea of focusCandidates) {
              resolvedFocusAreas.add(focusArea)
            }
          }
        }

        setFocusAreas(
          Array.from(resolvedFocusAreas).map((title, index) => ({
            id: `focus-${index + 1}`,
            title,
          })),
        )
      } catch (error) {
        setErrors(prev => ({ ...prev, focus: error as Error }))
      } finally {
        setLoading(prev => ({ ...prev, focus: false }))
      }
    }

    void fetchFocusAreas()
  }, [profile?.companyId, profile?.id])

  return {
    weeklyPoints,
    supportAssignment,
    personality,
    peerMatches,
    weeklyHabits,
    inspirationQuote,
    impactCount,
    focusAreas,
    ledgerEntries,
    weekNumber,
    loading,
    errors,
    handleHabitToggle,
  }
}
