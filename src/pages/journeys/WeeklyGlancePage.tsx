import { useEffect, useMemo, useState } from 'react'
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
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { Hammer, Users } from 'lucide-react'
import { WeeklyPointsCard } from '@/components/journeys/weeklyGlance/WeeklyPointsCard'
import { SupportTeamCard } from '@/components/journeys/weeklyGlance/SupportTeamCard'
import { PersonalityProfileCard } from '@/components/journeys/weeklyGlance/PersonalityProfileCard'
import { FreeCourseAccessCard } from '@/components/journeys/weeklyGlance/FreeCourseAccessCard'
import { PointsActivityCard } from '@/components/journeys/weeklyGlance/PointsActivityCard'
import { PeopleImpactedCard } from '@/components/journeys/weeklyGlance/PeopleImpactedCard'
import { PeerMatchingCard } from '@/components/journeys/weeklyGlance/PeerMatchingCard'
import { WeeklyInspirationCard } from '@/components/journeys/weeklyGlance/WeeklyInspirationCard'
import { WeeklyHabitsCard } from '@/components/journeys/weeklyGlance/WeeklyHabitsCard'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'
import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'

export const WeeklyGlancePage = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [hasVillageDecision, setHasVillageDecision] = useState(false)
  const data = useWeeklyGlanceData()

  const buildVillageKey = useMemo(
    () => (profile ? `t4l.buildVillage.${profile.id}` : null),
    [profile],
  )

  useEffect(() => {
    if (!buildVillageKey) {
      setHasVillageDecision(false)
      return
    }

    const stored = localStorage.getItem(buildVillageKey)
    setHasVillageDecision(stored === 'completed' || stored === 'skipped')
  }, [buildVillageKey])

  const handleVillageCreated = () => {
    if (buildVillageKey) {
      localStorage.setItem(buildVillageKey, 'completed')
    }
    setHasVillageDecision(true)
    onClose()
  }

  const handleVillageSkipped = () => {
    if (buildVillageKey) {
      localStorage.setItem(buildVillageKey, 'skipped')
    }
    setHasVillageDecision(true)
    onClose()
  }

  const hasError = Object.values(data.errors).some(Boolean)

  const shouldShowBuildVillage =
    profile?.role === UserRole.FREE_USER && !profile?.villageId && !hasVillageDecision

  return (
    <Box p={{ base: 4, md: 6 }}>
      <Stack spacing={6}>
        <Stack spacing={1}>
          <Heading size="lg">This Week at a Glance</Heading>
          <Text color="brand.subtleText">Your personalized dashboard for weekly progress, habits, and support.</Text>
        </Stack>

        {shouldShowBuildVillage && (
          <Card border="1px solid" borderColor="brand.border" bg="brand.primaryMuted">
            <CardBody>
              <HStack align="flex-start" spacing={4} justify="space-between" flexWrap="wrap">
                <Stack spacing={3} maxW="3xl">
                  <Stack spacing={1}>
                    <Heading size="md">Build your village</Heading>
                    <Text color="brand.subtleText">
                      Create a space for your peers to gather, stay accountable, and celebrate wins together.
                    </Text>
                  </Stack>
                  <HStack spacing={3} align="center">
                    <Icon as={Users} color="brand.primary" />
                    <Text color="brand.subtleText">Invite allies to shape rituals, check-ins, and celebrations.</Text>
                  </HStack>
                </Stack>
                <Button colorScheme="yellow" onClick={onOpen} leftIcon={<Icon as={Hammer} />}> 
                  Build Village
                </Button>
              </HStack>
            </CardBody>
          </Card>
        )}

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

        <BuildVillageModal isOpen={isOpen} onCreate={handleVillageCreated} onSkip={handleVillageSkipped} />
      </Stack>
    </Box>
  )
}
