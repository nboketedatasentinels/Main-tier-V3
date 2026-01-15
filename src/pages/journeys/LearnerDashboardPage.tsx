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
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { WeeklyPointsCard } from '@/components/journeys/weeklyGlance/WeeklyPointsCard'
import { SupportTeamCard } from '@/components/journeys/weeklyGlance/SupportTeamCard'
import { PersonalityProfileCard } from '@/components/journeys/weeklyGlance/PersonalityProfileCard'
import { PeopleImpactedCard } from '@/components/journeys/weeklyGlance/PeopleImpactedCard'
import { PeerMatchingCard } from '@/components/journeys/weeklyGlance/PeerMatchingCard'
import { WeeklyInspirationCard } from '@/components/journeys/weeklyGlance/WeeklyInspirationCard'
import { ActivityFeedCard } from '@/components/journeys/weeklyGlance/ActivityFeedCard'
import { LearnerWindowCard } from '@/components/journeys/weeklyGlance/LearnerWindowCard'
import { ActivityHistoryTable } from '@/components/journeys/dashboard/ActivityHistoryTable'
import { MiniJourneyTimeline } from '@/components/journeys/dashboard/MiniJourneyTimeline'
import { JourneyCompletionOverview } from '@/components/journeys/dashboard/JourneyCompletionOverview'
import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier } from '@/types'
import { calculateWeekProgress, getDaysRemainingInWeek, getWeekDateRange } from '@/utils/weekCalculations'

export const LearnerDashboardPage = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const data = useWeeklyGlanceData()
  const [isBuildVillageOpen, setIsBuildVillageOpen] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')
  const isPaidMember = profile?.membershipStatus === 'paid'
  const isCorporateTier =
    profile?.transformationTier === TransformationTier.CORPORATE_MEMBER ||
    profile?.transformationTier === TransformationTier.CORPORATE_LEADER
  const shouldShowBuildVillageCard =
    !profile?.villageId &&
    !profile?.companyId &&
    !profile?.corporateVillageId &&
    !isPaidMember &&
    !isCorporateTier

  const hasError = Object.values(data.errors).some(Boolean)

  const handleOpenVillageModal = () => setIsBuildVillageOpen(true)
  const handleCloseVillageModal = () => setIsBuildVillageOpen(false)
  const handleCreateVillage = () => {
    setIsBuildVillageOpen(false)
    setVillageName('')
    setVillagePurpose('')
  }
  const weekRange = getWeekDateRange()
  const daysRemaining = getDaysRemainingInWeek()
  const earnedPoints = data.weeklyPoints?.points_earned || 0
  const targetPoints = data.weeklyPoints?.target_points || 0
  const weekProgress = calculateWeekProgress(earnedPoints, targetPoints)
  const completedHabits = data.weeklyHabits.filter(habit => habit.completed).length
  const activityFeedItems = [
    {
      id: 'weekly-points',
      title: 'Weekly points updated',
      description: `${earnedPoints} points logged toward your ${targetPoints || 0} point goal.`,
      timestamp: `Week ${data.weekNumber} • ${daysRemaining} days left`,
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
                  <Heading size="md" color="#273240">Build Your Village</Heading>
                  <Text color="#273240">Rally your peers by creating a village to collaborate and track your collective impact.</Text>
                </Stack>
                <Button colorScheme="yellow" onClick={handleOpenVillageModal} alignSelf={{ base: 'flex-start', md: 'center' }}>
                  Open Build Village
                </Button>
              </Stack>
            </CardBody>
          </Card>
        )}

        <Stack spacing={1}>
          <Heading size="lg" color="#273240">This Week at a Glance</Heading>
          <Text color="#273240">Your personalized dashboard for weekly progress, habits, and support.</Text>
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
          <LearnerWindowCard
            weekLabel={`Week ${data.weekNumber} • ${weekRange.label}`}
            daysRemaining={daysRemaining}
            progressValue={weekProgress}
            targetPoints={targetPoints}
            earnedPoints={earnedPoints}
            focusAreas={data.focusAreas.map(fa => fa.title)}
            nextMilestone={`Week ${data.weekNumber + 1} readiness review`}
          />
          <WeeklyPointsCard
            data={data.weeklyPoints}
            loading={data.loading.points}
            error={data.errors.points}
            onNavigate={() => navigate('/app/weekly-checklist')}
          />
          <ActivityFeedCard items={[...activityFeedItems]} />
          <SupportTeamCard data={data.supportAssignment} loading={data.loading.support} />
          <PersonalityProfileCard data={data.personality} loading={data.loading.profile} />
          <PeopleImpactedCard count={data.impactCount} loading={data.loading.impact} />
          <PeerMatchingCard matches={data.peerMatches} loading={data.loading.matches} />
        </SimpleGrid>
        <JourneyCompletionOverview />
        <MiniJourneyTimeline />
        <ActivityHistoryTable />
      </Stack>

      <BuildVillageModal
        isOpen={isBuildVillageOpen}
        onCreate={handleCreateVillage}
        onSkip={handleCloseVillageModal}
        villageName={villageName}
        villagePurpose={villagePurpose}
        onVillageNameChange={setVillageName}
        onVillagePurposeChange={setVillagePurpose}
      />
    </Box>
  )
}
