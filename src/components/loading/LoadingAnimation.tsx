import React from 'react'
import { Center, Text, VStack } from '@chakra-ui/react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

interface LoadingAnimationProps {
  label?: string
  compact?: boolean
}

const DEFAULT_ANIMATION =
  'https://lottie.host/6d1e6e67-4fd9-4e2d-9c0b-7166c66b4703/DNzPVB7m9V.lottie'

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  label = 'Loading...',
  compact = false,
}) => {
  return (
    <Center w="100%" py={compact ? 2 : 8} px={4} flexDir="column">
      <DotLottieReact
        src={DEFAULT_ANIMATION}
        autoplay
        loop
        style={{ width: compact ? 120 : 200, height: compact ? 120 : 200 }}
      />
      <VStack spacing={2} mt={compact ? 2 : 4}>
        <Text color="brand.softGold" fontWeight="semibold" textAlign="center">
          {label}
        </Text>
        <Text color="brand.subtleText" fontSize="sm" textAlign="center">
          Hang tight while we verify your role and permissions.
        </Text>
      </VStack>
    </Center>
  )
}
