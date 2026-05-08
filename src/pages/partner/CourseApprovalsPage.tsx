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
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { BookOpen, CheckCircle2, RefreshCcw, Search } from 'lucide-react'
import PartnerLayout from '@/layouts/PartnerLayout'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg'
import { useLearnerOverview } from '@/hooks/useLearnerOverview'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import {
  COURSE_LIFT_ACTIVITY_ID,
  CourseCompletionRecord,
  listenToCourseCompletionsForLearners,
  markCourseCompleted,
} from '@/services/courseCompletionService'
import { getCourseDocuments } from '@/services/courseService'
import {
  getCourseDetailsFromMapping,
  resolveCourseTitleFromMapping,
} from '@/utils/courseMappings'
import { getActivityDefinitionById, type JourneyType } from '@/config/pointsConfig'
import { getDisplayName } from '@/utils/displayName'

interface CourseRow {
  id: string
  title: string
  slug?: string | null
  description?: string
  externalUrl?: string
}

const buildCourseRows = (
  courseIds: string[],
  liveCourseDocs: Map<string, { title?: string; description?: string; externalUrl?: string; content_url?: string }>,
): CourseRow[] => {
  const seen = new Set<string>()
  const rows: CourseRow[] = []
  courseIds.forEach(courseId => {
    if (!courseId || seen.has(courseId)) return
    seen.add(courseId)
    const liveDoc = liveCourseDocs.get(courseId)
    const fallbackTitle = resolveCourseTitleFromMapping(courseId) || courseId
    const title = liveDoc?.title || fallbackTitle
    const fallback = getCourseDetailsFromMapping(title)
    rows.push({
      id: courseId,
      title,
      slug: fallback?.slug ?? null,
      description: liveDoc?.description ?? fallback?.description,
      externalUrl: liveDoc?.externalUrl || liveDoc?.content_url || fallback?.link,
    })
  })
  return rows
}

