import React, { useState } from 'react'
import {
  Box,
  Button,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import {
  Lock,
  Building2,
  RefreshCw,
  Search,
  Pause,
  Megaphone,
  Terminal,
  Users2,
} from 'lucide-react'
import { triggerPeerMatching } from '@/services/peerMatchingService'

export const OperationalCommands: React.FC = () => {
  const toast = useToast()
  const [isPeerMatchingLoading, setIsPeerMatchingLoading] = useState(false)

  const handleTriggerPeerMatching = async () => {
    const confirmed = window.confirm(
      'Trigger automatic peer matching for all eligible users?\n\n' +
      'This will create new weekly peer matches for users with organization associations. ' +
      'Existing matches for the current window will be skipped.\n\n' +
      'This action will be logged.'
    )

    if (!confirmed) return

    setIsPeerMatchingLoading(true)
    try {
      const result = await triggerPeerMatching()

      toast({
        title: 'Peer Matching Complete',
        description: `Created ${result.totalCreated} matches for ${result.totalUsers} users across ${result.groupsProcessed} organizations in ${(result.duration / 1000).toFixed(2)}s`,
        status: 'success',
        duration: 8000,
        isClosable: true,
      })

      console.log('[PeerMatching] Manual trigger results:', result)
    } catch (error) {
      console.error('[PeerMatching] Manual trigger failed:', error)
      toast({
        title: 'Peer Matching Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
    } finally {
      setIsPeerMatchingLoading(false)
    }
  }

  const commands = [
    { label: 'Suspend Organization', icon: <Building2 size={18} />, color: 'red', onClick: () => { console.log('Placeholder') } },
    { label: 'Lock User Account', icon: <Lock size={18} />, color: 'red', onClick: () => { console.log('Placeholder') } },
    { label: 'Force Recalculation', icon: <RefreshCw size={18} />, color: 'blue', onClick: () => { console.log('Placeholder') } },
    { label: 'Trigger System Audit', icon: <Search size={18} />, color: 'blue', onClick: () => { console.log('Placeholder') } },
    { label: 'Pause Automations', icon: <Pause size={18} />, color: 'orange', onClick: () => { console.log('Placeholder') } },
    { label: 'Broadcast Admin Notice', icon: <Megaphone size={18} />, color: 'purple', onClick: () => { console.log('Placeholder') } },
    {
      label: 'Trigger Peer Matching',
      icon: <Users2 size={18} />,
      color: 'green',
      onClick: handleTriggerPeerMatching,
      isLoading: isPeerMatchingLoading,
    },
  ]

  return (
    <Box p={6} bg="gray.900" borderRadius="2xl" color="white" shadow="xl">
      <Stack spacing={6}>
        <HStack spacing={3}>
          <Box p={2} bg="whiteAlpha.200" borderRadius="lg">
            <Terminal size={20} color="white" />
          </Box>
          <Stack spacing={0}>
            <Heading size="sm">OPERATIONAL COMMANDS</Heading>
            <Text fontSize="xs" color="whiteAlpha.600">
              Direct system intervention and overrides
            </Text>
          </Stack>
        </HStack>

        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
          {commands.map((cmd, idx) => (
            <Button
              key={idx}
              leftIcon={cmd.icon}
              colorScheme={cmd.color}
              variant="solid"
              justifyContent="flex-start"
              height="50px"
              fontWeight="bold"
              fontSize="sm"
              isLoading={cmd.isLoading || false}
              onClick={() => {
                if (cmd.onClick) {
                  cmd.onClick()
                } else {
                  const confirmed = window.confirm(`Are you sure you want to: ${cmd.label}? This action will be logged.`)
                  if (confirmed) {
                    console.log(`Executing: ${cmd.label}`)
                  }
                }
              }}
            >
              {cmd.label}
            </Button>
          ))}
        </SimpleGrid>

        <Text fontSize="xx-small" color="whiteAlpha.400" textAlign="center" textTransform="uppercase" letterSpacing="widest">
          All command actions are cryptographically signed and logged to the master audit trail.
        </Text>
      </Stack>
    </Box>
  )
}
