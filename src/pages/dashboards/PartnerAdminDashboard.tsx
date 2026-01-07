import React, { useEffect, useMemo, useState } from 'react'
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
import { useNavigate } from 'react-router-dom'
import { MetricCard } from '@/components/admin/MetricCard'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { RiskAnalysisCard } from '@/components/admin/RiskAnalysisCard'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { OrganizationCard } from '@/components/admin/OrganizationCard'
import PartnerDashboardLayout from '@/layouts/PartnerDashboardLayout'
import { PartnerInterventionPanel } from '@/components/partner/PartnerInterventionPanel'
import { PartnerUserManagement } from '@/components/partner/PartnerUserManagement'
import NudgeControlPanel from '@/components/partner/nudges/NudgeControlPanel'
import NudgeTemplateManager from '@/components/partner/nudges/NudgeTemplateManager'
import NudgeEffectivenessDashboard from '@/components/partner/nudges/NudgeEffectivenessDashboard'
import NudgeAutomationRules from '@/components/partner/nudges/NudgeAutomationRules'
import NudgeHistory from '@/components/partner/nudges/NudgeHistory'
import RealTimeEffectivenessMonitor from '@/components/partner/nudges/RealTimeEffectivenessMonitor'
import TemplatePerformanceAnalytics from '@/components/partner/nudges/TemplatePerformanceAnalytics'
import NudgeInsightsReportGenerator from '@/components/partner/nudges/NudgeInsightsReportGenerator'
import { usePartnerDashboardData } from '@/hooks/usePartnerDashboardData'
import { useAuth } from '@/hooks/useAuth'
import { logOrganizationAccessAttempt } from '@/services/organizationService'
import { getActiveNudgeTemplates } from '@/services/nudgeService'
import type { NudgeTemplateRecord } from '@/types/nudges'

