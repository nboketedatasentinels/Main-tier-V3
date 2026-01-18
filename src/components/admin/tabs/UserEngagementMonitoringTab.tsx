import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Flex,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, BarChart2, Clock4, Minus, Search, Target, TrendingDown, TrendingUp, UsersRound } from 'lucide-react'
import {
  EngagementRosterEntry,
  EngagementTotals,
  EngagementTrendPoint,
  RiskLevel,
  ManagedUserRecord,
  OrganizationOption,
} from '@/services/userManagementService'
import {
  EngagementAvailability,
  fetchAdminEngagementHistory,
  fetchAdminEngagementSnapshot,
  fetchAdminRecentActivities,
} from '@/services/admin/adminEngagementService'
import { formatAdminFirestoreError } from '@/services/admin/adminErrors'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { useAuth } from '@/hooks/useAuth'

type RosterFilters = {
  organization: string
  mentor: string
  riskLevel: string
  interventionStatus: string
  timeRange: string
}

const riskColors: Record<RiskLevel, { badge: string; border: string }> = {
  critical: { badge: 'red', border: 'red.500' },
  high: { badge: 'orange', border: 'orange.400' },
  moderate: { badge: 'yellow', border: 'yellow.400' },
  low: { badge: 'green', border: 'green.500' },
  emerging: { badge: 'purple', border: 'purple.500' },
  recovering: { badge: 'teal', border: 'teal.500' },
  unknown: { badge: 'gray', border: 'gray.400' },
}

