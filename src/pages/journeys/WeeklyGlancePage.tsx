import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Card,
  CardBody,
  Grid,
  GridItem,
  Heading,
  Stack,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'

import { WeeklyPointsCard } from '@/components/journeys/weeklyGlance/WeeklyPointsCard'
import { SupportTeamCard } from '@/components/journeys/weeklyGlance/SupportTeamCard'
import { PersonalityProfileCard } from '@/components/journeys/weeklyGlance/PersonalityProfileCard'
import { PeopleImpactedCard } from '@/components/journeys/weeklyGlance/PeopleImpactedCard'
import { WeeklyInspirationCard } from '@/components/journeys/weeklyGlance/WeeklyInspirationCard'
import { ActivityFeedCard } from '@/components/journeys/weeklyGlance/ActivityFeedCard'
import { LearnerWindowCard } from '@/components/journeys/weeklyGlance/LearnerWindowCard'
import { NextMilestoneCard } from '@/components/journeys/weeklyGlance/NextMilestoneCard'
import { WindowSummaryCard } from '@/components/journeys/weeklyGlance/WindowSummaryCard'
import { WeekAdvancementInfoBanner } from '@/components/journeys/WeekAdvancementInfoBanner'
import { WeekStatusSummaryCard } from '@/components/journeys/WeekStatusSummaryCard'
import { WindowWeekRelationshipCard } from '@/components/journeys/WindowWeekRelationshipCard'
import { PendingApprovalsSection } from '@/components/journeys/PendingApprovalsSection'

