import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Grid,
  GridItem,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
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
} from '@chakra-ui/react'
import { format, formatDistanceToNow } from 'date-fns'
import { BarChart3, Calendar, Download, Search, TrendingUp } from 'lucide-react'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { fetchEngagementRoster } from '@/services/userManagementService'
import { listenToOrganizations, logAdminAction } from '@/services/superAdminService'
import { OrganizationRecord, SuperAdminDashboardMetrics } from '@/types/admin'

type TrendPoint = { label: string; value: number }

type ReportsAnalyticsPageProps = {
  metrics: SuperAdminDashboardMetrics
  registrationTrend: TrendPoint[]
  userGrowthTrend: TrendPoint[]
}

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  const maybeTimestamp = value as { toDate?: () => Date }
  if (typeof maybeTimestamp?.toDate === 'function') return maybeTimestamp.toDate() || null
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const statusBadgeColor = (status?: OrganizationRecord['status']) => {
  switch (status) {
    case 'active':
      return 'green'
    case 'watch':
      return 'yellow'
    case 'paused':
      return 'orange'
    case 'inactive':
      return 'gray'
    case 'suspended':
      return 'red'
    case 'pending':
      return 'purple'
    default:
      return 'gray'
  }
}

export const ReportsAnalyticsPage: React.FC<ReportsAnalyticsPageProps> = ({ metrics, registrationTrend, userGrowthTrend }) => {
  const [rangeDays, setRangeDays] = useState(30)
  const [isExporting, setIsExporting] = useState(false)
  const [search, setSearch] = useState('')

  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [organizationsLoading, setOrganizationsLoading] = useState(true)

  const [rosterLoading, setRosterLoading] = useState(true)
  const [engagementRoster, setEngagementRoster] = useState<Array<{ riskLevel?: string; engagementScore?: number; role?: string }>>([])

  useEffect(() => {
    setOrganizationsLoading(true)
    const unsubscribe = listenToOrganizations(
      (items) => {
        setOrganizations(items)
        setOrganizationsLoading(false)
      },
      () => setOrganizationsLoading(false),
    )
    return unsubscribe
  }, [])

  useEffect(() => {
    let isMounted = true
    setRosterLoading(true)
    fetchEngagementRoster()
      .then((items) => {
        if (!isMounted) return
        setEngagementRoster(items)
        setRosterLoading(false)
      })
      .catch(() => {
        if (!isMounted) return
        setEngagementRoster([])
        setRosterLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const visibleOrganizations = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return organizations
    return organizations.filter((org) => [org.name, org.code].filter(Boolean).some((value) => value.toLowerCase().includes(normalized)))
  }, [organizations, search])

  const sortedOrganizations = useMemo(() => {
    return [...visibleOrganizations].sort((a, b) => (b.averageEngagementRate ?? 0) - (a.averageEngagementRate ?? 0))
  }, [visibleOrganizations])

  const insights = useMemo(() => {
    const now = new Date()
    const validStatsOrgs = organizations.filter((org) => (org.averageEngagementRate ?? 0) > 0 || (org.memberCount ?? 0) > 0)
    const topEngagement = [...validStatsOrgs].sort((a, b) => (b.averageEngagementRate ?? 0) - (a.averageEngagementRate ?? 0))[0]
    const fastestGrowth = [...organizations].sort((a, b) => (b.newThisWeek ?? 0) - (a.newThisWeek ?? 0))[0]

    const churnRisk = [...organizations]
      .map((org) => {
        const engagement = org.averageEngagementRate ?? 0
        const lastActiveDate = parseDateValue(org.lastActive)
        const inactiveDays = lastActiveDate ? Math.max(0, Math.floor((now.getTime() - lastActiveDate.getTime()) / 86400000)) : rangeDays
        const statusPenalty = org.status === 'watch' ? 15 : org.status === 'paused' || org.status === 'inactive' || org.status === 'suspended' ? 25 : 0
        const score = (100 - engagement) + Math.min(60, inactiveDays) + statusPenalty
        return { org, inactiveDays, score }
      })
      .sort((a, b) => b.score - a.score)[0]

    const byRole = new Map<string, { total: number; count: number }>()
    engagementRoster.forEach((entry) => {
      const role = entry.role || 'unknown'
      const score = typeof entry.engagementScore === 'number' ? entry.engagementScore : null
      if (score === null) return
      const current = byRole.get(role) || { total: 0, count: 0 }
      byRole.set(role, { total: current.total + score, count: current.count + 1 })
    })
    const topRole = Array.from(byRole.entries())
      .map(([role, value]) => ({ role, avg: value.count ? Math.round(value.total / value.count) : 0, count: value.count }))
      .sort((a, b) => b.avg - a.avg)[0]

    const riskCounts = engagementRoster.reduce<Record<string, number>>((acc, entry) => {
      const key = entry.riskLevel || 'unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    const highRiskUsers = (riskCounts.critical || 0) + (riskCounts.high || 0)

    const watchlistOrgs = organizations.filter((org) => ['watch', 'paused', 'inactive', 'suspended'].includes(org.status)).length
    const avgOrgEngagement = validStatsOrgs.length
      ? Math.round(validStatsOrgs.reduce((sum, org) => sum + (org.averageEngagementRate ?? 0), 0) / validStatsOrgs.length)
      : 0

    const recentlyActiveOrgs = organizations.filter((org) => {
      const lastActive = parseDateValue(org.lastActive)
      if (!lastActive) return false
      const diff = Math.floor((now.getTime() - lastActive.getTime()) / 86400000)
      return diff <= 7
    }).length

    return {
      topEngagement,
      fastestGrowth,
      churnRisk,
      topRole,
      highRiskUsers,
      watchlistOrgs,
      avgOrgEngagement,
      recentlyActiveOrgs,
      riskCounts,
    }
  }, [engagementRoster, organizations, rangeDays])

  const insightsReady = !organizationsLoading && !rosterLoading

  const exportSummary = async () => {
    setIsExporting(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const rows: string[] = []
      rows.push(['metric', 'value', 'notes'].map(csvEscape).join(','))
      rows.push(['Active members', metrics.activeMembers, 'Across all organizations'].map(csvEscape).join(','))
      rows.push(['Engagement rate (platform)', `${Math.round(metrics.engagementRate * 100)}%`, `Rolling ${rangeDays}d`].map(csvEscape).join(','))
      rows.push(['New registrations', metrics.newRegistrations, 'Profiles with registrationDate'].map(csvEscape).join(','))
      rows.push(['Organizations', metrics.organizationCount, 'Total'].map(csvEscape).join(','))
      rows.push(['Watchlist organizations', insights.watchlistOrgs, 'watch/paused/inactive/suspended'].map(csvEscape).join(','))
      rows.push(['High-risk users', insights.highRiskUsers, 'critical + high'].map(csvEscape).join(','))

      rows.push('')
      rows.push(['registrationTrend_label', 'registrationTrend_value'].map(csvEscape).join(','))
      registrationTrend.forEach((point) => rows.push([point.label, point.value].map(csvEscape).join(',')))

      rows.push('')
      rows.push(['userGrowthTrend_label', 'userGrowthTrend_value'].map(csvEscape).join(','))
      userGrowthTrend.forEach((point) => rows.push([point.label, point.value].map(csvEscape).join(',')))

      downloadCsv(`super-admin-report-${today}.csv`, rows.join('\n'))
      logAdminAction({ action: 'report_exported', metadata: { report: 'summary', rangeDays } }).catch(() => undefined)
    } finally {
      setIsExporting(false)
    }
  }

  const exportOrganizationComparison = async () => {
    setIsExporting(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const headers = ['name', 'code', 'status', 'members', 'activeUsers', 'newThisWeek', 'avgEngagementRate', 'lastActive', 'statsUpdatedAt']
      const rows = sortedOrganizations.map((org) => {
        const members = org.memberCount ?? org.teamSize ?? 0
        const lastActive = parseDateValue(org.lastActive)
        const updated = parseDateValue(org.statsUpdatedAt)
        return [
          org.name,
          org.code,
          org.status,
          members,
          org.activeUsers ?? 0,
          org.newThisWeek ?? 0,
          org.averageEngagementRate ?? 0,
          lastActive ? lastActive.toISOString() : '',
          updated ? updated.toISOString() : '',
        ]
      })

      const csv = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')
      downloadCsv(`organization-performance-${today}.csv`, csv)
      logAdminAction({ action: 'report_exported', metadata: { report: 'organization_comparison', rangeDays } }).catch(() => undefined)
    } finally {
      setIsExporting(false)
    }
  }

  const exportOperations = async () => {
    setIsExporting(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const rows: string[] = []
      rows.push(['metric', 'value'].map(csvEscape).join(','))
      rows.push(['Monitored users (engagement scores)', engagementRoster.length].map(csvEscape).join(','))
      rows.push(['High-risk users', insights.highRiskUsers].map(csvEscape).join(','))
      rows.push(['Organizations', organizations.length].map(csvEscape).join(','))
      rows.push(['Watchlist organizations', insights.watchlistOrgs].map(csvEscape).join(','))
      rows.push(['Avg org engagement', `${insights.avgOrgEngagement}%`].map(csvEscape).join(','))
      rows.push(['Recently active orgs (7d)', insights.recentlyActiveOrgs].map(csvEscape).join(','))

      rows.push('')
      rows.push(['riskLevel', 'userCount'].map(csvEscape).join(','))
      Object.entries(insights.riskCounts).forEach(([riskLevel, count]) => rows.push([riskLevel, count].map(csvEscape).join(',')))

      downloadCsv(`operations-analytics-${today}.csv`, rows.join('\n'))
      logAdminAction({ action: 'report_exported', metadata: { report: 'operations', rangeDays } }).catch(() => undefined)
    } finally {
      setIsExporting(false)
    }
  }

  return (
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
                <Button leftIcon={<Calendar size={16} />} variant="outline" p={0} pr={3}>
                  <Select
                    value={rangeDays}
                    onChange={(e) => setRangeDays(Number(e.target.value))}
                    variant="unstyled"
                    pl={3}
                    pr={8}
                    fontWeight="semibold"
                    cursor="pointer"
                    aria-label="Select date range"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </Select>
                </Button>
                <Button leftIcon={<Download size={16} />} colorScheme="purple" onClick={exportSummary} isLoading={isExporting}>
                  Export report
                </Button>
              </HStack>
            </Flex>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <MetricTile label="Active members" value={metrics.activeMembers.toLocaleString()} helper="Across all organizations" />
              <MetricTile label="Engagement rate" value={`${Math.round(metrics.engagementRate * 100)}%`} helper={`Rolling ${rangeDays}d`} />
              <MetricTile label="New registrations" value={metrics.newRegistrations.toLocaleString()} helper="Profiles with registrationDate" />
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

                  {insightsReady ? (
                    <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                      <InsightCard
                        title="Top organization"
                        value={insights.topEngagement?.name || '—'}
                        helper={insights.topEngagement ? `${insights.topEngagement.averageEngagementRate ?? 0}% avg engagement` : 'No org stats yet'}
                      />
                      <InsightCard
                        title="Fastest growth"
                        value={insights.fastestGrowth?.name || '—'}
                        helper={insights.fastestGrowth ? `${insights.fastestGrowth.newThisWeek ?? 0} new this week` : 'No org stats yet'}
                      />
                      <InsightCard
                        title="Most engaged role"
                        value={insights.topRole?.role ? insights.topRole.role.replace(/_/g, ' ') : '—'}
                        helper={insights.topRole ? `Avg score ${insights.topRole.avg} (${insights.topRole.count} users)` : 'No engagement scores yet'}
                      />
                      <InsightCard
                        title="Churn risk"
                        value={insights.churnRisk?.org?.name || '—'}
                        helper={insights.churnRisk ? `${insights.churnRisk.org.averageEngagementRate ?? 0}% engagement · ${insights.churnRisk.inactiveDays}d inactive` : 'No org stats yet'}
                      />
                    </SimpleGrid>
                  ) : (
                    <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} height="96px" borderRadius="md" />
                      ))}
                    </SimpleGrid>
                  )}

                  <Button
                    leftIcon={<BarChart3 size={16} />}
                    alignSelf="flex-start"
                    variant="outline"
                    onClick={exportOrganizationComparison}
                    isLoading={isExporting}
                    isDisabled={organizationsLoading}
                  >
                    Download comparison report
                  </Button>
                </Stack>
              </CardBody>
            </Card>

            <Card bg="gray.50" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <TrendingUp size={18} />
                      <Text fontWeight="bold">Operational analytics</Text>
                    </HStack>
                    <Badge colorScheme="green">Live</Badge>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">
                    Real-time health signals based on engagement scores and organization activity snapshots.
                  </Text>

                  {insightsReady ? (
                    <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                      <InsightCard title="High-risk users" value={insights.highRiskUsers.toLocaleString()} helper="critical + high" />
                      <InsightCard title="Watchlist orgs" value={insights.watchlistOrgs.toLocaleString()} helper="watch/paused/inactive/suspended" />
                      <InsightCard title="Avg org engagement" value={`${insights.avgOrgEngagement}%`} helper="Across org snapshots" />
                      <InsightCard title="Recently active orgs" value={insights.recentlyActiveOrgs.toLocaleString()} helper="Last active within 7d" />
                    </SimpleGrid>
                  ) : (
                    <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} height="96px" borderRadius="md" />
                      ))}
                    </SimpleGrid>
                  )}

                  <HStack spacing={3}>
                    <Button leftIcon={<Download size={16} />} variant="outline" onClick={exportOperations} isLoading={isExporting}>
                      Export operations CSV
                    </Button>
                    <Button leftIcon={<Download size={16} />} colorScheme="purple" onClick={exportOrganizationComparison} isLoading={isExporting}>
                      Export org performance CSV
                    </Button>
                  </HStack>
                </Stack>
              </CardBody>
            </Card>

            <Card bg="gray.50" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between" align={{ base: 'flex-start', md: 'center' }} wrap="wrap" spacing={3}>
                    <Stack spacing={1}>
                      <Text fontWeight="bold">Organizational performance</Text>
                      <Text fontSize="sm" color="brand.subtleText">
                        Performance snapshots based on engagement rate, growth, and activity recency.
                      </Text>
                    </Stack>
                    <HStack spacing={3}>
                      <InputGroup maxW={{ base: '100%', md: '260px' }}>
                        <InputLeftElement pointerEvents="none">
                          <Search size={16} />
                        </InputLeftElement>
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orgs" bg="white" />
                      </InputGroup>
                      <Button variant="outline" leftIcon={<BarChart3 size={16} />} onClick={exportOrganizationComparison} isLoading={isExporting}>
                        Export
                      </Button>
                    </HStack>
                  </HStack>

                  {organizationsLoading ? (
                    <Stack spacing={2}>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} height="44px" borderRadius="md" />
                      ))}
                    </Stack>
                  ) : (
                    <Box overflowX="auto" bg="white" border="1px solid" borderColor="brand.border" borderRadius="md">
                      <Table size="sm">
                        <Thead bg="gray.50">
                          <Tr>
                            <Th>Organization</Th>
                            <Th>Status</Th>
                            <Th isNumeric>Members</Th>
                            <Th isNumeric>Active</Th>
                            <Th isNumeric>New</Th>
                            <Th isNumeric>Avg engagement</Th>
                            <Th>Last active</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {sortedOrganizations.slice(0, 50).map((org) => {
                            const members = org.memberCount ?? org.teamSize ?? 0
                            const lastActive = parseDateValue(org.lastActive)
                            return (
                              <Tr key={org.id || org.code}>
                                <Td>
                                  <Stack spacing={0}>
                                    <Text fontWeight="semibold" color="brand.text">
                                      {org.name}
                                    </Text>
                                    <Text fontSize="xs" color="brand.subtleText">
                                      {org.code}
                                    </Text>
                                  </Stack>
                                </Td>
                                <Td>
                                  <Badge colorScheme={statusBadgeColor(org.status)} textTransform="capitalize">
                                    {org.status || 'unknown'}
                                  </Badge>
                                </Td>
                                <Td isNumeric>{members.toLocaleString()}</Td>
                                <Td isNumeric>{(org.activeUsers ?? 0).toLocaleString()}</Td>
                                <Td isNumeric>{(org.newThisWeek ?? 0).toLocaleString()}</Td>
                                <Td isNumeric>{`${org.averageEngagementRate ?? 0}%`}</Td>
                                <Td>
                                  {lastActive ? (
                                    <Text fontSize="sm">{formatDistanceToNow(lastActive, { addSuffix: true })}</Text>
                                  ) : (
                                    <Text fontSize="sm" color="brand.subtleText">
                                      —
                                    </Text>
                                  )}
                                </Td>
                              </Tr>
                            )
                          })}
                          {sortedOrganizations.length === 0 ? (
                            <Tr>
                              <Td colSpan={7}>
                                <Text py={6} textAlign="center" color="brand.subtleText">
                                  No organizations match your search.
                                </Text>
                              </Td>
                            </Tr>
                          ) : null}
                        </Tbody>
                      </Table>
                    </Box>
                  )}

                  <Text fontSize="xs" color="brand.subtleText">
                    Showing {Math.min(sortedOrganizations.length, 50)} of {sortedOrganizations.length} organizations.
                  </Text>
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )
}

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
