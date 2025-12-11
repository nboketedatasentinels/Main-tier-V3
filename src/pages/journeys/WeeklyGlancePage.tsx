import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Heading,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { WeeklyPointsCard } from '@/components/journeys/weeklyGlance/WeeklyPointsCard'
import { SupportTeamCard } from '@/components/journeys/weeklyGlance/SupportTeamCard'
import { PersonalityProfileCard } from '@/components/journeys/weeklyGlance/PersonalityProfileCard'
import { FreeCourseAccessCard } from '@/components/journeys/weeklyGlance/FreeCourseAccessCard'
import { PointsActivityCard } from '@/components/journeys/weeklyGlance/PointsActivityCard'
import { PeopleImpactedCard } from '@/components/journeys/weeklyGlance/PeopleImpactedCard'
import { PeerMatchingCard } from '@/components/journeys/weeklyGlance/PeerMatchingCard'
import { WeeklyInspirationCard } from '@/components/journeys/weeklyGlance/WeeklyInspirationCard'
import { WeeklyHabitsCard } from '@/components/journeys/weeklyGlance/WeeklyHabitsCard'
import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'

export const WeeklyGlancePage = () => {
  const navigate = useNavigate()
  const data = useWeeklyGlanceData()

  const hasError = Object.values(data.errors).some(Boolean)

  return (
    <Box p={{ base: 4, md: 6 }}>
      <Stack spacing={6}>
        <Stack spacing={1}>
          <Heading size="lg">This Week at a Glance</Heading>
          <Text color="brand.subtleText">Your personalized dashboard for weekly progress, habits, and support.</Text>
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

        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4} alignItems="stretch">
          <WeeklyPointsCard
            data={data.weeklyPoints}
            loading={data.loading.points}
            error={data.errors.points}
            onNavigate={() => navigate('/app/weekly-checklist')}
          />
          <SupportTeamCard data={data.supportAssignment} loading={data.loading.support} />
          <PersonalityProfileCard data={data.personality} loading={data.loading.profile} />
          <FreeCourseAccessCard />
          <PointsActivityCard
            totalPoints={data.weeklyPoints?.points_earned}
            recentActivityCount={data.weeklyPoints?.engagement_count}
            upcomingChallenges={[]}
            allies={data.peerMatches.map(match => match.matched_user_id)}
          />
          <PeopleImpactedCard count={data.impactCount} loading={data.loading.impact} />
          <PeerMatchingCard matches={data.peerMatches} loading={data.loading.matches} />
          <WeeklyInspirationCard data={data.inspirationQuote} loading={data.loading.inspiration} />
          <WeeklyHabitsCard habits={data.weeklyHabits} loading={data.loading.habits} onToggleHabit={data.handleHabitToggle} />
        </SimpleGrid>
      </Stack>
    </Box>
  )
}
