import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Input,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { ArrowLeft, BarChart3, ClipboardList, Mail, Users } from 'lucide-react'
import PartnerLayout from '@/layouts/PartnerLayout'
import { useAuth } from '@/hooks/useAuth'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg'
import { useLearnerOverview } from '@/hooks/useLearnerOverview'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import { RateLearnerCourseAssessment } from '@/components/assessments/RateLearnerCourseAssessment'
import { PreCourseSurveyButton } from '@/components/assessments/PreCourseSurveyButton'
import { CourseAssessmentReportCardView } from '@/components/assessments/CourseAssessmentReportCardView'
import {
  buildAssessmentReportWorkspace,
  emailOrgAssessmentReport,
  listReportSendLog,
  REPORT_AUDIENCE_OPTIONS,
  type CourseAssessmentReportSendRow,
  type LearnerAssessmentReportCard,
  type ReportAudienceRole,
} from '@/services/courseAssessmentReportService'
import type { IntegrityFlag } from '@/services/courseAssessmentReportMath'
import { getCatalogueCourseById } from '@/config/courseCatalogue'
import { getDisplayName } from '@/utils/displayName'
import { handlePartnerSidebarNavigate } from '@/utils/partnerSidebarNavigation'
import type { CourseAssessmentKind } from '@/config/nativeCourseAssessments'
import {
  courseSurveySectionTitle,
  resolveCourseSurveyKind,
} from '@/utils/courseSurveyWindow'

type PageMode = 'workspace' | 'rate_one'

const phaseLabel = (phase: string) => {
  if (phase === 'completed') return 'Journey complete'
  if (phase === 'near_end') return 'Near journey end'
  return 'In progress'
}

