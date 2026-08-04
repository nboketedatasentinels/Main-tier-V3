import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { FULL_ACTIVITIES, resolveCanonicalActivityId, type ActivityDef } from '@/config/pointsConfig'

export interface ActivityHistoryEntry {
  id: string
  activityId: string
  activityTitle: string
  points: number
  category: string
  weekNumber: number
  createdAt: Date
  source: string
}

export interface UseUserActivityHistoryResult {
  activityHistoryByCategory: Record<string, ActivityHistoryEntry[]>
  isLoading: boolean
  error: string | null
}

const activityMap = new Map<string, ActivityDef>(
  FULL_ACTIVITIES.map((a) => [a.id, a])
)

const parseCreatedAt = (raw: unknown): Date => {
  if (!raw) return new Date()
  if (raw instanceof Date) return raw
  if (typeof raw === 'string') {
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }
  return new Date()
}

export const useUserActivityHistory = (
  userId: string | null | undefined
): UseUserActivityHistoryResult => {
  const [activityHistoryByCategory, setActivityHistoryByCategory] = useState<
    Record<string, ActivityHistoryEntry[]>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setActivityHistoryByCategory({})
      setIsLoading(false)
      return
    }

    const fetchActivityHistory = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Own ledger rows are readable under RLS (uid = auth.uid()).
        const { data, error: ledgerError } = await supabase
          .from('points_ledger')
          .select('id, activity_id, points, week_number, created_at')
          .eq('uid', userId)
          .order('created_at', { ascending: false })

        if (ledgerError) throw new Error(ledgerError.message)

        const grouped: Record<string, ActivityHistoryEntry[]> = {}

        ;(data ?? []).forEach((row) => {
          const raw = row as {
            id?: string
            activity_id?: string | null
            points?: number | null
            week_number?: number | null
            created_at?: string | null
          }
          const points = typeof raw.points === 'number' ? raw.points : 0
          if (points <= 0) return

          const activityIdRaw = raw.activity_id || 'unknown'
          const canonical = resolveCanonicalActivityId(activityIdRaw) ?? activityIdRaw
          const def = activityMap.get(canonical)
          const category = def?.category || 'Other'
          const title = def?.title || activityIdRaw

          const entry: ActivityHistoryEntry = {
            id: String(raw.id ?? `${userId}-${canonical}-${raw.created_at ?? ''}`),
            activityId: canonical,
            activityTitle: title,
            points,
            category,
            weekNumber: typeof raw.week_number === 'number' ? raw.week_number : 0,
            createdAt: parseCreatedAt(raw.created_at),
            source: 'points_ledger',
          }

          if (!grouped[category]) grouped[category] = []
          grouped[category].push(entry)
        })

        Object.keys(grouped).forEach((cat) => {
          grouped[cat].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        })

        setActivityHistoryByCategory(grouped)
      } catch (err) {
        console.error('[useUserActivityHistory] Failed to fetch activity history:', err)
        setError('Failed to load activity history')
        setActivityHistoryByCategory({})
      } finally {
        setIsLoading(false)
      }
    }

    void fetchActivityHistory()
  }, [userId])

  return {
    activityHistoryByCategory,
    isLoading,
    error,
  }
}
