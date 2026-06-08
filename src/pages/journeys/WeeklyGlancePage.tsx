import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc, FirestoreError } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { resolveJourneyType } from '@/utils/journeyType'
import type { JourneyType } from '@/config/pointsConfig'
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Fingerprint,
  Star,
  Target,
  TrendingUp,
  Upload,
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

/**
 * Pace measures the learner against a per-day linear target.
 *
 *   timeProgress       = daysElapsed / (totalWeeks * 7)
 *   expectedPointsNow  = timeProgress * journey max points
 *   delta%             = earned / expectedPointsNow - 1
 *
 * For a 6-week / 60,000-point journey the per-week ramp is:
 *   end of week 1 -> 10,000   week 4 -> 40,000
 *   end of week 2 -> 20,000   week 5 -> 50,000
 *   end of week 3 -> 30,000   week 6 -> 60,000
 *
 * Days 0-1 fall back to a "Just starting" label so a brand-new learner is not
 * flagged as 100% below pace on their first morning.
 */
function computeJourneyPace(params: {
  totalEarned: number
  journeyMax: number
  daysElapsed: number
  totalWeeks: number
}): PaceInfo {
  const { totalEarned, journeyMax, daysElapsed, totalWeeks } = params
  const totalDays = totalWeeks * 7

  if (journeyMax <= 0 || totalDays <= 0) {
    return { label: 'Just starting', detail: 'Tracking begins once your journey starts', tone: 'yellow' }
  }

  if (daysElapsed < 1) {
    return { label: 'Just starting', detail: 'Pace tracking starts after day 1', tone: 'yellow' }
  }

  const timeProgress = Math.min(1, daysElapsed / totalDays)
  const expectedPointsNow = timeProgress * journeyMax
  const deltaPct = expectedPointsNow > 0 ? Math.round((totalEarned / expectedPointsNow - 1) * 100) : 0

  if (deltaPct >= 5) {
    return { label: 'Ahead of pace', detail: `${Math.abs(deltaPct)}% above expected`, tone: 'green' }
  }
  if (deltaPct <= -10) {
    return { label: 'Behind pace', detail: `${Math.abs(deltaPct)}% below expected`, tone: 'red' }
  }
  return { label: 'On track', detail: 'Pace matches your journey timeline', tone: 'green' }
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

interface ProofUploadSlotProps {
  label: string
  helper: string
  resultsUrl?: string
  urlPlaceholder: string
  isSubmitting: boolean
  onUrlSave: (url: string) => void
}

const ProofUploadSlot = ({
  label,
  helper,
  resultsUrl,
  urlPlaceholder,
  isSubmitting,
  onUrlSave,
}: ProofUploadSlotProps) => {
  const hasProof = Boolean(resultsUrl)
  const [linkInput, setLinkInput] = useState(resultsUrl ?? '')
  useEffect(() => {
    setLinkInput(resultsUrl ?? '')
  }, [resultsUrl])
  return (
    <Box
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={hasProof ? 'green.300' : 'gray.300'}
      bg={hasProof ? 'green.50' : 'gray.50'}
      borderRadius="md"
      p={2}
    >
      <Stack spacing={1.5}>
        <HStack spacing={2} align="center">
          <Flex
            w={6}
            h={6}
            borderRadius="sm"
            bg={hasProof ? 'green.100' : 'white'}
            borderWidth="1px"
            borderColor={hasProof ? 'green.300' : 'gray.200'}
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Box
              as={hasProof ? CheckCircle2 : Upload}
              w={3}
              h={3}
              color={hasProof ? 'green.600' : 'gray.500'}
            />
          </Flex>
          <Stack spacing={0} flex={1} minW={0}>
            <Text fontSize="xs" fontWeight="semibold" color="gray.800" noOfLines={1}>
              {label}
            </Text>
            <Text fontSize="2xs" color="gray.500" noOfLines={1}>
              {hasProof ? 'Saved - update below' : helper}
            </Text>
          </Stack>
        </HStack>
        <HStack spacing={1.5}>
          <Input
            size="xs"
            bg="white"
            placeholder={urlPlaceholder}
            value={linkInput}
            onChange={(event) => setLinkInput(event.target.value)}
            fontSize="2xs"
          />
          <Button
            size="xs"
            variant={hasProof ? 'outline' : 'solid'}
            colorScheme={hasProof ? 'green' : 'purple'}
            onClick={() => onUrlSave(linkInput)}
            isLoading={isSubmitting}
            isDisabled={isSubmitting || linkInput.trim() === (resultsUrl ?? '').trim()}
            flexShrink={0}
            fontSize="2xs"
          >
            {hasProof ? 'Update' : 'Save'}
          </Button>
        </HStack>
      </Stack>
    </Box>
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

  const [orgCohortStartDate, setOrgCohortStartDate] = useState<string | null>(null)
  const [orgJourneyType, setOrgJourneyType] = useState<JourneyType | null>(null)

  const [submittingProof, setSubmittingProof] = useState<'personality' | 'values' | null>(null)
  const [proofError, setProofError] = useState<string | null>(null)

  const handleProofUrlSubmit = useCallback(
    async (kind: 'personality' | 'values', rawUrl: string) => {
      if (!profile?.id) {
        setProofError('You need to be signed in to save a link.')
        return
      }
      const trimmed = rawUrl.trim()
      if (!trimmed) {
        setProofError('Paste a link to save.')
        return
      }
      let parsed: URL
      try {
        parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
      } catch {
        setProofError('That does not look like a valid link.')
        return
      }
      const expectedHost = kind === 'personality' ? '16personalities.com' : 'personalvalu.es'
      if (!parsed.host.endsWith(expectedHost)) {
        setProofError(`Link should be from ${expectedHost}.`)
        return
      }
      setProofError(null)
      setSubmittingProof(kind)
      const urlField = kind === 'personality' ? 'personalityTestResultUrl' : 'valuesTestResultUrl'
      const completedFlag = kind === 'personality' ? 'hasCompletedPersonalityTest' : 'hasCompletedValuesTest'
      try {
        await updateDoc(doc(db, 'profiles', profile.id), {
          [urlField]: parsed.toString(),
          [completedFlag]: true,
          updatedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.error('[WeeklyGlance] profile update on url save failed', error)
        setProofError('Could not save the link. Please try again.')
        setSubmittingProof(null)
        return
      }
      void (async () => {
        try {
          if (!profile.companyId) return
          const orgSnapshot = await getDoc(doc(db, ORG_COLLECTION, profile.companyId))
          if (!orgSnapshot.exists()) return
          const orgData = orgSnapshot.data() as Record<string, unknown>
          const partnerId =
            (orgData.transformation_partner_id as string | null | undefined) ||
            (orgData.partnerId as string | null | undefined) ||
            null
          if (!partnerId) return
          const learnerName = profile.firstName || profile.fullName || profile.email || 'A learner'
          const testLabel = kind === 'personality' ? '16Personalities' : 'Personal Values'
          await addDoc(collection(db, 'notifications'), {
            user_id: partnerId,
            type: 'engagement_alert',
            title: `${learnerName} shared ${testLabel} results`,
            message: `${learnerName} shared their ${testLabel} results link. Open it from their profile to verify.`,
            metadata: {
              learnerId: profile.id,
              learnerName,
              kind,
              resultsUrl: parsed.toString(),
            },
            read: false,
            created_at: serverTimestamp(),
          })
        } catch (notifyError) {
          console.warn('[WeeklyGlance] partner notification failed (non-fatal)', notifyError)
        }
      })()
      toast({
        title: 'Link saved',
        description: 'Your partner has been notified to verify your results.',
        status: 'success',
        duration: 3500,
      })
      setSubmittingProof(null)
    },
    [profile?.id, profile?.companyId, profile?.firstName, profile?.fullName, profile?.email, toast],
  )

  useEffect(() => {
    if (!profile?.companyId) {
      setOrgCohortStartDate(null)
      setOrgJourneyType(null)
      return
    }
    let cancelled = false
    void getDoc(doc(db, ORG_COLLECTION, profile.companyId)).then((snap) => {
      if (cancelled || !snap.exists()) return
      const orgData = snap.data() as Record<string, unknown>
      const raw = orgData.cohortStartDate
      if (typeof raw === 'string') {
        setOrgCohortStartDate(raw)
      } else if (raw && typeof raw === 'object' && 'toDate' in raw && typeof (raw as { toDate?: () => Date }).toDate === 'function') {
        setOrgCohortStartDate((raw as { toDate: () => Date }).toDate().toISOString())
      }
      const resolved = resolveJourneyType(orgData) as JourneyType | undefined
      if (resolved) setOrgJourneyType(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.companyId])

  const effectiveJourneyType = (orgJourneyType ?? profile?.journeyType ?? '6W') as JourneyType
  const effectiveStartDate = orgCohortStartDate ?? profile?.journeyStartDate ?? null
  const effectiveDurationWeeks = JOURNEY_META[effectiveJourneyType]?.weeks ?? profile?.programDurationWeeks ?? 6

  const journeyTiming = useMemo(
    () => getJourneyTiming(effectiveStartDate, effectiveDurationWeeks),
    [effectiveStartDate, effectiveDurationWeeks]
  )

  const currentWeek = journeyTiming?.currentWeek ?? data.weekNumber
  const totalWeeks = effectiveDurationWeeks
  const daysRemaining = journeyTiming?.daysRemaining ?? 0
  const cycleNumber = Math.ceil(currentWeek / 2)
  const totalCycles = Math.max(1, Math.ceil(totalWeeks / 2))

  const journeyMax = JOURNEY_META[effectiveJourneyType]?.maxPossiblePoints ?? 0
  const passMark = JOURNEY_META[effectiveJourneyType]?.passMarkPoints ?? 0
  const totalEarned = useMemo(
    () => (data.ledgerEntries ?? []).reduce((sum, entry) => sum + (entry.points ?? 0), 0),
    [data.ledgerEntries],
  )
  const journeyProgress = journeyMax > 0 ? Math.min(100, Math.round((totalEarned / journeyMax) * 100)) : 0
  const daysElapsed = journeyTiming?.totalDaysElapsed ?? 0
  const pace = useMemo(
    () =>
      computeJourneyPace({
        totalEarned,
        journeyMax,
        daysElapsed,
        totalWeeks,
      }),
    [totalEarned, journeyMax, daysElapsed, totalWeeks],
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
            <Stack spacing={4} position="relative" zIndex={1}>
              <Flex
                justify="space-between"
                align={{ base: 'flex-start', md: 'center' }}
                direction={{ base: 'column', md: 'row' }}
                gap={4}
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
                      Upload proof of each test below, then click "Complete now" to fill in your results.
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

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <ProofUploadSlot
                  label="16Personalities result"
                  helper="Paste your shareable results link"
                  resultsUrl={profile?.personalityTestResultUrl}
                  urlPlaceholder="https://www.16personalities.com/profiles/..."
                  isSubmitting={submittingProof === 'personality'}
                  onUrlSave={(url) => void handleProofUrlSubmit('personality', url)}
                />
                <ProofUploadSlot
                  label="Personal Values result"
                  helper="Paste your shareable results link"
                  resultsUrl={profile?.valuesTestResultUrl}
                  urlPlaceholder="https://personalvalu.es/..."
                  isSubmitting={submittingProof === 'values'}
                  onUrlSave={(url) => void handleProofUrlSubmit('values', url)}
                />
              </SimpleGrid>

              {proofError && (
                <Text fontSize="xs" color="red.500">
                  {proofError}
                </Text>
              )}
            </Stack>
          </Box>
        )}

        {/* KPI Strip */}
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
          <Skeleton isLoaded={!data.loading.points} rounded="xl">
            <KpiTile
              label="Points earned"
              value={totalEarned.toLocaleString()}
              sub={`of ${passMark.toLocaleString()} pass mark`}
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
                    Journey progress
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    Week {currentWeek} of {totalWeeks} · Cycle {cycleNumber} of {totalCycles}
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
                      {journeyProgress}%
                    </Text>
                    <Text fontSize="md" color="gray.500" fontWeight="medium">
                      complete
                    </Text>
                  </Flex>

                  <Progress
                    value={journeyProgress}
                    size="sm"
                    rounded="full"
                    colorScheme={journeyProgress >= 100 ? 'green' : 'purple'}
                    bg="gray.100"
                  />
                </Stack>
              </Skeleton>
            </Stack>
        </Box>

        {/* Recent activity */}
        <SimpleGrid columns={1} spacing={6}>
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
