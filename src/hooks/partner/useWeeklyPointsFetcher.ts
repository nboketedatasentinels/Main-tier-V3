import { useCallback, useRef } from 'react'
import { collection, collectionGroup, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { WeeklyPointsRecord } from '@/utils/partnerProgress'
import { logger } from '@/utils/partnerDashboardUtils'

// ============================================================================
// FIX: Fetch actual total points from pointsLedger collection
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
  const batches: string[][] = []

  // Initialize all users with 0 points
  userIds.forEach((uid) => {
    pointsByUser[uid] = 0
  })

  // Firestore 'in' queries support max 30 values
  for (let i = 0; i < userIds.length; i += 30) {
    batches.push(userIds.slice(i, i + 30))
  }

  for (const batch of batches) {
    try {
      const ledgerQuery = query(
        collection(db, 'pointsLedger'),
        where('uid', 'in', batch)
      )
      const snapshot = await getDocs(ledgerQuery)
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data()
        const uid = data.uid as string
        const points = typeof data.points === 'number' ? data.points : 0
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

const getErrorCode = (error: unknown): string => {
  return (error as { code?: string })?.code ?? ''
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
        const batches: string[][] = []
        let collectionGroupPermissionDenied = false

        // Firestore 'in' queries support max 30 values
        for (let i = 0; i < userIds.length; i += 10) {
          batches.push(userIds.slice(i, i + 10))
        }

        // Try collection group query first (newer data structure)
        for (const batch of batches) {
          try {
            const weeklyQuery = query(
              collectionGroup(db, 'weekly_points'),
              where('user_id', 'in', batch)
            )
            const weeklySnapshot = await getDocs(weeklyQuery)
            weeklySnapshot.docs.forEach((docSnap) => {
              const data = docSnap.data() as WeeklyPointsRecord
              if (!data.user_id) return
              pointsByUser[data.user_id] = [...(pointsByUser[data.user_id] || []), data]
            })
          } catch (error) {
            if (getErrorCode(error) === 'permission-denied') {
              collectionGroupPermissionDenied = true
              logger.warn('Collection group weekly_points query denied; falling back to legacy collection.', {
                batchSize: batch.length,
              })
            } else {
              logger.error(`Failed to fetch weekly points for batch`, error)
              errors.push({ batch, error })
            }
          }
        }

        // Fallback to top-level collection if no data was found and either:
        // 1) no collection-group errors occurred, or
        // 2) collection-group reads are denied by rules in this environment.
        if (
          !Object.keys(pointsByUser).length &&
          userIds.length &&
          (!errors.length || collectionGroupPermissionDenied)
        ) {
          for (const batch of batches) {
            try {
              const legacyQuery = query(
                collection(db, 'weekly_points'),
                where('user_id', 'in', batch)
              )
              const legacySnapshot = await getDocs(legacyQuery)
              legacySnapshot.docs.forEach((docSnap) => {
                const data = docSnap.data() as WeeklyPointsRecord
                if (!data.user_id) return
                pointsByUser[data.user_id] = [...(pointsByUser[data.user_id] || []), data]
              })
            } catch (error) {
              logger.error(`Failed to fetch legacy weekly points for batch`, error)
              errors.push({ batch, error })
            }
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
