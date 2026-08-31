/**
 * Session points issuance helpers for mentor / coach dashboards.
 * Awards use mentor_meetup / ambassador_session (+2,000 each) with journey
 * frequency caps from pointsConfig.
 */
import { supabase } from '@/services/supabase'
import {
  getActivityDefinitionById,
  type JourneyType,
} from '@/config/pointsConfig'
import {
  completeMentorshipSession,
  type MentorshipSession,
} from '@/services/mentorshipService'
import {
  markAttendance,
  type CoachBooking,
} from '@/services/ambassadorSessionService'
import { resolvePurchasedCoachSessions } from '@/utils/purchasedCoachSessions'
import { resolveLearnerJourneyContext } from '@/services/learnerJourneyContext'

export type SessionPointsRole = 'mentor' | 'coach'

export interface SessionPointsQuota {
  activityId: 'mentor_meetup' | 'ambassador_session'
  activityTitle: string
  pointsEach: number
  maxAwards: number
  awardedCount: number
  remaining: number
  journeyType: JourneyType | null
}

export interface PendingMentorAward {
  kind: 'mentor'
  sessionId: string
  learnerId: string
  learnerName: string
  topic: string
  when: Date | null
  status: MentorshipSession['status']
  pointsAlreadyAwarded: boolean
}

export interface PendingCoachAward {
  kind: 'coach'
  bookingId: string
  learnerId: string
  learnerName: string
  topic: string
  when: Date | null
  status: CoachBooking['status']
  pointsAlreadyAwarded: boolean
}

export type PendingSessionAward = PendingMentorAward | PendingCoachAward

const pickString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

async function countLedgerAwards(learnerId: string, activityId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from('points_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('uid', learnerId)
    .eq('activity_id', activityId)
  if (error) {
    console.warn('[sessionPointsService] ledger count failed', error.message)
    return null
  }
  return count ?? 0
}

async function countMentorSessionAwards(learnerId: string, mentorId?: string): Promise<number> {
  let query = supabase
    .from('mentorship_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('learner_id', learnerId)
    .eq('points_awarded', true)
  if (mentorId) query = query.eq('mentor_id', mentorId)
  const { count, error } = await query
  if (error) {
    console.warn('[sessionPointsService] mentor session award count failed', error.message)
    return 0
  }
  return count ?? 0
}

async function countCoachBookingAwards(learnerId: string, coachId?: string): Promise<number> {
  let query = supabase
    .from('ambassador_slot_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('learner_id', learnerId)
    .eq('points_awarded', true)
  if (coachId) query = query.eq('ambassador_id', coachId)
  const { count, error } = await query
  if (error) {
    console.warn('[sessionPointsService] coach booking award count failed', error.message)
    return 0
  }
  return count ?? 0
}

export async function getLearnerJourneyType(learnerId: string): Promise<JourneyType | null> {
  const ctx = await resolveLearnerJourneyContext(learnerId)
  return ctx?.journeyType ?? null
}

/**
 * Resolve a learner's journey for session-points issuance. Uses a SECURITY
 * DEFINER RPC so mentors/coaches can read journey_type even when profiles
 * SELECT RLS would otherwise hide the mentee row.
 */
export async function resolveLearnerJourneyForSessionPoints(
  learnerId: string,
): Promise<{ journeyType: JourneyType; weekNumber: number } | null> {
  return resolveLearnerJourneyContext(learnerId)
}

export async function getSessionPointsQuota(params: {
  role: SessionPointsRole
  learnerId: string
  actorId?: string
  purchasedCoachSessions?: number | null
}): Promise<SessionPointsQuota> {
  const { role, learnerId, purchasedCoachSessions } = params
  const journeyType = await getLearnerJourneyType(learnerId)
  const activityId = role === 'mentor' ? 'mentor_meetup' : 'ambassador_session'
  const activity = journeyType
    ? getActivityDefinitionById({ activityId, journeyType })
    : null

  const pointsEach = activity?.points ?? 2000
  const journeyMax = activity?.activityPolicy?.maxTotal ?? 0
  // Journey caps are per learner (not per mentor/coach). Coach awards are also
  // capped by purchased coaching sessions (learner override or org default).
  const purchased =
    role === 'coach'
      ? resolvePurchasedCoachSessions({
          learnerPurchased: purchasedCoachSessions,
          orgPurchased: null,
          fallback: journeyMax > 0 ? journeyMax : undefined,
        })
      : null
  const maxAwards =
    role === 'coach'
      ? journeyMax > 0
        ? Math.min(purchased ?? journeyMax, journeyMax)
        : 0
      : journeyMax

  const ledgerCount = await countLedgerAwards(learnerId, activityId)
  const sessionCount =
    role === 'mentor'
      ? await countMentorSessionAwards(learnerId)
      : await countCoachBookingAwards(learnerId)
  const awardedCount = Math.max(ledgerCount ?? 0, sessionCount)
  const remaining = Math.max(0, maxAwards - awardedCount)

  return {
    activityId,
    activityTitle: activity?.title ?? (role === 'mentor' ? 'Mentor Meet Up' : 'Coach Session'),
    pointsEach,
    maxAwards,
    awardedCount,
    remaining,
    journeyType,
  }
}

export function listPendingMentorAwards(
  sessions: MentorshipSession[],
): PendingMentorAward[] {
  return sessions
    .filter(
      (s) =>
        (s.status === 'scheduled' || s.status === 'completed') && !s.pointsAwarded,
    )
    .map((s) => ({
      kind: 'mentor' as const,
      sessionId: s.id,
      learnerId: s.learnerId,
      learnerName: s.learnerName ?? 'Learner',
      topic: s.topic,
      when: s.scheduledAt ?? s.proposedAt,
      status: s.status,
      pointsAlreadyAwarded: s.pointsAwarded,
    }))
    .sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0))
}

export function listPendingCoachAwards(bookings: CoachBooking[]): PendingCoachAward[] {
  return bookings
    .filter(
      (b) =>
        (b.status === 'booked' || b.status === 'attended') && !b.pointsAwarded,
    )
    .map((b) => ({
      kind: 'coach' as const,
      bookingId: b.id,
      learnerId: b.learnerId,
      learnerName: b.learnerName ?? 'Learner',
      topic: b.slotTitle ?? 'Coaching session',
      when: b.slotScheduledAt,
      status: b.status,
      pointsAlreadyAwarded: b.pointsAwarded,
    }))
    .sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0))
}

