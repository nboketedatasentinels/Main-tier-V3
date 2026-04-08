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
} from '@chakra-ui/react'
import { CheckCircle, CalendarRange, Plus } from 'lucide-react'
import { StatCard } from './StatCard'
import { InfoPill } from './InfoPill'
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations'

export const WeeklySummary = ({
  week,
  completed,
  cyclePoints,
  cycleTarget,
  accumulatedPoints,
}: {
  week: number
  completed: number
  cyclePoints: number
  cycleTarget: number
  accumulatedPoints: number
}) => {
  const windowNumber = useMemo(() => getWindowNumber(week, PARALLEL_WINDOW_SIZE_WEEKS), [week])

  const progressStatus = useMemo(() => {
    const pct = cycleTarget > 0 ? Math.min(100, Math.round((cyclePoints / cycleTarget) * 100)) : 0
    if (pct >= 100) return { color: 'green', label: 'On track', pct }
    if (pct >= 75) return { color: 'blue', label: 'Almost there', pct }
    return { color: 'orange', label: 'Needs attention', pct }
  }, [cyclePoints, cycleTarget])

  return (
    <Box p={4} borderWidth="1px" borderStyle="solid" borderColor="blue.200" bg="white" borderRadius="lg" boxShadow="md">
      <Stack spacing={3}>
        <HStack justify="space-between">
          <Heading size="sm" color="text.primary">
            Cycle {windowNumber} summary
          </Heading>
          <Tag colorScheme={progressStatus.color}>
            {progressStatus.label} | {progressStatus.pct}%
          </Tag>
        </HStack>
        <Progress value={progressStatus.pct} colorScheme={progressStatus.color} borderRadius="full" />
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
          <StatCard
            label="Activities completed"
            value={`${completed}`}
            icon={<Icon as={CheckCircle} color="success.400" />}
            borderColor="green.300"
          />
          <StatCard
            label="Points accumulated (total)"
            value={accumulatedPoints.toLocaleString()}
            icon={<Icon as={Plus} color="orange.400" />}
            borderColor="purple.300"
          />
          <StatCard
            label={`Cycle ${windowNumber}`}
            value={`${cyclePoints.toLocaleString()} / ${cycleTarget.toLocaleString()}`}
            icon={<Icon as={CalendarRange} color="purple.400" />}
            borderColor="blue.300"
          />
          <StatCard
            label="Status"
            value={progressStatus.label}
            icon={<InfoPill color={progressStatus.color} />}
            borderColor="orange.300"
          />
        </SimpleGrid>
      </Stack>
    </Box>
  )
}
