import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Timestamp } from 'firebase/firestore'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/hooks/useAuth'
import { getWeekKey, getCurrentWeekNumber, getJourneyTiming } from '@/utils/weekCalculations'
import { JOURNEY_META, getActivityDefinitionById } from '@/config/pointsConfig'
import { InspirationQuote } from '@/types'
import { leadershipQuotes } from '@/services/quotes'
import { UserProfileExtended } from '@/services/userProfileService'

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
  id: string
  title: string
}

export interface LedgerEntry {
  id: string
  activityId: string
  activityTitle: string
  points: number
  createdAt: Date
  weekNumber: number
}

type Row = Record<string, unknown>

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? undefined : date
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

// Minimal Supabase profiles row -> UserProfileExtended (mentor/ambassador cards
// only render firstName/avatar). Long tail lives in the `data` jsonb column.
const mapProfileRow = (row: Row | null): UserProfileExtended | null => {
  if (!row) return null
  const data = (row.data as Record<string, unknown>) || {}
  return {
    ...data,
    id: row.id as string,
    email: (row.email as string) ?? '',
    firstName: (row.first_name as string) ?? (data.firstName as string),
    lastName: (row.last_name as string) ?? (data.lastName as string),
    fullName: (row.full_name as string) ?? (data.fullName as string),
    role: row.role,
    avatarUrl: (data.avatarUrl as string) ?? (data.photoURL as string),
  } as unknown as UserProfileExtended
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

// Auth runs on Supabase; all learner data here reads from Supabase tables
// (RLS scopes every row to uid = auth.uid()). One-time fetches keep the
// dashboard fast - no hanging realtime listeners.
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

  // Derive the true current week from journey start date so it stays in sync
  // with journeyTiming used by the page.
  const weekNumber = useMemo(() => {
    const timing = getJourneyTiming(profile?.journeyStartDate, profile?.programDurationWeeks ?? 6)
    return timing?.currentWeek ?? profile?.currentWeek ?? 1
  }, [profile?.journeyStartDate, profile?.programDurationWeeks, profile?.currentWeek])
  const weekKey = useMemo(() => getWeekKey(), [])
  const calendarWeekNumber = useMemo(() => getCurrentWeekNumber(), [])

  const profileId = profile?.id
  const journeyType = profile?.journeyType
  const companyId = profile?.companyId
  const mentorId = profile?.mentorId ?? null
  const ambassadorId = profile?.ambassadorId ?? null

  /* ---- weekly points (weekly_progress) + engagement backfill from ledger ---- */
  useEffect(() => {
    if (!profileId) return
    let isActive = true
    const defaultTarget = journeyType ? JOURNEY_META[journeyType].weeklyTarget : 0

    const mapStatus = (status?: string): WeeklyPoints['status'] => {
      switch (status) {
        case 'on_track':
        case 'recovery':
          return 'on_track'
        case 'warning':
          return 'warning'
        default:
          return 'at_risk'
      }
    }

    const run = async () => {
      setLoading(prev => ({ ...prev, points: true }))
      try {
        const { data: row, error } = await supabase
          .from('weekly_progress')
          .select('*')
          .eq('uid', profileId)
          .eq('week_number', weekNumber)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!isActive) return

        if (row) {
          let engagementCount = (row.engagement_count as number) ?? null
          if (engagementCount == null) {
            const { count } = await supabase
              .from('points_ledger')
              .select('id', { count: 'exact', head: true })
              .eq('uid', profileId)
              .eq('week_number', weekNumber)
            engagementCount = count ?? 0
          }
          if (!isActive) return
          setWeeklyPoints({
            id: (row.id as string) ?? `${profileId}__${weekNumber}`,
            points_earned: (row.points_earned as number) ?? 0,
            target_points: (row.weekly_target as number) ?? defaultTarget,
            status: mapStatus(row.status as string),
            engagement_count: engagementCount,
            week_number: (row.week_number as number) ?? weekNumber,
          })
        } else {
          setWeeklyPoints({
            id: `${profileId}__${weekNumber}`,
            points_earned: 0,
            target_points: defaultTarget,
            status: 'at_risk',
            engagement_count: 0,
            week_number: weekNumber,
          })
        }
      } catch (error) {
        if (isActive) setErrors(prev => ({ ...prev, points: error as Error }))
      } finally {
        if (isActive) setLoading(prev => ({ ...prev, points: false }))
      }
    }

    void run()
    return () => {
      isActive = false
    }
  }, [profileId, journeyType, weekNumber])

  /* ---- support assignment (mentor / ambassador) from profile ---- */
  useEffect(() => {
    if (!profileId) {
      setSupportAssignment(null)
      setLoading(prev => ({ ...prev, support: false }))
      return
    }
    let isActive = true

    const run = async () => {
      setLoading(prev => ({ ...prev, support: true }))
      try {
        const ids = [mentorId, ambassadorId].filter((id): id is string => Boolean(id))
        let mentorProfile: UserProfileExtended | null = null
        let ambassadorProfile: UserProfileExtended | null = null

        if (ids.length) {
          const { data: rows, error } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name, full_name, role, data')
            .in('id', ids)
          if (error) throw new Error(error.message)
          const byId = new Map((rows ?? []).map(r => [(r as Row).id as string, r as Row]))
          mentorProfile = mentorId ? mapProfileRow(byId.get(mentorId) ?? null) : null
          ambassadorProfile = ambassadorId ? mapProfileRow(byId.get(ambassadorId) ?? null) : null
        }

        if (!isActive) return
        setSupportAssignment({
          id: profileId,
          user_id: profileId,
          mentor_id: mentorId,
          ambassador_id: ambassadorId,
          mentorProfile,
          ambassadorProfile,
        })
      } catch (error) {
        if (isActive) setErrors(prev => ({ ...prev, support: error as Error }))
      } finally {
        if (isActive) setLoading(prev => ({ ...prev, support: false }))
      }
    }

    void run()
    return () => {
      isActive = false
    }
  }, [profileId, mentorId, ambassadorId])

  /* ---- personality (derived from the already-loaded profile) ---- */
  useEffect(() => {
    if (!profile?.id) return
    setLoading(prev => ({ ...prev, profile: true }))
    const record = profile as unknown as Record<string, unknown>
    const personalityType =
      typeof profile.personalityType === 'string' ? profile.personalityType.trim() : ''
    const coreValues = toStringArray(profile.coreValues)
    const strengths = toStringArray(record.personalityStrengths)
    const description =
      typeof record.personalityDescription === 'string'
        ? (record.personalityDescription as string)
        : undefined

    setPersonality(
      personalityType || coreValues.length > 0 || strengths.length > 0
        ? {
            personalityType: personalityType || undefined,
            personalityStrengths: strengths,
            personalityDescription: description,
            coreValues,
          }
        : null,
    )
    setLoading(prev => ({ ...prev, profile: false }))
  }, [profile])

  /* ---- peer matches ---- */
  useEffect(() => {
    if (!profileId) return
    let isActive = true

    const run = async () => {
      setLoading(prev => ({ ...prev, matches: true }))
      try {
        const { data: rows, error } = await supabase
          .from('peer_weekly_matches')
          .select('*')
          .eq('uid', profileId)
        if (error) throw new Error(error.message)
        if (!isActive) return

        const matches: PeerMatch[] = (rows ?? [])
          .map((r) => {
            const row = r as Row
            return {
              id: row.id as string,
              peerId: (row.peer_uid as string) ?? undefined,
              matchReason: typeof row.match_reason === 'string' ? row.match_reason : undefined,
              matchStatus: normalizePeerMatchStatus(row.match_status as string),
              matchKey: typeof row.match_key === 'string' ? row.match_key : undefined,
              matchRefreshPreference:
                typeof row.match_refresh_preference === 'string' ? row.match_refresh_preference : undefined,
              preferredMatchDay:
                typeof row.preferred_match_day === 'number' ? row.preferred_match_day : undefined,
              refreshCount: typeof row.refresh_count === 'number' ? row.refresh_count : undefined,
              automatedMatch: typeof row.automated_match === 'boolean' ? row.automated_match : undefined,
              createdAt: toDate(row.created_at),
              lastRefreshAt: toDate(row.last_refresh_at),
            }
          })
          .filter(match => match.matchStatus !== 'expired')
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        setPeerMatches(matches)
      } catch (error) {
        if (isActive) setErrors(prev => ({ ...prev, matches: error as Error }))
      } finally {
        if (isActive) setLoading(prev => ({ ...prev, matches: false }))
      }
    }

    void run()
    return () => {
      isActive = false
    }
  }, [profileId])

  /* ---- weekly habits ---- */
  useEffect(() => {
    if (!profileId) return
    let isActive = true

    const run = async () => {
      setLoading(prev => ({ ...prev, habits: true }))
      try {
        const { data: rows, error } = await supabase
          .from('weekly_habits')
          .select('*')
          .eq('uid', profileId)
          .eq('week_key', weekKey)
        if (error) throw new Error(error.message)
        if (!isActive) return

        setWeeklyHabits(
          (rows ?? []).map((r) => {
            const row = r as Row
            return {
              id: row.id as string,
              habit_id: (row.habit_id as string) ?? undefined,
              title: (row.title as string) ?? '',
              completed: Boolean(row.completed),
              completed_at: (row.completed_at as unknown as Timestamp) ?? null,
            }
          }),
        )
      } catch (error) {
        if (isActive) setErrors(prev => ({ ...prev, habits: error as Error }))
      } finally {
        if (isActive) setLoading(prev => ({ ...prev, habits: false }))
      }
    }

    void run()
    return () => {
      isActive = false
    }
  }, [profileId, weekKey])

  /* ---- inspiration quote (local rotation) ---- */
  useEffect(() => {
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
  }, [calendarWeekNumber])

  /* ---- impact count (sum people_impacted) ---- */
  useEffect(() => {
    if (!profileId) {
      setImpactCount(0)
      setLoading(prev => ({ ...prev, impact: false }))
      return
    }
    let isActive = true

    const run = async () => {
      setLoading(prev => ({ ...prev, impact: true }))
      try {
        const { data: rows, error } = await supabase
          .from('impact_logs')
          .select('people_impacted')
          .eq('uid', profileId)
        if (error) throw new Error(error.message)
        if (!isActive) return
        const total = (rows ?? []).reduce(
          (sum, r) => sum + (((r as Row).people_impacted as number) || 0),
          0,
        )
        setImpactCount(total)
      } catch (error) {
        if (isActive) setErrors(prev => ({ ...prev, impact: error as Error }))
      } finally {
        if (isActive) setLoading(prev => ({ ...prev, impact: false }))
      }
    }

    void run()
    return () => {
      isActive = false
    }
  }, [profileId])

  /* ---- recent ledger entries ---- */
  useEffect(() => {
    if (!profileId) {
      setLoading(prev => ({ ...prev, ledger: false }))
      return
    }
    let isActive = true

    const run = async () => {
      setLoading(prev => ({ ...prev, ledger: true }))
      try {
        const { data: rows, error } = await supabase
          .from('points_ledger')
          .select('*')
          .eq('uid', profileId)
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw new Error(error.message)
        if (!isActive) return

        setLedgerEntries(
          (rows ?? []).map((r) => {
            const row = r as Row
            const activityDef = getActivityDefinitionById({
              activityId: row.activity_id as string,
              journeyType,
            })
            return {
              id: row.id as string,
              activityId: (row.activity_id as string) ?? '',
              activityTitle: activityDef?.title || (row.activity_id as string) || '',
              points: (row.points as number) ?? 0,
              createdAt: toDate(row.created_at) ?? new Date(),
              weekNumber: (row.week_number as number) ?? 0,
            }
          }),
        )
      } catch (error) {
        if (isActive) setErrors(prev => ({ ...prev, ledger: error as Error }))
      } finally {
        if (isActive) setLoading(prev => ({ ...prev, ledger: false }))
      }
    }

    void run()
    return () => {
      isActive = false
    }
  }, [profileId, journeyType])

  /* ---- focus areas (from organization settings) ---- */
  useEffect(() => {
    if (!profileId || !companyId) {
      setFocusAreas([])
      setLoading(prev => ({ ...prev, focus: false }))
      return
    }
    let isActive = true

    const run = async () => {
      setLoading(prev => ({ ...prev, focus: true }))
      try {
        const { data: row, error } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', companyId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!isActive) return

        const settings = ((row as Row | null)?.settings as Record<string, unknown>) || {}
        const leadership =
          settings.leadership && typeof settings.leadership === 'object'
            ? (settings.leadership as Record<string, unknown>)
            : null
        const resolved = new Set<string>([
          ...toStringArray(settings.focusAreas),
          ...toStringArray(settings.ambassadorFocusAreas),
          ...toStringArray(settings.partnerProgramFocus),
          ...toStringArray(leadership?.ambassadorFocusAreas),
          ...toStringArray(leadership?.partnerProgramFocus),
        ])
        setFocusAreas(
          Array.from(resolved).map((title, index) => ({ id: `focus-${index + 1}`, title })),
        )
      } catch (error) {
        if (isActive) setErrors(prev => ({ ...prev, focus: error as Error }))
      } finally {
        if (isActive) setLoading(prev => ({ ...prev, focus: false }))
      }
    }

    void run()
    return () => {
      isActive = false
    }
  }, [profileId, companyId])

  const handleHabitToggle = useCallback(async (habit: WeeklyHabit) => {
    const nextState = !habit.completed
    setWeeklyHabits(prev => prev.map(item => (item.id === habit.id ? { ...item, completed: nextState } : item)))
    try {
      const { error } = await supabase
        .from('weekly_habits')
        .update({
          completed: nextState,
          completed_at: nextState ? new Date().toISOString() : null,
        })
        .eq('id', habit.id)
      if (error) throw new Error(error.message)
    } catch (error) {
      setErrors(prev => ({ ...prev, habits: error as Error }))
      setWeeklyHabits(prev =>
        prev.map(item =>
          item.id === habit.id
            ? { ...item, completed: habit.completed, completed_at: habit.completed_at }
            : item,
        ),
      )
    }
  }, [])

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
