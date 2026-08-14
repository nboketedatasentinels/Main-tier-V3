import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Avatar,
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AmbassadorLayout } from '@/layouts/AmbassadorLayout'
import { AmbassadorSessionsPanel } from '@/components/ambassador/AmbassadorSessionsPanel'
import { RateLearnerCourseAssessment } from '@/components/assessments/RateLearnerCourseAssessment'
import { PreCourseSurveyButton } from '@/components/assessments/PreCourseSurveyButton'
import { CoachLearnerPanel } from '@/components/coach/CoachLearnerPanel'
import { LearnerSessionPrep } from '@/components/session-prep/LearnerSessionPrep'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import { useOrgProgrammeCourseTitles } from '@/hooks/useOrgProgrammeCourseTitles'
import { fetchAssignedCoachees } from '@/services/learnerAssignmentService'
import { getOrganizationProgram } from '@/services/supabaseOrgService'
import { getDisplayName } from '@/utils/displayName'
import { JOURNEY_META } from '@/config/pointsConfig'
import { isJourneyType } from '@/utils/journeyType'
import { resolveCourseSurveyKind } from '@/utils/courseSurveyWindow'
import { resolvePurchasedCoachSessions } from '@/utils/purchasedCoachSessions'
import { buildAmbassadorNavItems } from '@/utils/navigationItems'
import {
  resolveCoachNavDestination,
  type CoachDashboardSection,
} from '@/utils/coachNavigation'
import { PERSONALITY_TYPES } from '@/config/personality-data'
import type { UserProfile } from '@/types'

type SectionKey = CoachDashboardSection

const personalityLabel = (type?: string | null): string | null => {
  if (!type) return null
  const hit = PERSONALITY_TYPES.find((p) => p.type === type)
  return hit ? `${hit.type} · ${hit.name}` : type
}

const SectionShell: React.FC<{
  id: string
  eyebrow: string
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
}> = ({ id, eyebrow, title, subtitle, children, action }) => (
  <Box id={id} as="section" scrollMarginTop="96px">
    <Flex justify="space-between" align={{ base: 'flex-start', md: 'end' }} gap={4} mb={5} flexWrap="wrap">
      <Box>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="gray.500"
        >
          {eyebrow}
        </Text>
        <Text mt={1} fontSize={{ base: 'xl', md: '2xl' }} fontWeight="700" color="gray.900" letterSpacing="-0.02em">
          {title}
        </Text>
        {subtitle ? (
          <Text mt={1} color="gray.600" maxW="640px" fontSize="sm" lineHeight="1.6">
            {subtitle}
          </Text>
        ) : null}
      </Box>
      {action}
    </Flex>
    {children}
  </Box>
)

