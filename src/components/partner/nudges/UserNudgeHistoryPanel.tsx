import React from 'react'
import { Badge, Box, HStack, Stack, Text, VStack } from '@chakra-ui/react'

interface UserNudgeHistoryPanelProps {
  userName: string
  lastNudgeAt?: string
  effectivenessScore?: number
  cooldownHours?: number
}

export const UserNudgeHistoryPanel: React.FC<UserNudgeHistoryPanelProps> = ({
  userName,
  lastNudgeAt,
  effectivenessScore,
  cooldownHours,
}) => {
  return (
    <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="brand.accent">
      <Stack spacing={3}>
        <HStack justify="space-between">
          <Text fontWeight="semibold">Nudge history</Text>
          <Badge colorScheme={cooldownHours && cooldownHours > 0 ? 'orange' : 'green'}>
            {cooldownHours && cooldownHours > 0 ? `Cooldown ${cooldownHours}h` : 'Ready'}
          </Badge>
        </HStack>
        <VStack align="flex-start" spacing={1}>
          <Text fontSize="sm" color="brand.subtleText">
            Last nudge sent to {userName}: {lastNudgeAt || 'No nudges yet'}
          </Text>
          <Text fontSize="sm" color="brand.subtleText">
            Effectiveness score: {effectivenessScore ?? 'N/A'}
          </Text>
        </VStack>
      </Stack>
    </Box>
  )
}

export default UserNudgeHistoryPanel
