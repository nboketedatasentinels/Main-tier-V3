import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Avatar,
  Badge,
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
  Tag,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import {
  CalendarClock,
  ClipboardCheck,
  Lightbulb,
  Search,
  Sparkles,
  Users,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { MentorDashboardLayout } from '@/layouts/MentorDashboardLayout'
import { MentorSessionsPanel } from '@/components/mentor/MentorSessionsPanel'
import { RateLearnerCourseAssessment } from '@/components/assessments/RateLearnerCourseAssessment'
import { useAuth } from '@/hooks/useAuth'
import { fetchAssignedMenteesForMentor } from '@/services/learnerAssignmentService'
import {
  buildAiInference,
  buildMentoringSessionPlan,
  buildStrengthsWeaknessesWriteUp,
  mentoringTipsLibrary,
} from '@/services/mentorCoachingInsights'
import { PERSONALITY_TYPES } from '@/config/personality-data'
import { ageRangeLabel } from '@/config/demographics'
import { getDisplayName } from '@/utils/displayName'
import { getJourneyLabel, isJourneyType } from '@/utils/journeyType'
import { buildMentorNavItems } from '@/utils/navigationItems'
import type { UserProfile } from '@/types'

type SectionKey = 'overview' | 'mentees' | 'schedule' | 'assessments'

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

const MenteeProfilePanel: React.FC<{ mentee: UserProfile }> = ({ mentee }) => {
  const name = getDisplayName(mentee)
  const insightInput = {
    name,
    personalityType: mentee.personalityType,
    coreValues: mentee.coreValues,
    ageRange: ageRangeLabel(mentee.ageRange) || mentee.ageRange,
    journeyType: typeof mentee.journeyType === 'string' ? mentee.journeyType : null,
    currentWeek: mentee.currentWeek ?? null,
    courseTitles: [],
  }
  const writeUp = buildStrengthsWeaknessesWriteUp(insightInput)
  const ai = buildAiInference(insightInput)
  const plan = buildMentoringSessionPlan(insightInput)
  const journey =
    mentee.journeyType && isJourneyType(mentee.journeyType)
      ? getJourneyLabel(mentee.journeyType)
      : mentee.journeyType || 'Journey'

  return (
    <Box
      borderRadius="xl"
      overflow="hidden"
      border="1px solid"
      borderColor="gray.200"
      bg="white"
    >
      <Box
        px={{ base: 5, md: 6 }}
        py={5}
        bg="white"
        borderBottom="1px solid"
        borderColor="gray.100"
      >
        <Flex gap={4} align="center" flexWrap="wrap">
          <Avatar name={name} size="lg" bg="gray.100" color="gray.700" />
          <Box flex="1" minW="200px">
            <Text fontSize="xl" fontWeight="700" letterSpacing="-0.02em" color="gray.900">
              {name}
            </Text>
            <Text fontSize="sm" color="gray.500">
              {mentee.email}
            </Text>
            <HStack mt={3} spacing={2} flexWrap="wrap">
              <Badge bg="gray.100" color="gray.700" borderRadius="md" px={2.5} py={0.5} fontWeight="medium">
                {journey}
              </Badge>
              {mentee.currentWeek ? (
                <Badge bg="gray.100" color="gray.700" borderRadius="md" px={2.5} py={0.5} fontWeight="medium">
                  Week {mentee.currentWeek}
                </Badge>
              ) : null}
              {ageRangeLabel(mentee.ageRange) || mentee.ageRange ? (
                <Badge bg="gray.100" color="gray.700" borderRadius="md" px={2.5} py={0.5} fontWeight="medium">
                  {ageRangeLabel(mentee.ageRange) || mentee.ageRange}
                </Badge>
              ) : null}
              {personalityLabel(mentee.personalityType) ? (
                <Badge
                  bg="#350e6f"
                  color="white"
                  borderRadius="md"
                  px={2.5}
                  py={0.5}
                  fontWeight="medium"
                >
                  {personalityLabel(mentee.personalityType)}
                </Badge>
              ) : null}
            </HStack>
          </Box>
        </Flex>
      </Box>

      <Stack spacing={6} p={{ base: 5, md: 6 }}>
        <Box>
          <Text fontSize="xs" fontWeight="semibold" color="gray.500" letterSpacing="0.08em" textTransform="uppercase">
            Core values
          </Text>
          {mentee.coreValues?.length ? (
            <Wrap mt={2} spacing={2}>
              {mentee.coreValues.map((value) => (
                <WrapItem key={value}>
                  <Tag borderRadius="md" bg="gray.50" color="gray.800" border="1px solid" borderColor="gray.200" px={3} py={1}>
                    {value}
                  </Tag>
                </WrapItem>
              ))}
            </Wrap>
          ) : (
            <Text mt={2} fontSize="sm" color="gray.500">
              Values not captured yet — ask them to complete the Personal Values activity.
            </Text>
          )}
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <Box p={4} borderRadius="lg" bg="gray.50" border="1px solid" borderColor="gray.100">
            <Text fontWeight="600" color="gray.900" mb={2} fontSize="sm">
              Strengths
            </Text>
            <Stack spacing={1}>
              {writeUp.strengths.map((s) => (
                <Text key={s} fontSize="sm" color="gray.700">
                  · {s}
                </Text>
              ))}
            </Stack>
          </Box>
          <Box p={4} borderRadius="lg" bg="gray.50" border="1px solid" borderColor="gray.100">
            <Text fontWeight="600" color="gray.900" mb={2} fontSize="sm">
              Growth edges
            </Text>
            <Stack spacing={1}>
              {writeUp.growthEdges.map((s) => (
                <Text key={s} fontSize="sm" color="gray.700">
                  · {s}
                </Text>
              ))}
            </Stack>
          </Box>
        </SimpleGrid>
        <Text fontSize="sm" color="gray.600" lineHeight="1.65">
          {writeUp.summary}
        </Text>

        <Box
          p={4}
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.200"
          bg="white"
        >
          <HStack mb={2} spacing={2}>
            <Icon as={Sparkles} color="gray.600" boxSize={4} />
            <Badge colorScheme="gray" borderRadius="md" variant="subtle">
              {ai.label}
            </Badge>
          </HStack>
          <Stack spacing={2}>
            {ai.lines.map((line) => (
              <Text key={line} fontSize="sm" color="gray.800" lineHeight="1.6">
                {line}
              </Text>
            ))}
          </Stack>
          <Text mt={3} fontSize="xs" color="gray.500">
            {ai.disclaimer}
          </Text>
        </Box>

        <Box>
          <HStack mb={3} spacing={2}>
            <Icon as={Lightbulb} color="gray.600" boxSize={4} />
            <Text fontWeight="600" color="gray.900" fontSize="sm">
              Suggested session plan · {plan.recommendedSessionCount} meetings on {plan.journeyLabel}
            </Text>
          </HStack>
          <SimpleGrid columns={{ base: 1, md: plan.sessions.length > 3 ? 2 : plan.sessions.length }} spacing={3}>
            {plan.sessions.map((session) => (
              <Box
                key={session.index}
                p={4}
                borderRadius="lg"
                border="1px solid"
                borderColor="gray.200"
                bg="white"
              >
                <Text fontSize="xs" fontWeight="semibold" color="gray.500" letterSpacing="0.06em">
                  SESSION {session.index}
                </Text>
                <Text fontWeight="600" color="gray.900" mt={1}>
                  {session.title}
                </Text>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  {session.focus}
                </Text>
                <Stack mt={3} spacing={1}>
                  {session.suggestedTopics.map((topic) => (
                    <Text key={topic} fontSize="xs" color="gray.700">
                      · {topic}
                    </Text>
                  ))}
                </Stack>
                <Text mt={3} fontSize="xs" color="gray.500" fontWeight="medium">
                  Tip: {session.tip}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </Stack>
    </Box>
  )
}

export const MentorDashboard: React.FC = () => {
  const { profile } = useAuth()
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

  const scrollTo = (key: SectionKey) => {
    setActiveSection(key)
    const el = document.getElementById(`mentor-${key}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const assessmentLearners = useMemo(
    () =>
      mentees.map((m) => ({
        id: m.id,
        name: getDisplayName(m),
        currentWeek: m.currentWeek,
        journeyType: typeof m.journeyType === 'string' ? m.journeyType : undefined,
        journeyStatus: typeof m.journeyStatus === 'string' ? m.journeyStatus : undefined,
      })),
    [mentees],
  )

  return (
    <MentorDashboardLayout
      activeItem={activeSection}
      onNavigate={(key) => scrollTo(key as SectionKey)}
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
                Partner-grade view of who you mentor — values, personality, meeting flow, coaching tips,
                and end-of-course post assessments. Learners only ever see their own side.
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
                  onClick={() => scrollTo('schedule')}
                >
                  Meeting schedule
                </Button>
              </HStack>
            </Box>
            <SimpleGrid columns={1} spacing={3} minW={{ base: '100%', md: '220px' }}>
              {[
                { label: 'Mentees', value: mentees.length, icon: Users },
                { label: 'Post assessments', value: 'End of course', icon: ClipboardCheck },
              ].map((stat) => (
                <Box
                  key={stat.label}
                  bg="gray.50"
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="lg"
                  px={4}
                  py={3}
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
            subtitle="Only learners assigned to you. Open a profile for values, personality, strengths/growth edges, and AI coaching notes."
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
                  No mentees assigned yet. When a partner or admin sets you as a learner&apos;s mentor,
                  they appear here.
                </Text>
              </Box>
            ) : (
              <Grid templateColumns={{ base: '1fr', lg: '280px 1fr' }} gap={5}>
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
                {selected ? <MenteeProfilePanel mentee={selected} /> : null}
              </Grid>
            )}
          </SectionShell>

          <SectionShell
            id="mentor-schedule"
            eyebrow="Meetings"
            title="Meeting schedule"
            subtitle="Learner requests appear here. Accept to confirm, then mark attendance complete to issue mentor meetup points when the learner has a mentor assigned."
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
            subtitle="When a mentee finishes a course, complete the mentor Post rating about them. Pre is not required for mentors."
          >
            {profile?.id && assessmentLearners.length > 0 ? (
              <Box bg="white" borderRadius="xl" border="1px solid" borderColor="gray.200" p={{ base: 4, md: 6 }}>
                <RateLearnerCourseAssessment
                  respondentId={profile.id}
                  raterRole="mentor"
                  learners={assessmentLearners}
                  forcedKind="post"
                />
              </Box>
            ) : (
              <Box p={6} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.200">
                <Text fontSize="sm" color="gray.600">
                  Assign mentees first — post assessments appear here for each learner on your roster.
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
