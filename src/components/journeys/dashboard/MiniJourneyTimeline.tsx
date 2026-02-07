
import React from 'react';
import {
  Box,
  Heading,
  HStack,
  Text,
  VStack,
  Circle,
  Divider,
} from '@chakra-ui/react';

// Mock data for the journey timeline
const mockTimelineData = [
  { week: 1, status: 'completed' },
  { week: 2, status: 'completed' },
  { week: 3, status: 'current' },
  { week: 4, status: 'locked' },
  { week: 5, status: 'locked' },
  { week: 6, status: 'locked' },
];

export const MiniJourneyTimeline: React.FC = () => {
  return (
    <Box>
      <Heading size="md" mb={4}>
        Journey Timeline
      </Heading>
      <HStack spacing={4} align="center">
        {mockTimelineData.map((item, index) => (
          <React.Fragment key={item.week}>
            <VStack>
              <Circle
                size="40px"
                bg={
                  item.status === 'completed'
                    ? 'green.500'
                    : item.status === 'current'
                    ? 'blue.500'
                    : 'gray.600'
                }
                color="white"
              >
                <Text fontSize="sm" fontWeight="bold">
                  {item.week}
                </Text>
              </Circle>
              <Text fontSize="xs" color="gray.500">
                Week {item.week}
              </Text>
            </VStack>
            {index < mockTimelineData.length - 1 && (
              <Divider orientation="horizontal" flex="1" />
            )}
          </React.Fragment>
        ))}
      </HStack>
    </Box>
  );
};
