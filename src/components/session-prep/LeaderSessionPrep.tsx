import React, { useMemo } from 'react'
import { Box, Skeleton } from '@chakra-ui/react'
import { SessionPrepPanel } from '@/components/session-prep/SessionPrepPanel'
import { useSessionPrepLift } from '@/hooks/useSessionPrepLift'
import { getDisplayName } from '@/utils/displayName'
import { mentorMeetupCountForJourney } from '@/services/sessionPrepContent'
import type { UserProfile } from '@/types'

interface LeaderSessionPrepProps {
  learner: UserProfile
  mentor: UserProfile | null
  goals?: string | null
  offLimits?: string | null
  sessionNumber?: number
}

/** Learner-facing Session Prep before meeting their mentor. */
export const LeaderSessionPrep: React.FC<LeaderSessionPrepProps> = ({
  learner,
  mentor,
  goals,
  offLimits,
  sessionNumber = 1,
}) => {
  const { pillars, archetype, loading } = useSessionPrepLift(learner.id ?? null)
  const input = useMemo(
    () => ({
      audience: 'leader' as const,
      leaderName: getDisplayName(learner),
      mentorName: mentor ? getDisplayName(mentor) : 'Your mentor',
      mentorBio: mentor
        ? [
            (mentor as { jobTitle?: string }).jobTitle,
            mentor.companyName || mentor.companyCode,
          ]
            .filter(Boolean)
            .join(' · ') || 'Assigned mentor on your organisation programme'
        : 'Assigned mentor on your organisation programme',
      personalityType: learner.personalityType,
      coreValues: learner.coreValues,
      journeyType: typeof learner.journeyType === 'string' ? learner.journeyType : null,
      currentWeek: learner.currentWeek ?? null,
      goals: goals ?? null,
      offLimits: offLimits ?? null,
      pillars,
      archetype,
      totalPoints:
        typeof learner.totalPoints === 'number' ? learner.totalPoints : undefined,
      sessionNumber,
      sessionTotal: mentorMeetupCountForJourney(
        typeof learner.journeyType === 'string' ? learner.journeyType : null,
      ),
      scheduledLabel: 'Upcoming meet-up · 60 minutes',
      originLine: mentor
        ? `You requested this. ${getDisplayName(mentor).split(' ')[0]} will meet you when the time is confirmed.`
        : 'Request a meet-up from your mentor card when you are ready.',
    }),
    [learner, mentor, goals, offLimits, pillars, archetype, sessionNumber],
  )

  if (loading) return <Skeleton height="360px" borderRadius="14px" />

  return (
    <Box>
      <SessionPrepPanel input={input} />
    </Box>
  )
}

export default LeaderSessionPrep
