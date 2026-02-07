import React from 'react'
import { Box, HStack, Stack, Text, Progress, Icon } from '@chakra-ui/react'
import { CheckCircle2, X, Clock } from 'lucide-react'
import { AdvancementCriteria } from '@/services/weekAdvancementService'
import { AdvancementHelpTooltip } from './AdvancementHelpTooltip'

export interface AdvancementProgressIndicatorProps {
  criteria: AdvancementCriteria[]
  compact?: boolean
  showOverallProgress?: boolean
}

/**
 * Visual progress indicator for week advancement criteria.
 *
 * Shows:
 * - Overall progress bar (percentage of criteria met)
 * - Per-criterion breakdown with checkmarks/X icons
 * - Current vs required values for each criterion
 *
 * @param criteria - Array of advancement criteria to display
 * @param compact - If true, shows condensed version without detailed values
 * @param showOverallProgress - If true, shows overall progress bar at top
 */
export const AdvancementProgressIndicator: React.FC<AdvancementProgressIndicatorProps> = ({
  criteria,
  compact = false,
  showOverallProgress = true
}) => {
  const metCriteriaCount = criteria.filter(c => c.isMet).length
  const overallProgress = criteria.length > 0 ? (metCriteriaCount / criteria.length) * 100 : 0

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'green'
    if (percentage >= 67) return 'purple'
    if (percentage >= 33) return 'yellow'
    return 'red'
  }

  const progressColor = getProgressColor(overallProgress)

  const getCriteriaIcon = (criteria: AdvancementCriteria) => {
    if (criteria.isMet) {
      return { icon: CheckCircle2, color: 'green.500' }
    }
    if (criteria.criteriaType === 'approval_required' && criteria.currentValue > 0) {
      return { icon: Clock, color: 'yellow.500' }
    }
    return { icon: X, color: 'red.500' }
  }

  const formatCriteriaValue = (criteria: AdvancementCriteria) => {
    if (criteria.criteriaType === 'approval_required') {
      if (criteria.currentValue === 0) {
        return 'No pending approvals'
      }
      return `${criteria.currentValue} approval${criteria.currentValue > 1 ? 's' : ''} pending`
    }

    return `${criteria.currentValue.toLocaleString()} / ${criteria.requiredValue.toLocaleString()} pts`
  }

  if (compact) {
    return (
      <HStack spacing={2}>
        {criteria.map((criterion, index) => {
          const { icon, color } = getCriteriaIcon(criterion)
          return (
            <AdvancementHelpTooltip
              key={index}
              variant={
                criterion.criteriaType === 'points_threshold'
                  ? 'points_threshold'
                  : criterion.criteriaType === 'approval_required'
                  ? 'approval_blocking'
                  : 'window_concept'
              }
            >
              <Box>
                <Icon as={icon} color={color} boxSize={5} />
              </Box>
            </AdvancementHelpTooltip>
          )
        })}
      </HStack>
    )
  }

  return (
    <Stack spacing={3}>
      {showOverallProgress && (
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" fontWeight="medium" color="text.secondary">
              Progress to Week Advancement
            </Text>
            <Text fontSize="sm" fontWeight="bold" color={`${progressColor}.600`}>
              {Math.round(overallProgress)}%
            </Text>
          </HStack>
          <Progress
            value={overallProgress}
            colorScheme={progressColor}
            height="8px"
            borderRadius="full"
            bg="gray.100"
          />
        </Box>
      )}

      <Stack spacing={2}>
        {criteria.map((criterion, index) => {
          const { icon, color } = getCriteriaIcon(criterion)

          return (
            <HStack key={index} spacing={3} align="flex-start">
              <Icon as={icon} color={color} boxSize={5} mt={0.5} flexShrink={0} />

              <Stack spacing={0} flex={1}>
                <HStack justify="space-between">
                  <AdvancementHelpTooltip
                    variant={
                      criterion.criteriaType === 'points_threshold'
                        ? 'points_threshold'
                        : criterion.criteriaType === 'approval_required'
                        ? 'approval_blocking'
                        : 'window_concept'
                    }
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      color="text.primary"
                      cursor="help"
                      borderBottom="1px dotted"
                      borderColor="border.control"
                    >
                      {criterion.label}
                    </Text>
                  </AdvancementHelpTooltip>
                </HStack>

                <Text fontSize="xs" color="text.secondary">
                  {formatCriteriaValue(criterion)}
                </Text>

                {criterion.blockingReason && !criterion.isMet && (
                  <Text fontSize="xs" color="orange.600" fontStyle="italic">
                    {criterion.blockingReason}
                  </Text>
                )}
              </Stack>
            </HStack>
          )
        })}
      </Stack>
    </Stack>
  )
}
