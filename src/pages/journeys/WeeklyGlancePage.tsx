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
  useToast,
} from '@chakra-ui/react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { FirestoreError } from 'firebase/firestore'

import { WeeklyPointsCard } from '@/components/journeys/weeklyGlance/WeeklyPointsCard'
import { SupportTeamCard } from '@/components/journeys/weeklyGlance/SupportTeamCard'
import { PersonalityProfileCard } from '@/components/journeys/weeklyGlance/PersonalityProfileCard'
import { PeopleImpactedCard } from '@/components/journeys/weeklyGlance/PeopleImpactedCard'
import { WeeklyInspirationCard } from '@/components/journeys/weeklyGlance/WeeklyInspirationCard'
import { ActivityFeedCard } from '@/components/journeys/weeklyGlance/ActivityFeedCard'
import { LearnerWindowCard } from '@/components/journeys/weeklyGlance/LearnerWindowCard'
import { NextMilestoneCard } from '@/components/journeys/weeklyGlance/NextMilestoneCard'
import { WindowSummaryCard } from '@/components/journeys/weeklyGlance/WindowSummaryCard'
import { WeekStatusSummaryCard } from '@/components/journeys/WeekStatusSummaryCard'

import { useWeeklyGlanceData, type LedgerEntry } from '@/hooks/useWeeklyGlanceData'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier, type UserProfile } from '@/types'
import { useWeekAdvancementCriteria } from '@/hooks/useWeekAdvancementCriteria'
import { updateUserVillageId } from '@/services/userProfileService'
import { checkVillageNameExists, createVillage } from '@/services/villageService'
import {
  calculateWeekProgress,
  getDaysRemainingInWeek,
  getWeekDateRange,
} from '@/utils/weekCalculations'

// NOTE: This page is intentionally a partial migration: UI phrasing may be broader,
// while data contracts remain weekly (`weeklyPoints`, `weekNumber`, week-based helpers).

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
    !!profile?.villageId ||
    !!profile?.corporateVillageId ||
    !!profile?.companyId ||
    !!profile?.companyCode ||
    !!profile?.organizationId
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

const WEEKLY_ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function buildWeeklyActivityFeed(params: {
  ledgerEntries: LedgerEntry[]
}): readonly ActivityFeedItem[] {
  const { ledgerEntries } = params
  const cutoffTime = Date.now() - WEEKLY_ACTIVITY_WINDOW_MS

  return ledgerEntries
    .filter((entry) => entry.createdAt.getTime() >= cutoffTime)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((entry) => ({
      id: entry.id,
      title: entry.activityTitle,
      description: `${entry.points} points earned.`,
      timestamp: formatDistanceToNow(entry.createdAt, { addSuffix: true }),
      status: entry.points > 0 ? 'complete' : 'attention',
    }))
}
/**
 * View-model hook: normalizes data + centralizes derived values
 */
