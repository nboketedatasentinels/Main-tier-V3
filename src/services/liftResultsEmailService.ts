import { supabase } from '@/services/supabase'

const LIFT_RESULTS_EMAIL_FUNCTION = 'send-lift-results-email'

/**
 * Best-effort: email the learner (and employer when consented) after a LIFT
 * completion. Never throws - a mail failure must not undo a saved assessment.
 *
 * - Anonymous public funnel: pass `{ leadId }` (row must be completed).
 * - Signed-in assessment: call with no args; the edge function loads
 * `lift_assessments` for the JWT user.
 */
export const sendLiftResultsEmail = async (opts?: {
 leadId?: string | null
}): Promise<{ success: boolean }> => {
 const leadId = opts?.leadId?.trim() || undefined
 try {
 const { data, error } = await supabase.functions.invoke<{
 success?: boolean
 already_sent?: boolean
 }>(LIFT_RESULTS_EMAIL_FUNCTION, {
 body: leadId ? { leadId } : {},
 })
 if (error) throw error
 return { success: Boolean(data?.success || data?.already_sent) }
 } catch (error) {
 console.warn('[liftResultsEmailService] Failed to send LIFT results email', {
 leadId: leadId ?? null,
 error: error instanceof Error ? error.message : error,
 })
 return { success: false }
 }
}
