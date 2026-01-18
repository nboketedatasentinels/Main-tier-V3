import {
  Badge,
  Button,
  Card,
  CardBody,
  HStack,
  Icon,
  Progress,
  Skeleton,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { MouseEventHandler } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Clock3, Target, Users } from 'lucide-react'
import { calculateWeekProgress, getDaysRemainingInWeek } from '@/utils/weekCalculations'
import { WeeklyPoints } from '@/hooks/useWeeklyGlanceData'

interface WeeklyPointsCardProps {
  data: WeeklyPoints | null
  loading: boolean
  error?: Error
  onNavigate?: MouseEventHandler<HTMLDivElement>
  onRetry?: () => void
}

const statusColorMap: Record<string, string> = {
  on_track: 'green',
  warning: 'yellow',
  at_risk: 'red',
}

const statusIconMap: Record<string, typeof CheckCircle> = {
  on_track: CheckCircle,
  warning: AlertTriangle,
  at_risk: AlertCircle,
}

export const WeeklyPointsCard = ({ data, loading, error, onNavigate, onRetry }: WeeklyPointsCardProps) => {
  const progress = calculateWeekProgress(data?.points_earned || 0, data?.target_points || 0)
  const daysRemaining = getDaysRemainingInWeek()
  const statusColor = data?.status ? statusColorMap[data.status] || 'gray' : 'gray'
  const StatusIcon = data?.status ? statusIconMap[data.status] : null

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
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack>
              <Icon as={Target} color="brand.primary" />
              <Text fontWeight="bold" color="text.primary">Weekly Points</Text>
            </HStack>
            {data?.status && StatusIcon && (
              <Badge colorScheme={statusColor} variant="subtle">
                <HStack spacing={1}>
                  <Icon as={StatusIcon} boxSize={3} />
                  <Text>{data.status.replace('_', ' ')}</Text>
                </HStack>
              </Badge>
            )}
          </HStack>

          <Skeleton isLoaded={!loading} rounded="md">
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text fontSize="xs" color="text.secondary">
                  Target
                </Text>
                <Text fontWeight="bold" color="text.primary">{data ? `${data.target_points || 0} pts` : '--'}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="xs" color="text.secondary">
                  Earned
                </Text>
                <Text color="text.primary">{data ? `${data.points_earned || 0} pts` : '--'}</Text>
              </HStack>
              <Progress colorScheme="brand" value={progress} height="8px" rounded="full" />
              <HStack justify="space-between">
                <HStack spacing={1}>
                  <Icon as={Users} boxSize={4} color="text.secondary" />
                  <Text fontSize="sm" color="text.secondary">
                    {data?.engagement_count || 0} engagements
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
            <Stack spacing={2}>
              <HStack color="text.primary" fontSize="sm">
                <Icon as={AlertCircle} />
                <Text>Unable to load weekly points.</Text>
              </HStack>
              {onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry} width="full">
                  Retry
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}
