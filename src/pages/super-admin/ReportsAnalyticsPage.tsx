import React from 'react'
import { Badge, Box, Button, Card, CardBody, Flex, Grid, GridItem, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { BarChart3, Calendar, Download, TrendingUp } from 'lucide-react'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { SuperAdminDashboardMetrics } from '@/types/admin'

type TrendPoint = { label: string; value: number }

type ReportsAnalyticsPageProps = {
  metrics: SuperAdminDashboardMetrics
  registrationTrend: TrendPoint[]
  userGrowthTrend: TrendPoint[]
}

export const ReportsAnalyticsPage: React.FC<ReportsAnalyticsPageProps> = ({ metrics, registrationTrend, userGrowthTrend }) => (
  <Stack spacing={6}>
    <Card bg="white" border="1px solid" borderColor="brand.border">
      <CardBody>
        <Stack spacing={6}>
          <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} direction={{ base: 'column', md: 'row' }}>
            <Stack spacing={1}>
              <Text fontWeight="bold" color="brand.text">
                Reports & analytics
              </Text>
              <Text fontSize="sm" color="brand.subtleText">
                Track platform-wide performance, compare organizations, and export insights.
              </Text>
            </Stack>
            <HStack>
              <Button leftIcon={<Calendar size={16} />} variant="outline">
                Last 30 days
              </Button>
              <Button leftIcon={<Download size={16} />} colorScheme="purple">
                Export report
              </Button>
            </HStack>
          </Flex>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <MetricTile label="Active members" value={metrics.activeMembers.toLocaleString()} helper="Across all organizations" />
            <MetricTile label="Engagement rate" value={`${Math.round(metrics.engagementRate * 100)}%`} helper="Rolling 30d" />
            <MetricTile label="New registrations" value={metrics.newRegistrations.toLocaleString()} helper="Last 7 days" />
          </SimpleGrid>

          <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
            <GridItem>
              <Card bg="gray.50" border="1px solid" borderColor="brand.border">
                <CardBody>
                  <EngagementChart data={registrationTrend} title="Registration trend" subtitle="14-day view" valueLabel="Registrations" />
                </CardBody>
              </Card>
            </GridItem>
            <GridItem>
              <Card bg="gray.50" border="1px solid" borderColor="brand.border">
                <CardBody>
                  <EngagementChart data={userGrowthTrend} title="User growth" subtitle="30-day trailing" valueLabel="Users" />
                </CardBody>
              </Card>
            </GridItem>
          </Grid>

          <Card bg="gray.50" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <HStack spacing={2}>
                    <TrendingUp size={18} />
                    <Text fontWeight="bold">Engagement insights</Text>
                  </HStack>
                  <Badge colorScheme="purple">Comparisons</Badge>
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                  <InsightCard title="Top organization" value="Org A" helper="Highest activity" />
                  <InsightCard title="Fastest growth" value="Org B" helper="+34% vs last period" />
                  <InsightCard title="Most engaged role" value="Managers" helper="Engagement 88" />
                  <InsightCard title="Churn risk" value="Org C" helper="High watchlist" />
                </SimpleGrid>
                <Button leftIcon={<BarChart3 size={16} />} alignSelf="flex-start" variant="outline">
                  Download comparison report
                </Button>
              </Stack>
            </CardBody>
          </Card>
        </Stack>
      </CardBody>
    </Card>
  </Stack>
)

type MetricTileProps = { label: string; value: string; helper: string }
const MetricTile: React.FC<MetricTileProps> = ({ label, value, helper }) => (
  <Box p={4} border="1px solid" borderColor="brand.border" borderRadius="md" bg="gray.50">
    <Text fontSize="sm" color="brand.subtleText">
      {label}
    </Text>
    <Text fontWeight="bold" color="brand.text" fontSize="xl">
      {value}
    </Text>
    <Text fontSize="sm" color="brand.subtleText">
      {helper}
    </Text>
  </Box>
)

type InsightCardProps = { title: string; value: string; helper: string }
const InsightCard: React.FC<InsightCardProps> = ({ title, value, helper }) => (
  <Box p={4} border="1px solid" borderColor="brand.border" borderRadius="md" bg="white">
    <Text fontWeight="semibold" color="brand.text">
      {title}
    </Text>
    <Text fontSize="2xl" fontWeight="bold" color="purple.600">
      {value}
    </Text>
    <Text fontSize="sm" color="brand.subtleText">
      {helper}
    </Text>
  </Box>
)
