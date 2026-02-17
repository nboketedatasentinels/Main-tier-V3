import React from 'react'
import { Tooltip } from '@chakra-ui/react'

export type AdvancementHelpVariant = 'week_unlock' | 'window_concept' | 'approval_blocking' | 'points_threshold'

export interface AdvancementHelpTooltipProps {
  variant: AdvancementHelpVariant
  children: React.ReactNode
}

const helpContent: Record<AdvancementHelpVariant, string> = {
  week_unlock:
    'Weeks unlock when you complete milestones, not automatically over time. Earn at least 67% of your current cycle target points and complete any pending partner approvals to advance to the next week.',

  window_concept:
    'Progress is measured in cycles (typically 2-week periods). Your advancement is evaluated across each cycle to ensure balanced engagement throughout your journey.',

  approval_blocking:
    'Activities requiring partner approval won\'t count toward your progress until they are reviewed and approved. Check the "Pending Approvals" section to see what\'s awaiting review.',

  points_threshold:
    'You need to earn at least 67% of your current cycle target points to be eligible for week advancement. This ensures consistent engagement while allowing flexibility in your learning approach.'
}

/**
 * Educational tooltip component for explaining week advancement concepts.
 *
 * Wraps any child element and shows contextual help on hover.
 *
 * @param variant - The type of help content to display
 * @param children - The element to wrap with the tooltip
 */
export const AdvancementHelpTooltip: React.FC<AdvancementHelpTooltipProps> = ({ variant, children }) => {
  return (
    <Tooltip
      label={helpContent[variant]}
      hasArrow
      placement="top"
      bg="purple.600"
      color="white"
      fontSize="sm"
      px={3}
      py={2}
      borderRadius="md"
      maxW="320px"
    >
      {children}
    </Tooltip>
  )
}
