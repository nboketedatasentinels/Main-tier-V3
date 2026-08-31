/**
 * Mentorship session requests + attendance - Supabase-backed.
 * Replaces Firestore mentorship_sessions which fail under Supabase-only auth.
 */
import { supabase } from '@/services/supabase'
import { notifyAsLeadership } from '@/services/notificationService'
import { buildMeetingMailtoHref } from '@/utils/meetingInvite'
import { assertMandatoryLiftComplete } from '@/services/liftAssessmentService'
import {
 assertMentorMeetingAllowedThisMonth,
} from '@/services/sessionMonthLimit'

export type MentorshipSessionStatus =
 | 'requested'
 | 'scheduled'
 | 'completed'
 | 'declined'
 | 'cancelled'

export type Unsubscribe = () => void

export interface MentorshipSession {
 id: string
 learnerId: string
 mentorId: string
 status: MentorshipSessionStatus
 topic: string
 requestMessage: string | null
 goals: string | null
 proposedAt: Date | null
 scheduledAt: Date | null
 meetingLink: string | null
 declineReason: string | null
 cancellationReason: string | null
 cancelledBy: string | null
 pointsAwarded: boolean
 pointsAwardedAt: Date | null
 confirmedAt: Date | null
 completedAt: Date | null
 createdAt: Date
 updatedAt: Date | null
 learnerName: string | null
 mentorName: string | null
 /** Shared across attendee rows when one meeting invites multiple mentees. */
 meetingGroupId: string | null
}

const parseTs = (value: unknown): Date | null => {
 if (!value) return null
 if (value instanceof Date) return value
 if (typeof value === 'string' || typeof value === 'number') {
 const d = new Date(value)
 return Number.isNaN(d.getTime()) ? null : d
 }
 return null
}

const pickString = (value: unknown): string | null =>
 typeof value === 'string' && value.trim().length > 0 ? value : null

const mapSession = (row: Record<string, unknown>): MentorshipSession => ({
 id: String(row.id ?? ''),
 learnerId: pickString(row.learner_id) ?? '',
 mentorId: pickString(row.mentor_id) ?? '',
 status: (row.status as MentorshipSessionStatus) || 'requested',
 topic: pickString(row.topic) ?? 'Mentorship session',
 requestMessage: pickString(row.request_message),
 goals: pickString(row.goals),
 proposedAt: parseTs(row.proposed_at) ?? parseTs(row.scheduled_at),
 scheduledAt: parseTs(row.scheduled_at),
 meetingLink: pickString(row.meeting_link),
 declineReason: pickString(row.decline_reason),
 cancellationReason: pickString(row.cancellation_reason),
 cancelledBy: pickString(row.cancelled_by),
 pointsAwarded: Boolean(row.points_awarded),
 pointsAwardedAt: parseTs(row.points_awarded_at),
 confirmedAt: parseTs(row.confirmed_at),
 completedAt: parseTs(row.completed_at),
 createdAt: parseTs(row.created_at) ?? new Date(),
 updatedAt: parseTs(row.updated_at),
 learnerName: pickString(row.learner_name),
 mentorName: pickString(row.mentor_name),
 meetingGroupId: pickString(row.meeting_group_id),
})

const fetchSessionsByField = async (
 fieldName: 'learner_id' | 'mentor_id',
 value: string,
): Promise<MentorshipSession[]> => {
 const { data, error } = await supabase
 .from('mentorship_sessions')
 .select('*')
 .eq(fieldName, value)
 .order('created_at', { ascending: false })
 if (error) throw new Error(error.message)
 return (data ?? []).map((row) => mapSession(row as Record<string, unknown>))
}

