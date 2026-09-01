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
      bg="white"
      borderRadius="xl"
      borderWidth="1px"
      borderColor="#E8DFF0"
      p={6}
      position="relative"
      overflow="hidden"
      boxShadow="sm"
      style={{ color: '#111111' }}
    >
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        h="4px"
        bgGradient="linear(to-r, #27062e, #350e6f, #f4540c, #eab130)"
      />
      <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4}>
        <Stack spacing={3}>
          <Flex align="center" gap={3}>
            <Box bg="#FAF7FC" p={3} borderRadius="full">
              <Icon as={Crown} style={{ color: '#350e6f' }} />
            </Box>
            <Text fontSize="xl" fontWeight="bold" style={{ color: '#111111' }}>
              {headline}
            </Text>
          </Flex>
          <Stack spacing={1}>
            {benefits.map((benefit) => (
              <Text key={benefit} style={{ color: '#334155' }}>
                • {benefit}
              </Text>
            ))}
          </Stack>
          <Button
            bg="#350e6f"
            color="white"
            _hover={{ bg: '#27062e' }}
            onClick={onClick}
            alignSelf="flex-start"
          >
            Upgrade Now
          </Button>
        </Stack>
        <Button
          onClick={handleDismiss}
          variant="ghost"
          size="sm"
          position="absolute"
          top={3}
          right={3}
          aria-label="Dismiss upgrade CTA"
          style={{ color: '#64748B' }}
          _hover={{ bg: 'gray.100', color: '#111111' }}
        >
          <Icon as={X} />
        </Button>
      </Flex>
    </Box>
  )
}
