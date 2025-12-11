import { Badge, Button, Card, CardBody, Divider, HStack, Icon, Stack, Text, VStack } from '@chakra-ui/react'
import { Activity, ListChecks, Users, Zap } from 'lucide-react'

interface PointsActivityCardProps {
  recentActivityCount?: number
  totalPoints?: number
  upcomingChallenges?: string[]
  allies?: string[]
}

export const PointsActivityCard = ({
  recentActivityCount = 0,
  totalPoints = 0,
  upcomingChallenges = [],
  allies = [],
}: PointsActivityCardProps) => {
  return (
    <Card h="100%" variant="outline" borderColor="brand.border">
      <CardBody>
        <Stack spacing={3}>
          <Text fontWeight="bold">Points & Activity</Text>
          <HStack spacing={3}>
            <Icon as={Zap} color="brand.primary" />
            <Text fontSize="2xl" fontWeight="bold">
              {totalPoints} XP
            </Text>
            <Badge colorScheme="purple">Recent {recentActivityCount}</Badge>
          </HStack>
          <Divider />
          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <HStack spacing={2}>
                <Icon as={Activity} />
                <Text>Life activity</Text>
              </HStack>
              <Text color="brand.subtleText">Stay consistent this week</Text>
            </HStack>
            <HStack justify="space-between">
              <HStack spacing={2}>
                <Icon as={ListChecks} />
                <Text>Upcoming challenges</Text>
              </HStack>
              <Text color="brand.subtleText">{upcomingChallenges.length} queued</Text>
            </HStack>
            <HStack justify="space-between">
              <HStack spacing={2}>
                <Icon as={Users} />
                <Text>Recent allies</Text>
              </HStack>
              <Text color="brand.subtleText">{allies.length} peers</Text>
            </HStack>
          </VStack>
          <Divider />
          <Button size="sm" variant="outline" alignSelf="flex-start">
            View All
          </Button>
        </Stack>
      </CardBody>
    </Card>
  )
}
