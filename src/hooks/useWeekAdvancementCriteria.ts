import { useState, useEffect, useCallback, useRef } from 'react'
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { checkWeekAdvancementEligibility, AdvancementEligibility } from '@/services/weekAdvancementService'
import { UserProfile } from '@/types'

interface UseWeekAdvancementCriteriaResult {
  eligibility: AdvancementEligibility | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Hook to track week advancement eligibility in real-time.
 *
 * Subscribes to:
 * - weeklyProgress for current week points
 * - windowProgress for current window points
 * - points_verification_requests for pending approvals
 *
 * Automatically recalculates eligibility when any data changes.
 *
 * @param profile - The user's profile (must include id, currentWeek, journeyType)
 * @returns Eligibility status, loading state, error, and refresh function
 */
export function useWeekAdvancementCriteria(
  profile: UserProfile | null | undefined
): UseWeekAdvancementCriteriaResult {
  const [eligibility, setEligibility] = useState<AdvancementEligibility | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use refs to track unsubscribe functions
  const unsubscribesRef = useRef<Unsubscribe[]>([])
  const recalculateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Recalculate eligibility (debounced to avoid excessive calls)
   */
  const recalculateEligibility = useCallback(
    async (immediate = false) => {
      if (!profile?.id) {
        setEligibility(null)
        setLoading(false)
        return
      }

      // Clear existing timeout
      if (recalculateTimeoutRef.current) {
        clearTimeout(recalculateTimeoutRef.current)
      }

      const doCalculation = async () => {
        try {
          setLoading(true)
          setError(null)

          const result = await checkWeekAdvancementEligibility(profile.id, profile)
          setEligibility(result)
        } catch (err) {
          console.error('[useWeekAdvancementCriteria] Error calculating eligibility:', err)
          setError(err instanceof Error ? err.message : 'Failed to calculate eligibility')
        } finally {
          setLoading(false)
        }
      }

      if (immediate) {
        await doCalculation()
      } else {
        // Debounce recalculation by 500ms
        recalculateTimeoutRef.current = setTimeout(doCalculation, 500)
      }
    },
    [profile]
  )

  /**
   * Manual refresh function for explicit recalculation
   */
  const refresh = useCallback(async () => {
    await recalculateEligibility(true)
  }, [recalculateEligibility])

  /**
   * Set up real-time listeners
   */
  useEffect(() => {
    // Clean up previous listeners
    unsubscribesRef.current.forEach(unsub => unsub())
    unsubscribesRef.current = []

    if (!profile?.id || !profile.currentWeek) {
      setEligibility(null)
      setLoading(false)
      return
    }

    const userId = profile.id
    const currentWeek = profile.currentWeek

    // 1. Listen to weeklyProgress for current week
    const weeklyProgressQuery = query(
      collection(db, 'weeklyProgress'),
      where('uid', '==', userId),
      where('weekNumber', '==', currentWeek)
    )

    const unsubWeeklyProgress = onSnapshot(
      weeklyProgressQuery,
      () => {
        recalculateEligibility(false)
      },
      (err) => {
        console.error('[useWeekAdvancementCriteria] weeklyProgress listener error:', err)
      }
    )

    unsubscribesRef.current.push(unsubWeeklyProgress)

    // 2. Listen to windowProgress for current window
    const windowProgressQuery = query(
      collection(db, 'windowProgress'),
      where('uid', '==', userId),
      where('journeyType', '==', profile.journeyType)
    )

    const unsubWindowProgress = onSnapshot(
      windowProgressQuery,
      () => {
        recalculateEligibility(false)
      },
      (err) => {
        console.error('[useWeekAdvancementCriteria] windowProgress listener error:', err)
      }
    )

    unsubscribesRef.current.push(unsubWindowProgress)

    // 3. Listen to pending approvals for current week
    const approvalsQuery = query(
      collection(db, 'points_verification_requests'),
      where('user_id', '==', userId),
      where('week', '==', currentWeek),
      where('status', '==', 'pending')
    )

    const unsubApprovals = onSnapshot(
      approvalsQuery,
      () => {
        recalculateEligibility(false)
      },
      (err) => {
        console.error('[useWeekAdvancementCriteria] approvals listener error:', err)
      }
    )

    unsubscribesRef.current.push(unsubApprovals)

    // Initial calculation
    recalculateEligibility(true)

    // Cleanup function
    return () => {
      unsubscribesRef.current.forEach(unsub => unsub())
      unsubscribesRef.current = []

      if (recalculateTimeoutRef.current) {
        clearTimeout(recalculateTimeoutRef.current)
      }
    }
  }, [profile, recalculateEligibility])

  return {
    eligibility,
    loading,
    error,
    refresh
  }
}
