import React, { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Box, Skeleton } from '@chakra-ui/react'
import { SessionPrepPanel } from '@/components/session-prep/SessionPrepPanel'
import { useSessionPrepLift } from '@/hooks/useSessionPrepLift'
import { useMentorshipGoals } from '@/hooks/useMentorshipGoals'
import { useLearnerProgrammeSubmissions } from '@/hooks/useLearnerProgrammeSubmissions'
import { getDisplayName } from '@/utils/displayName'
import { mentorMeetupCountForJourney } from '@/services/sessionPrepContent'
import type { UserProfile } from '@/types'

interface LeaderSessionPrepProps {
  learner: UserProfile
  mentor: UserProfile | null
  goals?: string | null
  goalEditor?: ReactNode
  offLimits?: string | null
  sessionNumber?: number
}

/** Learner-facing Session Prep before meeting their mentor. */
export const LeaderSessionPrep: React.FC<LeaderSessionPrepProps> = ({
  learner,
  mentor,
  goals: goalsProp,
  goalEditor,
  offLimits,
  sessionNumber = 1,
}) => {
  const { pillars, archetype, assessedAt, loading: liftLoading } = useSessionPrepLift(learner.id ?? null)
  const { goals: loadedGoals, loading: goalsLoading } = useMentorshipGoals(
    learner.id ?? null,
    mentor?.id ?? null,
  )
  const { submissions, loading: submissionsLoading } = useLearnerProgrammeSubmissions(learner.id ?? null)
  const goals = (goalsProp && goalsProp.trim()) || loadedGoals || null
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
      goals,
      offLimits: offLimits ?? null,
      pillars,
      archetype,
      liftAssessedAt: assessedAt,
      totalPoints:
        typeof learner.totalPoints === 'number' ? learner.totalPoints : undefined,
      programmeSubmissions: submissions,
      sessionNumber,
      sessionTotal: mentorMeetupCountForJourney(
        typeof learner.journeyType === 'string' ? learner.journeyType : null,
      ),
      scheduledLabel: 'Upcoming meet-up · 60 minutes',
      originLine: mentor
        ? `You requested this. ${getDisplayName(mentor).split(' ')[0]} will meet you when the time is confirmed.`
        : 'Request a meet-up from your mentor card when you are ready.',
    }),
    [learner, mentor, goals, offLimits, pillars, archetype, assessedAt, submissions, sessionNumber],
  )

  if (liftLoading || submissionsLoading || goalsLoading) {
    return <Skeleton height="360px" borderRadius="14px" />
  }

  return (
    <Box>
      <SessionPrepPanel input={input} leaderGoalEditor={goalEditor} />
    </Box>
  )
}

export default LeaderSessionPrep
