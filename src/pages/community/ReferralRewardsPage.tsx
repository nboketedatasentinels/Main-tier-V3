import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import {
  Award,
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Facebook,
  Gift,
  Instagram,
  Layers,
  Link2,
  Linkedin,
  Lock,
  Mail,
  MessageCircle,
  Medal,
  Rocket,
  Share2,
  Sparkles,
  Twitter,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { APP_BASE_URL } from '@/config/app'
import { db } from '@/services/firebase'
import { InstagramShareModal, SocialShareModal } from '@/components/modals/SocialShareModal'

const MotionBox = motion(Box)
const MotionFlex = motion(Flex)

interface RewardTier {
  id: number
  title: string
  required: number
  reward: string
  description: string
  emoji: string
  icon: LucideIcon
  gradient: string
  accent: string
}

interface ReferralRecord {
  referredUid: string
  referrerUid: string
  refCode: string
  status: 'pending' | 'credited' | 'rejected'
  createdAt?: { toDate?: () => Date } | string | null
}

const rewardTiers: RewardTier[] = [
  {
    id: 1,
    title: 'First Referral',
    required: 1,
    reward: '100 Points',
    description: 'Small dopamine hit. Points can be used for leaderboard bragging rights.',
    emoji: '💯',
    icon: Gift,
    gradient: 'linear-gradient(135deg, #ffe2f5, #ffd9e8)',
    accent: '#ec4899',
  },
  {
    id: 2,
    title: 'Community Builder Badge',
    required: 5,
    reward: 'Community Builder Badge',
    description:
      'Visible on their profile + bragging rights in the leaderboard. Unlocks access to a bonus micro-learning.',
    emoji: '🏅',
    icon: Medal,
    gradient: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    accent: '#f59e0b',
  },
  {
    id: 3,
    title: "25% Off 'AI Stacking 101' Course",
    required: 15,
    reward: "25% Off 'AI Stacking 101'",
    description: 'Enjoy an exclusive 25% discount on the flagship AI Stacking 101 mastery course.',
    emoji: '🧠',
    icon: Layers,
    gradient: 'linear-gradient(135deg, #dbeafe, #e0e7ff)',
    accent: '#2563eb',
  },
  {
    id: 4,
    title: 'Featured Recognition',
    required: 20,
    reward: "Featured in 'Referrer of the Month'",
    description: "Featured in a community newsletter section ('Referrer of the Month').",
    emoji: '🌟',
    icon: Award,
    gradient: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
    accent: '#16a34a',
  },
]

export const ReferralRewardsPage: React.FC = () => {
  const { user, profile } = useAuth()
  const toast = useToast()
  const shareModal = useDisclosure()
  const instagramModal = useDisclosure()
  const [copied, setCopied] = useState(false)
  const [referrals, setReferrals] = useState<ReferralRecord[]>([])
  const [referralsLoading, setReferralsLoading] = useState(false)

  const baseAppUrl = APP_BASE_URL

  useEffect(() => {
    if (!user?.uid) return
    setReferralsLoading(true)
    const referralQuery = query(
      collection(db, 'referrals'),
      where('referrerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(
      referralQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => doc.data() as ReferralRecord)
        setReferrals(items)
        setReferralsLoading(false)
      },
      (error) => {
        console.error('🔴 [Referral] Unable to load referrals', error)
        setReferralsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user?.uid])

  const creditedCount = useMemo(
    () => referrals.filter((referral) => referral.status === 'credited').length,
    [referrals]
  )
  const pendingCount = useMemo(
    () => referrals.filter((referral) => referral.status === 'pending').length,
    [referrals]
  )

  const referralCount = creditedCount > 0 ? creditedCount : profile?.referralCount ?? 0
  const referralCode = profile?.referralCode ?? user?.uid

  const referralLink = useMemo(() => {
    const sanitizedBase = baseAppUrl.endsWith('/') ? baseAppUrl.slice(0, -1) : baseAppUrl
    return referralCode ? `${sanitizedBase}/auth?ref=${referralCode}` : `${sanitizedBase}/auth`
  }, [baseAppUrl, referralCode])

  const nextTier = rewardTiers.find(tier => referralCount < tier.required)
  const progressToNext = nextTier ? Math.min((referralCount / nextTier.required) * 100, 100) : 100
  const referralsNeeded = nextTier ? nextTier.required - referralCount : 0

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast({
        title: 'Referral link copied to clipboard!',
        status: 'success',
        duration: 2000,
        isClosable: true,
      })
      setTimeout(() => setCopied(false), 3000)
    } catch (error) {
      toast({
        title: 'Unable to copy link',
        description: 'Please try again or copy manually.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: 'Join me on Transformation Tier!',
      text: "I'm building my transformation journey and would love for you to join me!",
      url: referralLink,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        // If user cancels or share fails, fall back to copy
        await handleCopy()
      }
      return
    }

    await handleCopy()
  }

  const shareMessage = 'Join me on Transformation Tier and start your growth journey!'
  const messageWithLink = `${shareMessage} ${referralLink}`

  const openShareUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleWhatsAppShare = () => {
    openShareUrl(`https://wa.me/?text=${encodeURIComponent(messageWithLink)}`)
  }

  const handleFacebookShare = () => {
    openShareUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`)
  }

  const handleTwitterShare = () => {
    openShareUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(messageWithLink)}`)
  }

  const handleLinkedInShare = () => {
    openShareUrl(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`)
  }

  const handleEmailShare = () => {
    const subject = 'Join me on Transformation Tier'
    openShareUrl(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageWithLink)}`)
  }

  const handleInstagramShare = async () => {
    await handleCopy()
    shareModal.onClose()
    instagramModal.onOpen()
  }

  const shareActions = useMemo(
    () => [
      {
        label: 'Copy Link',
        description: 'Grab your referral URL',
        icon: Link2,
        color: 'gray.700',
        bg: 'gray.100',
        onClick: handleCopy,
      },
      {
        label: 'WhatsApp',
        description: 'Send a quick message',
        icon: MessageCircle,
        color: 'white',
        bg: '#25D366',
        onClick: handleWhatsAppShare,
      },
      {
        label: 'Instagram',
        description: 'Share to bio or story',
        icon: Instagram,
        color: 'white',
        bg: '#E1306C',
        onClick: handleInstagramShare,
      },
      {
        label: 'Facebook',
        description: 'Post to your feed',
        icon: Facebook,
        color: 'white',
        bg: '#1877F2',
        onClick: handleFacebookShare,
      },
      {
        label: 'LinkedIn',
        description: 'Share professionally',
        icon: Linkedin,
        color: 'white',
        bg: '#0A66C2',
        onClick: handleLinkedInShare,
      },
      {
        label: 'Twitter',
        description: 'Tweet your invite',
        icon: Twitter,
        color: 'white',
        bg: '#1DA1F2',
        onClick: handleTwitterShare,
      },
      {
        label: 'Email',
        description: 'Send a direct note',
        icon: Mail,
        color: 'white',
        bg: '#6B7280',
        onClick: handleEmailShare,
      },
    ],
    [
      handleCopy,
      handleEmailShare,
      handleFacebookShare,
      handleInstagramShare,
      handleLinkedInShare,
      handleTwitterShare,
      handleWhatsAppShare,
    ]
  )

  return (
    <Stack spacing={8} px={{ base: 0, md: 1 }}>
      <SocialShareModal isOpen={shareModal.isOpen} onClose={shareModal.onClose} actions={shareActions} />
      <InstagramShareModal isOpen={instagramModal.isOpen} onClose={instagramModal.onClose} />
      <MotionFlex
        bg="white"
        border="1px solid"
        borderColor="brand.border"
        borderRadius="2xl"
        p={{ base: 6, md: 8 }}
        align="center"
        justify="space-between"
        direction={{ base: 'column', md: 'row' }}
        gap={6}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        boxShadow="md"
      >
        <Stack spacing={3} align={{ base: 'center', md: 'flex-start' }} textAlign={{ base: 'center', md: 'left' }}>
          <HStack spacing={3} color="brand.primary">
            <Text fontSize="2xl">🚀🚀</Text>
            <Badge colorScheme="purple" variant="subtle" px={3} py={1} borderRadius="full">
              Tier Ambassador Program
            </Badge>
          </HStack>
          <Heading size="lg" color="brand.text">
            Tier Ambassador Program
          </Heading>
          <Text color="brand.subtleText" fontSize="lg" maxW="2xl">
            Grow your crew. Grow your impact. Share your referral link to unlock rewards, recognition, and exclusive perks.
          </Text>
        </Stack>
        <HStack spacing={3}>
          <Button leftIcon={<Icon as={Share2} />} colorScheme="purple" variant="outline" onClick={shareModal.onOpen}>
            Share
          </Button>
          <Button leftIcon={<Icon as={UserPlus} />} colorScheme="purple" onClick={shareModal.onOpen}>
            Invite Friends Now
          </Button>
        </HStack>
      </MotionFlex>

      <MotionBox
        bg="white"
        border="1px solid"
        borderColor="brand.border"
        borderRadius="2xl"
        p={{ base: 6, md: 8 }}
        boxShadow="md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <HStack justify="space-between" align={{ base: 'flex-start', md: 'center' }} spacing={4} flexDir={{ base: 'column', md: 'row' }}>
          <HStack spacing={3} align="center">
            <Flex
              bg="purple.50"
              color="purple.600"
              borderRadius="full"
              p={3}
              align="center"
              justify="center"
            >
              <Icon as={Users} boxSize={6} />
            </Flex>
            <Stack spacing={1}>
              <Text fontWeight="semibold" color="brand.text">
                Your Progress
              </Text>
              <Text color="brand.subtleText">Track your referrals and unlock rewards.</Text>
            </Stack>
          </HStack>
          <HStack spacing={4} align="center">
            <Stack spacing={0} textAlign={{ base: 'left', md: 'right' }}>
              <Text fontSize="xs" color="brand.subtleText">
                Current referrals
              </Text>
              <Heading size="lg" color="brand.text">
                {referralCount}
              </Heading>
            </Stack>
            <Box h="50px" w="1px" bg="brand.border" display={{ base: 'none', md: 'block' }} />
            <Stack spacing={0} textAlign={{ base: 'left', md: 'right' }}>
              <Text fontSize="xs" color="brand.subtleText">
                Next milestone
              </Text>
              <Text fontWeight="semibold" color="brand.text">
                {nextTier ? `${nextTier.required} referrals` : 'All tiers unlocked'}
              </Text>
            </Stack>
          </HStack>
        </HStack>

        <Stack spacing={3} mt={6}>
          <Progress
            value={progressToNext}
            size="lg"
            borderRadius="full"
            colorScheme="purple"
            bg="gray.100"
            hasStripe
            isAnimated
          />
          <Flex justify="space-between" align="center">
            <Text color="brand.subtleText" fontWeight="medium">
              {nextTier ? `${referralCount} / ${nextTier.required} referrals` : `${referralCount} referrals`}
            </Text>
            <Text color="brand.subtleText">
              {nextTier
                ? `You have ${referralCount} referrals — ${referralsNeeded} more to unlock your next reward!`
                : 'Amazing! You have unlocked every reward tier.'}
            </Text>
          </Flex>
        </Stack>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={6}>
          <Box border="1px solid" borderColor="brand.border" borderRadius="xl" p={4} bg="gray.50">
            <Text fontSize="xs" color="brand.subtleText" textTransform="uppercase" letterSpacing="wide">
              Pending referrals
            </Text>
            <Heading size="md" color="brand.text">
              {pendingCount}
            </Heading>
          </Box>
          <Box border="1px solid" borderColor="brand.border" borderRadius="xl" p={4} bg="gray.50">
            <Text fontSize="xs" color="brand.subtleText" textTransform="uppercase" letterSpacing="wide">
              Credited referrals
            </Text>
            <Heading size="md" color="brand.text">
              {creditedCount}
            </Heading>
          </Box>
        </SimpleGrid>
      </MotionBox>

      <Stack spacing={4}>
        <Flex align="center" justify="space-between" gap={3}>
          <Heading size="md" color="brand.text">
            Reward Tiers
          </Heading>
          <HStack color="brand.subtleText" spacing={2}>
            <Icon as={Sparkles} />
            <Text fontSize="sm">Earn rewards as your crew grows.</Text>
          </HStack>
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {rewardTiers.map((tier, index) => {
            const isAchieved = referralCount >= tier.required

            return (
              <MotionBox
                key={tier.id}
                borderRadius="xl"
                overflow="hidden"
                border="1px solid"
                borderColor={isAchieved ? 'purple.200' : 'brand.border'}
                bg={isAchieved ? tier.gradient : 'gray.50'}
                boxShadow="md"
                whileHover={{ scale: 1.01 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
              >
                <Box position="relative" p={{ base: 5, md: 6 }}>
                  {isAchieved ? (
                    <Badge
                      colorScheme="green"
                      position="absolute"
                      top={4}
                      right={4}
                      borderRadius="full"
                      px={3}
                      py={1}
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      <Icon as={CheckCircle2} boxSize={4} />
                      Achieved
                    </Badge>
                  ) : (
                    <Badge
                      colorScheme="gray"
                      position="absolute"
                      top={4}
                      right={4}
                      borderRadius="full"
                      px={3}
                      py={1}
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      <Icon as={Lock} boxSize={4} />
                      Locked
                    </Badge>
                  )}

                  <HStack spacing={3} mb={4} align="center">
                    <Flex
                      bg="white"
                      borderRadius="full"
                      p={2}
                      color={tier.accent}
                      boxShadow="sm"
                      align="center"
                      justify="center"
                    >
                      <Icon as={tier.icon} boxSize={6} />
                    </Flex>
                    <Stack spacing={0}>
                      <Text fontSize="sm" color="brand.subtleText">
                        {tier.required} Referrals
                      </Text>
                      <HStack spacing={2}>
                        <Text fontWeight="bold" color="brand.text">
                          {tier.emoji} {tier.title}
                        </Text>
                      </HStack>
                    </Stack>
                  </HStack>

                  <Stack spacing={2}>
                    <HStack spacing={2} align="center">
                      <Icon as={BadgeCheck} color={tier.accent} />
                      <Text fontWeight="semibold" color="brand.text">
                        {tier.reward}
                      </Text>
                    </HStack>
                    <Text color="brand.subtleText">{tier.description}</Text>
                  </Stack>

                  {isAchieved && (
                    <Button
                      mt={4}
                      colorScheme="purple"
                      variant="solid"
                      size="sm"
                      leftIcon={<Icon as={Gift} />}
                    >
                      Claim Reward
                    </Button>
                  )}
                </Box>
              </MotionBox>
            )
          })}
        </SimpleGrid>
      </Stack>

      <MotionBox
        bg="white"
        border="1px solid"
        borderColor="brand.border"
        borderRadius="2xl"
        p={{ base: 6, md: 8 }}
        boxShadow="md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <Stack spacing={4}>
          <HStack justify="space-between" align="center">
            <Heading size="md" color="brand.text">
              Recent referrals
            </Heading>
            {referralsLoading && (
              <HStack spacing={2} color="brand.subtleText">
                <Text fontSize="sm">Loading</Text>
              </HStack>
            )}
          </HStack>

          {referrals.length === 0 && !referralsLoading ? (
            <Text color="brand.subtleText">No referrals yet. Share your link to get started!</Text>
          ) : (
            <Stack spacing={3}>
              {referrals.slice(0, 5).map((referral, index) => (
                <Flex
                  key={`${referral.referredUid}-${index}`}
                  justify="space-between"
                  align="center"
                  border="1px solid"
                  borderColor="brand.border"
                  borderRadius="lg"
                  px={4}
                  py={3}
                >
                  <Stack spacing={1}>
                    <Text fontWeight="semibold" color="brand.text">
                      Referral #{referrals.length - index}
                    </Text>
                    <Text fontSize="sm" color="brand.subtleText">
                      Code: {referral.refCode}
                    </Text>
                  </Stack>
                  <Badge
                    colorScheme={
                      referral.status === 'credited'
                        ? 'green'
                        : referral.status === 'pending'
                          ? 'yellow'
                          : 'red'
                    }
                    borderRadius="full"
                    px={3}
                  >
                    {referral.status}
                  </Badge>
                </Flex>
              ))}
            </Stack>
          )}
        </Stack>
      </MotionBox>

      <MotionBox
        bgGradient="linear(to-r, purple.600, purple.700)"
        borderRadius="2xl"
        p={{ base: 6, md: 8 }}
        color="white"
        boxShadow="xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Stack spacing={4}>
          <HStack spacing={3}>
            <Icon as={Rocket} color="white" />
            <Text fontWeight="bold" color="white">
              Ready to Grow Your Crew?
            </Text>
          </HStack>
          <Heading size="md" color="white">
            Share your link and start building your community.
          </Heading>
          <Text opacity={0.9} maxW="3xl" color="white">
            Invite friends, peers, or teammates to Transformation Tier. Each successful signup counts toward your next reward
            and helps expand our community of ambitious leaders.
          </Text>

          <Box bg="white" color="brand.text" p={4} borderRadius="lg" boxShadow="md">
            <Stack direction={{ base: 'column', md: 'row' }} spacing={3} align="center">
              <Box
                bg="gray.50"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                px={4}
                py={3}
                fontFamily="mono"
                fontSize="sm"
                width="full"
                overflow="hidden"
              >
                <Text isTruncated>{referralLink}</Text>
              </Box>
              <HStack spacing={2} width={{ base: 'full', md: 'auto' }}>
                <Button
                  leftIcon={<Icon as={copied ? Check : Copy} />}
                  variant="outline"
                  colorScheme="purple"
                  width={{ base: 'full', md: 'auto' }}
                  onClick={handleCopy}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  leftIcon={<Icon as={ExternalLink} />}
                  variant="outline"
                  colorScheme="purple"
                  width={{ base: 'full', md: 'auto' }}
                  onClick={shareModal.onOpen}
                >
                  Share
                </Button>
              </HStack>
            </Stack>
          </Box>

          <HStack spacing={3} flexWrap="wrap">
            <Button
              leftIcon={<Icon as={UserPlus} />}
              colorScheme="whiteAlpha"
              variant="solid"
              bg="white"
              color="purple.700"
              _hover={{ bg: 'gray.50' }}
              onClick={shareModal.onOpen}
            >
              Invite Friends Now
            </Button>
            <Button
              leftIcon={<Icon as={Share2} />}
              variant="ghost"
              colorScheme="whiteAlpha"
              onClick={handleShare}
            >
              Quick Share
            </Button>
          </HStack>
        </Stack>
      </MotionBox>
    </Stack>
  )
}
