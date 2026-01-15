import { Badge, Box, Card, CardBody, Divider, HStack, Icon, Progress, Stack, Text, VStack } from '@chakra-ui/react'
import { CalendarClock, Flag, Target } from 'lucide-react'

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
  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Icon as={CalendarClock} color="brand.primary" />
              <Text fontWeight="bold">Learner window</Text>
            </HStack>
            <Badge colorScheme={daysRemaining <= 2 ? 'red' : 'green'}>
              {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left
            </Badge>
          </HStack>

          <Box>
            <Text fontSize="sm" color="text.secondary">
              {weekLabel}
            </Text>
            <Progress value={progressValue} colorScheme="purple" rounded="full" mt={2} />
            <HStack justify="space-between" mt={2} fontSize="sm" color="text.secondary">
              <Text>{earnedPoints} pts earned</Text>
              <Text>{targetPoints} pts target</Text>
            </HStack>
          </Box>

          <Divider />

          <VStack align="stretch" spacing={2}>
            <HStack spacing={2}>
              <Icon as={Target} color="text.muted" />
              <Text fontSize="sm" color="text.secondary">
                Focus areas
              </Text>
            </HStack>
            <HStack spacing={2} flexWrap="wrap">
              {focusAreas.map((area) => (
                <Badge key={area} variant="subtle" colorScheme="purple">
                  {area}
                </Badge>
              ))}
            </HStack>
          </VStack>

          <Divider />

          <HStack spacing={2}>
            <Icon as={Flag} color="text.muted" />
            <Box>
              <Text fontSize="sm" color="text.secondary">
                Next milestone
              </Text>
              <Text fontWeight="semibold">{nextMilestone}</Text>
            </Box>
          </HStack>
        </Stack>
      </CardBody>
    </Card>
  )
}
