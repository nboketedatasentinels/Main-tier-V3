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
      bg="white"
      borderWidth="1px"
      borderColor="teal.400"
      borderRadius="xl"
      _hover={{ shadow: 'md', cursor: onNavigate ? 'pointer' : 'default', transform: 'translateY(-2px)' }}
      transition="all 0.2s"
      onClick={onNavigate}
    >
      <CardBody p={5}>
        <Stack spacing={5}>
          {/* Header */}
          <HStack justify="space-between" align="center">
            <HStack spacing={2}>
              <Icon as={Target} color="teal.500" boxSize={5} />
              <Text fontWeight="semibold" fontSize="md" color="gray.800" fontFamily="heading">Points Accumulated</Text>
            </HStack>
            {displayStatus && (
              <Badge
                colorScheme={statusColor}
                fontSize="xs"
                px={3}
                py={1}
                borderRadius="full"
                fontFamily="body"
              >
                {displayStatus.replace('_', ' ')}
              </Badge>
            )}
          </HStack>

          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={4}>
              {/* Main Stats */}
              <Box bg="gray.50" rounded="lg" p={4}>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">Cycle Target</Text>
                    <Text fontWeight="bold" fontSize="xl" color="gray.800">{cycleTargetPoints.toLocaleString()} pts</Text>
                  </HStack>
                  <Progress colorScheme="teal" value={progress} height="8px" rounded="full" />
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">Accumulated</Text>
                    <Text fontWeight="semibold" color="teal.600">{cyclePointsAccumulated.toLocaleString()} pts</Text>
                  </HStack>
                </VStack>
              </Box>

              {/* Delta Status */}
              {(windowProgress || data) && (
                <HStack
                  spacing={2}
                  p={3}
                  bg={pointDelta >= 0 ? 'green.50' : 'orange.50'}
                  rounded="md"
                  borderLeftWidth="3px"
                  borderLeftColor={pointDelta >= 0 ? 'green.400' : 'orange.400'}
                >
                  <Icon as={TrendingUp} boxSize={4} color={pointDelta >= 0 ? 'green.500' : 'orange.500'} />
                  <Text fontSize="sm" fontWeight="medium" color={pointDelta >= 0 ? 'green.700' : 'orange.700'}>
                    {deltaLabel}
                  </Text>
                </HStack>
              )}

              {/* Footer Stats */}
              <HStack justify="space-between" pt={2}>
                <HStack spacing={2}>
                  <Icon as={Users} boxSize={4} color="gray.400" />
                  <Text fontSize="sm" color="gray.600">{data?.engagement_count || 0} engagements</Text>
                </HStack>
                <HStack spacing={2}>
                  <Icon as={Clock3} boxSize={4} color="gray.400" />
                  <Text fontSize="sm" color="gray.600">{daysRemainingInCycle} days left</Text>
                </HStack>
              </HStack>
            </Stack>
          </Skeleton>

          {error && (
            <HStack color="red.500" fontSize="sm" p={3} bg="red.50" rounded="md">
              <Icon as={AlertCircle} />
              <Text>Unable to load points summary.</Text>
            </HStack>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}
