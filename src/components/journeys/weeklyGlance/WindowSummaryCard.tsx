import React from 'react';
import {
  Box,
  Card,
  CardBody,
  Divider,
  HStack,
  Icon,
  Progress,
  Stack,
  Text,
  VStack,
  Skeleton,
} from '@chakra-ui/react';
import { CalendarClock, Target, Flag } from 'lucide-react';
import { useWindowProgress } from '@/hooks/useWindowProgress';
import { WindowStatusBadge } from './WindowStatusBadge';
import { getWindowRange, PARALLEL_WINDOW_SIZE_WEEKS } from '@/utils/windowCalculations';

const statusMessages = {
  on_track: "You're pacing well",
  warning: "Slightly behind — still recoverable",
  alert: "Risk of falling behind",
  recovery: "Great job — you're back on track",
};

export const WindowSummaryCard: React.FC = () => {
  const { data, loading, error, windowNumber, totalWindows } = useWindowProgress();

  if (loading) {
    return (
      <Card h="100%" variant="outline" borderColor="border.subtle">
        <CardBody>
          <Stack spacing={4}>
            <Skeleton h="20px" w="150px" />
            <Skeleton h="40px" />
            <Skeleton h="20px" />
            <Divider />
            <Skeleton h="60px" />
          </Stack>
        </CardBody>
      </Card>
    );
  }

  if (error || !data) {
    return null; // Or show error state
  }

  const progressValue = Math.min(100, (data.pointsEarned / data.windowTarget) * 100);
  const { startWeek, endWeek } = getWindowRange(
    (windowNumber - 1) * PARALLEL_WINDOW_SIZE_WEEKS + 1,
    undefined,
    PARALLEL_WINDOW_SIZE_WEEKS
  );

  return (
    <Card h="100%" variant="outline" borderColor="border.subtle" boxShadow="sm">
      <CardBody>
        <Stack spacing={4}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Icon as={CalendarClock} color="brand.primary" />
              <Text fontWeight="bold">Window {windowNumber} of {totalWindows}</Text>
            </HStack>
            <WindowStatusBadge status={data.status} />
          </HStack>

          <Box>
            <Text fontSize="sm" color="text.secondary" mb={1}>
              Weeks {startWeek} - {endWeek} Progress
            </Text>
            <Progress
              value={progressValue}
              colorScheme={data.status === 'alert' ? 'red' : data.status === 'warning' ? 'yellow' : 'purple'}
              rounded="full"
              h={2}
            />
            <HStack justify="space-between" mt={2} fontSize="sm">
              <Text fontWeight="medium">{data.pointsEarned.toLocaleString()} pts earned</Text>
              <Text color="text.secondary">{data.windowTarget.toLocaleString()} target</Text>
            </HStack>
          </Box>

          <Box>
            <Text fontSize="xs" color="text.muted" fontStyle="italic">
              {statusMessages[data.status]}
            </Text>
          </Box>

          <Divider />

          <VStack align="stretch" spacing={3}>
            <HStack spacing={2}>
              <Icon as={Target} color="text.muted" boxSize={4} />
              <Text fontSize="sm" fontWeight="semibold">
                Window Focus
              </Text>
            </HStack>
            <Text fontSize="sm" color="text.secondary">
              Maintain consistency across both weeks to stay {data.status === 'on_track' ? 'on track' : 'aligned'} with your journey goals.
            </Text>
          </VStack>

          <Divider />

          <HStack spacing={2}>
            <Icon as={Flag} color="text.muted" boxSize={4} />
            <Box>
              <Text fontSize="xs" color="text.secondary">
                Next Window
              </Text>
              <Text fontSize="sm" fontWeight="semibold">
                Window {windowNumber + 1 > totalWindows ? totalWindows : windowNumber + 1}
              </Text>
            </Box>
          </HStack>
        </Stack>
      </CardBody>
    </Card>
  );
};
