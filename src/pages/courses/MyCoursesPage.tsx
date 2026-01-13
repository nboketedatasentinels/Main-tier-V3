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
  Link,
} from '@chakra-ui/react'
import {
  BookOpen,
  Clock,
  ExternalLink,
  Sparkles,
  ListPlus,
  ArrowUpRight,
  CheckCircle2,
  CalendarDays,
  Lock,
} from 'lucide-react'
import { collection, query, where, onSnapshot, doc, getDocs, Timestamp, documentId } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { canAccessCourse, FREE_TIER_COURSE_TITLE, isFreeUser } from '@/utils/membership'
import {
  COURSE_DETAILS_MAPPING,
  COURSE_METADATA_MAPPING,
  type CourseDifficulty,
} from '@/utils/courseMappings'
import {
  MonthlyCourseAssignments,
  formatMonthRange,
  getMonthAvailabilityStatus,
  getMonthDateRange,
  getMonthlyAssignmentsArray,
  normalizeMonthlyAssignments,
} from '@/utils/monthlyCourseAssignments'
import { resolveUserOrganizationId } from '@/utils/organizationResolution'
import { Link as RouterLink } from 'react-router-dom'

interface NormalizedCourse {
  id: string
  title: string
  description: string
  link?: string
  assignedDate?: Date | null
  progress?: number
  status?: string
  source: 'user' | 'organization'
  estimatedMinutes?: number
  difficulty?: CourseDifficulty
  image?: string
}

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

const MONTHLY_JOURNEY_COURSES: Record<string, string[]> = {
  levelUp: ['Mindset Reset', 'Goal Setting Mastery', 'The Art of Connection'],
  wokeWired: ['Understanding Digital Bias', 'AI Stacking 101', 'Digital Transformation and Data'],
  glowUp: ['The Science of You', 'The Heart of Leadership', 'Leading Through Change and Continuous Improvement'],
  navigator: ['How to Thrive in a Toxic Workplace', 'Think Like an Owner', 'LinkedIn Warrior'],
  bossMode: [
    'Mindset Reset',
    'Goal Setting Mastery',
    'The Art of Connection',
    'The Confidence Code',
    'Think Like an Owner',
    'LinkedIn Warrior',
  ],
  changeHacker: [
    'The Science of You',
    'Transformational Leadership',
    'Leading Through Change and Continuous Improvement',
    'Understanding Digital Bias',
    'AI Stacking 101',
    'Digital Transformation and Data',
  ],
  innerShift: [
    'Mindset Reset',
    'Goal Setting Mastery',
    'The Art of Connection',
    'The Science of You',
    'The Heart of Leadership',
    'Leading Through Change and Continuous Improvement',
    'Think Like an Owner',
    'Path to Promotion',
    'Transformational Leadership',
  ],
  digitalRebel: [
    'Understanding Digital Bias',
    'AI Stacking 101',
    'Digital Transformation and Data',
    'Project Management for Leaders',
    'Leading Through Change and Continuous Improvement',
    'LinkedIn Warrior',
    'Transformational Leadership',
    'Think Like an Owner',
    'Path to Promotion',
  ],
  architect: [
    'Foundations of Leadership and Team Dynamics',
    'Mindset Reset',
    'Goal Setting Mastery',
    'The Art of Connection',
    'The Heart of Leadership',
    'Think Like an Owner',
    'Path to Promotion',
    'Leading Through Change and Continuous Improvement',
    'Digital Transformation and Data',
    'Transformational Leadership',
    'Project Management for Leaders',
    'AI Stacking 101',
  ],
  custom3: [],
  custom6: [],
}

const normalizeDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  if (value instanceof Timestamp) {
    return value.toDate()
  }
  if (typeof value === 'object' && (value as { toDate?: () => Date }).toDate) {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
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

const normalizeCourseIds = (input?: unknown): string[] => {
  if (!Array.isArray(input)) return []
  const uniqueIds = new Set<string>()
  input.forEach(value => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) {
        uniqueIds.add(trimmed)
      }
    }
  })
  return Array.from(uniqueIds)
}

const isMonthlyCourseAssignments = (value: unknown): value is MonthlyCourseAssignments => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every(
    entry => entry === undefined || entry === null || typeof entry === 'string'
  )
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

