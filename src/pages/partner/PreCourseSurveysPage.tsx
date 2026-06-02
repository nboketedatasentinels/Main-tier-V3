import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Icon,
  Input,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { FileText, Search } from 'lucide-react'
import PartnerLayout from '@/layouts/PartnerLayout'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg'
import {
  subscribeToPreCourseSurveysByOrgIds,
  type PreCourseSurveyResponse,
} from '@/services/preCourseSurveyService'

const PLUM = '#27062e'
const ROYAL = '#350e6f'

const formatDate = (date: Date | null): string => {
  if (!date) return '-'
  const now = new Date()
  const diffH = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  if (diffH < 24) return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (diffH < 24 * 7)
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const learnerName = (row: PreCourseSurveyResponse): string => {
  const fromAnswers = [row.firstName, row.lastName].filter(Boolean).join(' ').trim()
  return row.displayName?.trim() || fromAnswers || 'Unnamed learner'
}

const PreCourseSurveysPage: React.FC = () => {
  const navigate = useNavigate()
  const { organizations, loading: orgsLoading } = usePartnerOrganizations()

  const handleNavigate = useCallback(
    (key: string) => {
      if (key === 'pre-course-surveys') return
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
      if (key === 'programme-submissions') {
        navigate('/partner/programme-submissions')
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

  const [responses, setResponses] = useState<PreCourseSurveyResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (visibleOrgIds.length === 0) {
      setResponses([])
      setLoading(false)
      return () => undefined
    }
    setLoading(true)
    const unsubscribe = subscribeToPreCourseSurveysByOrgIds(
      visibleOrgIds,
      (rows) => {
        setResponses(rows)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return () => unsubscribe()
  }, [visibleOrgIds])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return responses
    return responses.filter((row) =>
      [learnerName(row), row.email, row.organization].join(' ').toLowerCase().includes(term),
    )
  }, [responses, search])

  return (
    <PartnerLayout
      activeItem="pre-course-surveys"
      organizations={orgOptions.map((o) => ({ id: o.id, code: o.code, name: o.name }))}
      selectedOrg={selectedOrgId || 'all'}
      onSelectOrg={(v) => setSelectedOrgId(v === 'all' ? '' : v)}
      onNavigate={handleNavigate}
    >
      <Stack spacing={6}>
        <Box>
          <HStack spacing={2} mb={1}>
            <Icon as={FileText} color={ROYAL} boxSize={5} />
            <Heading size="lg" color={PLUM}>
              Pre-course surveys
            </Heading>
          </HStack>
          <Text color="text.muted" fontSize="sm">
            Pre-course assessments submitted by learners in your organisations. Each learner
            completes this once before starting their courses.
          </Text>
        </Box>

        {!orgOptions.length && !orgsLoading && (
          <Alert status="info" rounded="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>No organisations yet</AlertTitle>
              <AlertDescription>
                Ask a super admin to assign you to an organisation before you can see pre-course
                surveys.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {orgOptions.length > 0 && (
          <Box bg="white" rounded="lg" border="1px solid" borderColor="brand.border" overflow="hidden">
            <Flex gap={3} p={4} borderBottom="1px solid" borderColor="brand.border" align="flex-end">
              <FormControl maxW={{ base: 'full', md: 'sm' }}>
                <FormLabel fontSize="xs" color="text.muted" mb={1}>
                  Search
                </FormLabel>
                <HStack
                  border="1px solid"
                  borderColor="brand.border"
                  rounded="md"
                  px={3}
                  bg="white"
                  _focusWithin={{ borderColor: ROYAL, boxShadow: `0 0 0 1px ${ROYAL}` }}
                >
                  <Icon as={Search} boxSize={4} color="text.muted" />
                  <Input
                    variant="unstyled"
                    placeholder="Learner name, email, organisation..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    size="sm"
                  />
                </HStack>
              </FormControl>
              <Text fontSize="sm" color="text.muted" pb={2} ml="auto">
                {responses.length} {responses.length === 1 ? 'submission' : 'submissions'}
              </Text>
            </Flex>

            {loading ? (
              <HStack p={6} spacing={3} color="text.muted">
                <Spinner size="sm" />
                <Text>Loading submissions...</Text>
              </HStack>
            ) : filtered.length === 0 ? (
              <Box p={10} textAlign="center">
                <Icon as={FileText} boxSize={8} color="text.muted" mb={2} />
                <Text fontSize="sm" color="text.muted">
                  {responses.length === 0
                    ? 'No submissions yet. Learners will appear here as they complete the pre-course survey.'
                    : 'No submissions match your search.'}
                </Text>
              </Box>
            ) : (
              <Box overflowX="auto">
                <Table size="sm" variant="simple">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th>Learner</Th>
                      <Th>Organisation</Th>
                      <Th>Submitted</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filtered.map((row) => (
                      <Tr key={row.uid}>
                        <Td>
                          <Stack spacing={0}>
                            <Text fontWeight="medium" color="gray.900">
                              {learnerName(row)}
                            </Text>
                            <Text fontSize="xs" color="text.muted">
                              {row.email || '-'}
                            </Text>
                          </Stack>
                        </Td>
                        <Td>
                          <Text fontSize="sm" color="gray.800">
                            {row.organization || '-'}
                          </Text>
                        </Td>
                        <Td>
                          <Text fontSize="sm" color="gray.800">
                            {formatDate(row.submittedAt)}
                          </Text>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </Box>
        )}
      </Stack>
    </PartnerLayout>
  )
}

export default PreCourseSurveysPage
