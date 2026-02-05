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
  };
  onCancel?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

const statusConfig = {
  pending: {
    label: 'Starts Soon',
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

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  onCancel,
  onViewDetails,
}) => {
  const {
    id,
    opponentName,
    startDate,
    endDate,
    yourPoints,
    opponentPoints,
    status,
    result,
  } = challenge;

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const now = new Date();

  // Determine actual status based on dates if status field is stale
  const computedStatus = (() => {
    if (status === 'completed') return 'completed';
    if (isBefore(now, start)) return 'pending';
    if (isAfter(now, end)) return 'completed';
    return 'active';
  })();

  const actualConfig = statusConfig[computedStatus];

  // Result badge for completed challenges
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
      bg={actualConfig.bg}
      border="1px solid"
      borderColor={actualConfig.border}
      borderRadius="lg"
      p={4}
      transition="all 0.2s"
      _hover={{ shadow: 'sm', borderColor: 'purple.300' }}
      cursor={onViewDetails ? 'pointer' : 'default'}
      onClick={() => onViewDetails?.(id)}
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
                {format(start, 'MMM d')} – {format(end, 'MMM d')}
              </Text>
            </HStack>
          </VStack>
        </HStack>

        <HStack spacing={2}>
          <Badge colorScheme={actualConfig.colorScheme} fontSize="xs">
            {actualConfig.label}
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

      <ChallengeProgressBar
        yourPoints={yourPoints}
        opponentPoints={opponentPoints}
        opponentName={opponentName}
        status={computedStatus}
      />
    </Box>
  );
};
