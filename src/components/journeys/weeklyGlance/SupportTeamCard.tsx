import { useCallback, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react'
import { CalendarClock, Mail, MessageCircle, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PeerMatch, SupportAssignment } from '@/hooks/useWeeklyGlanceData'
import { useAuth } from '@/hooks/useAuth'
import { UpgradePromptModal } from '@/components/UpgradePromptModal'
import { getDisplayName } from '@/utils/displayName'
import { isFreeUser } from '@/utils/membership'

interface SupportTeamCardProps {
  data: SupportAssignment | null
  loading: boolean
  peerMatches: PeerMatch[]
  peerMatchesLoading: boolean
}

export const SupportTeamCard = ({ data, loading, peerMatches, peerMatchesLoading }: SupportTeamCardProps) => {
  const { profile } = useAuth()
  const isFreeTierUser = isFreeUser(profile)
  const { isOpen: isUpgradeOpen, onOpen: onUpgradeOpen, onClose: onUpgradeClose } = useDisclosure()
  const [upgradeFeatureName, setUpgradeFeatureName] = useState('Premium Feature')
  const [upgradeBenefits, setUpgradeBenefits] = useState<string[]>([])
  const mentorProfile = data?.mentorProfile ?? null
  const ambassadorProfile = data?.ambassadorProfile ?? null
  const hasAssignedIds = Boolean(data?.mentor_id || data?.ambassador_id)
  const hasMentor = Boolean(mentorProfile)
  const hasAmbassador = Boolean(ambassadorProfile)
  const showEmptyState = !loading && !hasMentor && !hasAmbassador
  const activeMatches = peerMatches.filter(match => match.matchStatus !== 'expired')
  const readyMatchCount = activeMatches.length
  const hasPeerMatch = readyMatchCount > 0
  const supportErrorMessages = [data?.mentorProfileError, data?.ambassadorProfileError].filter(
    (message): message is string => Boolean(message),
  )

  const getAvatarSrc = (profile: NonNullable<typeof mentorProfile>) => {
    return profile.avatarUrl || profile.photoURL || undefined
  }

  const promptLeadershipUpgrade = useCallback(() => {
    setUpgradeFeatureName('Leadership Council')
    setUpgradeBenefits([
      'Join leadership council sessions',
      'Book structured mentor conversations',
      'Access premium leadership frameworks',
      'Get deeper accountability support',
    ])
    onUpgradeOpen()
  }, [onUpgradeOpen])

  const promptPeerUpgrade = useCallback(() => {
    setUpgradeFeatureName('Peer Connect')
    setUpgradeBenefits([
      'Access peer matching',
      'Schedule accountability sessions',
      'Track peer session outcomes',
      'Build momentum with premium networking tools',
    ])
    onUpgradeOpen()
  }, [onUpgradeOpen])

  return (
    <Card h="100%" bg="white" borderWidth="1px" borderColor="purple.400" borderRadius="xl">
      <CardBody p={5}>
        <Stack spacing={4}>
          <HStack spacing={2}>
            <Icon as={Users} color="purple.500" boxSize={5} />
            <Text fontWeight="semibold" fontSize="md" color="gray.800" fontFamily="heading">Support Team</Text>
          </HStack>
          <Skeleton isLoaded={!loading} rounded="md">
            <Stack spacing={3}>
              {hasMentor && mentorProfile && mentorProfile.id !== ambassadorProfile?.id && (
                <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={3} w="100%" justify="space-between">
                    <HStack spacing={2}>
                      <Avatar size="sm" name={getDisplayName(mentorProfile, 'Member')} src={getAvatarSrc(mentorProfile)} />
                      <VStack spacing={0} align="start">
                        <Text fontSize="xs" color="text.secondary">Mentor</Text>
                        <Text fontWeight="semibold">
                          {getDisplayName(mentorProfile, 'Member')}
                        </Text>
                      </VStack>
                    </HStack>
                    {mentorProfile.email && (
                      isFreeTierUser ? (
                        <Tooltip label="Upgrade to schedule leadership council sessions." hasArrow openDelay={200}>
                          <Box>
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<Icon as={CalendarClock} />}
                              onClick={promptLeadershipUpgrade}
                              opacity={0.55}
                              filter="grayscale(1)"
                            >
                              Schedule
                            </Button>
                          </Box>
                        </Tooltip>
                      ) : (
                        <Button
                          as={Link}
                          to="/app/leadership-council"
                          size="sm"
                          variant="ghost"
                          leftIcon={<Icon as={CalendarClock} />}
                        >
                          Schedule
                        </Button>
                      )
                    )}
                  </HStack>
                </VStack>
              )}

              {hasAmbassador && ambassadorProfile && ambassadorProfile.id !== mentorProfile?.id && (
                <VStack align="start" spacing={2} p={3} borderWidth="1px" borderColor="border.subtle" rounded="md">
                  <HStack spacing={3} w="100%" justify="space-between">
                    <HStack spacing={2}>
                      <Avatar size="sm" name={getDisplayName(ambassadorProfile, 'Member')} src={getAvatarSrc(ambassadorProfile)} />
                      <VStack spacing={0} align="start">
                        <Text fontSize="xs" color="text.secondary">Ambassador</Text>
                        <Text fontWeight="semibold">
                          {getDisplayName(ambassadorProfile, 'Member')}
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
                      <Avatar size="sm" name={getDisplayName(mentorProfile, 'Member')} src={getAvatarSrc(mentorProfile)} />
                      <VStack spacing={0} align="start">
                        <Text fontSize="xs" color="text.secondary">Mentor & Ambassador</Text>
                        <Text fontWeight="semibold">
                          {getDisplayName(mentorProfile, 'Member')}
                        </Text>
                      </VStack>
                    </HStack>
                    {mentorProfile.email && (
                      <HStack spacing={2}>
                        {isFreeTierUser ? (
                          <Tooltip label="Upgrade to schedule leadership council sessions." hasArrow openDelay={200}>
                            <Box>
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<Icon as={CalendarClock} />}
                                onClick={promptLeadershipUpgrade}
                                opacity={0.55}
                                filter="grayscale(1)"
                              >
                                Schedule
                              </Button>
                            </Box>
                          </Tooltip>
                        ) : (
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
              <Text fontWeight="semibold" color="text.primary">
                Peer Matching
              </Text>
            </HStack>
            <Skeleton isLoaded={!peerMatchesLoading} rounded="md">
              <Stack spacing={2}>
                {hasPeerMatch ? (
                  <Text fontSize="sm" color="text.secondary">
                    You have {readyMatchCount} peer ally{readyMatchCount === 1 ? '' : 's'} ready to connect.
                  </Text>
                ) : (
                  <Text fontSize="sm" color="text.secondary">
                    Find your peer ally to stay accountable this week.
                  </Text>
                )}
                {isFreeTierUser ? (
                  <Tooltip label="Upgrade to unlock peer matching and sessions." hasArrow openDelay={200}>
                    <Box>
                      <Button
                        size="sm"
                        variant={hasPeerMatch ? 'link' : 'solid'}
                        colorScheme="purple"
                        alignSelf="flex-start"
                        onClick={promptPeerUpgrade}
                        opacity={0.55}
                        filter="grayscale(1)"
                      >
                        {hasPeerMatch ? 'View peer matches' : 'Find your peer ally'}
                      </Button>
                    </Box>
                  </Tooltip>
                ) : (
                  <Button
                    as={Link}
                    to="/app/peer-connect"
                    size="sm"
                    variant={hasPeerMatch ? 'link' : 'solid'}
                    colorScheme="purple"
                    alignSelf="flex-start"
                  >
                    {hasPeerMatch ? 'View peer matches' : 'Find your peer ally'}
                  </Button>
                )}
              </Stack>
            </Skeleton>
          </Stack>
        </Stack>
      </CardBody>

      <UpgradePromptModal
        featureName={upgradeFeatureName}
        benefits={upgradeBenefits.length ? upgradeBenefits : ['Unlock premium collaboration features']}
        isOpen={isUpgradeOpen}
        onClose={onUpgradeClose}
      />
    </Card>
  )
}
