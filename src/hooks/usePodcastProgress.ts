import { useCallback, useEffect, useState } from 'react'
import {
  subscribeToPodcastProgress,
  type PodcastState,
  type UserPodcastProgressMap,
} from '@/services/podcastProgressService'

interface PodcastProgressResult {
  progress: UserPodcastProgressMap
  loading: boolean
  error: Error | null
  /** Merge a single podcast's state immediately (before realtime catches up). */
  patchProgress: (podcastId: string, state: PodcastState) => void
}

export function usePodcastProgress(uid: string | null | undefined): PodcastProgressResult {
  const [progress, setProgress] = useState<UserPodcastProgressMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!uid) {
      setProgress({})
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToPodcastProgress(
      uid,
      (next) => {
        setProgress(next)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [uid])

  const patchProgress = useCallback((podcastId: string, state: PodcastState) => {
    setProgress((prev) => ({
      ...prev,
      [podcastId]: {
        ...prev[podcastId],
        ...state,
        // Once passed in local state, keep it - never regress on a stale fetch race.
        passed: Boolean(prev[podcastId]?.passed || state.passed),
        bestScore: Math.max(prev[podcastId]?.bestScore ?? 0, state.bestScore ?? 0),
        attempts: Math.max(prev[podcastId]?.attempts ?? 0, state.attempts ?? 0),
        watched: Boolean(prev[podcastId]?.watched || state.watched),
        watchedAt: state.watchedAt ?? prev[podcastId]?.watchedAt ?? null,
        pointsAwardedAt: state.pointsAwardedAt ?? prev[podcastId]?.pointsAwardedAt ?? null,
      },
    }))
  }, [])

  return { progress, loading, error, patchProgress }
}
