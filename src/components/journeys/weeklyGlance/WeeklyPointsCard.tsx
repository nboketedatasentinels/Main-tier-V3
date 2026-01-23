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

interface WeeklyPointsCardProps {
  data: WeeklyPoints | null
  loading: boolean
  error?: Error
  onNavigate?: MouseEventHandler<HTMLDivElement>
}

const statusColorMap: Record<string, string> = {
  on_track: 'green',
  warning: 'yellow',
  at_risk: 'red',
}

export const WeeklyPointsCard = ({ data, loading, error, onNavigate }: WeeklyPointsCardProps) => {
  const progress = calculateWeekProgress(data?.points_earned || 0, data?.target_points || 0)
  const daysRemaining = getDaysRemainingInWeek()
  const statusColor = data?.status ? statusColorMap[data.status] || 'gray' : 'gray'
  const targetPoints = data?.target_points || 0
  const earnedPoints = data?.points_earned || 0
  const pointDelta = earnedPoints - targetPoints
  const deltaLabel =
    pointDelta >= 0
      ? `${pointDelta.toLocaleString()} pts ahead of target`
      : `${Math.abs(pointDelta).toLocaleString()} pts to reach target`

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
              <Text fontWeight="bold" fontSize="md" color="#273240">Weekly Points</Text>
            </HStack>
            {data?.status && (
              <Badge colorScheme={statusColor} variant="subtle">
                {data.status.replace('_', ' ')}
              </Badge>
            )}
          </HStack>

          <Skeleton isLoaded={!loading} rounded="md">
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text fontSize="xs" color="text.secondary">
                  Target
                </Text>
                <Text fontWeight="bold" color="#273240">{data ? `${targetPoints} pts` : '--'}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="xs" color="text.secondary">
                  Earned
                </Text>
                <Text color="#273240">{data ? `${earnedPoints} pts` : '--'}</Text>
              </HStack>
              <Progress colorScheme="brand" value={progress} height="8px" rounded="full" />
              {data && (
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
                    {data?.engagement_count || 0} engagements (check-ins & actions)
                  </Text>
                </HStack>
                <HStack spacing={1}>
                  <Icon as={Clock3} boxSize={4} color="text.secondary" />
                  <Text fontSize="sm" color="text.secondary">
                    {daysRemaining} days left
                  </Text>
                </HStack>
              </HStack>
            </VStack>
          </Skeleton>

          {error && (
            <HStack color="#273240" fontSize="sm">
              <Icon as={AlertCircle} />
              <Text>Unable to load weekly points.</Text>
            </HStack>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}
