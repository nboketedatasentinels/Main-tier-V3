import { useEffect, useState } from 'react'
import {
  subscribeToPodcastProgress,
  type UserPodcastProgressMap,
} from '@/services/podcastProgressService'

interface PodcastProgressResult {
  progress: UserPodcastProgressMap
  loading: boolean
  error: Error | null
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

  return { progress, loading, error }
}
