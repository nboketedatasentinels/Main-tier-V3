import React, { useEffect, useState } from 'react'
import {
  Badge,
  Box,
  HStack,
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
import { getAllNudgeTemplates } from '@/services/nudgeService'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { NudgeTemplateRecord } from '@/types/nudges'

interface TemplateStats {
  template: NudgeTemplateRecord
  sent: number
  responseRate: number
  engagementLift: number
}

export const TemplatePerformanceAnalytics: React.FC = () => {
  const [templateStats, setTemplateStats] = useState<TemplateStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const templates = await getAllNudgeTemplates()

        const statsPromises = templates.map(async (template) => {
          const sentQuery = query(collection(db, 'nudges_sent'), where('template_id', '==', template.id))
          const sentSnapshot = await getDocs(sentQuery)
          const sent = sentSnapshot.size

          const effectivenessQuery = query(collection(db, 'nudge_effectiveness'))
          const effectivenessSnapshot = await getDocs(effectivenessQuery)

          const templateEffectiveness = effectivenessSnapshot.docs
            .map((doc) => doc.data())
            .filter((record) => {
              const nudgeId = record.nudge_id
              return sentSnapshot.docs.some((sentDoc) => sentDoc.id === nudgeId)
            })

          const responded = templateEffectiveness.filter((r) => r.responded).length
          const responseRate = templateEffectiveness.length > 0
            ? Math.round((responded / templateEffectiveness.length) * 100)
            : 0

          const engagementLift = templateEffectiveness.length > 0
            ? Math.round(
                templateEffectiveness.reduce(
                  (sum, r) => sum + ((r.engagement_score_after || 0) - (r.engagement_score_before || 0)),
                  0
                ) / templateEffectiveness.length
              )
            : 0

          return { template, sent, responseRate, engagementLift }
        })

        const stats = await Promise.all(statsPromises)
        const sortedStats = stats.sort((a, b) => b.responseRate - a.responseRate)
        setTemplateStats(sortedStats)
      } catch (error) {
        console.error('Failed to fetch template performance data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatEngagementLift = (value: number) => {
    if (value > 0) return `+${value}%`
    if (value < 0) return `${value}%`
    return '0%'
  }

  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center">
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.text">Template performance</Text>
          <Text fontSize="sm" color="brand.subtleText">Compare templates by response rate and engagement lift.</Text>
        </VStack>
        <Badge colorScheme="purple">Ranked</Badge>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
          <Text fontWeight="semibold" mb={3}>Top templates</Text>
          <Skeleton isLoaded={!loading}>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Template</Th>
                  <Th>Sent</Th>
                  <Th>Response</Th>
                  <Th>Engagement lift</Th>
                </Tr>
              </Thead>
              <Tbody>
                {templateStats.length === 0 && !loading ? (
                  <Tr>
                    <Td colSpan={4}>
                      <Text color="brand.subtleText" textAlign="center" py={4}>
                        No templates found. Create templates to track performance.
                      </Text>
                    </Td>
                  </Tr>
                ) : (
                  templateStats.slice(0, 10).map((stat) => (
                    <Tr key={stat.template.id}>
                      <Td>{stat.template.name}</Td>
                      <Td>{stat.sent}</Td>
                      <Td>{stat.responseRate}%</Td>
                      <Td>{formatEngagementLift(stat.engagementLift)}</Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Skeleton>
        </Box>
        <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
          <Text fontWeight="semibold">Best practices</Text>
          <Text fontSize="sm" color="brand.subtleText" mt={2}>
            Critical Alert templates typically have the highest response rates for at-risk learners.
          </Text>
          <Text fontSize="sm" color="brand.subtleText" mt={2}>
            Follow-up templates work best when sent 3-5 days after the initial nudge.
          </Text>
          <Text fontSize="sm" color="brand.subtleText" mt={2}>
            Personalized messages with the learner's name improve engagement by up to 20%.
          </Text>
        </Box>
      </SimpleGrid>
    </Stack>
  )
}

export default TemplatePerformanceAnalytics
