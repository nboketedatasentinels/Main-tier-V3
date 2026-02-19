import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Facebook,
  Gift,
  Instagram,
  Link2,
  Linkedin,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Share2,
  Sparkles,
  Twitter,
  UserPlus,
  Users,
} from 'lucide-react'
import { arrayUnion, doc, updateDoc } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { APP_BASE_URL } from '@/config/app'
import { db } from '@/services/firebase'
import { InstagramShareModal, SocialShareModal } from '@/components/modals/SocialShareModal'
import { REWARD_TIERS, type RewardTier } from '@/config/referralRewards'
import {
  generateReferralCode,
  subscribeToReferrals,
  verifyMyPendingReferrals,
  type ReferralWithDetails,
} from '@/services/referralService'
import { getCourseDetailsFromMapping } from '@/utils/courseMappings'

const MotionBox = motion(Box)
const MotionFlex = motion(Flex)
const AI_STACKING_TITLE = 'AI Stacking 101: Boost Your Productivity (No Tech Skills Needed)'
const AI_STACKING_COUPON_CODE = 'Ai101'

const ReferralRewardsPage: React.FC = () => {
  const { user, profile, updateProfile } = useAuth()
  const toast = useToast()
  const shareModal = useDisclosure()
  const instagramModal = useDisclosure()
  const [copied, setCopied] = useState(false)
  const [referrals, setReferrals] = useState<ReferralWithDetails[]>([])
  const [referralsLoading, setReferralsLoading] = useState(false)
  const [referralsError, setReferralsError] = useState<string | null>(null)
  const [resolvedReferralCode, setResolvedReferralCode] = useState<string | null>(profile?.referralCode ?? user?.uid ?? null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const baseAppUrl = APP_BASE_URL

  useEffect(() => {
    if (!user?.uid) return
    setReferralsLoading(true)
    setReferralsError(null)

    const unsubscribe = subscribeToReferrals(
      user.uid,
      (updatedReferrals) => {
        setReferrals(updatedReferrals)
        setReferralsLoading(false)
        setIsRefreshing(false)
        setReferralsError(null)
      },
      (error) => {
        console.error('🔴 [Referral] Unable to load referrals', error)
        setReferralsError(
          error.message?.includes('permission')
            ? 'Unable to load referrals. You may not have permission to view this data.'
            : 'Unable to load referrals. Please try refreshing the page.'
        )
        setReferralsLoading(false)
        setIsRefreshing(false)
      }
    )

    return () => unsubscribe()
  }, [user?.uid, refreshKey])

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    setReferralsError(null)
    setRefreshKey((k) => k + 1)
  }, [])

  const handleVerifyPending = useCallback(async () => {
    setIsVerifying(true)
    try {
      const result = await verifyMyPendingReferrals()
      toast({
        title: result.credited > 0 ? 'Referrals verified!' : 'Verification complete',
        description: result.message,
        status: result.credited > 0 ? 'success' : 'info',
        duration: 5000,
        isClosable: true,
      })
      if (result.credited > 0) {
        handleRefresh()
      }
    } catch {
      toast({
        title: 'Verification failed',
        description: 'Unable to verify referrals right now. Please try again later.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsVerifying(false)
    }
  }, [handleRefresh, toast])

  useEffect(() => {
    setResolvedReferralCode(profile?.referralCode ?? user?.uid ?? null)
  }, [profile?.referralCode, user?.uid])

  useEffect(() => {
    if (!user?.uid || profile?.referralCode) return

    let isCancelled = false
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    const maxAttempts = 3

    const persistGeneratedReferralCode = async (attempt = 1): Promise<void> => {
      try {
        const generatedCode = await generateReferralCode(user.uid)
        if (isCancelled) return

        if (updateProfile) {
          await updateProfile({ referralCode: generatedCode })
        }

        if (!isCancelled) {
          setResolvedReferralCode(generatedCode)
        }
      } catch (error) {
        if (isCancelled) return

        if (attempt < maxAttempts) {
          const retryDelayMs = 500 * 2 ** (attempt - 1)
          retryTimeout = setTimeout(() => {
            void persistGeneratedReferralCode(attempt + 1)
          }, retryDelayMs)
          return
        }

        setResolvedReferralCode(null)
        console.error('🔴 [Referral] Unable to auto-generate and persist referral code', error)
      }
    }

    void persistGeneratedReferralCode()

    return () => {
      isCancelled = true
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
    }
  }, [profile?.referralCode, updateProfile, user?.uid])

  const creditedCount = useMemo(
    () => referrals.filter((referral) => referral.status === 'credited').length,
    [referrals]
  )
  const pendingCount = useMemo(
    () => referrals.filter((referral) => referral.status === 'pending').length,
    [referrals]
  )

  const creditedReferralCount = Math.max(creditedCount, profile?.referralCount ?? 0)
  const totalReferralCount = pendingCount + creditedReferralCount
  const milestoneReferralCount = creditedReferralCount
  const referralCode = resolvedReferralCode
  const claimedRewards = profile?.claimedRewards ?? []

  const referralLink = useMemo(() => {
    const sanitizedBase = baseAppUrl.endsWith('/') ? baseAppUrl.slice(0, -1) : baseAppUrl
    return referralCode ? `${sanitizedBase}/join?ref=${referralCode}` : `${sanitizedBase}/join`
  }, [baseAppUrl, referralCode])

  const nextTier = REWARD_TIERS.find((tier) => milestoneReferralCount < tier.required)
  const progressToNext = nextTier ? Math.min((milestoneReferralCount / nextTier.required) * 100, 100) : 100
  const referralsNeeded = nextTier ? nextTier.required - milestoneReferralCount : 0

  const handleCopy = useCallback(async () => {
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
  }, [referralLink, toast])

  const handleShare = useCallback(async () => {
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
  }, [handleCopy, referralLink])

  const shareMessage = 'Join me on Transformation Tier and start your growth journey!'
  const messageWithLink = `${shareMessage} ${referralLink}`
  const aiStackingCourseLink =
    getCourseDetailsFromMapping(AI_STACKING_TITLE)?.link ?? `${baseAppUrl.replace(/\/$/, '')}/app/courses`

  const openShareUrl = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const handleWhatsAppShare = useCallback(() => {
    openShareUrl(`https://wa.me/?text=${encodeURIComponent(messageWithLink)}`)
  }, [messageWithLink, openShareUrl])

  const handleFacebookShare = useCallback(() => {
    openShareUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`)
  }, [referralLink, openShareUrl])

  const handleTwitterShare = useCallback(() => {
    openShareUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(messageWithLink)}`)
  }, [messageWithLink, openShareUrl])

  const handleLinkedInShare = useCallback(() => {
    openShareUrl(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`)
  }, [referralLink, openShareUrl])

  const handleEmailShare = useCallback(() => {
    const subject = 'Join me on Transformation Tier'
    openShareUrl(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageWithLink)}`)
  }, [messageWithLink, openShareUrl])

  const handleCouponCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AI_STACKING_COUPON_CODE)
      toast({
        title: 'Coupon code copied',
        description: `Use code ${AI_STACKING_COUPON_CODE} at checkout.`,
        status: 'success',
        duration: 2500,
        isClosable: true,
      })
    } catch (error) {
      toast({
        title: 'Unable to copy coupon code',
        description: `Please copy it manually: ${AI_STACKING_COUPON_CODE}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }, [toast])

  const handleInstagramShare = useCallback(async () => {
    await handleCopy()
    shareModal.onClose()
    instagramModal.onOpen()
  }, [handleCopy, instagramModal, shareModal])

  const [claiming, setClaiming] = useState<number | null>(null)

  const handleClaimReward = async (tier: RewardTier) => {
    if (!user?.uid) return
    if (claiming !== null) return

    setClaiming(tier.id)
    try {
      const userRef = doc(db, 'users', user.uid)
      const profileRef = doc(db, 'profiles', user.uid)

      await Promise.all([
        updateDoc(userRef, {
          claimedRewards: arrayUnion(tier.id),
        }),
        updateDoc(profileRef, {
          claimedRewards: arrayUnion(tier.id),
        }),
      ])

      toast({
        title: 'Reward claimed! 🎉',
        description: `You have successfully claimed: ${tier.reward}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      if (updateProfile) {
        await updateProfile({
          claimedRewards: Array.from(new Set([...claimedRewards, tier.id])),
        })
      }
    } catch (error) {
      console.error('🔴 [Referral] Failed to claim reward', error)
      toast({
        title: 'Claim failed',
        description: 'Unable to claim reward at this time. Please try again later.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setClaiming(null)
    }
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
              <HStack spacing={2}>
                <Text fontWeight="semibold" color="brand.text">
                  Your Progress
                </Text>
                <Tooltip label="Refresh referral data" placement="top">
                  <IconButton
                    aria-label="Refresh"
                    icon={<Icon as={RefreshCw} boxSize={4} className={isRefreshing ? 'animate-spin' : ''} />}
                    size="xs"
                    variant="ghost"
                    colorScheme="purple"
                    onClick={handleRefresh}
                    isLoading={isRefreshing}
                  />
                </Tooltip>
              </HStack>
              <Text color="brand.subtleText">Track your referrals and unlock rewards.</Text>
            </Stack>
          </HStack>
          <HStack spacing={4} align="center">
            <Stack spacing={0} textAlign={{ base: 'left', md: 'right' }}>
              <Text fontSize="xs" color="brand.subtleText">
                Total signups
              </Text>
              <Heading size="lg" color="brand.text">
                {totalReferralCount}
              </Heading>
            </Stack>
            <Box h="50px" w="1px" bg="brand.border" display={{ base: 'none', md: 'block' }} />
            <Stack spacing={0} textAlign={{ base: 'left', md: 'right' }}>
              <Text fontSize="xs" color="brand.subtleText">
                Next milestone
              </Text>
              <Text fontWeight="semibold" color="brand.text">
                {nextTier ? `${nextTier.required} activated referrals` : 'All tiers unlocked'}
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
              {nextTier
                ? `${milestoneReferralCount} / ${nextTier.required} activated referrals`
                : `${milestoneReferralCount} activated referrals`}
            </Text>
            <Text color="brand.subtleText">
              {nextTier
                ? `You have ${milestoneReferralCount} activated referrals — ${referralsNeeded} more to unlock your next reward!`
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
            <Text fontSize="xs" color="brand.subtleText" mt={1}>
              Awaiting first activity.
            </Text>
          </Box>
          <Box border="1px solid" borderColor="brand.border" borderRadius="xl" p={4} bg="gray.50">
            <Text fontSize="xs" color="brand.subtleText" textTransform="uppercase" letterSpacing="wide">
              Activated referrals
            </Text>
            <Heading size="md" color="brand.text">
              {creditedReferralCount}
            </Heading>
            <Text fontSize="xs" color="brand.subtleText" mt={1}>
              Completed first activity.
            </Text>
          </Box>
        </SimpleGrid>
        {referralsError && (
          <Alert status="warning" borderRadius="lg" mt={4}>
            <AlertIcon />
            <AlertDescription>
              <HStack spacing={2} align="center" flexWrap="wrap">
                <Icon as={AlertTriangle} boxSize={4} />
                <Text>{referralsError}</Text>
                <Button size="xs" variant="outline" colorScheme="orange" onClick={handleRefresh}>
                  Retry
                </Button>
              </HStack>
            </AlertDescription>
          </Alert>
        )}

        {pendingCount > 0 && (
          <Box mt={4} p={4} border="1px solid" borderColor="purple.200" borderRadius="xl" bg="purple.50">
            <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
              <Stack spacing={1}>
                <HStack spacing={2}>
                  <Icon as={ShieldCheck} color="purple.600" boxSize={5} />
                  <Text fontWeight="semibold" color="brand.text">
                    {pendingCount} pending referral{pendingCount !== 1 ? 's' : ''} awaiting verification
                  </Text>
                </HStack>
                <Text fontSize="sm" color="brand.subtleText">
                  If your referred users have completed their first activity, click verify to check and credit your referrals.
                </Text>
              </Stack>
              <Button
                size="sm"
                colorScheme="purple"
                leftIcon={<Icon as={ShieldCheck} boxSize={4} />}
                onClick={handleVerifyPending}
                isLoading={isVerifying}
                loadingText="Verifying..."
              >
                Verify Pending
              </Button>
            </HStack>
          </Box>
        )}

        <Text fontSize="sm" color="brand.subtleText" mt={4}>
          Total signups include pending and activated referrals. Activated referrals unlock once a new member completes their
          first activity.
        </Text>
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
          {REWARD_TIERS.map((tier, index) => {
            const isAchieved = milestoneReferralCount >= tier.required
            const isClaimed = claimedRewards.includes(tier.id)
            const isAiStackingTier = tier.id === 3
            const claimLabel = isClaimed
              ? isAiStackingTier
                ? 'Coupon Used'
                : 'Reward Claimed'
              : isAiStackingTier
                ? 'Mark Coupon as Used'
                : 'Claim Reward'

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
                          {tier.title}
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

                  {isAiStackingTier && isAchieved && (
                    <Box mt={4} p={3} borderRadius="lg" bg="white" border="1px solid" borderColor="purple.200">
                      <Stack spacing={2}>
                        <Text fontSize="xs" color="brand.subtleText" textTransform="uppercase" letterSpacing="wide">
                          25% Discount Coupon
                        </Text>
                        <HStack justify="space-between">
                          <Text fontFamily="mono" fontWeight="bold" color="brand.text">
                            {AI_STACKING_COUPON_CODE}
                          </Text>
                          <Button size="xs" variant="outline" colorScheme="purple" onClick={handleCouponCopy}>
                            Copy code
                          </Button>
                        </HStack>
                        <Button
                          as="a"
                          href={aiStackingCourseLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          rightIcon={<Icon as={ExternalLink} />}
                          colorScheme="purple"
                          variant="ghost"
                        >
                          Open AI Stacking 101 Course
                        </Button>
                        <Text fontSize="xs" color="brand.subtleText">
                          One-time reward for your account. Use this coupon once, then mark it as used.
                        </Text>
                      </Stack>
                    </Box>
                  )}

                  {isAchieved && (
                    <Button
                      mt={4}
                      colorScheme={isClaimed ? 'gray' : 'purple'}
                      variant={isClaimed ? 'outline' : 'solid'}
                      size="sm"
                      leftIcon={<Icon as={isClaimed ? Check : Gift} />}
                      onClick={() => !isClaimed && handleClaimReward(tier)}
                      isLoading={claiming === tier.id}
                      isDisabled={isClaimed}
                    >
                      {claimLabel}
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

          {referrals.length === 0 && !referralsLoading && !referralsError ? (
            <Text color="brand.subtleText">No referrals yet. Share your link to get started!</Text>
          ) : referrals.length === 0 && referralsError ? (
            <Alert status="warning" borderRadius="lg">
              <AlertIcon />
              <AlertDescription>{referralsError}</AlertDescription>
            </Alert>
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
                      {referral.referredName || `Referral #${referrals.length - index}`}
                    </Text>
                    <Text fontSize="sm" color="brand.subtleText">
                      {referral.referredEmail
                        ? referral.referredEmail
                        : `Code: ${referral.refCode}`}
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
                    {referral.status === 'credited'
                      ? 'Activated'
                      : referral.status === 'pending'
                        ? 'Pending'
                        : 'Rejected'}
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
                borderColor="border.control"
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

export default ReferralRewardsPage
