import React from 'react'
import {
  Box,
  Grid,
  GridItem,
  Heading,
  HStack,
  Stack,
  Text,
  Badge,
  Flex,
  Button,
} from '@chakra-ui/react'
import { Radar, ShieldCheck, ArrowUpRight } from 'lucide-react'

export type Signal = {
  id: string
  label: string
  reason: string
  impact: string
  actionLabel: string
  onAction: () => void
}

type RiskAnomalyRadarProps = {
  riskSignals: Signal[]
  securityCompliance: Signal[]
}

export const RiskAnomalyRadar: React.FC<RiskAnomalyRadarProps> = ({ riskSignals, securityCompliance }) => {
  return (
    <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
      <GridItem>
        <RadarSection
          title="RISK SIGNALS"
          subtitle="Outliers and abnormal behavior"
          signals={riskSignals}
          icon={<Radar size={20} />}
          color="orange"
        />
      </GridItem>
      <GridItem>
        <RadarSection
          title="SECURITY & COMPLIANCE"
          subtitle="Policy violations and access events"
          signals={securityCompliance}
          icon={<ShieldCheck size={20} />}
          color="blue"
        />
      </GridItem>
    </Grid>
  )
}

const RadarSection = ({ title, subtitle, signals, icon, color }: { title: string; subtitle: string; signals: Signal[], icon: React.ReactNode, color: string }) => (
  <Stack spacing={4}>
    <HStack spacing={2}>
      <Box color={`${color}.500`}>{icon}</Box>
      <Stack spacing={0}>
        <Heading size="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
          {title}
        </Heading>
        <Text fontSize="sm" color="gray.400">
          {subtitle}
        </Text>
      </Stack>
    </HStack>

    <Stack spacing={3}>
      {signals.map((signal) => (
        <Box
          key={signal.id}
          p={4}
          bg="white"
          borderRadius="xl"
          border="1px solid"
          borderColor="gray.100"
          shadow="sm"
        >
          <Stack spacing={2}>
            <HStack justify="space-between">
              <Text fontWeight="bold" color="gray.800">
                {signal.label}
              </Text>
              <Badge colorScheme={color} variant="subtle">
                Anomaly Detected
              </Badge>
            </HStack>
            <Text fontSize="sm" color="gray.600">
              <Text as="span" fontWeight="semibold">Why it matters:</Text> {signal.reason}
            </Text>
            <Flex justify="space-between" align="center" mt={2}>
              <Text fontSize="xs" color="gray.400">
                {signal.impact}
              </Text>
              <Button
                size="xs"
                variant="ghost"
                rightIcon={<ArrowUpRight size={14} />}
                colorScheme={color}
                onClick={signal.onAction}
              >
                {signal.actionLabel}
              </Button>
            </Flex>
          </Stack>
        </Box>
      ))}
      {signals.length === 0 && (
        <Box p={6} textAlign="center" bg="gray.50" borderRadius="xl" border="1px dashed" borderColor="gray.200">
          <Text fontSize="sm" color="gray.500">No active anomalies detected.</Text>
        </Box>
      )}
    </Stack>
  </Stack>
)
