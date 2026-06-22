import { supabase } from './supabase'

export interface PodcastState {
  watched: boolean
  watchedAt: Date | null
  passed: boolean
  bestScore: number
  attempts: number
  pointsAwardedAt: Date | null
}

export type UserPodcastProgressMap = Record<string, PodcastState>

interface PodcastProgressRow {
  podcast_id: string
  watched: boolean | null
  watched_at: string | null
  passed: boolean | null
  best_score: number | null
  attempts: number | null
  points_awarded_at: string | null
}

const toDate = (value: string | null): Date | null => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const emptyState = (): PodcastState => ({
  watched: false,
  watchedAt: null,
  passed: false,
  bestScore: 0,
  attempts: 0,
  pointsAwardedAt: null,
})

const mapRow = (row: PodcastProgressRow): PodcastState => ({
  watched: Boolean(row.watched),
  watchedAt: toDate(row.watched_at),
  passed: Boolean(row.passed),
  bestScore: Number(row.best_score ?? 0),
  attempts: Number(row.attempts ?? 0),
  pointsAwardedAt: toDate(row.points_awarded_at),
})

// Each subscription needs its OWN channel. supabase.channel(topic) returns an
// existing channel when the topic matches, so two components subscribing to the
// same user would share one channel and the second `.on()` after `.subscribe()`
// throws. A unique topic per call guarantees a fresh channel every time.
let podcastChannelSeq = 0

export function subscribeToPodcastProgress(
  uid: string,
  onUpdate: (progress: UserPodcastProgressMap) => void,
  onError?: (err: Error) => void,
) {
  let cancelled = false

  const load = async () => {
    const { data, error } = await supabase
      .from('podcast_progress')
      .select('podcast_id, watched, watched_at, passed, best_score, attempts, points_awarded_at')
      .eq('uid', uid)
    if (cancelled) return
    if (error) {
      console.error('[podcastProgressService] subscribe failed', error)
      onError?.(new Error(error.message))
      return
    }
    const next: UserPodcastProgressMap = {}
    ;(data ?? []).forEach((row) => {
      const r = row as PodcastProgressRow
      next[r.podcast_id] = mapRow(r)
    })
    onUpdate(next)
  }

  void load()

  const channel = supabase
    .channel(`podcast_progress_${uid}_${++podcastChannelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'podcast_progress', filter: `uid=eq.${uid}` },
      () => {
        void load()
      },
    )
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}

export async function markPodcastWatched(uid: string, podcastId: string): Promise<void> {
  const { error } = await supabase.from('podcast_progress').upsert(
    {
      uid,
      podcast_id: podcastId,
      watched: true,
      watched_at: new Date().toISOString(),
    },
    { onConflict: 'uid,podcast_id' },
  )
  if (error) throw new Error(error.message)
}

export async function recordAssessmentAttempt(
  uid: string,
  podcastId: string,
  score: number,
  passed: boolean,
  pointsAwardedNow: boolean,
  previousBestScore: number,
): Promise<void> {
  // Read the current row to increment attempts (self-paced quiz, no concurrency).
  const { data: existing, error: readError } = await supabase
    .from('podcast_progress')
    .select('attempts, points_awarded_at')
    .eq('uid', uid)
    .eq('podcast_id', podcastId)
    .maybeSingle()
  if (readError) throw new Error(readError.message)

  const attempts = Number((existing?.attempts as number | null) ?? 0) + 1
  const update: Record<string, unknown> = {
    uid,
    podcast_id: podcastId,
    attempts,
    passed,
    best_score: Math.max(previousBestScore, score),
  }
  // Only ever stamp points_awarded_at once, the first time points are awarded.
  if (pointsAwardedNow && !existing?.points_awarded_at) {
    update.points_awarded_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('podcast_progress')
    .upsert(update, { onConflict: 'uid,podcast_id' })
  if (error) throw new Error(error.message)
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
