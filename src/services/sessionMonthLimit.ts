/**
 * Enforce 1 mentor meet-up and 1 coach session per learner per calendar month.
 * Counted on the meeting date (scheduled / proposed / slot time).
 */
import { supabase } from '@/services/supabase'

const MENTOR_LIMIT_MESSAGE =
 'Only 1 mentor meet-up is allowed per month. This learner already has one for this month - try again next month.'

const MENTOR_LIMIT_MESSAGE_SELF =
 'Only 1 mentor meet-up is allowed per month. You already have one for this month - try again next month.'

const COACH_LIMIT_MESSAGE =
 'Only 1 coach session is allowed per month. This learner already has one for this month - try again next month.'

const COACH_LIMIT_MESSAGE_SELF =
 'Only 1 coach session is allowed per month. You already have one for this month - try again next month.'

async function learnerHasSessionInMonth(params: {
 kind: 'mentor' | 'coach'
 learnerId: string
 sessionAt: Date
 excludeId?: string
}): Promise<boolean> {
 const { kind, learnerId, sessionAt, excludeId } = params
 const { data, error } = await supabase.rpc('learner_has_session_in_month', {
 p_kind: kind,
 p_learner_id: learnerId,
 p_session_at: sessionAt.toISOString(),
 p_exclude_id: excludeId ?? null,
 })

 if (error) {
 // Fallback if migration 0077 is not deployed yet - best-effort client count.
 console.warn('[sessionMonthLimit] RPC failed, using client fallback:', error.message)
 return clientFallbackHasSession(params)
 }

 return Boolean(data)
}

async function clientFallbackHasSession(params: {
 kind: 'mentor' | 'coach'
 learnerId: string
 sessionAt: Date
 excludeId?: string
}): Promise<boolean> {
 const { kind, learnerId, sessionAt, excludeId } = params
 const month = sessionAt.getUTCMonth()
 const year = sessionAt.getUTCFullYear()
 const inMonth = (value: unknown): boolean => {
 if (!value) return false
 const d = new Date(String(value))
 if (Number.isNaN(d.getTime())) return false
 return d.getUTCFullYear() === year && d.getUTCMonth() === month
 }

 if (kind === 'mentor') {
 const { data, error } = await supabase
 .from('mentorship_sessions')
 .select('id, scheduled_at, proposed_at, created_at')
 .eq('learner_id', learnerId)
 .in('status', ['requested', 'scheduled', 'completed'])
 if (error) throw new Error(error.message)
 return (data ?? []).some((row) => {
 if (excludeId && String(row.id) === excludeId) return false
 return inMonth(row.scheduled_at ?? row.proposed_at ?? row.created_at)
 })
 }

 const { data, error } = await supabase
 .from('ambassador_slot_bookings')
 .select('id, ambassador_slots!inner(scheduled_at)')
 .eq('learner_id', learnerId)
 .in('status', ['booked', 'attended'])
 if (error) throw new Error(error.message)

 return (data ?? []).some((row) => {
 if (excludeId && String(row.id) === excludeId) return false
 const slot = row.ambassador_slots as { scheduled_at?: string } | { scheduled_at?: string }[] | null
 const scheduled = Array.isArray(slot) ? slot[0]?.scheduled_at : slot?.scheduled_at
 return inMonth(scheduled)
 })
}

export async function assertMentorMeetingAllowedThisMonth(params: {
 learnerId: string
 sessionAt: Date
 /** When confirming an existing request, exclude it from the count. */
 excludeSessionId?: string
 /** Learner-facing copy when they request themselves. */
 forSelf?: boolean
}): Promise<void> {
 const { learnerId, sessionAt, excludeSessionId, forSelf } = params
 if (!learnerId) return

 const blocked = await learnerHasSessionInMonth({
 kind: 'mentor',
 learnerId,
 sessionAt,
 excludeId: excludeSessionId,
 })

 if (blocked) {
 throw new Error(forSelf ? MENTOR_LIMIT_MESSAGE_SELF : MENTOR_LIMIT_MESSAGE)
 }
}

export async function assertCoachMeetingAllowedThisMonth(params: {
 learnerId: string
 sessionAt: Date
 excludeBookingId?: string
 forSelf?: boolean
}): Promise<void> {
 const { learnerId, sessionAt, excludeBookingId, forSelf } = params
 if (!learnerId) return

 const blocked = await learnerHasSessionInMonth({
 kind: 'coach',
 learnerId,
 sessionAt,
 excludeId: excludeBookingId,
 })

 if (blocked) {
 throw new Error(forSelf ? COACH_LIMIT_MESSAGE_SELF : COACH_LIMIT_MESSAGE)
 }
}
