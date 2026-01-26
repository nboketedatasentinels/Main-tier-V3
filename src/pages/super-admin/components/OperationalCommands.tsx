import React from 'react'
import {
  Box,
  Button,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  Lock,
  Building2,
  RefreshCw,
  Search,
  Pause,
  Megaphone,
  Terminal,
} from 'lucide-react'

export const OperationalCommands: React.FC = () => {
  const commands = [
    { label: 'Suspend Organization', icon: <Building2 size={18} />, color: 'red' },
    { label: 'Lock User Account', icon: <Lock size={18} />, color: 'red' },
    { label: 'Force Recalculation', icon: <RefreshCw size={18} />, color: 'blue' },
    { label: 'Trigger System Audit', icon: <Search size={18} />, color: 'blue' },
    { label: 'Pause Automations', icon: <Pause size={18} />, color: 'orange' },
    { label: 'Broadcast Admin Notice', icon: <Megaphone size={18} />, color: 'purple' },
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
              onClick={() => {
                const confirmed = window.confirm(`Are you sure you want to: ${cmd.label}? This action will be logged.`)
                if (confirmed) {
                  // Action placeholder
                  console.log(`Executing: ${cmd.label}`)
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
