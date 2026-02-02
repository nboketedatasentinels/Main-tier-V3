import React from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { Bell, Clock } from 'lucide-react'

type CommandCenterHeaderProps = {
  adminName: string
  criticalAlertCount: number
  lastSystemCheck: Date
  onOpenNotifications: () => void
}

export const CommandCenterHeader: React.FC<CommandCenterHeaderProps> = ({
  adminName,
  criticalAlertCount,
  lastSystemCheck,
  onOpenNotifications,
}) => {
  return (
    <Box
      bg={useColorModeValue('white', 'gray.800')}
      p={6}
      borderRadius="xl"
      border="1px solid"
      borderColor={useColorModeValue('gray.200', 'gray.700')}
      shadow="sm"
    >
      <Flex
        justify="space-between"
        align={{ base: 'flex-start', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap={4}
      >
        <Stack spacing={1}>
          <Text
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wider"
            color="purple.600"
          >
            Super Admin Command Center
          </Text>
          <Text fontSize="2xl" fontWeight="bold" color="brand.text">
            Welcome back, {adminName}
          </Text>
          <Text color="brand.subtleText">
            Real-time system health, risks, and interventions
          </Text>
        </Stack>

        <HStack spacing={3} wrap="wrap">
          <Button
            leftIcon={<Bell size={18} />}
            variant="ghost"
            position="relative"
            onClick={onOpenNotifications}
          >
            Critical Alerts
            {criticalAlertCount > 0 && (
              <Badge
                position="absolute"
                top="-1"
                right="-1"
                colorScheme="red"
                borderRadius="full"
                variant="solid"
                fontSize="xs"
              >
                {criticalAlertCount}
              </Badge>
            )}
          </Button>

          <HStack spacing={2} px={3} py={1} borderRadius="md" bg="gray.50" border="1px solid" borderColor="gray.100">
            <Clock size={14} color="gray" />
            <Text fontSize="xs" color="gray.600" fontWeight="medium">
              Last check: {lastSystemCheck.toLocaleTimeString()}
            </Text>
          </HStack>
        </HStack>
      </Flex>
    </Box>
  )
}
