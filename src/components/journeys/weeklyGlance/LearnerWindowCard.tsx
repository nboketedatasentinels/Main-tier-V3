import { Badge, Box, Card, CardBody, HStack, Icon, Progress, Stack, Text } from '@chakra-ui/react'
import { CalendarClock, PartyPopper, Target } from 'lucide-react'

interface LearnerWindowCardProps {
  weekLabel: string
  daysRemaining: number
  progressValue: number
  targetPoints: number
  earnedPoints: number
  focusAreas: string[]
  nextMilestone: string
}

export const LearnerWindowCard = ({
  weekLabel,
  daysRemaining,
  progressValue,
  targetPoints,
  earnedPoints,
  focusAreas,
  nextMilestone,
}: LearnerWindowCardProps) => {
  const hasExceededGoal = targetPoints > 0 && earnedPoints > targetPoints
  const remainingPoints = Math.max(targetPoints - earnedPoints, 0)

  return (
    <Card h="100%" bg="white" borderWidth="1px" borderColor="green.400" borderRadius="xl">
      <CardBody p={5}>
        <Stack spacing={5}>
          {/* Header */}
          <HStack justify="space-between" align="center">
            <HStack spacing={2}>
              <Icon as={CalendarClock} color="green.500" boxSize={5} />
              <Text fontWeight="semibold" fontSize="md" color="gray.800" fontFamily="heading">Learner Cycle</Text>
            </HStack>
            <Badge
              colorScheme={daysRemaining <= 2 ? 'red' : 'green'}
              fontSize="xs"
              px={3}
              py={1}
              borderRadius="full"
              fontFamily="body"
            >
              {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left
            </Badge>
          </HStack>

          {/* Progress Section */}
          <Box bg="gray.50" rounded="lg" p={4}>
            <Text fontSize="sm" color="gray.500" mb={1}>{weekLabel}</Text>
            <Progress
              value={progressValue}
              colorScheme={hasExceededGoal ? 'green' : 'purple'}
              rounded="full"
              size="sm"
              mb={2}
            />
            <HStack justify="space-between" fontSize="sm">
              <Text fontWeight="semibold" color="gray.700">{earnedPoints.toLocaleString()} pts earned</Text>
              <Text color="gray.500">{remainingPoints > 0 ? `${remainingPoints.toLocaleString()} pts to goal` : 'Goal reached!'}</Text>
            </HStack>
          </Box>

          {/* Milestone Section */}
          <Box
            borderLeftWidth="3px"
            borderLeftColor={hasExceededGoal ? 'green.400' : 'purple.400'}
            pl={3}
          >
            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">Next Milestone</Text>
            <Text fontWeight="semibold" color="gray.800">{nextMilestone}</Text>
            {hasExceededGoal && (
              <HStack spacing={1} color="green.500" mt={1}>
                <Icon as={PartyPopper} boxSize={4} />
                <Text fontSize="sm" fontWeight="medium">Goal exceeded!</Text>
              </HStack>
            )}
          </Box>

          {/* Focus Areas */}
          {focusAreas.length > 0 && (
            <Box>
              <HStack spacing={2} mb={2}>
                <Icon as={Target} color="gray.400" boxSize={4} />
                <Text fontSize="sm" fontWeight="medium" color="gray.600">Focus Areas</Text>
              </HStack>
              <HStack spacing={2} flexWrap="wrap">
                {focusAreas.map((area) => (
                  <Badge key={area} colorScheme="purple" fontSize="xs">
                    {area}
                  </Badge>
                ))}
              </HStack>
            </Box>
          )}
        </Stack>
      </CardBody>
    </Card>
  )
}
