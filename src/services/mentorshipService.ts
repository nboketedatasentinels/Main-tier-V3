/**
 * Mentorship session requests + attendance — Supabase-backed.
 * Replaces Firestore mentorship_sessions which fail under Supabase-only auth.
 */
import { supabase } from '@/services/supabase'
import { awardChecklistPoints } from '@/services/pointsService'
import { notifyAsLeadership } from '@/services/notificationService'
import { getActivityDefinitionById, type JourneyType } from '@/config/pointsConfig'
import { buildMeetingMailtoHref } from '@/utils/meetingInvite'
import { assertMandatoryLiftComplete } from '@/services/liftAssessmentService'

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
})

async function getJourneyContext(
  uid: string,
): Promise<{ journeyType: JourneyType; weekNumber: number; mentorId: string | null } | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('journey_type, current_week, mentor_id, data')
      .eq('id', uid)
      .maybeSingle()
    if (!data) return null
    const nested = (data.data as Record<string, unknown> | null) || {}
    const journeyType = (data.journey_type || nested.journeyType) as JourneyType | undefined
    if (!journeyType) return null
    return {
      journeyType,
      weekNumber: Math.max(1, Number(data.current_week ?? nested.currentWeek ?? 1)),
      mentorId: (data.mentor_id as string | null) ?? (nested.mentorId as string | null) ?? null,
    }
  } catch (err) {
    console.error('[MentorshipService] Failed to resolve journey context:', err)
    return null
  }
}

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
}): Promise<{
  sessionId: string
  mailtoHref: string
  learnerEmail: string | null
}> {
  const { learnerId, mentorId, topic, scheduledAt, meetingLink, learnerName, mentorName } = params
  if (!learnerId || !mentorId) throw new Error('Learner and mentor ids are required.')
  const trimmedTopic = topic.trim() || 'Mentorship session'
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    throw new Error('Pick a date and time in the future (this slot is already in the past).')
  }

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
When: ${whenLabel}${linkLine}

— Transformation Leader (T4L)`

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

  const updates: Record<string, unknown> = {
    status: 'scheduled',
    confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (scheduledAt) updates.scheduled_at = scheduledAt.toISOString()
  if (meetingLink && meetingLink.trim()) updates.meeting_link = meetingLink.trim()

  const { error } = await supabase.from('mentorship_sessions').update(updates).eq('id', sessionId)
  if (error) throw new Error(error.message)

  const learnerId = pickString(existing.learner_id)
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
  let pointsAwarded = Boolean(existing.points_awarded)
  let pointsAmount = pointsAwarded ? 2000 : 0
  let awardMessage: string | undefined

  const alreadyCompleted = existing.status === 'completed'
  if (alreadyCompleted && pointsAwarded) {
    return { pointsAwarded: true, pointsAmount: 2000 }
  }

  if (!alreadyCompleted && existing.status !== 'scheduled') {
    throw new Error('Only confirmed sessions can be marked complete.')
  }

  const shouldAttemptAward = !existing.points_awarded

  // Mark complete when still scheduled. If already completed but points were
  // skipped (no journey / limit), allow a points-only retry below.
  if (!alreadyCompleted) {
    const { error: completeError } = await supabase
      .from('mentorship_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        points_awarded: false,
        points_awarded_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
    if (completeError) throw new Error(completeError.message)
  }

  if (shouldAttemptAward && learnerId) {
    try {
      const context = await getJourneyContext(learnerId)
      if (!context?.journeyType) {
        awardMessage = 'Session marked attended, but no active journey was found for points.'
      } else {
        const activity = getActivityDefinitionById({
          activityId: 'mentor_meetup',
          journeyType: context.journeyType,
        })
        if (!activity) {
          awardMessage = 'Mentor meetup points are not part of this journey.'
        } else {
          const result = await awardChecklistPoints({
            uid: learnerId,
            journeyType: context.journeyType,
            weekNumber: context.weekNumber,
            activity,
            source: 'mentor_confirmed_session',
            claimRef: `mentor_session:${sessionId}`,
          })
          if (result.awarded || result.reason === 'already_awarded') {
            pointsAwarded = true
            pointsAmount = activity.points
            await supabase
              .from('mentorship_sessions')
              .update({
                points_awarded: true,
                points_awarded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', sessionId)
          } else {
            awardMessage = result.message ?? 'Could not issue mentor meetup points.'
          }
        }
      }
    } catch (err) {
      console.error('[MentorshipService] Failed to award points on completion:', err)
      awardMessage =
        err instanceof Error ? err.message : 'Could not issue mentor meetup points.'
    }
  }

  if (learnerId && !alreadyCompleted) {
    await notifyAsLeadership({
      userId: learnerId,
      type: 'approval',
      title: 'Mentor session attended',
      message: pointsAwarded
        ? `${mentorName ?? 'Your mentor'} confirmed your attendance. +${pointsAmount.toLocaleString()} mentor meetup points added.`
        : `${mentorName ?? 'Your mentor'} confirmed your attendance.`,
      relatedId: sessionId,
      category: 'important_updates',
      data: {
        priority: 'push',
        sessionId,
        kind: 'mentorship_completed',
        pointsAwarded,
        pointsAmount,
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