export async function awardMentorSessionPoints(sessionId: string): Promise<{
  pointsAwarded: boolean
  pointsAmount: number
  message?: string
}> {
  const result = await completeMentorshipSession({ sessionId })
  return {
    pointsAwarded: result.pointsAwarded,
    pointsAmount: result.pointsAmount ?? 0,
    message: result.message,
  }
}

export async function awardCoachSessionPoints(params: {
  bookingId: string
  coachId: string
  purchasedCoachSessions?: number | null
}): Promise<{
  pointsAwarded: boolean
  pointsAmount: number
  message?: string
}> {
  const { data: booking, error } = await supabase
    .from('ambassador_slot_bookings')
    .select('learner_id, status, points_awarded')
    .eq('id', params.bookingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!booking) throw new Error('Booking not found.')

  const learnerId = pickString(booking.learner_id)
  if (learnerId && !booking.points_awarded) {
    const quota = await getSessionPointsQuota({
      role: 'coach',
      learnerId,
      purchasedCoachSessions: params.purchasedCoachSessions,
    })
    if (quota.remaining <= 0) {
      // Still confirm attendance when booked; skip a futile points attempt.
      if (booking.status === 'booked') {
        await markAttendance({
          bookingId: params.bookingId,
          status: 'attended',
          markedBy: params.coachId,
          skipPoints: true,
        })
      }
      return {
        pointsAwarded: false,
        pointsAmount: 0,
        message: describeQuota(quota),
      }
    }
  }

  const result = await markAttendance({
    bookingId: params.bookingId,
    status: 'attended',
    markedBy: params.coachId,
  })
  return {
    pointsAwarded: result.pointsAwarded,
    pointsAmount: result.pointsAmount ?? 0,
    message: result.message,
  }
}

export const formatSessionWhen = (when: Date | null): string => {
  if (!when) return 'Time not set'
  try {
    return when.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return 'Time not set'
  }
}

export const describeQuota = (quota: SessionPointsQuota): string => {
  if (!quota.journeyType) {
    return 'No active journey on this learner - points cannot be issued yet.'
  }
  if (quota.maxAwards <= 0) {
    return `${quota.activityTitle} is not part of this journey.`
  }
  return `${quota.awardedCount} of ${quota.maxAwards} awards used · +${quota.pointsEach.toLocaleString()} each · ${quota.remaining} remaining`
}

/** @internal helpers exported for tests */
export const __test__ = { pickString }
