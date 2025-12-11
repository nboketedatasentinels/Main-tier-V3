import { Badge, Box, HStack, Stack, Text } from '@chakra-ui/react'
import { StatusBadge } from './StatusBadge'

export interface OrganizationCardProps {
  name: string
  status: 'active' | 'inactive' | 'pending' | 'watch' | 'critical'
  admins?: number
  newThisWeek?: number
  activeUsers?: number
  change?: string
  description?: string
}

export const OrganizationCard: React.FC<OrganizationCardProps> = ({
  name,
  status,
  admins,
  newThisWeek,
  activeUsers,
  change,
  description,
}) => {
  return (
    <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
      <HStack justify="space-between" mb={2} align="flex-start">
        <Stack spacing={1}>
          <Text fontWeight="semibold" color="brand.text">
            {name}
          </Text>
          {description && (
            <Text fontSize="sm" color="brand.subtleText">
              {description}
            </Text>
          )}
        </Stack>
        <StatusBadge status={status} />
      </HStack>
      {typeof activeUsers === 'number' && (
        <Text fontSize="sm" color="brand.subtleText">
          Active users: {activeUsers}
        </Text>
      )}
      {typeof admins === 'number' && (
        <Text fontSize="sm" color="brand.subtleText">
          Admins: {admins}
        </Text>
      )}
      {typeof newThisWeek === 'number' && (
        <Text fontSize="sm" color="brand.subtleText">
          New this week: {newThisWeek}
        </Text>
      )}
      {change && (
        <Badge mt={2} colorScheme={change.includes('-') ? 'red' : 'green'}>
          {change}
        </Badge>
      )}
    </Box>
  )
}
