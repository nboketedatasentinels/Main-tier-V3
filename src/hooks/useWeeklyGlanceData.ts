import { useEffect, useMemo, useState } from 'react'
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { getCurrentWeekNumber, getWeekKey } from '@/utils/weekCalculations'
import { getOrCreateWeeklyPoints } from '@/services/weeklyPointsService'

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
  user_id: string
  mentor_id?: string | null
  ambassador_id?: string | null
  assigned_date?: Timestamp
}

export interface PersonalityProfile {
  personalityType?: string
  personalityStrengths?: string[]
  personalityDescription?: string
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

export interface InspirationQuote {
  id: string
  week_number: number
  quote_text: string
  author?: string
  category?: string
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

  const weekNumber = useMemo(() => getCurrentWeekNumber(), [])
  const weekKey = useMemo(() => getWeekKey(), [])

  useEffect(() => {
    if (!profile?.id) return
    getOrCreateWeeklyPoints(profile.id).catch(error => {
      console.error('Error initializing weekly points:', error)
    })
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return

    const weekYear = new Date().getFullYear()
    const q = query(
      collection(db, 'weekly_points'),
      where('user_id', '==', profile.id),
      where('week_number', '==', weekNumber),
      where('week_year', '==', weekYear),
    )

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const docData = snapshot.docs[0]
        if (docData) {
          const data = docData.data()
          setWeeklyPoints({
            id: docData.id,
            points_earned: data.points_earned || 0,
            target_points: data.target_points || 0,
            status: data.status,
            engagement_count: data.engagement_count || 0,
            week_number: data.week_number || weekNumber,
          })
        } else {
          setWeeklyPoints(null)
        }
        setLoading(prev => ({ ...prev, points: false }))
      },
      error => {
        setErrors(prev => ({ ...prev, points: error as Error }))
        setLoading(prev => ({ ...prev, points: false }))
      },
    )

    return () => unsubscribe()
  }, [profile?.id, weekNumber])

  useEffect(() => {
    const fetchSupport = async () => {
      if (!profile?.id) return
      setLoading(prev => ({ ...prev, support: true }))
      try {
        const supportQuery = query(collection(db, 'support_assignments'), where('user_id', '==', profile.id))
        const snapshot = await getDocs(supportQuery)
        const docData = snapshot.docs[0]
        if (docData) {
          const data = docData.data() as SupportAssignment
          setSupportAssignment({ ...data, id: docData.id })
        } else {
          setSupportAssignment(null)
        }
      } catch (error) {
        setErrors(prev => ({ ...prev, support: error as Error }))
      } finally {
        setLoading(prev => ({ ...prev, support: false }))
      }
    }

    fetchSupport()
  }, [profile?.id])

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
          setInspirationQuote(null)
        }
      } catch (error) {
        setErrors(prev => ({ ...prev, inspiration: error as Error }))
      } finally {
        setLoading(prev => ({ ...prev, inspiration: false }))
      }
    }

    fetchQuote()
  }, [weekNumber])

  useEffect(() => {
    const fetchImpact = async () => {
      if (!profile?.id) return
      setLoading(prev => ({ ...prev, impact: true }))
      try {
        const impactQuery = query(collection(db, 'impact_logs'), where('user_id', '==', profile.id))
        const snapshot = await getDocs(impactQuery)
        const total = snapshot.docs.reduce((sum, docItem) => {
          const data = docItem.data() as { peopleImpacted?: number }
          return sum + (data.peopleImpacted || 0)
        }, 0)
        setImpactCount(total)
      } catch (error) {
        setErrors(prev => ({ ...prev, impact: error as Error }))
      } finally {
        setLoading(prev => ({ ...prev, impact: false }))
      }
    }

    fetchImpact()
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
