import React from 'react';
import { Badge, Tooltip, Icon, HStack, Text } from '@chakra-ui/react';
import {
  CheckCircleIcon,
  WarningIcon,
  InfoIcon,
  StarIcon
} from '@chakra-ui/icons';

interface WindowStatusBadgeProps {
  status: 'on_track' | 'warning' | 'alert' | 'recovery';
}

const statusConfig = {
  on_track: {
    color: 'green',
    label: 'On Track',
    icon: CheckCircleIcon,
    tooltip: "You're pacing well to hit your window target."
  },
  warning: {
    color: 'yellow',
    label: 'Warning',
    icon: WarningIcon,
    tooltip: "Slightly behind — still recoverable with some extra focus."
  },
  alert: {
    color: 'red',
    label: 'Alert',
    icon: InfoIcon,
    tooltip: "Risk of falling behind. Consider increasing your activity level."
  },
  recovery: {
    color: 'blue',
    label: 'Recovery',
    icon: StarIcon,
    tooltip: "Great job — you're back on track after a period of lower activity!"
  }
};

export const WindowStatusBadge: React.FC<WindowStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || statusConfig.alert;

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
