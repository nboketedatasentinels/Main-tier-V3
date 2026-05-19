import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { FirestoreError } from 'firebase/firestore'
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Fingerprint,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useWeeklyGlanceData, type LedgerEntry } from '@/hooks/useWeeklyGlanceData'
import { BuildVillageModal } from '@/components/modals/BuildVillageModal'
import { useAuth } from '@/hooks/useAuth'
import { TransformationTier, type UserProfile } from '@/types'
import { updateUserVillageId } from '@/services/userProfileService'
import { checkVillageNameExists, createVillage } from '@/services/villageService'
import { getJourneyTiming } from '@/utils/weekCalculations'
import { JOURNEY_META } from '@/config/pointsConfig'

const CYCLE_LENGTH_DAYS = 14

function isCorporateUser(profile: UserProfile | null | undefined) {
  const tier = profile?.transformationTier
  return tier === TransformationTier.CORPORATE_MEMBER || tier === TransformationTier.CORPORATE_LEADER
}

function canCreateVillage(profile: UserProfile | null | undefined) {
  const hasVillageContext =
    !!profile?.villageId ||
    !!profile?.corporateVillageId ||
    !!profile?.companyId ||
    !!profile?.companyCode ||
    !!profile?.organizationId
  if (hasVillageContext) return false
  if (profile?.membershipStatus === 'paid') return false
  if (isCorporateUser(profile)) return false
  return true
}

interface PaceInfo {
  label: string
  detail: string
  tone: 'green' | 'yellow' | 'red'
}

function computePace(earned: number, target: number, daysRemaining: number): PaceInfo {
  if (target <= 0) {
    return { label: 'Just starting', detail: 'Set a target to track pace', tone: 'yellow' }
  }
  const daysElapsed = Math.max(1, CYCLE_LENGTH_DAYS - daysRemaining)
  const expected = target * (daysElapsed / CYCLE_LENGTH_DAYS)
  const delta = earned - expected
  const deltaPct = expected > 0 ? Math.round((delta / expected) * 100) : 0

  if (deltaPct >= 5) {
    return { label: 'Ahead of pace', detail: `${Math.abs(deltaPct)}% above expected`, tone: 'green' }
  }
  if (deltaPct <= -10) {
    return { label: 'Behind pace', detail: `${Math.abs(deltaPct)}% below expected`, tone: 'red' }
  }
  return { label: 'On track', detail: 'Pace matches plan', tone: 'green' }
}

type KpiTheme = 'purple' | 'orange' | 'green' | 'yellow' | 'red' | 'blue'

interface KpiThemeStyles {
  iconBg: string
  iconShadow: string
  ornamentBg: string
  hoverShadow: string
  hoverBorder: string
}

const kpiThemes: Record<KpiTheme, KpiThemeStyles> = {
  purple: {
    iconBg: '#350e6f',
    iconShadow: '0 4px 12px rgba(53, 14, 111, 0.3)',
    ornamentBg: 'purple.50',
    hoverShadow: '0 8px 25px rgba(139, 92, 246, 0.15)',
    hoverBorder: 'purple.200',
  },
  orange: {
    iconBg: 'linear-gradient(135deg, #f4540c 0%, #c2410c 100%)',
    iconShadow: '0 4px 12px rgba(244, 84, 12, 0.3)',
    ornamentBg: 'orange.50',
    hoverShadow: '0 8px 25px rgba(244, 84, 12, 0.15)',
    hoverBorder: 'orange.200',
  },
  green: {
    iconBg: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
    iconShadow: '0 4px 12px rgba(4, 120, 87, 0.3)',
    ornamentBg: 'green.50',
    hoverShadow: '0 8px 25px rgba(16, 185, 129, 0.15)',
    hoverBorder: 'green.200',
  },
  yellow: {
    iconBg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
    iconShadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
    ornamentBg: 'yellow.50',
    hoverShadow: '0 8px 25px rgba(217, 119, 6, 0.15)',
    hoverBorder: 'yellow.200',
  },
  red: {
    iconBg: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    iconShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
    ornamentBg: 'red.50',
    hoverShadow: '0 8px 25px rgba(220, 38, 38, 0.15)',
    hoverBorder: 'red.200',
  },
  blue: {
    iconBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    iconShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
    ornamentBg: 'blue.50',
    hoverShadow: '0 8px 25px rgba(37, 99, 235, 0.15)',
    hoverBorder: 'blue.200',
  },
}