const CourseSurveysPage: React.FC = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useAuth()
  const { organizations } = usePartnerOrganizations()
  const { selectedOrg: selectedOrgId, setSelectedOrg: setSelectedOrgId } = usePartnerSelectedOrg()
  const { rows: learnerRows, loading: learnersLoading } = useLearnerOverview(selectedOrgId || null)

  const [mode, setMode] = useState<PageMode>('workspace')
  const [rateLearnerId, setRateLearnerId] = useState<string | null>(null)
  const [rateForcedKind, setRateForcedKind] = useState<CourseAssessmentKind | null>(null)
  const [cards, setCards] = useState<LearnerAssessmentReportCard[]>([])
  const [partnerHtml, setPartnerHtml] = useState('')
  const [offlineFlags, setOfflineFlags] = useState<IntegrityFlag[]>([])
  const [orgPhase, setOrgPhase] = useState<'early' | 'near_end' | 'completed'>('early')
  const [cardsLoading, setCardsLoading] = useState(false)
  const [sendLog, setSendLog] = useState<CourseAssessmentReportSendRow[]>([])
  const [sending, setSending] = useState(false)

  const { program: orgProgram } = useOrganizationProgramCourses(selectedOrgId || null)
  const orgCourseTitles = useMemo(() => {
    const ids = orgProgram?.orderedCourseIds ?? []
    const titles: string[] = []
    const seen = new Set<string>()
    for (const id of ids) {
      const title = getCatalogueCourseById(id)?.title?.trim()
      if (!title) continue
      const key = title.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      titles.push(title)
    }
    return titles
  }, [orgProgram])

  const [recipientRoles, setRecipientRoles] = useState<ReportAudienceRole[]>([
    'sponsor',
    'hr',
    'senior_mgmt',
  ])
  const [emailsByRole, setEmailsByRole] = useState<Record<ReportAudienceRole, string>>({
    sponsor: '',
    hr: '',
    senior_mgmt: '',
    line_manager: '',
    other: '',
  })

  const handleNavigate = useCallback(
    (key: string) => handlePartnerSidebarNavigate(navigate, key, 'course-surveys'),
    [navigate],
  )

  const layoutOrgs = useMemo(
    () =>
      organizations
        .filter((o) => Boolean(o.id))
        .map((o) => ({ id: o.id!, code: o.code, name: o.name })),
    [organizations],
  )

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId) ?? null
  const orgName = selectedOrg?.name || 'Organization'

  const learnerInputs = useMemo(
    () =>
      learnerRows.map((row) => ({
        id: row.learnerId,
        name: getDisplayName(row.learner, 'Learner'),
        email: row.learner.email ?? null,
        journeyStatus: row.learner.journeyStatus ?? null,
        currentWeek: row.learner.currentWeek ?? null,
        journeyType: row.learner.journeyType ?? null,
        roleLabel:
          typeof row.learner.transformationTier === 'string'
            ? row.learner.transformationTier
            : null,
        ageRange:
          (row.learner as { ageRange?: string }).ageRange ??
          (row.learner as { age_range?: string }).age_range ??
          null,
        personalityType: row.learner.personalityType ?? null,
        coreValues: Array.isArray(row.learner.coreValues)
          ? (row.learner.coreValues as string[])
          : [],
        totalPoints: row.learner.totalPoints ?? null,
      })),
    [learnerRows],
  )

  const refresh = useCallback(async () => {
    if (!selectedOrgId || !learnerInputs.length) {
      setCards([])
      setPartnerHtml('')
      setOfflineFlags([])
      setOrgPhase('early')
      setSendLog([])
      return
    }
    setCardsLoading(true)
    try {
      const [workspace, log] = await Promise.all([
        buildAssessmentReportWorkspace({
          organizationName: orgName,
          learners: learnerInputs,
          mode: 'partner',
        }),
        listReportSendLog(selectedOrgId),
      ])
      setCards(workspace.cards)
      setPartnerHtml(workspace.partnerHtml)
      setOfflineFlags(workspace.offlineFlags)
      setOrgPhase(workspace.orgPhase)
      setSendLog(log)
    } catch (err) {
      console.error('[CourseSurveysPage] refresh failed', err)
      toast({ status: 'error', title: 'Could not load assessment workspace' })
    } finally {
      setCardsLoading(false)
    }
  }, [selectedOrgId, learnerInputs, orgName, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const nearEndCards = useMemo(
    () => cards.filter((c) => c.phase === 'near_end' || c.phase === 'completed'),
    [cards],
  )
  const courseSurveyKind = useMemo(() => {
    const weeks = orgProgram?.programDurationWeeks ?? null
    if (orgProgram?.cohortStartDate && weeks) {
      return resolveCourseSurveyKind({
        journeyStartDate: orgProgram.cohortStartDate,
        programDurationWeeks: weeks,
      })
    }
    // Fallback when programme dates are missing: soft workspace phase.
    if (orgPhase === 'near_end' || orgPhase === 'completed') return 'post' as const
    return 'pre' as const
  }, [orgProgram?.cohortStartDate, orgProgram?.programDurationWeeks, orgPhase])

  const showPostQueue =
    courseSurveyKind === 'post' &&
    (orgPhase === 'near_end' || nearEndCards.some((c) => !c.partnerPostDone))
  const showFinalReport = orgPhase === 'completed' || cards.some((c) => c.phase === 'completed')

  const rateTarget = useMemo(() => {
    if (!rateLearnerId) return null
    return learnerInputs.find((l) => l.id === rateLearnerId) ?? null
  }, [rateLearnerId, learnerInputs])

  const handleSendReport = async () => {
    if (!profile?.id || !selectedOrgId) return
    if (!partnerHtml) {
      toast({ status: 'warning', title: 'Report not ready yet' })
      return
    }
    const recipients = recipientRoles
      .map((role) => ({
        role,
        email: emailsByRole[role]?.trim() || '',
      }))
      .filter((r) => Boolean(r.email))

    if (!recipients.length) {
      toast({
        status: 'warning',
        title: 'Add recipient emails',
        description: 'Enter at least one address for the selected audiences.',
      })
      return
    }

    setSending(true)
    try {
      const result = await emailOrgAssessmentReport({
        organizationId: selectedOrgId,
        organizationName: orgName,
        sentBy: profile.id,
        recipients,
        html: partnerHtml,
        learnerCount: cards.length,
        learnerIds: cards.map((c) => c.learnerId),
        offlineFlags,
      })
      if (result.status === 'sent') {
        toast({ status: 'success', title: 'Report emailed', duration: 3000 })
      } else if (result.status === 'partial') {
        toast({
          status: 'warning',
          title: 'Partial send',
          description: result.error,
        })
      } else {
        toast({
          status: 'error',
          title: 'Could not send report',
          description: result.error,
        })
      }
      const log = await listReportSendLog(selectedOrgId)
      setSendLog(log)
    } finally {
      setSending(false)
    }
  }

  return (
    <PartnerLayout
      activeItem="course-surveys"
      hideWelcomeHeader
      organizations={layoutOrgs}
      selectedOrg={selectedOrgId || 'all'}
      onSelectOrg={(orgValue) => {
        if (orgValue === 'all') {
          setSelectedOrgId('')
          return
        }
        setSelectedOrgId(orgValue)
      }}
      onNavigate={handleNavigate}
    >
      <Stack spacing={6}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} flexWrap="wrap">
          <Box>
            <Heading size="lg" color="gray.900">
              Course assessments
            </Heading>
            <Text color="gray.600" fontSize="sm" mt={1}>
              Per learner × per course. Partners submit Pre for most of the journey; the CTA switches
              to Post in the final 3 weeks so matched observer growth is computable. Final org reports
              after completion. Learners only see their own report card.
            </Text>
          </Box>
          <HStack spacing={3} flexWrap="wrap">
            {selectedOrgId ? <PreCourseSurveyButton size="sm" kind={courseSurveyKind} /> : null}
            {selectedOrgId && (
              <Badge
                colorScheme={
                  orgPhase === 'completed' ? 'green' : orgPhase === 'near_end' ? 'orange' : 'gray'
                }
                borderRadius="full"
                px={3}
                py={1}
                textTransform="none"
              >
                {phaseLabel(orgPhase)}
              </Badge>
            )}
          </HStack>
        </Flex>

        {!selectedOrgId && (
          <Box p={6} bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl">
            <Text color="gray.500" fontSize="sm">
              Select an organization to open the assessment workspace.
            </Text>
          </Box>
        )}

        {selectedOrgId && mode === 'rate_one' && profile?.id && rateTarget && (
          <Stack spacing={4}>
            <Button
              leftIcon={<Icon as={ArrowLeft} boxSize={4} />}
              variant="ghost"
              size="sm"
              w="fit-content"
              onClick={() => {
                setMode('workspace')
                setRateLearnerId(null)
                setRateForcedKind(null)
                void refresh()
              }}
            >
              Back to workspace
            </Button>
            <RateLearnerCourseAssessment
              respondentId={profile.id}
              raterRole="partner"
              learners={[
                {
                  id: rateTarget.id,
                  name: rateTarget.name,
                  currentWeek: rateTarget.currentWeek,
                  journeyType: rateTarget.journeyType,
                  journeyStatus: rateTarget.journeyStatus,
                },
              ]}
              forcedKind={rateForcedKind ?? undefined}
              allowedCourseTitles={selectedOrgId ? orgCourseTitles : null}
              onSubmitted={() => {
                void refresh()
              }}
            />
          </Stack>
        )}

        {selectedOrgId && mode === 'workspace' && (
          <Stack spacing={6}>
            {learnersLoading || cardsLoading ? (
              <Text fontSize="sm" color="gray.500">
                Loading learners and assessment results…
              </Text>
            ) : cards.length === 0 ? (
              <Box p={6} bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl">
                <Text fontSize="sm" color="gray.500">
                  No learners in this organization yet.
                </Text>
              </Box>
            ) : (
              <>
                {profile?.id ? (
                  <Box id="pre-course-survey" scrollMarginTop="96px">
                    <RateLearnerCourseAssessment
                      respondentId={profile.id}
                      raterRole="partner"
                      learners={learnerInputs.map((l) => ({
                        id: l.id,
                        name: l.name,
                        currentWeek: l.currentWeek,
                        journeyType: l.journeyType,
                        journeyStatus: l.journeyStatus,
                      }))}
                      forcedKind={courseSurveyKind}
                      allowedCourseTitles={orgCourseTitles}
                    />
                  </Box>
                ) : null}

                {courseSurveyKind === 'pre' && (
                  <Box
                    p={5}
                    bg="white"
                    borderWidth="1px"
                    borderColor="gray.200"
                    borderRadius="xl"
                  >
                    <HStack spacing={3} mb={2}>
                      <Icon as={ClipboardList} boxSize={5} color="gray.700" />
                      <Heading size="sm">{courseSurveySectionTitle('pre')} · Post in final 3 weeks</Heading>
                    </HStack>
                    <Text fontSize="sm" color="gray.600">
                      Use Pre assessments above while the cohort is in progress. The button and form
                      switch to Post in the last 3 weeks of the journey. Final org reports unlock
                      after journey completion.
                    </Text>
                  </Box>
                )}

                {showPostQueue && (
                  <Box
                    borderWidth="1px"
                    borderColor="gray.200"
                    borderRadius="xl"
                    bg="white"
                    p={{ base: 4, md: 5 }}
                  >
                    <HStack spacing={3} mb={4}>
                      <Icon as={Users} boxSize={5} color="gray.700" />
                      <Box>
                        <Heading size="sm">Post assessments by learner</Heading>
                        <Text fontSize="sm" color="gray.600">
                          Near journey end — complete a partner Post for each learner
                        </Text>
                      </Box>
                    </HStack>

                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      {nearEndCards.map((card) => (
                        <Box
                          key={card.learnerId}
                          borderWidth="1px"
                          borderColor="gray.200"
                          borderRadius="lg"
                          p={4}
                        >
                          <Flex justify="space-between" gap={3} align="flex-start">
                            <Box minW={0}>
                              <Text fontWeight="semibold" noOfLines={1}>
                                {card.learnerName}
                              </Text>
                              <Text fontSize="xs" color="gray.500" mt={1}>
                                {phaseLabel(card.phase)}
                                {card.currentWeek != null && card.totalWeeks != null
                                  ? ` · W${card.currentWeek}/${card.totalWeeks}`
                                  : ''}
                              </Text>
                              <Badge
                                mt={2}
                                colorScheme={card.partnerPostDone ? 'green' : 'orange'}
                                textTransform="none"
                              >
                                {card.partnerPostDone ? 'Partner Post done' : 'Partner Post needed'}
                              </Badge>
                            </Box>
                            <Button
                              size="sm"
                              bg="#350e6f"
                              color="white"
                              _hover={{ bg: '#27062e' }}
                              onClick={() => {
                                setRateLearnerId(card.learnerId)
                                setRateForcedKind('post')
                                setMode('rate_one')
                              }}
                            >
                              {card.partnerPostDone ? 'Update Post' : 'Take Post'}
                            </Button>
                          </Flex>
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Box>
                )}

                {showFinalReport && (
                  <Box
                    borderWidth="1px"
                    borderColor="gray.200"
                    borderRadius="xl"
                    bg="white"
                    p={{ base: 4, md: 5 }}
                  >
                    <HStack spacing={3} mb={4} justify="space-between" align="flex-start" flexWrap="wrap">
                      <HStack spacing={3} align="flex-start">
                        <Icon as={BarChart3} boxSize={5} color="gray.700" mt={1} />
                        <Box>
                          <Heading size="sm">Final org report</Heading>
                          <Text fontSize="sm" color="gray.600">
                            Matched observer Pre→Post growth (Manager/Partner). Self is separate.
                            Document includes methodology & integrity rules.
                          </Text>
                        </Box>
                      </HStack>
                      <Button
                        size="sm"
                        variant="outline"
                        borderRadius="lg"
                        onClick={() => {
                          if (!partnerHtml) return
                          const w = window.open('', '_blank', 'noopener,noreferrer')
                          if (w) {
                            w.document.write(partnerHtml)
                            w.document.close()
                          }
                        }}
                        isDisabled={!partnerHtml}
                      >
                        Open full report
                      </Button>
                    </HStack>

                    {offlineFlags.length > 0 && (
                      <Box
                        mb={4}
                        p={3}
                        bg="orange.50"
                        borderWidth="1px"
                        borderColor="orange.200"
                        borderRadius="lg"
                      >
                        <Text fontSize="sm" fontWeight="semibold" color="orange.800" mb={1}>
                          Offline review flagged — numbers must stay right
                        </Text>
                        {offlineFlags.map((f) => (
                          <Text key={`${f.code}-${f.message}`} fontSize="xs" color="orange.700">
                            • {f.message}
                          </Text>
                        ))}
                      </Box>
                    )}

                    <Stack spacing={4}>
                      {cards.map((card) => (
                        <CourseAssessmentReportCardView
                          key={card.learnerId}
                          card={card}
                          title={card.learnerName}
                        />
                      ))}
                    </Stack>

                    <Box mt={6} pt={5} borderTopWidth="1px" borderColor="gray.100">
                      <HStack spacing={2} mb={3}>
                        <Icon as={Mail} boxSize={4} />
                        <Heading size="xs">Email combined report</Heading>
                      </HStack>
                      <Text fontSize="sm" color="gray.600" mb={3}>
                        Emails the full performance document (same structure as the sample: exec
                        summary, per-person pages, methodology). Send log kept per org.
                      </Text>

                      <CheckboxGroup
                        value={recipientRoles}
                        onChange={(vals) => setRecipientRoles(vals as ReportAudienceRole[])}
                      >
                        <Wrap spacing={4} mb={4}>
                          {REPORT_AUDIENCE_OPTIONS.map((opt) => (
                            <WrapItem key={opt.id}>
                              <Checkbox value={opt.id}>{opt.label}</Checkbox>
                            </WrapItem>
                          ))}
                        </Wrap>
                      </CheckboxGroup>

                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mb={4}>
                        {REPORT_AUDIENCE_OPTIONS.filter((o) => recipientRoles.includes(o.id)).map(
                          (opt) => (
                            <FormControl key={opt.id}>
                              <FormLabel fontSize="sm">{opt.label} email</FormLabel>
                              <Input
                                type="email"
                                placeholder={`${opt.id}@company.com`}
                                value={emailsByRole[opt.id]}
                                onChange={(e) =>
                                  setEmailsByRole((prev) => ({
                                    ...prev,
                                    [opt.id]: e.target.value,
                                  }))
                                }
                                borderRadius="lg"
                              />
                            </FormControl>
                          ),
                        )}
                      </SimpleGrid>

                      <Button
                        bg="#350e6f"
                        color="white"
                        _hover={{ bg: '#27062e' }}
                        borderRadius="lg"
                        leftIcon={<Icon as={Mail} boxSize={4} />}
                        isLoading={sending}
                        onClick={() => void handleSendReport()}
                      >
                        Email report
                      </Button>
                    </Box>
                  </Box>
                )}

                <Box
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="xl"
                  bg="white"
                  p={{ base: 4, md: 5 }}
                >
                  <Heading size="sm" mb={3}>
                    Send log
                  </Heading>
                  {sendLog.length === 0 ? (
                    <Text fontSize="sm" color="gray.500">
                      No report emails sent yet for this organization.
                    </Text>
                  ) : (
                    <Box overflowX="auto">
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>When</Th>
                            <Th>Recipients</Th>
                            <Th>Roles</Th>
                            <Th>Status</Th>
                            <Th isNumeric>Learners</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {sendLog.map((row) => (
                            <Tr key={row.id}>
                              <Td>{new Date(row.sent_at).toLocaleString()}</Td>
                              <Td>
                                {(row.recipients || [])
                                  .map((r) => r.email)
                                  .filter(Boolean)
                                  .join(', ') || '—'}
                              </Td>
                              <Td>{(row.recipient_roles || []).join(', ') || '—'}</Td>
                              <Td>
                                <Badge
                                  colorScheme={
                                    row.status === 'sent'
                                      ? 'green'
                                      : row.status === 'partial'
                                        ? 'orange'
                                        : 'red'
                                  }
                                  textTransform="none"
                                >
                                  {row.status}
                                </Badge>
                              </Td>
                              <Td isNumeric>{row.learner_count}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Stack>
        )}
      </Stack>
    </PartnerLayout>
  )
}

export default CourseSurveysPage
