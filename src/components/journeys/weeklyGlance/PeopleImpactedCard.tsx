import { Card, CardBody, HStack, Icon, Link, Skeleton, Stack, Text } from '@chakra-ui/react'
import { TrendingUp, Users } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'

interface PeopleImpactedCardProps {
  count: number
  loading: boolean
}

export const PeopleImpactedCard = ({ count, loading }: PeopleImpactedCardProps) => {
  return (
    <Card h="100%" variant="outline" borderColor="border.subtle" _hover={{ shadow: 'sm' }}>
      <CardBody p={6}>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Icon as={Users} color="brand.primary" />
              <Text fontWeight="bold" fontSize="md" color="text.primary">People Impacted</Text>
            </HStack>
            <Link as={RouterLink} to="/app/impact" color="brand.primary" fontSize="sm" fontWeight="semibold">
              Track your impact
            </Link>
          </HStack>
          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={1}>
              <Text fontSize="4xl" fontWeight="bold" color="text.primary">
                {count}
              </Text>
              <HStack spacing={1} color="text.secondary">
                <Icon as={TrendingUp} boxSize={4} />
                <Text fontSize="sm">people this month</Text>
              </HStack>
            </Stack>
          </Skeleton>
          <Text color="text.secondary" fontSize="sm">
            Celebrate each person you support. Log activities to see this grow.
          </Text>
        </Stack>
      </CardBody>
    </Card>
  )
}
