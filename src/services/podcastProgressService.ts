import {
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

export interface PodcastState {
  watched: boolean
  watchedAt: Date | null
  passed: boolean
  bestScore: number
  attempts: number
  pointsAwardedAt: Date | null
}

export type UserPodcastProgressMap = Record<string, PodcastState>

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const candidate = value as { toDate?: () => Date }
    if (typeof candidate.toDate === 'function') return candidate.toDate()
  }
  return null
}

const emptyState = (): PodcastState => ({
  watched: false,
  watchedAt: null,
  passed: false,
  bestScore: 0,
  attempts: 0,
  pointsAwardedAt: null,
})

const docRef = (uid: string) => doc(db, 'podcastProgress', uid)

export function subscribeToPodcastProgress(
  uid: string,
  onUpdate: (progress: UserPodcastProgressMap) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    docRef(uid),
    (snapshot) => {
      const data = (snapshot.data() ?? {}) as DocumentData
      const podcasts = (data.podcasts ?? {}) as Record<string, DocumentData>
      const next: UserPodcastProgressMap = {}
      Object.entries(podcasts).forEach(([podcastId, state]) => {
        next[podcastId] = {
          watched: Boolean(state.watched),
          watchedAt: toDate(state.watchedAt),
          passed: Boolean(state.passed),
          bestScore: Number(state.bestScore ?? 0),
          attempts: Number(state.attempts ?? 0),
          pointsAwardedAt: toDate(state.pointsAwardedAt),
        }
      })
      onUpdate(next)
    },
    (err) => {
      console.error('[podcastProgressService] subscribe failed', err)
      onError?.(err)
    },
  )
}

export async function markPodcastWatched(uid: string, podcastId: string): Promise<void> {
  await setDoc(
    docRef(uid),
    {
      podcasts: {
        [podcastId]: {
          watched: true,
          watchedAt: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function recordAssessmentAttempt(
  uid: string,
  podcastId: string,
  score: number,
  passed: boolean,
  pointsAwardedNow: boolean,
  previousBestScore: number,
): Promise<void> {
  // Ensure the doc exists first so the dotted-path update can succeed.
  await setDoc(docRef(uid), { uid, createdAt: serverTimestamp() }, { merge: true })

  const updates: Record<string, unknown> = {
    [`podcasts.${podcastId}.attempts`]: increment(1),
    [`podcasts.${podcastId}.passed`]: passed,
    [`podcasts.${podcastId}.bestScore`]: Math.max(previousBestScore, score),
    updatedAt: serverTimestamp(),
  }
  if (pointsAwardedNow) {
    updates[`podcasts.${podcastId}.pointsAwardedAt`] = serverTimestamp()
  }
  await updateDoc(docRef(uid), updates)
}

/**
 * Convenience: read-only default for when the user has no prior progress.
 */
export function getPodcastState(
  progress: UserPodcastProgressMap | null,
  podcastId: string,
): PodcastState {
  return progress?.[podcastId] ?? emptyState()
}
