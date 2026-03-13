import React, { useEffect, useState, useRef } from 'react'
import { Badge, Box, HStack, Progress, Skeleton, Stack, Stat, StatHelpText, StatLabel, StatNumber, Text, VStack, Icon } from '@chakra-ui/react'
import { Award, TrendingUp } from 'lucide-react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { getUserJourney, getCurrentWindowId, type UserJourney } from '@/services/userJourneyService'
import { backfillImpactLogPointsForUser, type PointsTransaction } from '@/services/pointsTransactionService'

type DashboardStatus = 'ON_TRACK' | 'WARNING' | 'ALERT'

const statusColorMap: Record<DashboardStatus, string> = {
  ON_TRACK: 'green',
  WARNING: 'yellow',
  ALERT: 'red',
}

const getStatusFromProgress = (ratio: number): DashboardStatus => {
  if (ratio >= 0.8) return 'ON_TRACK'
  if (ratio >= 0.5) return 'WARNING'
  return 'ALERT'
}

interface PointsDashboardProps {
  variant?: 'full' | 'compact'
}

const PointsDashboard: React.FC<PointsDashboardProps> = ({ variant = 'full' }) => {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [journey, setJourney] = useState<UserJourney | null>(null)
  const [totalPoints, setTotalPoints] = useState(0)
  const [windowPoints, setWindowPoints] = useState(0)
  const [impactLogPoints, setImpactLogPoints] = useState(0)
  const backfillRanRef = useRef(false)

  useEffect(() => {
    if (!user?.uid) return

    let isActive = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // 1. Ensure user journey exists (creates from profile if missing)
        const j = await getUserJourney(user.uid)
        if (!isActive) return

        // 2. Run one-time backfill for existing impact log entries that have no points_transaction
        if (!backfillRanRef.current) {
          backfillRanRef.current = true
          try {
            const result = await backfillImpactLogPointsForUser(user.uid)
            if (result.created > 0 && isActive) {
              // Refetch transactions after backfill so totals are correct
              const txSnapAfter = await getDocs(
                query(collection(db, 'points_transactions'), where('userId', '==', user.uid)),
              )
              const txAfter = txSnapAfter.docs.map((d) => d.data() as PointsTransaction)
              const totalAfter = txAfter.reduce((sum, t) => sum + (t.pointsAwarded || 0), 0)
              const windowIdAfter = getCurrentWindowId(j)
              const windowTotalAfter = txAfter
                .filter((t) => t.windowId === windowIdAfter)
                .reduce((sum, t) => sum + (t.pointsAwarded || 0), 0)
              const impactTotalAfter = txAfter
                .filter((t) => t.sourceType === 'impact_log_entry')
                .reduce((sum, t) => sum + (t.pointsAwarded || 0), 0)
              setTotalPoints(totalAfter)
              setWindowPoints(windowTotalAfter)
              setImpactLogPoints(impactTotalAfter)
              setJourney(j)
              setLoading(false)
              return
            }
          } catch (backfillErr) {
            if (import.meta.env.DEV) {
              console.warn('[PointsDashboard] Backfill failed (non-blocking)', backfillErr)
            }
          }
        }

        // 3. Load points_transactions and compute totals
        const txSnap = await getDocs(
          query(collection(db, 'points_transactions'), where('userId', '==', user.uid)),
        )

        const transactions = txSnap.docs.map((d) => d.data() as PointsTransaction)
        const total = transactions.reduce((sum, t) => sum + (t.pointsAwarded || 0), 0)
        const windowId = getCurrentWindowId(j)
        const windowTotal = transactions
          .filter((t) => t.windowId === windowId)
          .reduce((sum, t) => sum + (t.pointsAwarded || 0), 0)
        const impactTotal = transactions.reduce((sum, t) => {
          const src = (t.sourceType || 'impact_log_entry').toString()
          return src === 'impact_log_entry' || src === 'impact_log' ? sum + (t.pointsAwarded || 0) : sum
        }, 0)

        setJourney(j)
        setTotalPoints(total)
        setWindowPoints(windowTotal)
        setImpactLogPoints(impactTotal)
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[PointsDashboard] Failed to load points summary', err)
        }
        if (isActive) {
          setError('Unable to load live points summary; showing profile totals instead.')
          // Fallback: show profile totalPoints so user sees something consistent
          const fallbackPoints = typeof profile?.totalPoints === 'number' ? profile.totalPoints : 0
          setTotalPoints(fallbackPoints)
          setWindowPoints(fallbackPoints)
          setImpactLogPoints(fallbackPoints)
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [user?.uid, profile?.totalPoints])

  if (!user) return null

  const windowTarget = journey?.windowTarget ?? 12500
  const ratio = windowTarget > 0 ? Math.min(1, windowPoints / windowTarget) : 0
  const status: DashboardStatus = getStatusFromProgress(ratio)
  const statusColor = statusColorMap[status]
  const displayBadges = journey?.badges ?? []

  if (variant === 'compact') {
    return (
      <Stat
        p={4}
        bg="surface.default"
        boxShadow="md"
        rounded="lg"
        border="1px solid"
        borderColor="purple.500"
        textAlign="center"
      >
        <HStack justify="center" mb={2} spacing={2}>
          <StatLabel color="text.secondary">Points Earned</StatLabel>
          <Badge colorScheme={statusColor} variant="subtle">
            {status === 'ON_TRACK' ? 'On Track' : status === 'WARNING' ? 'Warning' : 'Alert'}
          </Badge>
        </HStack>
        <StatNumber color="text.primary" fontSize="xl">
          {totalPoints.toLocaleString()} pts
        </StatNumber>
        <StatHelpText>
          {windowPoints.toLocaleString()} pts this window · Target {windowTarget.toLocaleString()} pts
        </StatHelpText>
        <Box mt={3}>
          <Progress value={ratio * 100} colorScheme="brand" rounded="full" h="6px" />
        </Box>
      </Stat>
    )
  }

  return (
    <Box
      bg="surface.default"
      border="1px solid"
      borderColor="border.subtle"
      rounded="lg"
      p={4}
      shadow="xs"
    >
      <Stack spacing={4}>
        <HStack justify="space-between">
          <Stat>
            <StatLabel>Points Earned</StatLabel>
            <Skeleton isLoaded={!loading}>
              <StatNumber>{totalPoints.toLocaleString()} pts</StatNumber>
            </Skeleton>
            <StatHelpText>Total engagement points across your journey</StatHelpText>
          </Stat>
          <Badge colorScheme={statusColor} alignSelf="flex-start">
            {status === 'ON_TRACK' ? 'On Track' : status === 'WARNING' ? 'Warning' : 'Alert'}
          </Badge>
        </HStack>

        <Skeleton isLoaded={!loading}>
          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <Text fontSize="sm" color="text.secondary">
                Current window target
              </Text>
              <Text fontWeight="semibold" color="text.primary">
                {windowTarget.toLocaleString()} pts
              </Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="sm" color="text.secondary">
                Points this window
              </Text>
              <Text fontWeight="semibold" color="text.primary">
                {windowPoints.toLocaleString()} pts
              </Text>
            </HStack>
          </VStack>
        </Skeleton>

        <Skeleton isLoaded={!loading}>
          <HStack spacing={2}>
            <Icon as={TrendingUp} boxSize={4} color="text.secondary" />
            <Text fontSize="sm" color="text.secondary">
              {impactLogPoints.toLocaleString()} pts from Impact Log entries
            </Text>
          </HStack>
        </Skeleton>

        {displayBadges.length > 0 && (
          <Skeleton isLoaded={!loading}>
            <HStack spacing={2} flexWrap="wrap">
              <Icon as={Award} boxSize={4} color="yellow.500" />
              {displayBadges.map((badge) => (
                <Badge key={badge} colorScheme="purple" variant="subtle">
                  {badge}
                </Badge>
              ))}
            </HStack>
          </Skeleton>
        )}

        {error && (
          <Text fontSize="sm" color="red.500">
            {error}
          </Text>
        )}

        <Skeleton isLoaded={!loading}>
          <Progress value={ratio * 100} colorScheme="brand" rounded="full" h="8px" />
        </Skeleton>
      </Stack>
    </Box>
  )
}

export default PointsDashboard

