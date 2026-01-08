import type { Timestamp } from 'firebase/firestore'
import type { JourneyType } from '@/config/pointsConfig'

export type PodcastJourneyType = JourneyType | 'all'

export type WeeklyPodcastEpisode = {
  id: string
  weekNumber: number
  journeyType: PodcastJourneyType
  title: string
  description?: string
  videoUrl?: string
  thumbnailUrl?: string
  duration?: string
  isActive: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type WeeklyPodcastInput = Omit<WeeklyPodcastEpisode, 'id' | 'createdAt' | 'updatedAt'>
