import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query, where, limit } from 'firebase/firestore'
import { db } from '@/services/firebase'
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

interface LedgerRow {
  uid: string
  activityId: string
  points: number
  weekNumber: number
  monthNumber?: number
  createdAt: { toDate: () => Date } | null
  source?: string
}

const activityMap = new Map<string, ActivityDef>(
  FULL_ACTIVITIES.map((a) => [a.id, a])
)

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
        const ledgerQuery = query(
          collection(db, 'pointsLedger'),
          where('uid', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(100)
        )

        const snapshot = await getDocs(ledgerQuery)
        const grouped: Record<string, ActivityHistoryEntry[]> = {}

        snapshot.docs.forEach((doc) => {
          const data = doc.data() as LedgerRow
          if (!data.activityId) return

          const canonicalActivityId = resolveCanonicalActivityId(data.activityId) ?? data.activityId
          const activityDef = activityMap.get(canonicalActivityId)
          const category = activityDef?.category || 'Other'
          const title = activityDef?.title || canonicalActivityId

          const entry: ActivityHistoryEntry = {
            id: doc.id,
            activityId: canonicalActivityId,
            activityTitle: title,
            points: data.points || 0,
            category,
            weekNumber: data.weekNumber || 0,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            source: data.source || 'unknown',
          }

          if (!grouped[category]) {
            grouped[category] = []
          }
          grouped[category].push(entry)
        })

        setActivityHistoryByCategory(grouped)
      } catch (err) {
        console.error('[useUserActivityHistory] Failed to fetch activity history:', err)
        setError('Failed to load activity history')
      } finally {
        setIsLoading(false)
      }
    }

    fetchActivityHistory()
  }, [userId])

  return {
    activityHistoryByCategory,
    isLoading,
    error,
  }
}
