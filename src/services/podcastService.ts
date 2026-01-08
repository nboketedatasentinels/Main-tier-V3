import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { JourneyType } from '@/config/pointsConfig'
import type { WeeklyPodcastEpisode } from '@/types'

const CACHE_TTL_MS = 5 * 60 * 1000
const podcastCache = new Map<string, { value: WeeklyPodcastEpisode | null; expiresAt: number }>()

const buildCacheKey = (weekNumber: number, journeyType: JourneyType) => `${journeyType}-${weekNumber}`

const resolveEpisodeForJourney = (
  snapshot: QuerySnapshot,
  journeyType: JourneyType,
): WeeklyPodcastEpisode | null => {
  if (snapshot.empty) return null
  const docs = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<WeeklyPodcastEpisode, 'id'>),
  })) as WeeklyPodcastEpisode[]

  return docs.find(doc => doc.journeyType === journeyType) ?? docs.find(doc => doc.journeyType === 'all') ?? docs[0]
}

export const getWeeklyPodcastEpisode = async (weekNumber: number, journeyType: JourneyType) => {
  const cacheKey = buildCacheKey(weekNumber, journeyType)
  const cached = podcastCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const podcastQuery = query(
    collection(db, 'weekly_content'),
    where('weekNumber', '==', weekNumber),
    where('journeyType', 'in', [journeyType, 'all']),
    where('isActive', '==', true),
  )

  const snapshot = await getDocs(podcastQuery)
  const episode = resolveEpisodeForJourney(snapshot, journeyType)
  podcastCache.set(cacheKey, { value: episode, expiresAt: Date.now() + CACHE_TTL_MS })
  return episode
}

export const listenToWeeklyPodcast = (
  weekNumber: number,
  journeyType: JourneyType,
  onUpdate: (episode: WeeklyPodcastEpisode | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const podcastQuery = query(
    collection(db, 'weekly_content'),
    where('weekNumber', '==', weekNumber),
    where('journeyType', 'in', [journeyType, 'all']),
    where('isActive', '==', true),
  )

  const cacheKey = buildCacheKey(weekNumber, journeyType)

  return onSnapshot(
    podcastQuery,
    snapshot => {
      const episode = resolveEpisodeForJourney(snapshot, journeyType)
      podcastCache.set(cacheKey, { value: episode, expiresAt: Date.now() + CACHE_TTL_MS })
      onUpdate(episode)
    },
    error => {
      onError?.(error as Error)
    },
  )
}
