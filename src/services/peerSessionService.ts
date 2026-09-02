/**
 * Peer practical sessions via Supabase (migration 0088).
 *
 * Replaces Firestore peer_sessions / peer_session_requests writes that fail
 * after the auth cutover (no Firebase session → permission-denied on create).
 */
import { supabase } from '@/services/supabase'
import { awardChecklistPoints } from '@/services/pointsService'
import {
  PEER_SESSION_CONFIRMATION_ACTIVITY,
  PEER_SESSION_NO_SHOW_ACTIVITY,
  type JourneyType,
} from '@/config/pointsConfig'
import { getCurrentWeekNumber } from '@/utils/weekCalculations'

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

type Unsubscribe = () => void

type PeerSessionLifecycleInput = Pick<
  PeerSession,
  'id' | 'title' | 'status' | 'scheduledAt' | 'timezone' | 'participants' | 'createdBy'
>

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const coerceDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item)).filter(Boolean)
}

const asBoolRecord = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = Boolean(entry)
  }
  return out
}

const mapSessionRow = (row: Record<string, unknown>): PeerSession | null => {
  if (typeof row.id !== 'string') return null
  const scheduledAt = coerceDate(row.scheduledAt ?? row.scheduled_at)
  const confirmationDeadline = coerceDate(row.confirmationDeadline ?? row.confirmation_deadline)
  if (!scheduledAt || !confirmationDeadline) return null

  const platformRaw = typeof row.platform === 'string' ? row.platform : 'Zoom'
  const platform =
    platformRaw === 'Google Meet' || platformRaw === 'Zoho Meet' || platformRaw === 'Zoom'
      ? platformRaw
      : 'Zoom'

  return {
    id: row.id,
    title: typeof row.title === 'string' ? row.title : 'Practical meetup',
    description: typeof row.description === 'string' ? row.description : undefined,
    platform,
    meetingLink:
      typeof row.meetingLink === 'string'
        ? row.meetingLink
        : typeof row.meeting_link === 'string'
          ? row.meeting_link
          : undefined,
    timezone:
      typeof row.timezone === 'string' && row.timezone.trim()
        ? row.timezone
        : 'UTC',
    participants: asStringArray(row.participants),
    status: (typeof row.status === 'string' ? row.status : 'scheduled') as PeerSession['status'],
    scheduledAt,
    confirmationDeadline,
    confirmations: asBoolRecord(row.confirmations),
    noShows: asBoolRecord(row.noShows ?? row.no_shows),
    createdBy: String(row.createdBy ?? row.created_by ?? ''),
    createdAt: coerceDate(row.createdAt ?? row.created_at) ?? new Date(),
    updatedAt: coerceDate(row.updatedAt ?? row.updated_at) ?? undefined,
    pointsAwarded: Boolean(row.pointsAwarded ?? row.points_awarded),
  }
}

const mapInviteRow = (row: Record<string, unknown>): PeerSessionRequest | null => {
  if (typeof row.id !== 'string') return null
  const sessionId = String(row.sessionId ?? row.session_id ?? '')
  const fromUserId = String(row.fromUserId ?? row.from_user_id ?? '')
  const toUserId = String(row.toUserId ?? row.to_user_id ?? '')
  if (!sessionId || !fromUserId || !toUserId) return null
  return {
    id: row.id,
    sessionId,
    fromUserId,
    fromName: typeof row.fromName === 'string' ? row.fromName : typeof row.from_name === 'string' ? row.from_name : 'Peer',
    fromEmail:
      typeof row.fromEmail === 'string'
        ? row.fromEmail
        : typeof row.from_email === 'string'
          ? row.from_email
          : '',
    toUserId,
    status: (typeof row.status === 'string' ? row.status : 'pending') as PeerSessionRequest['status'],
    createdAt: coerceDate(row.createdAt ?? row.created_at) ?? new Date(),
    respondedAt: coerceDate(row.respondedAt ?? row.responded_at) ?? undefined,
  }
}

const getUserJourneyInfo = async (
  uid: string,
): Promise<{ journeyType: JourneyType; weekNumber: number } | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('journey_type, data')
    .eq('id', uid)
    .maybeSingle()
  if (error || !data) return null
  const journeyType = (data.journey_type || (data.data as { journeyType?: string } | null)?.journeyType) as
    | JourneyType
    | undefined
  if (!journeyType) return null
  return { journeyType, weekNumber: getCurrentWeekNumber() }
}