export async function createMentorshipSessionRequest(params: {
 learnerId: string
 mentorId: string
 topic: string
 requestMessage?: string
 goals?: string
 proposedAt: Date
 learnerName?: string
 mentorName?: string
}): Promise<string> {
 const { learnerId, mentorId, topic, requestMessage, goals, proposedAt, learnerName, mentorName } =
 params

 if (!learnerId || !mentorId) throw new Error('Learner and mentor ids are required.')
 const trimmedTopic = topic.trim()
 if (!trimmedTopic) throw new Error('Please describe what you want to discuss.')
 if (proposedAt.getTime() < Date.now() - 60_000) {
 throw new Error('Proposed time must be in the future.')
 }

 await assertMandatoryLiftComplete(learnerId)

 await assertMentorMeetingAllowedThisMonth({
 learnerId,
 sessionAt: proposedAt,
 forSelf: true,
 })

 const { data, error } = await supabase
 .from('mentorship_sessions')
 .insert({
 learner_id: learnerId,
 mentor_id: mentorId,
 status: 'requested',
 topic: trimmedTopic,
 request_message: requestMessage?.trim() || null,
 goals: goals?.trim() || null,
 proposed_at: proposedAt.toISOString(),
 scheduled_at: null,
 meeting_link: null,
 learner_name: learnerName ?? null,
 mentor_name: mentorName ?? null,
 points_awarded: false,
 created_by: learnerId,
 })
 .select('id')
 .single()

 if (error) throw new Error(error.message)
 const sessionId = String(data.id)

 await notifyAsLeadership({
 userId: mentorId,
 type: 'session_request',
 title: 'New mentorship session request',
 message: `${learnerName ?? 'A learner'} requested a session: "${trimmedTopic}".`,
 relatedId: sessionId,
 category: 'action_required',
 data: { priority: 'push', sessionId, learnerId, kind: 'mentorship_requested' },
 }).catch((err) => console.warn('[MentorshipService] notify mentor failed:', err))

 return sessionId
}

/** Mentor proposes a confirmed meeting to a mentee (parity with coach publishing a slot). */
export async function createMentorScheduledSession(params: {
 learnerId: string
 mentorId: string
 topic: string
 scheduledAt: Date
 meetingLink?: string
 learnerName?: string
 mentorName?: string
 /** Same uuid for every attendee row of one multi-person meeting. */
 meetingGroupId?: string | null
}): Promise<{
 sessionId: string
 mailtoHref: string
 learnerEmail: string | null
}> {
 const {
 learnerId,
 mentorId,
 topic,
 scheduledAt,
 meetingLink,
 learnerName,
 mentorName,
 meetingGroupId,
 } = params
 if (!learnerId || !mentorId) throw new Error('Learner and mentor ids are required.')
 const trimmedTopic = topic.trim() || 'Mentorship session'
 if (scheduledAt.getTime() < Date.now() - 60_000) {
 throw new Error('Pick a date and time in the future (this slot is already in the past).')
 }

 await assertMentorMeetingAllowedThisMonth({
 learnerId,
 sessionAt: scheduledAt,
 })

 const { data, error } = await supabase
 .from('mentorship_sessions')
 .insert({
 learner_id: learnerId,
 mentor_id: mentorId,
 status: 'scheduled',
 topic: trimmedTopic,
 proposed_at: scheduledAt.toISOString(),
 scheduled_at: scheduledAt.toISOString(),
 meeting_link: meetingLink?.trim() || null,
 learner_name: learnerName ?? null,
 mentor_name: mentorName ?? null,
 meeting_group_id: meetingGroupId ?? null,
 points_awarded: false,
 confirmed_at: new Date().toISOString(),
 created_by: mentorId,
 })
 .select('id')
 .single()

 if (error) throw new Error(error.message)
 const sessionId = String(data.id)

 const whenLabel = scheduledAt.toLocaleString(undefined, {
 weekday: 'short',
 day: 'numeric',
 month: 'short',
 hour: '2-digit',
 minute: '2-digit',
 })

 const linkLine = meetingLink?.trim() ? `\nMeeting link: ${meetingLink.trim()}` : ''
 const emailBody = `${mentorName ?? 'Your mentor'} scheduled a mentorship meeting.

Topic: ${trimmedTopic}
When: ${whenLabel}${linkLine} - Transformation Leader (T4L)`

 const { data: learnerProfile } = await supabase
 .from('profiles')
 .select('email')
 .eq('id', learnerId)
 .maybeSingle()
 const learnerEmail =
 typeof learnerProfile?.email === 'string' && learnerProfile.email.trim()
 ? learnerProfile.email.trim()
 : null

 const mailtoHref = buildMeetingMailtoHref({
 to: learnerEmail,
 subject: `Mentorship meeting: ${trimmedTopic}`,
 body: emailBody,
 })

 await notifyAsLeadership({
 userId: learnerId,
 type: 'session_request',
 title: 'New mentorship meeting scheduled',
 message: `${mentorName ?? 'Your mentor'} scheduled "${trimmedTopic}" for ${whenLabel}.${
 meetingLink?.trim() ? ' Meeting link included.' : ''
 }`,
 relatedId: sessionId,
 category: 'action_required',
 data: {
 priority: 'push',
 sessionId,
 mentorId,
 kind: 'mentorship_scheduled_by_mentor',
 mailtoHref,
 meetingLink: meetingLink?.trim() || null,
 scheduledAt: scheduledAt.toISOString(),
 },
 }).catch((err) => console.warn('[MentorshipService] notify learner of schedule failed:', err))

 return { sessionId, mailtoHref, learnerEmail }
}

