import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db } from '@/services/firebase'
import { awardChecklistPoints } from '@/services/pointsService'
import { createInAppNotification } from '@/services/notificationService'
import {
  PEER_SESSION_CONFIRMATION_ACTIVITY,
  PEER_SESSION_NO_SHOW_ACTIVITY,
  type JourneyType,
} from '@/config/pointsConfig'
import { removeUndefinedFields } from '@/utils/firestore'
import { getDisplayName, type DisplayNameInput } from '@/utils/displayName'
import { addHours } from 'date-fns'
import { getCurrentWeekNumber } from '@/utils/weekCalculations'

// Types
export interface PeerSession {
  id: string
  title: string
  description?: string
  platform: 'Zoom' | 'Google Meet' | 'Zoho Meet'
  meetingLink?: string
  timezone: string
  participants: string[]
  status: 'pending' | 'confirmed' | 'scheduled' | 'in_progress' | 'completed' | 'no_show'
  scheduledAt: Date
  confirmationDeadline: Date
  confirmations: Record<string, boolean>
  noShows?: Record<string, boolean>
  createdBy: string
  createdAt: Date
  updatedAt?: Date
  pointsAwarded?: boolean
}

export interface PeerSessionRequest {
  id: string
  sessionId: string
  fromUserId: string
  fromName: string
  fromEmail: string
  toUserId: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: Date
  respondedAt?: Date
}

export interface CreateSessionParams {
  title: string
  description?: string
  platform: 'Zoom' | 'Google Meet' | 'Zoho Meet'
  meetingLink?: string
  timezone: string
  participants: string[]
  scheduledAt: Date
  createdBy: string
  creatorName: string
  creatorEmail: string
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime())

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toNumber?: () => number }).toNumber === 'function'
  ) {
    const numberValue = (value as { toNumber: () => number }).toNumber()
    if (Number.isFinite(numberValue)) return numberValue
  }
  return null
}

const coerceDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return isValidDate(value) ? value : null
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const coerced = (value as { toDate: () => Date }).toDate()
    return isValidDate(coerced) ? coerced : null
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    'nanoseconds' in value
  ) {
    const seconds = toFiniteNumber((value as { seconds: unknown }).seconds)
    if (seconds === null) return null
    const nanoseconds = toFiniteNumber((value as { nanoseconds: unknown }).nanoseconds) ?? 0
    const millis = seconds * 1000 + Math.floor(nanoseconds / 1000000)
    const date = new Date(millis)
    return isValidDate(date) ? date : null
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const coerced = new Date(value)
    return isValidDate(coerced) ? coerced : null
  }
  return null
}

const resolveParticipants = (data: DocumentData): string[] => {
  const candidates = [data.participants, data.participantIds, data.participant_ids]
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.filter((value) => isNonEmptyString(value))
    }
  }
  return []
}

const resolveCreatedBy = (data: DocumentData): string => {
  const candidates = [data.createdBy, data.creatorId, data.created_by]
  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) return candidate
  }
  return ''
}

const resolveMeetingLink = (data: DocumentData): string | undefined => {
  if (isNonEmptyString(data.meetingLink)) return data.meetingLink
  if (isNonEmptyString(data.meeting_link)) return data.meeting_link
  return undefined
}

const parseSessionDoc = (docSnap: QueryDocumentSnapshot<DocumentData>): PeerSession | null => {
  const data = docSnap.data()
  let scheduledAt = coerceDate(data.scheduledAt ?? data.scheduled_at)
  if (!scheduledAt) {
    console.warn('[PeerSessionService] Session missing scheduledAt; defaulting to now', { sessionId: docSnap.id })
    scheduledAt = new Date()
  }

  const confirmationDeadline =
    coerceDate(data.confirmationDeadline ?? data.confirmation_deadline) ?? addHours(scheduledAt, -2)
  const createdAt = coerceDate(data.createdAt ?? data.created_at) ?? new Date()
  const updatedAt = coerceDate(data.updatedAt ?? data.updated_at) ?? undefined

  return {
    id: docSnap.id,
    title: data.title || 'Peer Session',
    description: data.description,
    platform: data.platform || 'Zoom',
    meetingLink: resolveMeetingLink(data),
    timezone: data.timezone || 'UTC',
    participants: resolveParticipants(data),
    status: data.status || 'pending',
    scheduledAt,
    confirmationDeadline,
    confirmations: data.confirmations || {},
    noShows: data.noShows,
    createdBy: resolveCreatedBy(data),
    createdAt,
    updatedAt,
    pointsAwarded: data.pointsAwarded,
  }
}

