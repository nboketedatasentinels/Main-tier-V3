import React, { useEffect, useState } from 'react'
import { Box, Button, Flex, Icon, Stack, Text } from '@chakra-ui/react'
import { Crown, X } from 'lucide-react'

interface UpgradeCtaCardProps {
  headline: string
  benefits: string[]
  onClick: () => void
  storageKey: string
}

export const UpgradeCtaCard: React.FC<UpgradeCtaCardProps> = ({ headline, benefits, onClick, storageKey }) => {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const isDismissed = localStorage.getItem(storageKey)
    setDismissed(Boolean(isDismissed))
  }, [storageKey])

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <Box
      bgGradient="linear(to-r, indigo.500, purple.500, pink.500)"
      borderRadius="xl"
      color="white"
      p={6}
      position="relative"
      overflow="hidden"
      boxShadow="lg"
    >
      <Box
        position="absolute"
        top={-10}
        right={-10}
        w={40}
        h={40}
        bgGradient="radial(whiteAlpha.300, transparent)"
        borderRadius="full"
      />
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4}>
        <Stack spacing={3}>
          <Flex align="center" gap={3}>
            <Box bg="whiteAlpha.200" p={3} borderRadius="full">
              <Icon as={Crown} />
            </Box>
            <Text fontSize="xl" fontWeight="bold">
              {headline}
            </Text>
          </Flex>
          <Stack spacing={1}>
            {benefits.map((benefit) => (
              <Text key={benefit} color="whiteAlpha.900">
                • {benefit}
              </Text>
            ))}
          </Stack>
          <Button colorScheme="yellow" onClick={onClick} alignSelf="flex-start">
            Upgrade Now
          </Button>
        </Stack>
        <Button
          onClick={handleDismiss}
          variant="ghost"
          colorScheme="whiteAlpha"
          size="sm"
          position="absolute"
          top={3}
          right={3}
          aria-label="Dismiss upgrade CTA"
        >
          <Icon as={X} />
        </Button>
      </Flex>
    </Box>
  )
}
