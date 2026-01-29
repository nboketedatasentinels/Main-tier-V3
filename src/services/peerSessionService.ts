import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { awardChecklistPoints } from '@/services/pointsService'
import {
  PEER_SESSION_CONFIRMATION_ACTIVITY,
  PEER_SESSION_NO_SHOW_ACTIVITY,
  type JourneyType,
} from '@/config/pointsConfig'
import { removeUndefinedFields } from '@/utils/firestore'
import { addDays } from 'date-fns'
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

  const normalizedParticipants = normalizeParticipants(params.participants, params.createdBy)
  if (normalizedParticipants.length === 0) {
    throw new Error('At least one participant is required')
  }

  if (!isNonEmptyString(params.creatorName) || !isNonEmptyString(params.creatorEmail)) {
    throw new Error('Creator name and email are required')
  }

  return normalizedParticipants
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
    participants: [params.createdBy, ...normalizedParticipants],
    status: 'scheduled',
    scheduledAt: scheduledAtTimestamp,
    confirmationDeadline: Timestamp.fromDate(addDays(params.scheduledAt, -1)),
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

  const sessionData = sessionSnap.data()
  const participants = sessionData.participants as string[]
  const currentConfirmations = (sessionData.confirmations || {}) as Record<string, boolean>
  const alreadyAwarded = sessionData.pointsAwarded === true

  // Update user's confirmation
  await updateDoc(sessionRef, {
    [`confirmations.${userId}`]: true,
    updatedAt: serverTimestamp(),
  })

  // Check if all participants have now confirmed
  const updatedConfirmations = { ...currentConfirmations, [userId]: true }
  const allConfirmed = participants.every(pid => updatedConfirmations[pid] === true)

  let pointsAwarded = false

  if (allConfirmed && !alreadyAwarded) {
    // Mark session as confirmed and flag points as awarded
    await updateDoc(sessionRef, {
      status: 'confirmed',
      pointsAwarded: true,
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Award points to ALL participants
    for (const participantId of participants) {
      try {
        const journeyInfo = await getUserJourneyInfo(participantId)
        if (journeyInfo) {
          await awardChecklistPoints({
            uid: participantId,
            journeyType: journeyInfo.journeyType,
            weekNumber: journeyInfo.weekNumber,
            activity: PEER_SESSION_CONFIRMATION_ACTIVITY,
            source: 'peer_session',
          })
        }
      } catch (error) {
        console.error(`[PeerSessionService] Failed to award points to ${participantId}:`, error)
        // Continue awarding to other participants even if one fails
      }
    }

    pointsAwarded = true
  }

  return { allConfirmed, pointsAwarded }
}

/**
 * Reports a no-show for a session. Awards accountability points to the reporter.
 */
export async function reportNoShow(sessionId: string, userId: string): Promise<boolean> {
  const sessionRef = doc(db, 'peer_sessions', sessionId)
  const sessionSnap = await getDoc(sessionRef)

  if (!sessionSnap.exists()) {
    throw new Error('Session not found')
  }

  const sessionData = sessionSnap.data()
  const existingNoShows = (sessionData.noShows || {}) as Record<string, boolean>

  // Check if user already reported
  if (existingNoShows[userId]) {
    return false // Already reported
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
      })
      return true
    }
  } catch (error) {
    console.error('[PeerSessionService] Failed to award no-show points:', error)
  }

  return false
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
  if (
    !isNonEmptyString(inviteData.sessionId) ||
    !isNonEmptyString(inviteData.fromUserId) ||
    !isNonEmptyString(inviteData.toUserId)
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
}

/**
 * Subscribes to real-time updates for sessions where the user is a participant.
 */
export function subscribeToUserSessions(
  userId: string,
  callback: (sessions: PeerSession[]) => void
): Unsubscribe {
  const sessionsQuery = query(
    collection(db, 'peer_sessions'),
    where('participants', 'array-contains', userId)
  )

  return onSnapshot(sessionsQuery, (snapshot) => {
    const sessions: PeerSession[] = []
    const skippedSessionIds: string[] = []

    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data()
        if (!Array.isArray(data.participants) || data.participants.length === 0) {
          skippedSessionIds.push(docSnap.id)
          continue
        }
        if (!isNonEmptyString(data.createdBy)) {
          skippedSessionIds.push(docSnap.id)
          continue
        }

        const scheduledAt = data.scheduledAt?.toDate?.()
        const confirmationDeadline = data.confirmationDeadline?.toDate?.()
        if (!scheduledAt || !confirmationDeadline) {
          skippedSessionIds.push(docSnap.id)
          continue
        }

        sessions.push({
          id: docSnap.id,
          title: data.title || 'Peer Session',
          description: data.description,
          platform: data.platform || 'Zoom',
          meetingLink: data.meetingLink,
          timezone: data.timezone || 'UTC',
          participants: data.participants || [],
          status: data.status || 'pending',
          scheduledAt,
          confirmationDeadline,
          confirmations: data.confirmations || {},
          noShows: data.noShows,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.(),
          pointsAwarded: data.pointsAwarded,
        })
      } catch (error) {
        console.warn('[PeerSessionService] Skipping malformed session document', {
          sessionId: docSnap.id,
          error,
        })
      }
    }

    if (skippedSessionIds.length > 0) {
      console.warn('[PeerSessionService] Skipped sessions with missing fields', {
        userId,
        sessionIds: skippedSessionIds,
      })
    }

    // Sort by scheduled date descending (most recent first)
    sessions.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())

    callback(sessions)
  }, (error) => {
    console.error('[PeerSessionService] Sessions subscription error:', {
      userId,
      code: (error as { code?: string }).code,
      message: error.message,
      error,
    })
    callback([])
  })
}

/**
 * Subscribes to real-time updates for pending invitations for a user.
 */
export function subscribeToUserInvitations(
  userId: string,
  callback: (invitations: PeerSessionRequest[]) => void
): Unsubscribe {
  const invitesQuery = query(
    collection(db, 'peer_session_requests'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending')
  )

  return onSnapshot(invitesQuery, (snapshot) => {
    const invitations: PeerSessionRequest[] = []
    const skippedInviteIds: string[] = []

    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data()
        if (
          !isNonEmptyString(data.sessionId) ||
          !isNonEmptyString(data.fromUserId) ||
          !isNonEmptyString(data.toUserId)
        ) {
          skippedInviteIds.push(docSnap.id)
          continue
        }

        invitations.push({
          id: docSnap.id,
          sessionId: data.sessionId,
          fromUserId: data.fromUserId,
          fromName: data.fromName || 'Peer',
          fromEmail: data.fromEmail || '',
          toUserId: data.toUserId,
          status: data.status || 'pending',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          respondedAt: data.respondedAt?.toDate?.(),
        })
      } catch (error) {
        console.warn('[PeerSessionService] Skipping malformed invitation document', {
          inviteId: docSnap.id,
          error,
        })
      }
    }

    if (skippedInviteIds.length > 0) {
      console.warn('[PeerSessionService] Skipped invitations with missing fields', {
        userId,
        inviteIds: skippedInviteIds,
      })
    }

    // Sort by creation date descending (most recent first)
    invitations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    callback(invitations)
  }, (error) => {
    console.error('[PeerSessionService] Invitations subscription error:', {
      userId,
      code: (error as { code?: string }).code,
      message: error.message,
      error,
    })
    callback([])
  })
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