export async function confirmMentorshipSession(params: {
 sessionId: string
 scheduledAt?: Date
 meetingLink?: string
}): Promise<void> {
 const { sessionId, scheduledAt, meetingLink } = params
 const { data: existing, error: readError } = await supabase
 .from('mentorship_sessions')
 .select('*')
 .eq('id', sessionId)
 .maybeSingle()

 if (readError) throw new Error(readError.message)
 if (!existing) throw new Error('Session not found.')
 if (existing.status !== 'requested') {
 throw new Error('Only pending requests can be confirmed.')
 }

 const learnerId = pickString(existing.learner_id)
 const meetingAt =
 scheduledAt ??
 parseTs(existing.scheduled_at) ??
 parseTs(existing.proposed_at) ??
 new Date()

 if (learnerId) {
 await assertMentorMeetingAllowedThisMonth({
 learnerId,
 sessionAt: meetingAt,
 excludeSessionId: sessionId,
 })
 }

 const updates: Record<string, unknown> = {
 status: 'scheduled',
 confirmed_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 }
 if (scheduledAt) updates.scheduled_at = scheduledAt.toISOString()
 if (meetingLink && meetingLink.trim()) updates.meeting_link = meetingLink.trim()

 const { error } = await supabase.from('mentorship_sessions').update(updates).eq('id', sessionId)
 if (error) throw new Error(error.message)

 const mentorName = pickString(existing.mentor_name)
 if (learnerId) {
 const whenLabel =
 scheduledAt && !Number.isNaN(scheduledAt.getTime())
 ? ` for ${scheduledAt.toLocaleString(undefined, {
 weekday: 'short',
 day: 'numeric',
 month: 'short',
 hour: '2-digit',
 minute: '2-digit',
 })}`
 : ''
 await notifyAsLeadership({
 userId: learnerId,
 type: 'approval',
 title: 'Your mentorship session is confirmed',
 message: `${mentorName ?? 'Your mentor'} accepted your session request${whenLabel}.`,
 relatedId: sessionId,
 category: 'important_updates',
 data: { priority: 'push', sessionId, kind: 'mentorship_confirmed' },
 }).catch((err) => console.warn('[MentorshipService] notify confirm failed:', err))
 }
}

export async function declineMentorshipSession(params: {
 sessionId: string
 reason?: string
}): Promise<void> {
 const { sessionId, reason } = params
 const { data: existing, error: readError } = await supabase
 .from('mentorship_sessions')
 .select('*')
 .eq('id', sessionId)
 .maybeSingle()

 if (readError) throw new Error(readError.message)
 if (!existing) throw new Error('Session not found.')
 if (existing.status !== 'requested') {
 throw new Error('Only pending requests can be declined.')
 }

 const { error } = await supabase
 .from('mentorship_sessions')
 .update({
 status: 'declined',
 decline_reason: reason?.trim() || null,
 updated_at: new Date().toISOString(),
 })
 .eq('id', sessionId)
 if (error) throw new Error(error.message)

 const learnerId = pickString(existing.learner_id)
 const mentorName = pickString(existing.mentor_name)
 if (learnerId) {
 await notifyAsLeadership({
 userId: learnerId,
 type: 'approval',
 title: 'Session request declined',
 message: reason?.trim()
 ? `${mentorName ?? 'Your mentor'} declined: ${reason.trim()}`
 : `${mentorName ?? 'Your mentor'} declined your session request. Try proposing another time.`,
 relatedId: sessionId,
 category: 'important_updates',
 data: { priority: 'push', sessionId, kind: 'mentorship_declined' },
 }).catch((err) => console.warn('[MentorshipService] notify decline failed:', err))
 }
}

