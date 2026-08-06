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

interface StoredPodcastState {
  watched?: boolean
  watchedAt?: string | null
  passed?: boolean
  bestScore?: number
  attempts?: number
  pointsAwardedAt?: string | null
}

const PROFILE_PODCAST_KEY = 'podcastProgress'

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

const serializeState = (state: PodcastState): StoredPodcastState => ({
  watched: state.watched,
  watchedAt: state.watchedAt?.toISOString() ?? null,
  passed: state.passed,
  bestScore: state.bestScore,
  attempts: state.attempts,
  pointsAwardedAt: state.pointsAwardedAt?.toISOString() ?? null,
})

const deserializeState = (raw: StoredPodcastState | undefined): PodcastState => {
  if (!raw) return emptyState()
  return {
    watched: Boolean(raw.watched),
    watchedAt: toDate(raw.watchedAt ?? null),
    passed: Boolean(raw.passed),
    bestScore: Number(raw.bestScore ?? 0),
    attempts: Number(raw.attempts ?? 0),
    pointsAwardedAt: toDate(raw.pointsAwardedAt ?? null),
  }
}

const mergeStates = (a: PodcastState, b: PodcastState): PodcastState => ({
  watched: a.watched || b.watched,
  watchedAt: a.watchedAt ?? b.watchedAt,
  // Once passed, stay passed.
  passed: a.passed || b.passed,
  bestScore: Math.max(a.bestScore, b.bestScore),
  attempts: Math.max(a.attempts, b.attempts),
  pointsAwardedAt: a.pointsAwardedAt ?? b.pointsAwardedAt,
})

const mapRpcResult = (data: Record<string, unknown>, fallback: PodcastState): PodcastState =>
  mergeStates(
    {
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
    },
    fallback,
  )

let podcastChannelSeq = 0

/**
 * Reliable fallback store: profiles.data.podcastProgress.
 * Profiles self-update already works in production; podcast_progress may not
 * exist / may lack grants until migration 0036 is applied.
 */
async function loadProgressFromProfile(uid: string): Promise<UserPodcastProgressMap> {
  const { data, error } = await supabase.from('profiles').select('data').eq('id', uid).maybeSingle()
  if (error) {
    console.warn('[podcastProgressService] profile read failed', error.message)
    return {}
  }
  const bag = (data?.data as Record<string, unknown> | null)?.[PROFILE_PODCAST_KEY]
  if (!bag || typeof bag !== 'object') return {}
  const next: UserPodcastProgressMap = {}
  Object.entries(bag as Record<string, StoredPodcastState>).forEach(([id, raw]) => {
    next[id] = deserializeState(raw)
  })
  return next
}

async function saveProgressToProfile(
  uid: string,
  podcastId: string,
  state: PodcastState,
): Promise<void> {
  const { data, error: readError } = await supabase
    .from('profiles')
    .select('data')
    .eq('id', uid)
    .maybeSingle()
  if (readError) throw new Error(readError.message)

  const existingData =
    data?.data && typeof data.data === 'object' && !Array.isArray(data.data)
      ? { ...(data.data as Record<string, unknown>) }
      : {}
  const existingBag =
    existingData[PROFILE_PODCAST_KEY] &&
    typeof existingData[PROFILE_PODCAST_KEY] === 'object' &&
    !Array.isArray(existingData[PROFILE_PODCAST_KEY])
      ? { ...(existingData[PROFILE_PODCAST_KEY] as Record<string, StoredPodcastState>) }
      : {}

  const prev = deserializeState(existingBag[podcastId])
  existingBag[podcastId] = serializeState(mergeStates(prev, state))
  existingData[PROFILE_PODCAST_KEY] = existingBag

  const { error: writeError } = await supabase
    .from('profiles')
    .update({ data: existingData })
    .eq('id', uid)
  if (writeError) throw new Error(writeError.message)
}

async function loadProgressFromTable(uid: string): Promise<UserPodcastProgressMap> {
  const { data, error } = await supabase
    .from('podcast_progress')
    .select('podcast_id, watched, watched_at, passed, best_score, attempts, points_awarded_at')
    .eq('uid', uid)
  if (error) {
    console.warn('[podcastProgressService] table read failed', error.message)
    return {}
  }
  const next: UserPodcastProgressMap = {}
  ;(data ?? []).forEach((row) => {
    const r = row as PodcastProgressRow
    next[r.podcast_id] = mapRow(r)
  })
  return next
}

