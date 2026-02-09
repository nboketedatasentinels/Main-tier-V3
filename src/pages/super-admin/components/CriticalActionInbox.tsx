import React from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { AlertTriangle, ShieldX, Clock, ArrowRight } from 'lucide-react'

export type ActionItem = {
  id: string
  severity: 'critical' | 'high' | 'medium'
  title: string
  description?: string
  timestamp: string
  actionLabel: string
  onAction: () => void
  icon?: React.ReactNode
}

type CriticalActionInboxProps = {
  items: ActionItem[]
}

export const CriticalActionInbox: React.FC<CriticalActionInboxProps> = ({ items }) => {
  const bgColor = useColorModeValue('red.50', 'rgba(254, 178, 178, 0.1)')
  const borderColor = useColorModeValue('red.100', 'red.900')

  return (
    <Box>
      <HStack mb={2} justify="space-between" align="flex-start">
        <HStack spacing={2} align="center">
          <Box color="red.500" pt={0.5}>
            <ShieldX size={20} />
          </Box>
          <Stack spacing={1}>
            <Heading size="md" color="red.700">
              Requires Immediate Action
            </Heading>
            <Text fontSize="sm" color="gray.600">
              Live queue of unresolved incidents, pending approvals, and urgent tasks from Firestore.
            </Text>
          </Stack>
        </HStack>
        <Badge colorScheme="red" variant="solid" borderRadius="full" px={3}>
          {items.length} Live
        </Badge>
      </HStack>

      <Stack spacing={3}>
        {items.map((item) => (
          <Box
            key={item.id}
            p={4}
            borderRadius="lg"
            bg={bgColor}
            border="1px solid"
            borderColor={borderColor}
            transition="all 0.2s"
            _hover={{ shadow: 'md', transform: 'translateY(-1px)' }}
          >
            <Flex justify="space-between" align="center" direction={{ base: 'column', sm: 'row' }} gap={4}>
              <HStack spacing={4} flex={1}>
                <Box
                  p={2}
                  borderRadius="md"
                  bg={item.severity === 'critical' ? 'red.500' : item.severity === 'high' ? 'orange.500' : 'yellow.500'}
                  color="white"
                >
                  {item.icon || <AlertTriangle size={20} />}
                </Box>
                <Stack spacing={0}>
                  <HStack spacing={2}>
                    <Badge
                      colorScheme={item.severity === 'critical' ? 'red' : item.severity === 'high' ? 'orange' : 'yellow'}
                      variant="subtle"
                      fontSize="xx-small"
                      textTransform="uppercase"
                    >
                      {item.severity}
                    </Badge>
                    <HStack spacing={1}>
                      <Clock size={12} color="gray" />
                      <Text fontSize="xs" color="gray.500">
                        {item.timestamp}
                      </Text>
                    </HStack>
                  </HStack>
                  <Text fontWeight="bold" color="gray.800" fontSize="md">
                    {item.title}
                  </Text>
                  {item.description && (
                    <Text color="gray.600" fontSize="sm">
                      {item.description}
                    </Text>
                  )}
                </Stack>
              </HStack>
              <Button
                rightIcon={<ArrowRight size={16} />}
                colorScheme="red"
                size="sm"
                variant="solid"
                onClick={item.onAction}
              >
                {item.actionLabel}
              </Button>
            </Flex>
          </Box>
        ))}
        {items.length === 0 && (
          <Box p={8} textAlign="center" borderRadius="lg" border="2px dashed" borderColor="border.control" bg="gray.50">
            <Text color="gray.500">No unresolved critical or high-priority items in the live queue.</Text>
          </Box>
        )}
      </Stack>
    </Box>
  )
}