export async function cancelMentorshipSession(params: {
 sessionId: string
 actorId: string
 reason?: string
}): Promise<void> {
 const { sessionId, actorId, reason } = params
 const { data: existing, error: readError } = await supabase
 .from('mentorship_sessions')
 .select('*')
 .eq('id', sessionId)
 .maybeSingle()

 if (readError) throw new Error(readError.message)
 if (!existing) throw new Error('Session not found.')
 const currentStatus = existing.status as MentorshipSessionStatus | undefined
 if (currentStatus === 'completed' || currentStatus === 'cancelled' || currentStatus === 'declined') {
 throw new Error('Session is already closed and cannot be cancelled.')
 }

 const { error } = await supabase
 .from('mentorship_sessions')
 .update({
 status: 'cancelled',
 cancellation_reason: reason?.trim() || null,
 cancelled_by: actorId,
 updated_at: new Date().toISOString(),
 })
 .eq('id', sessionId)
 if (error) throw new Error(error.message)

 const learnerId = pickString(existing.learner_id)
 const mentorId = pickString(existing.mentor_id)
 const otherUserId = actorId === learnerId ? mentorId : learnerId
 if (otherUserId) {
 await notifyAsLeadership({
 userId: otherUserId,
 type: 'important_update',
 title: 'Mentorship session cancelled',
 message: reason?.trim()
 ? `The session was cancelled. Reason: ${reason.trim()}`
 : 'The session was cancelled.',
 relatedId: sessionId,
 category: 'important_updates',
 data: { priority: 'push', sessionId, kind: 'mentorship_cancelled' },
 }).catch((err) => console.warn('[MentorshipService] notify cancel failed:', err))
 }
}

/** Cancel every attendee row for one multi-person meeting (best-effort per row). */
export async function cancelMentorshipMeetingGroup(params: {
 sessions: MentorshipSession[]
 actorId: string
 reason?: string
}): Promise<void> {
 const cancellable = params.sessions.filter(
 (s) => s.status === 'scheduled' || s.status === 'requested',
 )
 for (const session of cancellable) {
 await cancelMentorshipSession({
 sessionId: session.id,
 actorId: params.actorId,
 reason: params.reason,
 })
 }
}

/**
 * Collapse multi-attendee schedules into one mentor-facing meeting.
 * Prefer `meetingGroupId`; fall back to same time/topic/link for legacy bulk creates.
 */
export function groupMentorshipMeetings(
 sessions: MentorshipSession[],
): Array<{ key: string; sessions: MentorshipSession[] }> {
 const buckets = new Map<string, MentorshipSession[]>()
 for (const session of sessions) {
 let key: string
 if (session.meetingGroupId) {
 key = `g:${session.meetingGroupId}`
 } else if (session.status === 'requested') {
 key = `s:${session.id}`
 } else {
 const when = (session.scheduledAt ?? session.proposedAt)?.getTime() ?? 0
 key = `h:${session.status}|${when}|${session.topic}|${session.meetingLink ?? ''}`
 }
 const list = buckets.get(key) ?? []
 list.push(session)
 buckets.set(key, list)
 }
 return Array.from(buckets.entries()).map(([key, groupSessions]) => ({
 key,
 sessions: groupSessions,
 }))
}

