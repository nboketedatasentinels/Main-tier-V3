import React, { useMemo } from 'react'
import { Box, Skeleton, Text } from '@chakra-ui/react'
import { SessionPrepPanel } from '@/components/session-prep/SessionPrepPanel'
import { useMentorshipGoals } from '@/hooks/useMentorshipGoals'
import { useSessionPrepLift } from '@/hooks/useSessionPrepLift'
import { getDisplayName } from '@/utils/displayName'
import { mentorMeetupCountForJourney } from '@/services/sessionPrepContent'
import type { SessionPrepAudience } from '@/services/sessionPrepContent'
import type { UserProfile } from '@/types'

interface LearnerSessionPrepProps {
  audience: Extract<SessionPrepAudience, 'mentor' | 'coach'>
  learner: UserProfile
  mentorOrCoachProfile?: UserProfile | null
  sessionNumber?: number
  purchasedCoachSessions?: number
  windowStatus?: 'on_track' | 'warning' | 'alert' | 'recovery' | null
  onPrimary?: () => void
  onSecondary?: () => void
  primaryLoading?: boolean
}

/** Loads goals + LIFT and renders Session Prep for mentor or coach. */
export const LearnerSessionPrep: React.FC<LearnerSessionPrepProps> = ({
  audience,
  learner,
  sessionNumber = 1,
  purchasedCoachSessions,
  windowStatus = 'warning',
  onPrimary,
  onSecondary,
  primaryLoading,
}) => {
  const learnerId = learner.id ?? null
  const { pillars, loading: liftLoading } = useSessionPrepLift(learnerId)
  const { goals, loading: goalsLoading } = useMentorshipGoals(
    learnerId,
    typeof learner.mentorId === 'string' ? learner.mentorId : null,
  )

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
      pillars,
      chosenPillar: null,
      windowStatus,
      sessionNumber,
      sessionTotal:
        audience === 'mentor'
          ? mentorMeetupCountForJourney(
              typeof learner.journeyType === 'string' ? learner.journeyType : null,
            )
          : purchasedCoachSessions ?? 5,
      purchasedCoachSessions: purchasedCoachSessions ?? 5,
      scheduledLabel: 'Next session · 60 minutes',
      originLine:
        audience === 'mentor'
          ? 'They request meet-ups. You accept or propose another time.'
          : 'Session count comes from what was purchased for this leader.',
    }),
    [
      audience,
      learner,
      goals,
      offLimits,
      pillars,
      windowStatus,
      sessionNumber,
      purchasedCoachSessions,
    ],
  )

  if (liftLoading || goalsLoading) {
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