function useWeeklyGlanceViewModel() {
  const { profile, refreshProfile } = useAuth()
  const data = useWeeklyGlanceData()

  // Normalize collection shapes so UI never has to guard against undefined
  const weeklyHabits = useMemo(() => data.weeklyHabits ?? [], [data.weeklyHabits])
  const peerMatches = useMemo(() => data.peerMatches ?? [], [data.peerMatches])

  // Weekly variable names are deliberate until backend period support is generalized.
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

  const ledgerEntries = useMemo(() => data.ledgerEntries ?? [], [data.ledgerEntries])
  const activityFeedItems = useMemo(
    () =>
      buildWeeklyActivityFeed({
        ledgerEntries,
      }),
      [ledgerEntries]
    )

  return {
    profile,
    refreshProfile,
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
  const toast = useToast()
  const {
    profile,
    refreshProfile,
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
  const shouldRenderWeekStatusCard = eligibilityLoading || Boolean(eligibilityError) || Boolean(eligibility)

  const [isBuildVillageOpen, setIsBuildVillageOpen] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')
  const [isCreatingVillage, setIsCreatingVillage] = useState(false)
  const [villageError, setVillageError] = useState<string | undefined>()
  const [showMore, setShowMore] = useState(false)
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false

  const resetVillageForm = useCallback(() => {
    setVillageName('')
    setVillagePurpose('')
    setVillageError(undefined)
  }, [])

  const openVillageModal = useCallback(() => {
    setVillageError(undefined)
    setIsBuildVillageOpen(true)
  }, [])

  const closeVillageModal = useCallback(() => {
    if (isCreatingVillage) return
    setIsBuildVillageOpen(false)
    setVillageError(undefined)
  }, [isCreatingVillage])

  const resolveVillageErrorMessage = useCallback((error: unknown): string => {
    if (error && typeof error === 'object' && 'code' in error) {
      const firestoreError = error as FirestoreError
      switch (firestoreError.code) {
        case 'permission-denied':
          return "You don't have permission to create a village. Please contact support."
        case 'unavailable':
        case 'deadline-exceeded':
          return 'Unable to create village. Please check your connection and try again.'
        default:
          return 'Something went wrong. Please try again.'
      }
    }

    if (error instanceof Error) {
      return error.message
    }

    return 'Something went wrong. Please try again.'
  }, [])

  const handleCreateVillage = useCallback(async () => {
    const trimmedName = villageName.trim()
    const trimmedPurpose = villagePurpose.trim()
    const profileId = profile?.id?.trim()

    if (!trimmedName) {
      setVillageError('Please enter a village name.')
      return
    }

    if (!profileId) {
      const message = 'We could not verify your profile. Please refresh and try again.'
      setVillageError(message)
      toast({
        status: 'error',
        title: 'Unable to create village',
        description: message,
      })
      return
    }

    setIsCreatingVillage(true)
    setVillageError(undefined)

    try {
      const nameExists = await checkVillageNameExists(trimmedName)
      if (nameExists) {
        const message = 'A village with this name already exists. Please choose a different name.'
        setVillageError(message)
        toast({
          status: 'error',
          title: 'Village name taken',
          description: message,
        })
        return
      }

      const villageId = await createVillage({
        name: trimmedName,
        description: trimmedPurpose,
        creatorId: profileId,
      })

      await updateUserVillageId(profileId, villageId)
      await refreshProfile({ reason: 'village-created' })

      toast({
        status: 'success',
        title: `Your village "${trimmedName}" has been created!`,
        description: 'You can access your village anytime from the navigation.',
      })

      setIsBuildVillageOpen(false)
      resetVillageForm()
    } catch (error) {
      console.error('Failed to create village', error)
      const message = resolveVillageErrorMessage(error)
      setVillageError(message)
      toast({
        status: 'error',
        title: 'Unable to create village',
        description: message,
      })
    } finally {
      setIsCreatingVillage(false)
    }
  }, [
    profile?.id,
    resetVillageForm,
    resolveVillageErrorMessage,
    toast,
    villageName,
    villagePurpose,
    refreshProfile,
  ])

  const handleNavigateChecklist = useCallback(() => {
    navigate('/app/weekly-checklist')
  }, [navigate])

  const handleViewPendingApprovals = useCallback(() => {
    navigate('/app/weekly-checklist?focus=pending-approvals')
  }, [navigate])

  const handleSeeMoreActivity = useCallback(() => {
    navigate('/app/leadership-board#points-breakdown')
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
          {/* Partial migration strategy: keep user copy general while weekly data contracts remain in place. */}
          <Heading size="lg" color="text.primary">
            Current Progress at a Glance
          </Heading>
          <Text color="text.primary">
            Your personalized dashboard for points accumulated, habits, and support.
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

        <Grid
          templateColumns={{ base: '1fr', md: 'repeat(12, 1fr)' }}
          gap={6}
          alignItems="stretch"
        >
          <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 1, md: 1 }}>
            {isParallelTrackingEnabled ? (
              <WindowSummaryCard onNavigate={handleNavigateChecklist} />
            ) : (
              <LearnerWindowCard
                weekLabel={`Week ${data.weekNumber} • ${weekRange.label}`}
                daysRemaining={daysRemaining}
                progressValue={weekProgress}
                targetPoints={targetPoints}
                earnedPoints={earnedPoints}
                focusAreas={(data.focusAreas ?? []).map((focusArea) => focusArea.title)}
                nextMilestone={`Week ${data.weekNumber + 1} readiness review`}
              />
            )}
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 2, md: 2 }}>
            <WeeklyPointsCard
              data={data.weeklyPoints}
              loading={data.loading.points}
              error={data.errors.points}
              onNavigate={handleNavigateChecklist}
            />
          </GridItem>

          {(!isMobile || showMore) && (
            <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 8, md: 3 }}>
              <PersonalityProfileCard data={data.personality} loading={data.loading.profile} />
            </GridItem>
          )}

          {shouldRenderWeekStatusCard && (
            <GridItem colSpan={{ base: 1, md: 6 }} order={{ base: 3, md: 4 }}>
              <WeekStatusSummaryCard
                eligibility={eligibility}
                loading={eligibilityLoading}
                error={eligibilityError}
                onViewApprovals={handleViewPendingApprovals}
              />
            </GridItem>
          )}

          <GridItem colSpan={{ base: 1, md: 8 }} order={{ base: 5, md: 5 }}>
            <ActivityFeedCard
              items={[...activityFeedItems]}
              onSeeMore={handleSeeMoreActivity}
            />
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 6, md: 6 }}>
            <NextMilestoneCard
              milestone={`Week ${data.weekNumber + 1} readiness review`}
              daysRemaining={daysRemaining}
              onNavigate={handleNavigateChecklist}
            />
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 7, md: 7 }}>
            <SupportTeamCard
              data={data.supportAssignment}
              loading={data.loading.support}
              peerMatches={data.peerMatches ?? []}
              peerMatchesLoading={data.loading.matches}
            />
          </GridItem>

          {(!isMobile || showMore) && (
            <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 9, md: 8 }}>
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
        isLoading={isCreatingVillage}
        error={villageError}
      />
    </Box>
  )
}

