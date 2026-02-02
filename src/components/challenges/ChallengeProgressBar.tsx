import { Box, Flex, Text, VStack } from '@chakra-ui/react';

interface ChallengeProgressBarProps {
  yourPoints: number;
  opponentPoints: number;
  yourName?: string;
  opponentName: string;
  status: 'pending' | 'active' | 'completed' | 'upcoming';
}

export const ChallengeProgressBar: React.FC<ChallengeProgressBarProps> = ({
  yourPoints,
  opponentPoints,
  yourName = 'You',
  opponentName,
  status,
}) => {
  const maxPoints = Math.max(yourPoints, opponentPoints, 1); // Avoid division by zero
  const yourPercent = (yourPoints / maxPoints) * 100;
  const opponentPercent = (opponentPoints / maxPoints) * 100;

  const isWinning = yourPoints > opponentPoints;
  const isTied = yourPoints === opponentPoints;
  const isPending = status === 'pending';

  return (
    <VStack spacing={2} w="full" align="stretch">
      {/* Your progress */}
      <Flex align="center" gap={3}>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color={isWinning || isTied ? 'green.600' : 'gray.600'}
          minW="40px"
        >
          {yourName}
        </Text>
        <Box flex={1} position="relative">
          <Box
            h="8px"
            bg="gray.100"
            borderRadius="full"
            overflow="hidden"
          >
            <Box
              h="full"
              w={isPending ? '0%' : `${yourPercent}%`}
              bg={isWinning ? 'green.400' : isTied ? 'yellow.400' : 'orange.400'}
              borderRadius="full"
              transition="width 0.5s ease-out"
            />
          </Box>
        </Box>
        <Text
          fontSize="sm"
          fontWeight="bold"
          color={isWinning || isTied ? 'green.600' : 'gray.700'}
          minW="60px"
          textAlign="right"
        >
          {yourPoints.toLocaleString()}
        </Text>
      </Flex>

      {/* Opponent progress */}
      <Flex align="center" gap={3}>
        <Text
          fontSize="xs"
          color="gray.500"
          minW="40px"
          isTruncated
          title={opponentName}
        >
          {opponentName.split(' ')[0]} {/* First name only for space */}
        </Text>
        <Box flex={1} position="relative">
          <Box
            h="8px"
            bg="gray.100"
            borderRadius="full"
            overflow="hidden"
          >
            <Box
              h="full"
              w={isPending ? '0%' : `${opponentPercent}%`}
              bg="purple.300"
              borderRadius="full"
              transition="width 0.5s ease-out"
            />
          </Box>
        </Box>
        <Text
          fontSize="sm"
          fontWeight="medium"
          color="gray.600"
          minW="60px"
          textAlign="right"
        >
          {opponentPoints.toLocaleString()}
        </Text>
      </Flex>
    </VStack>
  );
};
