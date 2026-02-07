import React from 'react'
import { Card, CardBody, HStack, Text, Box, Stack, Icon, Badge, VStack } from '@chakra-ui/react'

interface MetricCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  helper?: string
  accent?: string
  statusLabel?: string
  statusColor?: string
  guidanceText?: string
  onClick?: () => void
}

export const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  helper,
  accent,
  statusLabel,
  statusColor,
  guidanceText,
  onClick,
}) => (
  <Card
    bg="white"
    border="1px solid"
    borderColor="brand.border"
    cursor={onClick ? 'pointer' : 'default'}
    onClick={onClick}
    transition="all 0.2s"
    _hover={onClick ? { shadow: 'md', borderColor: 'brand.primary' } : {}}
  >
    <CardBody>
      <Stack spacing={3}>
        <HStack justify="space-between">
          <VStack align="flex-start" spacing={0}>
            <Text fontSize="sm" color="brand.subtleText" fontWeight="medium">
              {label}
            </Text>
            {statusLabel && (
              <Badge colorScheme={statusColor || (statusLabel.toLowerCase().includes('action') ? 'red' : 'green')} fontSize="xs">
                {statusLabel}
              </Badge>
            )}
          </VStack>
          <Box
            p={2}
            bg={accent || 'brand.primaryMuted'}
            borderRadius="md"
            color="brand.primary"
            display="grid"
            placeItems="center"
          >
            <Icon as={icon} size={18} />
          </Box>
        </HStack>
        <VStack align="flex-start" spacing={1}>
          <Text fontSize="2xl" fontWeight="bold" color="brand.text">
            {value}
          </Text>
          {guidanceText && (
            <Text fontSize="xs" color="brand.primary" fontWeight="medium">
              {guidanceText}
            </Text>
          )}
        </VStack>
        {helper && (
          <Text fontSize="sm" color="brand.subtleText">
            {helper}
          </Text>
        )}
      </Stack>
    </CardBody>
  </Card>
)
