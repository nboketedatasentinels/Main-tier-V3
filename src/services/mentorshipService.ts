import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { awardChecklistPoints } from '@/services/pointsService'
import { notifyAsLeadership } from '@/services/notificationService'
import { getActivityDefinitionById, type JourneyType } from '@/config/pointsConfig'

const MENTORSHIP_SESSIONS = 'mentorship_sessions'

/** Firestore denies these under Supabase-only auth - treat as empty, not a UI error. */
const isFirestorePermissionError = (err: unknown): boolean => {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : ''
  const message = err instanceof Error ? err.message : String(err ?? '')
  return (
    code === 'permission-denied' ||
    /insufficient permissions|permission-denied|Missing or insufficient/i.test(message)
  )
}

export type MentorshipSessionStatus =
  | 'requested'
  | 'scheduled'
  | 'completed'
  | 'declined'
  | 'cancelled'

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
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') {
      try {
        return toDate()
      } catch {
        return null
      }
    }
  }
  return null
}

const pickString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

const mapSession = (id: string, data: Record<string, unknown>): MentorshipSession => ({
  id,
  learnerId: pickString(data.learner_id) ?? pickString(data.learnerId) ?? '',
  mentorId: pickString(data.mentor_id) ?? pickString(data.mentorId) ?? '',
  status: (data.status as MentorshipSessionStatus) || 'requested',
  topic: (pickString(data.topic) ?? 'Mentorship session') as string,
  requestMessage: pickString(data.request_message),
  goals: pickString(data.goals),
  proposedAt: parseTs(data.proposed_at) ?? parseTs(data.scheduled_at),
  scheduledAt: parseTs(data.scheduled_at),
  meetingLink: pickString(data.meeting_link),
  declineReason: pickString(data.decline_reason),
  cancellationReason: pickString(data.cancellation_reason),
  cancelledBy: pickString(data.cancelled_by),
  pointsAwarded: Boolean(data.points_awarded),
  pointsAwardedAt: parseTs(data.points_awarded_at),
  confirmedAt: parseTs(data.confirmed_at),
  completedAt: parseTs(data.completed_at),
  createdAt: parseTs(data.created_at) ?? new Date(),
  updatedAt: parseTs(data.updated_at),
  learnerName: pickString(data.learner_name),
  mentorName: pickString(data.mentor_name),
})

async function getJourneyContext(
  uid: string,
): Promise<{ journeyType: JourneyType; weekNumber: number; mentorId: string | null } | null> {
  try {
    const { supabase } = await import('@/services/supabase')
    const { data } = await supabase
      .from('profiles')
      .select('journey_type, current_week, mentor_id, data')
      .eq('id', uid)
      .maybeSingle()
    if (data) {
      const nested = (data.data as Record<string, unknown> | null) || {}
      const journeyType = (data.journey_type || nested.journeyType) as JourneyType | undefined
      if (journeyType) {
        return {
          journeyType,
          weekNumber: Math.max(1, Number(data.current_week ?? nested.currentWeek ?? 1)),
          mentorId: (data.mentor_id as string | null) ?? (nested.mentorId as string | null) ?? null,
        }
      }
    }
  } catch (err) {
    console.warn('[MentorshipService] Supabase journey context failed, trying Firestore:', err)
  }

  try {
    const profileSnap = await getDoc(doc(db, 'profiles', uid))
    if (!profileSnap.exists()) return null
    const profile = profileSnap.data() as {
      journeyType?: JourneyType
      currentWeek?: number
      mentorId?: string | null
    }
    if (!profile.journeyType) return null
    return {
      journeyType: profile.journeyType,
      weekNumber: Math.max(1, Number(profile.currentWeek ?? 1)),
      mentorId: profile.mentorId ?? null,
    }
  } catch (err) {
    console.error('[MentorshipService] Failed to resolve journey context:', err)
    return null
  }
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

  const docRef = await addDoc(collection(db, MENTORSHIP_SESSIONS), {
    learner_id: learnerId,
    mentor_id: mentorId,
    status: 'requested' as MentorshipSessionStatus,
    topic: trimmedTopic,
    request_message: requestMessage?.trim() || null,
    goals: goals?.trim() || null,
    proposed_at: Timestamp.fromDate(proposedAt),
    scheduled_at: null,
    meeting_link: null,
    learner_name: learnerName ?? null,
    mentor_name: mentorName ?? null,
    points_awarded: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    created_by: learnerId,
  })

  await notifyAsLeadership({
    userId: mentorId,
    type: 'session_request',
    title: 'New mentorship session request',
    message: `${learnerName ?? 'A learner'} requested a session: "${trimmedTopic}".`,
    relatedId: docRef.id,
    category: 'action_required',
    data: { priority: 'push', sessionId: docRef.id, learnerId, kind: 'mentorship_requested' },
  }).catch((err) => console.warn('[MentorshipService] notify mentor failed:', err))

  return docRef.id
}

