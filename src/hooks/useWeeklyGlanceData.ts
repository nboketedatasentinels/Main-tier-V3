import { useEffect, useMemo, useState } from 'react'
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationLeadership } from '@/hooks/useOrganizationLeadership'
import { getCurrentWeekNumber, getWeekKey } from '@/utils/weekCalculations'
import { JOURNEY_META, getMonthNumber } from '@/config/pointsConfig'
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

export interface PeerMatch {
  id: string
  matched_user_id: string
  status: string
  created_at?: Timestamp
}

export interface WeeklyHabit {
  id: string
  habit_id?: string
  title: string
  completed: boolean
  completed_at?: Timestamp | null
}

interface WeeklyGlanceLoadingState {
  points: boolean
  support: boolean
  profile: boolean
  matches: boolean
  habits: boolean
  inspiration: boolean
  impact: boolean
}

interface WeeklyGlanceErrorState {
  points?: Error
  support?: Error
  profile?: Error
  matches?: Error
  habits?: Error
  inspiration?: Error
  impact?: Error
}

export const useWeeklyGlanceData = () => {
  const { profile } = useAuth()
  const [weeklyPoints, setWeeklyPoints] = useState<WeeklyPoints | null>(null)
  const [supportAssignment, setSupportAssignment] = useState<SupportAssignment | null>(null)
  const [personality, setPersonality] = useState<PersonalityProfile | null>(null)
  const [peerMatches, setPeerMatches] = useState<PeerMatch[]>([])
  const [weeklyHabits, setWeeklyHabits] = useState<WeeklyHabit[]>([])
  const [inspirationQuote, setInspirationQuote] = useState<InspirationQuote | null>(null)
  const [impactCount, setImpactCount] = useState<number>(0)
  const [loading, setLoading] = useState<WeeklyGlanceLoadingState>({
    points: true,
    support: true,
    profile: true,
    matches: true,
    habits: true,
    inspiration: true,
    impact: true,
  })
  const [errors, setErrors] = useState<WeeklyGlanceErrorState>({})
  const {
    assignments: leadershipAssignments,
    profiles: leadershipProfiles,
    errors: leadershipErrors,
    loading: leadershipLoading,
  } = useOrganizationLeadership(profile?.companyId, profile?.id)

  const calendarWeekNumber = useMemo(() => getCurrentWeekNumber(), [])
  const weekNumber = useMemo(
    () => (profile?.currentWeek && profile.currentWeek > 0 ? profile.currentWeek : calendarWeekNumber),
    [calendarWeekNumber, profile?.currentWeek],
  )
  const weekKey = useMemo(() => getWeekKey(), [])

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
          setPersonality({
            personalityType: data.personalityType,
            personalityStrengths: data.personalityStrengths || [],
            personalityDescription: data.personalityDescription,
            coreValues: data.coreValues || [],
          })
        } else {
          setPersonality(null)
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
        const matchesQuery = query(collection(db, 'peer_matches'), where('user_id', '==', profile.id))
        const snapshot = await getDocs(matchesQuery)
        const matchesData: PeerMatch[] = snapshot.docs.map(item => ({
          ...(item.data() as PeerMatch),
          id: item.id,
        }))
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
    const fetchQuote = async () => {
      setLoading(prev => ({ ...prev, inspiration: true }))
      try {
        const quoteQuery = query(
          collection(db, 'inspiration_quotes'),
          where('week_number', '==', weekNumber),
        )
        const snapshot = await getDocs(quoteQuery)
        const docData = snapshot.docs[0]
        if (docData) {
          setInspirationQuote({ ...(docData.data() as InspirationQuote), id: docData.id })
        } else {
          const fallbackQuote = leadershipQuotes[weekNumber % leadershipQuotes.length]
          setInspirationQuote({ ...fallbackQuote, id: `fallback-${weekNumber}` })
        }
      } catch (error) {
        setErrors(prev => ({ ...prev, inspiration: error as Error }))
        const fallbackQuote = leadershipQuotes[weekNumber % leadershipQuotes.length]
        setInspirationQuote({ ...fallbackQuote, id: `fallback-${weekNumber}` })
      } finally {
        setLoading(prev => ({ ...prev, inspiration: false }))
      }
    }

    fetchQuote()
  }, [weekNumber])

  useEffect(() => {
    if (!profile?.id) {
      setLoading(prev => ({ ...prev, impact: false }));
      setImpactCount(0);
      return;
    }

    setLoading(prev => ({ ...prev, impact: true }));
    const impactQuery = query(collection(db, 'impact_logs'), where('user_id', '==', profile.id));

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

  return {
    weeklyPoints,
    supportAssignment,
    personality,
    peerMatches,
    weeklyHabits,
    inspirationQuote,
    impactCount,
    weekNumber,
    loading,
    errors,
    handleHabitToggle,
  }
}
