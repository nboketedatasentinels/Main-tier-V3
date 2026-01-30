import React from 'react'
import {
  Card,
  CardBody,
  Stack,
  HStack,
  Text,
  Badge,
  Icon,
  Skeleton,
  Alert,
  AlertIcon,
  Button,
  Divider
} from '@chakra-ui/react'
import { Target, CheckCircle, Lock, Clock } from 'lucide-react'
import { AdvancementEligibility } from '@/services/weekAdvancementService'
import { AdvancementProgressIndicator } from './AdvancementProgressIndicator'
import { AdvancementHelpTooltip } from './AdvancementHelpTooltip'

export interface WeekStatusSummaryCardProps {
  eligibility: AdvancementEligibility | null
  loading: boolean
  error?: string | null
  onViewApprovals?: () => void
}

/**
 * Central status card showing current week advancement status.
 *
 * Displays:
 * - Current week and next unlock target
 * - Status badge (Ready/In Progress/Blocked/Locked)
 * - Criteria checklist with progress indicators
 * - Action buttons (e.g., View Pending Approvals)
 *
 * @param eligibility - Advancement eligibility data
 * @param loading - Loading state
 * @param error - Error message if calculation failed
 * @param onViewApprovals - Callback when "View Pending Approvals" is clicked
 */
export const WeekStatusSummaryCard: React.FC<WeekStatusSummaryCardProps> = ({
  eligibility,
  loading,
  error,
  onViewApprovals
}) => {
  const getStatusConfig = () => {
    if (!eligibility) {
      return {
        label: 'Unknown',
        colorScheme: 'gray',
        icon: Lock,
        description: 'Status unavailable'
      }
    }

    if (eligibility.currentWeek >= (eligibility.nextWeek)) {
      return {
        label: 'Journey Complete',
        colorScheme: 'blue',
        icon: CheckCircle,
        description: 'You\'ve completed all weeks!'
      }
    }

    if (eligibility.isEligible) {
      return {
        label: 'Ready to Advance',
        colorScheme: 'green',
        icon: CheckCircle,
        description: `All criteria met! Ready for Week ${eligibility.nextWeek}.`
      }
    }

    const hasPendingApprovals = eligibility.pendingApprovals.length > 0

    if (hasPendingApprovals) {
      return {
        label: 'Blocked',
        colorScheme: 'red',
        icon: Lock,
        description: 'Pending partner approvals are blocking advancement.'
      }
    }

    if (eligibility.progressPercentage >= 50) {
      return {
        label: 'In Progress',
        colorScheme: 'yellow',
        icon: Clock,
        description: `You're ${eligibility.progressPercentage}% of the way to Week ${eligibility.nextWeek}.`
      }
    }

    return {
      label: 'In Progress',
      colorScheme: 'orange',
      icon: Target,
      description: 'Complete more activities to advance.'
    }
  }

  const status = getStatusConfig()

  if (loading) {
    return (
      <Card variant="outline" borderColor="border.subtle" h="100%">
        <CardBody p={6}>
          <Stack spacing={4}>
            <Skeleton height="24px" width="60%" />
            <Skeleton height="80px" />
            <Skeleton height="120px" />
          </Stack>
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <Card variant="outline" borderColor="border.subtle" h="100%">
        <CardBody p={6}>
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Stack spacing={1}>
              <Text fontWeight="medium">Unable to load status</Text>
              <Text fontSize="sm">{error}</Text>
            </Stack>
          </Alert>
        </CardBody>
      </Card>
    )
  }

  if (!eligibility) {
    return null
  }

  const hasPendingApprovals = eligibility.pendingApprovals.length > 0

  return (
    <Card
      variant="outline"
      borderColor="border.subtle"
      h="100%"
      _hover={{ shadow: 'sm' }}
      transition="all 0.2s"
    >
      <CardBody p={6}>
        <Stack spacing={4}>
          {/* Header with Status */}
          <HStack justify="space-between" align="flex-start">
            <HStack spacing={2}>
              <Icon as={Target} color="brand.primary" boxSize={5} />
              <AdvancementHelpTooltip variant="week_unlock">
                <Text
                  fontWeight="bold"
                  fontSize="md"
                  color="text.primary"
                  cursor="help"
                  borderBottom="1px dotted"
                  borderColor="gray.300"
                >
                  Week Status
                </Text>
              </AdvancementHelpTooltip>
            </HStack>
            <Badge
              colorScheme={status.colorScheme}
              variant="subtle"
              px={3}
              py={1}
              borderRadius="full"
              display="flex"
              alignItems="center"
              gap={1}
            >
              <Icon as={status.icon} boxSize={3} />
              {status.label}
            </Badge>
          </HStack>

          {/* Current Status Box */}
          <Stack
            spacing={2}
            borderWidth="1px"
            borderColor={`${status.colorScheme}.200`}
            bg={`${status.colorScheme}.50`}
            rounded="md"
            p={3}
          >
            <HStack justify="space-between">
              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                Current Week: {eligibility.currentWeek}
              </Text>
              <Text fontSize="sm" color="text.secondary">
                Next: Week {eligibility.nextWeek}
              </Text>
            </HStack>
            <Text fontSize="xs" color="text.secondary">
              {status.description}
            </Text>
          </Stack>

          <Divider />

          {/* Progress Indicator */}
          <AdvancementProgressIndicator
            criteria={eligibility.criteria}
            showOverallProgress={true}
          />

          {/* Action Buttons */}
          {hasPendingApprovals && onViewApprovals && (
            <>
              <Divider />
              <Button
                size="sm"
                variant="outline"
                colorScheme="purple"
                onClick={onViewApprovals}
                leftIcon={<Icon as={Clock} boxSize={4} />}
              >
                View Pending Approvals ({eligibility.pendingApprovals.length})
              </Button>
            </>
          )}

          {/* Blockers Alert */}
          {eligibility.blockers.length > 0 && !eligibility.isEligible && (
            <>
              <Divider />
              <Alert status="warning" borderRadius="md" fontSize="sm">
                <AlertIcon />
                <Stack spacing={1}>
                  <Text fontWeight="medium">To unlock Week {eligibility.nextWeek}:</Text>
                  {eligibility.blockers.map((blocker, index) => (
                    <Text key={index} fontSize="xs">
                      • {blocker}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            </>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}
