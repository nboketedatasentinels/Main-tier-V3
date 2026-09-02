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
import { useLearnerProgrammeSubmissions } from '@/hooks/useLearnerProgrammeSubmissions'
import type { UserProfile } from '@/types'

interface LearnerSessionPrepProps {
  audience: Extract<SessionPrepAudience, 'mentor' | 'coach'>
  learner: UserProfile
  mentorOrCoachProfile?: UserProfile | null
  sessionNumber?: number
  purchasedCoachSessions?: number
  windowStatus?: 'on_track' | 'warning' | 'alert' | 'recovery' | null
  /** Org programme courses - feed conversation suggestions. */
  courseTitles?: string[] | null
  onPrimary?: () => void
  onSecondary?: () => void
  primaryLoading?: boolean
}

type EnrichedLearnerFields = {
  personalityType: string | null
  coreValues: string[]
  jobTitle: string | null
  companyName: string | null
  journeyType: string | null
  currentWeek: number | null
  journeyStartDate: string | null
  challengePreference: string | null
  sessionOffLimits: string | null
}

const emptyEnrichment: EnrichedLearnerFields = {
  personalityType: null,
  coreValues: [],
  jobTitle: null,
  companyName: null,
  journeyType: null,
  currentWeek: null,
  journeyStartDate: null,
  challengePreference: null,
  sessionOffLimits: null,
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

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && Boolean(v.trim())) : []