import { useWeeklyGlanceData, type LedgerEntry } from '@/hooks/useWeeklyGlanceData'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier, type UserProfile } from '@/types'
import { useWeekAdvancementCriteria } from '@/hooks/useWeekAdvancementCriteria'
import { getWindowRange, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'
import {
  calculateWeekProgress,
  getDaysRemainingInWeek,
  getWeekDateRange,
} from '@/utils/weekCalculations'

/**
 * Domain helpers (keeps business rules out of JSX as much as possible)
 */
function isCorporateUser(profile: UserProfile | null | undefined) {
  const tier = profile?.transformationTier
  return (
    tier === TransformationTier.CORPORATE_MEMBER ||
    tier === TransformationTier.CORPORATE_LEADER
  )
}

function isPaidUser(profile: UserProfile | null | undefined) {
  return profile?.membershipStatus === 'paid'
}

function canCreateVillage(profile: UserProfile | null | undefined) {
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
  ledgerEntries: LedgerEntry[]
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
    ledgerEntries,
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

  const activityEntries: ActivityFeedItem[] = ledgerEntries.map(entry => ({
    id: entry.id,
    title: entry.activityTitle,
    description: `${entry.points} points earned towards your goal.`,
    timestamp: formatDistanceToNow(entry.createdAt, { addSuffix: true }),
    status: 'complete',
  }))

  const statusItems: ActivityFeedItem[] = [
    {
      id: 'weekly-points',
      title: 'Weekly points summary',
      description: `${earnedPoints} points logged toward your ${targetPoints || 0} point goal.`,
      timestamp: `Week ${weekNumber} • ${daysRemaining} days left`,
      status: pointsStatus,
    },
    {
      id: 'weekly-habits',
      title: 'Habits check-in',
      description: `${completedHabits} of ${totalHabits} habits completed this week.`,
      timestamp: 'Updated this week',
      status: habitsStatus,
    },
    {
      id: 'mentor-assignment',
      title: hasMentor ? 'Mentor confirmed' : 'Mentor assignment pending',
      description: hasMentor
        ? `Your mentor ${mentorFirstName || 'coach'} is ready for your next check-in.`
        : 'We are confirming your mentor assignment. Expect an update soon.',
      timestamp: 'Support team update',
      status: mentorStatus,
    },
    {
      id: 'peer-matching',
      title: peerMatchCount > 0 ? 'Peer match ready' : 'Peer matching in progress',
      description:
        peerMatchCount > 0
          ? 'Review your latest peer connection in Peer Connect.'
          : 'We are still pairing you with a peer ally.',
      timestamp: peerMatchCount > 0 ? 'New match available' : 'Matching in progress',
      status: peerStatus,
    },
  ]

  return [...activityEntries, ...statusItems]
}

/**
 * View-model hook: normalizes data + centralizes derived values
 */
function useWeeklyGlanceViewModel() {
  const { profile } = useAuth()
  const data = useWeeklyGlanceData()

  // Normalize collection shapes so UI never has to guard against undefined
  const weeklyHabits = useMemo(() => data.weeklyHabits ?? [], [data.weeklyHabits])
  const peerMatches = useMemo(() => data.peerMatches ?? [], [data.peerMatches])

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
  const ledgerEntries = useMemo(() => data.ledgerEntries ?? [], [data.ledgerEntries])
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
        ledgerEntries,
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
      ledgerEntries,
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
    profile,
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

  // Week advancement eligibility tracking
  const { eligibility, loading: eligibilityLoading, error: eligibilityError } = useWeekAdvancementCriteria(profile)

  const [isBuildVillageOpen, setIsBuildVillageOpen] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')
  const [showMore, setShowMore] = useState(false)
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false

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

  // Calculate window range for WindowWeekRelationshipCard
  const windowMeta = profile && profile.currentWeek
    ? getWindowRange(profile.currentWeek, profile.programDurationWeeks, PARALLEL_WINDOW_SIZE_WEEKS)
    : { windowNumber: 1, startWeek: 1, endWeek: 2, windowWeeks: 2 }

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
                  <Heading size="md" color="text.primary">
                    Build Your Village
                  </Heading>
                  <Text color="text.primary">
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
          <Heading size="lg" color="text.primary">
            This Week at a Glance
          </Heading>
          <Text color="text.primary">
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

        {profile && (
          <WeekAdvancementInfoBanner
            currentWeek={profile.currentWeek ?? data.weekNumber}
            journeyType={profile.journeyType}
            variant="compact"
          />
        )}

        <WeeklyInspirationCard data={data.inspirationQuote} loading={data.loading.inspiration} />

        <Grid
          templateColumns={{ base: '1fr', md: 'repeat(12, 1fr)' }}
          gap={6}
          alignItems="stretch"
        >
          <GridItem colSpan={{ base: 1, md: 6 }} order={{ base: 1, md: 1 }}>
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
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 6 }} order={{ base: 2, md: 2 }}>
            <WeeklyPointsCard
              data={data.weeklyPoints}
              loading={data.loading.points}
              error={data.errors.points}
              onNavigate={handleNavigateChecklist}
            />
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 6 }} order={{ base: 3, md: 3 }}>
            <WeekStatusSummaryCard
              eligibility={eligibility}
              loading={eligibilityLoading}
              error={eligibilityError}
            />
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 6 }} order={{ base: 4, md: 4 }}>
            {profile && (
              <WindowWeekRelationshipCard
                currentWeek={profile.currentWeek ?? data.weekNumber}
                windowNumber={windowMeta.windowNumber}
                windowStartWeek={windowMeta.startWeek}
                windowEndWeek={windowMeta.endWeek}
                journeyType={profile.journeyType}
                totalWeeks={profile.programDurationWeeks}
              />
            )}
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 8 }} order={{ base: 5, md: 5 }}>
            <ActivityFeedCard items={[...activityFeedItems]} />
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 6, md: 6 }}>
            <NextMilestoneCard
              milestone={`Week ${data.weekNumber + 1} readiness review`}
              daysRemaining={daysRemaining}
              onNavigate={handleNavigateChecklist}
            />
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 7, md: 7 }}>
            <PendingApprovalsSection
              pendingRequests={eligibility?.pendingApprovals ?? []}
              currentWeek={profile?.currentWeek}
              loading={eligibilityLoading}
            />
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 8, md: 8 }}>
            <SupportTeamCard
              data={data.supportAssignment}
              loading={data.loading.support}
              peerMatches={data.peerMatches ?? []}
              peerMatchesLoading={data.loading.matches}
            />
          </GridItem>

          {(!isMobile || showMore) && (
            <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 9, md: 9 }}>
              <PersonalityProfileCard data={data.personality} loading={data.loading.profile} />
            </GridItem>
          )}

          {(!isMobile || showMore) && (
            <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 10, md: 10 }}>
              <PeopleImpactedCard count={data.impactCount} loading={data.loading.impact} />
            </GridItem>
          )}
        </Grid>

        {isMobile && (
          <Button variant="outline" onClick={() => setShowMore(prev => !prev)} alignSelf="flex-start">
            {showMore ? 'Show less' : 'View more'}
          </Button>
        )}
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
