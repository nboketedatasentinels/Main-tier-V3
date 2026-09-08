import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Collapse,
  Flex,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Search,
  Users,
  ArrowRight,
  RefreshCw,
  Trophy,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MentorDashboardLayout } from '@/layouts/MentorDashboardLayout'
import { MentorSessionsPanel } from '@/components/mentor/MentorSessionsPanel'
import { MentorLearnerPanel } from '@/components/mentor/MentorLearnerPanel'
import { LearnerPointsRanking } from '@/components/coach/LearnerPointsRanking'
import { RateLearnerCourseAssessment } from '@/components/assessments/RateLearnerCourseAssessment'
import {
  PreCourseSurveyButton,
} from '@/components/assessments/PreCourseSurveyButton'
import { LearnerSessionPrep } from '@/components/session-prep/LearnerSessionPrep'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import { fetchAssignedMenteesForMentor } from '@/services/learnerAssignmentService'
import { mentoringTipsLibrary } from '@/services/mentorCoachingInsights'
import { getCatalogueCourseById } from '@/config/courseCatalogue'
import { getDisplayName } from '@/utils/displayName'
import { buildMentorNavItems } from '@/utils/navigationItems'
import {
  resolveMentorNavDestination,
  type MentorDashboardSection,
} from '@/utils/mentorNavigation'
import type { UserProfile } from '@/types'

type SectionKey = MentorDashboardSection

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

