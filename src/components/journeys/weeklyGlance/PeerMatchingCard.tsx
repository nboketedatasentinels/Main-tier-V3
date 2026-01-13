import { Badge, Button, Card, CardBody, HStack, Icon, Skeleton, Stack, Text, VStack } from '@chakra-ui/react'
import { Users } from 'lucide-react'
import { useMemo } from 'react'
import { PeerProfile } from '@/hooks/useWeeklyGlanceData'

interface PeerMatchingCardProps {
  matches: PeerProfile[]
  loading: boolean
}

export const PeerMatchingCard = ({ matches, loading }: PeerMatchingCardProps) => {
  const limitedMatches = useMemo(() => matches.slice(0, 3), [matches])

  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Icon as={Users} color="brand.primary" />
              <Text fontWeight="bold" color="#273240">Peer Matching</Text>
            </HStack>
            <Badge colorScheme={matches.length ? 'green' : 'gray'}>{matches.length} peers</Badge>
          </HStack>
          <Skeleton isLoaded={!loading} rounded="md">
            <VStack align="stretch" spacing={2}>
              {matches.length === 0 && <Text color="text.secondary">No peers available yet.</Text>}
              {limitedMatches.map(match => (
                <HStack key={match.id} justify="space-between" p={2} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <Text color="#273240">
                    {match.fullName || `${match.firstName ?? ''} ${match.lastName ?? ''}`.trim() || match.email || 'Member'}
                  </Text>
                  <Badge colorScheme="green">Available</Badge>
                </HStack>
              ))}
            </VStack>
          </Skeleton>
          <Button size="sm" variant="outline" alignSelf="flex-start">
            Start Matching
          </Button>
        </Stack>
      </CardBody>
    </Card>
  )
}
