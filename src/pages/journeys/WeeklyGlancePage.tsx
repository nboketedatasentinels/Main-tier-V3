import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { WeeklyPointsCard } from '@/components/journeys/weeklyGlance/WeeklyPointsCard'
import { SupportTeamCard } from '@/components/journeys/weeklyGlance/SupportTeamCard'
import { PersonalityProfileCard } from '@/components/journeys/weeklyGlance/PersonalityProfileCard'
import { PeopleImpactedCard } from '@/components/journeys/weeklyGlance/PeopleImpactedCard'
import { PeerMatchingCard } from '@/components/journeys/weeklyGlance/PeerMatchingCard'
import { WeeklyInspirationCard } from '@/components/journeys/weeklyGlance/WeeklyInspirationCard'
import { ActivityFeedCard } from '@/components/journeys/weeklyGlance/ActivityFeedCard'
import { LearnerWindowCard } from '@/components/journeys/weeklyGlance/LearnerWindowCard'
import { WindowSummaryCard } from '@/components/journeys/weeklyGlance/WindowSummaryCard'

import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier } from '@/types'
import {
  calculateWeekProgress,
  getDaysRemainingInWeek,
  getWeekDateRange,
} from '@/utils/weekCalculations'

/**
 * Domain helpers (keeps business rules out of JSX as much as possible)
 */
function isCorporateUser(profile: any) {
  const tier = profile?.transformationTier
  return (
    tier === TransformationTier.CORPORATE_MEMBER ||
    tier === TransformationTier.CORPORATE_LEADER
  )
}

function isPaidUser(profile: any) {
  return profile?.membershipStatus === 'paid'
}

function canCreateVillage(profile: any) {
  // If they already belong to ANY village/company context, or are paid/corporate, do not show CTA
  const hasVillageContext =
    !!profile?.villageId || !!profile?.companyId || !!profile?.corporateVillageId
  if (hasVillageContext) return false
  if (isPaidUser(profile)) return false
  if (isCorporateUser(profile)) return false
  return true
}

/**
 * Activity feed builder (extensible + testable)
 */
type ActivityFeedStatus = 'complete' | 'pending' | 'attention'
type ActivityFeedItem = {
  id: string
  title: string
  description: string
  timestamp: string
  status: ActivityFeedStatus
}

function buildWeeklyActivityFeed(params: {
  earnedPoints: number
  targetPoints: number
  weekNumber: number
  daysRemaining: number
  completedHabits: number
  totalHabits: number
  mentorFirstName?: string | null
  hasMentor: boolean
  peerMatchCount: number
}): readonly ActivityFeedItem[] {
  const {
    earnedPoints,
    targetPoints,
    weekNumber,
    daysRemaining,
    completedHabits,
    totalHabits,
    mentorFirstName,
    hasMentor,
    peerMatchCount,
  } = params

  const pointsStatus: ActivityFeedStatus =
    targetPoints > 0 && earnedPoints >= targetPoints
      ? 'complete'
      : earnedPoints > 0
        ? 'pending'
        : 'attention'

  const habitsStatus: ActivityFeedStatus =
    totalHabits > 0 && completedHabits === totalHabits ? 'complete' : 'pending'

  const mentorStatus: ActivityFeedStatus = hasMentor ? 'complete' : 'pending'

  const peerStatus: ActivityFeedStatus = peerMatchCount > 0 ? 'complete' : 'pending'

  return [
    {
      id: 'weekly-points',
      title: 'Weekly points updated',
      description: `${earnedPoints} points logged toward your ${targetPoints || 0} point goal.`,
      timestamp: `Week ${weekNumber} • ${daysRemaining} days left`,
      status: pointsStatus,
    },
    {
      id: 'weekly-habits',
      title: 'Habits check-in',
      description: `${completedHabits} of ${totalHabits} habits completed this week.`,
      timestamp: 'Habit tracker',
      status: habitsStatus,
    },
    {
      id: 'mentor-assignment',
      title: hasMentor ? 'Mentor confirmed' : 'Mentor assignment pending',
      description: hasMentor
        ? `Your mentor ${mentorFirstName || 'coach'} is ready for your next check-in.`
        : 'We are confirming your mentor assignment. Expect an update soon.',
      timestamp: 'Leadership Council',
      status: mentorStatus,
    },
    {
      id: 'peer-matching',
      title: peerMatchCount > 0 ? 'Peer match ready' : 'Peer matching in progress',
      description:
        peerMatchCount > 0
          ? 'Review your latest peer connection in Peer Connect.'
          : 'We are still pairing you with a peer ally.',
      timestamp: peerMatchCount > 0 ? 'New match' : 'Matching queue',
      status: peerStatus,
    },
  ] as const
}

/**
 * View-model hook: normalizes data + centralizes derived values
 */
