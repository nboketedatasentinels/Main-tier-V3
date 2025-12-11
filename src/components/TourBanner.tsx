import React from 'react'
import { Badge, Box, Button, Flex, HStack, Icon, Spinner, Stack, Text, VStack } from '@chakra-ui/react'
import { Compass, RefreshCcw, Sparkles } from 'lucide-react'

interface TourBannerProps {
  profileName?: string
  hasCompleted?: boolean
  hasSkipped?: boolean
  isLoading?: boolean
  onStart: () => void
}

export const TourBanner: React.FC<TourBannerProps> = ({
  profileName,
  hasCompleted,
  hasSkipped,
  isLoading,
  onStart,
}) => {
  if (isLoading) {
    return (
      <Flex align="center" gap={3} bg="brand.royalPurple" border="1px" borderColor="brand.border" p={4} rounded="lg">
        <Spinner color="brand.gold" size="sm" />
        <Text color="brand.softGold">Loading your guided tour…</Text>
      </Flex>
    )
  }

  const hasSeenTour = hasCompleted || hasSkipped
  const title = hasSeenTour
    ? 'Replay the dashboard tour'
    : `Welcome ${profileName ? `${profileName}, ` : ''}start your guided tour`
  const description = hasSeenTour
    ? 'Jump back into the guided experience anytime to revisit tips and navigation shortcuts.'
    : 'Take a quick guided walkthrough to learn where to track your progress and take your next action.'
  const ctaLabel = hasSeenTour ? 'Replay tour' : 'Start tour'

  return (
    <Box
      border="1px solid"
      borderColor="rgba(234, 177, 48, 0.35)"
      bg="linear-gradient(135deg, rgba(64, 37, 104, 0.9), rgba(125, 83, 214, 0.85))"
      borderRadius="xl"
      p={{ base: 4, md: 6 }}
      mb={6}
      boxShadow="md"
    >
      <Stack
        direction={{ base: 'column', md: 'row' }}
        spacing={4}
        align={{ base: 'flex-start', md: 'center' }}
        justify="space-between"
      >
        <HStack spacing={3} align="flex-start" w={{ base: 'full', md: 'auto' }}>
          <Flex
            align="center"
            justify="center"
            bg="rgba(255,255,255,0.08)"
            borderRadius="xl"
            p={3}
            boxSize={12}
            color="brand.gold"
          >
            <Icon as={hasSeenTour ? RefreshCcw : Compass} boxSize={6} />
          </Flex>
          <VStack align="flex-start" spacing={2} flex={1}>
            <HStack spacing={2}>
              <Badge colorScheme="yellow" variant="subtle" borderRadius="full" px={3} py={1} textTransform="none">
                Guided tour
              </Badge>
              {hasCompleted && (
                <Badge colorScheme="green" variant="subtle" borderRadius="full" px={3} py={1} textTransform="none">
                  Completed
                </Badge>
              )}
              {hasSkipped && !hasCompleted && (
                <Badge colorScheme="purple" variant="subtle" borderRadius="full" px={3} py={1} textTransform="none">
                  Skipped
                </Badge>
              )}
            </HStack>
            <Text fontSize="lg" fontWeight="bold" color="white">
              {title}
            </Text>
            <Text color="rgba(255,255,255,0.92)">{description}</Text>
          </VStack>
        </HStack>

        <Stack direction={{ base: 'column', md: 'row' }} spacing={3} align="center">
          <Button
            colorScheme="yellow"
            rightIcon={<Icon as={Sparkles} boxSize={4.5} />}
            onClick={onStart}
            width={{ base: 'full', md: 'auto' }}
          >
            {ctaLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