type QueryWithKey = {
  key: string
  query: Query<DocumentData>
  optional?: boolean
}

export type PeerSessionLifecycleInput = {
  id: string
  title: string
  timezone: string
  scheduledAt: Date
  status: PeerSession['status']
}

const buildSessionQueries = (userId: string): QueryWithKey[] => {
  const sessionsRef = collection(db, 'peer_sessions')
  return [
    { key: 'participants', query: query(sessionsRef, where('participants', 'array-contains', userId)) },
    { key: 'createdBy', query: query(sessionsRef, where('createdBy', '==', userId)) },
    // Legacy field fallbacks for environments that still store older schemas.
    { key: 'participantIds', query: query(sessionsRef, where('participantIds', 'array-contains', userId)), optional: true },
    { key: 'participant_ids', query: query(sessionsRef, where('participant_ids', 'array-contains', userId)), optional: true },
    { key: 'creatorId', query: query(sessionsRef, where('creatorId', '==', userId)), optional: true },
    { key: 'created_by', query: query(sessionsRef, where('created_by', '==', userId)), optional: true },
  ]
}

const isPermissionDeniedError = (error: unknown): boolean => {
  return (error as { code?: string } | undefined)?.code === 'permission-denied'
}

const resolveInvitationRecipient = (data: DocumentData): string => {
  if (isNonEmptyString(data.toUserId)) return data.toUserId
  if (isNonEmptyString(data.to_user_id)) return data.to_user_id
  return ''
}

const parseInvitationDoc = (docSnap: QueryDocumentSnapshot<DocumentData>): PeerSessionRequest | null => {
  const data = docSnap.data()
  const toUserId = resolveInvitationRecipient(data)
  if (!isNonEmptyString(data.sessionId) || !isNonEmptyString(data.fromUserId) || !toUserId) {
    return null
  }

  const createdAt = coerceDate(data.createdAt ?? data.created_at) ?? new Date()
  const respondedAt = coerceDate(data.respondedAt ?? data.responded_at) ?? undefined

  return {
    id: docSnap.id,
    sessionId: data.sessionId,
    fromUserId: data.fromUserId,
    fromName: data.fromName || 'Peer',
    fromEmail: data.fromEmail || '',
    toUserId,
    status: data.status || 'pending',
    createdAt,
    respondedAt,
  }
}

const buildInvitationQueries = (userId: string): QueryWithKey[] => {
  const invitesRef = collection(db, 'peer_session_requests')
  return [
    {
      key: 'toUserId',
      query: query(invitesRef, where('toUserId', '==', userId), where('status', '==', 'pending')),
    },
    {
      key: 'to_user_id',
      query: query(invitesRef, where('to_user_id', '==', userId), where('status', '==', 'pending')),
    },
  ]
}

const normalizeParticipants = (participants: string[], createdBy: string): string[] => {
  const unique = new Set(
    participants
      .filter((participant) => isNonEmptyString(participant))
      .map((participant) => participant.trim())
  )
  unique.delete(createdBy)
  return Array.from(unique)
}

const assertValidCreateParams = (params: CreateSessionParams): string[] => {
  if (!isNonEmptyString(params.title)) {
    throw new Error('Session title is required')
  }
  if (!isNonEmptyString(params.createdBy)) {
    throw new Error('Session creator is required')
  }
  if (!isNonEmptyString(params.timezone)) {
    throw new Error('Session timezone is required')
  }
  if (!isValidDate(params.scheduledAt)) {
    throw new Error('Session scheduledAt must be a valid date')
  }

  // Ensure session is scheduled at least 2 hours in advance (minimum confirmation window)
  const twoHoursFromNow = addHours(new Date(), 2)
  if (params.scheduledAt < twoHoursFromNow) {
    throw new Error('Session must be scheduled at least 2 hours in advance to allow confirmation time')
  }

  const normalizedParticipants = normalizeParticipants(params.participants, params.createdBy)
  if (normalizedParticipants.length === 0) {
    throw new Error('At least one participant is required')
  }

  if (!isNonEmptyString(params.creatorName) || !isNonEmptyString(params.creatorEmail)) {
    throw new Error('Creator name and email are required')
  }

  return normalizedParticipants
}