export const PartnerAdminDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { isSuperAdmin, user } = useAuth()
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

  type PartnerPageKey = 'overview' | 'users' | 'job-board' | 'grants' | 'organization-management' | 'at-risk'
  const [activePage, setActivePage] = useState<PartnerPageKey>('overview')
  const [activeTemplates, setActiveTemplates] = useState<NudgeTemplateRecord[]>([])

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const templates = await getActiveNudgeTemplates()
        setActiveTemplates(templates)
      } catch (error) {
        console.error('Failed to load nudge templates', error)
      }
    }

    void loadTemplates()
  }, [])

  const partnerNavItems = [
    { key: 'overview', label: 'Overview', description: 'Metrics & trends' },
    { key: 'at-risk', label: 'At Risk', description: 'Risk monitoring & nudges' },
    { key: 'users', label: 'Users', description: 'Learners & leaders' },
    {
      key: 'organization-management',
      label: 'Organisation Management',
      description: 'Assigned organisations',
    },
    { key: 'job-board', label: 'Job Board', description: 'Opportunities' },
    { key: 'grants', label: 'Grants & Funding', description: 'Partner resources' },
  ]

  const riskReasons = useMemo(() => {
    const counts: Record<string, number> = {}
    atRiskUsers.forEach(user => {
      const reasons = user.riskReasons?.length ? user.riskReasons : ['Behind on weekly points target']
      reasons.forEach(reason => {
        counts[reason] = (counts[reason] || 0) + 1
      })
    })

    const palette: Array<'orange' | 'red' | 'yellow' | 'purple' | 'green'> = ['orange', 'red', 'yellow', 'purple', 'green']
    return Object.entries(counts).map(([label, count], idx) => ({
      label,
      count,
      color: palette[idx % palette.length],
    }))
  }, [atRiskUsers])

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

  const organizationSummary = useMemo(() => {
    return organizations.reduce(
      (acc, org) => {
        acc.totalActiveUsers += org.activeUsers
        switch (org.status) {
          case 'active':
            acc.active += 1
            break
          case 'watch':
            acc.watch += 1
            break
          case 'paused':
            acc.paused += 1
            break
          default:
            break
        }
        return acc
      },
      { active: 0, watch: 0, paused: 0, totalActiveUsers: 0 },
    )
  }, [organizations])

  const handleViewOrganization = (orgCode: string) => {
    const allowed = isSuperAdmin || organizations.some(org => org.code.toLowerCase() === orgCode.toLowerCase())
    if (!allowed && user?.uid) {
      void logOrganizationAccessAttempt({
        userId: user.uid,
        organizationCode: orgCode,
        reason: 'partner_dashboard_navigation',
      })
      return
    }
    navigate(`/admin/organization/${orgCode}`)
  }

  const renderOverview = () => (
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
  )

  const renderAtRiskPage = () => (
    <Stack spacing={8}>
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
          <NudgeControlPanel users={atRiskUsers} templates={activeTemplates} />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <NudgeTemplateManager />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <NudgeAutomationRules />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <RealTimeEffectivenessMonitor />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <NudgeEffectivenessDashboard />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <TemplatePerformanceAnalytics />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <NudgeHistory />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <NudgeInsightsReportGenerator />
        </CardBody>
      </Card>
    </Stack>
  )

  const renderUsersPage = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight="bold" color="brand.text">User management</Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Filtered to {selectedOrg === 'all' ? 'all organizations' : selectedOrg}
                </Text>
              </VStack>
              <Badge colorScheme="purple">Scoped</Badge>
            </HStack>
            <PartnerUserManagement
              users={users}
              organizations={organizations}
              selectedOrg={selectedOrg}
              onSelectOrg={setSelectedOrg}
              updateUserPoints={updateUserPoints}
            />
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderJobBoardPage = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight="bold" color="brand.text">Job Board</Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Opportunities curated for assigned organizations
                </Text>
              </VStack>
              <Badge colorScheme="green">Coming soon</Badge>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              {[1, 2, 3, 4].map(job => (
                <Box
                  key={job}
                  p={4}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="brand.border"
                  bg="brand.accent"
                >
                  <Text fontWeight="semibold" color="brand.text">Strategic role {job}</Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    Placeholder posting for managed organizations.
                  </Text>
                  <Badge mt={2} colorScheme="purple">
                    Partner scoped
                  </Badge>
                </Box>
              ))}
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderGrantsPage = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight="bold" color="brand.text">Grants & Funding</Text>
                <Text fontSize="sm" color="brand.subtleText">Resources available for partner orgs</Text>
              </VStack>
              <Badge colorScheme="blue">Placeholder</Badge>
            </HStack>
            <Stack spacing={3}>
              {[1, 2, 3].map(grant => (
                <HStack
                  key={grant}
                  justify="space-between"
                  p={3}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="brand.border"
                  bg="brand.accent"
                  align={{ base: 'flex-start', md: 'center' }}
                  spacing={4}
                >
                  <VStack align="flex-start" spacing={0}>
                    <Text fontWeight="semibold" color="brand.text">Funding opportunity {grant}</Text>
                    <Text fontSize="sm" color="brand.subtleText">Guided application flow coming soon.</Text>
                  </VStack>
                  <Badge colorScheme="teal">Soon</Badge>
                </HStack>
              ))}
            </Stack>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderOrganizationManagementPage = () => (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
              <VStack align="flex-start" spacing={1}>
                <Text fontWeight="bold" color="brand.text">
                  Assigned organization overview
                </Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Summary of scoped organizations and active learner engagement.
                </Text>
              </VStack>
              <HStack spacing={3}>
                <Badge colorScheme="purple">Scoped access</Badge>
                <Badge colorScheme="green">Real-time data</Badge>
              </HStack>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={3}>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Total assigned
                </Text>
                <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                  {organizations.length}
                </Text>
              </Box>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Active organizations
                </Text>
                <HStack justify="space-between" align="center">
                  <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                    {organizationSummary.active}
                  </Text>
                  <Badge colorScheme="green">Active</Badge>
                </HStack>
              </Box>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Watch organizations
                </Text>
                <HStack justify="space-between" align="center">
                  <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                    {organizationSummary.watch}
                  </Text>
                  <Badge colorScheme="orange">Watch</Badge>
                </HStack>
              </Box>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Paused organizations
                </Text>
                <HStack justify="space-between" align="center">
                  <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                    {organizationSummary.paused}
                  </Text>
                  <Badge colorScheme="red">Paused</Badge>
                </HStack>
              </Box>
              <Box p={3} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text fontSize="xs" color="brand.subtleText">
                  Total active users
                </Text>
                <Text fontWeight="bold" color="brand.text" fontSize="2xl">
                  {organizationSummary.totalActiveUsers}
                </Text>
              </Box>
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
              <VStack align="flex-start" spacing={1}>
                <Text fontWeight="bold" color="brand.text">
                  Organisation Management
                </Text>
                <Text fontSize="sm" color="brand.subtleText">
                  These organisations are assigned to your partner admin scope.
                </Text>
              </VStack>
              <Badge colorScheme="purple">{organizations.length} assigned</Badge>
            </HStack>
            {organizations.length ? (
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                {organizations.map(org => (
                  <OrganizationCard
                    key={org.code}
                    name={org.name}
                    status={org.status}
                    activeUsers={org.activeUsers}
                    newThisWeek={org.newThisWeek}
                    onViewClick={() => handleViewOrganization(org.code)}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <Box p={4} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Text color="brand.subtleText">
                  No organizations have been assigned yet. Assigned organizations will appear here.
                </Text>
              </Box>
            )}
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderPage = () => {
    switch (activePage) {
      case 'users':
        return renderUsersPage()
      case 'organization-management':
        return renderOrganizationManagementPage()
      case 'job-board':
        return renderJobBoardPage()
      case 'grants':
        return renderGrantsPage()
      case 'at-risk':
        return renderAtRiskPage()
      case 'overview':
      default:
        return renderOverview()
    }
  }

  const handleNavigate = (key: string) => {
    const normalized = key as PartnerPageKey
    if (['overview', 'users', 'job-board', 'grants', 'organization-management', 'at-risk'].includes(normalized)) {
      setActivePage(normalized)
    } else {
      setActivePage('overview')
    }
  }

  return (
    <PartnerDashboardLayout
      organizations={organizations}
      selectedOrg={selectedOrg}
      onSelectOrg={setSelectedOrg}
      notificationCount={notificationCount}
      navItems={partnerNavItems}
      onNavigate={handleNavigate}
      activeItem={activePage}
    >
      {renderPage()}
    </PartnerDashboardLayout>
  )
}

export default PartnerAdminDashboard
