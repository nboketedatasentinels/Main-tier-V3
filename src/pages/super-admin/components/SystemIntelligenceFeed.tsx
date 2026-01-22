import React from 'react'
import {
  Box,
  Heading,
  HStack,
  Stack,
  Text,
  Badge,
  Flex,
  Button,
} from '@chakra-ui/react'
import { Cpu, AlertTriangle, Zap, Activity, Filter } from 'lucide-react'

export type FeedEvent = {
  id: string
  type: 'automation' | 'engagement' | 'security' | 'system'
  message: string
  timestamp: string
  count?: number
}

type SystemIntelligenceFeedProps = {
  events: FeedEvent[]
}

export const SystemIntelligenceFeed: React.FC<SystemIntelligenceFeedProps> = ({ events }) => {
  return (
    <Stack spacing={4}>
      <Flex justify="space-between" align="center">
        <HStack spacing={3}>
          <Box p={2} bg="purple.50" color="purple.600" borderRadius="lg">
            <Cpu size={20} />
          </Box>
          <Stack spacing={0}>
            <Heading size="sm" color="gray.800">SYSTEM INTELLIGENCE FEED</Heading>
            <Text fontSize="xs" color="gray.500">Grouped exceptions and behavioral patterns</Text>
          </Stack>
        </HStack>
        <Button size="xs" variant="ghost" leftIcon={<Filter size={14} />}>Filter</Button>
      </Flex>

      <Stack spacing={3}>
        {events.map((event) => (
          <Flex
            key={event.id}
            p={3}
            bg="white"
            borderRadius="lg"
            border="1px solid"
            borderColor="gray.100"
            align="center"
            gap={4}
          >
            <Box color={event.type === 'security' ? 'red.500' : 'purple.500'}>
              {event.type === 'automation' ? <Zap size={18} /> :
               event.type === 'engagement' ? <Activity size={18} /> :
               <AlertTriangle size={18} />}
            </Box>
            <Stack spacing={0} flex={1}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                {event.message}
                {event.count && event.count > 1 && (
                  <Badge ml={2} colorScheme="purple" variant="subtle" borderRadius="full">
                    {event.count} occurrences
                  </Badge>
                )}
              </Text>
              <Text fontSize="xs" color="gray.400">
                {event.timestamp}
              </Text>
            </Stack>
          </Flex>
        ))}
        {events.length === 0 && (
          <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>No unusual intelligence patterns detected.</Text>
        )}
      </Stack>
    </Stack>
  )
}