export const MyCoursesPage: React.FC = () => {
  const { user, profile } = useAuth()
  const isFreeTierUser = useMemo(() => isFreeUser(profile), [profile])

  const [userCourses, setUserCourses] = useState<NormalizedCourse[]>([])
  const [organizationCourses, setOrganizationCourses] = useState<NormalizedCourse[]>([])
  const [assignedCourseOrder, setAssignedCourseOrder] = useState<string[]>([])
  const [missingOrganizationCourseIds, setMissingOrganizationCourseIds] = useState<string[]>([])
  const [organizationValidation, setOrganizationValidation] = useState<OrganizationValidationResult | null>(null)
  const [companyProgram, setCompanyProgram] = useState<{
    monthlyAssignments: MonthlyCourseAssignments
    totalMonths: number
    cohortStartDate: Date | null
  } | null>(null)
  const [companyProgramCourseMap, setCompanyProgramCourseMap] = useState<Record<string, NormalizedCourse>>({})

  const [loadingUserCourses, setLoadingUserCourses] = useState(true)
  const [loadingOrganizationCourses, setLoadingOrganizationCourses] = useState(true)

  const organizationResolution = useMemo(() => resolveUserOrganizationId(profile), [profile])
  const { organizationId, organizationCode, source: organizationSource } = organizationResolution
  const hasOrganizationAssignment = Boolean(organizationId || organizationCode)

  useEffect(() => {
    if (organizationResolution.warnings.length) {
      console.warn('[MyCourses] Organization identifier mismatch', {
        warnings: organizationResolution.warnings,
        organizationId,
        organizationCode,
      })
    }
  }, [organizationResolution, organizationCode, organizationId])

  useEffect(() => {
    if (!user) {
      setUserCourses([])
      setLoadingUserCourses(false)
      return
    }

    const q = query(collection(db, 'user_courses'), where('user_id', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const mapped: NormalizedCourse[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data()
          const title = (data.title || data.name || data.courseTitle || 'Untitled Course') as string
          const details = COURSE_DETAILS_MAPPING[title]
          const metadata = COURSE_METADATA_MAPPING[title]

          return {
            id: docSnap.id,
            title,
            description: (data.description || details?.description || 'No description available.') as string,
            link: (data.link || details?.link) as string | undefined,
            assignedDate: normalizeDate(data.assignedAt || data.assigned_at || data.createdAt || data.assignedDate),
            progress: typeof data.progress === 'number' ? data.progress : undefined,
            status: formatStatus(data.status),
            source: 'user',
            estimatedMinutes: metadata?.estimatedMinutes,
            difficulty: metadata?.difficulty,
            image: COURSE_IMAGE_FILENAMES[title],
          }
        })
        setUserCourses(mapped)
        setLoadingUserCourses(false)
      },
      error => {
        console.error('Error loading user courses', error)
        setUserCourses([])
        setLoadingUserCourses(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    if (!organizationId && !organizationCode) {
      setOrganizationCourses([])
      setAssignedCourseOrder([])
      setMissingOrganizationCourseIds([])
      setOrganizationValidation(null)
      setLoadingOrganizationCourses(false)
      setCompanyProgram(null)
      setCompanyProgramCourseMap({})
      return
    }

    setLoadingOrganizationCourses(true)
    setOrganizationValidation(null)
    setMissingOrganizationCourseIds([])

    const resolveOrganizationCourses = async (orgData: Record<string, unknown>) => {
      const validation = await validateUserOrganizationAccess({
        organizationId,
        organizationCode,
      })
      if (!validation.valid) {
        setOrganizationValidation(validation)
      } else {
        setOrganizationValidation({
          ...validation,
          organization: orgData,
        })
      }

      const rawDuration =
        orgData.programDuration || orgData.program_duration || orgData.duration || orgData.programLength
      const programDuration: number | string | null =
        typeof rawDuration === 'number' || typeof rawDuration === 'string' ? rawDuration : null
      const rawMonthlyAssignments = orgData.monthlyCourseAssignments
      const monthlyCourseAssignments = isMonthlyCourseAssignments(rawMonthlyAssignments)
        ? rawMonthlyAssignments
        : null
      const courseIds = normalizeCourseIds(
        orgData.courseAssignments || orgData.assignedCourses || orgData.defaultCourses
      )
      const { monthlyAssignments, totalMonths } = normalizeMonthlyAssignments({
        monthlyCourseAssignments,
        courseAssignments: courseIds,
        programDuration,
      })
      const monthlyAssignmentArray = getMonthlyAssignmentsArray(monthlyAssignments, totalMonths)
      const assignedMonthlyCourseIds = monthlyAssignmentArray.filter(Boolean)

      setAssignedCourseOrder(assignedMonthlyCourseIds)
      setCompanyProgram({
        monthlyAssignments,
        totalMonths,
        cohortStartDate: normalizeDate(orgData.cohortStartDate),
      })

      if (!assignedMonthlyCourseIds.length) {
        setOrganizationCourses([])
        setLoadingOrganizationCourses(false)
        setCompanyProgramCourseMap({})
        setMissingOrganizationCourseIds([])
        setOrganizationValidation({
          valid: false,
          organizationId: validation.organizationId ?? organizationId ?? undefined,
          organizationCode: validation.organizationCode ?? organizationCode ?? undefined,
          organizationName: validation.organizationName,
          errorCode: 'NO_COURSES_ASSIGNED',
          message: validation.message || 'No courses are assigned to your organization yet.',
        })
        return
      }

      const fetchChunks: string[][] = []
      for (let i = 0; i < assignedMonthlyCourseIds.length; i += 10) {
        fetchChunks.push(assignedMonthlyCourseIds.slice(i, i + 10))
      }

      const courseDocs: NormalizedCourse[] = []
      const fetchedIds = new Set<string>()
      for (const chunk of fetchChunks) {
        const coursesQuery = query(collection(db, 'courses'), where(documentId(), 'in', chunk))
        const courseSnapshot = await getDocs(coursesQuery)
        courseSnapshot.forEach(docSnap => {
          const data = docSnap.data()
          fetchedIds.add(docSnap.id)
          const title = (data.title || data.name || data.courseTitle || 'Untitled Course') as string
          const details = COURSE_DETAILS_MAPPING[title]
          const metadata = COURSE_METADATA_MAPPING[title]

          courseDocs.push({
            id: docSnap.id,
            title,
            description: (data.description || details?.description || 'No description available.') as string,
            link: (data.link || details?.link) as string | undefined,
            assignedDate: normalizeDate(data.assignedAt || data.assigned_at || data.createdAt || data.assignedDate),
            progress: typeof data.progress === 'number' ? data.progress : undefined,
            status: formatStatus(data.status || 'assigned'),
            source: 'organization',
            estimatedMinutes: metadata?.estimatedMinutes,
            difficulty: metadata?.difficulty,
            image: COURSE_IMAGE_FILENAMES[title],
          })
        })
      }

      setOrganizationCourses(courseDocs)
      const missingIds = assignedMonthlyCourseIds.filter((courseId) => !fetchedIds.has(courseId))
      if (missingIds.length) {
        console.warn('[MyCourses] Missing course documents for organization assignment', {
          organizationId,
          missingIds,
        })
      }
      setMissingOrganizationCourseIds(missingIds)
      const mappedCourseLookup = courseDocs.reduce<Record<string, NormalizedCourse>>((acc, course) => {
        acc[course.id] = course
        return acc
      }, {})
      setCompanyProgramCourseMap(mappedCourseLookup)
      setLoadingOrganizationCourses(false)
    }

    const handleSnapshotError = (error: Error) => {
      console.error('[MyCourses] Organization listener error', error)
      setOrganizationCourses([])
      setAssignedCourseOrder([])
      setMissingOrganizationCourseIds([])
      setLoadingOrganizationCourses(false)
      setCompanyProgram(null)
      setCompanyProgramCourseMap({})
      setOrganizationValidation({
        valid: false,
        organizationId: organizationId ?? undefined,
        organizationCode: organizationCode ?? undefined,
        errorCode: 'ORG_NOT_FOUND',
        message: 'Organization details could not be loaded.',
      })
    }

    if (organizationId) {
      const organizationRef = doc(db, ORG_COLLECTION, organizationId)
      const unsubscribe = onSnapshot(
        organizationRef,
        async snapshot => {
          try {
            if (!snapshot.exists()) {
              setOrganizationCourses([])
              setAssignedCourseOrder([])
              setMissingOrganizationCourseIds([])
              setLoadingOrganizationCourses(false)
              setCompanyProgram(null)
              setCompanyProgramCourseMap({})
              setOrganizationValidation({
                valid: false,
                organizationId,
                organizationCode: organizationCode ?? undefined,
                errorCode: 'ORG_NOT_FOUND',
                message: 'Organization details could not be found.',
              })
              return
            }
            console.debug('[MyCourses] Organization document resolved', {
              organizationId,
              source: organizationSource,
            })
            await resolveOrganizationCourses(snapshot.data())
          } catch (error) {
            console.error('Error loading organization courses', error)
            setOrganizationCourses([])
            setAssignedCourseOrder([])
            setMissingOrganizationCourseIds([])
            setLoadingOrganizationCourses(false)
            setCompanyProgram(null)
            setCompanyProgramCourseMap({})
            setOrganizationValidation({
              valid: false,
              organizationId,
              organizationCode: organizationCode ?? undefined,
              errorCode: 'ORG_NOT_FOUND',
              message: 'Organization details could not be loaded.',
            })
          }
        },
        handleSnapshotError
      )

      return () => unsubscribe()
    }

    if (companyCode) {
      const organizationQuery = query(collection(db, ORG_COLLECTION), where('code', '==', companyCode))
      const unsubscribe = onSnapshot(
        organizationQuery,
        async snapshot => {
          try {
            const docSnapshot = snapshot.docs[0]
            if (!docSnapshot) {
              setOrganizationCourses([])
              setAssignedCourseOrder([])
              setMissingOrganizationCourseIds([])
              setLoadingOrganizationCourses(false)
              setCompanyProgram(null)
              setCompanyProgramCourseMap({})
              setOrganizationValidation({
                valid: false,
                organizationCode,
                errorCode: 'ORG_NOT_FOUND',
                message: 'Organization details could not be found.',
              })
              return
            }
            console.debug('[MyCourses] Organization document resolved by code', {
              organizationCode,
              organizationId: docSnapshot.id,
            })
            await resolveOrganizationCourses(docSnapshot.data())
          } catch (error) {
            console.error('Error loading organization courses', error)
            setOrganizationCourses([])
            setAssignedCourseOrder([])
            setMissingOrganizationCourseIds([])
            setLoadingOrganizationCourses(false)
            setCompanyProgram(null)
            setCompanyProgramCourseMap({})
            setOrganizationValidation({
              valid: false,
              organizationCode,
              errorCode: 'ORG_NOT_FOUND',
              message: 'Organization details could not be loaded.',
            })
          }
        },
        handleSnapshotError
      )

      return () => unsubscribe()
    }

    return
  }, [organizationCode, organizationId, organizationSource])

  const combinedAssignedCourses = useMemo(() => {
    const mergeMap = new Map<string, NormalizedCourse>()

    const addCourses = (courses: NormalizedCourse[]) => {
      courses.forEach(course => {
        const key = course.title.trim().toLowerCase()
        const existing = mergeMap.get(key)
        const details = COURSE_DETAILS_MAPPING[course.title]
        const metadata = COURSE_METADATA_MAPPING[course.title]
        const enhancedCourse: NormalizedCourse = {
          ...course,
          link: course.link || details?.link,
          description: course.description || details?.description || 'No description available.',
          estimatedMinutes: course.estimatedMinutes ?? metadata?.estimatedMinutes,
          difficulty: course.difficulty ?? metadata?.difficulty,
          image: course.image || COURSE_IMAGE_FILENAMES[course.title],
          status: formatStatus(course.status || 'assigned'),
        }

        if (!existing) {
          mergeMap.set(key, enhancedCourse)
          return
        }

        const shouldReplace = (existing.progress ?? 0) < (course.progress ?? 0)

        if (shouldReplace) {
          mergeMap.set(key, { ...existing, ...enhancedCourse })
        } else {
          mergeMap.set(key, {
            ...enhancedCourse,
            progress: existing.progress ?? enhancedCourse.progress,
            assignedDate: existing.assignedDate || enhancedCourse.assignedDate,
            source: existing.source,
          })
        }
      })
    }

    if (hasOrganizationAssignment) {
      addCourses(organizationCourses)
      const organizationTitles = new Set(organizationCourses.map(course => course.title.trim().toLowerCase()))
      addCourses(userCourses.filter(course => organizationTitles.has(course.title.trim().toLowerCase())))
    } else if (isFreeTierUser) {
      const freeCourses = userCourses.filter(
        course => course.title.trim().toLowerCase() === FREE_TIER_COURSE_TITLE.toLowerCase()
      )
      if (freeCourses.length) {
        addCourses(freeCourses)
      } else {
        const details = COURSE_DETAILS_MAPPING[FREE_TIER_COURSE_TITLE]
        const metadata = COURSE_METADATA_MAPPING[FREE_TIER_COURSE_TITLE]
        addCourses([
          {
            id: FREE_TIER_COURSE_TITLE,
            title: FREE_TIER_COURSE_TITLE,
            description: details?.description || 'No description available.',
            link: details?.link,
            source: 'user',
            estimatedMinutes: metadata?.estimatedMinutes,
            difficulty: metadata?.difficulty,
            image: COURSE_IMAGE_FILENAMES[FREE_TIER_COURSE_TITLE],
          },
        ])
      }
    }

    const result = Array.from(mergeMap.values())

    if (assignedCourseOrder.length) {
      return result.sort((a, b) => {
        const indexA = assignedCourseOrder.findIndex(id => id.toLowerCase() === a.title.toLowerCase() || id === a.id)
        const indexB = assignedCourseOrder.findIndex(id => id.toLowerCase() === b.title.toLowerCase() || id === b.id)
        if (indexA === -1 && indexB === -1) return a.title.localeCompare(b.title)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
    }

    return result
  }, [assignedCourseOrder, hasOrganizationAssignment, isFreeTierUser, organizationCourses, userCourses])

  const assignedCourseCount = useMemo(() => combinedAssignedCourses.length, [combinedAssignedCourses])

  const assignedCourseTimeline = useMemo(() => {
    const scheduled = combinedAssignedCourses.filter(course => course.assignedDate)
    const unscheduled = combinedAssignedCourses.filter(course => !course.assignedDate)

    scheduled.sort((a, b) => (a.assignedDate && b.assignedDate ? a.assignedDate.getTime() - b.assignedDate.getTime() : 0))
    unscheduled.sort((a, b) => a.title.localeCompare(b.title))

    const groups: {
      label: string
      monthNumber: number
      courses: NormalizedCourse[]
      scheduled: boolean
    }[] = []

    const monthNameFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

    scheduled.forEach(course => {
      const label = course.assignedDate ? monthNameFormatter.format(course.assignedDate) : 'Upcoming'
      const existingGroup = groups.find(group => group.label === label)
      if (existingGroup) {
        existingGroup.courses.push(course)
      } else {
        groups.push({ label, monthNumber: groups.length + 1, courses: [course], scheduled: true })
      }
    })

    if (unscheduled.length) {
      const label = groups.length ? 'Upcoming' : 'Month 1'
      groups.push({ label, monthNumber: groups.length + 1, courses: unscheduled, scheduled: false })
    }

    return groups
  }, [combinedAssignedCourses])

  const courseMonthIndexLookup = useMemo(() => {
    const map = new Map<string, number>()
    if (!companyProgram) return map
    Object.entries(companyProgram.monthlyAssignments).forEach(([key, courseId]) => {
      if (!courseId || map.has(courseId)) return
      map.set(courseId, Number(key) - 1)
    })
    return map
  }, [companyProgram])

  const monthlyProgramTimeline = useMemo(() => {
    if (!companyProgram || !companyProgram.totalMonths) return []
    const now = new Date()
    return Array.from({ length: companyProgram.totalMonths }, (_, index) => {
      const courseId = companyProgram.monthlyAssignments[String(index + 1)] || ''
      const course = courseId ? companyProgramCourseMap[courseId] : undefined
      const availability = getMonthAvailabilityStatus({
        cohortStartDate: companyProgram.cohortStartDate,
        currentDate: now,
        monthIndex: index,
      })
      const monthRange = companyProgram.cohortStartDate
        ? getMonthDateRange(companyProgram.cohortStartDate, index)
        : null
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
  }, [companyProgram, companyProgramCourseMap])

  const nextUnlockDate = useMemo(() => {
    const nextLocked = monthlyProgramTimeline.find((entry) => entry.availability === 'locked')
    return nextLocked?.unlockDate || null
  }, [monthlyProgramTimeline])

  const headerDescription = useMemo(() => {
    if (!user) return 'Sign in to view the courses that have been assigned to you.'
    if (isFreeTierUser)
      return 'You have access to one complimentary course—Transformational Leadership. Upgrade anytime to unlock the full learning library.'
    if (!hasOrganizationAssignment)
      return 'Upgrade your membership or connect with an organization administrator to unlock curated learning programs.'
    return 'Welcome to your corporate learning program! Access all assigned courses and track your leadership development journey on the external platform.'
  }, [user, isFreeTierUser, hasOrganizationAssignment])

  const overallLoading = loadingUserCourses || loadingOrganizationCourses

  const journeyTemplateCourses = useMemo(() => {
    if (!isFreeTierUser) return MONTHLY_JOURNEY_COURSES
    return {
      complimentary: [FREE_TIER_COURSE_TITLE],
    }
  }, [isFreeTierUser])

  const journeyTemplateCount = useMemo(() => Object.keys(journeyTemplateCourses).length, [journeyTemplateCourses])
  const journeyTemplateLabel = useMemo(() => {
    if (isFreeTierUser) return `${journeyTemplateCount} curated journey templates available`
    return `Full access to ${journeyTemplateCount} professional journey templates`
  }, [isFreeTierUser, journeyTemplateCount])

  const organizationIssue = useMemo(() => {
    if (!organizationValidation || organizationValidation.valid) return null
    return organizationValidation
  }, [organizationValidation])

  const diagnosticDetails = useMemo(() => {
    if (!organizationIssue) return null
    const lines = [
      `Org ID: ${organizationIssue.organizationId || 'unknown'}`,
      `Org Code: ${organizationIssue.organizationCode || 'unknown'}`,
      `Error: ${organizationIssue.errorCode || 'unknown'}`,
    ]
    return lines.join('%0D%0A')
  }, [organizationIssue])

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
            <Badge colorScheme="purple" variant="subtle" width="fit-content" borderRadius="full">
              {journeyTemplateLabel}
            </Badge>
            {isFreeTierUser && (
              <HStack spacing={3} flexWrap="wrap">
                <Badge colorScheme="orange" variant="subtle" borderRadius="full">
                  Free tier experience
                </Badge>
                <Text color="orange.700" fontSize="sm">
                  You are viewing the complimentary course catalog.
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
            )}
            {user && !isFreeTierUser && (
              <HStack spacing={3} flexWrap="wrap">
                <Badge colorScheme="green" variant="subtle" borderRadius="full">
                  {hasOrganizationAssignment ? 'Corporate member' : 'Premium member'}
                </Badge>
                <Text color="green.700" fontSize="sm">
                  {hasOrganizationAssignment
                    ? 'Access curated company courses and leadership development resources.'
                    : 'Upgrade to unlock curated programs or contact an administrator to link your organization.'}
                </Text>
              </HStack>
            )}
          </Stack>
        </Flex>
      </Box>

      {companyProgram && companyProgram.totalMonths > 0 && (
        <Stack spacing={4} as="section">
          <HStack justify="space-between" align="center">
            <Heading size="md" color="gray.800">
              Monthly program timeline
            </Heading>
            <Badge colorScheme="purple" borderRadius="full">
              {companyProgram.totalMonths} months
            </Badge>
          </HStack>

          <Box borderWidth="1px" borderRadius="2xl" p={5} bg="white" boxShadow="sm">
            <HStack justify="space-between" flexWrap="wrap" spacing={4}>
              <HStack spacing={2}>
                <Icon as={CalendarDays} color="purple.600" />
                <Text fontWeight="medium">
                  Cohort start:{' '}
                  {companyProgram.cohortStartDate
                    ? companyProgram.cohortStartDate.toLocaleDateString(undefined, {
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
              {monthlyProgramTimeline.map((entry) => {
                const statusColor =
                  entry.availability === 'current'
                    ? 'green'
                    : entry.availability === 'completed'
                      ? 'purple'
                      : 'gray'
                const statusLabel =
                  entry.availability === 'current'
                    ? 'Current month'
                    : entry.availability === 'completed'
                      ? 'Completed'
                      : 'Locked'
                const hasCourse = Boolean(entry.course)
                const isLoadingCourse = overallLoading && entry.courseId && !entry.course
                const missingCourse = !overallLoading && entry.courseId && !entry.course
                const hasLink = Boolean(entry.course?.link)
                const hasAccess = entry.course ? canAccessCourse(profile, entry.course.title) : false
                const isLocked = entry.availability === 'locked'
                const unlockDateLabel =
                  isLocked && entry.unlockDate
                    ? entry.unlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : null
                const canOpen = hasAccess && !isLocked && hasLink
                return (
                  <Box
                    key={`monthly-${entry.monthNumber}`}
                    borderWidth="1px"
                    borderRadius="2xl"
                    p={4}
                    bg={entry.availability === 'current' ? 'purple.50' : 'gray.50'}
                  >
                    <HStack justify="space-between" mb={2}>
                      <Badge colorScheme={statusColor} borderRadius="full">
                        Month {entry.monthNumber}
                      </Badge>
                      <HStack spacing={1} color="gray.600">
                        <Icon as={entry.availability === 'completed' ? CheckCircle2 : entry.availability === 'locked' ? Lock : Sparkles} />
                        <Text fontSize="xs">{statusLabel}</Text>
                      </HStack>
                    </HStack>
                    <Heading size="sm" color="gray.800" mb={1}>
                      {entry.course?.title || (entry.courseId ? 'Course assigned' : 'Course not assigned')}
                    </Heading>
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      {entry.course?.description || 'Your monthly course assignment.'}
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
                        Course details unavailable. Contact your administrator.
                      </Text>
                    )}
                    {!entry.courseId && (
                      <Text fontSize="xs" color="gray.500" mt={2}>
                        No course assigned for this month yet.
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

      <Stack spacing={4} as="section">
        <HStack justify="space-between" align="center">
          <Heading size="md" color="gray.800">
            All assigned courses
          </Heading>
          <HStack spacing={3}>
            <Badge colorScheme="purple" variant="subtle" borderRadius="full">
              {assignedCourseCount} total courses
            </Badge>
            <Badge colorScheme="purple" borderRadius="full">
              Real-time updates
            </Badge>
          </HStack>
        </HStack>

        {overallLoading && (
          <Flex align="center" justify="center" py={10} direction="column" gap={3}>
            <Spinner size="lg" color="purple.500" />
            <Text color="gray.600">Loading your courses…</Text>
          </Flex>
        )}

        {!overallLoading && combinedAssignedCourses.length === 0 && (
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
            <Icon as={BookOpen} boxSize={10} color="gray.300" />
            <Heading size="sm" color="gray.800">
              {organizationIssue?.errorCode === 'ORG_INACTIVE'
                ? 'Organization inactive'
                : organizationIssue?.errorCode === 'ORG_NOT_FOUND'
                  ? 'Organization not found'
                  : organizationIssue?.errorCode === 'NO_COURSES_ASSIGNED'
                    ? 'No organization courses assigned yet'
                    : 'No courses assigned yet'}
            </Heading>
            <Text color="gray.500" textAlign="center" maxW="lg">
              {organizationIssue?.message
                ? organizationIssue.message
                : isFreeTierUser
                  ? 'Free members can access Transformational Leadership. Upgrade your membership to unlock the full course catalog.'
                  : hasOrganizationAssignment
                    ? 'Your program administrator has not assigned any courses yet. Check back soon!'
                    : 'Upgrade your membership or contact your organization administrator to access corporate courses.'}
            </Text>
            {organizationIssue && (
              <Button
                as={Link}
                href={`mailto:support@t4leader.com?subject=Organization%20Course%20Access%20Issue&body=${diagnosticDetails ?? ''}`}
                size="sm"
                colorScheme="purple"
                variant="outline"
                borderRadius="full"
              >
                Contact Administrator
              </Button>
            )}
          </Flex>
        )}

        {!overallLoading && combinedAssignedCourses.length > 0 && (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={6}>
            {assignedCourseTimeline.map(group => (
              <Box
                key={`${group.label}-${group.monthNumber}`}
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
                      {group.scheduled ? `Month ${group.monthNumber}` : 'Upcoming'}
                    </Badge>
                    <Text fontWeight="semibold" color="purple.900">
                      {group.label}
                    </Text>
                  </HStack>
                  <HStack spacing={2} color="purple.700">
                    <Icon as={group.scheduled ? ListPlus : Sparkles} />
                    <Text fontSize="sm">{group.courses.length} courses assigned</Text>
                  </HStack>
                </Box>

                <Stack spacing={0} divider={<Divider />} p={4} bg="white">
                  {group.courses.map(course => (
                    <Box key={`${course.id}-${course.title}`} py={3}>
                      <HStack justify="space-between" align="start" spacing={3}>
                        <VStack align="start" spacing={1} flex={1}>
                          <Heading size="sm" color="gray.800">
                            {course.title}
                          </Heading>
                          <Text color="gray.600" fontSize="sm">
                            {course.description}
                          </Text>
                          <HStack spacing={3} flexWrap="wrap">
                            {course.source === 'organization' && companyProgram?.cohortStartDate && courseMonthIndexLookup.has(course.id) && (
                              <Badge colorScheme="purple" variant="subtle" borderRadius="full">
                                Month {courseMonthIndexLookup.get(course.id)! + 1}
                              </Badge>
                            )}
                            {course.assignedDate && (
                              <Badge colorScheme="gray" variant="subtle" borderRadius="full">
                                {course.assignedDate.toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </Badge>
                            )}
                            {course.difficulty && (
                              <Badge colorScheme={badgeColor(course.difficulty)} variant="outline" borderRadius="full">
                                {course.difficulty}
                              </Badge>
                            )}
                            {course.estimatedMinutes && (
                              <HStack spacing={1} color="gray.500">
                                <Icon as={Clock} boxSize={4} />
                                <Text fontSize="xs">{formatDuration(course.estimatedMinutes)}</Text>
                              </HStack>
                            )}
                          </HStack>

                          {typeof course.progress === 'number' && (
                            <Box pt={1} width="full">
                              <Progress
                                value={course.progress}
                                size="sm"
                                colorScheme="purple"
                                borderRadius="full"
                                aria-hidden
                              />
                              <Text fontSize="xs" color="gray.500" mt={1}>
                                {course.progress.toFixed(0)}% complete
                              </Text>
                            </Box>
                          )}
                        </VStack>

                        {course.link && (() => {
                          const hasAccess = canAccessCourse(profile, course.title)
                          const monthIndex = course.source === 'organization' ? courseMonthIndexLookup.get(course.id) : undefined
                          const availability = monthIndex !== undefined
                            ? getMonthAvailabilityStatus({
                                cohortStartDate: companyProgram?.cohortStartDate || null,
                                currentDate: new Date(),
                                monthIndex,
                              })
                            : null
                          const isLocked = availability === 'locked'
                          const unlockDate =
                            isLocked && companyProgram?.cohortStartDate
                              ? getMonthDateRange(companyProgram.cohortStartDate, monthIndex || 0).startDate
                              : null
                          const canOpen = hasAccess && !isLocked
                          return (
                            <Button
                              as={canOpen ? 'a' : (RouterLink as React.ElementType)}
                              href={canOpen ? course.link : undefined}
                              to={canOpen ? undefined : '/upgrade'}
                              target={canOpen ? '_blank' : undefined}
                              rel={canOpen ? 'noopener noreferrer' : undefined}
                              size="sm"
                              colorScheme="purple"
                              rightIcon={<ExternalLink size={16} />}
                              variant="solid"
                              borderRadius="full"
                              minW="120px"
                              isDisabled={isLocked}
                            >
                              {isLocked && unlockDate
                                ? `Unlocks ${unlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                                : hasAccess
                                  ? 'Open course'
                                  : 'Upgrade to unlock'}
                            </Button>
                          )
                        })()}
                      </HStack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Stack>

      {import.meta.env.DEV && (
        <Box borderWidth="1px" borderRadius="2xl" p={4} bg="gray.50">
          <Heading size="sm" color="gray.700" mb={2}>
            Debug: organization resolution
          </Heading>
          <Stack spacing={1} fontSize="sm" color="gray.600">
            <Text>Resolved org ID: {organizationId || 'none'}</Text>
            <Text>Resolved org code: {organizationCode || 'none'}</Text>
            <Text>Resolution source: {organizationSource}</Text>
            <Text>Assigned course IDs: {assignedCourseOrder.length || 0}</Text>
            <Text>Courses fetched: {organizationCourses.length}</Text>
            <Text>Missing course IDs: {missingOrganizationCourseIds.length || 0}</Text>
          </Stack>
        </Box>
      )}
    </Stack>
  )
}
