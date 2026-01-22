import React from 'react'
import {
  Box,
  Flex,
  HStack,
  SimpleGrid,
  Text,
  Stack,
} from '@chakra-ui/react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export type HealthKPI = {
  label: string
  value: string | number
  status: 'stable' | 'degraded' | 'incident'
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  onClick?: () => void
}

type SystemHealthStripProps = {
  kpis: HealthKPI[]
}

export const SystemHealthStrip: React.FC<SystemHealthStripProps> = ({ kpis }) => {
  return (
    <Stack spacing={4}>
      <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
        System Health Snapshot
      </Text>
      <SimpleGrid columns={{ base: 1, md: 3, lg: 5 }} spacing={4}>
        {kpis.map((kpi, index) => (
          <HealthCard key={index} {...kpi} />
        ))}
      </SimpleGrid>
    </Stack>
  )
}

const HealthCard = ({ label, value, status, trend, trendValue, onClick }: HealthKPI) => {
  const statusColor = {
    stable: 'green.500',
    degraded: 'orange.500',
    incident: 'red.500',
  }[status]

  const statusBg = {
    stable: 'green.50',
    degraded: 'orange.50',
    incident: 'red.50',
  }[status]

  return (
    <Box
      p={4}
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.200"
      cursor={onClick ? 'pointer' : 'default'}
      onClick={onClick}
      transition="all 0.2s"
      _hover={onClick ? { shadow: 'md', transform: 'translateY(-2px)' } : {}}
    >
      <Stack spacing={1}>
        <HStack justify="space-between">
          <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
            {label}
          </Text>
          <HStack spacing={1} px={2} py={0.5} borderRadius="full" bg={statusBg}>
            <Box w={2} h={2} borderRadius="full" bg={statusColor} />
            <Text fontSize="xs" fontWeight="bold" color={statusColor} textTransform="capitalize">
              {status}
            </Text>
          </HStack>
        </HStack>

        <Flex align="baseline" gap={2}>
          <Text fontSize="2xl" fontWeight="bold" color="gray.800">
            {value}
          </Text>
          {trend && trend !== 'neutral' && (
            <HStack spacing={0} color={trend === 'up' ? 'green.500' : 'red.500'}>
              {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <Text fontSize="xs" fontWeight="bold">
                {trendValue}
              </Text>
            </HStack>
          )}
        </Flex>

        <Text fontSize="xs" color="gray.400">
          {status === 'stable' ? 'Within normal range' : 'Requires attention'}
        </Text>
      </Stack>
    </Box>
  )
}