export async function completeMentorshipSession(params: {
 sessionId: string
}): Promise<{ pointsAwarded: boolean; pointsAmount?: number; message?: string }> {
 const { sessionId } = params
 const { data: existing, error: readError } = await supabase
 .from('mentorship_sessions')
 .select('*')
 .eq('id', sessionId)
 .maybeSingle()

 if (readError) throw new Error(readError.message)
 if (!existing) throw new Error('Session not found.')

 const learnerId = pickString(existing.learner_id)
 const mentorName = pickString(existing.mentor_name)
 const hadPointsAlready = Boolean(existing.points_awarded)
 let pointsAwarded = hadPointsAlready
 let pointsAmount = pointsAwarded ? 2000 : 0
 let awardMessage: string | undefined
 let newlyAwarded = false

 const alreadyCompleted = existing.status === 'completed'
 if (alreadyCompleted && pointsAwarded) {
 return { pointsAwarded: true, pointsAmount: 2000 }
 }

 if (!alreadyCompleted && existing.status !== 'scheduled') {
 throw new Error('Only confirmed sessions can be marked complete.')
 }

 // Atomic server path: complete (if needed) + award +2,000 in one RPC.
 const { data: awardRaw, error: awardError } = await supabase.rpc(
 'award_mentorship_session_points',
 { p_session_id: sessionId },
 )

 if (awardError) {
 if (!alreadyCompleted) {
 await supabase
 .from('mentorship_sessions')
 .update({
 status: 'completed',
 completed_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 })
 .eq('id', sessionId)
 }
 console.error('[MentorshipService] award_mentorship_session_points failed', awardError)
 awardMessage =
 awardError.message ||
 'Attendance saved, but points could not be issued. Try Issue +2,000 again.'
 } else {
 const award = (awardRaw ?? {}) as {
 ok?: boolean
 awarded?: boolean
 points?: number
 error?: string
 message?: string
 reason?: string
 }
 if (award.ok && (award.awarded || award.reason === 'already_awarded')) {
 pointsAwarded = true
 pointsAmount = Number(award.points) || 2000
 newlyAwarded = Boolean(award.awarded) && !hadPointsAlready
 } else if (award.error === 'missing_journey') {
 awardMessage =
 'Attendance saved, but this learner has no journey type set (needs 3M / 6M / 9M).'
 } else if (award.error === 'forbidden') {
 awardMessage =
 'Attendance saved, but you are not allowed to issue mentor points for this learner.'
 } else if (award.error === 'limit_exceeded') {
 awardMessage =
 'Attendance saved, but this learner has already used all mentor meetup points for their journey.'
 } else if (!award.ok) {
 awardMessage =
 award.message ||
 `Attendance saved, but points were not issued (${award.error ?? 'unknown'}). Try Issue +2,000 again.`
 }
 }

 const mentorLabel = mentorName?.trim() ? `Mentor ${mentorName.trim()}` : 'Your mentor'
 const shouldNotify =
 Boolean(learnerId) &&
 ((!alreadyCompleted && !hadPointsAlready) || newlyAwarded)

 if (learnerId && shouldNotify) {
 const pointsJustIssued = newlyAwarded || (pointsAwarded && !hadPointsAlready && !alreadyCompleted)
 await notifyAsLeadership({
 userId: learnerId,
 type: 'approval',
 title: pointsJustIssued
 ? `+${pointsAmount.toLocaleString()} Mentor Meet Up points`
 : `${mentorLabel} confirmed your attendance`,
 message: pointsJustIssued
 ? alreadyCompleted
 ? `${mentorLabel} issued +${pointsAmount.toLocaleString()} Mentor Meet Up points for your mentorship session attendance. They are on your journey dashboard.`
 : `${mentorLabel} confirmed you attended your mentorship session and added +${pointsAmount.toLocaleString()} Mentor Meet Up points to your journey.`
 : `${mentorLabel} marked you as attended for this mentorship session.${
 awardMessage ? ` ${awardMessage}` : ''
 }`,
 relatedId: sessionId,
 category: 'important_updates',
 data: {
 priority: 'push',
 sessionId,
 kind: pointsJustIssued ? 'mentorship_points_awarded' : 'mentorship_completed',
 pointsAwarded: pointsJustIssued,
 pointsAmount: pointsJustIssued ? pointsAmount : 0,
 actorRole: 'mentor',
 actorName: mentorName,
 source: 'Mentor Meet Up',
 },
 }).catch((err) => console.warn('[MentorshipService] notify complete failed:', err))
 }

 return { pointsAwarded, pointsAmount, message: awardMessage }
}

const subscribeToSessionsByField = (
 fieldName: 'learner_id' | 'mentor_id',
 value: string,
 onUpdate: (sessions: MentorshipSession[]) => void,
 onError?: (error: Error) => void,
): Unsubscribe => {
 let cancelled = false

 const refresh = async () => {
 try {
 const sessions = await fetchSessionsByField(fieldName, value)
 if (!cancelled) onUpdate(sessions)
 } catch (err) {
 if (!cancelled) {
 onError?.(err instanceof Error ? err : new Error(String(err)))
 }
 }
 }

 void refresh()

 const channel = supabase
 .channel(`mentorship_sessions_${fieldName}_${value}_${Date.now()}`)
 .on(
 'postgres_changes',
 {
 event: '*',
 schema: 'public',
 table: 'mentorship_sessions',
 filter: `${fieldName}=eq.${value}`,
 },
 () => {
 void refresh()
 },
 )
 .subscribe()

 return () => {
 cancelled = true
 void supabase.removeChannel(channel)
 }
}

export const subscribeToLearnerMentorshipSessions = (
 learnerId: string,
 onUpdate: (sessions: MentorshipSession[]) => void,
 onError?: (error: Error) => void,
): Unsubscribe => subscribeToSessionsByField('learner_id', learnerId, onUpdate, onError)

export const subscribeToMentorMentorshipSessions = (
 mentorId: string,
 onUpdate: (sessions: MentorshipSession[]) => void,
 onError?: (error: Error) => void,
): Unsubscribe => subscribeToSessionsByField('mentor_id', mentorId, onUpdate, onError)

export const groupSessionsByStatus = (
 sessions: MentorshipSession[],
): Record<MentorshipSessionStatus, MentorshipSession[]> => ({
 requested: sessions.filter((s) => s.status === 'requested'),
 scheduled: sessions.filter((s) => s.status === 'scheduled'),
 completed: sessions.filter((s) => s.status === 'completed'),
 declined: sessions.filter((s) => s.status === 'declined'),
 cancelled: sessions.filter((s) => s.status === 'cancelled'),
})