const formatDate = (date?: Date | null) => {
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const trendIcon = (trend: 'up' | 'down' | 'flat') => {
  if (trend === 'up') return TrendingUp
  if (trend === 'down') return TrendingDown
  return Minus
}

const riskLabel = (level: RiskLevel) => level.charAt(0).toUpperCase() + level.slice(1)

interface UserEngagementMonitoringTabProps {
  users: ManagedUserRecord[]
  organizations: OrganizationOption[]
}

export const UserEngagementMonitoringTab = ({ users: propUsers, organizations: propOrganizations }: UserEngagementMonitoringTabProps) => {
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isAdmin } = useAuth()

  const [roster, setRoster] = useState<EngagementRosterEntry[]>([])
  const [trendData, setTrendData] = useState<EngagementTrendPoint[]>([])
  const [mentors, setMentors] = useState<Array<{ id: string; name: string }>>([])
  const [selectedEntry, setSelectedEntry] = useState<EngagementRosterEntry | null>(null)
  const [history, setHistory] = useState<Array<{ label: string; engagementScore: number; impactPoints?: number }>>([])
  const [recentActivity, setRecentActivity] = useState<
    Array<{ title: string; description?: string; timestamp?: Date | null; category?: string; actor?: string; type?: string }>
  >([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [availability, setAvailability] = useState<EngagementAvailability>('ready')
  const [detailLoading, setDetailLoading] = useState(false)

  const [filters, setFilters] = useState<RosterFilters>({
    organization: 'all',
    mentor: 'all',
    riskLevel: 'all',
    interventionStatus: 'all',
    timeRange: '30',
  })

  const resolveLoadError = (err: unknown) => {
    return formatAdminFirestoreError(err, 'Unable to load engagement data.', {
      indexMessage: 'Missing Firestore index for engagement queries.',
      missingCollectionMessage: 'Engagement collection not initialized.',
    })
  }

  const loadEngagementData = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const { roster: rosterData, trends, availability: engagementState } = await fetchAdminEngagementSnapshot(isAdmin)

      setRoster(rosterData)
      setTrendData(trends)
      setAvailability(engagementState)
    } catch (err) {
      console.error(err)
      const message = resolveLoadError(err)
      setLoadError(message)
      toast({ title: message, status: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEngagementData()
  }, [isAdmin, toast])

  useEffect(() => {
    setMentors(propUsers.filter((u) => u.role === 'mentor').map((u) => ({ id: u.id, name: u.name })))
  }, [propUsers])

  const filteredRoster = useMemo(() => {
    const now = new Date()
    const days = Number(filters.timeRange)

    return roster.filter((item) => {
      const matchesOrg =
        filters.organization === 'all' || item.companyId === filters.organization || item.organizationCode === filters.organization
      const matchesMentor = filters.mentor === 'all' || item.mentorId === filters.mentor
      const matchesRisk = filters.riskLevel === 'all' || item.riskLevel === filters.riskLevel
      const matchesIntervention =
        filters.interventionStatus === 'all' || item.interventionStatus === filters.interventionStatus

      const matchesTime = (() => {
        if (!item.lastActive) return true
        if (Number.isNaN(days)) return true
        const diff = (now.getTime() - item.lastActive.getTime()) / (1000 * 60 * 60 * 24)
        return diff <= days
      })()

      return matchesOrg && matchesMentor && matchesRisk && matchesIntervention && matchesTime
    })
  }, [filters.interventionStatus, filters.mentor, filters.organization, filters.riskLevel, filters.timeRange, roster])

  const totals: EngagementTotals = useMemo(() => {
    const monitoredUsers = filteredRoster.length
    const atRisk = filteredRoster.filter((item) => ['critical', 'high'].includes(item.riskLevel)).length
    const interventionsOpen = filteredRoster.filter((item) => item.interventionStatus && item.interventionStatus !== 'completed').length
    const flagged = filteredRoster.filter((item) => item.interventionStatus === 'pending' || item.interventionStatus === 'scheduled').length
    return { monitoredUsers, atRisk, interventionsOpen, flagged }
  }, [filteredRoster])

  const riskSummaries = useMemo(() => {
    const byLevel = filteredRoster.reduce<Record<string, EngagementRosterEntry[]>>((acc, entry) => {
      const key = entry.riskLevel || 'unknown'
      acc[key] = acc[key] || []
      acc[key].push(entry)
      return acc
    }, {})

    return Object.entries(byLevel).map(([level, entries]) => {
      const scoreSum = entries.reduce((sum, entry) => sum + (entry.engagementScore || 0), 0)
      const avgScore = entries.length ? scoreSum / entries.length : 0
      const change = entries.reduce((sum, entry) => sum + (entry.trend30d || 0), 0) / (entries.length || 1)
      const trend: 'up' | 'down' | 'flat' = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
      const color = riskColors[level as RiskLevel]?.border || 'gray.400'
      return { label: riskLabel(level as RiskLevel), userCount: entries.length, avgScore, change, trend, color }
    })
  }, [filteredRoster])

  const handleOpenDetail = async (entry: EngagementRosterEntry) => {
    setSelectedEntry(entry)
    setDetailLoading(true)
    onOpen()
    try {
      const [historyData, activities] = await Promise.all([
        fetchAdminEngagementHistory(isAdmin, entry.userId),
        fetchAdminRecentActivities(isAdmin, entry.userId),
      ])
      setHistory(historyData)
      setRecentActivity(activities)
    } catch (err) {
      console.error(err)
      toast({ title: 'Unable to load engagement detail', status: 'error' })
    } finally {
      setDetailLoading(false)
    }
  }

  const renderTrendChart = () => {
    if (!trendData.length) {
      return (
        <Flex py={8} direction="column" align="center" gap={2}>
          <Text color="gray.700" fontWeight="medium">
            No trend data for the selected filters.
          </Text>
        </Flex>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="avgScore" name="Avg score" stroke="var(--chakra-colors-purple-500)" strokeWidth={2} />
          <Line type="monotone" dataKey="highRiskUsers" name="High risk" stroke="var(--chakra-colors-orange-400)" strokeWidth={2} />
          <Line type="monotone" dataKey="interventions" name="Interventions" stroke="var(--chakra-colors-teal-400)" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  const renderRosterTable = () => {
    if (loading) {
      return (
        <Flex py={12} justify="center" align="center" gap={3}>
          <Icon as={Search} color="purple.500" />
          <Text color="gray.600">Loading roster…</Text>
        </Flex>
      )
    }

    if (loadError) {
      return (
        <Flex py={10} direction="column" align="center" gap={3}>
          <Icon as={BarChart2} boxSize={10} color="red.300" />
          <Text fontWeight="medium" color="red.600">
            {loadError}
          </Text>
          <Button size="sm" variant="outline" colorScheme="purple" onClick={loadEngagementData}>
            Retry loading
          </Button>
        </Flex>
      )
    }

    if (!filteredRoster.length) {
      const emptyMessage =
        availability === 'not_enabled'
          ? 'Engagement not enabled yet.'
          : availability === 'no_activity'
            ? 'No learner activity recorded.'
            : roster.length === 0
              ? 'No engagement data yet.'
              : 'No learners match the selected filters.'
      const emptyDetail =
        availability === 'not_enabled'
          ? 'Engagement collections are not initialized for this environment.'
          : roster.length === 0
            ? 'Collections will populate once activity tracking is enabled.'
            : 'Adjust filters to expand your view of monitored learners.'
      return (
        <Flex py={10} direction="column" align="center" gap={3}>
          <Icon as={BarChart2} boxSize={10} color="gray.300" />
          <Text fontWeight="medium" color="gray.700">
            {emptyMessage}
          </Text>
          <Text color="gray.500" fontSize="sm">
            {emptyDetail}
          </Text>
        </Flex>
      )
    }

    return (
      <Box overflowX="auto">
        <Table size="sm" minW="1100px">
          <Thead bg="gray.50">
            <Tr>
              <Th>Learner</Th>
              <Th>Organization</Th>
              <Th>Mentor</Th>
              <Th>Risk Level</Th>
              <Th>Engagement Score</Th>
              <Th>30d Trend</Th>
              <Th>Last Active</Th>
              <Th>Intervention Status</Th>
              <Th>Last Intervention</Th>
              <Th>Next Check-in</Th>
              <Th textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredRoster.map((entry) => (
              <Tr key={entry.id} _hover={{ bg: 'gray.50' }}>
                <Td>
                  <Stack spacing={0}>
                    <Text fontWeight="semibold" color="gray.900">
                      {entry.name}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      {entry.email || '—'}
                    </Text>
                  </Stack>
                </Td>
                <Td>
                  <Stack spacing={0}>
                    <Text fontWeight="medium" color="gray.800">
                      {entry.organizationName || 'Independent'}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {entry.organizationCode || '—'}
                    </Text>
                  </Stack>
                </Td>
                <Td>{entry.mentorName || '—'}</Td>
                <Td>
                  <Badge colorScheme={riskColors[entry.riskLevel]?.badge || 'gray'}>{riskLabel(entry.riskLevel)}</Badge>
                </Td>
                <Td>{entry.engagementScore.toFixed(1)}</Td>
                <Td color={entry.trend30d && entry.trend30d >= 0 ? 'green.600' : 'red.500'}>
                  {entry.trend30d ? `${entry.trend30d > 0 ? '+' : ''}${entry.trend30d.toFixed(1)}%` : '—'}
                </Td>
                <Td>{formatDate(entry.lastActive)}</Td>
                <Td>
                  <Badge>{entry.interventionStatus || 'not_started'}</Badge>
                </Td>
                <Td>{formatDate(entry.lastInterventionAt)}</Td>
                <Td>{formatDate(entry.nextCheckInAt)}</Td>
                <Td textAlign="right">
                  <Button size="sm" variant="outline" colorScheme="purple" onClick={() => handleOpenDetail(entry)}>
                    View details
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    )
  }

  const modalBadges = selectedEntry ? (
    <HStack spacing={2} wrap="wrap">
      <Badge colorScheme={riskColors[selectedEntry.riskLevel]?.badge || 'gray'}>{riskLabel(selectedEntry.riskLevel)}</Badge>
      {selectedEntry.organizationName && <Badge>{selectedEntry.organizationName}</Badge>}
      {selectedEntry.mentorName && <Badge>{selectedEntry.mentorName}</Badge>}
      {selectedEntry.interventionStatus && <Badge>{selectedEntry.interventionStatus}</Badge>}
    </HStack>
  ) : null

  return (
    <Stack spacing={6}>
      <Stack spacing={1}>
        <Text fontSize="3xl" fontWeight="semibold" color="gray.900">
          Engagement monitoring
        </Text>
        <Text color="gray.600">Track at-risk learners, interventions, and engagement recovery trends across organizations.</Text>
      </Stack>

      <Card border="1px solid" borderColor="gray.200" borderRadius="2xl" bg="white">
        <CardBody>
          <Stack spacing={4}>
            <Text fontWeight="semibold" color="gray.800">
              Filters
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
              <Select value={filters.organization} onChange={(e) => setFilters((prev) => ({ ...prev, organization: e.target.value }))}>
                <option value="all">All organizations</option>
                {propOrganizations.map((org) => (
                  <option key={org.id} value={org.code || org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
              <Select value={filters.mentor} onChange={(e) => setFilters((prev) => ({ ...prev, mentor: e.target.value }))}>
                <option value="all">All mentors</option>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name}
                  </option>
                ))}
              </Select>
              <Select value={filters.riskLevel} onChange={(e) => setFilters((prev) => ({ ...prev, riskLevel: e.target.value }))}>
                <option value="all">All risk levels</option>
                {['critical', 'high', 'moderate', 'low', 'emerging', 'recovering'].map((level) => (
                  <option key={level} value={level}>
                    {riskLabel(level as RiskLevel)}
                  </option>
                ))}
              </Select>
              <Select
                value={filters.interventionStatus}
                onChange={(e) => setFilters((prev) => ({ ...prev, interventionStatus: e.target.value }))}
              >
                <option value="all">All statuses</option>
                {['pending', 'scheduled', 'in_progress', 'completed', 'not_started'].map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </Select>
              <Select value={filters.timeRange} onChange={(e) => setFilters((prev) => ({ ...prev, timeRange: e.target.value }))}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </Select>
            </SimpleGrid>
          </Stack>
        </CardBody>
      </Card>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
        <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="xl">
          <CardBody>
            <HStack justify="space-between">
              <Icon as={UsersRound} color="purple.500" />
              <Badge colorScheme="purple">Live</Badge>
            </HStack>
            <Text fontSize="sm" color="gray.500" mt={2}>
              Monitored learners
            </Text>
            <Text fontSize="2xl" fontWeight="bold">{totals.monitoredUsers}</Text>
            <Text fontSize="sm" color="gray.500">
              Learners currently in monitoring scope
            </Text>
          </CardBody>
        </Card>

        <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="xl">
          <CardBody>
            <Icon as={AlertTriangle} color="orange.400" />
            <Text fontSize="sm" color="gray.500" mt={2}>
              At-risk
            </Text>
            <Text fontSize="2xl" fontWeight="bold">{totals.atRisk}</Text>
            <Text fontSize="sm" color="gray.500">
              Learners in high or critical risk segments
            </Text>
          </CardBody>
        </Card>

        <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="xl">
          <CardBody>
            <Icon as={Target} color="teal.500" />
            <Text fontSize="sm" color="gray.500" mt={2}>
              Active interventions
            </Text>
            <Text fontSize="2xl" fontWeight="bold">{totals.interventionsOpen}</Text>
            <Text fontSize="sm" color="gray.500">
              Coaching plans currently active
            </Text>
          </CardBody>
        </Card>

        <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="xl">
          <CardBody>
            <Icon as={Clock4} color="purple.500" />
            <Text fontSize="sm" color="gray.500" mt={2}>
              Awaiting review
            </Text>
            <Text fontSize="2xl" fontWeight="bold">{totals.flagged}</Text>
            <Text fontSize="sm" color="gray.500">
              Learners awaiting next check-in
            </Text>
          </CardBody>
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={3}>
        {riskSummaries.map((summary) => (
          <Box
            key={summary.label}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="lg"
            bg="white"
            overflow="hidden"
            boxShadow="sm"
          >
            <Box h="4px" bg={summary.color} />
            <Stack spacing={2} p={4}>
              <HStack justify="space-between">
                <Text fontWeight="semibold" color="gray.800">
                  {summary.label}
                </Text>
                <Icon as={trendIcon(summary.trend)} color={summary.trend === 'up' ? 'green.500' : summary.trend === 'down' ? 'red.500' : 'gray.500'} />
              </HStack>
              <Text color="gray.600">{summary.userCount} users</Text>
              <Text fontSize="sm" color="gray.500">
                Avg engagement score: {summary.avgScore.toFixed(1)}
              </Text>
              <Text fontSize="sm" color={summary.trend === 'up' ? 'green.600' : summary.trend === 'down' ? 'red.600' : 'gray.600'}>
                {summary.change > 0 ? '+' : ''}
                {summary.change.toFixed(1)}% vs prior period
              </Text>
            </Stack>
          </Box>
        ))}
      </SimpleGrid>

      <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="2xl">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between">
              <Text fontWeight="semibold" color="gray.800">
                Risk and intervention trend
              </Text>
              <HStack spacing={2} color="gray.600" fontSize="sm">
                <Box w={3} h={3} bg="purple.500" borderRadius="full" /> Avg score
                <Box w={3} h={3} bg="orange.400" borderRadius="full" /> High risk
                <Box w={3} h={3} bg="teal.400" borderRadius="full" /> Interventions
              </HStack>
            </HStack>
            {renderTrendChart()}
          </Stack>
        </CardBody>
      </Card>

      <Card border="1px solid" borderColor="gray.200" bg="white" borderRadius="2xl">
        <CardBody>
          <Stack spacing={4}>
            <Text fontWeight="semibold" color="gray.800">
              Learner monitoring roster
            </Text>
            {renderRosterTable()}
          </Stack>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Engagement detail</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedEntry && (
              <Stack spacing={4}>
                <Stack spacing={1}>
                  <Text fontSize="lg" fontWeight="semibold">
                    {selectedEntry.name}
                  </Text>
                  <Text color="gray.600">{selectedEntry.email}</Text>
                  {modalBadges}
                </Stack>

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md" bg="gray.50">
                    <Text fontSize="sm" color="gray.500">
                      Engagement score
                    </Text>
                    <Text fontWeight="bold" fontSize="xl">
                      {selectedEntry.engagementScore.toFixed(1)}
                    </Text>
                  </Box>
                  <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md" bg="gray.50">
                    <Text fontSize="sm" color="gray.500">
                      Last active
                    </Text>
                    <Text fontWeight="bold" fontSize="xl">
                      {selectedEntry.lastActive ? formatDistanceToNow(selectedEntry.lastActive, { addSuffix: true }) : 'Unknown'}
                    </Text>
                  </Box>
                  <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md" bg="gray.50">
                    <Text fontSize="sm" color="gray.500">
                      Time in risk level
                    </Text>
                    <Text fontWeight="bold" fontSize="xl">
                      {selectedEntry.trend30d ? `${Math.abs(Math.round(selectedEntry.trend30d))} days` : '—'}
                    </Text>
                  </Box>
                </SimpleGrid>

                <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4}>
                  <Text fontWeight="semibold" mb={2}>
                    Engagement &amp; intervention history
                  </Text>
                  {detailLoading ? (
                    <Flex py={6} justify="center">
                      <Text color="gray.600">Loading history…</Text>
                    </Flex>
                  ) : history.length ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={history}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="engagementScore" name="Engagement score" stroke="var(--chakra-colors-purple-500)" />
                        <Line type="monotone" dataKey="impactPoints" name="Impact points" stroke="var(--chakra-colors-green-500)" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Flex py={4} justify="center" align="center">
                      <Text color="gray.600">No engagement history available.</Text>
                    </Flex>
                  )}
                </Box>

                <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4}>
                  <Text fontWeight="semibold" mb={3}>
                    Recent activity
                  </Text>
                  {detailLoading ? (
                    <Flex py={4} justify="center">
                      <Text color="gray.600">Loading activity…</Text>
                    </Flex>
                  ) : recentActivity.length ? (
                    <Stack divider={<Divider />} spacing={3}>
                      {recentActivity.map((item, idx) => (
                        <Flex key={`${item.title}-${idx}`} justify="space-between" align="flex-start" gap={3}>
                          <Box>
                            <Text fontWeight="semibold" color="gray.800">
                              {item.title}
                            </Text>
                            {item.description && (
                              <Text color="gray.600" fontSize="sm">
                                {item.description}
                              </Text>
                            )}
                            <HStack spacing={2} mt={2}>
                              {item.category && <Badge>{item.category}</Badge>}
                              {item.actor && <Badge colorScheme="purple">{item.actor}</Badge>}
                            </HStack>
                          </Box>
                          <Text color="gray.500" fontSize="sm">
                            {item.timestamp ? formatDistanceToNow(item.timestamp, { addSuffix: true }) : 'Unknown time'}
                          </Text>
                        </Flex>
                      ))}
                    </Stack>
                  ) : (
                    <Flex py={4} justify="center">
                      <Text color="gray.600">No recent activities recorded.</Text>
                    </Flex>
                  )}
                </Box>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  )
}