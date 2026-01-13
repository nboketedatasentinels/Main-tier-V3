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
  const mentorProfile = data?.mentor ?? null
  const ambassadorProfile = data?.ambassador ?? null
  const transformationPartnerProfile = data?.transformationPartner ?? null
  const hasMentor = Boolean(mentorProfile)
  const hasAmbassador = Boolean(ambassadorProfile)
  const hasTransformationPartner = Boolean(transformationPartnerProfile)
  const showEmptyState = !loading && !hasMentor && !hasAmbassador && !hasTransformationPartner

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

              {hasTransformationPartner && transformationPartnerProfile && (
                <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={3} w="100%" justify="space-between">
                    <HStack spacing={2}>
                      <Avatar
                        size="sm"
                        name={getDisplayName(transformationPartnerProfile)}
                        src={getAvatarSrc(transformationPartnerProfile)}
                      />
                      <VStack spacing={0} align="start">
                        <Text fontWeight="semibold">Transformation Partner</Text>
                        <Text fontSize="sm" color="text.secondary">
                          {getDisplayName(transformationPartnerProfile)}
                        </Text>
                        {transformationPartnerProfile.email && (
                          <Text fontSize="xs" color="text.secondary">
                            {transformationPartnerProfile.email}
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
                    No support team assigned yet.
                  </Text>
                </VStack>
              )}
            </Stack>
          </Skeleton>
        </Stack>
      </CardBody>
    </Card>
  )
}
