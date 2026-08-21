import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, AlertIcon, Box, Heading, Spinner, Stack, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { AmbassadorLayout } from '@/layouts/AmbassadorLayout'
import { SessionPointsPanel } from '@/components/session-points/SessionPointsPanel'
import { useAuth } from '@/hooks/useAuth'
import { fetchAssignedCoachees } from '@/services/learnerAssignmentService'
import { getOrganizationProgram } from '@/services/supabaseOrgService'
import { resolveCoachNavDestination } from '@/utils/coachNavigation'
import type { UserProfile } from '@/types'

export const CoachSessionPointsPage: React.FC = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [learners, setLearners] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgPurchasedCoachSessions, setOrgPurchasedCoachSessions] = useState<number | null>(null)

  const onNavigate = useCallback(
    (key: string) => {
      const dest = resolveCoachNavDestination(key)
      if (dest.kind === 'route') {
        navigate(dest.path)
        return
      }
      navigate('/coach/dashboard', { state: { coachSection: dest.section } })
    },
    [navigate],
  )

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchAssignedCoachees(profile.id)
      .then((rows) => {
        if (!cancelled) setLearners(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load coachees')
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

  const orgId = useMemo(
    () =>
      learners[0]?.organizationId ||
      learners[0]?.companyId ||
      profile?.organizationId ||
      profile?.companyId ||
      null,
    [learners, profile?.organizationId, profile?.companyId],
  )

  useEffect(() => {
    if (!orgId) {
      setOrgPurchasedCoachSessions(null)
      return
    }
    let cancelled = false
    void getOrganizationProgram(orgId)
      .then((data) => {
        if (cancelled) return
        setOrgPurchasedCoachSessions(
          data?.purchasedCoachSessions != null && Number.isFinite(Number(data.purchasedCoachSessions))
            ? Number(data.purchasedCoachSessions)
            : null,
        )
      })
      .catch(() => {
        if (!cancelled) setOrgPurchasedCoachSessions(null)
      })
    return () => {
      cancelled = true
    }
  }, [orgId])

  return (
    <AmbassadorLayout
      activeItem="session-points"
      ambassadorName={`${profile?.firstName || 'Coach'} ${profile?.lastName || ''}`.trim()}
      avatarUrl={profile?.avatarUrl || profile?.photoURL}
      onNavigate={onNavigate}
      subtitle="Session points"
    >
      <Stack spacing={5}>
        <Box>
          <Heading size="md">Assign session points</Heading>
          <Text mt={1} fontSize="sm" color="text.secondary">
            Confirm coach session attendance and award +2,000 points. Caps follow the learner&apos;s
            journey and purchased coaching sessions.
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
          <SessionPointsPanel
            role="coach"
            actorId={profile.id}
            learners={learners}
            orgPurchasedCoachSessions={orgPurchasedCoachSessions}
          />
        )}
      </Stack>
    </AmbassadorLayout>
  )
}
