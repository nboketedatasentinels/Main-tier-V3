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
  Progress,
  Badge,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { WeeklyPointsCard } from '@/components/journeys/weeklyGlance/WeeklyPointsCard'
import { SupportTeamCard } from '@/components/journeys/weeklyGlance/SupportTeamCard'
import { PersonalityProfileCard } from '@/components/journeys/weeklyGlance/PersonalityProfileCard'
import { PeopleImpactedCard } from '@/components/journeys/weeklyGlance/PeopleImpactedCard'
import { PeerMatchingCard } from '@/components/journeys/weeklyGlance/PeerMatchingCard'
import { WeeklyInspirationCard } from '@/components/journeys/weeklyGlance/WeeklyInspirationCard'
import { ActivityFeedCard } from '@/components/journeys/weeklyGlance/ActivityFeedCard'
import { LearnerWindowCard } from '@/components/journeys/weeklyGlance/LearnerWindowCard'
import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier } from '@/types'
import {
  calculateWeekProgress,
  getDaysRemainingInWeek,
  getWeekDateRange,
} from '@/utils/weekCalculations'

export const WeeklyGlancePage = () => {
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

  const weekRange = getWeekDateRange()
  const daysRemaining = getDaysRemainingInWeek()
  const earnedPoints = data.weeklyPoints?.points_earned || 0
  const targetPoints = data.weeklyPoints?.target_points || 0
  const weekProgress = calculateWeekProgress(earnedPoints, targetPoints)

  /**
   * Determine the single most important action for this user THIS WEEK
   */
  const primaryAction = useMemo(() => {
    if (earnedPoints === 0) {
      return {
        label: 'Start your week',
        description: 'Complete your Weekly Checklist to unlock points and momentum.',
        cta: 'Complete Weekly Checklist',
        action: () => navigate('/app/weekly-checklist'),
      }
    }

    if (data.impactCount === 0) {
      return {
        label: 'Create your first impact',
        description: 'Log one meaningful action to start your impact journey.',
        cta: 'Log Impact',
        action: () => navigate('/app/impact-log'),
      }
    }

    if (data.peerMatches.length === 0) {
      return {
        label: 'Build accountability',
        description: 'Match with a peer to stay consistent and supported.',
        cta: 'Start Peer Matching',
        action: () => navigate('/app/peer-connect'),
      }
    }

    return {
      label: 'Stay on track',
      description: 'You’re progressing well. Finish strong this week.',
      cta: 'Review Weekly Progress',
      action: () => navigate('/app/weekly-checklist'),
    }
  }, [earnedPoints, data.impactCount, data.peerMatches.length, navigate])

  return (
    <Box p={{ base: 4, md: 6 }}>
      <Stack spacing={6}>

        {/* BUILD VILLAGE PROMPT */}
        {shouldShowBuildVillageCard && (
          <Card bg="brand.primaryMuted" border="1px" borderColor="brand.border">
            <CardBody>
              <Stack
                direction={{ base: 'column', md: 'row' }}
                spacing={4}
                justify="space-between"
                align="flex-start"
              >
                <Stack spacing={1}>
                  <Heading size="md" color="#273240">
                    Build Your Village
                  </Heading>
                  <Text color="#273240">
                    Rally peers, collaborate consistently, and track collective impact.
                  </Text>
                </Stack>
                <Button
                  colorScheme="yellow"
                  onClick={() => setIsBuildVillageOpen(true)}
                >
                  Create Village
                </Button>
              </Stack>
            </CardBody>
          </Card>
        )}

        {/* PAGE HEADER */}
        <Stack spacing={1}>
          <Heading size="lg" color="#273240">
            This Week at a Glance
          </Heading>
          <Text color="#273240">
            Focused actions, measurable progress, and meaningful support.
          </Text>
        </Stack>

        {/* PRIMARY WEEKLY ACTION BANNER */}
        <Card border="1px solid" borderColor="purple.200" bg="purple.50">
          <CardBody>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              spacing={4}
              justify="space-between"
              align="center"
            >
              <Stack spacing={1}>
                <Badge colorScheme="purple" w="fit-content">
                  This Week’s Priority
                </Badge>
                <Heading size="md">{primaryAction.label}</Heading>
                <Text color="gray.600">{primaryAction.description}</Text>
                <Progress
                  value={weekProgress}
                  size="sm"
                  colorScheme="purple"
                  max={100}
                  borderRadius="md"
                />
                <Text fontSize="sm" color="gray.500">
                  {daysRemaining} days remaining
                </Text>
              </Stack>
              <Button
                colorScheme="purple"
                size="lg"
                onClick={primaryAction.action}
              >
                {primaryAction.cta}
              </Button>
            </Stack>
          </CardBody>
        </Card>

        {/* ERROR STATE */}
        {hasError && (
          <Alert status="warning" rounded="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Some sections failed to load</AlertTitle>
              <AlertDescription>
                Data may be incomplete. Refresh to retry.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* INSPIRATION */}
        <WeeklyInspirationCard
          data={data.inspirationQuote}
          loading={data.loading.inspiration}
        />

        {/* MAIN GRID */}
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          <LearnerWindowCard
            weekLabel={`Week ${data.weekNumber} • ${weekRange.label}`}
            daysRemaining={daysRemaining}
            progressValue={weekProgress}
            targetPoints={targetPoints}
            earnedPoints={earnedPoints}
            focusAreas={[
              'Leadership reflection',
              'Mentor engagement',
              'Impact action',
            ]}
            nextMilestone={`Prepare for Week ${data.weekNumber + 1}`}
          />

          <WeeklyPointsCard
            data={data.weeklyPoints}
            loading={data.loading.points}
            error={data.errors.points}
            onNavigate={() => navigate('/app/weekly-checklist')}
          />

          <ActivityFeedCard items={data.activityFeedItems ?? []} />

          <SupportTeamCard
            data={data.supportAssignment}
            loading={data.loading.support}
          />

          <PersonalityProfileCard
            data={data.personality}
            loading={data.loading.profile}
          />

          <PeopleImpactedCard
            count={data.impactCount}
            loading={data.loading.impact}
          />

          <PeerMatchingCard
            matches={data.peerMatches}
            loading={data.loading.matches}
          />
        </SimpleGrid>
      </Stack>

      <BuildVillageModal
        isOpen={isBuildVillageOpen}
        onCreate={() => {
          setIsBuildVillageOpen(false)
          setVillageName('')
          setVillagePurpose('')
        }}
        onSkip={() => setIsBuildVillageOpen(false)}
        villageName={villageName}
        villagePurpose={villagePurpose}
        onVillageNameChange={setVillageName}
        onVillagePurposeChange={setVillagePurpose}
      />
    </Box>
  )
}
