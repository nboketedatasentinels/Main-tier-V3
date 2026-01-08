import { useEffect, useState } from 'react'
import type { JourneyType } from '@/config/pointsConfig'
import type { WeeklyPodcastEpisode } from '@/types'
import { getWeeklyPodcastEpisode, listenToWeeklyPodcast } from '@/services/podcastService'

export const useWeeklyPodcastEpisode = (weekNumber: number, journeyType?: JourneyType) => {
  const [episode, setEpisode] = useState<WeeklyPodcastEpisode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!journeyType || !weekNumber) return
    let isMounted = true
    setLoading(true)
    setError(null)

    getWeeklyPodcastEpisode(weekNumber, journeyType)
      .then(result => {
        if (!isMounted) return
        setEpisode(result)
        setLoading(false)
      })
      .catch(err => {
        if (!isMounted) return
        setError(err as Error)
        setLoading(false)
      })

    const unsubscribe = listenToWeeklyPodcast(
      weekNumber,
      journeyType,
      result => {
        if (!isMounted) return
        setEpisode(result)
        setLoading(false)
      },
      err => {
        if (!isMounted) return
        setError(err)
        setLoading(false)
      },
    )

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [journeyType, weekNumber])

  return { episode, loading, error }
}
