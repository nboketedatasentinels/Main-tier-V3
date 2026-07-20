import { useEffect, useMemo, useRef, useState } from 'react'
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
  // Throttle timestamp lives in a ref, not state: it is both read and written
  // by the stats effect, so keeping it in state (and thus in the dep array)
  // would make the effect retrigger itself.
  const lastFetchedAtRef = useRef<number>(0)

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
      // Reuse the existing empty object when it is already empty. Returning a
      // fresh {} here would change the `stats` reference and — because this
      // effect used to depend on `stats` — retrigger itself forever for any
      // org with no matching learners (tight render loop + realtime resubscribe
      // storm + DevTools "form field" flood). See course-approvals bug.
      setStats((prev) => (Object.keys(prev).length === 0 ? prev : {}))
      return
    }
    const now = Date.now()
    if (statsKey === 0 && now - lastFetchedAtRef.current < SESSIONS_STALE_MS) {
      return
    }

    let cancelled = false
    setStatsLoading(true)
    setStatsError(null)

    fetchLearnerSessionStats(learners.map((l) => l.id))
      .then((next) => {
        if (cancelled) return
        setStats(next)
        lastFetchedAtRef.current = Date.now()
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
  }, [companyId, learners, statsKey])

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
