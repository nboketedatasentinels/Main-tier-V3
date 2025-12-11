import React from 'react'
import { Badge, HStack, Box, BadgeProps } from '@chakra-ui/react'

const statusColorMap: Record<string, { color: BadgeProps['colorScheme']; bg: string }> = {
  active: { color: 'green', bg: 'green.50' },
  inactive: { color: 'red', bg: 'red.50' },
  pending: { color: 'yellow', bg: 'yellow.50' },
  watch: { color: 'orange', bg: 'orange.50' },
  critical: { color: 'red', bg: 'red.50' },
  engaged: { color: 'green', bg: 'green.50' },
}

export const StatusBadge = ({ status }: { status: string }) => {
  const colors = statusColorMap[status] || { color: 'gray', bg: 'gray.50' }

  return (
    <Badge colorScheme={colors.color} bg={colors.bg} px={3} py={1} borderRadius="full">
      <HStack spacing={1}>
        <Box w={2} h={2} borderRadius="full" bg={`${colors.color}.500`} />
        <span style={{ textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
      </HStack>
    </Badge>
  )
}
