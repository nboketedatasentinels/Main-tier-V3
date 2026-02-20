import {
  Badge,
  Card,
  CardBody,
  HStack,
  Icon,
  Progress,
  Skeleton,
  Stack,
  Text,
  VStack,
  Box,
} from '@chakra-ui/react'
import { MouseEventHandler } from 'react'
import { AlertCircle, Clock3, Target, TrendingUp, Users } from 'lucide-react'
import { calculateWeekProgress, getDaysRemainingInWeek } from '@/utils/weekCalculations'
import { WeeklyPoints } from '@/hooks/useWeeklyGlanceData'
import { useWindowProgress } from '@/hooks/useWindowProgress'

interface WeeklyPointsCardProps {
  data: WeeklyPoints | null
  loading: boolean
  error?: Error
  onNavigate?: MouseEventHandler<HTMLDivElement>
}

const statusColorMap: Record<string, string> = {
  on_track: 'green',
  warning: 'yellow',
  alert: 'red',
  recovery: 'green',
  at_risk: 'red',
}

export const WeeklyPointsCard = ({ data, loading, error, onNavigate }: WeeklyPointsCardProps) => {
  const { data: windowProgress, windowWeek } = useWindowProgress()
  const fallbackWeeklyProgress = calculateWeekProgress(data?.points_earned || 0, data?.target_points || 0)
  const cycleTargetPoints = windowProgress?.windowTarget ?? (data?.target_points || 0) * 2
  const cyclePointsAccumulated = windowProgress?.pointsEarned ?? data?.points_earned ?? 0
  const progress =
    cycleTargetPoints > 0
      ? Math.min(100, Math.round((cyclePointsAccumulated / cycleTargetPoints) * 100))
      : fallbackWeeklyProgress
  const daysRemainingThisWeek = getDaysRemainingInWeek()
  const daysRemainingInCycle = windowWeek === 1 ? daysRemainingThisWeek + 7 : daysRemainingThisWeek
  const displayStatus = windowProgress?.status ?? data?.status
  const statusColor = displayStatus ? statusColorMap[displayStatus] || 'gray' : 'gray'
  const pointDelta = cyclePointsAccumulated - cycleTargetPoints
  const deltaLabel =
    pointDelta >= 0
      ? `${pointDelta.toLocaleString()} pts ahead of cycle target`
      : `${Math.abs(pointDelta).toLocaleString()} pts to reach cycle target`

  return (
    <Card
      h="100%"
      bg="surface.default"
      borderColor="border.subtle"
      variant="outline"
      _hover={{ shadow: 'sm', cursor: onNavigate ? 'pointer' : 'default', transform: 'translateY(-2px)' }}
      transition="all 0.2s"
      onClick={onNavigate}
    >
      <CardBody p={6}>
        <Stack spacing={4}>
          <HStack justify="space-between">
            <HStack>
              <Icon as={Target} color="brand.primary" />
              <Text fontWeight="bold" fontSize="md" color="text.primary">Points Accumulated</Text>
            </HStack>
            {displayStatus && (
              <Badge colorScheme={statusColor} variant="subtle">
                {displayStatus.replace('_', ' ')}
              </Badge>
            )}
          </HStack>

          <Skeleton isLoaded={!loading} rounded="md">
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text fontSize="xs" color="text.secondary">
                  2-week cycle target
                </Text>
                <Text fontWeight="bold" color="text.primary">{`${cycleTargetPoints.toLocaleString()} pts`}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="xs" color="text.secondary">
                  Points accumulated this cycle
                </Text>
                <Text color="text.primary">{`${cyclePointsAccumulated.toLocaleString()} pts`}</Text>
              </HStack>
              <Progress colorScheme="brand" value={progress} height="8px" rounded="full" />
              {(windowProgress || data) && (
                <HStack spacing={2} color={pointDelta >= 0 ? 'green.600' : 'orange.500'}>
                  <Icon as={TrendingUp} boxSize={4} />
                  <Text fontSize="sm">{deltaLabel}</Text>
                </HStack>
              )}
              <HStack spacing={2}>
                <Box flex={1} h="2px" bg="border.subtle" />
              </HStack>
              <HStack justify="space-between">
                <HStack spacing={1}>
                  <Icon as={Users} boxSize={4} color="text.secondary" />
                  <Text fontSize="sm" color="text.secondary">
                    {data?.engagement_count || 0} engagements logged this week
                  </Text>
                </HStack>
                <HStack spacing={1}>
                  <Icon as={Clock3} boxSize={4} color="text.secondary" />
                  <Text fontSize="sm" color="text.secondary">
                    {daysRemainingInCycle} days left in cycle
                  </Text>
                </HStack>
              </HStack>
            </VStack>
          </Skeleton>

          {error && (
            <HStack color="text.primary" fontSize="sm">
              <Icon as={AlertCircle} />
              <Text>Unable to load points summary.</Text>
            </HStack>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}
