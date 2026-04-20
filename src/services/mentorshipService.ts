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
import { createInAppNotification } from '@/services/notificationService'
import { getActivityDefinitionById, type JourneyType } from '@/config/pointsConfig'

const MENTORSHIP_SESSIONS = 'mentorship_sessions'

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
): Promise<{ journeyType: JourneyType; weekNumber: number } | null> {
  try {
    const profileSnap = await getDoc(doc(db, 'profiles', uid))
    if (!profileSnap.exists()) return null
    const profile = profileSnap.data() as {
      journeyType?: JourneyType
      currentWeek?: number
    }
    if (!profile.journeyType) return null
    return {
      journeyType: profile.journeyType,
      weekNumber: Math.max(1, Number(profile.currentWeek ?? 1)),
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

  await createInAppNotification({
    userId: mentorId,
    type: 'session_request',
    title: 'New mentorship session request',
    message: `${learnerName ?? 'A learner'} requested a session: "${trimmedTopic}".`,
    relatedId: docRef.id,
    metadata: { sessionId: docRef.id, learnerId, kind: 'mentorship_requested' },
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
    await createInAppNotification({
      userId: learnerId,
      type: 'approval',
      title: 'Your mentorship session is confirmed',
      message: `${mentorName ?? 'Your mentor'} accepted your session request.`,
      relatedId: sessionId,
      metadata: { sessionId, kind: 'mentorship_confirmed' },
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
    await createInAppNotification({
      userId: learnerId,
      type: 'approval',
      title: 'Session request declined',
      message: reason?.trim()
        ? `${mentorName ?? 'Your mentor'} declined: ${reason.trim()}`
        : `${mentorName ?? 'Your mentor'} declined your session request. Try proposing another time.`,
      relatedId: sessionId,
      metadata: { sessionId, kind: 'mentorship_declined' },
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
    await createInAppNotification({
      userId: otherUserId,
      type: 'important_update',
      title: 'Mentorship session cancelled',
      message: reason?.trim()
        ? `The session was cancelled. Reason: ${reason.trim()}`
        : 'The session was cancelled.',
      relatedId: sessionId,
      metadata: { sessionId, kind: 'mentorship_cancelled' },
    }).catch((err) => console.warn('[MentorshipService] notify cancel failed:', err))
  }
}

export async function completeMentorshipSession(params: {
  sessionId: string
}): Promise<{ pointsAwarded: boolean }> {
  const { sessionId } = params
  const sessionRef = doc(db, MENTORSHIP_SESSIONS, sessionId)

  let learnerId: string | null = null
  let mentorName: string | null = null
  let shouldAwardPoints = false
  let alreadyCompleted = false

  await runTransaction(db, async (tx) => {
    const sessionDoc = await tx.get(sessionRef)
    if (!sessionDoc.exists()) throw new Error('Session not found.')

    const data = sessionDoc.data()
    const currentStatus = data.status as MentorshipSessionStatus | undefined

    if (currentStatus === 'completed') {
      alreadyCompleted = true
      learnerId = pickString(data.learner_id)
      mentorName = pickString(data.mentor_name)
      return
    }

    if (currentStatus !== 'scheduled') {
      throw new Error('Only confirmed sessions can be marked complete.')
    }

    learnerId = pickString(data.learner_id)
    mentorName = pickString(data.mentor_name)
    shouldAwardPoints = !data.points_awarded

    tx.update(sessionRef, {
      status: 'completed' as MentorshipSessionStatus,
      completed_at: serverTimestamp(),
      points_awarded: true,
      points_awarded_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })
  })

  if (alreadyCompleted) {
    return { pointsAwarded: false }
  }

  if (shouldAwardPoints && learnerId) {
    try {
      const context = await getJourneyContext(learnerId)
      if (context) {
        const activity = getActivityDefinitionById({
          activityId: 'mentor_meetup',
          journeyType: context.journeyType,
        })
        if (activity) {
          await awardChecklistPoints({
            uid: learnerId,
            journeyType: context.journeyType,
            weekNumber: context.weekNumber,
            activity,
            source: 'mentor_confirmed_session',
            claimRef: `mentor_session:${sessionId}`,
          })
        } else {
          console.warn(
            `[MentorshipService] mentor_meetup activity not available for ${context.journeyType}; points skipped.`,
          )
        }
      }
    } catch (err) {
      console.error('[MentorshipService] Failed to award points on completion:', err)
      // Intentional: session stays marked complete so the mentor UI reflects reality.
      // Admins can reconcile points via pointsService.reconcileUserPointsFromLedger.
    }
  }

  if (learnerId) {
    await createInAppNotification({
      userId: learnerId,
      type: 'approval',
      title: 'Mentor session confirmed',
      message: shouldAwardPoints
        ? `${mentorName ?? 'Your mentor'} confirmed your session. Points added to your journey.`
        : `${mentorName ?? 'Your mentor'} confirmed your session.`,
      relatedId: sessionId,
      metadata: { sessionId, kind: 'mentorship_completed' },
    }).catch((err) => console.warn('[MentorshipService] notify complete failed:', err))
  }

  return { pointsAwarded: shouldAwardPoints }
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
