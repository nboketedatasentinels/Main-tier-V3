import React from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  HStack,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { formatDistanceToNow } from 'date-fns'

export type AdminHealthStatus = 'healthy' | 'warning' | 'error' | 'loading'

export type AdminHealthItem = {
  label: string
  status: AdminHealthStatus
  description?: string
  lastSuccessAt?: Date | null
  onRetry?: () => void
}

const statusConfig: Record<AdminHealthStatus, { emoji: string; color: string; label: string }> = {
  healthy: { emoji: '✅', color: 'green', label: 'Healthy' },
  warning: { emoji: '⚠️', color: 'yellow', label: 'Attention' },
  error: { emoji: '❌', color: 'red', label: 'Blocked' },
  loading: { emoji: '⏳', color: 'gray', label: 'Loading' },
}

const formatLastSuccess = (date?: Date | null) => {
  if (!date) return 'No successful fetch yet.'
  return `Last successful fetch ${formatDistanceToNow(date)} ago.`
}

export const AdminDataHealthPanel: React.FC<{ items: AdminHealthItem[] }> = ({ items }) => (
  <Card bg="white" border="1px solid" borderColor="brand.border">
    <CardBody>
      <Stack spacing={4}>
        <HStack justify="space-between">
          <Text fontWeight="bold" color="brand.text">Admin data health</Text>
          <Badge colorScheme="purple">Live signals</Badge>
        </HStack>
        <Stack spacing={3}>
          {items.map((item) => {
            const status = statusConfig[item.status]
            return (
              <Box
                key={item.label}
                p={3}
                borderRadius="md"
                border="1px solid"
                borderColor="brand.border"
                bg="brand.accent"
              >
                <HStack justify="space-between" align="flex-start">
                  <VStack align="flex-start" spacing={1}>
                    <HStack spacing={2}>
                      <Text fontSize="lg">{status.emoji}</Text>
                      <Text fontWeight="semibold" color="brand.text">
                        {item.label}
                      </Text>
                      <Badge colorScheme={status.color}>{status.label}</Badge>
                    </HStack>
                    {item.description ? (
                      <Text fontSize="sm" color="brand.subtleText">
                        {item.description}
                      </Text>
                    ) : null}
                    <Text fontSize="xs" color="brand.subtleText">
                      {formatLastSuccess(item.lastSuccessAt)}
                    </Text>
                  </VStack>
                  {item.onRetry ? (
                    <Button size="xs" variant="outline" onClick={item.onRetry}>
                      Retry
                    </Button>
                  ) : null}
                </HStack>
              </Box>
            )
          })}
        </Stack>
      </Stack>
    </CardBody>
  </Card>
)

export default AdminDataHealthPanel
