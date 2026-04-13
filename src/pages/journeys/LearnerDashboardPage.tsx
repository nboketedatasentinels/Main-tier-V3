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
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
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
import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { updateUserVillageId } from '@/services/userProfileService'
import { checkVillageNameExists, createVillage } from '@/services/villageService'
import { TransformationTier } from '@/types'
import { calculateWeekProgress, getJourneyTiming } from '@/utils/weekCalculations'

export const LearnerDashboardPage = () => {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const data = useWeeklyGlanceData()
  const [isBuildVillageOpen, setIsBuildVillageOpen] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')
  const [isCreatingVillage, setIsCreatingVillage] = useState(false)
  const [villageError, setVillageError] = useState<string | undefined>()
  const [showMore, setShowMore] = useState(false)
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false
  const isPaidMember = profile?.membershipStatus === 'paid'
  const isCorporateTier =
    profile?.transformationTier === TransformationTier.CORPORATE_MEMBER ||
    profile?.transformationTier === TransformationTier.CORPORATE_LEADER
  const shouldShowBuildVillageCard =
    !profile?.villageId &&
    !profile?.companyId &&
    !profile?.companyCode &&
    !profile?.organizationId &&
    !profile?.corporateVillageId &&
    !isPaidMember &&
    !isCorporateTier

  const hasError = Object.values(data.errors).some(Boolean)
  const isParallelTrackingEnabled = import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true'

  if (isParallelTrackingEnabled) {
    console.log('[Dashboard] Parallel window tracking enabled')
  }

  const resetVillageForm = () => {
    setVillageName('')
    setVillagePurpose('')
    setVillageError(undefined)
  }

  const handleOpenVillageModal = () => {
    setVillageError(undefined)
    setIsBuildVillageOpen(true)
  }

  const handleCloseVillageModal = () => {
    if (isCreatingVillage) return
    setIsBuildVillageOpen(false)
    setVillageError(undefined)
  }

  const resolveVillageErrorMessage = (error: unknown): string => {
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
  }

  const handleCreateVillage = async () => {
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
  }

  // Dynamic journey timing - consistent with JourneyHeader calculation
  const journeyTiming = getJourneyTiming(profile?.journeyStartDate, profile?.programDurationWeeks ?? 6)
  const weekRange = journeyTiming ? { start: journeyTiming.weekStart, end: journeyTiming.weekEnd, label: journeyTiming.weekLabel } : { start: new Date(), end: new Date(), label: '' }
  const daysRemaining = journeyTiming?.daysRemaining ?? 0
  const currentWeek = journeyTiming?.currentWeek ?? data.weekNumber
  const earnedPoints = data.weeklyPoints?.points_earned || 0
  const targetPoints = data.weeklyPoints?.target_points || 0
  const weekProgress = calculateWeekProgress(earnedPoints, targetPoints)
  const completedHabits = data.weeklyHabits.filter(habit => habit.completed).length
  const activityFeedItems = [
    {
      id: 'weekly-points',
      title: 'Points progress update',
      description: `${earnedPoints} points accumulated toward your ${targetPoints || 0} point weekly goal.`,
      timestamp: `Week ${currentWeek} • ${daysRemaining} days left`,
      status: earnedPoints >= targetPoints && targetPoints > 0 ? 'complete' : earnedPoints > 0 ? 'pending' : 'attention',
    },
    {
      id: 'weekly-habits',
      title: 'Habits check-in',
      description: `${completedHabits} of ${data.weeklyHabits.length} habits completed this week.`,
      timestamp: 'Habit tracker',
      status: completedHabits === data.weeklyHabits.length && data.weeklyHabits.length > 0 ? 'complete' : 'pending',
    },
    {
      id: 'mentor-assignment',
      title: data.supportAssignment?.mentorProfile ? 'Mentor confirmed' : 'Mentor assignment pending',
      description: data.supportAssignment?.mentorProfile
        ? `Your mentor ${data.supportAssignment.mentorProfile.firstName || 'coach'} is ready for your next check-in.`
        : 'We are confirming your mentor assignment. Expect an update soon.',
      timestamp: 'Leadership Council',
      status: data.supportAssignment?.mentorProfile ? 'complete' : 'pending',
    },
    {
      id: 'peer-matching',
      title: data.peerMatches.length > 0 ? 'Peer match ready' : 'Peer matching in progress',
      description: data.peerMatches.length > 0
        ? 'Review your latest peer connection in Peer Connect.'
        : 'We are still pairing you with a peer ally.',
      timestamp: data.peerMatches.length > 0 ? 'New match' : 'Matching queue',
      status: data.peerMatches.length > 0 ? 'complete' : 'pending',
    },
  ] as const

  return (
    <Box p={{ base: 4, md: 6 }}>
      <Stack spacing={6}>
        {shouldShowBuildVillageCard && (
          <Card bg="brand.primaryMuted" border="1px" borderColor="brand.border">
            <CardBody>
              <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align="flex-start" justify="space-between">
                <Stack spacing={1}>
                  <Heading size="md" color="text.primary">Build Your Village</Heading>
                  <Text color="text.primary">Rally your peers by creating a village to collaborate and track your collective impact.</Text>
                </Stack>
                <Button colorScheme="yellow" onClick={handleOpenVillageModal} alignSelf={{ base: 'flex-start', md: 'center' }}>
                  Open Build Village
                </Button>
              </Stack>
            </CardBody>
          </Card>
        )}

        <Stack spacing={1}>
          <Heading size="lg" color="text.primary">Current Progress at a Glance</Heading>
          <Text color="text.primary">Your personalized dashboard for points accumulated, habits, and support.</Text>
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

        <Grid templateColumns={{ base: '1fr', md: 'repeat(12, 1fr)' }} gap={6} alignItems="stretch">
          <GridItem colSpan={{ base: 1, md: 6 }} order={{ base: 1, md: 1 }}>
            {isParallelTrackingEnabled ? (
              <WindowSummaryCard onNavigate={() => navigate('/app/weekly-checklist')} />
            ) : (
              <LearnerWindowCard
                weekLabel={`Week ${currentWeek} • ${weekRange.label}`}
                daysRemaining={daysRemaining}
                progressValue={weekProgress}
                targetPoints={targetPoints}
                earnedPoints={earnedPoints}
                focusAreas={data.focusAreas.map(fa => fa.title)}
                nextMilestone={`Week ${currentWeek + 1} readiness review`}
              />
            )}
          </GridItem>
          <GridItem colSpan={{ base: 1, md: 6 }} order={{ base: 2, md: 2 }}>
            <WeeklyPointsCard
              data={data.weeklyPoints}
              loading={data.loading.points}
              error={data.errors.points}
              onNavigate={() => navigate('/app/weekly-checklist')}
            />
          </GridItem>
          <GridItem colSpan={{ base: 1, md: 8 }} order={{ base: 3, md: 3 }}>
            <ActivityFeedCard items={[...activityFeedItems]} />
          </GridItem>
          <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 5, md: 4 }}>
            <NextMilestoneCard
              milestone={`Week ${currentWeek + 1} readiness review`}
              daysRemaining={daysRemaining}
              onNavigate={() => navigate('/app/weekly-checklist')}
            />
          </GridItem>
          <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 4, md: 5 }}>
            <SupportTeamCard
              data={data.supportAssignment}
              loading={data.loading.support}
              peerMatches={data.peerMatches}
              peerMatchesLoading={data.loading.matches}
            />
          </GridItem>
          {(!isMobile || showMore) && (
            <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 6, md: 6 }}>
              <PersonalityProfileCard data={data.personality} loading={data.loading.profile} />
            </GridItem>
          )}
          {(!isMobile || showMore) && (
            <GridItem colSpan={{ base: 1, md: 4 }} order={{ base: 7, md: 7 }}>
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
        onSkip={handleCloseVillageModal}
        villageName={villageName}
        villagePurpose={villagePurpose}
        onVillageNameChange={(value) => {
          setVillageName(value)
          if (villageError) {
            setVillageError(undefined)
          }
        }}
        onVillagePurposeChange={(value) => {
          setVillagePurpose(value)
          if (villageError) {
            setVillageError(undefined)
          }
        }}
        isLoading={isCreatingVillage}
        error={villageError}
      />
    </Box>
  )
}
