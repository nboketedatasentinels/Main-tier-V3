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
  CalendarClock,
  ClipboardCheck,
  Lightbulb,
  Search,
  Users,
  ArrowRight,
  RefreshCw,
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
import { PERSONALITY_TYPES } from '@/config/personality-data'
import { getDisplayName } from '@/utils/displayName'
import { buildMentorNavItems } from '@/utils/navigationItems'
import {
  resolveMentorNavDestination,
  type MentorDashboardSection,
} from '@/utils/mentorNavigation'
import type { UserProfile } from '@/types'

type SectionKey = MentorDashboardSection

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

export const MentorDashboard: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeSection, setActiveSection] = useState<SectionKey>('overview')
  const [mentees, setMentees] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
    const el = document.getElementById(`mentor-${key}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const section = (location.state as { mentorSection?: SectionKey } | null)?.mentorSection
    if (!section) return
    const timer = window.setTimeout(() => scrollTo(section), 80)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const handleNavigate = (key: string) => {
    const dest = resolveMentorNavDestination(key)
    if (dest.kind === 'route') {
      navigate(dest.path)
      return
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
    >
      <Box minH="100%" bg="white" mx={{ base: -4, md: -6 }} px={{ base: 4, md: 6 }} py={6}>
        {/* Header */}
        <Box
          id="mentor-overview"
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
                Partner-grade view of who you mentor: values, personality, meeting flow, coaching tips,
                and pre/post course assessments for your organisation&apos;s programme. Learners only
                ever see their own side.
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
                <PreCourseSurveyButton
                  kind="post"
                  label="Post-course assessments"
                  onClick={() => scrollTo('assessments')}
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
                  Meeting schedule
                </Button>
              </HStack>
            </Box>
            <SimpleGrid columns={1} spacing={3} minW={{ base: '100%', md: '260px' }} maxW={{ md: '280px' }}>
              {(
                [
                  {
                    label: 'Mentees',
                    value: mentees.length,
                    icon: Users,
                    section: 'mentees' as SectionKey,
                  },
                  {
                    label: 'Post assessments',
                    value: 'End of course',
                    icon: ClipboardCheck,
                    section: 'assessments' as SectionKey,
                  },
                ] as const
              ).map((stat) => (
                <Box
                  key={stat.label}
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
                  onClick={() => scrollTo(stat.section)}
                >
                  <HStack spacing={3}>
                    <Icon as={stat.icon} color="gray.600" />
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        {stat.label}
                      </Text>
                      <Text fontWeight="700" fontSize="lg" color="gray.900">
                        {stat.value}
                      </Text>
                    </Box>
                  </HStack>
                </Box>
              ))}
              <LearnerPointsRanking
                learners={mentees}
                selectedId={selected?.id}
                onSelect={(id) => {
                  setSelectedId(id)
                  setActiveSection('mentees')
                  scrollTo('mentees')
                }}
                title="Points ranking"
                sticky={false}
              />
            </SimpleGrid>
          </Flex>
        </Box>

        <Stack spacing={10}>
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

          <SectionShell
            id="mentor-mentees"
            eyebrow="Directory"
            title="Who you mentor"
            subtitle="Only learners in your organisation (and explicit mentor assignments). Open a profile for Session Prep."
            action={
              <Button
                leftIcon={<RefreshCw size={14} />}
                size="sm"
                variant="outline"
                borderColor="gray.300"
                onClick={() => void loadMentees()}
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
                placeholder="Search mentees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                bg="white"
                borderColor="gray.200"
                borderRadius="md"
              />
            </InputGroup>

            {loading ? (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Skeleton height="180px" borderRadius="xl" />
                <Skeleton height="180px" borderRadius="xl" />
              </SimpleGrid>
            ) : filtered.length === 0 ? (
              <Box p={8} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                <Text color="gray.600" fontSize="sm">
                  No mentees assigned yet. Learners in your organisation appear here automatically
                  once you are linked to that organisation. Explicit mentor assignments also show
                  up here.
                </Text>
              </Box>
            ) : (
              <Grid
                templateColumns={{ base: '1fr', lg: '280px 1fr' }}
                gap={5}
                alignItems="start"
              >
                <Stack spacing={2}>
                  {filtered.map((m) => {
                    const active = selected?.id === m.id
                    return (
                      <Button
                        key={m.id}
                        onClick={() => {
                          setSelectedId(m.id)
                          setActiveSection('mentees')
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
                          <Avatar name={getDisplayName(m)} size="sm" bg="gray.100" color="gray.700" />
                          <Box minW={0}>
                            <Text fontWeight="600" fontSize="sm" noOfLines={1} color="gray.900">
                              {getDisplayName(m)}
                            </Text>
                            <Text fontSize="xs" color="gray.500" noOfLines={1}>
                              {personalityLabel(m.personalityType) || 'Personality pending'}
                            </Text>
                          </Box>
                        </HStack>
                      </Button>
                    )
                  })}
                </Stack>
                {selected ? (
                  <Stack spacing={5} minW={0}>
                    <MentorLearnerPanel learner={selected} mentorId={profile?.id} />
                    <LearnerSessionPrep audience="mentor" learner={selected} windowStatus="warning" />
                  </Stack>
                ) : (
                  <Box p={6} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                    <Text fontSize="sm" color="gray.600">
                      Select a mentee to open their profile.
                    </Text>
                  </Box>
                )}
              </Grid>
            )}
          </SectionShell>

          <SectionShell
            id="mentor-schedule"
            eyebrow="Meetings"
            title="Meeting schedule"
            subtitle="Learner requests appear here. Accept to confirm, then mark attendance complete to issue +2,000 mentor meetup points - only if they attended."
          >
            {profile?.id ? (
              <MentorSessionsPanel mentorId={profile.id} pointsIssuanceEnabled />
            ) : (
              <Skeleton height="200px" borderRadius="xl" />
            )}
          </SectionShell>

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
              <Box bg="white" borderRadius="xl" border="1px solid" borderColor="gray.200" p={{ base: 4, md: 6 }}>
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
        </Stack>
      </Box>
    </MentorDashboardLayout>
  )
}

export default MentorDashboard
