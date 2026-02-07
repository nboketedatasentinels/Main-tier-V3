import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/services/firebase'

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
  const maybeTimestamp = value as { toDate?: () => Date }
  if (maybeTimestamp?.toDate) {
    return maybeTimestamp.toDate().toISOString()
  }
  return undefined
}

export function useUserWeeklyProgressSnapshot(userId?: string | null, weekNumber?: number | null) {
  const [weeklyProgress, setWeeklyProgress] = useState<UserWeeklyProgressSnapshot | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<UserPendingApprovalsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const docId = useMemo(() => {
    if (!userId || !weekNumber) return null
    return `${userId}__${weekNumber}`
  }, [userId, weekNumber])

  useEffect(() => {
    setWeeklyProgress(null)
    setPendingApprovals(null)
    setError(null)

    if (!userId || !weekNumber || !docId) {
      setLoading(false)
      return
    }

    setLoading(true)

    const unsubscribers: Unsubscribe[] = []

    unsubscribers.push(
      onSnapshot(
        doc(db, 'weeklyProgress', docId),
        (snapshot) => {
          const data = snapshot.data() as
            | {
                weekNumber?: number
                pointsEarned?: number
                engagementCount?: number
                status?: string
                updatedAt?: unknown
              }
            | undefined

          if (!snapshot.exists() || !data) {
            setWeeklyProgress({
              weekNumber,
              pointsEarned: 0,
              engagementCount: 0,
              status: undefined,
              updatedAt: undefined,
            })
            setLoading(false)
            return
          }

          setWeeklyProgress({
            weekNumber: typeof data.weekNumber === 'number' ? data.weekNumber : weekNumber,
            pointsEarned: typeof data.pointsEarned === 'number' ? data.pointsEarned : 0,
            engagementCount: typeof data.engagementCount === 'number' ? data.engagementCount : 0,
            status: data.status,
            updatedAt: normalizeDateString(data.updatedAt),
          })
          setLoading(false)
        },
        (err) => {
          console.error('[useUserWeeklyProgressSnapshot] weeklyProgress listener error:', err)
          setError(err instanceof Error ? err.message : 'Unable to load weekly progress')
          setLoading(false)
        },
      ),
    )

    unsubscribers.push(
      onSnapshot(
        query(
          collection(db, 'points_verification_requests'),
          where('user_id', '==', userId),
          where('week', '==', weekNumber),
          where('status', '==', 'pending'),
        ),
        (snapshot) => {
          let points = 0
          snapshot.docs.forEach((docItem) => {
            const data = docItem.data() as { points?: unknown } | undefined
            const value = typeof data?.points === 'number' ? data.points : Number(data?.points)
            if (!Number.isNaN(value)) points += value
          })
          setPendingApprovals({ count: snapshot.size, points })
        },
        (err) => {
          console.error('[useUserWeeklyProgressSnapshot] approvals listener error:', err)
          setError((prev) => prev ?? (err instanceof Error ? err.message : 'Unable to load approvals'))
        },
      ),
    )

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [docId, userId, weekNumber])

  return {
    weeklyProgress,
    pendingApprovals,
    loading,
    error,
  }
}

