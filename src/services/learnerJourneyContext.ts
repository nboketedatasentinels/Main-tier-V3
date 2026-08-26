/**
 * Resolve learner journey for mentor/coach session-points issuance.
 * Uses SECURITY DEFINER RPC so mentors/coaches can read journey_type when
 * profiles SELECT RLS would otherwise hide the mentee row.
 */
import { supabase } from '@/services/supabase'
import type { JourneyType } from '@/config/pointsConfig'
import { isJourneyType } from '@/utils/journeyType'

export async function resolveLearnerJourneyContext(
  learnerId: string,
): Promise<{ journeyType: JourneyType; weekNumber: number } | null> {
  if (!learnerId) return null
  try {
    const { data, error } = await supabase.rpc('get_learner_journey_context', {
      p_learner_id: learnerId,
    })
    if (error) {
      console.warn('[learnerJourneyContext] RPC failed', error.message)
      return null
    }
    const payload = (data ?? {}) as {
      ok?: boolean
      journeyType?: string | null
      weekNumber?: number | null
    }
    if (!payload.ok || !payload.journeyType || !isJourneyType(payload.journeyType)) {
      return null
    }
    return {
      journeyType: payload.journeyType,
      weekNumber: Math.max(1, Number(payload.weekNumber ?? 1) || 1),
    }
  } catch (err) {
    console.warn('[learnerJourneyContext] failed', err)
    return null
  }
}
