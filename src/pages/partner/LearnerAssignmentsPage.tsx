import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Icon,
  Input,
  Select,
  Spinner,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  Tag,
  TagLabel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { AlertTriangle, RefreshCcw, Search, Users } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { PartnerLayout } from '@/layouts/PartnerLayout'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg'
import { useLearnerOverview, type LearnerOverviewRow } from '@/hooks/useLearnerOverview'
import {
  assignMentorToLearner,
  fetchMentorsForOrg,
  type OrgMentorOption,
} from '@/services/learnerAssignmentService'
import { getDisplayName } from '@/utils/displayName'
import { getJourneyLabel } from '@/utils/journeyType'

type FilterMode = 'all' | 'unassigned' | 'zero_sessions'

const formatPoints = (value: number | null | undefined) => {
  if (!value || Number.isNaN(Number(value))) return '0'
  return Number(value).toLocaleString()
}

export const LearnerAssignmentsPage: React.FC = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const { profile, isSuperAdmin } = useAuth()
  const { organizations, loading: orgsLoading } = usePartnerOrganizations()

  const handleNavigate = useCallback(
    (key: string) => {
      if (key === 'learner-assignments') return
      if (key === 'partner-assignment') {
        navigate('/partner/partner-assignment')
        return
      }
      if (key === 'course-approvals') {
        navigate('/partner/course-approvals')
        return
      }
      if (key === 'overview') {
        navigate('/partner/dashboard')
        return
      }
      navigate(`/partner/dashboard?page=${encodeURIComponent(key)}`)
    },
    [navigate],
  )

  const { selectedOrg: selectedOrgId, setSelectedOrg: setSelectedOrgId } =
    usePartnerSelectedOrg()
  const [orgJourneyType, setOrgJourneyType] = useState<string | null>(null)
  const [mentors, setMentors] = useState<OrgMentorOption[]>([])
  const [mentorsLoading, setMentorsLoading] = useState(false)
  const [mentorsError, setMentorsError] = useState<string | null>(null)
  const [assigningLearnerId, setAssigningLearnerId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')

  const orgOptions = useMemo(
    () =>
      organizations
        .filter((o) => Boolean(o.id))
        .map((o) => ({ id: o.id!, code: o.code, name: o.name })),
    [organizations],
  )

  // Auto-pick first org when options load
  useEffect(() => {
    if (selectedOrgId) return
    if (orgOptions.length > 0) {
      setSelectedOrgId(orgOptions[0].id)
      return
    }
    if (profile?.companyId) {
      setSelectedOrgId(profile.companyId)
    }
  }, [orgOptions, profile?.companyId, selectedOrgId])

  const selectedOrg = useMemo(
    () => orgOptions.find((o) => o.id === selectedOrgId),
    [orgOptions, selectedOrgId],
  )

  const { rows, loading, learnersError, statsError, refreshStats } =
    useLearnerOverview(selectedOrgId || null)

  // Load the selected org's journeyType — this is the source of truth
  // for whether to show mentor/ambassador columns. Reading it from
  // learner rows is unreliable because stub profiles can have
  // journeyType = undefined.
  useEffect(() => {
    if (!selectedOrgId) {
      setOrgJourneyType(null)
      return
    }
    let cancelled = false
    getDoc(doc(db, 'organizations', selectedOrgId))
      .then((snap) => {
        if (cancelled) return
        const data = snap.data()
        setOrgJourneyType(typeof data?.journeyType === 'string' ? data.journeyType : null)
      })
      .catch(() => {
        if (cancelled) return
        setOrgJourneyType(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedOrgId])

  // Load mentors when org changes
  useEffect(() => {
    if (!selectedOrgId) {
      setMentors([])
      return
    }
    let cancelled = false
    setMentorsLoading(true)
    setMentorsError(null)
    fetchMentorsForOrg({
      companyId: selectedOrgId,
      companyCode: selectedOrg?.code ?? null,
    })
      .then((next) => {
        if (cancelled) return
        setMentors(next)
        setMentorsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setMentorsError(err instanceof Error ? err.message : String(err))
        setMentorsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedOrgId, selectedOrg?.code])

  const handleAssignMentor = async (row: LearnerOverviewRow, mentorId: string) => {
    if (!profile?.id) return
    setAssigningLearnerId(row.learnerId)
    try {
      await assignMentorToLearner({
        learnerId: row.learnerId,
        mentorId: mentorId || null,
        actor: { id: profile.id, name: getDisplayName(profile) },
      })
      const mentorName = mentorId
        ? mentors.find((m) => m.id === mentorId)?.fullName ?? 'selected mentor'
        : null
      toast({
        title: mentorId ? 'Mentor assigned' : 'Mentor cleared',
        description: mentorId
          ? `${getDisplayName(row.learner, 'Learner')} is now paired with ${mentorName}.`
          : undefined,
        status: 'success',
      })
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Try again in a moment.'
      toast({ title: 'Could not update mentor', description, status: 'error' })
    } finally {
      setAssigningLearnerId(null)
    }
  }

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter === 'unassigned' && !row.flags.noMentor) return false
      if (filter === 'zero_sessions' && !row.flags.zeroSessions) return false
      if (!normalizedSearch) return true
      const name = getDisplayName(row.learner, '').toLowerCase()
      const email = (row.learner.email ?? '').toLowerCase()
      return name.includes(normalizedSearch) || email.includes(normalizedSearch)
    })
  }, [rows, filter, search])

  const counts = useMemo(() => {
    const total = rows.length
    const withMentor = rows.filter((r) => !r.flags.noMentor).length
    const zeroSession = rows.filter((r) => r.flags.zeroSessions).length
    return {
      total,
      withMentor,
      unassigned: total - withMentor,
      zeroSession,
    }
  }, [rows])

  // 6W (6-Week Power Journey) doesn't include mentor or ambassador sessions,
  // so the Mentor / Mentor Sessions / Ambassador Sessions columns are hidden
  // when the selected org is configured for 6W. Reading from the org doc
  // (not from learner rows) avoids false positives when a learner profile
  // has journeyType = undefined.
  const showMentorColumns = orgJourneyType !== '6W'

  const hasOrgs = orgOptions.length > 0 || Boolean(profile?.companyId)

  const layoutOrgs = useMemo(
    () => orgOptions.map((o) => ({ id: o.id, code: o.code, name: o.name })),
    [orgOptions],
  )

  return (
    <PartnerLayout
      activeItem="learner-assignments"
      organizations={layoutOrgs}
      onNavigate={handleNavigate}
    >
      <Stack spacing={6}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} flexWrap="wrap">
          <Box>
            <Heading size="lg">Learner assignments</Heading>
            <Text color="text.secondary">
              Pair each learner with a mentor in their organization and monitor session progress.
            </Text>
          </Box>
          <HStack spacing={3}>
            <Button
              leftIcon={<RefreshCcw size={16} />}
              variant="outline"
              onClick={refreshStats}
              isDisabled={!selectedOrgId || loading}
            >
              Refresh stats
            </Button>
          </HStack>
        </Flex>

        {!hasOrgs && !orgsLoading && (
          <Alert status="info" rounded="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>No organizations yet</AlertTitle>
              <AlertDescription>
                You don&apos;t have any organizations assigned to you. Create one or ask a super admin
                to link you to an organization.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {hasOrgs && !selectedOrgId && (
          <Alert status="info" rounded="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>Pick an organization</AlertTitle>
              <AlertDescription>
                Use the organization selector in the top bar to load its learner roster.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {selectedOrgId && (
          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Flex gap={4} flexWrap="wrap" align="end">
                  <FormControl maxW={{ base: 'full', md: 'xs' }}>
                    <FormLabel>Filter</FormLabel>
                    <Select value={filter} onChange={(e) => setFilter(e.target.value as FilterMode)}>
                      <option value="all">All learners</option>
                      <option value="unassigned">Unassigned mentor</option>
                      <option value="zero_sessions">Zero sessions completed</option>
                    </Select>
                  </FormControl>

                  <FormControl maxW={{ base: 'full', md: 'sm' }}>
                    <FormLabel>Search</FormLabel>
                    <HStack>
                      <Icon as={Search} color="text.muted" />
                      <Input
                        placeholder="Name or email"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </HStack>
                  </FormControl>
                </Flex>

                <Flex gap={6} flexWrap="wrap">
                  <Stat>
                    <StatLabel>Total learners</StatLabel>
                    <StatNumber>{counts.total}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>With mentor</StatLabel>
                    <StatNumber color="green.500">{counts.withMentor}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Unassigned</StatLabel>
                    <StatNumber color="orange.500">{counts.unassigned}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Zero sessions</StatLabel>
                    <StatNumber color="red.500">{counts.zeroSession}</StatNumber>
                  </Stat>
                </Flex>
              </Stack>
            </CardBody>
          </Card>
        )}

        {mentorsError && (
          <Alert status="warning" rounded="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>Could not load mentors.</AlertTitle>
              <AlertDescription>{mentorsError}</AlertDescription>
            </Box>
          </Alert>
        )}
        {learnersError && (
          <Alert status="warning" rounded="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>Could not load learners.</AlertTitle>
              <AlertDescription>{learnersError}</AlertDescription>
            </Box>
          </Alert>
        )}
        {statsError && (
          <Alert status="warning" rounded="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>Could not load session stats.</AlertTitle>
              <AlertDescription>{statsError}</AlertDescription>
            </Box>
          </Alert>
        )}

        {selectedOrgId && (
          <Card>
            <CardBody p={0}>
              {loading && (
                <Flex align="center" gap={3} p={6}>
                  <Spinner size="sm" />
                  <Text color="text.secondary">Loading learner roster...</Text>
                </Flex>
              )}

              {!loading && rows.length === 0 && (
                <Flex direction="column" align="center" textAlign="center" p={8} gap={2}>
                  <Icon as={Users} boxSize={8} color="text.muted" />
                  <Heading size="sm">No learners found</Heading>
                  <Text color="text.secondary">
                    This organization doesn&apos;t have any learner accounts yet.
                  </Text>
                </Flex>
              )}

              {!loading && rows.length > 0 && (
                <Box overflowX="auto">
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Learner</Th>
                        <Th>Journey</Th>
                        {showMentorColumns && <Th>Mentor</Th>}
                        {showMentorColumns && <Th isNumeric>Mentor sessions</Th>}
                        {showMentorColumns && <Th isNumeric>Ambassador sessions</Th>}
                        <Th isNumeric>Total points</Th>
                        {showMentorColumns && <Th>Flags</Th>}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredRows.map((row) => (
                        <Tr key={row.learnerId}>
                          <Td>
                            <Stack spacing={0}>
                              <Text fontWeight="semibold">{getDisplayName(row.learner, 'Learner')}</Text>
                              <Text fontSize="xs" color="text.muted">
                                {row.learner.email || '—'}
                              </Text>
                            </Stack>
                          </Td>
                          <Td>
                            {row.learner.journeyType ? (
                              <Badge colorScheme="purple" variant="subtle">
                                {getJourneyLabel(row.learner.journeyType)}
                              </Badge>
                            ) : (
                              <Text fontSize="xs" color="text.muted">
                                —
                              </Text>
                            )}
                          </Td>
                          {showMentorColumns && (
                            <Td>
                              <Select
                                size="sm"
                                value={row.mentorId ?? ''}
                                placeholder={mentorsLoading ? 'Loading…' : 'Unassigned'}
                                onChange={(e) => handleAssignMentor(row, e.target.value)}
                                isDisabled={assigningLearnerId === row.learnerId || mentorsLoading}
                                minW="200px"
                              >
                                <option value="">Unassigned</option>
                                {mentors.map((mentor) => (
                                  <option key={mentor.id} value={mentor.id}>
                                    {mentor.fullName}
                                  </option>
                                ))}
                                {/* Ensure currently-assigned mentor is selectable even if not in filtered list */}
                                {row.mentorId && !mentors.find((m) => m.id === row.mentorId) && (
                                  <option value={row.mentorId}>Unknown mentor ({row.mentorId.slice(0, 6)}…)</option>
                                )}
                              </Select>
                            </Td>
                          )}
                          {showMentorColumns && (
                            <Td isNumeric>
                              <Stack spacing={0} align="flex-end">
                                <Text fontWeight="semibold">{row.stats.mentorSessionsCompleted}</Text>
                                {row.stats.mentorSessionsPending > 0 && (
                                  <Text fontSize="xs" color="text.muted">
                                    +{row.stats.mentorSessionsPending} pending
                                  </Text>
                                )}
                              </Stack>
                            </Td>
                          )}
                          {showMentorColumns && (
                            <Td isNumeric>
                              <Stack spacing={0} align="flex-end">
                                <Text fontWeight="semibold">{row.stats.ambassadorSessionsAttended}</Text>
                                {row.stats.ambassadorSessionsBooked > 0 && (
                                  <Text fontSize="xs" color="text.muted">
                                    +{row.stats.ambassadorSessionsBooked} booked
                                  </Text>
                                )}
                              </Stack>
                            </Td>
                          )}
                          <Td isNumeric>{formatPoints(row.learner.totalPoints)}</Td>
                          {showMentorColumns && (
                            <Td>
                              <HStack spacing={1} flexWrap="wrap">
                                {row.flags.noMentor && (
                                  <Tag size="sm" colorScheme="orange" variant="subtle">
                                    <Icon as={AlertTriangle} boxSize={3} mr={1} />
                                    <TagLabel>No mentor</TagLabel>
                                  </Tag>
                                )}
                                {row.flags.zeroSessions && (
                                  <Tag size="sm" colorScheme="red" variant="subtle">
                                    <Icon as={AlertTriangle} boxSize={3} mr={1} />
                                    <TagLabel>Zero sessions</TagLabel>
                                  </Tag>
                                )}
                              </HStack>
                            </Td>
                          )}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                  {filteredRows.length === 0 && (
                    <Flex direction="column" align="center" textAlign="center" p={6} gap={2}>
                      <Text color="text.secondary">No learners match the current filter.</Text>
                    </Flex>
                  )}
                </Box>
              )}
            </CardBody>
          </Card>
        )}

        {isSuperAdmin && (
          <Alert status="info" rounded="lg" variant="left-accent">
            <AlertIcon />
            <Box>
              <AlertTitle>Super admin tip</AlertTitle>
              <AlertDescription>
                Organization selector shows your partner-assigned organizations. To manage an
                organization you aren&apos;t assigned to, use the Super Admin Organization
                Management page.
              </AlertDescription>
            </Box>
          </Alert>
        )}
      </Stack>
    </PartnerLayout>
  )
}

export default LearnerAssignmentsPage
