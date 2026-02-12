import React from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
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
import { getDaysRemainingInWeek } from '@/utils/weekCalculations';

type BackendWindowStatus = 'on_track' | 'warning' | 'alert' | 'recovery';
type DisplayWindowStatus = 'ahead' | 'on_track' | 'catching_up' | 'behind';

const progressColorByStatus: Record<DisplayWindowStatus, string> = {
  ahead: 'green',
  on_track: 'teal',
  catching_up: 'yellow',
  behind: 'red',
};

const getDisplayStatus = (
  status: BackendWindowStatus,
  ratio: number,
  isFreshStartWeek: boolean,
  pointsEarned: number
): DisplayWindowStatus => {
  if (ratio > 1) {
    return 'ahead';
  }

  if (isFreshStartWeek && pointsEarned === 0) {
    return 'on_track';
  }

  if (status === 'alert' || ratio < 0.75) {
    return 'behind';
  }

  if (status === 'warning' || status === 'recovery') {
    return 'catching_up';
  }

  return 'on_track';
};

const getPeakEndMessage = (
  status: DisplayWindowStatus,
  remainingPoints: number,
  daysRemainingInWindow: number
): string => {
  if (status === 'ahead') {
    return 'Peak reached. End this window with one more contribution to lock in momentum.';
  }

  if (status === 'on_track') {
    return 'Steady pace. Finish strong with one more activity before the window closes.';
  }

  if (status === 'catching_up') {
    return 'Momentum is improving. Keep pressing now so the window ends on target.';
  }

  const dayText = daysRemainingInWindow === 1 ? 'day' : 'days';
  return `Current gap: ${remainingPoints.toLocaleString()} points with ${daysRemainingInWindow} ${dayText} remaining.`;
};

interface WindowSummaryCardProps {
  onNavigate?: () => void;
}

export const WindowSummaryCard: React.FC<WindowSummaryCardProps> = ({ onNavigate }) => {
  const { data, loading, error, windowWeek, windowNumber, totalWindows } = useWindowProgress();
  const daysRemainingThisWeek = getDaysRemainingInWeek();
  const daysRemainingInWindow = Math.max(
    0,
    (windowWeek === 1 ? 7 : 0) + daysRemainingThisWeek
  );

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
    return (
      <Card h="100%" variant="outline" borderColor="border.subtle">
        <CardBody>
          <Stack spacing={3}>
            <HStack spacing={2}>
              <Icon as={CalendarClock} color="brand.primary" />
              <Text fontWeight="bold">Learner Window</Text>
            </HStack>
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <Text fontSize="sm">
                Window progress is temporarily unavailable. You can still continue earning points.
              </Text>
            </Alert>
            {onNavigate && (
              <Button size="sm" colorScheme="purple" alignSelf="flex-start" onClick={onNavigate}>
                Review weekly checklist
              </Button>
            )}
          </Stack>
        </CardBody>
      </Card>
    );
  }

  const progressRatio = data.windowTarget > 0 ? data.pointsEarned / data.windowTarget : 0;
  const progressValue = Math.min(100, Math.max(0, progressRatio * 100));
  const remainingPoints = Math.max(0, data.windowTarget - data.pointsEarned);
  const isFreshStartWeek = windowWeek === 1;
  const isFinalWindow = windowNumber >= totalWindows;
  const displayStatus = getDisplayStatus(data.status, progressRatio, isFreshStartWeek, data.pointsEarned);
  const pointsNeededPerDay =
    remainingPoints > 0 && daysRemainingInWindow > 0
      ? Math.ceil(remainingPoints / daysRemainingInWindow)
      : 0;

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
            <WindowStatusBadge status={displayStatus} />
          </HStack>

          <Box>
            <Text fontSize="sm" color="text.secondary" mb={1}>
              Weeks {startWeek} - {endWeek} Progress
            </Text>
            <Progress
              value={progressValue}
              colorScheme={progressColorByStatus[displayStatus]}
              rounded="full"
              h={2}
            />
            <HStack justify="space-between" mt={2} fontSize="sm">
              <Text fontWeight="medium">{data.pointsEarned.toLocaleString()} pts earned</Text>
              <Text color="text.secondary">
                {remainingPoints > 0
                  ? `${remainingPoints.toLocaleString()} pts to window target`
                  : displayStatus === 'ahead'
                    ? `${(data.pointsEarned - data.windowTarget).toLocaleString()} pts above target`
                    : 'Target reached - finish strong'}
              </Text>
            </HStack>
            <HStack justify="space-between" mt={1} fontSize="xs" color="text.muted">
              <Text>{data.windowTarget.toLocaleString()} pts target</Text>
              <Text>{daysRemainingInWindow} day{daysRemainingInWindow === 1 ? '' : 's'} left in this window</Text>
            </HStack>
            {remainingPoints > 0 ? (
              <Text mt={1} fontSize="xs" color={displayStatus === 'behind' ? 'red.600' : 'text.muted'}>
                {daysRemainingInWindow > 0
                  ? `${pointsNeededPerDay.toLocaleString()} pts/day needed to close the gap.`
                  : `Window closed with a ${remainingPoints.toLocaleString()} pt gap. Reset and plan your next window.`}
              </Text>
            ) : (
              <Text mt={1} fontSize="xs" color="green.600">
                {displayStatus === 'ahead'
                  ? 'You are above target. Protect this lead through the window close.'
                  : 'Target secured. Add one more activity for a strong finish.'}
              </Text>
            )}
          </Box>

          <Box>
            <Text fontSize="sm" fontWeight="medium" color={displayStatus === 'behind' ? 'red.700' : 'text.secondary'}>
              {getPeakEndMessage(displayStatus, remainingPoints, daysRemainingInWindow)}
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
              {isFreshStartWeek && data.pointsEarned === 0
                ? 'Fresh start week. Complete one activity now to build momentum early.'
                : displayStatus === 'ahead'
                  ? 'You are ahead. Keep a steady cadence to preserve your lead at the end of this window.'
                : displayStatus === 'on_track'
                    ? 'You are on track. Stay consistent to close this window with confidence.'
                    : displayStatus === 'catching_up'
                      ? 'You are catching up. Prioritize high-value activities to close the gap quickly.'
                      : 'You are behind target right now. Focus on your next available activity to reduce the gap.'}
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
                {isFinalWindow ? 'Final window in journey' : `Window ${windowNumber + 1}`}
              </Text>
            </Box>
          </HStack>

          {onNavigate && (
            <Button size="sm" colorScheme="purple" alignSelf="flex-start" onClick={onNavigate}>
              Review weekly checklist
            </Button>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};
