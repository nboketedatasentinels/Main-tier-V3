import React from 'react'
import {
  Badge,
  Box,
  Grid,
  GridItem,
  HStack,
  Progress,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { AlertTriangle, CheckCircle, Clock, ShieldAlert } from 'lucide-react'

interface InterventionSummary {
  id: string
  name: string
  target: string
  reason: string
  status: 'active' | 'watch' | 'critical'
  deadline: string
}

interface PartnerInterventionPanelProps {
  interventions: InterventionSummary[]
  daysUntil: (date: string) => number
}

const statusColor: Record<InterventionSummary['status'], string> = {
  active: 'purple',
  watch: 'yellow',
  critical: 'red',
}

export const PartnerInterventionPanel: React.FC<PartnerInterventionPanelProps> = ({ interventions, daysUntil }) => {
  const stats = {
    active: interventions.filter(item => item.status === 'active').length,
    followUps: interventions.filter(item => item.status === 'watch').length,
    overdue: interventions.filter(item => daysUntil(item.deadline) < 0).length,
    escalations: interventions.filter(item => item.status === 'critical').length,
  }

  return (
    <Stack spacing={4}>
      <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
        <GridItem>
          <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="white">
            <Text fontSize="sm" color="brand.subtleText">Active interventions</Text>
            <Text fontSize="2xl" fontWeight="bold">{stats.active}</Text>
            <Badge colorScheme="purple">Real-time</Badge>
          </Box>
        </GridItem>
        <GridItem>
          <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="white">
            <Text fontSize="sm" color="brand.subtleText">Mentor follow-ups</Text>
            <Text fontSize="2xl" fontWeight="bold">{stats.followUps}</Text>
            <Badge colorScheme="yellow">Pending</Badge>
          </Box>
        </GridItem>
        <GridItem>
          <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="white">
            <Text fontSize="sm" color="brand.subtleText">Overdue</Text>
            <Text fontSize="2xl" fontWeight="bold">{stats.overdue}</Text>
            <Badge colorScheme="red">Needs action</Badge>
          </Box>
        </GridItem>
        <GridItem>
          <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="white">
            <Text fontSize="sm" color="brand.subtleText">Escalations</Text>
            <Text fontSize="2xl" fontWeight="bold">{stats.escalations}</Text>
            <Badge colorScheme="purple">Auto escalation</Badge>
          </Box>
        </GridItem>
      </Grid>

      <Stack spacing={3}>
        {interventions.map(item => {
          const deadlineIn = daysUntil(item.deadline)
          const deadlineLabel = deadlineIn >= 0 ? `${deadlineIn} days left` : `${Math.abs(deadlineIn)} days overdue`
          const icon = deadlineIn >= 0 ? <Clock size={18} /> : <AlertTriangle size={18} color="#f59e0b" />

          return (
            <HStack
              key={item.id}
              justify="space-between"
              align="center"
              p={3}
              borderRadius="md"
              border="1px solid"
              borderColor="brand.border"
              bg="brand.accent"
            >
              <VStack align="flex-start" spacing={1} flex={1}>
                <HStack spacing={2}>
                  <Badge colorScheme={statusColor[item.status]}>{item.status}</Badge>
                  <Text fontWeight="semibold" color="brand.text">{item.name}</Text>
                </HStack>
                <Text fontSize="sm" color="brand.subtleText">{item.target} • {item.reason}</Text>
              </VStack>
              <VStack align="flex-end" spacing={1} minW="180px">
                <HStack spacing={2}>
                  {deadlineIn < 0 ? <ShieldAlert color="#ef4444" /> : icon}
                  <Text fontSize="sm" color={deadlineIn < 0 ? 'red.500' : 'brand.subtleText'}>{deadlineLabel}</Text>
                </HStack>
                <Progress
                  w="180px"
                  value={Math.min(100, Math.max(5, 100 - Math.abs(deadlineIn) * 10))}
                  colorScheme={deadlineIn < 0 ? 'red' : 'purple'}
                  size="sm"
                  borderRadius="full"
                />
              </VStack>
            </HStack>
          )
        })}
      </Stack>

      <Box p={3} borderRadius="md" border="1px dashed" borderColor="brand.border" bg="white">
        <HStack spacing={3}>
          <CheckCircle color="#22c55e" />
          <Text fontSize="sm" color="brand.subtleText">
            Automated reminders are generated 48 hours before deadlines. Overdue items escalate after 7 days with admin alerts.
          </Text>
        </HStack>
      </Box>
    </Stack>
  )
}

export default PartnerInterventionPanel