export async function confirmMentorshipSession(params: {
  sessionId: string
  scheduledAt?: Date
  meetingLink?: string
}): Promise<void> {
  const { sessionId, scheduledAt, meetingLink } = params
  const sessionRef = doc(db, MENTORSHIP_SESSIONS, sessionId)

  const snapshot = await getDoc(sessionRef)
  if (!snapshot.exists()) throw new Error('Session not found.')
  const data = snapshot.data()
  if (data.status !== 'requested') {
    throw new Error('Only pending requests can be confirmed.')
  }

  const updates: Record<string, unknown> = {
    status: 'scheduled' as MentorshipSessionStatus,
    confirmed_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }
  if (scheduledAt) updates.scheduled_at = Timestamp.fromDate(scheduledAt)
  if (meetingLink && meetingLink.trim()) updates.meeting_link = meetingLink.trim()

  await updateDoc(sessionRef, updates)

  const learnerId = pickString(data.learner_id)
  const mentorName = pickString(data.mentor_name)
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
  const sessionRef = doc(db, MENTORSHIP_SESSIONS, sessionId)

  const snapshot = await getDoc(sessionRef)
  if (!snapshot.exists()) throw new Error('Session not found.')
  const data = snapshot.data()
  if (data.status !== 'requested') {
    throw new Error('Only pending requests can be declined.')
  }

  await updateDoc(sessionRef, {
    status: 'declined' as MentorshipSessionStatus,
    decline_reason: reason?.trim() || null,
    updated_at: serverTimestamp(),
  })

  const learnerId = pickString(data.learner_id)
  const mentorName = pickString(data.mentor_name)
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
  const sessionRef = doc(db, MENTORSHIP_SESSIONS, sessionId)

  const snapshot = await getDoc(sessionRef)
  if (!snapshot.exists()) throw new Error('Session not found.')
  const data = snapshot.data()
  const currentStatus = data.status as MentorshipSessionStatus | undefined
  if (currentStatus === 'completed' || currentStatus === 'cancelled' || currentStatus === 'declined') {
    throw new Error('Session is already closed and cannot be cancelled.')
  }

  await updateDoc(sessionRef, {
    status: 'cancelled' as MentorshipSessionStatus,
    cancellation_reason: reason?.trim() || null,
    cancelled_by: actorId,
    updated_at: serverTimestamp(),
  })

  const learnerId = pickString(data.learner_id)
  const mentorId = pickString(data.mentor_id)
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
  const sessionRef = doc(db, MENTORSHIP_SESSIONS, sessionId)

  let learnerId: string | null = null
  let mentorName: string | null = null
  let shouldAttemptAward = false
  let alreadyCompleted = false
  let pointsAwarded = false
  let pointsAmount = 0
  let awardMessage: string | undefined

  await runTransaction(db, async (tx) => {
    const sessionDoc = await tx.get(sessionRef)
    if (!sessionDoc.exists()) throw new Error('Session not found.')

    const data = sessionDoc.data()
    const currentStatus = data.status as MentorshipSessionStatus | undefined

    if (currentStatus === 'completed') {
      alreadyCompleted = true
      learnerId = pickString(data.learner_id)
      mentorName = pickString(data.mentor_name)
      pointsAwarded = Boolean(data.points_awarded)
      return
    }

    if (currentStatus !== 'scheduled') {
      throw new Error('Only confirmed sessions can be marked complete.')
    }

    learnerId = pickString(data.learner_id)
    mentorName = pickString(data.mentor_name)
    // Points only after attendance is confirmed — never on request/accept alone.
    shouldAttemptAward = !data.points_awarded

    tx.update(sessionRef, {
      status: 'completed' as MentorshipSessionStatus,
      completed_at: serverTimestamp(),
      // Optimistically false until the ledger write succeeds.
      points_awarded: false,
      points_awarded_at: null,
      updated_at: serverTimestamp(),
    })
  })

  if (alreadyCompleted) {
    return { pointsAwarded, pointsAmount: pointsAwarded ? 2000 : 0 }
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
          console.warn(
            `[MentorshipService] mentor_meetup activity not available for ${context.journeyType}; points skipped.`,
          )
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
            await updateDoc(sessionRef, {
              points_awarded: true,
              points_awarded_at: serverTimestamp(),
              updated_at: serverTimestamp(),
            }).catch(() => undefined)
          } else {
            awardMessage = result.message ?? 'Could not issue mentor meetup points.'
          }
        }
      }
    } catch (err) {
      console.error('[MentorshipService] Failed to award points on completion:', err)
      // Session stays completed so attendance reflects reality; points can be retried.
      awardMessage =
        err instanceof Error ? err.message : 'Could not issue mentor meetup points.'
    }
  }

  if (learnerId) {
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
  const q = query(collection(db, MENTORSHIP_SESSIONS), where(fieldName, '==', value))
  return onSnapshot(
    q,
    (snapshot) => {
      const sessions = snapshot.docs.map((docSnap) => mapSession(docSnap.id, docSnap.data()))
      sessions.sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      )
      onUpdate(sessions)
    },
    (err) => {
      if (isFirestorePermissionError(err)) {
        console.warn(
          `[MentorshipService] Firestore unavailable under Supabase auth (${fieldName}); returning empty.`,
        )
        onUpdate([])
        return
      }
      console.error(`[MentorshipService] ${fieldName} subscription error:`, err)
      onError?.(err instanceof Error ? err : new Error(String(err)))
    },
  )
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
