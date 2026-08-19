import React, { useEffect, useMemo, useState } from 'react'
import { Box, Skeleton, Text } from '@chakra-ui/react'
import { format } from 'date-fns'
import { SessionPrepPanel } from '@/components/session-prep/SessionPrepPanel'
import { useMentorshipGoals } from '@/hooks/useMentorshipGoals'
import { useLearnerMentorshipSessions } from '@/hooks/useMentorshipSessions'
import { useSessionPrepLift } from '@/hooks/useSessionPrepLift'
import { getDisplayName } from '@/utils/displayName'
import { mentorMeetupCountForJourney } from '@/services/sessionPrepContent'
import type { SessionPrepAudience } from '@/services/sessionPrepContent'
import {
  groupBookingsByStatus,
  subscribeToLearnerBookings,
  type CoachBooking,
} from '@/services/ambassadorSessionService'
import { supabase } from '@/services/supabase'
import { nextCoachSessionNumber } from '@/utils/purchasedCoachSessions'
import type { UserProfile } from '@/types'

interface LearnerSessionPrepProps {
  audience: Extract<SessionPrepAudience, 'mentor' | 'coach'>
  learner: UserProfile
  mentorOrCoachProfile?: UserProfile | null
  sessionNumber?: number
  purchasedCoachSessions?: number
  windowStatus?: 'on_track' | 'warning' | 'alert' | 'recovery' | null
  /** Org programme courses - feed AI conversation suggestions. */
  courseTitles?: string[] | null
  onPrimary?: () => void
  onSecondary?: () => void
  primaryLoading?: boolean
}

const formatScheduledLabel = (when: Date | null, durationMinutes: number | null): string => {
  if (!when) return 'No upcoming session scheduled'
  try {
    const whenPart = `${format(when, 'EEE, MMM d')} · ${format(when, 'h:mm a')}`
    return durationMinutes && durationMinutes > 0
      ? `${whenPart} · ${durationMinutes} min`
      : whenPart
  } catch {
    return 'Upcoming session'
  }
}

