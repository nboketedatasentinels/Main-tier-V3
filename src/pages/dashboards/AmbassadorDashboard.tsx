import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Collapse,
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
  ChevronDown,
  ChevronUp,
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
import { LearnerPointsRanking } from '@/components/coach/LearnerPointsRanking'
import { LearnerSessionPrep } from '@/components/session-prep/LearnerSessionPrep'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import { useOrgProgrammeCourseTitles } from '@/hooks/useOrgProgrammeCourseTitles'
import { fetchAssignedCoachees } from '@/services/learnerAssignmentService'
import { getOrganizationProgram } from '@/services/supabaseOrgService'
import { getDisplayName } from '@/utils/displayName'
import { resolvePurchasedCoachSessions, nextCoachSessionNumber } from '@/utils/purchasedCoachSessions'
import { buildAmbassadorNavItems } from '@/utils/navigationItems'
import {
  resolveCoachNavDestination,
  type CoachDashboardSection,
} from '@/utils/coachNavigation'
import {
  groupBookingsByStatus,
  subscribeToLearnerBookings,
} from '@/services/ambassadorSessionService'
import type { UserProfile } from '@/types'

type SectionKey = CoachDashboardSection

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
  const [sessionPrepOpen, setSessionPrepOpen] = useState(false)
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

  const [attendedCount, setAttendedCount] = useState(0)

  useEffect(() => {
    const learnerId = selected?.id
    if (!learnerId) {
      setAttendedCount(0)
      return
    }
    return subscribeToLearnerBookings(
      learnerId,
      (bookings) => {
        setAttendedCount(groupBookingsByStatus(bookings).attended.length)
      },
      () => setAttendedCount(0),
    )
  }, [selected?.id])

  const sessionNumberForSelected = nextCoachSessionNumber({
    attendedCount,
    purchased: purchasedForSelected,
  })

  const scrollTo = (key: SectionKey) => {
    setActiveSection(key)
    // Section panels swap in place — scroll the coach main pane to top.
    window.setTimeout(() => {
      const scroller = document.querySelector('[data-coach-main-scroll]') as HTMLElement | null
      if (scroller) {
        scroller.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const el = document.getElementById(`coach-${key}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
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
        email: c.email ?? null,
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
        {activeSection === 'overview' ? (
          <Stack spacing={6} id="coach-overview">
            <Box
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
                    Overview stays short on purpose. Open My coachees for ranking, profiles, and Session
                    Prep — without scrolling forever on one page.
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
                      Meetings
                    </Button>
                    <PreCourseSurveyButton
                      kind="post"
                      label="Assessments"
                      onClick={() => scrollTo('assessments')}
                    />
                    <Button
                      variant="outline"
                      borderColor="gray.300"
                      onClick={() => navigate('/coach/guidelines')}
                    >
                      Coach guidelines
                    </Button>
                  </HStack>
                </Box>
                <SimpleGrid columns={1} spacing={3} minW={{ base: '100%', md: '260px' }} maxW={{ md: '280px' }}>
                  <Box
                    as="button"
                    textAlign="left"
                    bg="gray.50"
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="lg"
                    px={4}
                    py={3}
                    cursor="pointer"
                    _hover={{ bg: 'gray.100', borderColor: 'gray.300' }}
                    onClick={() => scrollTo('coachees')}
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
                  <LearnerPointsRanking
                    learners={coachees}
                    selectedId={selected?.id}
                    limit={5}
                    sticky={false}
                    title="Top points"
                    seeMoreLabel="Full ranking"
                    onSeeMore={() => scrollTo('coachees')}
                    onSelect={(id) => {
                      setSelectedId(id)
                      scrollTo('coachees')
                    }}
                  />
                </SimpleGrid>
              </Flex>
            </Box>
          </Stack>
        ) : null}

        {activeSection === 'coachees' ? (
          <Stack spacing={3} id="coach-coachees" scrollMarginTop="16px">
            <Flex justify="flex-end">
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
            </Flex>

            {error ? (
              <Alert status="error" borderRadius="lg">
                <AlertIcon />
                {error}
              </Alert>
            ) : null}

            <Grid
              templateColumns={{ base: '1fr', xl: '280px minmax(0, 1fr)' }}
              gap={5}
              alignItems="start"
              maxW="100%"
              minW={0}
            >
              <Stack spacing={3}>
                <InputGroup>
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
                <LearnerPointsRanking
                  learners={filtered}
                  selectedId={selected?.id}
                  sticky
                  limit={5}
                  expandable
                  title="Points ranking"
                  onSelect={(id) => {
                    setSelectedId(id)
                    setSessionPrepOpen(false)
                  }}
                />
              </Stack>
              <Box minW={0}>
                {loading ? (
                  <Skeleton height="280px" borderRadius="xl" />
                ) : filtered.length === 0 ? (
                  <Box p={8} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                    <Text color="gray.600" fontSize="sm" lineHeight="1.7">
                      No coachees yet. Coaching only shows when an organisation has an Ambassador /
                      Coach assigned and learners are linked to you. Ask the Transformation Partner to
                      confirm org coach assignment.
                    </Text>
                  </Box>
                ) : selected ? (
                  <Stack spacing={3} minW={0}>
                    <CoachLearnerPanel
                      learner={selected}
                      orgPurchasedCoachSessions={orgPurchasedSessions}
                      courseTitles={orgCourseTitles}
                      attendedSessionCount={attendedCount}
                    />
                    <Box border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white" overflow="hidden">
                      <Button
                        variant="ghost"
                        w="full"
                        justifyContent="space-between"
                        borderRadius={0}
                        h="auto"
                        py={3}
                        px={4}
                        rightIcon={<Icon as={sessionPrepOpen ? ChevronUp : ChevronDown} boxSize={4} />}
                        onClick={() => setSessionPrepOpen((v) => !v)}
                      >
                        <Text fontSize="sm" fontWeight="600" color="gray.800">
                          Session prep
                        </Text>
                      </Button>
                      <Collapse in={sessionPrepOpen} animateOpacity>
                        <Box px={3} pb={4} borderTop="1px solid" borderColor="gray.100">
                          <LearnerSessionPrep
                            audience="coach"
                            learner={selected}
                            purchasedCoachSessions={purchasedForSelected}
                            sessionNumber={sessionNumberForSelected}
                            windowStatus={null}
                            courseTitles={orgCourseTitles}
                            hideLiftSection
                          />
                        </Box>
                      </Collapse>
                    </Box>
                  </Stack>
                ) : (
                  <Box
                    p={6}
                    bg="white"
                    borderRadius="xl"
                    border="1px dashed"
                    borderColor="gray.200"
                  >
                    <Text fontSize="sm" color="gray.600">
                      Select a coachee from the ranking to open their profile.
                    </Text>
                  </Box>
                )}
              </Box>
            </Grid>
          </Stack>
        ) : null}

        {activeSection === 'schedule' ? (
          <SectionShell
            id="coach-schedule"
            eyebrow="Sessions"
            title="Coaching slots"
            subtitle="Publish availability. Learners book against what their organisation purchased. Mark Attended to issue +2,000 Coach Session points - only when they showed up (within 48 hours for Journey clients). Session points ledger stays under Meetings → Session points."
            action={
              <Button
                size="sm"
                variant="outline"
                borderColor="gray.300"
                onClick={() => navigate('/coach/session-points')}
              >
                Session points
              </Button>
            }
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
                coachees={coachees.map((c) => ({
                  id: c.id,
                  name: getDisplayName(c),
                }))}
              />
            ) : (
              <Skeleton height="200px" borderRadius="xl" />
            )}
          </SectionShell>
        ) : null}

        {activeSection === 'assessments' ? (
          <SectionShell
            id="coach-assessments"
            eyebrow="End of course"
            title="Coachee post-assessments"
            subtitle={
              orgCourseTitles.length
                ? `Coaches complete Post only. Courses follow their organisation programme (${orgCourseTitles.join(', ')}).`
                : 'Coaches complete Post ratings only - after the learner finishes the course.'
            }
          >
            {profile?.id && assessmentLearners.length > 0 ? (
              <Box
                bg="white"
                borderRadius="xl"
                border="1px solid"
                borderColor="gray.200"
                p={{ base: 4, md: 6 }}
              >
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
        ) : null}
      </Box>
    </AmbassadorLayout>
  )
}

export default AmbassadorDashboard
