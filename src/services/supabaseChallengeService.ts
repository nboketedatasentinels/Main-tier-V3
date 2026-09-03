/**
 * Peer challenges via Supabase (migration 0040).
 *
 * Replaces Firestore `challenges` writes that fail after the auth cutover.
 * Checklist "challenger" points are awarded only after end_date has passed and
 * the challenge was accepted (status → completed) - never on create.
 */
import { supabase } from '@/services/supabase'
import { awardChecklistPoints } from '@/services/pointsService'
import { getActivityDefinitionById, type JourneyType } from '@/config/pointsConfig'
import type { ChallengeRecord } from '@/hooks/leaderboard/useLeaderboardData'
import { getDisplayName } from '@/utils/displayName'

export type CreateChallengeInput = {
  challengedId: string
  duration: 'weekly' | 'monthly'
  description?: string
}

type ChallengeRow = {
  id: string
  challenger_id: string
  challenged_id: string
  challenger_name?: string | null
  challenged_name?: string | null
  challenger_email?: string | null
  challenged_email?: string | null
  start_date: string
  end_date: string
  status: string
  type?: string | null
  metrics?: { challenger?: { total?: number }; challenged?: { total?: number } } | null
  points_awarded?: boolean | null
  result?: Record<string, unknown> | null
}

const asRows = (value: unknown): ChallengeRow[] => {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is ChallengeRow => {
    return Boolean(row && typeof row === 'object' && typeof (row as ChallengeRow).id === 'string')
  })
}

export const createChallenge = async (
  input: CreateChallengeInput,
): Promise<{ id: string }> => {
  const { data, error } = await supabase.rpc('create_challenge', {
    p: {
      challenged_id: input.challengedId,
      // Collaborative is retired — individual 1v1 only.
      type: 'competitive',
      duration: input.duration,
      description: input.description ?? null,
      custom_goal: null,
    },
  })
  if (error) throw new Error(error.message)

  const result = (data ?? {}) as { ok?: boolean; error?: string; id?: string }
  if (!result.ok) {
    const code = result.error || 'create_failed'
    const messages: Record<string, string> = {
      not_authenticated: 'Please sign in again to start a challenge.',
      opponent_required: 'Please select someone to challenge.',
      cannot_challenge_self: 'You cannot challenge yourself.',
      learners_only: 'Only learners can start challenges.',
      opponent_not_found: 'That opponent is not available to challenge.',
      different_organization: 'You can only challenge members of your organization.',
      you_already_in_challenge:
        'You already have a pending or active challenge. Finish or cancel it before starting another.',
      opponent_already_in_challenge:
        'That person already has a challenge this week. Pick someone who is free.',
    }
    throw new Error(messages[code] || `Could not create challenge (${code}).`)
  }
  if (!result.id) throw new Error('Challenge created but no id returned.')
  return { id: result.id }
}

/** User ids currently in a pending or active challenge (either side). */
export const listChallengeBusyUserIds = async (): Promise<Set<string>> => {
  const { data, error } = await supabase.rpc('list_challenge_busy_user_ids')
  if (error) {
    console.warn('[Challenge] list_challenge_busy_user_ids failed', error)
    return new Set()
  }
  const result = (data ?? {}) as { ok?: boolean; user_ids?: unknown }
  if (!result.ok) return new Set()

  const raw = result.user_ids
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw) as unknown
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        })()
      : []

  return new Set(
    list
      .map((id) => (typeof id === 'string' ? id : id != null ? String(id) : ''))
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
}

export const respondToChallenge = async (
  challengeId: string,
  action: 'accepted' | 'declined',
): Promise<void> => {
  const { data, error } = await supabase.rpc('respond_to_challenge', {
    p_challenge_id: challengeId,
    p_action: action,
  })
  if (error) throw new Error(error.message)
  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (!result.ok) {
    throw new Error(result.error || 'Could not respond to challenge.')
  }
}

export const cancelChallenge = async (
  challengeId: string,
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('cancel_challenge', {
    p_challenge_id: challengeId,
  })
  if (error) {
    return { success: false, error: error.message }
  }
  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (!result.ok) {
    return { success: false, error: result.error || 'Failed to cancel challenge' }
  }
  return { success: true }
}