const toneToTheme = (tone: 'default' | 'green' | 'yellow' | 'red'): KpiTheme => {
  if (tone === 'green') return 'green'
  if (tone === 'yellow') return 'yellow'
  if (tone === 'red') return 'red'
  return 'purple'
}

interface KpiTileProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  theme: KpiTheme
}

const KpiTile = ({ label, value, sub, icon, theme }: KpiTileProps) => {
  const styles = kpiThemes[theme]
  return (
    <Box
      p={5}
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.100"
      boxShadow="0 2px 8px rgba(0,0,0,0.04)"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: styles.hoverShadow,
        borderColor: styles.hoverBorder,
      }}
      transition="all 0.3s ease"
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        top={0}
        right={0}
        w="60px"
        h="60px"
        bg={styles.ornamentBg}
        borderRadius="0 0 0 100%"
      />
      <Flex
        w={10}
        h={10}
        bg={styles.iconBg}
        borderRadius="xl"
        align="center"
        justify="center"
        mb={3}
        boxShadow={styles.iconShadow}
      >
        <Box as={icon} w={5} h={5} color="white" />
      </Flex>
      <Text
        fontSize="xs"
        color="gray.500"
        fontWeight="semibold"
        textTransform="uppercase"
        letterSpacing="wide"
        mb={1}
      >
        {label}
      </Text>
      <Text
        fontWeight="bold"
        fontSize="3xl"
        color="gray.800"
        lineHeight="1.1"
        letterSpacing="-0.02em"
      >
        {value}
      </Text>
      {sub && (
        <Text fontSize="xs" color="gray.500" mt={1}>
          {sub}
        </Text>
      )}
    </Box>
  )
}

interface ActivityRowProps {
  entry: LedgerEntry
}

const ActivityRow = ({ entry }: ActivityRowProps) => {
  const positive = entry.points > 0
  return (
    <Flex
      justify="space-between"
      align="center"
      py={3}
      borderBottomWidth="1px"
      borderColor="gray.100"
      _last={{ borderBottomWidth: 0 }}
    >
      <HStack spacing={3} minW={0} flex={1}>
        <Box
          w={8}
          h={8}
          rounded="full"
          bg={positive ? 'green.50' : 'gray.100'}
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Box as={CheckCircle2} w={4} h={4} color={positive ? 'green.500' : 'gray.400'} />
        </Box>
        <Stack spacing={0} minW={0} flex={1}>
          <Text fontSize="sm" fontWeight="medium" color="gray.800" noOfLines={1}>
            {entry.activityTitle}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
          </Text>
        </Stack>
      </HStack>
      <Text
        fontSize="sm"
        fontWeight="semibold"
        color={positive ? 'green.600' : 'gray.500'}
        ml={3}
      >
        {positive ? '+' : ''}
        {entry.points.toLocaleString()}
      </Text>
    </Flex>
  )
}

