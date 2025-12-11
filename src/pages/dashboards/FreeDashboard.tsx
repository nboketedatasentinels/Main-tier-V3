import React, { useMemo } from 'react'
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  Button,
  HStack,
  VStack,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { DashboardTourStep, useDashboardTour } from '@/hooks/useDashboardTour'

export const FreeDashboard: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const tourSteps = useMemo<DashboardTourStep[]>(
    () => [
      {
        element: '#free-dashboard-welcome',
        title: 'Start your tour',
        intro: 'A quick walkthrough of the free dashboard so you can explore with confidence.',
        position: 'bottom',
        buttons: [
          { text: 'Skip', action: (intro) => intro.exit() },
          { text: 'Next', action: (intro) => intro.nextStep() },
        ],
      },
      {
        element: '#free-dashboard-stats',
        title: 'Track your basics',
        intro: 'Keep an eye on your points, level, and weekly journey notes. Upgrade unlocks deeper insights.',
        position: 'right',
        buttons: [
          {
            text: 'Visit leaderboard',
            action: () => navigate('/app/leadership-board'),
          },
          { text: 'Next', action: (intro) => intro.nextStep() },
        ],
      },
      {
        element: '#free-upgrade-card',
        title: 'Unlock the full experience',
        intro: 'Paid members get full journeys, guided paths, and live events. Upgrade when you are ready.',
        position: 'left',
        buttons: [
          {
            text: 'Explore memberships',
            action: () => navigate('/'),
          },
          { text: 'Finish', action: (intro) => intro.nextStep() },
        ],
      },
    ],
    [navigate]
  )

  const { startTour, currentStep, hasCompleted, announcementNode, isLoading } =
    useDashboardTour('free', tourSteps, true)

  return (
    <Box>
      {announcementNode}
      <HStack
        justify="space-between"
        align={{ base: 'flex-start', md: 'center' }}
        spacing={4}
        mb={4}
        bg="rgba(255, 255, 255, 0.04)"
        border="1px solid"
        borderColor="brand.border"
        borderRadius="lg"
        p={4}
      >
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.softGold">
            Guided tour
          </Text>
          <Text fontSize="sm" color="brand.softGold" opacity={0.85}>
            {isLoading
              ? 'Loading your dashboard tour...'
              : hasCompleted
                ? 'Tour complete — replay to revisit tips.'
                : `Resume from step ${currentStep + 1}.`}
          </Text>
        </VStack>
        <Button
          size="sm"
          variant="outline"
          colorScheme="yellow"
          aria-label="Start dashboard tour"
          onClick={() => startTour(hasCompleted ? 0 : currentStep)}
          isDisabled={isLoading}
        >
          {hasCompleted ? 'Replay tour' : 'Start tour'}
        </Button>
      </HStack>

      <Box id="free-dashboard-welcome" aria-label="Free dashboard welcome">
        <Heading mb={2} color="brand.gold">Welcome, {profile?.firstName}!</Heading>
        <Text mb={8} color="brand.softGold">
          You're on the Curious Cat Path. Explore T4L and upgrade to unlock full features!
        </Text>
      </Box>

      <SimpleGrid
        id="free-dashboard-stats"
        aria-label="Free dashboard stats"
        columns={{ base: 1, md: 3 }}
        spacing={6}
      >
        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Total Points</StatLabel>
              <StatNumber color="brand.gold">{profile?.totalPoints || 0}</StatNumber>
              <StatHelpText color="brand.softGold">Keep logging impact!</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Level</StatLabel>
              <StatNumber color="brand.gold">{profile?.level || 1}</StatNumber>
              <StatHelpText color="brand.softGold">Earn points to level up</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg="brand.royalPurple" id="free-upgrade-card" aria-label="Upgrade call to action">
          <CardBody>
            <Stat>
              <StatLabel color="brand.softGold">Journey</StatLabel>
              <StatNumber color="brand.gold">Free Tier</StatNumber>
              <StatHelpText color="brand.flameOrange">Upgrade to start a journey!</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  )
}
