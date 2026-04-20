import { useEffect, useMemo, useState } from 'react'
import {
  fetchLearnerSessionStats,
  subscribeToLearnersInOrg,
  type LearnerSessionStats,
} from '@/services/learnerAssignmentService'
import type { UserProfile } from '@/types'

export interface LearnerOverviewRow {
  learner: UserProfile
  learnerId: string
  mentorId: string | null
  stats: LearnerSessionStats
  flags: {
    noMentor: boolean
    zeroSessions: boolean
  }
}

export interface UseLearnerOverviewResult {
  rows: LearnerOverviewRow[]
  loading: boolean
  learnersError: string | null
  statsError: string | null
  refreshStats: () => void
}

const SESSIONS_STALE_MS = 60_000

export const useLearnerOverview = (companyId?: string | null): UseLearnerOverviewResult => {
  const [learners, setLearners] = useState<UserProfile[]>([])
  const [learnersLoading, setLearnersLoading] = useState<boolean>(Boolean(companyId))
  const [learnersError, setLearnersError] = useState<string | null>(null)
  const [stats, setStats] = useState<Record<string, LearnerSessionStats>>({})
  const [statsLoading, setStatsLoading] = useState<boolean>(false)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [statsKey, setStatsKey] = useState(0)
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0)

  // Subscribe to learners in org
  useEffect(() => {
    if (!companyId) {
      setLearners([])
      setLearnersLoading(false)
      setLearnersError(null)
      return () => undefined
    }
    setLearnersLoading(true)
    setLearnersError(null)
    const unsubscribe = subscribeToLearnersInOrg(
      companyId,
      (next) => {
        setLearners(next)
        setLearnersLoading(false)
      },
      (err) => {
        setLearnersError(err.message)
        setLearnersLoading(false)
      },
    )
    return () => unsubscribe()
  }, [companyId])

  // Fetch session stats whenever the learner list changes or a refresh is triggered
  useEffect(() => {
    if (!companyId || learners.length === 0) {
      setStats({})
      return
    }
    const now = Date.now()
    if (statsKey === 0 && now - lastFetchedAt < SESSIONS_STALE_MS && Object.keys(stats).length > 0) {
      return
    }

    let cancelled = false
    setStatsLoading(true)
    setStatsError(null)

    fetchLearnerSessionStats(learners.map((l) => l.id))
      .then((next) => {
        if (cancelled) return
        setStats(next)
        setLastFetchedAt(Date.now())
        setStatsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setStatsError(err instanceof Error ? err.message : String(err))
        setStatsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, learners, statsKey, lastFetchedAt, stats])

  const rows = useMemo<LearnerOverviewRow[]>(() => {
    return learners.map((learner) => {
      const learnerStats: LearnerSessionStats = stats[learner.id] ?? {
        learnerId: learner.id,
        mentorSessionsCompleted: 0,
        mentorSessionsPending: 0,
        ambassadorSessionsAttended: 0,
        ambassadorSessionsBooked: 0,
      }
      const mentorId = (learner as unknown as { mentorId?: string | null }).mentorId ?? null
      const noMentor = !mentorId
      const zeroSessions =
        learnerStats.mentorSessionsCompleted === 0 &&
        learnerStats.ambassadorSessionsAttended === 0
      return {
        learner,
        learnerId: learner.id,
        mentorId,
        stats: learnerStats,
        flags: { noMentor, zeroSessions },
      }
    })
  }, [learners, stats])

  return {
    rows,
    loading: learnersLoading || statsLoading,
    learnersError,
    statsError,
    refreshStats: () => setStatsKey((k) => k + 1),
  }
}
