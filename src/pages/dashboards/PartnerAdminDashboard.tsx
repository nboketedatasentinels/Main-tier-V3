import React from 'react'
import {
  Badge,
  Box,
  Card,
  CardBody,
  Divider,
  Grid,
  GridItem,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Bell, Building2, Gauge, Sparkles, Users } from 'lucide-react'
import { MetricCard } from '@/components/admin/MetricCard'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { RiskAnalysisCard } from '@/components/admin/RiskAnalysisCard'
import { StatusBadge } from '@/components/admin/StatusBadge'
import PartnerDashboardLayout from '@/layouts/PartnerDashboardLayout'
import { PartnerInterventionPanel } from '@/components/partner/PartnerInterventionPanel'
import { PartnerUserManagement } from '@/components/partner/PartnerUserManagement'
import { usePartnerDashboardData } from '@/hooks/usePartnerDashboardData'

export const PartnerAdminDashboard: React.FC = () => {
  const {
    assignedOrgCount,
    engagementTrend,
    metrics,
    organizations,
    riskLevels,
    selectedOrg,
    setSelectedOrg,
    updateUserPoints,
    users,
    dataQualityWarnings,
    interventions,
    daysUntil,
    atRiskUsers,
    managedBreakdown,
    notificationCount,
  } = usePartnerDashboardData()

  const partnerNavItems = [
    { label: 'Overview', description: 'Metrics & trends' },
    { label: 'Users', description: 'Learners & leaders' },
    { label: 'Job Board', description: 'Opportunities' },
    { label: 'Grants & Funding', description: 'Partner resources' },
  ]

  const riskReasons = [
    { label: 'Low engagement score', count: atRiskUsers.length, color: 'orange' as const },
    { label: 'Inactivity 14+ days', count: atRiskUsers.filter(u => u.riskReasons?.includes('Inactivity 14+ days')).length || 0, color: 'red' as const },
    { label: 'Login friction', count: 3, color: 'yellow' as const },
    { label: 'Org mismatch', count: 1, color: 'purple' as const },
  ]

  const riskLevelList = [
    { label: 'Engaged', color: 'green' as const, count: riskLevels.engaged },
    { label: 'Watch', color: 'yellow' as const, count: riskLevels.watch },
    { label: 'Concern', color: 'orange' as const, count: riskLevels.concern },
    { label: 'Critical', color: 'red' as const, count: riskLevels.critical },
  ]

  const orgCards = organizations.map(org => ({
    name: org.name,
    status: org.status,
    activeUsers: org.activeUsers,
    newThisWeek: org.newThisWeek,
    admins: 1,
    change: `+${org.newThisWeek}`,
  }))

  return (
    <PartnerDashboardLayout
      organizations={organizations}
      selectedOrg={selectedOrg}
      onSelectOrg={setSelectedOrg}
      notificationCount={notificationCount}
      navItems={partnerNavItems}
    >
      <Stack spacing={8}>
        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <HStack justify="space-between" align={{ base: 'flex-start', md: 'center' }} spacing={4} wrap="wrap">
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="sm" color="brand.subtleText">Transformation partner</Text>
                <Text fontSize="3xl" fontWeight="bold" color="brand.text">
                  Scoped overview
                </Text>
                <Text color="brand.subtleText">
                  Welcome back! You can see {assignedOrgCount} assigned organization{assignedOrgCount === 1 ? '' : 's'} with filters applied to all data.
                </Text>
                <HStack spacing={3}>
                  <Badge colorScheme="green">Real-time</Badge>
                  <Badge colorScheme="purple">Partner scoped</Badge>
                </HStack>
              </VStack>
              <StatusBadge status="active" />
            </HStack>
          </CardBody>
        </Card>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
          <MetricCard
            icon={Users}
            label="Active members (30d)"
            value={metrics.activeMembers.toString()}
            helper={metrics.deltas.activeMembers}
          />
          <MetricCard
            icon={Gauge}
            label="Engagement rate"
            value={`${metrics.engagementRate}%`}
            helper={metrics.deltas.engagementRate}
          />
          <MetricCard
            icon={Sparkles}
            label="New registrations (7d)"
            value={metrics.newRegistrations.toString()}
            helper={metrics.deltas.newRegistrations}
          />
          <MetricCard
            icon={Building2}
            label="Managed companies"
            value={metrics.managedCompanies.toString()}
            helper={`Active ${managedBreakdown.active} / Inactive ${managedBreakdown.inactive}`}
          />
        </SimpleGrid>

        <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6}>
          <GridItem>
            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <EngagementChart
                  data={engagementTrend}
                  title="Engagement trends"
                  subtitle="14-day activity across assigned organizations"
                  valueLabel="Registrations"
                />
              </CardBody>
            </Card>
          </GridItem>
          <GridItem>
            <RiskAnalysisCard
              title="At-risk accounts"
              badgeLabel="Partner scoped"
              badgeColor="purple"
              levels={riskLevelList}
              reasons={riskReasons}
              warnings={dataQualityWarnings}
              scopeNote="Only assigned organizations are included"
            />
          </GridItem>
        </Grid>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={4}>
              <HStack justify="space-between" align="center">
                <Text fontWeight="bold" color="brand.text">Managed companies</Text>
                <Badge colorScheme="teal">Assigned</Badge>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
                {orgCards.map(company => (
                  <Box
                    key={company.name}
                    p={3}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="brand.border"
                    bg="brand.accent"
                  >
                    <Text fontWeight="semibold" color="brand.text">{company.name}</Text>
                    <Text fontSize="sm" color="brand.subtleText">Active users: {company.activeUsers}</Text>
                    <Badge mt={2} colorScheme={company.change.includes('-') ? 'red' : 'green'}>
                      {company.change} this week
                    </Badge>
                  </Box>
                ))}
              </SimpleGrid>
            </Stack>
          </CardBody>
        </Card>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={4}>
              <HStack justify="space-between" align="center">
                <Text fontWeight="bold" color="brand.text">Intervention panel</Text>
                <Badge colorScheme="purple">Automated reminders</Badge>
              </HStack>
              <PartnerInterventionPanel interventions={interventions} daysUntil={daysUntil} />
            </Stack>
          </CardBody>
        </Card>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={3}>
              <HStack justify="space-between" align="center">
                <Text fontWeight="bold" color="brand.text">Risk signals</Text>
                <Badge colorScheme="orange">Data quality</Badge>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
                {riskReasons.map(reason => (
                  <Box
                    key={reason.label}
                    p={3}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="brand.border"
                    bg="brand.accent"
                  >
                    <HStack justify="space-between">
                      <Text fontWeight="semibold" color="brand.text">{reason.label}</Text>
                      <Badge colorScheme={reason.color}>{reason.count}</Badge>
                    </HStack>
                  </Box>
                ))}
              </SimpleGrid>
              {dataQualityWarnings.map(warning => (
                <HStack
                  key={warning.message}
                  justify="space-between"
                  p={3}
                  borderRadius="md"
                  bg="yellow.50"
                  color="orange.700"
                  border="1px solid"
                  borderColor="yellow.200"
                >
                  <Text fontSize="sm">{warning.message}</Text>
                  <Badge colorScheme="orange">Review</Badge>
                </HStack>
              ))}
            </Stack>
          </CardBody>
        </Card>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <PartnerUserManagement
              users={users}
              organizations={organizations}
              selectedOrg={selectedOrg}
              onSelectOrg={setSelectedOrg}
              updateUserPoints={updateUserPoints}
            />
          </CardBody>
        </Card>

        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={3}>
              <HStack justify="space-between" align="center">
                <Text fontWeight="bold" color="brand.text">Real-time notifications</Text>
                <Badge colorScheme="red">{notificationCount} unread</Badge>
              </HStack>
              <Divider />
              <Stack spacing={3}>
                {[1, 2, 3].map(item => (
                  <HStack
                    key={item}
                    justify="space-between"
                    p={3}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="brand.border"
                    bg="brand.accent"
                  >
                    <HStack spacing={3}>
                      <Box p={2} borderRadius="md" bg="white" border="1px solid" borderColor="brand.border">
                        <Bell size={16} />
                      </Box>
                      <VStack align="flex-start" spacing={0}>
                        <Text fontWeight="semibold" color="brand.text">At-risk alert</Text>
                        <Text fontSize="sm" color="brand.subtleText">
                          Learner activity dropped in the past week. Review interventions.
                        </Text>
                      </VStack>
                    </HStack>
                    <Badge colorScheme="purple">Unread</Badge>
                  </HStack>
                ))}
              </Stack>
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    </PartnerDashboardLayout>
  )
}

export default PartnerAdminDashboard
