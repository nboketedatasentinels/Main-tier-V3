import { Badge, Button, Card, CardBody, HStack, Icon, Skeleton, Stack, Text, VStack } from '@chakra-ui/react'
import { CalendarClock, UserPlus, Users } from 'lucide-react'
import { useMemo } from 'react'
import { PeerMatch } from '@/hooks/useWeeklyGlanceData'

interface PeerMatchingCardProps {
  matches: PeerMatch[]
  loading: boolean
}

export const PeerMatchingCard = ({ matches, loading }: PeerMatchingCardProps) => {
  const pending = useMemo(() => matches.filter(match => match.status === 'pending'), [matches])
  const completed = useMemo(() => matches.filter(match => match.status === 'matched'), [matches])

  return (
    <Card h="100%" variant="outline" borderColor="brand.border">
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Icon as={Users} color="brand.primary" />
              <Text fontWeight="bold">Peer Matching</Text>
            </HStack>
            <Badge colorScheme={completed.length ? 'green' : 'gray'}>{completed.length} matches</Badge>
          </HStack>
          <Skeleton isLoaded={!loading} rounded="md">
            <VStack align="stretch" spacing={2}>
              {matches.length === 0 && <Text color="brand.subtleText">No matches yet. Start connecting!</Text>}
              {pending.slice(0, 2).map(match => (
                <HStack key={match.id} justify="space-between" p={2} borderWidth="1px" borderColor="brand.border" rounded="md">
                  <HStack spacing={2}>
                    <Icon as={UserPlus} />
                    <Text>Request to {match.matched_user_id}</Text>
                  </HStack>
                  <Badge colorScheme="yellow">Pending</Badge>
                </HStack>
              ))}
              {completed.slice(0, 2).map(match => (
                <HStack key={match.id} justify="space-between" p={2} borderWidth="1px" borderColor="brand.border" rounded="md">
                  <HStack spacing={2}>
                    <Icon as={CalendarClock} />
                    <Text>Matched with {match.matched_user_id}</Text>
                  </HStack>
                  <Badge colorScheme="green">Connected</Badge>
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
