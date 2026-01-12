import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
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
  Skeleton,
} from '@chakra-ui/react'
import { Bell, Building2, Gauge, Sparkles, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MetricCard } from '@/components/admin/MetricCard'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { RiskAnalysisCard } from '@/components/admin/RiskAnalysisCard'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { OrganizationCard } from '@/components/admin/OrganizationCard'
import PartnerDashboardLayout from '@/layouts/PartnerDashboardLayout'
import { DashboardErrorBoundary } from '@/components/ui/DashboardErrorBoundary'
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
  const { assignedOrganizations, isSuperAdmin, user, refreshProfile, profileStatus } = useAuth()
  const {
    assignedOrgCount,
    engagementTrend,
    metrics,
    organizations,
    organizationsError,
    organizationsLoading,
    organizationsReady,
    riskLevels,
    selectedOrg,
    setSelectedOrg,
    updateUserPoints,
    users,
    usersError,
    usersLoading,
    dataQualityWarnings,
    interventions,
    daysUntil,
    atRiskUsers,
    managedBreakdown,
    notificationCount,
  } = usePartnerDashboardData()
  const enableProfileRealtime = import.meta.env.VITE_ENABLE_PROFILE_REALTIME === 'true'
  const supportEmail = 'support@transformation4leaders.com'

  type PartnerPageKey = 'overview' | 'users' | 'job-board' | 'grants' | 'organization-management' | 'at-risk'
  const [activePage, setActivePage] = useState<PartnerPageKey>('overview')
  const [activeTemplates, setActiveTemplates] = useState<NudgeTemplateRecord[]>([])
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [refreshingOrganizations, setRefreshingOrganizations] = useState(false)
  const initialRefreshRef = useRef(false)

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true)
    setTemplateLoadError(null)
    try {
      const templates = await getActiveNudgeTemplates()
      setActiveTemplates(templates)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to load nudge templates', error)
      setActiveTemplates([])
      setTemplateLoadError(
        `Nudge templates could not be loaded. Please confirm your Firebase configuration and Firestore access. (${message})`,
      )
    } finally {
      setTemplateLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  const refreshIfVisible = useCallback((reason: string) => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      console.log('[PartnerDashboard] Skipping refresh because tab is hidden', { reason })
      return
    }
    void refreshProfile({ reason })
  }, [refreshProfile])

  const refreshOrganizations = useCallback(async () => {
    setRefreshingOrganizations(true)
    try {
      await refreshProfile({ reason: 'partner-dashboard-org-refresh' })
    } finally {
      setRefreshingOrganizations(false)
    }
  }, [refreshProfile])

  useEffect(() => {
    if (enableProfileRealtime) return
    console.warn(
      '[PartnerDashboard] VITE_ENABLE_PROFILE_REALTIME is disabled. Manual or scheduled refresh is required.'
    )
    if (!initialRefreshRef.current) {
      initialRefreshRef.current = true
      refreshIfVisible('partner-dashboard-initial')
    }
    const interval = window.setInterval(() => {
      refreshIfVisible('partner-dashboard-interval')
    }, 60 * 1000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshIfVisible('partner-dashboard-visible')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enableProfileRealtime, refreshIfVisible])

  useEffect(() => {
    console.debug('[PartnerDashboard] Auth assigned organizations', assignedOrganizations)
  }, [assignedOrganizations])

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
    name: org.name || org.code || org.id || 'Unknown organization',
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
    const normalized = orgCode.toLowerCase()
    const allowed =
      isSuperAdmin ||
      organizations.some(org => org.code?.toLowerCase() === normalized || org.id?.toLowerCase() === normalized)
    if (!allowed && user?.uid) {
      void logOrganizationAccessAttempt({
        userId: user.uid,
        organizationCode: normalized,
        reason: 'partner_dashboard_navigation',
      })
      return
    }
    navigate(`/admin/organization/${orgCode}`)
  }

  const renderOverview = () => (
    <Stack spacing={8}>
      {(organizationsError || usersError) && (
        <Card bg="red.50" border="1px solid" borderColor="red.200">
          <CardBody>
            <Stack spacing={3}>
              <Text fontWeight="semibold" color="red.700">
                We hit a problem loading your dashboard data.
              </Text>
              {organizationsError ? (
                <Text fontSize="sm" color="red.700">
                  Organizations: {organizationsError}
                </Text>
              ) : null}
              {usersError ? (
                <Text fontSize="sm" color="red.700">
                  Users: {usersError}
                </Text>
              ) : null}
              <HStack>
                <Button size="sm" colorScheme="red" onClick={refreshOrganizations} isLoading={refreshingOrganizations}>
                  Retry loading data
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/login', { replace: true })}>
                  Back to login
                </Button>
              </HStack>
            </Stack>
          </CardBody>
        </Card>
      )}
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
                {organizationsLoading ? (
                  <Badge colorScheme="gray">Loading organizations...</Badge>
                ) : assignedOrganizations.length === 0 ? (
                  <Badge colorScheme="yellow">No organizations assigned</Badge>
                ) : null}
                <Button size="xs" variant="outline" onClick={refreshOrganizations} isLoading={refreshingOrganizations}>
                  Sync profile
                </Button>
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
            usersLoading={usersLoading}
            organizations={organizations}
            organizationsLoading={organizationsLoading}
            organizationsReady={organizationsReady}
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
          {templateLoadError ? (
            <Stack
              spacing={3}
              p={4}
              mb={4}
              border="1px solid"
              borderColor="red.200"
              bg="red.50"
              borderRadius="lg"
            >
              <Text fontWeight="semibold" color="red.700">Nudge templates unavailable</Text>
              <Text fontSize="sm" color="red.700">
                {templateLoadError} If the issue persists, contact support at {supportEmail}.
              </Text>
              <HStack>
                <Button size="sm" colorScheme="red" onClick={() => void loadTemplates()} isLoading={templateLoading}>
                  Retry
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTemplateLoadError(null)}>
                  Dismiss
                </Button>
              </HStack>
            </Stack>
          ) : null}
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
              usersLoading={usersLoading}
              organizations={organizations}
              organizationsLoading={organizationsLoading}
              organizationsReady={organizationsReady}
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
      {(organizationsError || usersError) && (
        <Card bg="red.50" border="1px solid" borderColor="red.200">
          <CardBody>
            <Stack spacing={3}>
              <Text fontWeight="semibold" color="red.700">
                Some dashboard data failed to load.
              </Text>
              {organizationsError ? (
                <Text fontSize="sm" color="red.700">
                  Organizations: {organizationsError}
                </Text>
              ) : null}
              {usersError ? (
                <Text fontSize="sm" color="red.700">
                  Users: {usersError}
                </Text>
              ) : null}
              <Button size="sm" colorScheme="red" onClick={refreshOrganizations} isLoading={refreshingOrganizations}>
                Retry loading data
              </Button>
            </Stack>
          </CardBody>
        </Card>
      )}
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
                <Button size="sm" variant="outline" onClick={refreshOrganizations} isLoading={refreshingOrganizations}>
                  Refresh organizations
                </Button>
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
              <Badge colorScheme={organizationsLoading ? 'gray' : 'purple'}>
                {organizationsLoading ? 'Loading' : `${organizations.length} assigned`}
              </Badge>
            </HStack>
            {organizationsLoading ? (
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Box
                    key={`org-skeleton-${idx}`}
                    border="1px solid"
                    borderColor="brand.border"
                    borderRadius="md"
                    p={4}
                    bg="white"
                  >
                    <Stack spacing={3}>
                      <Skeleton height="18px" width="60%" />
                      <Skeleton height="12px" width="40%" />
                      <Skeleton height="12px" width="80%" />
                    </Stack>
                  </Box>
                ))}
              </SimpleGrid>
            ) : organizationsError ? (
              <Box p={4} borderRadius="md" border="1px solid" borderColor="orange.200" bg="orange.50">
                <Stack spacing={2}>
                  <Text color="orange.700" fontWeight="semibold">
                    Unable to load assigned organizations.
                  </Text>
                  <Text color="orange.700" fontSize="sm">
                    {organizationsError}
                  </Text>
                </Stack>
              </Box>
            ) : organizations.length ? (
              <DashboardErrorBoundary context="Partner Admin organizations">
                <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                  {organizations.map(org => (
                    <OrganizationCard
                      key={org.code || org.id}
                      name={org.name || org.code || org.id || 'Unknown organization'}
                      status={org.status}
                      activeUsers={org.activeUsers}
                      newThisWeek={org.newThisWeek}
                      warning={org.warning}
                      onViewClick={() => handleViewOrganization(org.code || org.id || 'unknown')}
                    />
                  ))}
                </SimpleGrid>
              </DashboardErrorBoundary>
            ) : (
              <Box p={4} borderRadius="md" border="1px solid" borderColor="brand.border" bg="brand.accent">
                <Stack spacing={2}>
                  <Text color="brand.subtleText" fontWeight="semibold">
                    No organizations assigned yet
                  </Text>
                  <Text color="brand.subtleText" fontSize="sm">
                    Assigned organizations will appear here once a super admin connects your account.
                  </Text>
                  <Button
                    as="a"
                    href={`mailto:${supportEmail}`}
                    size="sm"
                    variant="outline"
                    alignSelf="flex-start"
                  >
                    Contact super admin
                  </Button>
                </Stack>
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

  if (profileStatus !== 'ready') {
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
        <Stack spacing={4}>
          <Text fontSize="sm" color="brand.subtleText">
            Initializing dashboard...
          </Text>
          <Skeleton height="28px" width="220px" />
          <Skeleton height="180px" borderRadius="md" />
          <Skeleton height="180px" borderRadius="md" />
        </Stack>
      </PartnerDashboardLayout>
    )
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