export const AmbassadorDashboard: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeSection, setActiveSection] = useState<SectionKey>('overview')
  const [coachees, setCoachees] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [orgPurchasedSessions, setOrgPurchasedSessions] = useState<number | null>(null)

  const loadCoachees = async () => {
    if (!profile?.id) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAssignedCoachees(profile.id)
      setCoachees(rows)
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev
        return rows[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load coachees')
      setCoachees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCoachees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return coachees
    return coachees.filter((c) => {
      const name = getDisplayName(c).toLowerCase()
      const email = (c.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [coachees, search])

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null
  const navSections = useMemo(() => buildAmbassadorNavItems(), [])

  const coacheeOrgId =
    selected?.organizationId ||
    selected?.companyId ||
    coachees[0]?.organizationId ||
    coachees[0]?.companyId ||
    profile?.organizationId ||
    profile?.companyId ||
    null

  const { program: orgProgram } = useOrganizationProgramCourses(coacheeOrgId)
  const orgCourseTitles = useOrgProgrammeCourseTitles(orgProgram)

  useEffect(() => {
    if (!coacheeOrgId) {
      setOrgPurchasedSessions(null)
      return
    }
    let cancelled = false
    void getOrganizationProgram(coacheeOrgId)
      .then((data) => {
        if (cancelled) return
        setOrgPurchasedSessions(
          data?.purchasedCoachSessions != null && Number.isFinite(Number(data.purchasedCoachSessions))
            ? Number(data.purchasedCoachSessions)
            : null,
        )
      })
      .catch(() => {
        if (!cancelled) setOrgPurchasedSessions(null)
      })
    return () => {
      cancelled = true
    }
  }, [coacheeOrgId])

  const purchasedForSelected = resolvePurchasedCoachSessions({
    learnerPurchased: selected?.purchasedCoachSessions,
    orgPurchased: orgPurchasedSessions,
  })

  const courseSurveyKind = useMemo(() => {
    const subject = selected
    const journeyType =
      typeof subject?.journeyType === 'string' && isJourneyType(subject.journeyType)
        ? subject.journeyType
        : null
    const weeks =
      subject?.programDurationWeeks ||
      (journeyType ? JOURNEY_META[journeyType].weeks : null) ||
      orgProgram?.programDurationWeeks ||
      null
    return resolveCourseSurveyKind({
      journeyStartDate: subject?.journeyStartDate,
      programDurationWeeks: weeks,
      currentWeek: subject?.currentWeek,
    })
  }, [selected, orgProgram?.programDurationWeeks])

  const activeAssessmentSection = courseSurveyKind === 'post' ? 'assessments' : 'pre-assessments'

  const scrollTo = (key: SectionKey) => {
    setActiveSection(key)
    const el = document.getElementById(`coach-${key}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const section = (location.state as { coachSection?: SectionKey } | null)?.coachSection
    if (!section) return
    const timer = window.setTimeout(() => scrollTo(section), 80)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const handleNavigate = (key: string) => {
    const dest = resolveCoachNavDestination(key)
    if (dest.kind === 'route') {
      navigate(dest.path)
      return
    }
    scrollTo(dest.section)
  }

  const assessmentLearners = useMemo(
    () =>
      coachees.map((c) => ({
        id: c.id!,
        name: getDisplayName(c),
        currentWeek: c.currentWeek,
        journeyType: typeof c.journeyType === 'string' ? c.journeyType : undefined,
        journeyStatus: typeof c.journeyStatus === 'string' ? c.journeyStatus : undefined,
      })),
    [coachees],
  )

  return (
    <AmbassadorLayout
      activeItem={activeSection}
      onNavigate={handleNavigate}
      ambassadorName={profile ? getDisplayName(profile) : 'Coach'}
      avatarUrl={profile?.avatarUrl}
      navSections={navSections}
      subtitle="Coach workspace"
    >
      <Box minH="100%" bg="white" mx={{ base: -4, md: -6 }} px={{ base: 4, md: 6 }} py={6}>
        <Box
          id="coach-overview"
          mb={8}
          borderRadius="xl"
          border="1px solid"
          borderColor="gray.200"
          bg="white"
          px={{ base: 5, md: 8 }}
          py={{ base: 6, md: 8 }}
        >
          <Flex justify="space-between" align="flex-start" gap={6} flexWrap="wrap">
            <Box maxW="640px">
              <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.12em" color="gray.500">
                COACH WORKSPACE
              </Text>
              <Text
                mt={2}
                fontSize={{ base: '2xl', md: '3xl' }}
                fontWeight="700"
                letterSpacing="-0.03em"
                lineHeight="1.15"
                color="gray.900"
              >
                Coach with discipline, not advice by default.
              </Text>
              <Text mt={3} color="gray.600" fontSize="sm" lineHeight="1.7">
                Same profile depth as mentors — values, personality, age band, and AI notes — plus the
                coaching goal, your learning plan, and session count from what the company purchased.
                Only learners assigned to you (or your organisation) appear here.
              </Text>
              <HStack mt={6} spacing={3} flexWrap="wrap">
                <Button
                  rightIcon={<ArrowRight size={16} />}
                  bg="#350e6f"
                  color="white"
                  _hover={{ bg: '#27062e' }}
                  borderRadius="md"
                  onClick={() => scrollTo('coachees')}
                >
                  Open coachees
                </Button>
                <PreCourseSurveyButton
                  kind={courseSurveyKind}
                  onClick={() => scrollTo(activeAssessmentSection)}
                />
                <Button
                  variant="outline"
                  borderColor="gray.300"
                  color="gray.800"
                  bg="white"
                  _hover={{ bg: 'gray.50' }}
                  borderRadius="md"
                  leftIcon={<CalendarClock size={16} />}
                  onClick={() => scrollTo('schedule')}
                >
                  Session slots
                </Button>
                <Button
                  variant="outline"
                  borderColor="gray.300"
                  onClick={() => navigate('/coach/guidelines')}
                >
                  Coach guidelines
                </Button>
              </HStack>
            </Box>
            <SimpleGrid columns={1} spacing={3} minW={{ base: '100%', md: '220px' }}>
              <Box
                as="button"
                textAlign="left"
                bg="gray.50"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="lg"
                px={4}
                py={3}
                onClick={() => scrollTo('coachees')}
                _hover={{ bg: 'gray.100' }}
              >
                <HStack spacing={3}>
                  <Icon as={Users} color="gray.600" />
                  <Box>
                    <Text fontSize="xs" color="gray.500">
                      Coachees
                    </Text>
                    <Text fontWeight="700" fontSize="lg" color="gray.900">
                      {coachees.length}
                    </Text>
                  </Box>
                </HStack>
              </Box>
              <Box
                as="button"
                textAlign="left"
                bg="gray.50"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="lg"
                px={4}
                py={3}
                onClick={() => scrollTo(activeAssessmentSection)}
                _hover={{ bg: 'gray.100' }}
              >
                <HStack spacing={3}>
                  <Icon
                    as={courseSurveyKind === 'pre' ? ClipboardList : ClipboardCheck}
                    color="gray.600"
                  />
                  <Box>
                    <Text fontSize="xs" color="gray.500">
                      {courseSurveyKind === 'pre' ? 'Pre assessments' : 'Post assessments'}
                    </Text>
                    <Text fontWeight="700" fontSize="lg" color="gray.900">
                      {orgCourseTitles.length
                        ? `${orgCourseTitles.length} course${orgCourseTitles.length === 1 ? '' : 's'}`
                        : 'Org courses'}
                    </Text>
                  </Box>
                </HStack>
              </Box>
            </SimpleGrid>
          </Flex>
        </Box>

        <Stack spacing={10}>
          <SectionShell
            id="coach-coachees"
            eyebrow="Directory"
            title="Who you coach"
            subtitle="Learners appear when your organisation has an Ambassador Coach assigned and you are linked to them. Open a profile for goals, learning plan, and Session Prep."
            action={
              <Button
                leftIcon={<RefreshCw size={14} />}
                size="sm"
                variant="outline"
                borderColor="gray.300"
                onClick={() => void loadCoachees()}
                isLoading={loading}
              >
                Refresh
              </Button>
            }
          >
            {error ? (
              <Alert status="error" borderRadius="lg" mb={4}>
                <AlertIcon />
                {error}
              </Alert>
            ) : null}

            <InputGroup maxW="420px" mb={5}>
              <InputLeftElement pointerEvents="none">
                <Search size={16} color="#9CA3AF" />
              </InputLeftElement>
              <Input
                placeholder="Search coachees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                bg="white"
                borderColor="gray.200"
                borderRadius="md"
              />
            </InputGroup>

            {loading ? (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Skeleton height="220px" borderRadius="xl" />
                <Skeleton height="220px" borderRadius="xl" />
              </SimpleGrid>
            ) : filtered.length === 0 ? (
              <Box p={8} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                <Text color="gray.600" fontSize="sm" lineHeight="1.7">
                  No coachees yet. Coaching only shows when an organisation has an Ambassador /
                  Coach assigned and learners are linked to you. Ask the Transformation Partner to
                  confirm org coach assignment.
                </Text>
              </Box>
            ) : (
              <Grid templateColumns={{ base: '1fr', lg: '280px 1fr' }} gap={5}>
                <Stack spacing={2}>
                  {filtered.map((c) => {
                    const active = selected?.id === c.id
                    return (
                      <Button
                        key={c.id}
                        onClick={() => {
                          setSelectedId(c.id)
                          setActiveSection('coachees')
                        }}
                        justifyContent="flex-start"
                        h="auto"
                        py={3}
                        px={3}
                        borderRadius="lg"
                        bg={active ? 'gray.50' : 'white'}
                        color="gray.800"
                        border="1px solid"
                        borderColor={active ? '#350e6f' : 'gray.200'}
                        boxShadow={active ? 'inset 3px 0 0 #350e6f' : 'none'}
                        _hover={{ bg: 'gray.50', borderColor: active ? '#350e6f' : 'gray.300' }}
                        textAlign="left"
                      >
                        <HStack spacing={3} align="center" w="full">
                          <Avatar name={getDisplayName(c)} size="sm" bg="gray.100" color="gray.700" />
                          <Box minW={0}>
                            <Text fontWeight="600" fontSize="sm" noOfLines={1} color="gray.900">
                              {getDisplayName(c)}
                            </Text>
                            <Text fontSize="xs" color="gray.500" noOfLines={1}>
                              {personalityLabel(c.personalityType) || 'Personality pending'}
                            </Text>
                          </Box>
                        </HStack>
                      </Button>
                    )
                  })}
                </Stack>

                {selected ? (
                  <Stack spacing={6}>
                    <CoachLearnerPanel
                      learner={selected}
                      orgPurchasedCoachSessions={orgPurchasedSessions}
                    />
                    <Box>
                      <Text
                        fontSize="xs"
                        fontWeight="semibold"
                        letterSpacing="0.12em"
                        textTransform="uppercase"
                        color="gray.500"
                        mb={3}
                      >
                        Session Prep
                      </Text>
                      <LearnerSessionPrep
                        audience="coach"
                        learner={selected}
                        purchasedCoachSessions={purchasedForSelected}
                        windowStatus="warning"
                      />
                    </Box>
                  </Stack>
                ) : null}
              </Grid>
            )}
          </SectionShell>

          <SectionShell
            id="coach-schedule"
            eyebrow="Sessions"
            title="Coaching slots"
            subtitle="Publish availability. Learners book against what their organisation purchased. Mark Attended to issue +2,000 Ambassador Session points — only when they showed up (within 48 hours for Journey clients)."
          >
            {profile?.id ? (
              <AmbassadorSessionsPanel
                ambassadorId={profile.id}
                ambassadorName={getDisplayName(profile)}
                companyId={
                  (profile.organizationId || profile.companyId || coacheeOrgId || null) as
                    | string
                    | null
                }
                companyCode={profile.companyCode || null}
              />
            ) : (
              <Skeleton height="200px" borderRadius="xl" />
            )}
          </SectionShell>

          {courseSurveyKind === 'pre' ? (
            <SectionShell
              id="coach-pre-assessments"
              eyebrow="Start of course"
              title="Coachee pre-assessments"
              subtitle={
                orgCourseTitles.length
                  ? `Rate each coachee on their organisation programme (${orgCourseTitles.join(', ')}).`
                  : 'Rate each coachee on the courses assigned to their organisation.'
              }
            >
              {profile?.id && assessmentLearners.length > 0 ? (
                <Box bg="white" borderRadius="xl" border="1px solid" borderColor="gray.200" p={{ base: 4, md: 6 }}>
                  <RateLearnerCourseAssessment
                    respondentId={profile.id}
                    raterRole="coach"
                    learners={assessmentLearners}
                    forcedKind="pre"
                    allowedCourseTitles={coacheeOrgId ? orgCourseTitles : null}
                  />
                </Box>
              ) : (
                <Box p={6} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                  <Text fontSize="sm" color="gray.600">
                    Assign coachees first. Pre assessments appear here for each learner on your roster.
                  </Text>
                </Box>
              )}
            </SectionShell>
          ) : (
            <SectionShell
              id="coach-assessments"
              eyebrow="End of course"
              title="Coachee post-assessments"
              subtitle="Final 3 weeks: complete the coach Post rating about them."
            >
              {profile?.id && assessmentLearners.length > 0 ? (
                <Box bg="white" borderRadius="xl" border="1px solid" borderColor="gray.200" p={{ base: 4, md: 6 }}>
                  <RateLearnerCourseAssessment
                    respondentId={profile.id}
                    raterRole="coach"
                    learners={assessmentLearners}
                    forcedKind="post"
                    allowedCourseTitles={coacheeOrgId ? orgCourseTitles : null}
                  />
                </Box>
              ) : (
                <Box p={6} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                  <Text fontSize="sm" color="gray.600">
                    Assign coachees first. Post assessments appear here for each learner on your roster.
                  </Text>
                </Box>
              )}
            </SectionShell>
          )}
        </Stack>
      </Box>
    </AmbassadorLayout>
  )
}

export default AmbassadorDashboard
