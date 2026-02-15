import React from 'react';
import { Badge, Tooltip, Icon, HStack, Text } from '@chakra-ui/react';
import {
  CheckCircleIcon,
  WarningIcon,
  InfoIcon,
  StarIcon
} from '@chakra-ui/icons';

interface WindowStatusBadgeProps {
  status: 'ahead' | 'on_track' | 'catching_up' | 'behind';
}

const statusConfig = {
  ahead: {
    color: 'green',
    label: 'Ahead',
    icon: StarIcon,
    tooltip: 'Peak state reached. Finish this cycle strong with one more contribution.'
  },
  on_track: {
    color: 'teal',
    label: 'On Track',
    icon: CheckCircleIcon,
    tooltip: 'Steady pace. End this cycle with a positive close.'
  },
  catching_up: {
    color: 'yellow',
    label: 'Catching Up',
    icon: WarningIcon,
    tooltip: 'Momentum is improving. Keep pushing to end this cycle on target.'
  },
  behind: {
    color: 'red',
    label: 'Behind',
    icon: InfoIcon,
    tooltip: 'Risk state. Act now to avoid closing this cycle below target.'
  }
};

export const WindowStatusBadge: React.FC<WindowStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || statusConfig.behind;

  return (
    <Tooltip label={config.tooltip} hasArrow placement="top">
      <Badge
        colorScheme={config.color}
        variant="subtle"
        px={2}
        py={1}
        borderRadius="full"
        textTransform="capitalize"
        display="flex"
        alignItems="center"
      >
        <HStack spacing={1}>
          <Icon as={config.icon} boxSize={3} />
          <Text fontSize="xs" fontWeight="bold">
            {config.label}
          </Text>
        </HStack>
      </Badge>
    </Tooltip>
  );
};
