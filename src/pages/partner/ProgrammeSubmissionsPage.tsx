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
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Icon,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import {
  Award,
  BookMarked,
  ClipboardList,
  ExternalLink,
  FileText,
  Search,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import PartnerLayout from '@/layouts/PartnerLayout'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg'
import {
  subscribeToSubmissionsByOrgIds,
  updateSubmissionReview,
  approveSubmissionAndAward,
  getComponentPoints,
  type ProgrammeComponentSubmission,
  type ProgrammeComponentType,
  type ProgrammeSubmissionStatus,
} from '@/services/programmeComponentSubmissionService'
import { getDisplayName } from '@/utils/displayName'

const PLUM = '#27062e'
const ROYAL = '#350e6f'

const TYPE_META: Record<
  ProgrammeComponentType,
  { label: string; icon: LucideIcon; color: string; bg: string }
> = {
  capstone: { label: 'Capstone', icon: Award, color: '#350e6f', bg: '#f4f0fb' },
  case_study: { label: 'Case Study', icon: BookMarked, color: '#8a6310', bg: '#fdf6e3' },
  practical: { label: 'Practical', icon: Wrench, color: '#c4400a', bg: '#fdece1' },
}

const STATUS_META: Record<
  ProgrammeSubmissionStatus,
  { label: string; colorScheme: string }
> = {
  submitted: { label: 'New', colorScheme: 'purple' },
  in_review: { label: 'In review', colorScheme: 'blue' },
  approved: { label: 'Approved', colorScheme: 'green' },
  needs_revision: { label: 'Needs revision', colorScheme: 'orange' },
}

const STATUS_OPTIONS: ProgrammeSubmissionStatus[] = [
  'submitted',
  'in_review',
  'approved',
  'needs_revision',
]

const formatAnswerKey = (key: string): string =>
  key
    .replace(/^section_\d+_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const formatDate = (date: Date | null): string => {
  if (!date) return '-'
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = diffMs / (1000 * 60 * 60)
  if (diffH < 24)
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (diffH < 24 * 7)
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const ProgrammeSubmissionsPage: React.FC = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { organizations, loading: orgsLoading } = usePartnerOrganizations()
  const drawer = useDisclosure()

  const handleNavigate = useCallback(
    (key: string) => {
      if (key === 'programme-submissions') return
      if (key === 'partner-assignment') {
        navigate('/partner/partner-assignment')
        return
      }
      if (key === 'learner-assignments') {
        navigate('/partner/learner-assignments')
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

  const orgOptions = useMemo(
    () =>
      organizations
        .filter((o) => Boolean(o.id))
        .map((o) => ({ id: o.id!, code: o.code, name: o.name })),
    [organizations],
  )

  const { selectedOrg: selectedOrgId, setSelectedOrg: setSelectedOrgId } = usePartnerSelectedOrg()

  useEffect(() => {
    if (selectedOrgId) return
    if (orgOptions.length > 0) setSelectedOrgId(orgOptions[0].id)
  }, [orgOptions, selectedOrgId, setSelectedOrgId])

  const visibleOrgIds = useMemo(() => {
    if (selectedOrgId && selectedOrgId !== 'all') return [selectedOrgId]
    return orgOptions.map((o) => o.id)
  }, [selectedOrgId, orgOptions])

  const [submissions, setSubmissions] = useState<ProgrammeComponentSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | ProgrammeComponentType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ProgrammeSubmissionStatus>('all')

  useEffect(() => {
    if (visibleOrgIds.length === 0) {
      setSubmissions([])
      setLoading(false)
      return () => undefined
    }
    setLoading(true)
    const unsubscribe = subscribeToSubmissionsByOrgIds(
      visibleOrgIds,
      (rows) => {
        setSubmissions(rows)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return () => unsubscribe()
  }, [visibleOrgIds])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return submissions.filter((row) => {
      if (typeFilter !== 'all' && row.componentType !== typeFilter) return false
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!term) return true
      const haystack = [
        row.displayName ?? '',
        row.email ?? '',
        row.componentTitle ?? '',
        row.componentId,
        row.partTitle ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [submissions, search, typeFilter, statusFilter])

  const counts = useMemo(() => {
    const next: Record<ProgrammeSubmissionStatus | 'total', number> = {
      total: submissions.length,
      submitted: 0,
      in_review: 0,
      approved: 0,
      needs_revision: 0,
    }
    submissions.forEach((s) => {
      next[s.status] = (next[s.status] ?? 0) + 1
    })
    return next
  }, [submissions])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedSubmission = useMemo(
    () => submissions.find((s) => s.id === selectedId) ?? null,
    [submissions, selectedId],
  )

  const openSubmission = (row: ProgrammeComponentSubmission) => {
    setSelectedId(row.id)
    drawer.onOpen()
  }

  const closeDrawer = () => {
    drawer.onClose()
    setSelectedId(null)
  }

  return (
    <PartnerLayout
      activeItem="programme-submissions"
      organizations={orgOptions.map((o) => ({ id: o.id, code: o.code, name: o.name }))}
      selectedOrg={selectedOrgId || 'all'}
      onSelectOrg={(v) => setSelectedOrgId(v === 'all' ? '' : v)}
      onNavigate={handleNavigate}
    >
      <Stack spacing={6}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} flexWrap="wrap">
          <Box>
            <HStack spacing={2} mb={1}>
              <Icon as={ClipboardList} color={ROYAL} boxSize={5} />
              <Heading size="lg" color={PLUM}>
                Programme submissions
              </Heading>
            </HStack>
            <Text color="gray.600" fontSize="sm">
              Capstone, case study, and practical work from learners in your organisations.
              Open one to review the answers and leave feedback.
            </Text>
          </Box>
        </Flex>

        {!orgOptions.length && !orgsLoading && (
          <Alert status="info" rounded="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>No organisations yet</AlertTitle>
              <AlertDescription>
                Ask a super admin to assign you to an organisation before you can review programme submissions.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {orgOptions.length > 0 && (
          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3}>
            <StatTile label="Total" value={counts.total} color="gray.700" />
            <StatTile label="New" value={counts.submitted} color={ROYAL} />
            <StatTile label="In review" value={counts.in_review} color="#1e3a8a" />
            <StatTile label="Approved" value={counts.approved} color="#0f6c2e" />
            <StatTile label="Needs revision" value={counts.needs_revision} color="#9a3412" />
          </SimpleGrid>
        )}

        {orgOptions.length > 0 && (
          <Box bg="white" rounded="lg" border="1px solid" borderColor="gray.200" overflow="hidden">
            <Flex
              gap={3}
              p={4}
              borderBottom="1px solid"
              borderColor="gray.200"
              flexWrap="wrap"
              align="flex-end"
            >
              <FormControl maxW={{ base: 'full', md: 'sm' }}>
                <FormLabel fontSize="xs" color="gray.500" mb={1}>
                  Search
                </FormLabel>
                <HStack
                  border="1px solid"
                  borderColor="gray.300"
                  rounded="md"
                  px={3}
                  bg="white"
                  _focusWithin={{ borderColor: ROYAL, boxShadow: `0 0 0 1px ${ROYAL}` }}
                >
                  <Icon as={Search} boxSize={4} color="gray.400" />
                  <Input
                    variant="unstyled"
                    placeholder="Learner name, email, component..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    size="sm"
                  />
                </HStack>
              </FormControl>
              <FormControl maxW={{ base: 'full', md: '180px' }}>
                <FormLabel fontSize="xs" color="gray.500" mb={1}>
                  Type
                </FormLabel>
                <Select
                  size="sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                >
                  <option value="all">All types</option>
                  <option value="capstone">Capstone</option>
                  <option value="case_study">Case Study</option>
                  <option value="practical">Practical</option>
                </Select>
              </FormControl>
              <FormControl maxW={{ base: 'full', md: '180px' }}>
                <FormLabel fontSize="xs" color="gray.500" mb={1}>
                  Status
                </FormLabel>
                <Select
                  size="sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="submitted">New</option>
                  <option value="in_review">In review</option>
                  <option value="approved">Approved</option>
                  <option value="needs_revision">Needs revision</option>
                </Select>
              </FormControl>
            </Flex>

            {loading ? (
              <HStack p={6} spacing={3} color="gray.500">
                <Spinner size="sm" />
                <Text>Loading submissions...</Text>
              </HStack>
            ) : filtered.length === 0 ? (
              <Box p={10} textAlign="center">
                <Icon as={FileText} boxSize={8} color="gray.300" mb={2} />
                <Text fontSize="sm" color="gray.500">
                  {submissions.length === 0
                    ? 'No submissions yet. Learners will appear here as they submit work.'
                    : 'No submissions match your filters.'}
                </Text>
              </Box>
            ) : (
              <Box overflowX="auto">
                <Table size="sm" variant="simple">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th>Learner</Th>
                      <Th>Component</Th>
                      <Th>Type</Th>
                      <Th>Submitted</Th>
                      <Th>Status</Th>
                      <Th width="100px">Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filtered.map((row) => {
                      const typeMeta = row.componentType ? TYPE_META[row.componentType] : null
                      const statusMeta = STATUS_META[row.status]
                      return (
                        <Tr
                          key={row.id}
                          _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                          onClick={() => openSubmission(row)}
                        >
                          <Td>
                            <Stack spacing={0}>
                              <Text fontWeight="medium" color="gray.900">
                                {row.displayName || 'Unnamed learner'}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {row.email ?? '-'}
                              </Text>
                            </Stack>
                          </Td>
                          <Td>
                            <Stack spacing={0}>
                              <Text fontSize="sm" color="gray.800" noOfLines={1}>
                                {row.componentTitle || row.componentId}
                              </Text>
                              {row.partTitle && (
                                <Text fontSize="xs" color="gray.500" noOfLines={1}>
                                  {row.partTitle}
                                </Text>
                              )}
                            </Stack>
                          </Td>
                          <Td>
                            {typeMeta ? (
                              <HStack spacing={1.5}>
                                <Box
                                  p={1}
                                  bg={typeMeta.bg}
                                  color={typeMeta.color}
                                  rounded="md"
                                  display="inline-flex"
                                >
                                  <Icon as={typeMeta.icon} boxSize={3} />
                                </Box>
                                <Text fontSize="xs" fontWeight="medium" color="gray.700">
                                  {typeMeta.label}
                                </Text>
                              </HStack>
                            ) : (
                              <Text fontSize="xs" color="gray.400">
                                -
                              </Text>
                            )}
                          </Td>
                          <Td>
                            <Text fontSize="xs" color="gray.600">
                              {formatDate(row.lastUpdatedAt ?? row.submittedAt)}
                            </Text>
                          </Td>
                          <Td>
                            <Badge
                              colorScheme={statusMeta.colorScheme}
                              variant="subtle"
                              fontSize="2xs"
                              textTransform="none"
                              rounded="md"
                              px={2}
                            >
                              {statusMeta.label}
                            </Badge>
                          </Td>
                          <Td>
                            <Button
                              size="xs"
                              variant="outline"
                              borderColor="gray.300"
                              color={ROYAL}
                              _hover={{ bg: 'gray.50', borderColor: ROYAL }}
                              onClick={(e) => {
                                e.stopPropagation()
                                openSubmission(row)
                              }}
                            >
                              Review
                            </Button>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </Box>
            )}
          </Box>
        )}
      </Stack>

      <SubmissionReviewDrawer
        isOpen={drawer.isOpen}
        onClose={closeDrawer}
        submission={selectedSubmission}
        reviewerId={profile?.id ?? null}
        reviewerName={getDisplayName(profile, 'Partner')}
        onSaved={(toastInput) => toast(toastInput)}
      />
    </PartnerLayout>
  )
}

interface StatTileProps {
  label: string
  value: number
  color: string
}

const StatTile: React.FC<StatTileProps> = ({ label, value, color }) => (
  <Box
    bg="white"
    rounded="lg"
    border="1px solid"
    borderColor="gray.200"
    p={4}
    boxShadow="0 1px 2px rgba(0,0,0,0.03)"
  >
    <Text fontSize="2xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="0.04em">
      {label}
    </Text>
    <Text fontSize="2xl" fontWeight="bold" color={color}>
      {value}
    </Text>
  </Box>
)

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  submission: ProgrammeComponentSubmission | null
  reviewerId: string | null
  reviewerName: string
  onSaved: (toast: Parameters<ReturnType<typeof useToast>>[0]) => void
}

const SubmissionReviewDrawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  submission,
  reviewerId,
  reviewerName,
  onSaved,
}) => {
  const [status, setStatus] = useState<ProgrammeSubmissionStatus>('in_review')
  const [notes, setNotes] = useState('')
  const [score, setScore] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!submission) return
    setStatus(submission.status === 'submitted' ? 'in_review' : submission.status)
    setNotes(submission.partnerNotes ?? '')
    setScore(submission.score !== null ? String(submission.score) : '')
  }, [submission])

  if (!submission) return null

  const typeMeta = submission.componentType ? TYPE_META[submission.componentType] : null

  const handleSave = async () => {
    if (!reviewerId) {
      onSaved({ status: 'error', title: 'You need to be signed in to save.' })
      return
    }
    setSaving(true)
    try {
      const scoreNum = score.trim() === '' ? null : Number(score)
      const cleanScore = Number.isFinite(scoreNum as number) ? (scoreNum as number) : null
      const cleanNotes = notes.trim() === '' ? null : notes.trim()

      if (status === 'approved') {
        // Approving awards the component's points to the learner (idempotent).
        const result = await approveSubmissionAndAward({
          submission,
          reviewerId,
          reviewerName,
          partnerNotes: cleanNotes,
          score: cleanScore,
        })
        onSaved({
          status: 'success',
          title: !result.pointsEligible
            ? 'Approved'
            : result.alreadyAwarded
              ? 'Already awarded'
              : `Approved · +${result.points.toLocaleString()} pts`,
          description: !result.pointsEligible
            ? 'Your review and feedback were saved. This component is reviewed but does not award points.'
            : result.alreadyAwarded
              ? 'This submission was already credited, so no new points were added. Your feedback was saved.'
              : `${result.points.toLocaleString()} points were awarded to the learner and they have been notified.`,
        })
      } else {
        await updateSubmissionReview(submission.id, {
          status,
          partnerNotes: cleanNotes,
          score: cleanScore,
          reviewerId,
          reviewerName,
        })
        onSaved({
          status: 'success',
          title: 'Review saved',
          description: 'The learner will see your decision and feedback.',
        })
      }
      onClose()
    } catch (err) {
      console.error('[ProgrammeSubmissions] save failed', err)
      onSaved({
        status: 'error',
        title: 'Could not save your review',
        description: 'Please try again in a moment.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="lg">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader borderBottom="1px solid" borderColor="gray.200">
          <Stack spacing={1}>
            <HStack spacing={2}>
              {typeMeta && (
                <Box p={1.5} bg={typeMeta.bg} color={typeMeta.color} rounded="md">
                  <Icon as={typeMeta.icon} boxSize={4} />
                </Box>
              )}
              <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="0.04em">
                {typeMeta?.label ?? 'Submission'}
              </Text>
            </HStack>
            <Text fontSize="lg" fontWeight="bold" color={PLUM} lineHeight="1.25">
              {submission.componentTitle || submission.componentId}
            </Text>
            {submission.partTitle && (
              <Text fontSize="sm" color="gray.600">
                {submission.partTitle}
              </Text>
            )}
            <HStack spacing={3} fontSize="xs" color="gray.500" mt={1}>
              <Text>
                <Text as="span" fontWeight="semibold" color="gray.700">
                  {submission.displayName || 'Unnamed learner'}
                </Text>
                {submission.email ? ` (${submission.email})` : ''}
              </Text>
              <Text>·</Text>
              <Text>Submitted {formatDate(submission.submittedAt)}</Text>
              {submission.resubmittedAt && (
                <>
                  <Text>·</Text>
                  <Text color="#9a3412">Resubmitted {formatDate(submission.resubmittedAt)}</Text>
                </>
              )}
            </HStack>
          </Stack>
        </DrawerHeader>

        <DrawerBody>
          <Stack spacing={6}>
            {submission.sourcePage && (
              <Button
                as="a"
                href={submission.sourcePage}
                target="_blank"
                rel="noopener noreferrer"
                size="xs"
                variant="outline"
                rightIcon={<Icon as={ExternalLink} boxSize={3} />}
                alignSelf="flex-start"
              >
                Open the original form
              </Button>
            )}

            <Stack spacing={2}>
              <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="0.04em">
                Learner answers ({submission.answerCount})
              </Text>
              {Object.entries(submission.answers).length === 0 ? (
                <Text fontSize="sm" color="gray.500">
                  No answers captured.
                </Text>
              ) : (
                <Stack spacing={3}>
                  {Object.entries(submission.answers).map(([key, value]) => (
                    <Box
                      key={key}
                      p={3}
                      bg="gray.50"
                      border="1px solid"
                      borderColor="gray.200"
                      rounded="md"
                    >
                      <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>
                        {formatAnswerKey(key)}
                      </Text>
                      <Text fontSize="sm" color="gray.800" whiteSpace="pre-wrap" lineHeight="1.55">
                        {value || <Text as="span" color="gray.400">(empty)</Text>}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>

            <Box
              p={4}
              bg="#f9f5fb"
              border="1px solid"
              borderColor="#e6dbef"
              rounded="lg"
            >
              <Stack spacing={4}>
                <Text fontSize="sm" fontWeight="bold" color={PLUM}>
                  Your review
                </Text>
                {submission.componentType && (
                  <HStack
                    spacing={2}
                    align="flex-start"
                    p={2.5}
                    bg="white"
                    border="1px solid"
                    borderColor="#e6dbef"
                    rounded="md"
                  >
                    <Icon as={Award} boxSize={4} color={ROYAL} mt="1px" />
                    {getComponentPoints(submission.componentType) > 0 ? (
                      <Text fontSize="xs" color="gray.700">
                        Setting status to{' '}
                        <Text as="span" fontWeight="semibold">
                          Approved
                        </Text>{' '}
                        awards{' '}
                        <Text as="span" fontWeight="bold" color={PLUM}>
                          {getComponentPoints(submission.componentType).toLocaleString()} pts
                        </Text>{' '}
                        to the learner. Re-approving won't award twice.
                      </Text>
                    ) : (
                      <Text fontSize="xs" color="gray.700">
                        This component is reviewed but{' '}
                        <Text as="span" fontWeight="semibold">
                          does not award points
                        </Text>
                        . Your status and feedback are saved for the learner.
                      </Text>
                    )}
                  </HStack>
                )}
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.600" mb={1}>
                    Status
                  </FormLabel>
                  <Select
                    size="sm"
                    bg="white"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProgrammeSubmissionStatus)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.600" mb={1}>
                    Score (optional, 0-100)
                  </FormLabel>
                  <NumberInput
                    size="sm"
                    min={0}
                    max={100}
                    value={score}
                    onChange={(v) => setScore(v)}
                    bg="white"
                  >
                    <NumberInputField placeholder="-" />
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.600" mb={1}>
                    Feedback for the learner
                  </FormLabel>
                  <Textarea
                    size="sm"
                    bg="white"
                    minH="120px"
                    placeholder="What was strong, what to refine, and the one thing to change before resubmitting..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </FormControl>
                {submission.reviewedAt && submission.reviewerName && (
                  <Text fontSize="xs" color="gray.500">
                    Last reviewed by {submission.reviewerName} on {formatDate(submission.reviewedAt)}
                  </Text>
                )}
              </Stack>
            </Box>
          </Stack>
        </DrawerBody>

        <DrawerFooter borderTop="1px solid" borderColor="gray.200">
          <Button variant="outline" mr={3} onClick={onClose} isDisabled={saving}>
            Close
          </Button>
          <Button
            bg={ROYAL}
            color="white"
            _hover={{ bg: PLUM }}
            isLoading={saving}
            onClick={handleSave}
          >
            Save review
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export default ProgrammeSubmissionsPage
export { ProgrammeSubmissionsPage }