const CourseApprovalsPage: React.FC = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { organizations, loading: orgsLoading } = usePartnerOrganizations()

  const handleNavigate = useCallback(
    (key: string) => {
      if (key === 'course-approvals') return
      if (key === 'partner-assignment') {
        navigate('/partner/partner-assignment')
        return
      }
      if (key === 'learner-assignments') {
        navigate('/partner/learner-assignments')
        return
      }
      // State-based dashboard pages (overview, users, at-risk, etc.) — pass via
      // ?page= so the dashboard opens directly on the requested page.
      if (key === 'overview') {
        navigate('/partner/dashboard')
        return
      }
      navigate(`/partner/dashboard?page=${encodeURIComponent(key)}`)
    },
    [navigate],
  )

  const orgOptions = useMemo(
    () =>
      organizations
        .filter(o => Boolean(o.id))
        .map(o => ({ id: o.id!, code: o.code, name: o.name })),
    [organizations],
  )

  const { selectedOrg: selectedOrgId, setSelectedOrg: setSelectedOrgId } =
    usePartnerSelectedOrg()
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [completions, setCompletions] = useState<CourseCompletionRecord[]>([])
  const [completionsLoading, setCompletionsLoading] = useState(false)
  const [liveCourseDocs, setLiveCourseDocs] = useState<
    Map<string, { title?: string; description?: string; externalUrl?: string; content_url?: string }>
  >(new Map())

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
    () => orgOptions.find(o => o.id === selectedOrgId),
    [orgOptions, selectedOrgId],
  )

  const { rows: learnerRows, loading: learnersLoading, learnersError } =
    useLearnerOverview(selectedOrgId || null)

  const { program, loading: programLoading } = useOrganizationProgramCourses(selectedOrgId || null)

  // When the program loads, fetch the latest course documents to enrich titles/descriptions.
  useEffect(() => {
    let cancelled = false
    const courseIds = program?.orderedCourseIds ?? []
    if (!courseIds.length) {
      setLiveCourseDocs(new Map())
      return
    }
    getCourseDocuments(courseIds)
      .then(snapshots => {
        if (cancelled) return
        const next = new Map<
          string,
          { title?: string; description?: string; externalUrl?: string; content_url?: string }
        >()
        snapshots.forEach((snap, index) => {
          const requestedCourseId = courseIds[index]
          if (snap.exists()) {
            const data = snap.data() as Record<string, unknown>
            next.set(requestedCourseId, {
              title: typeof data.title === 'string' ? (data.title as string) : undefined,
              description: typeof data.description === 'string' ? (data.description as string) : undefined,
              externalUrl: typeof data.externalUrl === 'string' ? (data.externalUrl as string) : undefined,
              content_url: typeof data.content_url === 'string' ? (data.content_url as string) : undefined,
            })
          }
        })
        setLiveCourseDocs(next)
      })
      .catch(error => {
        console.error('[CourseApprovals] Failed to load course documents', error)
        if (!cancelled) setLiveCourseDocs(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [program])

  const courseRows = useMemo(() => {
    const ids = program?.orderedCourseIds ?? []
    return buildCourseRows(ids, liveCourseDocs)
  }, [program, liveCourseDocs])

  const filteredLearners = useMemo(() => {
    const term = search.trim().toLowerCase()
    const sortable = [...learnerRows].sort((a, b) => {
      const an = getDisplayName(a.learner, '') || a.learner.email || ''
      const bn = getDisplayName(b.learner, '') || b.learner.email || ''
      return an.localeCompare(bn)
    })
    if (!term) return sortable
    return sortable.filter(row => {
      const name = getDisplayName(row.learner, '').toLowerCase()
      const email = (row.learner.email ?? '').toLowerCase()
      return name.includes(term) || email.includes(term)
    })
  }, [learnerRows, search])

  // Subscribe to course completions for the visible learners
  useEffect(() => {
    if (!filteredLearners.length) {
      setCompletions([])
      setCompletionsLoading(false)
      return () => undefined
    }
    setCompletionsLoading(true)
    const learnerIds = filteredLearners.map(row => row.learnerId)
    const unsub = listenToCourseCompletionsForLearners(
      learnerIds,
      records => {
        setCompletions(records)
        setCompletionsLoading(false)
      },
      () => {
        setCompletions([])
        setCompletionsLoading(false)
      },
    )
    return () => unsub()
  }, [filteredLearners])

  const completionLookup = useMemo(() => {
    const map = new Map<string, CourseCompletionRecord>()
    completions.forEach(record => {
      if (record.status !== 'approved') return
      map.set(`${record.userId}__${record.courseId}`, record)
    })
    return map
  }, [completions])

  useEffect(() => {
    if (!selectedLearnerId) return
    if (!filteredLearners.some(row => row.learnerId === selectedLearnerId)) {
      setSelectedLearnerId('')
    }
  }, [filteredLearners, selectedLearnerId])

  const selectedLearner = useMemo(
    () => filteredLearners.find(row => row.learnerId === selectedLearnerId)?.learner ?? null,
    [filteredLearners, selectedLearnerId],
  )

  const liftActivityForLearner = useMemo(() => {
    const journey = (selectedLearner?.journeyType as JourneyType | undefined) ?? '6W'
    return getActivityDefinitionById({
      journeyType: journey,
      activityId: COURSE_LIFT_ACTIVITY_ID,
    })
  }, [selectedLearner])

  const liftActivityPoints = liftActivityForLearner?.points ?? 3000
  const journeyCap = liftActivityForLearner?.activityPolicy?.maxTotal ?? null

  const learnerApprovedCount = useMemo(() => {
    if (!selectedLearner) return 0
    return completions.filter(
      record => record.userId === selectedLearner.id && record.status === 'approved',
    ).length
  }, [completions, selectedLearner])

  const journeyCapReached =
    journeyCap !== null && journeyCap > 0 && learnerApprovedCount >= journeyCap

  const handleApprove = async (course: CourseRow) => {
    if (!profile?.id || !selectedLearner) return
    const lookupKey = `${selectedLearner.id}__${course.id}`
    if (completionLookup.has(lookupKey)) {
      toast({
        title: 'Already approved',
        description: 'This course is already marked as completed for this learner.',
        status: 'info',
      })
      return
    }
    setSavingKey(lookupKey)
    try {
      const result = await markCourseCompleted({
        partnerId: profile.id,
        partnerName: getDisplayName(profile, undefined),
        learnerId: selectedLearner.id,
        learnerJourneyType: (selectedLearner.journeyType as JourneyType | undefined) ?? null,
        weekNumber: typeof selectedLearner.currentWeek === 'number' ? selectedLearner.currentWeek : undefined,
        course: { id: course.id, title: course.title, slug: course.slug ?? null },
        organizationId: selectedOrgId || null,
      })
      if (result.alreadyCompleted) {
        toast({
          title: 'Already approved',
          description: 'This course was already approved for this learner.',
          status: 'info',
        })
      } else {
        toast({
          title: 'Course completion approved',
          description: `${result.pointsAwarded.toLocaleString()} points awarded to ${getDisplayName(selectedLearner, 'learner')}.`,
          status: 'success',
        })
      }
    } catch (error) {
      console.error('[CourseApprovals] Approve failed', error)
      toast({
        title: 'Could not approve',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        status: 'error',
      })
    } finally {
      setSavingKey(null)
    }
  }

  const layoutOrgs = useMemo(
    () => orgOptions.map(o => ({ id: o.id, code: o.code, name: o.name })),
    [orgOptions],
  )

  return (
    <PartnerLayout
      activeItem="course-approvals"
      organizations={layoutOrgs}
      onNavigate={handleNavigate}
    >
      <Stack spacing={6}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} flexWrap="wrap">
          <Box>
            <Heading size="lg">Course completion approvals</Heading>
            <Text color="text.secondary">
              Course points are awarded only when you confirm the learner completed the course
              outside the app. Pick a learner, then mark each course they have finished.
            </Text>
          </Box>
          <HStack spacing={3}>
            <Button
              leftIcon={<RefreshCcw size={16} />}
              variant="outline"
              isDisabled
              title="Live data refreshes automatically"
            >
              Live
            </Button>
          </HStack>
        </Flex>

        {!orgOptions.length && !orgsLoading && (
          <Alert status="info" rounded="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>No organizations yet</AlertTitle>
              <AlertDescription>
                Ask a super admin to assign you to an organization before approving courses.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {selectedOrgId && (
          <Card>
            <CardBody>
              <Stack spacing={4}>
                <Flex gap={4} flexWrap="wrap" align="end">
                  <FormControl maxW={{ base: 'full', md: 'sm' }}>
                    <FormLabel>Search learner</FormLabel>
                    <HStack>
                      <Icon as={Search} color="gray.400" />
                      <Input
                        placeholder="Name or email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </HStack>
                  </FormControl>
                  <FormControl maxW={{ base: 'full', md: 'sm' }}>
                    <FormLabel>Learner</FormLabel>
                    <Select
                      placeholder={
                        learnersLoading
                          ? 'Loading learners...'
                          : filteredLearners.length === 0
                            ? 'No learners match'
                            : 'Choose a learner'
                      }
                      value={selectedLearnerId}
                      onChange={e => setSelectedLearnerId(e.target.value)}
                      isDisabled={!filteredLearners.length}
                    >
                      {filteredLearners.map(row => (
                        <option key={row.learnerId} value={row.learnerId}>
                          {getDisplayName(row.learner, 'Learner')} · {row.learner.email}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </Flex>

                {learnersError && (
                  <Alert status="warning" rounded="md">
                    <AlertIcon />
                    <Text fontSize="sm">{learnersError}</Text>
                  </Alert>
                )}

                {programLoading && (
                  <HStack color="gray.500">
                    <Spinner size="sm" />
                    <Text>Loading program courses...</Text>
                  </HStack>
                )}

                {!programLoading && courseRows.length === 0 && (
                  <Alert status="info" rounded="md">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>No courses configured</AlertTitle>
                      <AlertDescription>
                        {selectedOrg?.name || 'This organization'} has no courses assigned to its
                        program yet. Add courses in the organization configuration before approving
                        completions.
                      </AlertDescription>
                    </Box>
                  </Alert>
                )}

                {selectedLearnerId && courseRows.length > 0 && (
                  <Box overflowX="auto">
                    {journeyCap !== null && (
                      <HStack
                        mb={3}
                        p={3}
                        borderRadius="md"
                        border="1px solid"
                        borderColor={journeyCapReached ? 'orange.200' : 'purple.100'}
                        bg={journeyCapReached ? 'orange.50' : 'purple.50'}
                        justify="space-between"
                        flexWrap="wrap"
                        gap={2}
                      >
                        <Stack spacing={0}>
                          <Text fontWeight="semibold" fontSize="sm" color="gray.800">
                            {selectedLearner?.journeyType ?? '6W'} journey cap:{' '}
                            {learnerApprovedCount} of {journeyCap} course
                            {journeyCap === 1 ? '' : 's'} approved
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            Each LIFT module approval awards{' '}
                            {liftActivityPoints.toLocaleString()} pts on this journey. Total cap:{' '}
                            {(liftActivityPoints * journeyCap).toLocaleString()} pts.
                          </Text>
                        </Stack>
                        <Badge
                          colorScheme={journeyCapReached ? 'orange' : 'purple'}
                          variant="subtle"
                        >
                          {journeyCapReached ? 'Cap reached' : `${Math.max(0, journeyCap - learnerApprovedCount)} remaining`}
                        </Badge>
                      </HStack>
                    )}
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Course</Th>
                          <Th>Status</Th>
                          <Th width="240px">Action</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {courseRows.map(course => {
                          const lookupKey = `${selectedLearnerId}__${course.id}`
                          const completion = completionLookup.get(lookupKey)
                          const isApproved = Boolean(completion)
                          const isSaving = savingKey === lookupKey
                          const blockedByCap = !isApproved && journeyCapReached
                          return (
                            <Tr key={course.id} bg={isApproved ? 'green.50' : undefined}>
                              <Td>
                                <Stack spacing={0}>
                                  <HStack spacing={2}>
                                    <Icon as={BookOpen} boxSize={4} color="purple.500" />
                                    <Text fontWeight="semibold">{course.title}</Text>
                                  </HStack>
                                  {course.description && (
                                    <Text fontSize="xs" color="gray.500" noOfLines={2}>
                                      {course.description}
                                    </Text>
                                  )}
                                </Stack>
                              </Td>
                              <Td>
                                {isApproved ? (
                                  <HStack spacing={2}>
                                    <Icon as={CheckCircle2} color="green.500" />
                                    <Stack spacing={0}>
                                      <Badge colorScheme="green">Completed</Badge>
                                      <Text fontSize="xs" color="gray.600">
                                        {completion?.points
                                          ? `+${completion.points.toLocaleString()} pts`
                                          : ''}
                                        {completion?.approvedAt
                                          ? ` · ${completion.approvedAt.toLocaleDateString()}`
                                          : ''}
                                      </Text>
                                    </Stack>
                                  </HStack>
                                ) : blockedByCap ? (
                                  <Badge colorScheme="orange">Cap reached</Badge>
                                ) : (
                                  <Badge colorScheme="gray">Awaiting verification</Badge>
                                )}
                              </Td>
                              <Td>
                                <Button
                                  size="sm"
                                  colorScheme={isApproved ? 'gray' : 'purple'}
                                  variant={isApproved ? 'ghost' : 'solid'}
                                  isDisabled={isApproved || isSaving || blockedByCap}
                                  isLoading={isSaving}
                                  loadingText="Approving"
                                  onClick={() => handleApprove(course)}
                                  title={
                                    blockedByCap
                                      ? `${selectedLearner?.journeyType ?? ''} journey allows only ${journeyCap} LIFT module approvals.`
                                      : undefined
                                  }
                                >
                                  {isApproved
                                    ? 'Approved'
                                    : blockedByCap
                                      ? 'Journey cap reached'
                                      : `Mark completed (+${liftActivityPoints.toLocaleString()} pts)`}
                                </Button>
                              </Td>
                            </Tr>
                          )
                        })}
                      </Tbody>
                    </Table>

                    {completionsLoading && (
                      <HStack mt={3} color="gray.500" fontSize="sm">
                        <Spinner size="xs" />
                        <Text>Refreshing approvals...</Text>
                      </HStack>
                    )}
                  </Box>
                )}

                {!selectedLearnerId && courseRows.length > 0 && (
                  <Alert status="info" rounded="md">
                    <AlertIcon />
                    <Text fontSize="sm">
                      Pick a learner above to view and approve their course completions.
                    </Text>
                  </Alert>
                )}
              </Stack>
            </CardBody>
          </Card>
        )}
      </Stack>
    </PartnerLayout>
  )
}

export default CourseApprovalsPage
export { CourseApprovalsPage }
