import { useEffect, useState } from 'react'
import { subscribeToChecklist } from '@/services/checklistService'

export interface UserChecklistProgressSnapshot {
  weekNumber: number
  totalActivities: number
  completedActivities: number
  updatedAt?: string
}

/**
 * Live checklist progress for one learner's week, read from the Supabase
 * `checklists` table (migration 0035). Partner/admin read access is granted by
 * that table's RLS, which is what lets a partner dashboard watch a learner.
 */
export function useUserChecklistProgressSnapshot(userId?: string | null, weekNumber?: number | null) {
  const [checklistProgress, setChecklistProgress] = useState<UserChecklistProgressSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setChecklistProgress(null)
    setError(null)

    if (!userId || !weekNumber) {
      setLoading(false)
      return
    }

    setLoading(true)

    const unsubscribe = subscribeToChecklist(
      { userId, weekNumber },
      (snapshot) => {
        const activities = snapshot.activities
        setChecklistProgress({
          weekNumber,
          totalActivities: activities.length,
          completedActivities: activities.filter((activity) => activity?.status === 'completed').length,
          updatedAt: snapshot.updatedAt,
        })
        setLoading(false)
      },
      (err) => {
        console.error('[useUserChecklistProgressSnapshot] checklist listener error:', err)
        setError(err instanceof Error ? err.message : 'Unable to load checklist progress')
        setLoading(false)
      },
    )

    return unsubscribe
  }, [userId, weekNumber])

  return { checklistProgress, loading, error }
}