const assertValidCreateParams = (params: CreateSessionParams): string[] => {
  if (!isNonEmptyString(params.title)) throw new Error('Please provide a practical title')
  if (!isNonEmptyString(params.createdBy)) throw new Error('Missing creator')
  if (!(params.scheduledAt instanceof Date) || Number.isNaN(params.scheduledAt.getTime())) {
    throw new Error('Invalid scheduled time')
  }
  if (params.scheduledAt.getTime() <= Date.now()) {
    throw new Error('Practical must be scheduled in the future')
  }
  const participants = Array.from(
    new Set(params.participants.filter((id) => isNonEmptyString(id) && id !== params.createdBy)),
  )
  if (participants.length < 2) {
    throw new Error('Select at least 2 participants so you can host a practical with peers')
  }
  return participants
}

export async function createPeerSession(params: CreateSessionParams): Promise<string> {
  const normalizedParticipants = assertValidCreateParams(params)

  const { data, error } = await supabase.rpc('create_peer_session', {
    p: {
      title: params.title,
      description: params.description ?? null,
      platform: params.platform,
      meeting_link: params.meetingLink ?? null,
      timezone: params.timezone,
      participants: normalizedParticipants,
      scheduled_at: params.scheduledAt.toISOString(),
      creator_name: params.creatorName,
      creator_email: params.creatorEmail,
    },
  })
  if (error) throw new Error(error.message)

  const result = (data ?? {}) as { ok?: boolean; error?: string; id?: string }
  if (!result.ok) {
    const messages: Record<string, string> = {
      not_authenticated: 'Please sign in again to create a practical.',
      title_required: 'Please provide a practical title.',
      invalid_scheduled_at: 'Please choose a valid date and time.',
      scheduled_at_must_be_future: 'Practical must be scheduled in the future.',
      participants_required: 'Select at least 2 participants.',
      min_participants: 'Select at least 2 participants so you can host a practical with peers.',
      participant_not_found: 'One of the selected peers is no longer available.',
      different_organization: 'You can only invite peers from your organisation or village.',
    }
    throw new Error(messages[result.error || ''] || `Could not create practical (${result.error || 'unknown'}).`)
  }
  if (!result.id) throw new Error('Practical created but no id returned.')
  return result.id
}

export async function fetchUserSessions(_userId?: string): Promise<PeerSession[]> {
  const { data, error } = await supabase.rpc('list_my_peer_sessions')
  if (error) throw new Error(error.message)
  const result = (data ?? {}) as { ok?: boolean; error?: string; sessions?: unknown }
  if (!result.ok) {
    if (result.error === 'not_authenticated') return []
    throw new Error(result.error || 'Failed to load practicals')
  }
  const rows = Array.isArray(result.sessions) ? result.sessions : []
  return rows
    .map((row) => mapSessionRow((row ?? {}) as Record<string, unknown>))
    .filter((session): session is PeerSession => Boolean(session))
}

export async function fetchUserInvitations(_userId?: string): Promise<PeerSessionRequest[]> {
  const { data, error } = await supabase.rpc('list_my_peer_session_invites')
  if (error) throw new Error(error.message)
  const result = (data ?? {}) as { ok?: boolean; error?: string; invites?: unknown }
  if (!result.ok) {
    if (result.error === 'not_authenticated') return []
    throw new Error(result.error || 'Failed to load invitations')
  }
  const rows = Array.isArray(result.invites) ? result.invites : []
  return rows
    .map((row) => mapInviteRow((row ?? {}) as Record<string, unknown>))
    .filter((invite): invite is PeerSessionRequest => Boolean(invite))
}

export async function getSession(sessionId: string): Promise<PeerSession | null> {
  const sessions = await fetchUserSessions()
  return sessions.find((session) => session.id === sessionId) ?? null
}

export async function confirmSession(
  sessionId: string,
  userId: string,
): Promise<{ allConfirmed: boolean; pointsAwarded: boolean }> {
  const { data, error } = await supabase.rpc('confirm_peer_session', {
    p_session_id: sessionId,
  })
  if (error) throw new Error(error.message)

  const result = (data ?? {}) as {
    ok?: boolean
    error?: string
    allConfirmed?: boolean
    pointsAwarded?: boolean
    participants?: unknown
  }
  if (!result.ok) throw new Error(result.error || 'Could not confirm practical')

  if (result.pointsAwarded) {
    const participants = asStringArray(result.participants)
    for (const participantId of participants) {
      try {
        const journeyInfo = await getUserJourneyInfo(participantId)
        if (!journeyInfo) continue
        await awardChecklistPoints({
          uid: participantId,
          journeyType: journeyInfo.journeyType,
          weekNumber: journeyInfo.weekNumber,
          activity: PEER_SESSION_CONFIRMATION_ACTIVITY,
          source: 'peer_session',
          claimRef: `peer_session_confirmation:${sessionId}`,
        })
      } catch (awardError) {
        console.error(`[PeerSessionService] Failed to award points to ${participantId}:`, awardError)
      }
    }
  }

  void userId
  return {
    allConfirmed: Boolean(result.allConfirmed),
    pointsAwarded: Boolean(result.pointsAwarded),
  }
}