export const MentorDashboard: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeSection, setActiveSection] = useState<SectionKey>('overview')
  const [mentees, setMentees] = useState<UserProfile[]>([])
  const [sessionPrepOpen, setSessionPrepOpen] = useState(false)
  const rankingModal = useDisclosure()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scheduleOpenToken, setScheduleOpenToken] = useState(0)

  const loadMentees = async () => {
    if (!profile?.id) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAssignedMenteesForMentor(profile.id)
      setMentees(rows)
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev
        return rows[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load mentees')
      setMentees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMentees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mentees
    return mentees.filter((m) => {
      const name = getDisplayName(m).toLowerCase()
      const email = (m.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [mentees, search])

  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0] ?? null
  const tipOfDay = mentoringTipsLibrary[new Date().getDay() % mentoringTipsLibrary.length]
  const navSections = useMemo(() => buildMentorNavItems(), [])

  const menteeOrgId = selected?.organizationId || selected?.companyId || null
  const { program: orgProgram } = useOrganizationProgramCourses(menteeOrgId)

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

  const scrollTo = (key: SectionKey) => {
    setActiveSection(key)
    // Section panels swap in place — scroll the mentor main pane to top.
    window.setTimeout(() => {
      const scroller = document.querySelector('[data-mentor-main-scroll]') as HTMLElement | null
      if (scroller) {
        scroller.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const el = document.getElementById(`mentor-${key}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const openMeetingSchedule = () => {
    setScheduleOpenToken((n) => n + 1)
    scrollTo('schedule')
  }

  useEffect(() => {
    const section = (location.state as { mentorSection?: SectionKey } | null)?.mentorSection
    if (!section) return
    const timer = window.setTimeout(() => {
      if (section === 'schedule') {
        setScheduleOpenToken((n) => n + 1)
      }
      scrollTo(section)
    }, 80)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const handleNavigate = (key: string) => {
    const dest = resolveMentorNavDestination(key)
    if (dest.kind === 'route') {
      navigate(dest.path)
      return
    }
    if (dest.section === 'schedule') {
      setScheduleOpenToken((n) => n + 1)
    }
    scrollTo(dest.section)
  }

  const assessmentLearners = useMemo(
    () =>
      mentees.map((m) => ({
        id: m.id,
        name: getDisplayName(m),
        email: m.email ?? null,
        currentWeek: m.currentWeek,
        journeyType: typeof m.journeyType === 'string' ? m.journeyType : undefined,
        journeyStatus: typeof m.journeyStatus === 'string' ? m.journeyStatus : undefined,
      })),
    [mentees],
  )

  return (
    <MentorDashboardLayout
      activeItem={activeSection}
      onNavigate={handleNavigate}
      mentorName={profile ? getDisplayName(profile) : 'Mentor'}
      mentorRoleLabel="Mentor"
      navSections={navSections}
      headerLeading={
        <HStack spacing={2} w="full" minW={0}>
          <InputGroup flex="1" minW={0}>
            <InputLeftElement pointerEvents="none">
              <Search size={16} color="#9CA3AF" />
            </InputLeftElement>
            <Input
              placeholder="Search mentees…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                if (activeSection !== 'mentees') setActiveSection('mentees')
              }}
              onFocus={() => {
                if (activeSection !== 'mentees') setActiveSection('mentees')
              }}
              bg="white"
              borderColor="gray.200"
              borderRadius="md"
            />
          </InputGroup>
          <Button
            leftIcon={<RefreshCw size={14} />}
            size="sm"
            variant="outline"
            borderColor="gray.300"
            onClick={() => void loadMentees()}
            isLoading={loading}
            flexShrink={0}
          >
            Refresh
          </Button>
        </HStack>
      }
    >
      <Box minH="100%" bg="white" mx={{ base: -4, md: -6 }} px={{ base: 4, md: 6 }} py={6}>
        {activeSection === 'overview' ? (
          <Stack spacing={6} id="mentor-overview">
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
                    MENTOR WORKSPACE
                  </Text>
                  <Text
                    mt={2}
                    fontSize={{ base: '2xl', md: '3xl' }}
                    fontWeight="700"
                    letterSpacing="-0.03em"
                    lineHeight="1.15"
                    color="gray.900"
                  >
                    Guide your mentees with clarity.
                  </Text>
                  <Text mt={3} color="gray.600" fontSize="sm" lineHeight="1.7">
                    Overview stays short on purpose. Open My mentees for ranking, profiles, and Session
                    Prep — without scrolling forever on one page.
                  </Text>
                  <HStack mt={6} spacing={3} flexWrap="wrap">
                    <Button
                      rightIcon={<ArrowRight size={16} />}
                      bg="#350e6f"
                      color="white"
                      _hover={{ bg: '#27062e' }}
                      borderRadius="md"
                      onClick={() => scrollTo('mentees')}
                    >
                      Open mentees
                    </Button>
                    <Button
                      variant="outline"
                      borderColor="gray.300"
                      color="gray.800"
                      bg="white"
                      _hover={{ bg: 'gray.50' }}
                      borderRadius="md"
                      leftIcon={<CalendarClock size={16} />}
                      onClick={openMeetingSchedule}
                    >
                      Meetings
                    </Button>
                    <PreCourseSurveyButton
                      kind="post"
                      label="Assessments"
                      onClick={() => scrollTo('assessments')}
                    />
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
                    onClick={() => scrollTo('mentees')}
                  >
                    <HStack spacing={3}>
                      <Icon as={Users} color="gray.600" />
                      <Box>
                        <Text fontSize="xs" color="gray.500">
                          Mentees
                        </Text>
                        <Text fontWeight="700" fontSize="lg" color="gray.900">
                          {mentees.length}
                        </Text>
                      </Box>
                    </HStack>
                  </Box>
                  <LearnerPointsRanking
                    learners={mentees}
                    selectedId={selected?.id}
                    limit={5}
                    sticky={false}
                    title="Top points"
                    seeMoreLabel="Full ranking"
                    onSeeMore={() => {
                      scrollTo('mentees')
                      rankingModal.onOpen()
                    }}
                    onSelect={(id) => {
                      setSelectedId(id)
                      scrollTo('mentees')
                    }}
                  />
                </SimpleGrid>
              </Flex>
            </Box>

            <Box p={5} borderRadius="xl" bg="white" border="1px solid" borderColor="gray.200">
              <HStack spacing={2} mb={2}>
                <Icon as={Lightbulb} color="gray.600" />
                <Text fontWeight="600" color="gray.900" fontSize="sm">
                  Mentoring tip
                </Text>
              </HStack>
              <Text fontSize="sm" color="gray.600" lineHeight="1.65">
                {tipOfDay}
              </Text>
            </Box>
          </Stack>
        ) : null}

        {activeSection === 'mentees' ? (
          <Stack spacing={3} id="mentor-mentees" scrollMarginTop="16px">
            {error ? (
              <Alert status="error" borderRadius="lg">
                <AlertIcon />
                {error}
              </Alert>
            ) : null}

            <Box minW={0} w="full">
              {loading ? (
                <Skeleton height="280px" borderRadius="xl" />
              ) : filtered.length === 0 ? (
                <Box p={8} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                  <Text color="gray.600" fontSize="sm">
                    No mentees assigned yet. Learners in your organisation appear here automatically
                    once you are linked to that organisation. Explicit mentor assignments also show
                    up here.
                  </Text>
                </Box>
              ) : selected ? (
                <Stack spacing={3} minW={0} w="full">
                  <MentorLearnerPanel
                    learner={selected}
                    mentorId={profile?.id}
                    headerAction={
                      <Button
                        size="sm"
                        variant="outline"
                        borderColor="gray.300"
                        color="#350e6f"
                        leftIcon={<Icon as={Trophy} boxSize={3.5} />}
                        onClick={rankingModal.onOpen}
                      >
                        Points ranking
                      </Button>
                    }
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
                          audience="mentor"
                          learner={selected}
                          courseTitles={orgCourseTitles}
                          windowStatus={null}
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
                    Open Points ranking to pick a mentee, or wait for the roster to load.
                  </Text>
                  <Button
                    mt={3}
                    size="sm"
                    variant="outline"
                    borderColor="gray.300"
                    leftIcon={<Icon as={Trophy} boxSize={3.5} />}
                    onClick={rankingModal.onOpen}
                  >
                    Points ranking
                  </Button>
                </Box>
              )}
            </Box>

            <Modal isOpen={rankingModal.isOpen} onClose={rankingModal.onClose} size="lg" isCentered scrollBehavior="inside">
              <ModalOverlay bg="blackAlpha.400" />
              <ModalContent mx={4} borderRadius="xl">
                <ModalHeader pb={2} fontSize="md">
                  Points ranking
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={5} pt={0}>
                  <LearnerPointsRanking
                    learners={filtered}
                    selectedId={selected?.id}
                    sticky={false}
                    bare
                    expandable
                    onSelect={(id) => {
                      setSelectedId(id)
                      setSessionPrepOpen(false)
                      rankingModal.onClose()
                    }}
                  />
                </ModalBody>
              </ModalContent>
            </Modal>
          </Stack>
        ) : null}

        {activeSection === 'schedule' ? (
          <SectionShell
            id="mentor-schedule"
            eyebrow="Meetings"
            title="Meeting schedule"
            subtitle="Learner requests appear here. Accept to confirm, then mark attendance to issue mentor meetup points. Session points ledger stays under Meetings → Session points."
            action={
              <Button
                size="sm"
                variant="outline"
                borderColor="gray.300"
                onClick={() => navigate('/mentor/session-points')}
              >
                Session points
              </Button>
            }
          >
            {profile?.id ? (
              <MentorSessionsPanel
                mentorId={profile.id}
                mentorName={getDisplayName(profile)}
                mentees={assessmentLearners.map((l) => ({ id: l.id, name: l.name }))}
                pointsIssuanceEnabled
                scheduleOpenToken={scheduleOpenToken}
              />
            ) : (
              <Skeleton height="200px" borderRadius="xl" />
            )}
          </SectionShell>
        ) : null}

        {activeSection === 'assessments' ? (
          <SectionShell
            id="mentor-assessments"
            eyebrow="End of course"
            title="Mentee post-assessments"
            subtitle={
              orgCourseTitles.length
                ? `Mentors complete Post only. Courses follow their organisation programme (${orgCourseTitles.join(', ')}).`
                : 'Mentors complete Post ratings only - after the learner finishes the course.'
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
                  raterRole="mentor"
                  learners={assessmentLearners}
                  forcedKind="post"
                  allowedCourseTitles={menteeOrgId ? orgCourseTitles : null}
                />
              </Box>
            ) : (
              <Box p={6} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                <Text fontSize="sm" color="gray.600">
                  Assign mentees first. Post assessments appear here for each learner on your roster.
                </Text>
              </Box>
            )}
          </SectionShell>
        ) : null}
      </Box>
    </MentorDashboardLayout>
  )
}

export default MentorDashboard
