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
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Icon as={Users} color="brand.primary" />
              <Text fontWeight="bold" color="#273240">Peer Matching</Text>
            </HStack>
            <Badge colorScheme={completed.length ? 'green' : 'gray'}>{completed.length} matches</Badge>
          </HStack>
          <Skeleton isLoaded={!loading} rounded="md">
            <VStack align="stretch" spacing={2}>
              {matches.length === 0 && <Text color="text.secondary">No matches yet. Start connecting!</Text>}
              {pending.slice(0, 2).map(match => (
                <HStack key={match.id} justify="space-between" p={2} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={2}>
                    <Icon as={UserPlus} color="#273240" />
                    <Text color="#273240">Request to {match.matched_user_id}</Text>
                  </HStack>
                  <Badge colorScheme="yellow">Pending</Badge>
                </HStack>
              ))}
              {completed.slice(0, 2).map(match => (
                <HStack key={match.id} justify="space-between" p={2} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={2}>
                    <Icon as={CalendarClock} color="#273240" />
                    <Text color="#273240">Matched with {match.matched_user_id}</Text>
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
