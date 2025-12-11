import React from 'react'
import {
  Badge,
  Box,
  Card,
  CardBody,
  Divider,
  HStack,
  Progress,
  Stack,
  Text,
  Wrap,
  WrapItem,
  Icon,
  BadgeProps,
} from '@chakra-ui/react'
import { AlertTriangle, FileWarning } from 'lucide-react'

type RiskColor = BadgeProps['colorScheme']

export interface RiskLevel {
  label: string
  count: number
  color: RiskColor
  reasons?: string[]
}

export interface RiskReason {
  label: string
  count: number
  color: RiskColor
}

export interface DataWarning {
  message: string
  severity: 'critical' | 'warning'
}

interface RiskAnalysisCardProps {
  title: string
  badgeLabel?: string
  badgeColor?: string
  levels: RiskLevel[]
  reasons?: RiskReason[]
  warnings?: DataWarning[]
  scopeNote?: string
}

export const RiskAnalysisCard: React.FC<RiskAnalysisCardProps> = ({
  title,
  badgeLabel,
  badgeColor = 'purple',
  levels,
  reasons,
  warnings,
  scopeNote,
}) => {
  return (
    <Card bg="white" border="1px solid" borderColor="brand.border">
      <CardBody>
        <Stack spacing={4}>
          <HStack justify="space-between">
            <Stack spacing={1}>
              <Text fontWeight="bold" color="brand.text">
                {title}
              </Text>
              {scopeNote && (
                <Text fontSize="sm" color="brand.subtleText">
                  {scopeNote}
                </Text>
              )}
            </Stack>
            {badgeLabel && (
              <Badge colorScheme={badgeColor} borderRadius="full" px={3} py={1}>
                {badgeLabel}
              </Badge>
            )}
          </HStack>
          <Stack spacing={3}>
            {levels.map(level => (
              <Box
                key={level.label}
                p={3}
                borderRadius="md"
                border="1px solid"
                borderColor="brand.border"
                bg="brand.accent"
              >
                <HStack justify="space-between" mb={2} align="flex-start">
                  <HStack spacing={2} align="flex-start">
                    <Badge colorScheme={level.color} borderRadius="full" px={3}>
                      {level.label}
                    </Badge>
                    {level.reasons && (
                      <Text color="brand.subtleText" fontSize="sm">
                        {level.reasons.join(' • ')}
                      </Text>
                    )}
                  </HStack>
                  <Text fontWeight="bold" color="brand.text">
                    {level.count}
                  </Text>
                </HStack>
                <Progress
                  value={(level.count / 500) * 100}
                  colorScheme={level.color}
                  borderRadius="full"
                  size="sm"
                  bg="white"
                />
              </Box>
            ))}
          </Stack>
          {reasons?.length ? (
            <>
              <Divider />
              <Stack spacing={2}>
                <Text fontWeight="semibold" color="brand.text">
                  Risk reasons breakdown
                </Text>
                <Wrap spacing={2}>
                  {reasons.map(reason => (
                    <WrapItem key={reason.label}>
                      <HStack
                        spacing={2}
                        border="1px solid"
                        borderColor="brand.border"
                        borderRadius="full"
                        px={3}
                        py={2}
                        bg="brand.accent"
                      >
                        <Badge colorScheme={reason.color} borderRadius="full">
                          {reason.count}
                        </Badge>
                        <Text fontSize="sm" color="brand.subtleText">
                          {reason.label}
                        </Text>
                      </HStack>
                    </WrapItem>
                  ))}
                </Wrap>
              </Stack>
            </>
          ) : null}
          {warnings?.length ? (
            <>
              <Divider />
              <Stack spacing={3}>
                <HStack color="red.500" spacing={2}>
                  <Icon as={AlertTriangle} />
                  <Text fontWeight="semibold">Data quality warnings</Text>
                </HStack>
                {warnings.map(warning => (
                  <HStack
                    key={warning.message}
                    justify="space-between"
                    p={2}
                    borderRadius="md"
                    bg={warning.severity === 'critical' ? 'red.50' : 'yellow.50'}
                    color={warning.severity === 'critical' ? 'red.700' : 'orange.700'}
                  >
                    <HStack spacing={2}>
                      <Icon as={FileWarning} />
                      <Text fontSize="sm">{warning.message}</Text>
                    </HStack>
                    <Badge colorScheme={warning.severity === 'critical' ? 'red' : 'orange'}>Validate</Badge>
                  </HStack>
                ))}
              </Stack>
            </>
          ) : null}
        </Stack>
      </CardBody>
    </Card>
  )
}
