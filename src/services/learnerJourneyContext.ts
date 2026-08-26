/**
 * Resolve learner journey for mentor/coach session-points issuance.
 * Uses SECURITY DEFINER RPC so mentors/coaches can read journey_type when
 * profiles SELECT RLS would otherwise hide the mentee row.
 */
import { supabase } from '@/services/supabase'
import type { JourneyType } from '@/config/pointsConfig'
import { isJourneyType } from '@/utils/journeyType'

export type LearnerJourneyContextResult =
  | { ok: true; journeyType: JourneyType; weekNumber: number }
  | { ok: false; reason: 'forbidden' | 'missing_journey' | 'unavailable' }

export async function resolveLearnerJourneyContextDetailed(
  learnerId: string,
): Promise<LearnerJourneyContextResult> {
  if (!learnerId) return { ok: false, reason: 'unavailable' }
  try {
    const { data, error } = await supabase.rpc('get_learner_journey_context', {
      p_learner_id: learnerId,
    })
    if (error) {
      console.warn('[learnerJourneyContext] RPC failed', error.message)
      return { ok: false, reason: 'unavailable' }
    }
    const payload = (data ?? {}) as {
      ok?: boolean
      error?: string | null
      journeyType?: string | null
      weekNumber?: number | null
    }
    if (!payload.ok) {
      return {
        ok: false,
        reason: payload.error === 'forbidden' ? 'forbidden' : 'unavailable',
      }
    }
    if (!payload.journeyType || !isJourneyType(payload.journeyType)) {
      return { ok: false, reason: 'missing_journey' }
    }
    return {
      ok: true,
      journeyType: payload.journeyType,
      weekNumber: Math.max(1, Number(payload.weekNumber ?? 1) || 1),
    }
  } catch (err) {
    console.warn('[learnerJourneyContext] failed', err)
    return { ok: false, reason: 'unavailable' }
  }
}

export async function resolveLearnerJourneyContext(
  learnerId: string,
): Promise<{ journeyType: JourneyType; weekNumber: number } | null> {
  const result = await resolveLearnerJourneyContextDetailed(learnerId)
  if (!result.ok) return null
  return { journeyType: result.journeyType, weekNumber: result.weekNumber }
}