export type NoShowResult =
  | { success: true; pointsAwarded: true }
  | { success: true; pointsAwarded: false; reason: 'no_journey' | 'already_reported' }
  | { success: false; reason: 'error'; error: string }

export async function reportNoShow(sessionId: string, userId: string): Promise<NoShowResult> {
  try {
    const { data, error } = await supabase.rpc('report_peer_session_no_show', {
      p_session_id: sessionId,
    })
    if (error) throw new Error(error.message)
    const result = (data ?? {}) as {
      ok?: boolean
      error?: string
      already_reported?: boolean
      award_points?: boolean
    }
    if (!result.ok) throw new Error(result.error || 'Could not report no-show')
    if (result.already_reported) {
      return { success: true, pointsAwarded: false, reason: 'already_reported' }
    }
    if (!result.award_points) {
      return { success: true, pointsAwarded: false, reason: 'already_reported' }
    }

    const journeyInfo = await getUserJourneyInfo(userId)
    if (!journeyInfo) return { success: true, pointsAwarded: false, reason: 'no_journey' }

    await awardChecklistPoints({
      uid: userId,
      journeyType: journeyInfo.journeyType,
      weekNumber: journeyInfo.weekNumber,
      activity: PEER_SESSION_NO_SHOW_ACTIVITY,
      source: 'peer_session',
      claimRef: `peer_session_no_show:${sessionId}`,
    })
    return { success: true, pointsAwarded: true }
  } catch (error) {
    return {
      success: false,
      reason: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function respondToInvitation(inviteId: string, accepted: boolean): Promise<void> {
  const { data, error } = await supabase.rpc('respond_peer_session_invite', {
    p_invite_id: inviteId,
    p_accepted: accepted,
  })
  if (error) throw new Error(error.message)
  const result = (data ?? {}) as { ok?: boolean; error?: string }
  if (!result.ok) throw new Error(result.error || 'Could not respond to invitation')
}

export function subscribeToUserSessions(
  userId: string,
  callback: (sessions: PeerSession[]) => void,
): Unsubscribe {
  let active = true

  const load = async () => {
    try {
      const sessions = await fetchUserSessions(userId)
      if (active) callback(sessions)
    } catch (error) {
      console.warn('[PeerSessionService] Failed to refresh sessions', error)
      if (active) callback([])
    }
  }

  void load()
  const channel = supabase
    .channel(`peer-sessions-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'peer_sessions' }, () => {
      void load()
    })
    .subscribe()
  const interval = window.setInterval(() => {
    void load()
  }, 20000)

  return () => {
    active = false
    window.clearInterval(interval)
    void supabase.removeChannel(channel)
  }
}

export function subscribeToUserInvitations(
  userId: string,
  callback: (invites: PeerSessionRequest[]) => void,
): Unsubscribe {
  let active = true

  const load = async () => {
    try {
      const invites = await fetchUserInvitations(userId)
      if (active) callback(invites)
    } catch (error) {
      console.warn('[PeerSessionService] Failed to refresh invitations', error)
      if (active) callback([])
    }
  }

  void load()
  const channel = supabase
    .channel(`peer-session-invites-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'peer_session_requests' }, () => {
      void load()
    })
    .subscribe()
  const interval = window.setInterval(() => {
    void load()
  }, 20000)

  return () => {
    active = false
    window.clearInterval(interval)
    void supabase.removeChannel(channel)
  }
}

export async function markPeerSessionMissedIfElapsed(
  sessionId: string,
  _userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('mark_peer_session_missed_if_elapsed', {
    p_session_id: sessionId,
  })
  if (error) {
    console.warn('[PeerSessionService] mark missed failed', error)
    return false
  }
  const result = (data ?? {}) as { ok?: boolean; marked?: boolean }
  return Boolean(result.ok && result.marked)
}

export async function processPeerSessionLifecycleForUser(
  session: PeerSessionLifecycleInput,
  userId: string,
): Promise<{ markedMissed: boolean }> {
  const markedMissed = await markPeerSessionMissedIfElapsed(session.id, userId)
  return { markedMissed }
}

export async function getSentInvitations(userId: string): Promise<PeerSessionRequest[]> {
  const { data, error } = await supabase
    .from('peer_session_requests')
    .select('*')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => mapInviteRow(row as Record<string, unknown>))
    .filter((invite): invite is PeerSessionRequest => Boolean(invite))
}
