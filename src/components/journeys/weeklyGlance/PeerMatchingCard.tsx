import { Badge, Button, Card, CardBody, HStack, Icon, Skeleton, Stack, Text, VStack } from '@chakra-ui/react'
import { Users } from 'lucide-react'
import { useMemo } from 'react'
import { PeerMatch, PeerMatchStatus } from '@/hooks/useWeeklyGlanceData'

const STATUS_BADGE_LABELS: Record<PeerMatchStatus, string> = {
  new: 'New match',
  viewed: 'Viewed',
  contacted: 'Contacted',
  completed: 'Connected',
  expired: 'Expired',
}

const STATUS_BADGE_COLORS: Record<PeerMatchStatus, 'yellow' | 'orange' | 'green' | 'gray'> = {
  new: 'yellow',
  viewed: 'yellow',
  contacted: 'orange',
  completed: 'green',
  expired: 'gray',
}

const STATUS_DESCRIPTIONS: Record<PeerMatchStatus, string> = {
  new: 'Ready for your weekly peer check-in.',
  viewed: 'Match has been viewed.',
  contacted: 'You reached out to your peer.',
  completed: 'This match has been completed.',
  expired: 'This match window has expired.',
}

const getMatchLabel = (match: PeerMatch) => match.matchReason || match.peerId || 'Peer match'

interface PeerMatchingCardProps {
  matches: PeerMatch[]
  loading: boolean
}

export const PeerMatchingCard = ({ matches, loading }: PeerMatchingCardProps) => {
  const pendingMatches = useMemo(
    () => matches.filter(match => match.matchStatus !== 'completed' && match.matchStatus !== 'expired'),
    [matches],
  )
  const completedMatches = useMemo(
    () => matches.filter(match => match.matchStatus === 'completed'),
    [matches],
  )
  const matchCount = pendingMatches.length + completedMatches.length
  const badgeColor: 'yellow' | 'green' | 'gray' =
    completedMatches.length > 0 ? 'green' : pendingMatches.length > 0 ? 'yellow' : 'gray'

  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody>
        <Stack spacing={3}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Icon as={Users} color="brand.primary" />
              <Text fontWeight="bold" color="text.primary">Peer Matching</Text>
            </HStack>
            <Badge colorScheme={badgeColor}>{matchCount} match{matchCount === 1 ? '' : 'es'}</Badge>
          </HStack>
          <Skeleton isLoaded={!loading} rounded="md">
            <VStack align="stretch" spacing={2}>
              {matches.length === 0 && (
                <Text color="text.secondary">No matches yet. Start connecting!</Text>
              )}
              {pendingMatches.slice(0, 2).map(match => (
                <HStack
                  key={match.id}
                  justify="space-between"
                  p={2}
                  borderWidth="1px"
                  borderColor="border.subtle"
                  rounded="md"
                >
                  <VStack align="start" spacing={0}>
                    <Text color="text.primary">{getMatchLabel(match)}</Text>
                    <Text fontSize="xs" color="text.secondary">
                      {STATUS_DESCRIPTIONS[match.matchStatus]}
                    </Text>
                  </VStack>
                  <Badge colorScheme={STATUS_BADGE_COLORS[match.matchStatus]} variant="subtle">
                    {STATUS_BADGE_LABELS[match.matchStatus]}
                  </Badge>
                </HStack>
              ))}
              {completedMatches.slice(0, 2).map(match => (
                <HStack
                  key={match.id}
                  justify="space-between"
                  p={2}
                  borderWidth="1px"
                  borderColor="border.subtle"
                  rounded="md"
                >
                  <VStack align="start" spacing={0}>
                    <Text color="text.primary">{getMatchLabel(match)}</Text>
                    <Text fontSize="xs" color="text.secondary">
                      {STATUS_DESCRIPTIONS[match.matchStatus]}
                    </Text>
                  </VStack>
                  <Badge colorScheme={STATUS_BADGE_COLORS.completed} variant="subtle">
                    {STATUS_BADGE_LABELS.completed}
                  </Badge>
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
