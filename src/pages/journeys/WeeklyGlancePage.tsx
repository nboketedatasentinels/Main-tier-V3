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
import { MonthlyCourseCard } from '@/components/journeys/weeklyGlance/MonthlyCourseCard'
import { PeopleImpactedCard } from '@/components/journeys/weeklyGlance/PeopleImpactedCard'
import { PeerMatchingCard } from '@/components/journeys/weeklyGlance/PeerMatchingCard'
import { WeeklyInspirationCard } from '@/components/journeys/weeklyGlance/WeeklyInspirationCard'
import { useWeeklyGlanceData } from '@/hooks/useWeeklyGlanceData'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier, UserRole } from '@/types'

export const WeeklyGlancePage = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const data = useWeeklyGlanceData()
  const [isBuildVillageOpen, setIsBuildVillageOpen] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')
  const userRole = profile?.role as UserRole | undefined
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
          <WeeklyPointsCard
            data={data.weeklyPoints}
            loading={data.loading.points}
            error={data.errors.points}
            onNavigate={() => navigate('/app/weekly-checklist')}
          />
          <SupportTeamCard data={data.supportAssignment} loading={data.loading.support} />
          <PersonalityProfileCard data={data.personality} loading={data.loading.profile} />
          <MonthlyCourseCard
            role={userRole}
            membershipStatus={profile?.membershipStatus}
            transformationTier={profile?.transformationTier}
            data={data.monthlyCourse}
            loading={data.loading.monthlyCourse}
            error={data.errors.monthlyCourse}
          />
          <PeopleImpactedCard count={data.impactCount} loading={data.loading.impact} />
          <PeerMatchingCard matches={data.peerMatches} loading={data.loading.matches} />
        </SimpleGrid>
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
