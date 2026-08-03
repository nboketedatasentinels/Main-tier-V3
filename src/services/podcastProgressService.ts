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

const toDate = (value: string | null | undefined): Date | null => {
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

const mapRpcResult = (data: Record<string, unknown>, fallback: PodcastState): PodcastState => ({
  watched: Boolean(data.watched ?? fallback.watched),
  watchedAt: toDate(
    typeof data.watched_at === 'string'
      ? data.watched_at
      : fallback.watchedAt?.toISOString() ?? null,
  ),
  passed: Boolean(data.passed ?? fallback.passed),
  bestScore: Number(data.best_score ?? fallback.bestScore ?? 0),
  attempts: Number(data.attempts ?? fallback.attempts ?? 0),
  pointsAwardedAt: toDate(
    typeof data.points_awarded_at === 'string'
      ? data.points_awarded_at
      : fallback.pointsAwardedAt?.toISOString() ?? null,
  ),
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

async function callRecordPodcastProgress(
  payload: Record<string, unknown>,
  fallback: PodcastState,
): Promise<PodcastState> {
  const { data, error } = await supabase.rpc('record_podcast_progress', { p: payload })
  if (!error) {
    const row = (data ?? {}) as Record<string, unknown>
    if (row.ok === false) {
      throw new Error(typeof row.error === 'string' ? row.error : 'podcast_progress_failed')
    }
    return mapRpcResult(row, fallback)
  }

  // Fallback for envs that haven't applied 0036 yet — direct upsert.
  const message = error.message || ''
  const missingRpc =
    message.includes('record_podcast_progress') ||
    message.includes('Could not find the function') ||
    message.toLowerCase().includes('schema cache')
  if (!missingRpc) throw new Error(message)

  console.warn('[podcastProgressService] RPC missing; falling back to table upsert', message)
  const uid = String(payload.uid ?? '')
  const podcastId = String(payload.podcast_id ?? '')
  const { data: existing, error: readError } = await supabase
    .from('podcast_progress')
    .select('attempts, points_awarded_at, passed, best_score, watched, watched_at')
    .eq('uid', uid)
    .eq('podcast_id', podcastId)
    .maybeSingle()
  if (readError) throw new Error(readError.message)

  const isQuizWrite = Object.prototype.hasOwnProperty.call(payload, 'score') ||
    Object.prototype.hasOwnProperty.call(payload, 'passed')
  const update: Record<string, unknown> = {
    uid,
    podcast_id: podcastId,
    watched: Boolean(payload.watched) || Boolean(existing?.watched),
    passed: Boolean(payload.passed) || Boolean(existing?.passed),
    best_score: Math.max(
      Number(existing?.best_score ?? 0),
      Number(payload.score ?? 0),
      fallback.bestScore,
    ),
  }
  if (payload.watched && !existing?.watched_at) {
    update.watched_at = new Date().toISOString()
  }
  if (isQuizWrite) {
    update.attempts = Number(existing?.attempts ?? 0) + 1
  }
  if (payload.award_points && (payload.passed || existing?.passed) && !existing?.points_awarded_at) {
    update.points_awarded_at = new Date().toISOString()
  }

  const { error: upsertError } = await supabase
    .from('podcast_progress')
    .upsert(update, { onConflict: 'uid,podcast_id' })
  if (upsertError) throw new Error(upsertError.message)

  return {
    watched: Boolean(update.watched),
    watchedAt: update.watched_at
      ? new Date(String(update.watched_at))
      : existing?.watched_at
        ? new Date(String(existing.watched_at))
        : fallback.watchedAt,
    passed: Boolean(update.passed),
    bestScore: Number(update.best_score ?? 0),
    attempts: Number(update.attempts ?? existing?.attempts ?? fallback.attempts),
    pointsAwardedAt: update.points_awarded_at
      ? new Date(String(update.points_awarded_at))
      : existing?.points_awarded_at
        ? new Date(String(existing.points_awarded_at))
        : fallback.pointsAwardedAt,
  }
}

export async function markPodcastWatched(uid: string, podcastId: string): Promise<PodcastState> {
  return callRecordPodcastProgress(
    {
      uid,
      podcast_id: podcastId,
      watched: true,
    },
    {
      ...emptyState(),
      watched: true,
      watchedAt: new Date(),
    },
  )
}

export async function recordAssessmentAttempt(
  uid: string,
  podcastId: string,
  score: number,
  passed: boolean,
  pointsAwardedNow: boolean,
  previousBestScore: number,
): Promise<PodcastState> {
  return callRecordPodcastProgress(
    {
      uid,
      podcast_id: podcastId,
      watched: true,
      passed,
      score,
      award_points: pointsAwardedNow && passed,
    },
    {
      watched: true,
      watchedAt: new Date(),
      passed,
      bestScore: Math.max(previousBestScore, score),
      attempts: 1,
      pointsAwardedAt: pointsAwardedNow && passed ? new Date() : null,
    },
  )
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
