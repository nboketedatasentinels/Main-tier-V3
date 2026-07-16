import React from 'react'
import { Card, CardBody, HStack, Text, Flex, Stack, Icon, Badge, VStack } from '@chakra-ui/react'

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
    h="full"
    borderRadius="2xl"
    boxShadow="card"
    border="1px solid"
    borderColor="border.card"
    cursor={onClick ? 'pointer' : 'default'}
    onClick={onClick}
    transition="transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"
    _hover={{
      transform: 'translateY(-3px)',
      boxShadow: 'card-elevated',
      borderColor: onClick ? 'brand.primary' : 'border.card',
    }}
  >
    <CardBody p={6}>
      <Stack spacing={4}>
        <HStack justify="space-between" align="flex-start" spacing={3}>
          <VStack align="flex-start" spacing={1.5}>
            <Text
              fontSize="xs"
              letterSpacing="0.06em"
              textTransform="uppercase"
              color="brand.subtleText"
              fontWeight="semibold"
            >
              {label}
            </Text>
            {statusLabel && (
              <Badge
                colorScheme={statusColor || (statusLabel.toLowerCase().includes('action') ? 'red' : 'green')}
                fontSize="xs"
              >
                {statusLabel}
              </Badge>
            )}
          </VStack>
          <Flex
            boxSize={10}
            flexShrink={0}
            bg={accent || 'brand.primaryMuted'}
            borderRadius="xl"
            color="brand.primary"
            align="center"
            justify="center"
          >
            <Icon as={icon} boxSize={5} />
          </Flex>
        </HStack>
        <VStack align="flex-start" spacing={1}>
          <Text fontSize="4xl" fontWeight="extrabold" color="brand.text" lineHeight="1.05">
            {value}
          </Text>
          {guidanceText && (
            <Text fontSize="xs" color="brand.primary" fontWeight="medium">
              {guidanceText}
            </Text>
          )}
        </VStack>
        {helper && (
          <Text fontSize="sm" color="brand.subtleText" lineHeight="1.5">
            {helper}
          </Text>
        )}
      </Stack>
    </CardBody>
  </Card>
)
