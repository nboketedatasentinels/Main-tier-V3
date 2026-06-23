import { useCallback, useRef } from 'react'
import { supabase } from '@/services/supabase'
import { WeeklyPointsRecord } from '@/utils/partnerProgress'
import { logger } from '@/utils/partnerDashboardUtils'

// Supabase `.in()` lists stay comfortably small; the ledger itself is paged via
// .range() because a partner's members can exceed the 1000-row default cap.
const UID_BATCH_SIZE = 200
const PAGE_SIZE = 1000

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

type LedgerRow = { uid: string | null; points: number | null; week_number: number | null }

// Pages through points_ledger for a batch of uids, past the 1000-row cap.
const fetchLedgerRows = async (uids: string[]): Promise<LedgerRow[]> => {
  const rows: LedgerRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('points_ledger')
      .select('uid, points, week_number')
      .in('uid', uids)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as LedgerRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

// ============================================================================
// Total points per user, summed from the Supabase points_ledger.
// (The partner dashboard uses profiles.total_points for display; this remains
// for callers that need the ledger-derived total.)
// ============================================================================

interface TotalPointsResult {
  pointsByUser: Record<string, number>
  errors: Array<{ batch: string[]; error: unknown }>
}

export const fetchTotalPointsFromLedger = async (
  userIds: string[]
): Promise<TotalPointsResult> => {
  if (!userIds.length) {
    return { pointsByUser: {}, errors: [] }
  }

  const pointsByUser: Record<string, number> = {}
  const errors: Array<{ batch: string[]; error: unknown }> = []

  // Initialize all users with 0 points
  userIds.forEach((uid) => {
    pointsByUser[uid] = 0
  })

  for (const batch of chunk(userIds, UID_BATCH_SIZE)) {
    try {
      const rows = await fetchLedgerRows(batch)
      rows.forEach((row) => {
        const uid = row.uid
        const points = typeof row.points === 'number' ? row.points : 0
        if (uid && points > 0) {
          pointsByUser[uid] = (pointsByUser[uid] || 0) + points
        }
      })
    } catch (error) {
      logger.error(`Failed to fetch points ledger for batch`, error)
      errors.push({ batch, error })
    }
  }

  return { pointsByUser, errors }
}

// ============================================================================
// FIX #7: Proper error handling for batch processing with partial failure tracking
// ============================================================================

interface BatchResult {
  pointsByUser: Record<string, WeeklyPointsRecord[]>
  errors: Array<{ batch: string[]; error: unknown }>
  hasPartialFailure: boolean
}

export const useWeeklyPointsFetcher = () => {
  // Track in-flight requests to prevent duplicate fetches
  const inFlightRef = useRef<Map<string, Promise<BatchResult>>>(new Map())

  const fetchWeeklyPointsByUser = useCallback(
    async (userIds: string[]): Promise<BatchResult> => {
      if (!userIds.length) {
        return { pointsByUser: {}, errors: [], hasPartialFailure: false }
      }

      // Create a cache key from sorted user IDs
      const cacheKey = userIds.slice().sort().join(',')

      // Check if there's already an in-flight request for these users
      const existingRequest = inFlightRef.current.get(cacheKey)
      if (existingRequest) {
        return existingRequest
      }

      const fetchPromise = (async (): Promise<BatchResult> => {
        const pointsByUser: Record<string, WeeklyPointsRecord[]> = {}
        const errors: Array<{ batch: string[]; error: unknown }> = []

        // Aggregate the Supabase points_ledger into per-week earned totals.
        // NOTE: the ledger carries EARNED points only; the per-week target
        // (required_points) lived in the legacy `weekly_points` collection and
        // is not on the ledger. It comes through as 0 here - risk/progress that
        // needs the target should derive it from journey config (follow-up).
        for (const batch of chunk(userIds, UID_BATCH_SIZE)) {
          try {
            const rows = await fetchLedgerRows(batch)
            // uid -> week -> summed earned points
            const byUserWeek: Record<string, Record<number, number>> = {}
            rows.forEach((row) => {
              const uid = row.uid
              const week = row.week_number ?? 0
              if (!uid || !week) return
              const points = typeof row.points === 'number' ? row.points : 0
              byUserWeek[uid] = byUserWeek[uid] || {}
              byUserWeek[uid][week] = (byUserWeek[uid][week] || 0) + points
            })
            Object.entries(byUserWeek).forEach(([uid, weeks]) => {
              const records: WeeklyPointsRecord[] = Object.entries(weeks).map(
                ([week, earned]) => ({
                  user_id: uid,
                  week_number: Number(week),
                  points_earned: earned,
                }),
              )
              pointsByUser[uid] = [...(pointsByUser[uid] || []), ...records]
            })
          } catch (error) {
            logger.error(`Failed to fetch weekly points for batch`, error)
            errors.push({ batch, error })
          }
        }

        return {
          pointsByUser,
          errors,
          hasPartialFailure: errors.length > 0 && Object.keys(pointsByUser).length > 0,
        }
      })()

      // Store the promise and clean up after it resolves
      inFlightRef.current.set(cacheKey, fetchPromise)
      fetchPromise.finally(() => {
        inFlightRef.current.delete(cacheKey)
      })

      return fetchPromise
    },
    []
  )

  return { fetchWeeklyPointsByUser }
}
