import { useEffect, useMemo, useState } from 'react'
import {
  groupSessionsByStatus,
  subscribeToLearnerMentorshipSessions,
  subscribeToMentorMentorshipSessions,
  type MentorshipSession,
  type MentorshipSessionStatus,
} from '@/services/mentorshipService'

export interface UseMentorshipSessionsResult {
  sessions: MentorshipSession[]
  byStatus: Record<MentorshipSessionStatus, MentorshipSession[]>
  loading: boolean
  error: string | null
}

const useMentorshipSessionsSubscription = (
  subscribe:
    | ((
        id: string,
        onUpdate: (sessions: MentorshipSession[]) => void,
        onError?: (error: Error) => void,
      ) => () => void)
    | null,
  id: string | null | undefined,
): UseMentorshipSessionsResult => {
  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(id && subscribe))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !subscribe) {
      setSessions([])
      setLoading(false)
      setError(null)
      return () => undefined
    }

    setLoading(true)
    setError(null)

    const unsubscribe = subscribe(
      id,
      (next) => {
        setSessions(next)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [id, subscribe])

  const byStatus = useMemo(() => groupSessionsByStatus(sessions), [sessions])

  return { sessions, byStatus, loading, error }
}

export const useLearnerMentorshipSessions = (
  learnerId?: string | null,
): UseMentorshipSessionsResult =>
  useMentorshipSessionsSubscription(
    subscribeToLearnerMentorshipSessions,
    learnerId ?? null,
  )

export const useMentorMentorshipSessions = (
  mentorId?: string | null,
): UseMentorshipSessionsResult =>
  useMentorshipSessionsSubscription(
    subscribeToMentorMentorshipSessions,
    mentorId ?? null,
  )
