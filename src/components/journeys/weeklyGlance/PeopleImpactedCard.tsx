import { Card, CardBody, HStack, Icon, Skeleton, Stack, Text } from '@chakra-ui/react'
import { TrendingUp, Users } from 'lucide-react'

interface PeopleImpactedCardProps {
  count: number
  loading: boolean
}

export const PeopleImpactedCard = ({ count, loading }: PeopleImpactedCardProps) => {
  return (
    <Card h="100%" variant="outline" borderColor="brand.border" _hover={{ shadow: 'sm' }}>
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Icon as={Users} color="brand.primary" />
              <Text fontWeight="bold" color="#5A6ACF">People Impacted</Text>
            </HStack>
            <HStack spacing={1} color="green.500">
              <Icon as={TrendingUp} boxSize={4} />
              <Text fontSize="sm" color="#5A6ACF">Track your impact</Text>
            </HStack>
          </HStack>
          <Skeleton isLoaded={!loading} rounded="md">
            <Text fontSize="4xl" fontWeight="bold" color="#5A6ACF">
              {count}
            </Text>
          </Skeleton>
          <Text color="#5A6ACF" fontSize="sm">
            Celebrate each person you support. Log activities to see this grow.
          </Text>
        </Stack>
      </CardBody>
    </Card>
  )
}