function useWeeklyGlanceViewModel() {
  const { profile } = useAuth()
  const data = useWeeklyGlanceData()

  // Normalize collection shapes so UI never has to guard against undefined
  const weeklyHabits = data.weeklyHabits ?? []
  const peerMatches = data.peerMatches ?? []

  const weekRange = useMemo(() => getWeekDateRange(), [])
  const daysRemaining = useMemo(() => getDaysRemainingInWeek(), [])

  const earnedPoints = data.weeklyPoints?.points_earned ?? 0
  const targetPoints = data.weeklyPoints?.target_points ?? 0

  const weekProgress = useMemo(
    () => calculateWeekProgress(earnedPoints, targetPoints),
    [earnedPoints, targetPoints]
  )

  const completedHabits = useMemo(
    () => weeklyHabits.filter(h => h.completed).length,
    [weeklyHabits]
  )

  const shouldShowBuildVillageCard = useMemo(
    () => canCreateVillage(profile),
    [profile]
  )

  const hasError = useMemo(
    () => Object.values(data.errors ?? {}).some(Boolean),
    [data.errors]
  )

  const isParallelTrackingEnabled = import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true'

  if (isParallelTrackingEnabled) {
    console.log('[WeeklyGlance] Parallel window tracking enabled')
  }

  const mentorProfile = data.supportAssignment?.mentorProfile
  const activityFeedItems = useMemo(
    () =>
      buildWeeklyActivityFeed({
        earnedPoints,
        targetPoints,
        weekNumber: data.weekNumber,
        daysRemaining,
        completedHabits,
        totalHabits: weeklyHabits.length,
        hasMentor: !!mentorProfile,
        mentorFirstName: mentorProfile?.firstName ?? null,
        peerMatchCount: peerMatches.length,
      }),
    [
      earnedPoints,
      targetPoints,
      data.weekNumber,
      daysRemaining,
      completedHabits,
      weeklyHabits.length,
      mentorProfile,
      peerMatches.length,
    ]
  )

  return {
    profile,
    data,
    weeklyHabits,
    peerMatches,

    weekRange,
    daysRemaining,
    earnedPoints,
    targetPoints,
    weekProgress,
    completedHabits,

    shouldShowBuildVillageCard,
    hasError,
    activityFeedItems,
    isParallelTrackingEnabled,
  }
}

export const WeeklyGlancePage = () => {
  const navigate = useNavigate()
  const {
    data,
    weekRange,
    daysRemaining,
    earnedPoints,
    targetPoints,
    weekProgress,
    shouldShowBuildVillageCard,
    hasError,
    activityFeedItems,
    isParallelTrackingEnabled,
  } = useWeeklyGlanceViewModel()

  const [isBuildVillageOpen, setIsBuildVillageOpen] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')

  const openVillageModal = useCallback(() => setIsBuildVillageOpen(true), [])
  const closeVillageModal = useCallback(() => setIsBuildVillageOpen(false), [])

  /**
   * NOTE: This is still “optimistic UI”.
   * If/when you wire actual creation, make this async and handle error/loading.
   */
  const handleCreateVillage = useCallback(() => {
    setIsBuildVillageOpen(false)
    setVillageName('')
    setVillagePurpose('')
  }, [])

  const handleNavigateChecklist = useCallback(() => {
    navigate('/app/weekly-checklist')
  }, [navigate])

  return (
    <Box p={{ base: 4, md: 6 }}>
      <Stack spacing={6}>
        {shouldShowBuildVillageCard && (
          <Card bg="brand.primaryMuted" border="1px" borderColor="brand.border">
            <CardBody>
              <Stack
                direction={{ base: 'column', md: 'row' }}
                spacing={4}
                align="flex-start"
                justify="space-between"
              >
                <Stack spacing={1}>
                  <Heading size="md" color="#273240">
                    Build Your Village
                  </Heading>
                  <Text color="#273240">
                    Rally your peers by creating a village to collaborate and track your collective impact.
                  </Text>
                </Stack>
                <Button
                  colorScheme="yellow"
                  onClick={openVillageModal}
                  alignSelf={{ base: 'flex-start', md: 'center' }}
                >
                  Open Build Village
                </Button>
              </Stack>
            </CardBody>
          </Card>
        )}

        <Stack spacing={1}>
          <Heading size="lg" color="#273240">
            This Week at a Glance
          </Heading>
          <Text color="#273240">
            Your personalized dashboard for weekly progress, habits, and support.
          </Text>
        </Stack>

        {hasError && (
          <Alert status="warning" rounded="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Some sections failed to load</AlertTitle>
              <AlertDescription>Data may be incomplete. Try refreshing the page.</AlertDescription>
            </Box>
          </Alert>
        )}

        <WeeklyInspirationCard data={data.inspirationQuote} loading={data.loading.inspiration} />

        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4} alignItems="stretch">
          {isParallelTrackingEnabled ? (
            <WindowSummaryCard />
          ) : (
            <LearnerWindowCard
              weekLabel={`Week ${data.weekNumber} • ${weekRange.label}`}
              daysRemaining={daysRemaining}
              progressValue={weekProgress}
              targetPoints={targetPoints}
              earnedPoints={earnedPoints}
              focusAreas={['Leadership reflection', 'Mentor session', 'Impact action']}
              nextMilestone={`Week ${data.weekNumber + 1} readiness review`}
            />
          )}

          <WeeklyPointsCard
            data={data.weeklyPoints}
            loading={data.loading.points}
            error={data.errors.points}
            onNavigate={handleNavigateChecklist}
          />

          <ActivityFeedCard items={[...activityFeedItems]} />

          <SupportTeamCard data={data.supportAssignment} loading={data.loading.support} />

          <PersonalityProfileCard data={data.personality} loading={data.loading.profile} />

          <PeopleImpactedCard count={data.impactCount} loading={data.loading.impact} />

          <PeerMatchingCard matches={data.peerMatches ?? []} loading={data.loading.matches} />
        </SimpleGrid>
      </Stack>

      <BuildVillageModal
        isOpen={isBuildVillageOpen}
        onCreate={handleCreateVillage}
        onSkip={closeVillageModal}
        villageName={villageName}
        villagePurpose={villagePurpose}
        onVillageNameChange={setVillageName}
        onVillagePurposeChange={setVillagePurpose}
      />
    </Box>
  )
}
