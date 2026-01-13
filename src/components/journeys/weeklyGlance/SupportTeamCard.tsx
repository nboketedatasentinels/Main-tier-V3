import {
  Avatar,
  Button,
  Card,
  CardBody,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Mail, MessageCircle } from 'lucide-react'
import { SupportAssignment } from '@/hooks/useWeeklyGlanceData'

interface SupportTeamCardProps {
  data: SupportAssignment | null
  loading: boolean
}

export const SupportTeamCard = ({ data, loading }: SupportTeamCardProps) => {
  const mentorProfile = data?.mentorProfile ?? null
  const ambassadorProfile = data?.ambassadorProfile ?? null
  const hasAssignedIds = Boolean(data?.mentor_id || data?.ambassador_id)
  const hasMentor = Boolean(mentorProfile)
  const hasAmbassador = Boolean(ambassadorProfile)
  const showEmptyState = !loading && !hasMentor && !hasAmbassador
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
      <CardBody>
        <Stack spacing={4}>
          <Text fontWeight="bold" color="#273240">Support Team</Text>
          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={3}>
              {hasMentor && mentorProfile && (
                <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={3} w="100%" justify="space-between">
                    <HStack spacing={2}>
                      <Avatar size="sm" name={getDisplayName(mentorProfile)} src={getAvatarSrc(mentorProfile)} />
                      <VStack spacing={0} align="start">
                        <Text fontWeight="semibold">Mentor</Text>
                        <Text fontSize="sm" color="text.secondary">
                          {getDisplayName(mentorProfile)}
                        </Text>
                        {mentorProfile.email && (
                          <Text fontSize="xs" color="text.secondary">
                            {mentorProfile.email}
                          </Text>
                        )}
                      </VStack>
                    </HStack>
                    <Button size="sm" leftIcon={<Icon as={Mail} />}>Contact</Button>
                  </HStack>
                </VStack>
              )}

              {hasAmbassador && ambassadorProfile && (
                <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={3} w="100%" justify="space-between">
                    <HStack spacing={2}>
                      <Avatar size="sm" name={getDisplayName(ambassadorProfile)} src={getAvatarSrc(ambassadorProfile)} />
                      <VStack spacing={0} align="start">
                        <Text fontWeight="semibold">Ambassador</Text>
                        <Text fontSize="sm" color="text.secondary">
                          {getDisplayName(ambassadorProfile)}
                        </Text>
                        {ambassadorProfile.email && (
                          <Text fontSize="xs" color="text.secondary">
                            {ambassadorProfile.email}
                          </Text>
                        )}
                      </VStack>
                    </HStack>
                    <Button size="sm" leftIcon={<Icon as={MessageCircle} />}>Message</Button>
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
        </Stack>
      </CardBody>
    </Card>
  )
}