/** Loads goals + LIFT + full profile + live session timing for mentor/coach Session Prep. */
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
  const { pillars, developmentEdge, archetype, loading: liftLoading } = useSessionPrepLift(learnerId)
  const { submissions, loading: submissionsLoading } = useLearnerProgrammeSubmissions(learnerId)
  const { goals, loading: goalsLoading } = useMentorshipGoals(
    learnerId,
    typeof learner.mentorId === 'string' ? learner.mentorId : null,
  )
  const { sessions: mentorshipSessions, loading: mentorSessionsLoading } =
    useLearnerMentorshipSessions(audience === 'mentor' ? learnerId : null)

  const [enrichment, setEnrichment] = useState<EnrichedLearnerFields>(emptyEnrichment)
  const [enrichmentLoading, setEnrichmentLoading] = useState(Boolean(learnerId))
  const [coachBookings, setCoachBookings] = useState<CoachBooking[]>([])
  const [coachBookingsLoading, setCoachBookingsLoading] = useState(audience === 'coach')
  const [coachDurationMinutes, setCoachDurationMinutes] = useState<number | null>(null)

  useEffect(() => {
    if (!learnerId) {
      setEnrichment(emptyEnrichment)
      setEnrichmentLoading(false)
      return
    }
    let cancelled = false
    setEnrichmentLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'personality_type, core_values, first_name, last_name, full_name, company_name, company_code, journey_type, current_week, journey_start_date, data',
          )
          .eq('id', learnerId)
          .maybeSingle()
        if (cancelled) return
        if (error || !data) {
          setEnrichment(emptyEnrichment)
          setEnrichmentLoading(false)
          return
        }
        const nested = (data.data as Record<string, unknown> | null) || {}
        setEnrichment({
          personalityType:
            asString(data.personality_type) ?? asString(nested.personalityType) ?? null,
          coreValues:
            asStringArray(data.core_values).length > 0
              ? asStringArray(data.core_values)
              : asStringArray(nested.coreValues),
          jobTitle:
            asString(nested.jobTitle) ??
            asString(nested.title) ??
            asString(nested.roleTitle) ??
            null,
          companyName:
            asString(data.company_name) ??
            asString(data.company_code) ??
            asString(nested.companyName) ??
            null,
          journeyType: asString(data.journey_type) ?? asString(nested.journeyType) ?? null,
          currentWeek:
            typeof data.current_week === 'number'
              ? data.current_week
              : typeof nested.currentWeek === 'number'
                ? nested.currentWeek
                : null,
          journeyStartDate:
            asString(data.journey_start_date) ?? asString(nested.journeyStartDate) ?? null,
          challengePreference:
            asString(nested.challengePreference) ??
            asString(nested.feedbackPreference) ??
            null,
          sessionOffLimits:
            asString(nested.sessionOffLimits) ??
            asString(nested.offLimits) ??
            null,
        })
      } catch {
        if (!cancelled) setEnrichment(emptyEnrichment)
      } finally {
        if (!cancelled) setEnrichmentLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [learnerId])

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
    return (
      mentorshipSessions
        .filter((s) => s.status === 'scheduled')
        .map((s) => ({
          when: s.scheduledAt ?? s.proposedAt,
          topic: s.topic,
        }))
        .filter(
          (s): s is { when: Date; topic: string } =>
            Boolean(s.when && s.when.getTime() >= now - 60_000),
        )
        .sort((a, b) => a.when.getTime() - b.when.getTime())[0] ?? null
    )
  }, [mentorshipSessions])

  const coachGrouped = useMemo(() => groupBookingsByStatus(coachBookings), [coachBookings])
  const coachUpcoming = useMemo(() => {
    const now = Date.now()
    return (
      coachGrouped.booked
        .filter((b) => (b.slotScheduledAt?.getTime() ?? 0) >= now - 60_000)
        .sort(
          (a, b) =>
            (a.slotScheduledAt?.getTime() ?? 0) - (b.slotScheduledAt?.getTime() ?? 0),
        )[0] ?? null
    )
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

  const journeyType =
    enrichment.journeyType ||
    (typeof learner.journeyType === 'string' ? learner.journeyType : null)
  const mentorTotal = mentorMeetupCountForJourney(journeyType)
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
  const upcomingSessionTopic =
    audience === 'coach'
      ? coachUpcoming?.slotTitle ?? null
      : mentorUpcoming?.topic ?? null

  const personalityType =
    enrichment.personalityType ||
    (typeof learner.personalityType === 'string' ? learner.personalityType : null)
  const coreValues =
    enrichment.coreValues.length > 0
      ? enrichment.coreValues
      : Array.isArray(learner.coreValues)
        ? learner.coreValues.filter((v): v is string => typeof v === 'string')
        : []

  const input = useMemo(
    () => ({
      audience,
      leaderName: getDisplayName(learner),
      leaderRoleTitle: enrichment.jobTitle,
      leaderOrgContext:
        enrichment.companyName || learner.companyName || learner.companyCode || null,
      personalityType,
      coreValues,
      journeyType,
      journeyStartDate: enrichment.journeyStartDate,
      currentWeek: enrichment.currentWeek ?? learner.currentWeek ?? null,
      goals,
      offLimits: enrichment.sessionOffLimits,
      challengePreference: enrichment.challengePreference,
      pillars,
      chosenPillar: developmentEdge,
      archetype,
      totalPoints: typeof learner.totalPoints === 'number' ? learner.totalPoints : null,
      windowStatus,
      sessionNumber,
      sessionTotal: audience === 'mentor' ? mentorTotal || null : coachPurchased ?? null,
      purchasedCoachSessions: coachPurchased,
      courseTitles: courseTitles ?? null,
      programmeSubmissions: submissions,
      durationMinutes,
      scheduledLabel,
      upcomingSessionTopic,
      originLine:
        audience === 'mentor'
          ? mentorUpcoming
            ? `Next meet-up: ${mentorUpcoming.topic}.`
            : 'No upcoming meet-up on the calendar yet. They request; you accept or propose.'
          : coachUpcoming
            ? `Next booked slot: ${coachUpcoming.slotTitle || 'Coaching session'}.`
            : coachPurchased
              ? `${coachPurchased} coaching session${coachPurchased === 1 ? '' : 's'} purchased for this leader.`
              : 'Purchased session count is not set yet.',
    }),
    [
      audience,
      learner,
      enrichment,
      personalityType,
      coreValues,
      journeyType,
      goals,
      pillars,
      developmentEdge,
      archetype,
      windowStatus,
      sessionNumber,
      mentorTotal,
      coachPurchased,
      courseTitles,
      submissions,
      durationMinutes,
      scheduledLabel,
      upcomingSessionTopic,
      mentorUpcoming,
      coachUpcoming,
    ],
  )

  const loading =
    liftLoading ||
    goalsLoading ||
    enrichmentLoading ||
    submissionsLoading ||
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
