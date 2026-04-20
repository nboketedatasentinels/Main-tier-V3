import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
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
  if (typeof raw === 'object' && raw && 'toDate' in raw && typeof (raw as { toDate?: unknown }).toDate === 'function') {
    try {
      return (raw as { toDate: () => Date }).toDate()
    } catch {
      return new Date()
    }
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
        const [txSnap, impactSnap] = await Promise.all([
          getDocs(query(collection(db, 'points_transactions'), where('userId', '==', userId))),
          getDocs(query(collection(db, 'impact_logs'), where('userId', '==', userId))),
        ])

        const impactLogsById = new Map<string, Record<string, unknown>>()
        impactSnap.docs.forEach((logDoc) => {
          impactLogsById.set(logDoc.id, logDoc.data() as Record<string, unknown>)
        })

        const grouped: Record<string, ActivityHistoryEntry[]> = {}

        txSnap.docs.forEach((txDoc) => {
          const data = txDoc.data() as Record<string, unknown>
          const pointsRaw =
            typeof data.pointsAwarded === 'number'
              ? data.pointsAwarded
              : typeof data.points === 'number'
              ? (data.points as number)
              : 0
          const points = Number(pointsRaw) || 0
          if (points <= 0) return

          const sourceType = data.sourceType as string | undefined
          const sourceId = data.sourceId as string | undefined
          const reason = data.reason as string | undefined
          const rawCategory = (data.category as string | undefined)?.trim()
          const activityIdRaw = data.activityId as string | undefined
          const createdAt = parseCreatedAt(data.createdAt ?? data.awardedAt)

          let category = rawCategory || 'Other'
          let title = reason || 'Activity'
          let activityId = activityIdRaw || sourceType || txDoc.id

          if (sourceType === 'impact_log_entry' && sourceId) {
            const logData = impactLogsById.get(sourceId)
            const categoryGroup = (logData?.categoryGroup as string | undefined) || 'business'
            category = categoryGroup === 'esg' ? 'ESG Impact' : 'Business Impact'
            title = (logData?.title as string | undefined) || 'Impact Log Entry'
            activityId = `impact_${sourceId}`
          } else if (activityIdRaw) {
            const canonical = resolveCanonicalActivityId(activityIdRaw) ?? activityIdRaw
            const def = activityMap.get(canonical)
            if (def) {
              title = reason || def.title
              category = rawCategory || def.category || category
              activityId = canonical
            }
          }

          const entry: ActivityHistoryEntry = {
            id: txDoc.id,
            activityId,
            activityTitle: title,
            points,
            category,
            weekNumber: typeof data.weekNumber === 'number' ? (data.weekNumber as number) : 0,
            createdAt,
            source: 'points_transactions',
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
