import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Progress,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { CheckCircle2, Rocket, Sparkles, Trophy } from 'lucide-react'
import { OnboardingSnapshot } from '@/types/onboarding'

interface OnboardingBannerProps {
  userId?: string
  profileName?: string
  variant?: 'free' | 'paid'
  isOnboarded?: boolean
  progress?: OnboardingSnapshot | null
  onStart: () => void
  onDismiss?: () => void
  ctaLabel?: string
  description?: string
  highlight?: string
}

const DISMISS_WINDOW_MS = 1000 * 60 * 60 * 24 * 3 // 3 days

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({
  userId,
  profileName,
  variant = 'free',
  isOnboarded,
  progress,
  onStart,
  onDismiss,
  ctaLabel,
  description,
  highlight,
}) => {
  const [isDismissed, setIsDismissed] = useState(false)
  const dismissalKey = useMemo(() => `t4l.onboardingBanner.dismissed.${userId || 'guest'}`, [userId])

  useEffect(() => {
    const stored = localStorage.getItem(dismissalKey)
    if (stored) {
      const expiresAt = Number(stored) + DISMISS_WINDOW_MS
      if (Date.now() < expiresAt) {
        setIsDismissed(true)
      } else {
        localStorage.removeItem(dismissalKey)
      }
    }
  }, [dismissalKey])

  useEffect(() => {
    if (isOnboarded) {
      setIsDismissed(true)
    }
  }, [isOnboarded])

  if (isOnboarded || isDismissed) {
    return null
  }

  const completedTasks = progress?.completedItems?.length ?? 0
  const totalTasks = progress?.totalTaskCount ?? 0
  const percentComplete = progress?.onboardingComplete
    ? 100
    : totalTasks > 0
      ? Math.min(100, Math.round((completedTasks / totalTasks) * 100))
      : completedTasks > 0
        ? 100
        : 0
  const hasStarted = percentComplete > 0

  const copy =
    description ||
    (variant === 'paid'
      ? 'Complete onboarding to unlock personalized coaching sessions, premium journeys, and faster point bonuses.'
      : 'Set up your profile and unlock challenges, rewards, and the fastest path to earning Tier points.')

  const badgeText =
    highlight ||
    (variant === 'paid'
      ? 'Premium setup • Earn bonus XP'
      : 'Fast start • Unlock community perks')

  const buttonLabel = ctaLabel || (hasStarted ? 'Resume onboarding' : 'Start onboarding')

  const handleDismiss = () => {
    localStorage.setItem(dismissalKey, Date.now().toString())
    setIsDismissed(true)
    onDismiss?.()
  }

  return (
    <Box
      border="1px solid"
      borderColor="rgba(234, 177, 48, 0.35)"
      bg="linear-gradient(135deg, rgba(64, 37, 104, 0.9), rgba(125, 83, 214, 0.85))"
      borderRadius="xl"
      p={{ base: 4, md: 6 }}
      mb={6}
      boxShadow="lg"
    >
      <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align={{ base: 'flex-start', md: 'center' }}>
        <Flex
          align="center"
          justify="center"
          bg="rgba(255,255,255,0.08)"
          borderRadius="xl"
          p={3}
          boxSize={14}
          color="brand.gold"
        >
          <Icon as={hasStarted ? Trophy : Sparkles} boxSize={6} />
        </Flex>

        <VStack align="flex-start" spacing={2} flex={1} w="full">
          <HStack spacing={3} align="center">
            <Badge colorScheme="yellow" variant="subtle" borderRadius="full" px={3} py={1} textTransform="none">
              {badgeText}
            </Badge>
            {hasStarted && (
              <HStack spacing={1} color="green.200">
                <Icon as={CheckCircle2} boxSize={4} />
                <Text fontSize="sm">Progress saved</Text>
              </HStack>
            )}
          </HStack>

          <Text fontSize="lg" fontWeight="bold" color="white">
            {`Welcome ${profileName ? `${profileName}, ` : ''}let's finish your onboarding`}
          </Text>
          <Text color="rgba(255,255,255,0.92)" maxW="3xl">
            {copy}
          </Text>

          {(hasStarted || totalTasks > 0) && (
            <Box w="full">
              <HStack justify="space-between" mb={1} align="center">
                <Text fontSize="sm" color="rgba(255,255,255,0.85)">
                  {hasStarted
                    ? `${completedTasks} of ${Math.max(totalTasks || completedTasks, completedTasks)} tasks complete`
                    : 'Earn XP as you complete each onboarding task'}
                </Text>
                <Text fontSize="sm" fontWeight="semibold" color="white">
                  {percentComplete}%
                </Text>
              </HStack>
              <Progress value={percentComplete} colorScheme="yellow" borderRadius="full" bg="rgba(255,255,255,0.2)" />
            </Box>
          )}
        </VStack>

        <VStack spacing={3} align={{ base: 'stretch', md: 'flex-end' }} w={{ base: 'full', md: 'auto' }}>
          <Button
            colorScheme="yellow"
            rightIcon={<Icon as={Rocket} boxSize={4.5} />}
            onClick={onStart}
            width={{ base: 'full', md: 'auto' }}
          >
            {buttonLabel}
          </Button>
          <Button variant="ghost" color="whiteAlpha.800" size="sm" onClick={handleDismiss} width={{ base: 'full', md: 'auto' }}>
            Hide for now
          </Button>
        </VStack>
      </Stack>
    </Box>
  )
}
