import { Card, CardBody, HStack, Icon, Link, Skeleton, Stack, Text } from '@chakra-ui/react'
import { TrendingUp, Users } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'

interface PeopleImpactedCardProps {
  count: number
  loading: boolean
}

export const PeopleImpactedCard = ({ count, loading }: PeopleImpactedCardProps) => {
  return (
    <Card h="100%" bg="white" borderWidth="1px" borderColor="orange.400" borderRadius="xl" _hover={{ shadow: 'md' }}>
      <CardBody p={5}>
        <Stack spacing={4}>
          {/* Header */}
          <HStack justify="space-between" align="center">
            <HStack spacing={2}>
              <Icon as={Users} color="orange.500" boxSize={5} />
              <Text fontWeight="semibold" fontSize="md" color="gray.800" fontFamily="heading">People Impacted</Text>
            </HStack>
            <Link
              as={RouterLink}
              to="/app/impact"
              color="orange.600"
              fontSize="sm"
              fontWeight="medium"
              fontFamily="body"
              _hover={{ textDecoration: 'underline' }}
            >
              View all
            </Link>
          </HStack>

          {/* Count Display */}
          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={2} align="center" py={4} bg="orange.50" rounded="lg">
              <Text fontSize="4xl" fontWeight="bold" color="orange.600" fontFamily="heading">
                {count.toLocaleString()}
              </Text>
              <HStack spacing={2} color="gray.600">
                <Icon as={TrendingUp} boxSize={4} color="green.500" />
                <Text fontSize="sm" fontFamily="body">people this month</Text>
              </HStack>
            </Stack>
          </Skeleton>

          <Text color="gray.500" fontSize="sm" textAlign="center" fontFamily="body">
            Log activities to see your impact grow
          </Text>
        </Stack>
      </CardBody>
    </Card>
  )
}
