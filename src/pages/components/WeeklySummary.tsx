import { useMemo } from 'react'
import {
  Box,
  Heading,
  HStack,
  Icon,
  Progress,
  SimpleGrid,
  Stack,
  Tag,
  Text,
} from '@chakra-ui/react'
import { AlertTriangle, CheckCircle, CalendarRange, Plus } from 'lucide-react'
import { StatCard } from './StatCard'
import { InfoPill } from './InfoPill'
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'

export interface JourneyUrgency {
  level: 'critical' | 'behind' | 'warning' | 'on_track'
  deficit: number
  journeyEnded: boolean
  pointsNeeded: number
  weeksLeft: number
  weeklyNeeded: number
}

export const WeeklySummary = ({
  week,
  completed,
  cyclePoints,
  cycleTarget,
  accumulatedPoints,
  passMarkPoints,
  journeyUrgency,
}: {
  week: number
  completed: number
  cyclePoints: number
  cycleTarget: number
  accumulatedPoints: number
  passMarkPoints?: number
  journeyUrgency?: JourneyUrgency | null
}) => {
  const windowNumber = useMemo(() => getWindowNumber(week, PARALLEL_WINDOW_SIZE_WEEKS), [week])

  const progressStatus = useMemo(() => {
    const pct = cycleTarget > 0 ? Math.min(100, Math.round((cyclePoints / cycleTarget) * 100)) : 0

    // If journey-level urgency says critical or behind, reflect that even if cycle looks okay
    if (journeyUrgency?.journeyEnded) {
      return { color: 'red', label: 'Journey ended', pct }
    }
    if (journeyUrgency?.level === 'critical') {
      return { color: 'red', label: 'Behind pace', pct }
    }
    if (journeyUrgency?.level === 'behind') {
      if (pct >= 100) return { color: 'orange', label: 'Catch-up needed', pct }
      return { color: 'orange', label: 'Falling behind', pct }
    }
    if (journeyUrgency?.level === 'warning') {
      if (pct >= 100) return { color: 'green', label: 'On track', pct }
      return { color: 'yellow', label: 'Needs attention', pct }
    }

    if (pct >= 100) return { color: 'green', label: 'On track', pct }
    if (pct >= 75) return { color: 'blue', label: 'Almost there', pct }
    return { color: 'orange', label: 'Needs attention', pct }
  }, [cyclePoints, cycleTarget, journeyUrgency])

  const passProgress = useMemo(() => {
    if (!passMarkPoints || passMarkPoints <= 0) return null
    const pct = Math.min(100, Math.round((accumulatedPoints / passMarkPoints) * 100))
    return { pct, label: `${accumulatedPoints.toLocaleString()} / ${passMarkPoints.toLocaleString()}` }
  }, [accumulatedPoints, passMarkPoints])

  const statusValue = useMemo(() => {
    if (journeyUrgency?.journeyEnded) return 'Ended'
    if (journeyUrgency?.level === 'critical') return 'At risk'
    if (journeyUrgency?.level === 'behind') return 'Behind'
    return progressStatus.label
  }, [journeyUrgency, progressStatus.label])

  const statusBorderColor = useMemo(() => {
    if (journeyUrgency?.level === 'critical') return 'red.400'
    if (journeyUrgency?.level === 'behind') return 'orange.400'
    return 'orange.300'
  }, [journeyUrgency])

  return (
    <Box
      p={4}
      borderWidth="1px"
      borderStyle="solid"
      borderColor={journeyUrgency?.level === 'critical' ? 'red.300' : journeyUrgency?.level === 'behind' ? 'orange.300' : 'blue.200'}
      bg={journeyUrgency?.level === 'critical' ? 'red.50' : 'white'}
      borderRadius="lg"
      boxShadow="md"
    >
      <Stack spacing={3}>
        <HStack justify="space-between">
          <HStack spacing={2}>
            {journeyUrgency && journeyUrgency.level !== 'on_track' && (
              <Icon as={AlertTriangle} color={journeyUrgency.level === 'critical' ? 'red.500' : 'orange.500'} boxSize={4} />
            )}
            <Heading size="sm" color="text.primary">
              Cycle {windowNumber} summary
            </Heading>
          </HStack>
          <Tag colorScheme={progressStatus.color}>
            {progressStatus.label} | {progressStatus.pct}%
          </Tag>
        </HStack>
        <Progress value={progressStatus.pct} colorScheme={progressStatus.color} borderRadius="full" />

        {/* Journey-level deficit callout */}
        {journeyUrgency && journeyUrgency.level !== 'on_track' && !journeyUrgency.journeyEnded && (
          <HStack spacing={2} bg={journeyUrgency.level === 'critical' ? 'red.100' : 'orange.100'} px={3} py={2} borderRadius="md">
            <Icon as={AlertTriangle} color={journeyUrgency.level === 'critical' ? 'red.600' : 'orange.600'} boxSize={4} />
            <Text fontSize="xs" color={journeyUrgency.level === 'critical' ? 'red.800' : 'orange.800'} fontWeight="medium">
              {journeyUrgency.deficit.toLocaleString()} points behind expected pace
              {journeyUrgency.weeksLeft > 0 && ` — need ~${journeyUrgency.weeklyNeeded.toLocaleString()} pts/week across ${journeyUrgency.weeksLeft} remaining week${journeyUrgency.weeksLeft === 1 ? '' : 's'}`}
            </Text>
          </HStack>
        )}
        {journeyUrgency?.journeyEnded && (
          <HStack spacing={2} bg="red.100" px={3} py={2} borderRadius="md">
            <Icon as={AlertTriangle} color="red.600" boxSize={4} />
            <Text fontSize="xs" color="red.800" fontWeight="medium">
              Journey has ended — {journeyUrgency.pointsNeeded.toLocaleString()} points short of the pass mark
            </Text>
          </HStack>
        )}

        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
          <StatCard
            label="Activities completed"
            value={`${completed}`}
            icon={<Icon as={CheckCircle} color="success.400" />}
            borderColor="green.300"
          />
          <StatCard
            label="Points accumulated (total)"
            value={passProgress ? passProgress.label : accumulatedPoints.toLocaleString()}
            icon={<Icon as={Plus} color="orange.400" />}
            borderColor={journeyUrgency?.level === 'critical' ? 'red.300' : 'purple.300'}
          />
          <StatCard
            label={`Cycle ${windowNumber}`}
            value={`${cyclePoints.toLocaleString()} / ${cycleTarget.toLocaleString()}`}
            icon={<Icon as={CalendarRange} color="purple.400" />}
            borderColor="blue.300"
          />
          <StatCard
            label="Status"
            value={statusValue}
            icon={<InfoPill color={progressStatus.color} />}
            borderColor={statusBorderColor}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  )
}