const buildPeerConnectUrl = (sessionId: string) =>
  `/app/peer-connect?sessionId=${encodeURIComponent(sessionId)}`

const formatSessionDateLabel = (date: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(date)
  } catch (error) {
    console.warn('[PeerSessionService] Failed to format session date', error)
    return date.toLocaleString('en-US')
  }
}

const SESSION_MISSED_GRACE_MS = 90 * 60 * 1000

const SESSION_REMINDER_CONFIG = [
  {
    key: 'day_before',
    offsetMs: 24 * 60 * 60 * 1000,
    title: 'Peer session tomorrow',
    actionLabel: 'Review session',
    message: (sessionTitle: string, whenLabel: string) =>
      `"${sessionTitle}" is coming up in about 24 hours (${whenLabel}).`,
  },
  {
    key: 'two_hours',
    offsetMs: 2 * 60 * 60 * 1000,
    title: 'Peer session in 2 hours',
    actionLabel: 'Open session',
    message: (sessionTitle: string, whenLabel: string) =>
      `"${sessionTitle}" starts in about 2 hours (${whenLabel}).`,
  },
  {
    key: 'start_time',
    offsetMs: 0,
    title: 'Peer session starting now',
    actionLabel: 'Join now',
    message: (sessionTitle: string, whenLabel: string) =>
      `"${sessionTitle}" is starting now (${whenLabel}).`,
  },
] as const

type SessionReminderConfig = (typeof SESSION_REMINDER_CONFIG)[number]
type SessionReminderKey = SessionReminderConfig['key']

const isSessionFinalStatus = (status: unknown): boolean => status === 'completed' || status === 'no_show'

const hasReminderBeenSent = (data: DocumentData, userId: string, reminderKey: SessionReminderKey): boolean => {
  const reminderRoot = data.reminderNotifications
  if (!reminderRoot || typeof reminderRoot !== 'object') return false

  const userReminderRecord = (reminderRoot as Record<string, unknown>)[userId]
  if (!userReminderRecord || typeof userReminderRecord !== 'object') return false

  return Boolean((userReminderRecord as Record<string, unknown>)[reminderKey])
}

const reminderWindowHasStarted = (
  scheduledAt: Date,
  reminder: SessionReminderConfig,
  nowMs: number,
): boolean => nowMs >= scheduledAt.getTime() - reminder.offsetMs

const reminderWindowExpired = (
  scheduledAt: Date,
  reminder: SessionReminderConfig,
  nowMs: number,
): boolean => {
  if (reminder.key === 'start_time') {
    return nowMs > scheduledAt.getTime() + 60 * 60 * 1000
  }
  return nowMs > scheduledAt.getTime()
}

