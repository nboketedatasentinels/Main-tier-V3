import React, { useEffect, useState } from 'react'
import {
  Badge,
  Box,
  HStack,
  Input,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react'
import { listNudgeCampaigns } from '@/services/nudgeService'
import { collection, getDocs, query } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { NudgeCampaignRecord } from '@/types/nudges'

export const NudgeEffectivenessDashboard: React.FC = () => {
  const [campaigns, setCampaigns] = useState<NudgeCampaignRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalSent: 0,
    responseRate: 0,
    avgEngagementLift: 0,
    taskCompletionLift: 0,
    avgDaysToResponse: 0,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [campaignData, sentSnapshot, effectivenessSnapshot] = await Promise.all([
          listNudgeCampaigns(),
          getDocs(query(collection(db, 'nudges_sent'))),
          getDocs(query(collection(db, 'nudge_effectiveness'))),
        ])

        setCampaigns(campaignData)

        const totalSent = sentSnapshot.size
        const effectivenessRecords = effectivenessSnapshot.docs.map((doc) => doc.data())

        const responded = effectivenessRecords.filter((r) => r.responded).length
        const responseRate = effectivenessRecords.length > 0 ? Math.round((responded / effectivenessRecords.length) * 100) : 0

        const avgEngagementLift = effectivenessRecords.length > 0
          ? Math.round(effectivenessRecords.reduce((sum, r) => sum + ((r.engagement_score_after || 0) - (r.engagement_score_before || 0)), 0) / effectivenessRecords.length)
          : 0

        const avgTaskLift = effectivenessRecords.length > 0
          ? Math.round(effectivenessRecords.reduce((sum, r) => sum + ((r.tasks_completed_after || 0) - (r.tasks_completed_before || 0)), 0) / effectivenessRecords.length)
          : 0

        const avgDays = effectivenessRecords.length > 0
          ? (effectivenessRecords.reduce((sum, r) => sum + (r.days_to_response || 0), 0) / effectivenessRecords.length).toFixed(1)
          : 0

        setMetrics({
          totalSent,
          responseRate,
          avgEngagementLift,
          taskCompletionLift: avgTaskLift,
          avgDaysToResponse: Number(avgDays),
        })
      } catch (error) {
        console.error('Failed to fetch nudge effectiveness data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatMetricValue = (value: number, prefix = '', suffix = '') => {
    if (value > 0) return `${prefix}${value}${suffix}`
    if (value < 0) return `${value}${suffix}`
    return `0${suffix}`
  }

  return (
    <Stack spacing={6}>
      <HStack justify="space-between" align="center">
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.text">Nudge effectiveness</Text>
          <Text fontSize="sm" color="brand.subtleText">Track engagement lifts after nudges.</Text>
        </VStack>
        <Badge colorScheme="green">Live</Badge>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
        {[
          { label: 'Total nudges sent', value: metrics.totalSent.toLocaleString() },
          { label: 'Response rate', value: `${metrics.responseRate}%` },
          { label: 'Avg engagement lift', value: formatMetricValue(metrics.avgEngagementLift, '+', '%') },
          { label: 'Task completion lift', value: formatMetricValue(metrics.taskCompletionLift, '+', '%') },
        ].map((metric) => (
          <Box key={metric.label} border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
            <Text fontSize="sm" color="brand.subtleText">{metric.label}</Text>
            <Skeleton isLoaded={!loading}>
              <Text fontSize="2xl" fontWeight="bold" color="brand.text">{metric.value}</Text>
            </Skeleton>
          </Box>
        ))}
      </SimpleGrid>

      <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
        <Stack spacing={3}>
          <Text fontWeight="semibold">Campaign performance</Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            <Input placeholder="Date range" />
            <Input placeholder="Template type" />
            <Input placeholder="Risk level" />
          </SimpleGrid>
          <Skeleton isLoaded={!loading}>
            <Text fontSize="sm" color="brand.subtleText">
              Average days to response: {metrics.avgDaysToResponse} days
            </Text>
          </Skeleton>
          <Skeleton isLoaded={!loading}>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Campaign</Th>
                  <Th>Target Risk Levels</Th>
                  <Th>Status</Th>
                  <Th>Drill-down</Th>
                </Tr>
              </Thead>
              <Tbody>
                {campaigns.length === 0 && !loading ? (
                  <Tr>
                    <Td colSpan={4}>
                      <Text color="brand.subtleText" textAlign="center" py={4}>
                        No campaigns found. Create a campaign to get started.
                      </Text>
                    </Td>
                  </Tr>
                ) : (
                  campaigns.map((campaign) => (
                    <Tr key={campaign.id}>
                      <Td>{campaign.name}</Td>
                      <Td>{campaign.target_risk_levels?.join(', ') || '—'}</Td>
                      <Td>
                        <Badge colorScheme={campaign.status === 'active' ? 'green' : campaign.status === 'paused' ? 'yellow' : 'gray'}>
                          {campaign.status}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge colorScheme="purple">View users</Badge>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Skeleton>
        </Stack>
      </Box>
    </Stack>
  )
}

export default NudgeEffectivenessDashboard
