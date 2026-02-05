import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Heading,
  Text,
  Stack,
  SimpleGrid,
  Spinner,
  Badge,
  Button,
  Flex,
  Icon,
  Progress,
  HStack,
  VStack,
  Divider,
  Tooltip,
} from '@chakra-ui/react'
import { BookOpen, Clock, ExternalLink, Sparkles, ArrowUpRight, CheckCircle2, CalendarDays, Lock } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'
import { addDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import { useUserCourseProgress } from '@/hooks/useUserCourseProgress'
import { getCourseDocument, getCourseDocuments } from '@/services/courseService'
import { canAccessCourse, isFreeUser } from '@/utils/membership'
import {
  COURSE_DETAILS_MAPPING,
  COURSE_METADATA_MAPPING,
  type CourseDifficulty,
} from '@/utils/courseMappings'
import {
  formatMonthRange,
  getMonthlyAssignmentsArray,
  getMonthAvailabilityStatus,
  getMonthDateRange,
} from '@/utils/monthlyCourseAssignments'
import {
  getJourneyLabel,
  getJourneyTimelineDisplayMode,
  getJourneyWeeks,
  isMonthBasedJourney,
} from '@/utils/journeyType'
import type { UserProfile } from '@/types'

interface NormalizedCourse {
  id: string
  title: string
  description: string
  link?: string
  progress?: number
  status?: string
  estimatedMinutes?: number
  difficulty?: CourseDifficulty
  image?: string
}

const COMPLEMENTARY_COURSE_ID = 'transformational-leadership'

const COURSE_IMAGE_FILENAMES: Record<string, string> = {
  'AI Stacking 101': 'course-ai-stacking-101.avif',
  'The Art of Connection': 'course-art-of-connection.avif',
  'Mindset Reset': 'course-mindset-reset.avif',
  'Goal Setting Mastery': 'course-goal-setting-mastery.avif',
  'The Heart of Leadership': 'course-heart-of-leadership.avif',
  'Digital Transformation and Data': 'course-digital-transformation.avif',
  'LinkedIn Warrior': 'course-linkedin-warrior.avif',
  'Transformational Leadership': 'course-transformational-leadership.avif',
}

const formatDuration = (minutes?: number) => {
  if (!minutes || Number.isNaN(minutes)) return null
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining ? `${hours} hrs ${remaining} min` : `${hours} hrs`
}

const formatStatus = (status?: string) => {
  if (!status) return undefined
  return status
    .split(/_|\s/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const getWeekDateRange = (cohortStartDate: Date, weekIndex: number, weeksPerBlock: number = 1) => {
  const startDate = addDays(cohortStartDate, weekIndex * 7)
  const endDate = addDays(startDate, weeksPerBlock * 7)
  return { startDate, endDate }
}

const formatWeekRange = (startDate: Date, endDate: Date) => {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const endDisplay = new Date(endDate)
  endDisplay.setDate(endDisplay.getDate() - 1)
  return `${formatter.format(startDate)} – ${formatter.format(endDisplay)}`
}

const getWeekAvailabilityStatus = (params: {
  cohortStartDate: Date | null
  currentDate: Date
  weekIndex: number
  weeksPerBlock?: number
}) => {
  const { cohortStartDate, currentDate, weekIndex, weeksPerBlock = 1 } = params
  if (!cohortStartDate) {
    return weekIndex === 0 ? 'current' : 'locked'
  }

  const { startDate, endDate } = getWeekDateRange(cohortStartDate, weekIndex, weeksPerBlock)
  if (currentDate < startDate) return 'locked'
  if (currentDate >= endDate) return 'completed'
  return 'current'
}

const badgeColor = (difficulty?: CourseDifficulty) => {
  switch (difficulty) {
    case 'Beginner':
      return 'green'
    case 'Intermediate':
      return 'orange'
    case 'Advanced':
      return 'red'
    default:
      return 'gray'
  }
}

const buildCourseFromDoc = (courseId: string, data: Record<string, unknown>): NormalizedCourse => {
  const title = (data.title || data.name || data.courseTitle || 'Untitled Course') as string
  const details = COURSE_DETAILS_MAPPING[title]
  const metadata = COURSE_METADATA_MAPPING[title]

  return {
    id: courseId,
    title,
    description: (details?.description || data.description || 'Description not available.') as string,
    link: (details?.link || data.link) as string | undefined,
    status: formatStatus(data.status as string | undefined),
    estimatedMinutes: metadata?.estimatedMinutes,
    difficulty: metadata?.difficulty,
    image: COURSE_IMAGE_FILENAMES[title],
  }
}

const buildCourseFromMapping = (courseId: string): NormalizedCourse | null => {
  const entry = Object.entries(COURSE_DETAILS_MAPPING).find(([, details]) => details.slug === courseId)
  if (!entry) return null

  const [title, details] = entry
  const metadata = COURSE_METADATA_MAPPING[title]

  return {
    id: courseId,
    title,
    description: details.description,
    link: details.link,
    estimatedMinutes: metadata?.estimatedMinutes,
    difficulty: metadata?.difficulty,
    image: COURSE_IMAGE_FILENAMES[title],
  }
}

const FreeTierCoursesPage: React.FC<{ userId?: string | null; profile: UserProfile | null }> = ({
  userId,
  profile,
}) => {
  const { progressMap, loading: progressLoading } = useUserCourseProgress(userId)
  const [course, setCourse] = useState<NormalizedCourse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const fetchCourse = async () => {
      try {
        setLoading(true)
        setError(null)
        const courseSnap = await getCourseDocument(COMPLEMENTARY_COURSE_ID)
        if (!courseSnap.exists()) {
          const fallbackCourse = buildCourseFromMapping(COMPLEMENTARY_COURSE_ID)
          if (isActive) {
            setCourse(fallbackCourse)
            setError(fallbackCourse ? null : 'The complementary course could not be found.')
          }
          return
        }
        if (isActive) {
          setCourse(buildCourseFromDoc(courseSnap.id, courseSnap.data()))
        }
      } catch (fetchError) {
        console.error('Error loading free tier course', fetchError)
        const fallbackCourse = buildCourseFromMapping(COMPLEMENTARY_COURSE_ID)
        if (isActive) {
          setCourse(fallbackCourse)
          setError(fallbackCourse ? null : 'Unable to load the complementary course right now.')
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    fetchCourse()

    return () => {
      isActive = false
    }
  }, [])

  const courseWithProgress = useMemo(() => {
    if (!course) return null
    return {
      ...course,
      progress: progressMap.get(course.id) ?? progressMap.get(course.title.trim().toLowerCase()),
    }
  }, [course, progressMap])

  const headerDescription =
    'Transformational Leadership is a complementary course available to every member. Upgrade anytime to unlock the full learning library while keeping access to this course.'

  return (
    <Stack spacing={8} py={2} as="section">
      <Box
        bgGradient="linear(to-r, purple.50, purple.100)"
        borderRadius="3xl"
        border="1px solid"
        borderColor="purple.100"
        p={{ base: 5, md: 8 }}
        boxShadow="md"
      >
        <Flex direction={{ base: 'column', md: 'row' }} align={{ base: 'flex-start', md: 'center' }} gap={4}>
          <Flex
            bg="white"
            borderRadius="full"
            p={3}
            border="1px solid"
            borderColor="purple.100"
            boxShadow="sm"
          >
            <Icon as={BookOpen} boxSize={7} color="purple.600" />
          </Flex>
          <Stack spacing={1} flex={1}>
            <Heading size="lg" color="purple.900">
              Continue your learning journey
            </Heading>
            <Text color="purple.700" fontSize="md">
              {headerDescription}
            </Text>
            <HStack spacing={3} flexWrap="wrap">
              <Badge colorScheme="orange" variant="subtle" borderRadius="full">
                Free tier experience
              </Badge>
              <Text color="orange.700" fontSize="sm">
                You are viewing the complementary course catalog.
              </Text>
              <Button
                as={RouterLink}
                to="/upgrade"
                size="sm"
                colorScheme="purple"
                rightIcon={<ArrowUpRight size={14} />}
                borderRadius="full"
              >
                Upgrade membership
              </Button>
            </HStack>
          </Stack>
        </Flex>
      </Box>

      <Stack spacing={4} as="section">
        <HStack justify="space-between" align="center">
          <Heading size="md" color="gray.800">
            Complementary course
          </Heading>
          <Badge colorScheme="purple" variant="subtle" borderRadius="full">
            1 course
          </Badge>
        </HStack>

        {(loading || progressLoading) && (
          <Flex align="center" justify="center" py={10} direction="column" gap={3}>
            <Spinner size="lg" color="purple.500" />
            <Text color="gray.600">Loading your course…</Text>
          </Flex>
        )}

        {!loading && !progressLoading && error && (
          <Flex
            direction="column"
            align="center"
            justify="center"
            py={12}
            border="1px solid"
            borderColor="gray.100"
            borderRadius="2xl"
            bg="white"
            gap={3}
          >
            <Icon as={BookOpen} boxSize={10} color="text.muted" />
            <Heading size="sm" color="gray.800">
              Course unavailable
            </Heading>
            <Text color="gray.500" textAlign="center" maxW="lg">
              {error}
            </Text>
          </Flex>
        )}

        {!loading && !progressLoading && !error && courseWithProgress && (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={6}>
            <Box
              as="article"
              borderRadius="3xl"
              overflow="hidden"
              border="1px solid"
              borderColor="gray.100"
              boxShadow="md"
            >
              <Box
                bgGradient="linear(to-r, purple.50, purple.100)"
                p={4}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <HStack spacing={3}>
                  <Badge colorScheme="purple" borderRadius="full" px={3} py={1} fontWeight="bold">
                    Complementary - Available to All
                  </Badge>
                  <Text fontWeight="semibold" color="purple.900">
                    {courseWithProgress.title}
                  </Text>
                </HStack>
                <HStack spacing={2} color="purple.700">
                  <Icon as={Sparkles} />
                  <Text fontSize="sm">Free access</Text>
                </HStack>
              </Box>

              <Stack spacing={0} divider={<Divider />} p={4} bg="white">
                <Box py={3}>
                  <HStack justify="space-between" align="start" spacing={3}>
                    <VStack align="start" spacing={1} flex={1}>
                      <Heading size="sm" color="gray.800">
                        {courseWithProgress.title}
                      </Heading>
                      <Text color="gray.600" fontSize="sm">
                        {courseWithProgress.description}
                      </Text>
                      <HStack spacing={3} flexWrap="wrap">
                        {courseWithProgress.difficulty && (
                          <Badge
                            colorScheme={badgeColor(courseWithProgress.difficulty)}
                            variant="outline"
                            borderRadius="full"
                          >
                            {courseWithProgress.difficulty}
                          </Badge>
                        )}
                        {courseWithProgress.estimatedMinutes && (
                          <HStack spacing={1} color="gray.500">
                            <Icon as={Clock} boxSize={4} />
                            <Text fontSize="xs">{formatDuration(courseWithProgress.estimatedMinutes)}</Text>
                          </HStack>
                        )}
                      </HStack>

                      {typeof courseWithProgress.progress === 'number' && (
                        <Box pt={1} width="full">
                          <Progress
                            value={courseWithProgress.progress}
                            size="sm"
                            colorScheme="purple"
                            borderRadius="full"
                            aria-hidden
                          />
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            {courseWithProgress.progress.toFixed(0)}% complete
                          </Text>
                        </Box>
                      )}
                    </VStack>

                    {courseWithProgress.link && (() => {
                      const hasAccess = canAccessCourse(profile, courseWithProgress.title, courseWithProgress.id)
                      const canOpen = hasAccess
                      return (
                        <Button
                          as={canOpen ? 'a' : (RouterLink as React.ElementType)}
                          href={canOpen ? courseWithProgress.link : undefined}
                          to={canOpen ? undefined : '/upgrade'}
                          target={canOpen ? '_blank' : undefined}
                          rel={canOpen ? 'noopener noreferrer' : undefined}
                          size="sm"
                          colorScheme="purple"
                          rightIcon={<ExternalLink size={16} />}
                          variant="solid"
                          borderRadius="full"
                          minW="120px"
                        >
                          {hasAccess ? 'Open course' : 'Upgrade to unlock'}
                        </Button>
                      )
                    })()}
                  </HStack>
                </Box>
              </Stack>
            </Box>
          </SimpleGrid>
        )}
      </Stack>
    </Stack>
  )
}

const OrganizationCoursesPage: React.FC<{ userId?: string | null; profile: UserProfile | null }> = ({
  userId,
  profile,
}) => {
  const organizationId = useMemo(() => {
    if (!profile) return null
    const orgId = (profile as { organizationId?: string | null }).organizationId
    if (orgId) return orgId
    if (profile.companyId) return profile.companyId
    if (profile.assignedOrganizations?.length === 1) {
      return profile.assignedOrganizations[0]
    }
    return null
  }, [profile])

  const { program, loading: programLoading } = useOrganizationProgramCourses(organizationId)
  const { loading: progressLoading } = useUserCourseProgress(userId)

  const [courseMap, setCourseMap] = useState<Record<string, NormalizedCourse>>({})
  const [loadingCourses, setLoadingCourses] = useState(true)

  useEffect(() => {
    let isActive = true

    const loadCourses = async () => {
      if (!organizationId || !program || !program.orderedCourseIds.length) {
        if (isActive) {
          setCourseMap({})
          setLoadingCourses(false)
        }
        return
      }

      try {
        setLoadingCourses(true)
        const orderedCourseIds = program.orderedCourseIds
        const snapshots = await getCourseDocuments(orderedCourseIds)

        const nextCourses: NormalizedCourse[] = []
        const nextCourseMap: Record<string, NormalizedCourse> = {}
        snapshots.forEach(snap => {
          if (!snap.exists()) {
            return
          }

          const baseCourse = buildCourseFromDoc(snap.id, snap.data())
          nextCourses.push(baseCourse)
          nextCourseMap[baseCourse.id] = baseCourse
        })

        if (isActive) {
          setCourseMap(nextCourseMap)
        }
      } catch (loadError) {
        console.error('Error loading organization courses', loadError)
        if (isActive) {
          setCourseMap({})
        }
      } finally {
        if (isActive) {
          setLoadingCourses(false)
        }
      }
    }

    loadCourses()

    return () => {
      isActive = false
    }
  }, [organizationId, program])

  const journeyType = program?.journeyType ?? null
  const journeyLabel = journeyType ? getJourneyLabel(journeyType) : null
  const isWeeklyTimeline = journeyType ? !isMonthBasedJourney(journeyType) : false
  const totalWeeks = program?.programDurationWeeks ?? (journeyType ? getJourneyWeeks(journeyType) : null)
  const journeyTimelineDisplay = journeyType ? getJourneyTimelineDisplayMode(journeyType) : 'duration'
  const fallbackAssignments = useMemo(() => {
    if (!program) return []
    return getMonthlyAssignmentsArray(program.monthlyAssignments, program.totalMonths)
  }, [program])
  const assignmentList = useMemo(() => {
    if (!program) return []
    return program.courseAssignments.length ? program.courseAssignments : fallbackAssignments
  }, [program, fallbackAssignments])
  const assignedCourseIds = useMemo(() => assignmentList.filter(Boolean), [assignmentList])
  const assignedCourseCount = useMemo(() => assignedCourseIds.length, [assignedCourseIds])

  const monthlyProgramTimeline = useMemo(() => {
    if (!program || !program.totalMonths) return []
    const now = new Date()
    return Array.from({ length: program.totalMonths }, (_, index) => {
      const courseId = program.monthlyAssignments[String(index + 1)] || ''
      const course = courseId ? courseMap[courseId] : undefined
      const availability = getMonthAvailabilityStatus({
        cohortStartDate: program.cohortStartDate,
        currentDate: now,
        monthIndex: index,
      })
      const monthRange = program.cohortStartDate ? getMonthDateRange(program.cohortStartDate, index) : null
      const dateRange = monthRange ? formatMonthRange(monthRange.startDate, monthRange.endDate) : undefined
      const unlockDate = monthRange ? monthRange.startDate : null
      return {
        monthNumber: index + 1,
        courseId,
        course,
        availability,
        dateRange,
        unlockDate,
      }
    })
  }, [program, courseMap])

  const weeklyProgramTimeline = useMemo(() => {
    if (!program) return []
    const now = new Date()
    const durationWeeks = totalWeeks ?? assignedCourseIds.length
    const displayAssignments =
      journeyTimelineDisplay === 'course-count'
        ? assignedCourseIds
        : Array.from({ length: durationWeeks }, (_, index) => assignmentList[index] || '')

    if (!displayAssignments.length) return []

    const is6W = journeyType === '6W'
    const weeksPerBlock = is6W ? 2 : 1

    return displayAssignments.map((courseId, index) => {
      const course = courseId ? courseMap[courseId] : undefined
      const startWeekIndex = index * weeksPerBlock

      const availability = getWeekAvailabilityStatus({
        cohortStartDate: program.cohortStartDate,
        currentDate: now,
        weekIndex: startWeekIndex,
        weeksPerBlock,
      })

      const weekRange = program.cohortStartDate
        ? getWeekDateRange(program.cohortStartDate, startWeekIndex, weeksPerBlock)
        : null
      const dateRange = weekRange ? formatWeekRange(weekRange.startDate, weekRange.endDate) : undefined
      const unlockDate = weekRange ? weekRange.startDate : null

      const displayLabel = is6W
        ? `Weeks ${startWeekIndex + 1}–${startWeekIndex + weeksPerBlock}`
        : undefined

      return {
        weekNumber: index + 1,
        displayLabel,
        courseId,
        course,
        availability,
        dateRange,
        unlockDate,
      }
    })
  }, [
    program,
    totalWeeks,
    assignmentList,
    assignedCourseIds,
    courseMap,
    journeyTimelineDisplay,
    journeyType,
  ])

  const timelineEntries = useMemo(() => {
    if (isWeeklyTimeline) {
      return weeklyProgramTimeline.map(entry => ({
        ...entry,
        periodNumber: entry.weekNumber,
        periodLabel: 'week' as const,
      }))
    }
    return monthlyProgramTimeline.map(entry => ({
      ...entry,
      periodNumber: entry.monthNumber,
      periodLabel: 'month' as const,
      displayLabel: undefined as string | undefined,
    }))
  }, [isWeeklyTimeline, monthlyProgramTimeline, weeklyProgramTimeline])

  const nextUnlockDate = useMemo(() => {
    const nextLocked = timelineEntries.find(entry => entry.availability === 'locked')
    return nextLocked?.unlockDate || null
  }, [timelineEntries])

  const timelineHeading = useMemo(() => {
    if (isWeeklyTimeline) {
      return journeyTimelineDisplay === 'course-count' ? 'Assigned course timeline' : 'Weekly program timeline'
    }
    return 'Monthly program timeline'
  }, [isWeeklyTimeline, journeyTimelineDisplay])
  const timelineCountLabel = useMemo(() => {
    if (!program) return ''
    if (isWeeklyTimeline) {
      if (journeyTimelineDisplay === 'course-count' && timelineEntries.length) {
        const suffix = timelineEntries.length === 1 ? 'course' : 'courses'
        return `${timelineEntries.length} ${suffix}`
      }
      return `${totalWeeks ?? timelineEntries.length} weeks`
    }
    return `${program.totalMonths ?? timelineEntries.length} months`
  }, [program, isWeeklyTimeline, journeyTimelineDisplay, timelineEntries.length, totalWeeks])
  const shouldShowJourneyLabel =
    journeyLabel &&
    !(isWeeklyTimeline && journeyTimelineDisplay === 'course-count' && assignedCourseCount && assignedCourseCount < (totalWeeks ?? 0))

  const overallLoading = programLoading || loadingCourses || progressLoading
  const cohortStartDate = program?.cohortStartDate ?? null

  const headerDescription = useMemo(() => {
    if (!userId) return 'Sign in to view the courses that have been assigned to you.'
    if (!organizationId)
      return 'You are not assigned to an organization yet. Contact your administrator to get access.'
    return 'Welcome to your organization learning journey. Your program courses and milestones appear below.'
  }, [userId, organizationId])

  const hasOrganization = Boolean(organizationId)
  const hasProgram = Boolean(program)
  const hasTimeline = timelineEntries.length > 0

  return (
    <Stack spacing={8} py={2} as="section">
      <Box
        bgGradient="linear(to-r, purple.50, purple.100)"
        borderRadius="3xl"
        border="1px solid"
        borderColor="purple.100"
        p={{ base: 5, md: 8 }}
        boxShadow="md"
      >
        <Flex direction={{ base: 'column', md: 'row' }} align={{ base: 'flex-start', md: 'center' }} gap={4}>
          <Flex
            bg="white"
            borderRadius="full"
            p={3}
            border="1px solid"
            borderColor="purple.100"
            boxShadow="sm"
          >
            <Icon as={BookOpen} boxSize={7} color="purple.600" />
          </Flex>
          <Stack spacing={1} flex={1}>
            <Heading size="lg" color="purple.900">
              Continue your learning journey
            </Heading>
            <Text color="purple.700" fontSize="md">
              {headerDescription}
            </Text>
            <HStack spacing={3} flexWrap="wrap">
              {hasOrganization ? (
                <Badge colorScheme="green" variant="subtle" borderRadius="full">
                  Organization member
                </Badge>
              ) : (
                <Badge colorScheme="yellow" variant="subtle" borderRadius="full">
                  Organization required
                </Badge>
              )}
              <Text color={hasOrganization ? 'green.700' : 'yellow.700'} fontSize="sm">
                {hasOrganization
                  ? 'Your organization-curated program is shown in real time.'
                  : 'Contact your administrator to receive organization access.'}
              </Text>
            </HStack>
          </Stack>
        </Flex>
      </Box>

      {hasOrganization && hasProgram && hasTimeline && (
        <Stack spacing={4} as="section">
          <HStack justify="space-between" align="center">
            <Heading size="md" color="gray.800">
              {timelineHeading}
            </Heading>
            <Badge colorScheme="purple" borderRadius="full">
              {shouldShowJourneyLabel ? journeyLabel : timelineCountLabel}
            </Badge>
          </HStack>

          <Box borderWidth="1px" borderRadius="2xl" p={5} bg="white" boxShadow="sm">
            <HStack justify="space-between" flexWrap="wrap" spacing={4}>
              <HStack spacing={2}>
                <Icon as={CalendarDays} color="purple.600" />
                <Text fontWeight="medium">
                  Cohort start:{' '}
                  {cohortStartDate
                    ? cohortStartDate.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Not set'}
                </Text>
              </HStack>
              {nextUnlockDate && (
                <Badge colorScheme="orange" borderRadius="full">
                  Next unlock: {nextUnlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Badge>
              )}
            </HStack>

            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4} mt={4}>
              {timelineEntries.map(entry => {
                const statusColor =
                  entry.availability === 'current'
                    ? 'green'
                    : entry.availability === 'completed'
                      ? 'purple'
                      : 'gray'
                const statusLabel =
                  entry.availability === 'current'
                    ? isWeeklyTimeline
                      ? 'Current week'
                      : 'Current month'
                    : entry.availability === 'completed'
                      ? 'Completed'
                      : 'Locked'
                const hasCourse = Boolean(entry.course)
                const isLoadingCourse = overallLoading && entry.courseId && !entry.course
                const missingCourse = !overallLoading && entry.courseId && !entry.course
                const hasLink = Boolean(entry.course?.link)
                const hasAccess = entry.course ? canAccessCourse(profile, entry.course.title, entry.course.id) : false
                const isLocked = entry.availability === 'locked'
                const unlockDateLabel =
                  isLocked && entry.unlockDate
                    ? entry.unlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : null
                const canOpen = hasAccess && !isLocked && hasLink
                return (
                  <Box
                    key={`${entry.periodLabel}-${entry.periodNumber}`}
                    borderWidth="1px"
                    borderRadius="2xl"
                    p={4}
                    bg={entry.availability === 'current' ? 'purple.50' : 'gray.50'}
                  >
                    <HStack justify="space-between" mb={2}>
                      <Badge colorScheme={statusColor} borderRadius="full">
                        {entry.displayLabel ||
                          (entry.periodLabel === 'week'
                            ? `Week ${entry.periodNumber}`
                            : `Month ${entry.periodNumber}`)}
                      </Badge>
                      <HStack spacing={1} color="gray.600">
                        <Icon
                          as={
                            entry.availability === 'completed'
                              ? CheckCircle2
                              : entry.availability === 'locked'
                                ? Lock
                                : Sparkles
                          }
                        />
                        <Text fontSize="xs">{statusLabel}</Text>
                      </HStack>
                    </HStack>
                    <Heading size="sm" color="gray.800" mb={1}>
                      {entry.course?.title || (entry.courseId ? 'Course assigned' : 'Course not assigned')}
                    </Heading>
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      {entry.course?.description ||
                        `Your ${entry.periodLabel === 'week' ? 'weekly' : 'monthly'} course assignment.`}
                    </Text>
                    {entry.dateRange && (
                      <Badge variant="subtle" colorScheme="gray" borderRadius="full">
                        {entry.dateRange}
                      </Badge>
                    )}
                    {entry.availability === 'locked' && entry.unlockDate && (
                      <Text fontSize="xs" color="gray.500" mt={2}>
                        Unlocks on {entry.unlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    )}
                    {missingCourse && (
                      <Text fontSize="xs" color="red.500" mt={2}>
                        A course assigned in the program could not be found. Please contact support.
                      </Text>
                    )}
                    {!entry.courseId && (
                      <Text fontSize="xs" color="gray.500" mt={2}>
                        No course assigned for this {entry.periodLabel} yet.
                      </Text>
                    )}
                    {entry.courseId && (
                      <Stack mt={3} spacing={2}>
                        {isLoadingCourse ? (
                          <Button size="sm" colorScheme="purple" borderRadius="full" isLoading loadingText="Loading course">
                            Loading course
                          </Button>
                        ) : (
                          <Tooltip
                            label={
                              !hasCourse
                                ? missingCourse
                                  ? 'Course details are unavailable.'
                                  : 'Course details are still loading.'
                                : !hasLink
                                  ? 'Course link has not been provided yet.'
                                  : isLocked && unlockDateLabel
                                    ? `Unlocks on ${unlockDateLabel}`
                                    : isLocked
                                      ? 'Course is locked until its unlock date.'
                                      : !hasAccess
                                        ? 'Upgrade your membership to access this course.'
                                        : ''
                            }
                            isDisabled={!isLocked && hasAccess && hasLink && hasCourse}
                            hasArrow
                            shouldWrapChildren
                          >
                            <Button
                              as={canOpen ? 'a' : (RouterLink as React.ElementType)}
                              href={canOpen ? entry.course?.link : undefined}
                              to={canOpen ? undefined : '/upgrade'}
                              target={canOpen ? '_blank' : undefined}
                              rel={canOpen ? 'noopener noreferrer' : undefined}
                              size="sm"
                              colorScheme="purple"
                              variant="solid"
                              borderRadius="full"
                              minW="140px"
                              isDisabled={!hasCourse || !hasLink || isLocked}
                              leftIcon={isLocked ? <Lock size={14} /> : undefined}
                              rightIcon={!isLocked ? <ExternalLink size={16} /> : undefined}
                            >
                              {isLocked && unlockDateLabel
                                ? `Unlocks ${unlockDateLabel}`
                                : !hasCourse
                                  ? 'Course unavailable'
                                  : !hasLink
                                    ? 'Link unavailable'
                                    : hasAccess
                                      ? 'Open course'
                                      : 'Upgrade to unlock'}
                            </Button>
                          </Tooltip>
                        )}
                      </Stack>
                    )}
                  </Box>
                )
              })}
            </SimpleGrid>
          </Box>
        </Stack>
      )}

      {hasOrganization && hasProgram && !hasTimeline && (
        <Box borderWidth="1px" borderRadius="2xl" p={5} bg="white" boxShadow="sm">
          <Heading size="sm" color="gray.800" mb={2}>
            Courses are still being assigned
          </Heading>
          <Text color="gray.600" fontSize="sm">
            Your organization hasn&apos;t assigned any courses to this program yet. Check back soon or contact your
            administrator for updates.
          </Text>
        </Box>
      )}

    </Stack>
  )
}

export const MyCoursesPage: React.FC = () => {
  const { user, profile } = useAuth()
  const isFreeTierUser = useMemo(() => isFreeUser(profile), [profile])

  if (isFreeTierUser) {
    return <FreeTierCoursesPage userId={user?.uid} profile={profile} />
  }

  return <OrganizationCoursesPage userId={user?.uid} profile={profile} />
}