/** Loads goals + LIFT + live session timing and renders Session Prep for mentor or coach. */
export const LearnerSessionPrep: React.FC<LearnerSessionPrepProps> = ({
  audience,
  learner,
  sessionNumber: sessionNumberProp,
  purchasedCoachSessions,
  windowStatus = null,
  courseTitles,
  onPrimary,
  onSecondary,
  primaryLoading,
}) => {
  const learnerId = learner.id ?? null
  const { pillars, developmentEdge, loading: liftLoading } = useSessionPrepLift(learnerId)
  const { goals, loading: goalsLoading } = useMentorshipGoals(
    learnerId,
    typeof learner.mentorId === 'string' ? learner.mentorId : null,
  )
  const { sessions: mentorshipSessions, loading: mentorSessionsLoading } =
    useLearnerMentorshipSessions(audience === 'mentor' ? learnerId : null)

  const [coachBookings, setCoachBookings] = useState<CoachBooking[]>([])
  const [coachBookingsLoading, setCoachBookingsLoading] = useState(audience === 'coach')
  const [coachDurationMinutes, setCoachDurationMinutes] = useState<number | null>(null)

  useEffect(() => {
    if (audience !== 'coach' || !learnerId) {
      setCoachBookings([])
      setCoachBookingsLoading(false)
      return
    }
    setCoachBookingsLoading(true)
    return subscribeToLearnerBookings(
      learnerId,
      (bookings) => {
        setCoachBookings(bookings)
        setCoachBookingsLoading(false)
      },
      () => {
        setCoachBookings([])
        setCoachBookingsLoading(false)
      },
    )
  }, [audience, learnerId])

  const mentorCompleted = useMemo(
    () => mentorshipSessions.filter((s) => s.status === 'completed').length,
    [mentorshipSessions],
  )
  const mentorUpcoming = useMemo(() => {
    const now = Date.now()
    return mentorshipSessions
      .filter((s) => s.status === 'scheduled')
      .map((s) => ({
        when: s.scheduledAt ?? s.proposedAt,
        topic: s.topic,
      }))
      .filter((s): s is { when: Date; topic: string } => Boolean(s.when && s.when.getTime() >= now - 60_000))
      .sort((a, b) => a.when.getTime() - b.when.getTime())[0] ?? null
  }, [mentorshipSessions])

  const coachGrouped = useMemo(() => groupBookingsByStatus(coachBookings), [coachBookings])
  const coachUpcoming = useMemo(() => {
    const now = Date.now()
    return coachGrouped.booked
      .filter((b) => (b.slotScheduledAt?.getTime() ?? 0) >= now - 60_000)
      .sort(
        (a, b) =>
          (a.slotScheduledAt?.getTime() ?? 0) - (b.slotScheduledAt?.getTime() ?? 0),
      )[0] ?? null
  }, [coachGrouped.booked])

  useEffect(() => {
    if (!coachUpcoming?.slotId) {
      setCoachDurationMinutes(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('ambassador_slots')
          .select('duration_minutes')
          .eq('id', coachUpcoming.slotId)
          .maybeSingle()
        if (cancelled) return
        const mins = Number(data?.duration_minutes)
        setCoachDurationMinutes(Number.isFinite(mins) && mins > 0 ? mins : 60)
      } catch {
        if (!cancelled) setCoachDurationMinutes(60)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [coachUpcoming?.slotId])

  const mentorTotal = mentorMeetupCountForJourney(
    typeof learner.journeyType === 'string' ? learner.journeyType : null,
  )
  const coachPurchased = purchasedCoachSessions ?? null
  const derivedSessionNumber =
    audience === 'mentor'
      ? Math.min(Math.max(1, mentorCompleted + 1), Math.max(1, mentorTotal || 1))
      : nextCoachSessionNumber({
          attendedCount: coachGrouped.attended.length,
          purchased: coachPurchased ?? 5,
        })
  const sessionNumber = sessionNumberProp ?? derivedSessionNumber

  const durationMinutes =
    audience === 'coach' ? coachDurationMinutes : mentorUpcoming ? 60 : null
  const scheduledWhen =
    audience === 'coach' ? coachUpcoming?.slotScheduledAt ?? null : mentorUpcoming?.when ?? null
  const scheduledLabel = formatScheduledLabel(scheduledWhen, durationMinutes)

  const challengePreference =
    typeof (learner as { challengePreference?: string }).challengePreference === 'string'
      ? (learner as { challengePreference?: string }).challengePreference
      : typeof (learner as { feedbackPreference?: string }).feedbackPreference === 'string'
        ? (learner as { feedbackPreference?: string }).feedbackPreference
        : null

  const offLimits =
    typeof (learner as { sessionOffLimits?: string }).sessionOffLimits === 'string'
      ? (learner as { sessionOffLimits?: string }).sessionOffLimits
      : typeof (learner as { notes?: string }).notes === 'string' &&
          /off[- ]?limits?:/i.test((learner as { notes?: string }).notes || '')
        ? ((learner as { notes?: string }).notes || '').replace(/^.*off[- ]?limits?:\s*/i, '').trim()
        : null

  const input = useMemo(
    () => ({
      audience,
      leaderName: getDisplayName(learner),
      leaderRoleTitle:
        typeof (learner as { jobTitle?: string }).jobTitle === 'string'
          ? (learner as { jobTitle?: string }).jobTitle
          : typeof (learner as { title?: string }).title === 'string'
            ? (learner as { title?: string }).title
            : null,
      leaderOrgContext: learner.companyName || learner.companyCode || null,
      personalityType: learner.personalityType,
      coreValues: learner.coreValues,
      journeyType: typeof learner.journeyType === 'string' ? learner.journeyType : null,
      currentWeek: learner.currentWeek ?? null,
      goals,
      offLimits,
      challengePreference,
      pillars,
      chosenPillar: developmentEdge,
      windowStatus,
      sessionNumber,
      sessionTotal:
        audience === 'mentor' ? mentorTotal || null : coachPurchased ?? null,
      purchasedCoachSessions: coachPurchased,
      courseTitles: courseTitles ?? null,
      durationMinutes,
      scheduledLabel,
      originLine:
        audience === 'mentor'
          ? mentorUpcoming
            ? `Next meet-up: ${mentorUpcoming.topic}.`
            : 'They request meet-ups. You accept or propose another time.'
          : coachUpcoming
            ? `Next booked slot: ${coachUpcoming.slotTitle || 'Coaching session'}.`
            : 'Session count comes from what was purchased for this leader.',
    }),
    [
      audience,
      learner,
      goals,
      offLimits,
      challengePreference,
      pillars,
      developmentEdge,
      windowStatus,
      sessionNumber,
      mentorTotal,
      coachPurchased,
      courseTitles,
      durationMinutes,
      scheduledLabel,
      mentorUpcoming,
      coachUpcoming,
    ],
  )

  const loading =
    liftLoading ||
    goalsLoading ||
    (audience === 'mentor' && mentorSessionsLoading) ||
    (audience === 'coach' && coachBookingsLoading)

  if (loading) {
    return (
      <Box>
        <Skeleton height="420px" borderRadius="14px" />
        <Text mt={2} fontSize="sm" color="gray.500">
          Loading session prep…
        </Text>
      </Box>
    )
  }

  return (
    <SessionPrepPanel
      input={input}
      onPrimary={onPrimary}
      onSecondary={onSecondary}
      primaryLoading={primaryLoading}
    />
  )
}

export default LearnerSessionPrep
