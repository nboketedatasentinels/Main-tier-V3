import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/services/firebase'

export interface UserChecklistProgressSnapshot {
  weekNumber: number
  totalActivities: number
  completedActivities: number
  updatedAt?: string
}

const normalizeDateString = (value?: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  const maybeTimestamp = value as { toDate?: () => Date }
  if (maybeTimestamp?.toDate) return maybeTimestamp.toDate().toISOString()
  return undefined
}

export function useUserChecklistProgressSnapshot(userId?: string | null, weekNumber?: number | null) {
  const [checklistProgress, setChecklistProgress] = useState<UserChecklistProgressSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const docId = useMemo(() => {
    if (!userId || !weekNumber) return null
    return `${userId}_${weekNumber}`
  }, [userId, weekNumber])

  useEffect(() => {
    setChecklistProgress(null)
    setError(null)

    if (!userId || !weekNumber || !docId) {
      setLoading(false)
      return
    }

    setLoading(true)

    let unsubscribe: Unsubscribe | null = null
    unsubscribe = onSnapshot(
      doc(db, 'checklists', docId),
      (snapshot) => {
        const data = snapshot.data() as
          | {
              activities?: { status?: unknown }[]
              updatedAt?: unknown
            }
          | undefined

        const activities = Array.isArray(data?.activities) ? data?.activities : []
        const totalActivities = activities.length
        const completedActivities = activities.filter((activity) => activity?.status === 'completed').length

        setChecklistProgress({
          weekNumber,
          totalActivities,
          completedActivities,
          updatedAt: normalizeDateString(data?.updatedAt),
        })
        setLoading(false)
      },
      (err) => {
        console.error('[useUserChecklistProgressSnapshot] checklist listener error:', err)
        setError(err instanceof Error ? err.message : 'Unable to load checklist progress')
        setLoading(false)
      },
    )

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [docId, userId, weekNumber])

  return { checklistProgress, loading, error }
}

