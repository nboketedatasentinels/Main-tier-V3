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
import { getWindowNumber } from '@/utils/windowCalculations'

export const WeeklySummary = ({
  week,
  completed,
  earned,
  target,
}: {
  week: number
  completed: number
  earned: number
  target: number
}) => {
  const windowNumber = useMemo(() => getWindowNumber(week), [week])

  const progressStatus = useMemo(() => {
    const pct = target > 0 ? Math.min(100, Math.round((earned / target) * 100)) : 0
    if (pct >= 100) return { color: 'green', label: 'On Track', pct }
    if (pct >= 75) return { color: 'yellow', label: 'Warning', pct }
    return { color: 'red', label: 'Alert', pct }
  }, [earned, target])

  return (
    <Box p={4} borderWidth="1px" borderColor="gray.700" bg="white" borderRadius="lg">
      <Stack spacing={3}>
        <HStack justify="space-between">
          <Heading size="sm" color="text.primary">
            Week {week} summary · Window {windowNumber}
          </Heading>
          <Tag colorScheme={progressStatus.color}>
            {progressStatus.label} • {progressStatus.pct}%
          </Tag>
        </HStack>
        <Progress value={progressStatus.pct} colorScheme={progressStatus.color} borderRadius="full" />
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
          <StatCard
            label="Activities completed"
            value={`${completed}`}
            icon={<Icon as={CheckCircle} color="success.400" />}
          />
          <StatCard
            label="Weekly points"
            value={`${earned} / ${target}`}
            icon={<Icon as={Plus} color="orange.400" />}
          />
          <StatCard
            label={`Window ${windowNumber} context`}
            value="View Details"
            icon={<Icon as={CalendarRange} color="purple.400" />}
          />
          <StatCard
            label="Status"
            value={progressStatus.label}
            icon={<InfoPill color={progressStatus.color} />}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  )
}
