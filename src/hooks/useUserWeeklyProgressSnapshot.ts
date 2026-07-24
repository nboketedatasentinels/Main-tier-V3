import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'

export interface UserWeeklyProgressSnapshot {
  weekNumber: number
  pointsEarned: number
  engagementCount: number
  status?: string
  updatedAt?: string
}

export interface UserPendingApprovalsSnapshot {
  count: number
  points: number
}

const normalizeDateString = (value?: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return undefined
}

// Monotonic suffix so every subscription gets a distinct realtime channel topic
// (supabase.channel reuses a channel with the same topic, which throws "cannot
// add postgres_changes callbacks after subscribe()" on a fast remount).
let weeklyProgressChannelSeq = 0

/**
 * Live weekly-progress + pending-approvals snapshot for a single learner/week,
 * read from Supabase. Replaces the Firestore `onSnapshot(weeklyProgress)` and
 * `onSnapshot(points_verification_requests)` listeners, which failed with
 * "Missing or insufficient permissions" after the Firebase -> Supabase auth
 * cutover. Sources: `weekly_progress` (uid, week_number) and `point_verifications`
 * (uid, week) - the canonical Supabase store that consolidated the legacy
 * `points_verification_requests`.
 */
export function useUserWeeklyProgressSnapshot(userId?: string | null, weekNumber?: number | null) {
  const [weeklyProgress, setWeeklyProgress] = useState<UserWeeklyProgressSnapshot | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<UserPendingApprovalsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setWeeklyProgress(null)
    setPendingApprovals(null)
    setError(null)

    if (!userId || !weekNumber) {
      setLoading(false)
      return
    }

    setLoading(true)
    let cancelled = false

    const loadWeekly = async () => {
      const { data: row, error: weeklyError } = await supabase
        .from('weekly_progress')
        .select('*')
        .eq('uid', userId)
        .eq('week_number', weekNumber)
        .maybeSingle()

      if (cancelled) return
      if (weeklyError) {
        console.error('[useUserWeeklyProgressSnapshot] weekly_progress error:', weeklyError)
        setError(weeklyError.message)
        setLoading(false)
        return
      }

      if (!row) {
        setWeeklyProgress({
          weekNumber,
          pointsEarned: 0,
          engagementCount: 0,
          status: undefined,
          updatedAt: undefined,
        })
      } else {
        setWeeklyProgress({
          weekNumber: typeof row.week_number === 'number' ? row.week_number : weekNumber,
          pointsEarned: typeof row.points_earned === 'number' ? row.points_earned : 0,
          engagementCount: typeof row.engagement_count === 'number' ? row.engagement_count : 0,
          status: (row.status as string) ?? undefined,
          updatedAt: normalizeDateString(row.updated_at),
        })
      }
      setLoading(false)
    }

    const loadPending = async () => {
      const { data, error: pendingError } = await supabase
        .from('point_verifications')
        .select('points')
        .eq('uid', userId)
        .eq('week', weekNumber)
        .eq('status', 'pending')

      if (cancelled) return
      if (pendingError) {
        console.error('[useUserWeeklyProgressSnapshot] point_verifications error:', pendingError)
        setError((prev) => prev ?? pendingError.message)
        return
      }

      let points = 0
      ;(data ?? []).forEach((item) => {
        const value = typeof item.points === 'number' ? item.points : Number(item.points)
        if (!Number.isNaN(value)) points += value
      })
      setPendingApprovals({ count: (data ?? []).length, points })
    }

    void loadWeekly()
    void loadPending()

    const channel = supabase
      .channel(`user_weekly_progress_${++weeklyProgressChannelSeq}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekly_progress', filter: `uid=eq.${userId}` },
        () => void loadWeekly(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'point_verifications', filter: `uid=eq.${userId}` },
        () => void loadPending(),
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [userId, weekNumber])

  return {
    weeklyProgress,
    pendingApprovals,
    loading,
    error,
  }
}