function mergeProgressMaps(
  primary: UserPodcastProgressMap,
  secondary: UserPodcastProgressMap,
): UserPodcastProgressMap {
  const ids = new Set([...Object.keys(primary), ...Object.keys(secondary)])
  const next: UserPodcastProgressMap = {}
  ids.forEach((id) => {
    const a = primary[id]
    const b = secondary[id]
    if (a && b) next[id] = mergeStates(a, b)
    else next[id] = a ?? b ?? emptyState()
  })
  return next
}

export function subscribeToPodcastProgress(
  uid: string,
  onUpdate: (progress: UserPodcastProgressMap) => void,
  onError?: (err: Error) => void,
) {
  let cancelled = false

  const load = async () => {
    try {
      const [tableProgress, profileProgress] = await Promise.all([
        loadProgressFromTable(uid),
        loadProgressFromProfile(uid),
      ])
      if (cancelled) return
      onUpdate(mergeProgressMaps(tableProgress, profileProgress))
    } catch (err) {
      if (cancelled) return
      console.error('[podcastProgressService] subscribe failed', err)
      onError?.(err instanceof Error ? err : new Error('Failed to load podcast progress'))
    }
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
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
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

async function upsertPodcastProgressTable(
  payload: Record<string, unknown>,
  fallback: PodcastState,
): Promise<PodcastState> {
  const uid = String(payload.uid ?? '')
  const podcastId = String(payload.podcast_id ?? '')
  const { data: existing, error: readError } = await supabase
    .from('podcast_progress')
    .select('attempts, points_awarded_at, passed, best_score, watched, watched_at')
    .eq('uid', uid)
    .eq('podcast_id', podcastId)
    .maybeSingle()
  if (readError) throw new Error(readError.message)

  const isQuizWrite =
    Object.prototype.hasOwnProperty.call(payload, 'score') ||
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

async function callRecordPodcastProgress(
  payload: Record<string, unknown>,
  fallback: PodcastState,
): Promise<PodcastState> {
  const uid = String(payload.uid ?? '')
  const podcastId = String(payload.podcast_id ?? '')
  if (!uid || !podcastId) throw new Error('uid and podcast_id are required')

  let saved: PodcastState | null = null
  const errors: string[] = []

  // 1) Preferred: SECURITY DEFINER RPC (migration 0036)
  try {
    const { data, error } = await supabase.rpc('record_podcast_progress', { p: payload })
    if (error) throw new Error(error.message)
    const row = (data ?? {}) as Record<string, unknown>
    if (row.ok === false) {
      throw new Error(typeof row.error === 'string' ? row.error : 'podcast_progress_failed')
    }
    saved = mapRpcResult(row, fallback)
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
  }

  // 2) Direct table upsert
  if (!saved) {
    try {
      saved = await upsertPodcastProgressTable(payload, fallback)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  // 3) Always persist to profiles.data - this is the production-safe path when
  // podcast_progress isn't migrated yet. If this succeeds, the learner keeps
  // their pass even when (1)/(2) fail.
  const stateForProfile = saved ?? fallback
  try {
    await saveProgressToProfile(uid, podcastId, stateForProfile)
    // Profile write succeeded - treat as saved even if table/RPC failed.
    saved = stateForProfile
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
  }

  if (!saved) {
    throw new Error(errors.filter(Boolean).join(' | ') || 'Could not save podcast progress')
  }

  if (errors.length) {
    console.warn('[podcastProgressService] partial save; profile/table fallback used', errors)
  }

  return saved
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
  previousAttempts = 0,
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
      attempts: previousAttempts + 1,
      pointsAwardedAt: pointsAwardedNow && passed ? new Date() : null,
    },
  )
}

export function getPodcastState(
  progress: UserPodcastProgressMap | null,
  podcastId: string,
): PodcastState {
  return progress?.[podcastId] ?? emptyState()
}