export const WeeklyGlancePage = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { profile, refreshProfile } = useAuth()
  const data = useWeeklyGlanceData()

  const [isBuildVillageOpen, setIsBuildVillageOpen] = useState(false)
  const [villageName, setVillageName] = useState('')
  const [villagePurpose, setVillagePurpose] = useState('')
  const [isCreatingVillage, setIsCreatingVillage] = useState(false)
  const [villageError, setVillageError] = useState<string | undefined>()

  const journeyTiming = useMemo(
    () => getJourneyTiming(profile?.journeyStartDate, profile?.programDurationWeeks ?? 6),
    [profile?.journeyStartDate, profile?.programDurationWeeks]
  )

  const currentWeek = journeyTiming?.currentWeek ?? data.weekNumber
  const totalWeeks = profile?.programDurationWeeks ?? 6
  const daysRemaining = journeyTiming?.daysRemaining ?? 0
  const cycleNumber = Math.ceil(currentWeek / 2)
  const totalCycles = Math.max(1, Math.ceil(totalWeeks / 2))

  const earnedPoints = data.weeklyPoints?.points_earned ?? 0
  const targetPoints = data.weeklyPoints?.target_points ?? 0
  const cycleTarget = profile?.journeyType
    ? JOURNEY_META[profile.journeyType]?.windowTarget ?? targetPoints * 2
    : targetPoints * 2
  const cycleEarned = profile?.totalPoints ?? earnedPoints
  const cycleProgress = cycleTarget > 0 ? Math.min(100, Math.round((cycleEarned / cycleTarget) * 100)) : 0
  const remainingPoints = Math.max(cycleTarget - cycleEarned, 0)
  const pace = computePace(cycleEarned, cycleTarget, daysRemaining)

  const focusAreas = useMemo(
    () => (data.focusAreas ?? []).slice(0, 4).map((focusArea) => focusArea.title),
    [data.focusAreas]
  )

  const recentActivity = useMemo(
    () =>
      (data.ledgerEntries ?? [])
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
    [data.ledgerEntries]
  )

  const shouldShowBuildVillageCard = canCreateVillage(profile)
  const hasError = Object.values(data.errors ?? {}).some(Boolean)

  const personalityIncomplete = useMemo(() => {
    if (data.loading.profile) return false
    const hasPersonalityType = Boolean(profile?.hasCompletedPersonalityTest) && Boolean(data.personality?.personalityType)
    const hasCoreValues = Boolean(profile?.hasCompletedValuesTest) && (data.personality?.coreValues?.length ?? 0) > 0
    return !hasPersonalityType || !hasCoreValues
  }, [data.loading.profile, data.personality, profile?.hasCompletedPersonalityTest, profile?.hasCompletedValuesTest])

  const handleNavigateProfile = useCallback(() => {
    navigate('/app/profile')
  }, [navigate])

  const firstName = useMemo(() => {
    const name = profile?.firstName ?? profile?.fullName ?? profile?.email ?? ''
    return name.split(' ')[0] || 'there'
  }, [profile?.firstName, profile?.fullName, profile?.email])

  const today = useMemo(() => format(new Date(), 'EEEE, MMMM d'), [])

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
    if (error instanceof Error) return error.message
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
      toast({ status: 'error', title: 'Unable to create village', description: message })
      return
    }

    setIsCreatingVillage(true)
    setVillageError(undefined)

    try {
      const nameExists = await checkVillageNameExists(trimmedName)
      if (nameExists) {
        const message = 'A village with this name already exists. Please choose a different name.'
        setVillageError(message)
        toast({ status: 'error', title: 'Village name taken', description: message })
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
      toast({ status: 'error', title: 'Unable to create village', description: message })
    } finally {
      setIsCreatingVillage(false)
    }
  }, [
    profile?.id,
    refreshProfile,
    resetVillageForm,
    resolveVillageErrorMessage,
    toast,
    villageName,
    villagePurpose,
  ])

  const handleNavigateChecklist = useCallback(() => {
    navigate('/app/weekly-checklist')
  }, [navigate])

  return (
    <Box bg="gray.50" minH="100%" p={{ base: 4, md: 8 }} pt={{ base: 4, md: 6 }}>
      <Stack spacing={8} maxW="1400px" mx="auto">
        {/* Header */}
        <Flex
          justify="space-between"
          align={{ base: 'flex-start', md: 'flex-end' }}
          direction={{ base: 'column', md: 'row' }}
          gap={3}
        >
          <Stack spacing={1}>
            <Heading
              size="lg"
              color="gray.900"
              letterSpacing="-0.02em"
              fontWeight="bold"
            >
              Hello, {firstName}
            </Heading>
            <HStack spacing={2} color="gray.500" fontSize="sm">
              <Box as={Calendar} w={4} h={4} />
              <Text>{today}</Text>
              <Text color="gray.300">·</Text>
              <Text>
                Week {currentWeek} of {totalWeeks} · Cycle {cycleNumber} of {totalCycles}
              </Text>
            </HStack>
          </Stack>
          <Button
            onClick={handleNavigateChecklist}
            bg="brand.primary"
            color="white"
            _hover={{ bg: 'brand.dark' }}
            rightIcon={<Box as={ArrowUpRight} w={4} h={4} />}
            size="md"
          >
            Open weekly checklist
          </Button>
        </Flex>

        {hasError && (
          <Alert status="warning" rounded="md" borderWidth="1px" borderColor="yellow.200">
            <AlertIcon />
            <Box>
              <AlertTitle>Some sections failed to load</AlertTitle>
              <AlertDescription>Data may be incomplete. Try refreshing the page.</AlertDescription>
            </Box>
          </Alert>
        )}

        {personalityIncomplete && (
          <Box
            bg="white"
            p={5}
            borderRadius="xl"
            boxShadow="0 2px 8px rgba(0,0,0,0.04)"
            position="relative"
            overflow="hidden"
            borderLeftWidth="4px"
            borderLeftColor="brand.primary"
          >
            <Box position="absolute" top={0} right={0} w="60px" h="60px" bg="purple.50" borderRadius="0 0 0 100%" />
            <Flex
              justify="space-between"
              align={{ base: 'flex-start', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap={4}
              position="relative"
              zIndex={1}
            >
              <HStack spacing={3} align="center">
                <Flex
                  w={10}
                  h={10}
                  bg="#350e6f"
                  borderRadius="xl"
                  align="center"
                  justify="center"
                  boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
                  flexShrink={0}
                >
                  <Box as={Fingerprint} w={5} h={5} color="white" />
                </Flex>
                <Stack spacing={0}>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    color="orange.600"
                  >
                    Action required
                  </Text>
                  <Heading size="sm" color="gray.900">
                    Complete your personality profile
                  </Heading>
                  <Text fontSize="sm" color="gray.600" mt={0.5}>
                    Takes 12 minutes. Unlocks personalised matches and recommendations.
                  </Text>
                </Stack>
              </HStack>
              <Button
                onClick={handleNavigateProfile}
                bg="brand.primary"
                color="white"
                _hover={{ bg: 'brand.dark' }}
                rightIcon={<Box as={ArrowUpRight} w={4} h={4} />}
                size="md"
                flexShrink={0}
              >
                Complete now
              </Button>
            </Flex>
          </Box>
        )}

        {/* KPI Strip */}
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
          <Skeleton isLoaded={!data.loading.points} rounded="xl">
            <KpiTile
              label="Points earned"
              value={cycleEarned.toLocaleString()}
              sub={`of ${cycleTarget.toLocaleString()} cycle target`}
              icon={Star}
              theme="purple"
            />
          </Skeleton>
          <KpiTile
            label="Days left in cycle"
            value={daysRemaining}
            sub={daysRemaining <= 2 ? 'Closing soon' : 'Time remaining'}
            icon={Clock}
            theme={daysRemaining <= 2 ? 'red' : 'orange'}
          />
          <Skeleton isLoaded={!data.loading.points} rounded="xl">
            <KpiTile
              label="Pace"
              value={pace.label}
              sub={pace.detail}
              icon={TrendingUp}
              theme={toneToTheme(pace.tone)}
            />
          </Skeleton>
        </SimpleGrid>

        {/* Hero - Cycle progress */}
        <Box
          bg="white"
          p={{ base: 5, md: 7 }}
          borderRadius="xl"
          boxShadow="0 2px 8px rgba(0,0,0,0.04)"
          _hover={{
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(139, 92, 246, 0.15)',
          }}
          transition="all 0.3s ease"
          position="relative"
          overflow="hidden"
        >
          <Box
            position="absolute"
            top={0}
            right={0}
            w="90px"
            h="90px"
            bg="purple.50"
            borderRadius="0 0 0 100%"
          />
          <Stack spacing={6}>
            <Flex
              justify="space-between"
              align={{ base: 'flex-start', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap={3}
            >
              <HStack spacing={3} align="center">
                <Flex
                  w={10}
                  h={10}
                  bg="#350e6f"
                  borderRadius="xl"
                  align="center"
                  justify="center"
                  boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
                  flexShrink={0}
                >
                  <Box as={Target} w={5} h={5} color="white" />
                </Flex>
                <Stack spacing={0}>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    color="gray.500"
                  >
                    Cycle {cycleNumber} progress
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {journeyTiming?.weekLabel ?? 'Current cycle'}
                  </Text>
                </Stack>
              </HStack>
              <Badge
                colorScheme={pace.tone}
                variant="subtle"
                fontSize="xs"
                px={3}
                py={1}
                rounded="full"
                textTransform="none"
                fontWeight="medium"
                position="relative"
                zIndex={1}
              >
                {pace.label}
              </Badge>
            </Flex>

              <Skeleton isLoaded={!data.loading.points} rounded="md">
                <Stack spacing={4}>
                  <Flex align="baseline" gap={2}>
                    <Text
                      fontSize={{ base: '5xl', md: '6xl' }}
                      fontWeight="bold"
                      lineHeight="1"
                      letterSpacing="-0.03em"
                      color="gray.900"
                    >
                      {cycleProgress}%
                    </Text>
                    <Text fontSize="md" color="gray.500" fontWeight="medium">
                      complete
                    </Text>
                  </Flex>

                  <Progress
                    value={cycleProgress}
                    size="sm"
                    rounded="full"
                    colorScheme={cycleProgress >= 100 ? 'green' : 'purple'}
                    bg="gray.100"
                  />

                  <Flex justify="space-between" fontSize="sm" color="gray.600">
                    <Text>
                      <Text as="span" fontWeight="semibold" color="gray.900">
                        {cycleEarned.toLocaleString()}
                      </Text>
                      {' '}of {cycleTarget.toLocaleString()} pts
                    </Text>
                    <Text>
                      {remainingPoints > 0 ? (
                        <>
                          <Text as="span" fontWeight="semibold" color="orange.600">
                            {remainingPoints.toLocaleString()}
                          </Text>
                          {' '}to go
                        </>
                      ) : (
                        <Text as="span" fontWeight="semibold" color="green.600">
                          Cycle target reached
                        </Text>
                      )}
                    </Text>
                  </Flex>
                </Stack>
              </Skeleton>
            </Stack>
        </Box>

        {/* Two-column: Focus + Activity */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          <Box
            bg="white"
            p={6}
            borderRadius="xl"
            border="1px solid"
            borderColor="gray.100"
            boxShadow="0 2px 8px rgba(0,0,0,0.04)"
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(217, 119, 6, 0.15)',
              borderColor: 'yellow.200',
            }}
            transition="all 0.3s ease"
            position="relative"
            overflow="hidden"
            h="100%"
          >
            <Box
              position="absolute"
              top={0}
              right={0}
              w="60px"
              h="60px"
              bg="yellow.50"
              borderRadius="0 0 0 100%"
            />
            <Stack spacing={5} h="100%">
              <HStack spacing={3} align="center">
                <Flex
                  w={10}
                  h={10}
                  bg="linear-gradient(135deg, #d97706 0%, #b45309 100%)"
                  borderRadius="xl"
                  align="center"
                  justify="center"
                  boxShadow="0 4px 12px rgba(217, 119, 6, 0.3)"
                  flexShrink={0}
                >
                  <Box as={Sparkles} w={5} h={5} color="white" />
                </Flex>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  color="gray.500"
                >
                  Focus this cycle
                </Text>
              </HStack>

                {data.loading.focus ? (
                  <Skeleton h="120px" rounded="md" />
                ) : focusAreas.length > 0 ? (
                  <Stack spacing={2}>
                    {focusAreas.map((area, idx) => (
                      <Flex
                        key={area}
                        align="center"
                        gap={3}
                        p={3}
                        bg="gray.50"
                        rounded="md"
                        borderWidth="1px"
                        borderColor="gray.100"
                      >
                        <Box
                          w={6}
                          h={6}
                          rounded="full"
                          bg="brand.gold"
                          color="brand.deepPlum"
                          fontSize="xs"
                          fontWeight="bold"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          {idx + 1}
                        </Box>
                        <Text fontSize="sm" fontWeight="medium" color="gray.800">
                          {area}
                        </Text>
                      </Flex>
                    ))}
                  </Stack>
                ) : (
                  <Text fontSize="sm" color="gray.500">
                    No focus areas set for this cycle yet.
                  </Text>
                )}

                <Box flex={1} />

                <Button
                  variant="ghost"
                  color="brand.primary"
                  size="sm"
                  alignSelf="flex-start"
                  rightIcon={<Box as={ArrowUpRight} w={3.5} h={3.5} />}
                  onClick={handleNavigateChecklist}
                  px={0}
                  _hover={{ bg: 'transparent', color: 'brand.dark' }}
                >
                  View this week's activities
                </Button>
            </Stack>
          </Box>

          <Box
            bg="white"
            p={6}
            borderRadius="xl"
            border="1px solid"
            borderColor="gray.100"
            boxShadow="0 2px 8px rgba(0,0,0,0.04)"
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)',
              borderColor: 'green.200',
            }}
            transition="all 0.3s ease"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={0}
              right={0}
              w="60px"
              h="60px"
              bg="green.50"
              borderRadius="0 0 0 100%"
            />
            <Stack spacing={4}>
              <Flex justify="space-between" align="center">
                <HStack spacing={3} align="center">
                  <Flex
                    w={10}
                    h={10}
                    bg="linear-gradient(135deg, #047857 0%, #065f46 100%)"
                    borderRadius="xl"
                    align="center"
                    justify="center"
                    boxShadow="0 4px 12px rgba(4, 120, 87, 0.3)"
                    flexShrink={0}
                  >
                    <Box as={Users} w={5} h={5} color="white" />
                  </Flex>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    color="gray.500"
                  >
                    Recent activity
                  </Text>
                </HStack>
                {recentActivity.length > 0 && (
                  <Text fontSize="xs" color="gray.400">
                    Last {recentActivity.length}
                  </Text>
                )}
              </Flex>

              {data.loading.ledger ? (
                <Stack spacing={3}>
                  <Skeleton h="40px" rounded="md" />
                  <Skeleton h="40px" rounded="md" />
                  <Skeleton h="40px" rounded="md" />
                </Stack>
              ) : recentActivity.length > 0 ? (
                <Stack spacing={0}>
                  {recentActivity.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} />
                  ))}
                </Stack>
              ) : (
                <Box py={6} textAlign="center">
                  <Text fontSize="sm" color="gray.500">
                    No activity logged yet this cycle.
                  </Text>
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    Complete an activity to see it appear here.
                  </Text>
                </Box>
              )}
            </Stack>
          </Box>
        </SimpleGrid>

        {shouldShowBuildVillageCard && (
          <Box
            bg="white"
            p={6}
            borderRadius="xl"
            border="1px solid"
            borderColor="purple.200"
            boxShadow="0 2px 8px rgba(0,0,0,0.04)"
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(139, 92, 246, 0.15)',
              borderColor: 'purple.300',
            }}
            transition="all 0.3s ease"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={0}
              right={0}
              w="60px"
              h="60px"
              bg="purple.50"
              borderRadius="0 0 0 100%"
            />
            <Flex
              direction={{ base: 'column', md: 'row' }}
              justify="space-between"
              align={{ base: 'flex-start', md: 'center' }}
              gap={4}
            >
              <HStack spacing={3} align="flex-start">
                <Flex
                  w={10}
                  h={10}
                  bg="#350e6f"
                  borderRadius="xl"
                  align="center"
                  justify="center"
                  boxShadow="0 4px 12px rgba(53, 14, 111, 0.3)"
                  flexShrink={0}
                >
                  <Box as={Users} w={5} h={5} color="white" />
                </Flex>
                <Stack spacing={1}>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    color="brand.primary"
                  >
                    Optional
                  </Text>
                  <Heading size="sm" color="gray.900">
                    Build your village
                  </Heading>
                  <Text fontSize="sm" color="gray.600">
                    Rally your peers into a private group to collaborate and track collective impact.
                  </Text>
                </Stack>
              </HStack>
              <Button
                onClick={openVillageModal}
                bg="brand.primary"
                color="white"
                _hover={{ bg: 'brand.dark' }}
                size="md"
                flexShrink={0}
              >
                Create village
              </Button>
            </Flex>
          </Box>
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
