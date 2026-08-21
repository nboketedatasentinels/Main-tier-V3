import React, { useCallback, useEffect, useState } from 'react'
import { Alert, AlertIcon, Box, Heading, Spinner, Stack, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { MentorDashboardLayout } from '@/layouts/MentorDashboardLayout'
import { SessionPointsPanel } from '@/components/session-points/SessionPointsPanel'
import { useAuth } from '@/hooks/useAuth'
import { fetchAssignedMenteesForMentor } from '@/services/learnerAssignmentService'
import { resolveMentorNavDestination } from '@/utils/mentorNavigation'
import type { UserProfile } from '@/types'

export const MentorSessionPointsPage: React.FC = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [learners, setLearners] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onNavigate = useCallback(
    (key: string) => {
      const dest = resolveMentorNavDestination(key)
      if (dest.kind === 'route') {
        navigate(dest.path)
        return
      }
      navigate('/mentor/dashboard', { state: { mentorSection: dest.section } })
    },
    [navigate],
  )

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchAssignedMenteesForMentor(profile.id)
      .then((rows) => {
        if (!cancelled) setLearners(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load mentees')
          setLearners([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile?.id])

  return (
    <MentorDashboardLayout
      activeItem="session-points"
      mentorName={`${profile?.firstName || 'Mentor'} ${profile?.lastName || ''}`.trim()}
      avatarUrl={profile?.avatarUrl || profile?.photoURL}
      onNavigate={onNavigate}
    >
      <Stack spacing={5}>
        <Box>
          <Heading size="md">Assign session points</Heading>
          <Text mt={1} fontSize="sm" color="text.secondary">
            Confirm mentor meet-ups and award +2,000 points within each learner&apos;s journey
            limit (3 on 3M, 6 on 6M, 9 on 9M).
          </Text>
        </Box>

        {error ? (
          <Alert status="error" rounded="lg">
            <AlertIcon />
            {error}
          </Alert>
        ) : null}

        {loading || !profile?.id ? (
          <Spinner />
        ) : (
          <SessionPointsPanel role="mentor" actorId={profile.id} learners={learners} />
        )}
      </Stack>
    </MentorDashboardLayout>
  )
}
