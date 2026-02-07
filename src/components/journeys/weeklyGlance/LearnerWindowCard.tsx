import { Badge, Box, Card, CardBody, Divider, HStack, Icon, Progress, Stack, Text, VStack } from '@chakra-ui/react'
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
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody p={6}>
        <Stack spacing={4}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Icon as={CalendarClock} color="brand.primary" />
              <Text fontWeight="bold" fontSize="md">Learner Window</Text>
            </HStack>
            <Badge colorScheme={daysRemaining <= 2 ? 'red' : 'green'}>
              {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left
            </Badge>
          </HStack>

          <Box
            borderWidth="1px"
            borderColor={hasExceededGoal ? 'green.200' : 'border.subtle'}
            bg={hasExceededGoal ? 'green.50' : 'surface.subtle'}
            rounded="md"
            p={3}
          >
            <HStack justify="space-between" align="flex-start">
              <Box>
                <Text fontSize="sm" color="text.secondary">
                  Next milestone
                </Text>
                <Text fontWeight="semibold">{nextMilestone}</Text>
              </Box>
              {hasExceededGoal && (
                <HStack spacing={1} color="green.600">
                  <Icon as={PartyPopper} />
                  <Text fontSize="sm" fontWeight="semibold">
                    Goal exceeded!
                  </Text>
                </HStack>
              )}
            </HStack>
          </Box>

          <Box>
            <Text fontSize="sm" color="text.secondary">
              {weekLabel}
            </Text>
            <Progress value={progressValue} colorScheme={hasExceededGoal ? 'green' : 'purple'} rounded="full" mt={2} />
            <HStack justify="space-between" mt={2} fontSize="sm" color="text.secondary">
              <Text>{earnedPoints} pts earned</Text>
              <Text>{remainingPoints > 0 ? `${remainingPoints} pts to goal` : `${targetPoints} pts target`}</Text>
            </HStack>
          </Box>

          <Divider />

          <VStack align="stretch" spacing={2}>
            <HStack spacing={2}>
              <Icon as={Target} color="text.muted" />
              <Text fontSize="sm" color="text.secondary">
                This week's focus
              </Text>
            </HStack>
            <Text fontSize="xs" color="text.muted">
              Informational only
            </Text>
            <HStack spacing={2} flexWrap="wrap">
              {focusAreas.map((area) => (
                <Badge key={area} variant="subtle" colorScheme="purple">
                  {area}
                </Badge>
              ))}
            </HStack>
          </VStack>
        </Stack>
      </CardBody>
    </Card>
  )
}
