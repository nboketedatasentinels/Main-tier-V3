
import React from 'react';
import {
  Box,
  Heading,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react';

// Mock data for the journey completion
const mockCompletionData = {
  percentage: 75,
  message: 'You are on track to complete your journey!',
};

export const JourneyCompletionOverview: React.FC = () => {
  return (
    <Box>
      <Heading size="md" mb={4}>
        Journey Completion
      </Heading>
      <VStack spacing={3} align="stretch">
        <Progress
          value={mockCompletionData.percentage}
          size="lg"
          colorScheme="green"
        />
        <Text fontSize="sm" color="gray.600">
          {mockCompletionData.percentage}% complete
        </Text>
        <Text>{mockCompletionData.message}</Text>
      </VStack>
    </Box>
  );
};