export const mapChallengeRow = (row: ChallengeRow, currentUserId: string): ChallengeRecord => {
  const isChallenger = row.challenger_id === currentUserId
  const opponentId = isChallenger ? row.challenged_id : row.challenger_id
  const opponentName = getDisplayName(
    isChallenger
      ? { displayName: row.challenged_name ?? undefined, email: row.challenged_email ?? undefined, uid: opponentId }
      : { displayName: row.challenger_name ?? undefined, email: row.challenger_email ?? undefined, uid: opponentId },
    'Opponent',
  )

  const yourPoints = isChallenger
    ? row.metrics?.challenger?.total || 0
    : row.metrics?.challenged?.total || 0
  const opponentPoints = isChallenger
    ? row.metrics?.challenged?.total || 0
    : row.metrics?.challenger?.total || 0

  let status: ChallengeRecord['status'] = 'pending'
  if (row.status === 'active') status = 'active'
  else if (row.status === 'completed' || row.status === 'cancelled' || row.status === 'declined') {
    status = 'completed'
  } else if (row.status === 'pending') {
    status = 'pending'
  }

  let result: ChallengeRecord['result'] | undefined
  if (status === 'completed' && row.status === 'completed') {
    if (yourPoints > opponentPoints) result = 'win'
    else if (yourPoints < opponentPoints) result = 'loss'
    else result = 'draw'
  }

  return {
    id: row.id,
    opponentName,
    opponentId,
    startDate: row.start_date,
    endDate: row.end_date,
    yourPoints,
    opponentPoints,
    status,
    result,
    type: (row.type as ChallengeRecord['type']) || 'competitive',
    isChallenger,
  }
}

export const listMyChallenges = async (currentUserId: string): Promise<ChallengeRecord[]> => {
  const { data, error } = await supabase.rpc('list_my_challenges')
  if (error) throw new Error(error.message)
  const result = (data ?? {}) as { ok?: boolean; error?: string; challenges?: unknown }
  if (!result.ok) throw new Error(result.error || 'Failed to load challenges')
  return asRows(result.challenges).map((row) => mapChallengeRow(row, currentUserId))
}

/**
 * After the challenge week ends and the challenge was accepted (active → completed),
 * award checklist "challenger" points to the winner only (most points gained in-window).
 * Draws award nobody. Metrics are window deltas (start at 0), not lifetime totals.
 */
export const finalizeExpiredChallengesAndAwardPoints = async (params: {
  currentUserId: string
  journeyType: JourneyType
  weekNumber: number
}): Promise<number> => {
  const { data, error } = await supabase.rpc('finalize_expired_challenges')
  if (error) {
    console.warn('[Challenge] finalize_expired_challenges failed', error)
    return 0
  }

  const result = (data ?? {}) as { ok?: boolean; finalized?: unknown }
  if (!result.ok) return 0

  const finalized = asRows(result.finalized).filter((row) => !row.points_awarded)
  if (!finalized.length) return 0

  const activity = getActivityDefinitionById({
    activityId: 'challenger',
    journeyType: params.journeyType,
  })
  if (!activity) return 0

  let awardedCount = 0
  for (const challenge of finalized) {
    // Only award when the challenge was actually done (accepted and ran to end).
    // Declined/cancelled never reach finalize_expired_challenges (status != active).
    const challengerPts = challenge.metrics?.challenger?.total || 0
    const challengedPts = challenge.metrics?.challenged?.total || 0
    let winnerId: string | null = null
    if (challengerPts > challengedPts) winnerId = challenge.challenger_id
    else if (challengedPts > challengerPts) winnerId = challenge.challenged_id

    let allOk = true
    if (winnerId) {
      try {
        const award = await awardChecklistPoints({
          uid: winnerId,
          journeyType: params.journeyType,
          weekNumber: params.weekNumber,
          activity,
          source: 'challenge_completion',
          claimRef: `challenge_${challenge.id}`,
        })
        if (!award.awarded && award.reason !== 'already_awarded') {
          allOk = false
        }
      } catch (awardError) {
        allOk = false
        console.warn('[Challenge] points award failed', {
          challengeId: challenge.id,
          uid: winnerId,
          awardError,
        })
      }
    }

    if (allOk) {
      const { error: markError } = await supabase.rpc('mark_challenge_points_awarded', {
        p_challenge_id: challenge.id,
      })
      if (markError) {
        console.warn('[Challenge] mark_challenge_points_awarded failed', markError)
      } else {
        awardedCount += 1
      }
    }
  }

  return awardedCount
}
