import {
  Box,
  Flex,
  Text,
  Badge,
  Avatar,
  HStack,
  VStack,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
} from '@chakra-ui/react';
import { MoreVertical, Calendar, XCircle } from 'lucide-react';
import { ChallengeProgressBar } from './ChallengeProgressBar';
import { format, isAfter, isBefore, parseISO } from 'date-fns';

interface ChallengeCardProps {
  challenge: {
    id: string;
    opponentName: string;
    opponentId?: string;
    startDate: string;
    endDate: string;
    yourPoints: number;
    opponentPoints: number;
    status: 'pending' | 'active' | 'completed' | 'upcoming';
    result?: 'win' | 'loss' | 'draw';
    isChallenger?: boolean;
  };
  highlighted?: boolean;
  onCancel?: (id: string) => void;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  responding?: boolean;
}

const statusConfig = {
  pending: {
    label: 'Awaiting response',
    colorScheme: 'yellow',
    bg: 'yellow.50',
    border: 'yellow.200',
  },
  upcoming: {
    label: 'Upcoming',
    colorScheme: 'blue',
    bg: 'blue.50',
    border: 'blue.200',
  },
  active: {
    label: 'In Progress',
    colorScheme: 'green',
    bg: 'green.50',
    border: 'green.200',
  },
  completed: {
    label: 'Completed',
    colorScheme: 'gray',
    bg: 'gray.50',
    border: 'border.control',
  },
};

export const ChallengeCard = ({
  challenge,
  highlighted = false,
  onCancel,
  onAccept,
  onDecline,
  onViewDetails,
  responding = false,
}: ChallengeCardProps) => {
  const {
    id,
    opponentName,
    startDate,
    endDate,
    yourPoints,
    opponentPoints,
    status,
    result,
    isChallenger,
  } = challenge;

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const now = new Date();

  // Prefer explicit DB status for pending (awaiting accept) — date logic alone
  // mis-labels "starts today" invites as active.
  const computedStatus = (() => {
    if (status === 'completed') return 'completed';
    if (status === 'pending') return 'pending';
    if (isBefore(now, start)) return 'pending';
    if (isAfter(now, end)) return 'completed';
    return 'active';
  })();

  const actualConfig = statusConfig[computedStatus];
  const needsResponse = computedStatus === 'pending' && isChallenger === false;
  const waitingOnOpponent = computedStatus === 'pending' && isChallenger === true;

  const resultBadge = result && (
    <Badge
      colorScheme={result === 'win' ? 'green' : result === 'loss' ? 'red' : 'gray'}
      fontSize="xs"
    >
      {result === 'win' ? '🏆 Won' : result === 'loss' ? 'Lost' : 'Draw'}
    </Badge>
  );

  return (
    <Box
      id={`challenge-${id}`}
      bg={actualConfig.bg}
      border="2px solid"
      borderColor={highlighted ? 'brand.primary' : actualConfig.border}
      borderRadius="lg"
      p={4}
      transition="all 0.2s"
      _hover={{ shadow: 'sm', borderColor: highlighted ? 'brand.primary' : 'purple.300' }}
      cursor={onViewDetails ? 'pointer' : 'default'}
      onClick={() => onViewDetails?.(id)}
      boxShadow={highlighted ? '0 0 0 3px rgba(53, 14, 111, 0.2)' : undefined}
    >
      <Flex justify="space-between" align="flex-start" mb={3}>
        <HStack spacing={3}>
          <Avatar
            size="sm"
            name={opponentName}
            bg="purple.500"
            color="white"
            fontSize="xs"
          />
          <VStack align="flex-start" spacing={0}>
            <HStack>
              <Text fontWeight="semibold" fontSize="sm">
                vs {opponentName}
              </Text>
              {resultBadge}
            </HStack>
            <HStack spacing={1} color="gray.500" fontSize="xs">
              <Calendar size={12} />
              <Text>
                {format(start, 'MMM d')} - {format(end, 'MMM d')}
              </Text>
            </HStack>
            {waitingOnOpponent && (
              <Text fontSize="xs" color="orange.600" mt={1}>
                Waiting for {opponentName} to accept
              </Text>
            )}
            {needsResponse && (
              <Text fontSize="xs" color="brand.primary" fontWeight="semibold" mt={1}>
                {opponentName} challenged you — accept to start
              </Text>
            )}
          </VStack>
        </HStack>

        <HStack spacing={2}>
          <Badge colorScheme={actualConfig.colorScheme} fontSize="xs">
            {needsResponse ? 'Your move' : actualConfig.label}
          </Badge>

          {computedStatus !== 'completed' && onCancel && (
            <Menu>
              <MenuButton
                as={IconButton}
                icon={<MoreVertical size={14} />}
                variant="ghost"
                size="xs"
                aria-label="Challenge options"
                onClick={(e) => e.stopPropagation()}
              />
              <MenuList>
                <MenuItem
                  icon={<XCircle size={14} />}
                  color="red.500"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(id);
                  }}
                >
                  Cancel Challenge
                </MenuItem>
              </MenuList>
            </Menu>
          )}
        </HStack>
      </Flex>

      {needsResponse && (onAccept || onDecline) && (
        <HStack spacing={2} mb={3} onClick={(e) => e.stopPropagation()}>
          {onAccept && (
            <Button
              size="sm"
              colorScheme="brand"
              isLoading={responding}
              onClick={() => onAccept(id)}
            >
              Accept
            </Button>
          )}
          {onDecline && (
            <Button
              size="sm"
              variant="outline"
              isDisabled={responding}
              onClick={() => onDecline(id)}
            >
              Decline
            </Button>
          )}
        </HStack>
      )}

      <ChallengeProgressBar
        yourPoints={yourPoints}
        opponentPoints={opponentPoints}
        opponentName={opponentName}
        status={computedStatus}
      />
    </Box>
  );
};
