import {
  Avatar,
  Button,
  Card,
  CardBody,
  Divider,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { CalendarClock, Mail, MessageCircle, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PeerMatch, SupportAssignment } from '@/hooks/useWeeklyGlanceData'

interface SupportTeamCardProps {
  data: SupportAssignment | null
  loading: boolean
  peerMatches: PeerMatch[]
  peerMatchesLoading: boolean
}

export const SupportTeamCard = ({ data, loading, peerMatches, peerMatchesLoading }: SupportTeamCardProps) => {
  const mentorProfile = data?.mentorProfile ?? null
  const ambassadorProfile = data?.ambassadorProfile ?? null
  const hasAssignedIds = Boolean(data?.mentor_id || data?.ambassador_id)
  const hasMentor = Boolean(mentorProfile)
  const hasAmbassador = Boolean(ambassadorProfile)
  const showEmptyState = !loading && !hasMentor && !hasAmbassador
  const completedMatches = peerMatches.filter(match => match.status === 'matched')
  const hasPeerMatch = completedMatches.length > 0
  const supportErrorMessages = [data?.mentorProfileError, data?.ambassadorProfileError].filter(
    (message): message is string => Boolean(message),
  )

  const getDisplayName = (profile: NonNullable<typeof mentorProfile>) => {
    const name = profile.fullName || `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
    return name || profile.email || 'Unknown name'
  }

  const getAvatarSrc = (profile: NonNullable<typeof mentorProfile>) => {
    return profile.avatarUrl || profile.photoURL || undefined
  }

  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody p={6}>
        <Stack spacing={4}>
          <Text fontWeight="bold" fontSize="md" color="#273240">Support Team</Text>
          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={3}>
              {hasMentor && mentorProfile && mentorProfile.id !== ambassadorProfile?.id && (
                <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={3} w="100%" justify="space-between">
                    <HStack spacing={2}>
                      <Avatar size="sm" name={getDisplayName(mentorProfile)} src={getAvatarSrc(mentorProfile)} />
                      <VStack spacing={0} align="start">
                        <Text fontSize="xs" color="text.secondary">Mentor</Text>
                        <Text fontWeight="semibold">
                          {getDisplayName(mentorProfile)}
                        </Text>
                      </VStack>
                    </HStack>
                    {mentorProfile.email && (
                      <Button
                        as={Link}
                        to="/app/leadership-council"
                        size="sm"
                        variant="ghost"
                        leftIcon={<Icon as={CalendarClock} />}
                      >
                        Schedule
                      </Button>
                    )}
                  </HStack>
                </VStack>
              )}

              {hasAmbassador && ambassadorProfile && ambassadorProfile.id !== mentorProfile?.id && (
                <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={3} w="100%" justify="space-between">
                    <HStack spacing={2}>
                      <Avatar size="sm" name={getDisplayName(ambassadorProfile)} src={getAvatarSrc(ambassadorProfile)} />
                      <VStack spacing={0} align="start">
                        <Text fontSize="xs" color="text.secondary">Ambassador</Text>
                        <Text fontWeight="semibold">
                          {getDisplayName(ambassadorProfile)}
                        </Text>
                      </VStack>
                    </HStack>
                    {ambassadorProfile.email && (
                      <Button
                        as="a"
                        href={`mailto:${ambassadorProfile.email}`}
                        size="sm"
                        variant="ghost"
                        leftIcon={<Icon as={MessageCircle} />}
                      >
                        Message
                      </Button>
                    )}
                  </HStack>
                </VStack>
              )}

              {hasMentor && hasAmbassador && mentorProfile && ambassadorProfile && mentorProfile.id === ambassadorProfile.id && (
                <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={3} w="100%" justify="space-between">
                    <HStack spacing={2}>
                      <Avatar size="sm" name={getDisplayName(mentorProfile)} src={getAvatarSrc(mentorProfile)} />
                      <VStack spacing={0} align="start">
                        <Text fontSize="xs" color="text.secondary">Mentor & Ambassador</Text>
                        <Text fontWeight="semibold">
                          {getDisplayName(mentorProfile)}
                        </Text>
                      </VStack>
                    </HStack>
                    {mentorProfile.email && (
                      <HStack spacing={2}>
                        <Button
                          as={Link}
                          to="/app/leadership-council"
                          size="sm"
                          variant="ghost"
                          leftIcon={<Icon as={CalendarClock} />}
                        >
                          Schedule
                        </Button>
                        <Button
                          as="a"
                          href={`mailto:${mentorProfile.email}`}
                          size="sm"
                          variant="ghost"
                          leftIcon={<Icon as={Mail} />}
                        >
                          Message
                        </Button>
                      </HStack>
                    )}
                  </HStack>
                </VStack>
              )}

              {showEmptyState && (
                <VStack align="start" spacing={1} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <Text fontWeight="semibold" color="text.secondary">
                    {hasAssignedIds ? 'Support team details are currently unavailable.' : 'No support team assigned yet.'}
                  </Text>
                  {supportErrorMessages.map((message, index) => (
                    <Text key={`${message}-${index}`} fontSize="sm" color="red.500">
                      {message}
                    </Text>
                  ))}
                </VStack>
              )}
              {!showEmptyState && supportErrorMessages.length > 0 && (
                <VStack align="start" spacing={1}>
                  {supportErrorMessages.map((message, index) => (
                    <Text key={`${message}-${index}`} fontSize="sm" color="red.500">
                      {message}
                    </Text>
                  ))}
                </VStack>
              )}
            </Stack>
          </Skeleton>

          <Divider />

          <Stack spacing={2}>
            <HStack spacing={2}>
              <Icon as={Users} color="brand.primary" />
              <Text fontWeight="semibold" color="#273240">
                Peer Matching
              </Text>
            </HStack>
            <Skeleton isLoaded={!peerMatchesLoading} rounded="md">
              <Stack spacing={2}>
                {hasPeerMatch ? (
                  <Text fontSize="sm" color="text.secondary">
                    You have {completedMatches.length} peer ally{completedMatches.length === 1 ? '' : 's'} ready to connect.
                  </Text>
                ) : (
                  <Text fontSize="sm" color="text.secondary">
                    Find your peer ally to stay accountable this week.
                  </Text>
                )}
                <Button size="sm" variant={hasPeerMatch ? 'link' : 'solid'} colorScheme="purple" alignSelf="flex-start">
                  {hasPeerMatch ? 'View peer matches' : 'Find your peer ally'}
                </Button>
              </Stack>
            </Skeleton>
          </Stack>
        </Stack>
      </CardBody>
    </Card>
  )
}