const maybeSendSessionReminder = async (
  session: PeerSessionLifecycleInput,
  userId: string,
  reminder: SessionReminderConfig,
): Promise<boolean> => {
  if (!session.id || !userId) return false
  if (!isValidDate(session.scheduledAt)) return false
  if (isSessionFinalStatus(session.status)) return false

  const nowMs = Date.now()
  if (!reminderWindowHasStarted(session.scheduledAt, reminder, nowMs)) return false
  if (reminderWindowExpired(session.scheduledAt, reminder, nowMs)) return false

  const sessionRef = doc(db, 'peer_sessions', session.id)
  let shouldNotify = false

  await runTransaction(db, async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef)
    if (!sessionDoc.exists()) return

    const sessionData = sessionDoc.data()
    if (isSessionFinalStatus(sessionData.status)) return

    const participants = resolveParticipants(sessionData)
    const createdBy = resolveCreatedBy(sessionData)
    if (participants.length === 0 || (!participants.includes(userId) && createdBy !== userId)) return

    const scheduledAt = coerceDate(sessionData.scheduledAt ?? sessionData.scheduled_at)
    if (!scheduledAt) return

    const currentMs = Date.now()
    if (!reminderWindowHasStarted(scheduledAt, reminder, currentMs)) return
    if (reminderWindowExpired(scheduledAt, reminder, currentMs)) return
    if (hasReminderBeenSent(sessionData, userId, reminder.key)) return

    transaction.update(sessionRef, {
      [`reminderNotifications.${userId}.${reminder.key}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    shouldNotify = true
  })

  if (!shouldNotify) return false

  const actionUrl = buildPeerConnectUrl(session.id)
  const whenLabel = formatSessionDateLabel(session.scheduledAt, session.timezone || 'UTC')

  try {
    await createInAppNotification({
      userId,
      type: 'session_request',
      title: reminder.title,
      message: reminder.message(session.title || 'Peer session', whenLabel),
      relatedId: session.id,
      metadata: {
        sessionId: session.id,
        actionUrl,
        actionLabel: reminder.actionLabel,
        reminderKey: reminder.key,
        scheduledAt: session.scheduledAt.toISOString(),
        timezone: session.timezone,
      },
    })
  } catch (error) {
    console.error('[PeerSessionService] Failed to create reminder notification', {
      sessionId: session.id,
      userId,
      reminderKey: reminder.key,
      error,
    })
  }

  return true
}

export async function markPeerSessionMissedIfElapsed(
  sessionId: string,
  userId: string,
  options?: { graceMs?: number },
): Promise<boolean> {
  if (!sessionId || !userId) return false

  const graceMs = options?.graceMs ?? SESSION_MISSED_GRACE_MS
  const sessionRef = doc(db, 'peer_sessions', sessionId)
  let shouldNotifyParticipants = false
  let participantIds: string[] = []
  let title = 'Peer session'
  let timezone = 'UTC'
  let scheduledAt = new Date()

  await runTransaction(db, async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef)
    if (!sessionDoc.exists()) return

    const sessionData = sessionDoc.data()
    if (isSessionFinalStatus(sessionData.status)) return

    const scheduledAtDate = coerceDate(sessionData.scheduledAt ?? sessionData.scheduled_at)
    if (!scheduledAtDate) return
    if (Date.now() < scheduledAtDate.getTime() + graceMs) return

    const participants = resolveParticipants(sessionData)
    const createdBy = resolveCreatedBy(sessionData)
    const userInSession = participants.includes(userId) || (createdBy && createdBy === userId)
    if (!userInSession) return

    title = isNonEmptyString(sessionData.title) ? sessionData.title : title
    timezone = isNonEmptyString(sessionData.timezone) ? sessionData.timezone : timezone
    scheduledAt = scheduledAtDate
    participantIds = participants.length > 0 ? participants : createdBy ? [createdBy] : [userId]

    transaction.update(sessionRef, {
      status: 'no_show',
      missedAt: serverTimestamp(),
      missedBy: 'system',
      missedReason: 'auto_time_elapsed',
      updatedAt: serverTimestamp(),
    })
    shouldNotifyParticipants = true
  })

  if (!shouldNotifyParticipants) return false

  const actionUrl = buildPeerConnectUrl(sessionId)
  const whenLabel = formatSessionDateLabel(scheduledAt, timezone)
  const message = `"${title}" scheduled for ${whenLabel} was marked as missed. Reschedule to keep momentum.`

  await Promise.all(
    participantIds.map(async (participantId) => {
      try {
        await createInAppNotification({
          userId: participantId,
          type: 'session_request',
          title: 'Session marked as missed',
          message,
          relatedId: sessionId,
          metadata: {
            sessionId,
            actionUrl,
            actionLabel: 'Reschedule session',
            status: 'no_show',
            autoMarked: true,
            timezone,
            scheduledAt: scheduledAt.toISOString(),
          },
        })
      } catch (error) {
        console.error('[PeerSessionService] Failed to create missed-session notification', {
          sessionId,
          participantId,
          error,
        })
      }
    }),
  )

  return true
}

export async function processPeerSessionLifecycleForUser(
  session: PeerSessionLifecycleInput,
  userId: string,
): Promise<{ remindersSent: SessionReminderKey[]; markedMissed: boolean }> {
  const remindersSent: SessionReminderKey[] = []

  if (isValidDate(session.scheduledAt) && !isSessionFinalStatus(session.status)) {
    for (const reminder of SESSION_REMINDER_CONFIG) {
      const sent = await maybeSendSessionReminder(session, userId, reminder)
      if (sent) {
        remindersSent.push(reminder.key)
      }
    }
  }

  const markedMissed = await markPeerSessionMissedIfElapsed(session.id, userId)
  return { remindersSent, markedMissed }
}

// Helper to get user's journey info for points
async function getUserJourneyInfo(uid: string): Promise<{ journeyType: JourneyType; weekNumber: number } | null> {
  try {
    const profileSnap = await getDoc(doc(db, 'profiles', uid))
    if (!profileSnap.exists()) return null

    const profile = profileSnap.data()
    const journeyType = (profile.journeyType || profile.currentJourneyType || '6W') as JourneyType
    const journeyStartDate = profile.journeyStartDate?.toDate?.() || new Date()
    const weekNumber = getCurrentWeekNumber(journeyStartDate)

    return { journeyType, weekNumber }
  } catch (error) {
    console.error('[PeerSessionService] Failed to get user journey info:', error)
    return null
  }
}

/**
 * Creates a new peer session with invitations in a single atomic batch.
 * This ensures both the session and all invitations are created together.
 */
export async function createPeerSession(params: CreateSessionParams): Promise<string> {
  const batch = writeBatch(db)
  const normalizedParticipants = assertValidCreateParams(params)

  // Generate session document reference
  const sessionRef = doc(collection(db, 'peer_sessions'))
  const scheduledAtTimestamp = Timestamp.fromDate(params.scheduledAt)

  const sessionPayload = removeUndefinedFields({
    title: params.title,
    description: params.description,
    platform: params.platform,
    meetingLink: params.meetingLink,
    timezone: params.timezone,
    participants: [params.createdBy, ...normalizedParticipants.filter(p => p !== params.createdBy)],
    status: 'scheduled',
    scheduledAt: scheduledAtTimestamp,
    confirmationDeadline: Timestamp.fromDate(addHours(params.scheduledAt, -2)),
    createdBy: params.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    confirmations: { [params.createdBy]: true },
    pointsAwarded: false,
  })

  batch.set(sessionRef, sessionPayload)

  // Create invitation documents for each participant (excluding creator)
  for (const participantId of normalizedParticipants) {
    if (!isNonEmptyString(participantId)) {
      continue
    }
    const inviteRef = doc(collection(db, 'peer_session_requests'))
    batch.set(inviteRef, removeUndefinedFields({
      sessionId: sessionRef.id,
      fromUserId: params.createdBy,
      fromName: params.creatorName,
      fromEmail: params.creatorEmail,
      toUserId: participantId,
      status: 'pending',
      createdAt: serverTimestamp(),
    }))
  }

  // Atomic commit
  await batch.commit()

  const sessionActionUrl = buildPeerConnectUrl(sessionRef.id)
  const formattedSessionDate = formatSessionDateLabel(params.scheduledAt, params.timezone)
  const inviteMessage = `${params.creatorName} invited you to "${params.title}" on ${formattedSessionDate}.`

  await Promise.all(
    normalizedParticipants.map(async (participantId) => {
      try {
        await createInAppNotification({
          userId: participantId,
          type: 'session_request',
          title: 'Peer session invitation',
          message: inviteMessage,
          relatedId: sessionRef.id,
          metadata: {
            sessionId: sessionRef.id,
            actionUrl: sessionActionUrl,
            actionLabel: 'View session',
            scheduledAt: params.scheduledAt.toISOString(),
            timezone: params.timezone,
            creatorName: params.creatorName,
          },
        })
      } catch (error) {
        console.error('[PeerSessionService] Failed to send invite notification', {
          participantId,
          sessionId: sessionRef.id,
          error,
        })
      }
    }),
  )

  return sessionRef.id
}

/**
 * Confirms a meeting for a user. Awards points if both participants have confirmed.
 * Points are only awarded once per session (tracked via pointsAwarded flag).
 */
export async function confirmSession(sessionId: string, userId: string): Promise<{ allConfirmed: boolean; pointsAwarded: boolean }> {
  const sessionRef = doc(db, 'peer_sessions', sessionId)
  const sessionSnap = await getDoc(sessionRef)

  if (!sessionSnap.exists()) {
    throw new Error('Session not found')
  }

  // Use transaction to prevent race condition with duplicate point awards
  let shouldAwardPoints = false
  let participantsToAward: string[] = []

  const result = await runTransaction(db, async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef)

    if (!sessionDoc.exists()) {
      throw new Error('Session not found in transaction')
    }

    const sessionData = sessionDoc.data()

    // Validate participants array
    const participants = Array.isArray(sessionData.participants) ? sessionData.participants : []
    if (participants.length < 2) {
      throw new Error('Invalid session: must have at least 2 participants')
    }

    const currentConfirmations = (sessionData.confirmations || {}) as Record<string, boolean>
    const alreadyAwarded = sessionData.pointsAwarded === true

    // Update user's confirmation
    const updatedConfirmations = { ...currentConfirmations, [userId]: true }
    transaction.update(sessionRef, {
      [`confirmations.${userId}`]: true,
      updatedAt: serverTimestamp(),
    })

    // Check if all participants have now confirmed
    const allConfirmed = participants.every(pid => updatedConfirmations[pid] === true)

    // If all confirmed and not already awarded, mark as awarded atomically
    if (allConfirmed && !alreadyAwarded) {
      transaction.update(sessionRef, {
        status: 'confirmed',
        pointsAwarded: true,
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      shouldAwardPoints = true
      participantsToAward = participants
    }

    return { allConfirmed, pointsAwarded: shouldAwardPoints }
  })

  // Award points OUTSIDE the transaction to avoid long-running transactions
  if (shouldAwardPoints && participantsToAward.length > 0) {
    for (const participantId of participantsToAward) {
      try {
        const journeyInfo = await getUserJourneyInfo(participantId)
        if (journeyInfo) {
          await awardChecklistPoints({
            uid: participantId,
            journeyType: journeyInfo.journeyType,
            weekNumber: journeyInfo.weekNumber,
            activity: PEER_SESSION_CONFIRMATION_ACTIVITY,
            source: 'peer_session',
            claimRef: `peer_session_confirmation:${sessionId}`,
          })
        }
      } catch (error) {
        console.error(`[PeerSessionService] Failed to award points to ${participantId}:`, error)
        // Continue awarding to other participants even if one fails
      }
    }
  }

  return result
}

export type NoShowResult =
  | { success: true; pointsAwarded: true }
  | { success: true; pointsAwarded: false; reason: 'no_journey' | 'already_reported' }
  | { success: false; reason: 'error'; error: string }

/**
 * Reports a no-show for a session. Awards accountability points to the reporter.
 * Returns structured result indicating success and whether points were awarded.
 */
export async function reportNoShow(sessionId: string, userId: string): Promise<NoShowResult> {
  const sessionRef = doc(db, 'peer_sessions', sessionId)
  const sessionSnap = await getDoc(sessionRef)

  if (!sessionSnap.exists()) {
    throw new Error('Session not found')
  }

  const sessionData = sessionSnap.data()
  const existingNoShows = (sessionData.noShows || {}) as Record<string, boolean>

  // Check if user already reported
  if (existingNoShows[userId]) {
    return { success: true, pointsAwarded: false, reason: 'already_reported' }
  }

  // Update session with no-show report
  await updateDoc(sessionRef, {
    status: 'no_show',
    [`noShows.${userId}`]: true,
    updatedAt: serverTimestamp(),
  })

  // Award accountability points to the reporter
  try {
    const journeyInfo = await getUserJourneyInfo(userId)
    if (journeyInfo) {
      await awardChecklistPoints({
        uid: userId,
        journeyType: journeyInfo.journeyType,
        weekNumber: journeyInfo.weekNumber,
        activity: PEER_SESSION_NO_SHOW_ACTIVITY,
        source: 'peer_session',
        claimRef: `peer_session_no_show:${sessionId}`,
      })
      return { success: true, pointsAwarded: true }
    }
    // User has no active journey
    return { success: true, pointsAwarded: false, reason: 'no_journey' }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[PeerSessionService] Failed to award no-show points:', error)
    return { success: false, reason: 'error', error: errorMessage }
  }
}

/**
 * Responds to a peer session invitation (accept or decline).
 * Idempotent - safe to call multiple times.
 */
export async function respondToInvitation(inviteId: string, accepted: boolean): Promise<void> {
  const inviteRef = doc(db, 'peer_session_requests', inviteId)
  const inviteSnap = await getDoc(inviteRef)

  if (!inviteSnap.exists()) {
    throw new Error('Invitation not found')
  }

  const inviteData = inviteSnap.data()
  const toUserId = resolveInvitationRecipient(inviteData)
  if (
    !isNonEmptyString(inviteData.sessionId) ||
    !isNonEmptyString(inviteData.fromUserId) ||
    !toUserId
  ) {
    throw new Error('Invitation data is missing required fields')
  }

  // Check if already responded
  if (inviteData.status !== 'pending') {
    return // Already responded, idempotent
  }

  await updateDoc(inviteRef, {
    status: accepted ? 'accepted' : 'declined',
    respondedAt: serverTimestamp(),
  })

  if (accepted) {
    try {
      const [session, profileSnap] = await Promise.all([
        getSession(inviteData.sessionId),
        getDoc(doc(db, 'profiles', toUserId)),
      ])
      const inviteeProfile = profileSnap.exists() ? (profileSnap.data() as DisplayNameInput) : undefined
      const inviteeName = getDisplayName(inviteeProfile, 'Peer')
      const sessionTitle = session?.title || 'Peer session'
      const timezone = session?.timezone || 'UTC'
      const formattedDate = session ? formatSessionDateLabel(session.scheduledAt, timezone) : ''
      const dateSuffix = formattedDate ? ` scheduled for ${formattedDate}` : ''
      const sessionLink = buildPeerConnectUrl(inviteData.sessionId)

      await createInAppNotification({
        userId: inviteData.fromUserId,
        type: 'session_request',
        title: 'Session invitation accepted',
        message: `${inviteeName} accepted your invitation to "${sessionTitle}".${dateSuffix}`,
        relatedId: inviteData.sessionId,
        metadata: {
          sessionId: inviteData.sessionId,
          actionUrl: sessionLink,
          actionLabel: 'View session',
          acceptedBy: inviteeName,
          status: 'accepted',
        },
      })
    } catch (error) {
      console.error('[PeerSessionService] Failed to notify inviter about acceptance', error)
    }
  }
}

/**
 * Subscribes to real-time updates for sessions where the user is a participant.
 */
export function subscribeToUserSessions(
  userId: string,
  callback: (sessions: PeerSession[]) => void
): Unsubscribe {
  const queries = buildSessionQueries(userId)

  const docsByKey = new Map<string, QueryDocumentSnapshot<DocumentData>[]>()

  const emitSessions = () => {
    const sessionsMap = new Map<string, PeerSession>()
    const skippedSessionIds = new Set<string>()

    for (const docs of docsByKey.values()) {
      for (const docSnap of docs) {
        try {
          const parsed = parseSessionDoc(docSnap)
          if (parsed) {
            sessionsMap.set(parsed.id, parsed)
          } else {
            skippedSessionIds.add(docSnap.id)
          }
        } catch (error) {
          console.warn('[PeerSessionService] Skipping malformed session document', {
            sessionId: docSnap.id,
            error,
          })
        }
      }
    }

    if (skippedSessionIds.size > 0) {
      console.warn('[PeerSessionService] Skipped sessions with missing fields', {
        userId,
        sessionIds: Array.from(skippedSessionIds),
      })
    }

    const sessions = Array.from(sessionsMap.values())
    sessions.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
    callback(sessions)
  }

  const unsubscribers = queries.map(({ key, query: sessionsQuery, optional }) =>
    onSnapshot(
      sessionsQuery,
      (snapshot) => {
        docsByKey.set(key, snapshot.docs)
        emitSessions()
      },
      (error) => {
        if (optional && isPermissionDeniedError(error)) {
          docsByKey.set(key, [])
          emitSessions()
          return
        }

        const projectId = db.app.options.projectId ?? 'unknown'
        console.error('[PeerSessionService] Sessions subscription error:', {
          userId,
          code: (error as { code?: string }).code,
          message: error.message,
          projectId,
          authUid: auth.currentUser?.uid ?? null,
          queryKey: key,
          error,
        })
        docsByKey.set(key, [])
        emitSessions()
      }
    )
  )

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}

/**
 * Subscribes to real-time updates for pending invitations for a user.
 */
export function subscribeToUserInvitations(
  userId: string,
  callback: (invitations: PeerSessionRequest[]) => void
): Unsubscribe {
  const queries = buildInvitationQueries(userId)
  const docsByKey = new Map<string, QueryDocumentSnapshot<DocumentData>[]>()

  const emitInvitations = () => {
    const invitationsMap = new Map<string, PeerSessionRequest>()
    const skippedInviteIds: string[] = []

    for (const docs of docsByKey.values()) {
      for (const docSnap of docs) {
        try {
          const parsed = parseInvitationDoc(docSnap)
          if (parsed) {
            invitationsMap.set(parsed.id, parsed)
          } else {
            skippedInviteIds.push(docSnap.id)
          }
        } catch (error) {
          console.warn('[PeerSessionService] Skipping malformed invitation document', {
            inviteId: docSnap.id,
            error,
          })
          skippedInviteIds.push(docSnap.id)
        }
      }
    }

    if (skippedInviteIds.length > 0) {
      console.warn('[PeerSessionService] Skipped invitations with missing fields', {
        userId,
        inviteIds: skippedInviteIds,
      })
    }

    const invitations = Array.from(invitationsMap.values())
    invitations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    callback(invitations)
  }

  const unsubscribers = queries.map(({ key, query: invitesQuery }) =>
    onSnapshot(
      invitesQuery,
      (snapshot) => {
        docsByKey.set(key, snapshot.docs)
        emitInvitations()
      },
      (error) => {
        const projectId = db.app.options.projectId ?? 'unknown'
        console.error('[PeerSessionService] Invitations subscription error:', {
          userId,
          code: (error as { code?: string }).code,
          message: error.message,
          projectId,
          authUid: auth.currentUser?.uid ?? null,
          queryKey: key,
          error,
        })
        docsByKey.set(key, [])
        emitInvitations()
      }
    )
  )

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}

export async function fetchUserSessions(userId: string): Promise<PeerSession[]> {
  const queries = buildSessionQueries(userId)
  const sessionsMap = new Map<string, PeerSession>()

  await Promise.all(
    queries.map(async ({ query: sessionsQuery, optional }) => {
      try {
        const snapshot = await getDocs(sessionsQuery)
        snapshot.docs.forEach((docSnap) => {
          const parsed = parseSessionDoc(docSnap)
          if (parsed) {
            sessionsMap.set(parsed.id, parsed)
          }
        })
      } catch (error) {
        if (optional && isPermissionDeniedError(error)) {
          return
        }

        console.error('[PeerSessionService] Failed to fetch sessions:', {
          userId,
          error,
        })
      }
    }),
  )

  const sessions = Array.from(sessionsMap.values())
  sessions.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
  return sessions
}

export async function fetchUserInvitations(userId: string): Promise<PeerSessionRequest[]> {
  const queries = buildInvitationQueries(userId)
  const invitationsMap = new Map<string, PeerSessionRequest>()

  await Promise.all(
    queries.map(async ({ query: invitesQuery }) => {
      try {
        const snapshot = await getDocs(invitesQuery)
        snapshot.docs.forEach((docSnap) => {
          const parsed = parseInvitationDoc(docSnap)
          if (parsed) {
            invitationsMap.set(parsed.id, parsed)
          }
        })
      } catch (error) {
        console.error('[PeerSessionService] Failed to fetch invitations:', {
          userId,
          error,
        })
      }
    }),
  )

  const invitations = Array.from(invitationsMap.values())
  invitations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return invitations
}

/**
 * Fetches a single session by ID.
 */
export async function getSession(sessionId: string): Promise<PeerSession | null> {
  const sessionSnap = await getDoc(doc(db, 'peer_sessions', sessionId))

  if (!sessionSnap.exists()) {
    return null
  }

  const data = sessionSnap.data()
  return {
    id: sessionSnap.id,
    title: data.title || 'Peer Session',
    description: data.description,
    platform: data.platform || 'Zoom',
    meetingLink: data.meetingLink,
    timezone: data.timezone || 'UTC',
    participants: data.participants || [],
    status: data.status || 'pending',
    scheduledAt: data.scheduledAt?.toDate?.() || new Date(),
    confirmationDeadline: data.confirmationDeadline?.toDate?.() || new Date(),
    confirmations: data.confirmations || {},
    noShows: data.noShows,
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.(),
    pointsAwarded: data.pointsAwarded,
  }
}

/**
 * Fetches all invitations sent by a user.
 */
export async function getSentInvitations(userId: string): Promise<PeerSessionRequest[]> {
  const invitesQuery = query(
    collection(db, 'peer_session_requests'),
    where('fromUserId', '==', userId)
  )

  const snapshot = await getDocs(invitesQuery)

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      sessionId: data.sessionId,
      fromUserId: data.fromUserId,
      fromName: data.fromName || 'Peer',
      fromEmail: data.fromEmail || '',
      toUserId: data.toUserId,
      status: data.status || 'pending',
      createdAt: data.createdAt?.toDate?.() || new Date(),
      respondedAt: data.respondedAt?.toDate?.(),
    }
  })
}
