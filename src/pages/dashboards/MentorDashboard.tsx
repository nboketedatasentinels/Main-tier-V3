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
          fontWeight="bold"
          letterSpacing="0.14em"
          textTransform="uppercase"
          color="#c9a227"
        >
          {eyebrow}
        </Text>
        <Text mt={1} fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="#27062e" letterSpacing="-0.03em">
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
      borderRadius="2xl"
      overflow="hidden"
      border="1px solid"
      borderColor="blackAlpha.100"
      bg="white"
      boxShadow="0 18px 50px rgba(39,6,46,0.08)"
    >
      <Box
        px={{ base: 5, md: 7 }}
        py={6}
        bg="linear-gradient(120deg, #27062e 0%, #350e6f 55%, #4a187f 100%)"
        color="white"
        position="relative"
      >
        <Box
          position="absolute"
          inset={0}
          opacity={0.35}
          backgroundImage="radial-gradient(circle at 85% 20%, rgba(249,219,89,0.35), transparent 40%)"
          pointerEvents="none"
        />
        <Flex gap={4} align="center" position="relative" flexWrap="wrap">
          <Avatar name={name} size="lg" bg="#eab130" color="#27062e" />
          <Box flex="1" minW="200px">
            <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.02em">
              {name}
            </Text>
            <Text fontSize="sm" opacity={0.85}>
              {mentee.email}
            </Text>
            <HStack mt={3} spacing={2} flexWrap="wrap">
              <Badge bg="whiteAlpha.200" color="white" borderRadius="full" px={3} py={1}>
                {journey}
              </Badge>
              {mentee.currentWeek ? (
                <Badge bg="whiteAlpha.200" color="white" borderRadius="full" px={3} py={1}>
                  Week {mentee.currentWeek}
                </Badge>
              ) : null}
              {ageRangeLabel(mentee.ageRange) || mentee.ageRange ? (
                <Badge bg="whiteAlpha.200" color="white" borderRadius="full" px={3} py={1}>
                  {ageRangeLabel(mentee.ageRange) || mentee.ageRange}
                </Badge>
              ) : null}
              {personalityLabel(mentee.personalityType) ? (
                <Badge bg="#eab130" color="#27062e" borderRadius="full" px={3} py={1}>
                  {personalityLabel(mentee.personalityType)}
                </Badge>
              ) : null}
            </HStack>
          </Box>
        </Flex>
      </Box>

      <Stack spacing={6} p={{ base: 5, md: 7 }}>
        <Box>
          <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em" textTransform="uppercase">
            Core values
          </Text>
          {mentee.coreValues?.length ? (
            <Wrap mt={2} spacing={2}>
              {mentee.coreValues.map((value) => (
                <WrapItem key={value}>
                  <Tag borderRadius="full" bg="#f3eef8" color="#350e6f" px={3} py={1}>
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
          <Box p={4} borderRadius="xl" bg="#f8fafc" border="1px solid" borderColor="gray.100">
            <Text fontWeight="700" color="#27062e" mb={2}>
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
          <Box p={4} borderRadius="xl" bg="#fff7ed" border="1px solid" borderColor="orange.100">
            <Text fontWeight="700" color="#9a3412" mb={2}>
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
          borderRadius="xl"
          border="1px solid"
          borderColor="#e9d5ff"
          bg="linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)"
        >
          <HStack mb={2} spacing={2}>
            <Icon as={Sparkles} color="#7c3aed" boxSize={4} />
            <Badge colorScheme="purple" borderRadius="full">
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
            <Icon as={Lightbulb} color="#c2410c" boxSize={4} />
            <Text fontWeight="700" color="#27062e">
              Suggested session plan · {plan.recommendedSessionCount} meetings on {plan.journeyLabel}
            </Text>
          </HStack>
          <SimpleGrid columns={{ base: 1, md: plan.sessions.length > 3 ? 2 : plan.sessions.length }} spacing={3}>
            {plan.sessions.map((session) => (
              <Box
                key={session.index}
                p={4}
                borderRadius="xl"
                border="1px solid"
                borderColor="gray.100"
                bg="white"
              >
                <Text fontSize="xs" fontWeight="bold" color="#350e6f" letterSpacing="0.06em">
                  SESSION {session.index}
                </Text>
                <Text fontWeight="700" color="#27062e" mt={1}>
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
                <Text mt={3} fontSize="xs" color="#9a3412" fontWeight="medium">
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
      <Box
        minH="100%"
        bg="linear-gradient(180deg, #f7f4fb 0%, #f3f6fb 40%, #ffffff 100%)"
        mx={{ base: -4, md: -6 }}
        px={{ base: 4, md: 6 }}
        py={6}
      >
        {/* Hero */}
        <Box
          id="mentor-overview"
          mb={10}
          borderRadius="3xl"
          overflow="hidden"
          position="relative"
          bg="#27062e"
          color="white"
          px={{ base: 6, md: 10 }}
          py={{ base: 8, md: 10 }}
          boxShadow="0 30px 80px rgba(39,6,46,0.28)"
        >
          <Box
            position="absolute"
            inset={0}
            opacity={0.5}
            backgroundImage="radial-gradient(circle at 12% 20%, rgba(234,177,48,0.35), transparent 32%), radial-gradient(circle at 90% 10%, rgba(244,84,12,0.22), transparent 28%), linear-gradient(120deg, transparent 40%, rgba(53,14,111,0.9) 100%)"
            pointerEvents="none"
          />
          <Flex position="relative" justify="space-between" align="flex-start" gap={6} flexWrap="wrap">
            <Box maxW="640px">
              <Text fontSize="xs" fontWeight="bold" letterSpacing="0.16em" color="#f9db59">
                MENTOR WORKSPACE
              </Text>
              <Text
                mt={2}
                fontSize={{ base: '3xl', md: '4xl' }}
                fontWeight="900"
                letterSpacing="-0.04em"
                lineHeight="1.05"
              >
                Guide your mentees with clarity.
              </Text>
              <Text mt={3} color="whiteAlpha.850" fontSize="md" lineHeight="1.7">
                Partner-grade view of who you mentor — values, personality, meeting flow, coaching tips,
                and end-of-course post assessments. Learners only ever see their own side.
              </Text>
              <HStack mt={6} spacing={3} flexWrap="wrap">
                <Button
                  rightIcon={<ArrowRight size={16} />}
                  bg="#eab130"
                  color="#27062e"
                  _hover={{ bg: '#f9db59' }}
                  borderRadius="full"
                  onClick={() => scrollTo('mentees')}
                >
                  Open mentees
                </Button>
                <Button
                  variant="outline"
                  borderColor="whiteAlpha.400"
                  color="white"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  borderRadius="full"
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
                  bg="whiteAlpha.100"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="2xl"
                  px={4}
                  py={3}
                  backdropFilter="blur(8px)"
                >
                  <HStack spacing={3}>
                    <Icon as={stat.icon} color="#f9db59" />
                    <Box>
                      <Text fontSize="xs" color="whiteAlpha.700">
                        {stat.label}
                      </Text>
                      <Text fontWeight="800" fontSize="lg">
                        {stat.value}
                      </Text>
                    </Box>
                  </HStack>
                </Box>
              ))}
            </SimpleGrid>
          </Flex>
        </Box>

        <Stack spacing={12}>
          <Box
            p={5}
            borderRadius="2xl"
            bg="white"
            border="1px solid"
            borderColor="purple.100"
            boxShadow="sm"
          >
            <HStack spacing={2} mb={2}>
              <Icon as={Lightbulb} color="#f4540c" />
              <Text fontWeight="700" color="#27062e">
                Mentoring tip
              </Text>
            </HStack>
            <Text fontSize="sm" color="gray.700" lineHeight="1.65">
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
                borderRadius="xl"
              />
            </InputGroup>

            {loading ? (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Skeleton height="180px" borderRadius="2xl" />
                <Skeleton height="180px" borderRadius="2xl" />
              </SimpleGrid>
            ) : filtered.length === 0 ? (
              <Box p={8} bg="white" borderRadius="2xl" border="1px dashed" borderColor="gray.200">
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
                        borderRadius="xl"
                        bg={active ? '#350e6f' : 'white'}
                        color={active ? 'white' : 'gray.800'}
                        border="1px solid"
                        borderColor={active ? '#350e6f' : 'gray.100'}
                        _hover={{ bg: active ? '#27062e' : 'gray.50' }}
                        textAlign="left"
                      >
                        <HStack spacing={3} align="center" w="full">
                          <Avatar name={getDisplayName(m)} size="sm" />
                          <Box minW={0}>
                            <Text fontWeight="700" fontSize="sm" noOfLines={1}>
                              {getDisplayName(m)}
                            </Text>
                            <Text fontSize="xs" opacity={0.8} noOfLines={1}>
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
              <Box bg="white" borderRadius="2xl" border="1px solid" borderColor="gray.100" p={{ base: 4, md: 6 }}>
                <RateLearnerCourseAssessment
                  respondentId={profile.id}
                  raterRole="mentor"
                  learners={assessmentLearners}
                  forcedKind="post"
                />
              </Box>
            ) : (
              <Box p={6} bg="white" borderRadius="2xl" border="1px dashed" borderColor="gray.200">
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
