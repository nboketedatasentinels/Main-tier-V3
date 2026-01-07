import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Heading,
  Text,
  Stack,
  SimpleGrid,
  Skeleton,
  Spinner,
  Badge,
  Button,
  Grid,
  GridItem,
  Flex,
  Icon,
  Progress,
  HStack,
  VStack,
  Divider,
  Image,
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
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDocs, Timestamp } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/services/firebase'
import { canAccessCourse, FREE_TIER_COURSE_TITLE, isFreeUser } from '@/utils/membership'
import {
  MonthlyCourseAssignments,
  formatMonthRange,
  getMonthAvailabilityStatus,
  getMonthDateRange,
  getMonthlyAssignmentsArray,
  normalizeMonthlyAssignments,
} from '@/utils/monthlyCourseAssignments'
import { Link as RouterLink } from 'react-router-dom'

type CourseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

interface CourseDetail {
  slug: string
  link: string
  points: number
  price: number
  description: string
}

interface CourseMetadata {
  estimatedMinutes: number
  difficulty: CourseDifficulty
}

interface NormalizedCourse {
  id: string
  title: string
  description: string
  link?: string
  assignedDate?: Date | null
  progress?: number
  status?: string
  source: 'user' | 'company' | 'personal' | 'organization'
  estimatedMinutes?: number
  difficulty?: CourseDifficulty
  image?: string
}

interface RecentActivityItem {
  id: string
  title: string
  lastAccessed: Date | null
  progress?: number
  courseId?: string
}

type RecommendedCourse = CourseDetail & CourseMetadata & { title: string }

const COURSE_DETAILS_MAPPING: Record<string, CourseDetail> = {
  'The Courage to Heal': {
    slug: 'courage-to-heal',
    link: 'https://t4leader.com/program/courage-to-heal',
    points: 100,
    price: 55,
    description: 'Build resilience and foster personal healing.',
  },
  'AI Stacking 101': {
    slug: 'ai-stacking-101',
    link: 'https://t4leader.com/program/ai-stacking-101',
    points: 100,
    price: 89,
    description: 'Leverage AI tools to stack efficiencies in your workflow.',
  },
  'Hire Me Already': {
    slug: 'hire-me-already',
    link: 'https://t4leader.com/program/hire-me-already',
    points: 100,
    price: 79,
    description: 'Polish your personal brand to land your next opportunity.',
  },
  'The Art of Connection': {
    slug: 'art-of-connection',
    link: 'https://t4leader.com/program/art-of-connection',
    points: 100,
    price: 65,
    description: 'Deepen relationships through intentional communication.',
  },
  'Auto Connection': {
    slug: 'auto-connection',
    link: 'https://t4leader.com/program/auto-connection',
    points: 100,
    price: 49,
    description: 'Automate outreach and follow-up with authenticity.',
  },
  'The Heart of Leadership': {
    slug: 'heart-of-leadership',
    link: 'https://t4leader.com/program/heart-of-leadership',
    points: 100,
    price: 95,
    description: 'Lead with empathy, courage, and clarity.',
  },
  'LinkedIn Warrior': {
    slug: 'linkedin-warrior',
    link: 'https://t4leader.com/program/linkedin-warrior',
    points: 100,
    price: 45,
    description: 'Grow your professional influence on LinkedIn.',
  },
  'Path to Promotion': {
    slug: 'path-to-promotion',
    link: 'https://t4leader.com/program/path-to-promotion',
    points: 100,
    price: 79,
    description: 'Map the exact steps to accelerate your advancement.',
  },
  'Understanding Digital Bias': {
    slug: 'understanding-digital-bias',
    link: 'https://t4leader.com/program/understanding-digital-bias',
    points: 100,
    price: 82,
    description: 'Recognize and mitigate bias in digital experiences.',
  },
  'Cultural Intelligence': {
    slug: 'cultural-intelligence',
    link: 'https://t4leader.com/program/cultural-intelligence',
    points: 100,
    price: 72,
    description: 'Navigate cross-cultural collaboration with ease.',
  },
  'The Confidence Code': {
    slug: 'confidence-code',
    link: 'https://t4leader.com/program/confidence-code',
    points: 100,
    price: 60,
    description: 'Unlock and sustain unshakeable confidence.',
  },
  'Think Like an Owner': {
    slug: 'think-like-an-owner',
    link: 'https://t4leader.com/program/think-like-an-owner',
    points: 100,
    price: 90,
    description: 'Adopt an ownership mindset to drive results.',
  },
  'Mindset Reset': {
    slug: 'mindset-reset',
    link: 'https://t4leader.com/program/mindset-reset',
    points: 100,
    price: 68,
    description: 'Reframe limiting beliefs into empowering narratives.',
  },
  'Goal Setting Mastery': {
    slug: 'goal-setting-mastery',
    link: 'https://t4leader.com/program/goal-setting-mastery',
    points: 100,
    price: 85,
    description: 'Set, track, and achieve meaningful goals.',
  },
  'Goal Setting': {
    slug: 'goal-setting',
    link: 'https://t4leader.com/program/goal-setting',
    points: 100,
    price: 40,
    description: 'Quick-start guide to defining achievable goals.',
  },
  'How to Thrive in a Toxic Workplace': {
    slug: 'thrive-toxic-workplace',
    link: 'https://t4leader.com/program/thrive-toxic-workplace',
    points: 100,
    price: 77,
    description: 'Strategies for navigating and improving tough cultures.',
  },
  'The Science of You': {
    slug: 'science-of-you',
    link: 'https://t4leader.com/program/science-of-you',
    points: 100,
    price: 92,
    description: 'Personalized insights to optimize your strengths.',
  },
  'Transformational Leadership': {
    slug: 'transformational-leadership',
    link: 'https://t4leader.com/program/transformational-leadership',
    points: 100,
    price: 110,
    description: 'Guide teams through change with vision and trust.',
  },
  'Digital Transformation and Data': {
    slug: 'digital-transformation-data',
    link: 'https://t4leader.com/program/digital-transformation-data',
    points: 100,
    price: 115,
    description: 'Lead digital-first initiatives with data fluency.',
  },
  'Leading Through Change and Continuous Improvement': {
    slug: 'leading-through-change',
    link: 'https://t4leader.com/program/leading-through-change',
    points: 100,
    price: 105,
    description: 'Embed continuous improvement within your team.',
  },
  'Project Management for Leaders': {
    slug: 'project-management-for-leaders',
    link: 'https://t4leader.com/program/project-management-for-leaders',
    points: 100,
    price: 120,
    description: 'Deliver complex initiatives with confidence.',
  },
  'Foundations of Leadership and Team Dynamics': {
    slug: 'foundations-of-leadership',
    link: 'https://t4leader.com/program/foundations-of-leadership',
    points: 100,
    price: 96,
    description: 'Lead cohesive teams with clarity and trust.',
  },
  'Inner Shift': {
    slug: 'inner-shift',
    link: 'https://t4leader.com/program/inner-shift',
    points: 100,
    price: 120,
    description: 'Comprehensive personal development transformation.',
  },
  'Digital Rebel': {
    slug: 'digital-rebel',
    link: 'https://t4leader.com/program/digital-rebel',
    points: 100,
    price: 120,
    description: 'Lead digital disruption with creativity.',
  },
  'Architect': {
    slug: 'architect',
    link: 'https://t4leader.com/program/architect',
    points: 100,
    price: 130,
    description: '12-month leadership transformation program.',
  },
}

const COURSE_METADATA_MAPPING: Record<string, CourseMetadata> = {
  'The Courage to Heal': { estimatedMinutes: 120, difficulty: 'Intermediate' },
  'AI Stacking 101': { estimatedMinutes: 90, difficulty: 'Advanced' },
  'Hire Me Already': { estimatedMinutes: 80, difficulty: 'Intermediate' },
  'The Art of Connection': { estimatedMinutes: 75, difficulty: 'Beginner' },
  'Auto Connection': { estimatedMinutes: 70, difficulty: 'Beginner' },
  'The Heart of Leadership': { estimatedMinutes: 110, difficulty: 'Intermediate' },
  'LinkedIn Warrior': { estimatedMinutes: 85, difficulty: 'Intermediate' },
  'Path to Promotion': { estimatedMinutes: 95, difficulty: 'Advanced' },
  'Understanding Digital Bias': { estimatedMinutes: 100, difficulty: 'Intermediate' },
  'Cultural Intelligence': { estimatedMinutes: 120, difficulty: 'Intermediate' },
  'The Confidence Code': { estimatedMinutes: 60, difficulty: 'Beginner' },
  'Think Like an Owner': { estimatedMinutes: 105, difficulty: 'Advanced' },
  'Mindset Reset': { estimatedMinutes: 65, difficulty: 'Beginner' },
  'Goal Setting Mastery': { estimatedMinutes: 90, difficulty: 'Intermediate' },
  'Goal Setting': { estimatedMinutes: 45, difficulty: 'Beginner' },
  'How to Thrive in a Toxic Workplace': { estimatedMinutes: 70, difficulty: 'Intermediate' },
  'The Science of You': { estimatedMinutes: 115, difficulty: 'Advanced' },
  'Transformational Leadership': { estimatedMinutes: 140, difficulty: 'Advanced' },
  'Digital Transformation and Data': { estimatedMinutes: 150, difficulty: 'Advanced' },
  'Leading Through Change and Continuous Improvement': { estimatedMinutes: 130, difficulty: 'Advanced' },
  'Project Management for Leaders': { estimatedMinutes: 160, difficulty: 'Advanced' },
  'Foundations of Leadership and Team Dynamics': { estimatedMinutes: 100, difficulty: 'Intermediate' },
  'Inner Shift': { estimatedMinutes: 360, difficulty: 'Intermediate' },
  'Digital Rebel': { estimatedMinutes: 360, difficulty: 'Advanced' },
  'Architect': { estimatedMinutes: 480, difficulty: 'Advanced' },
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
  const [companyAssignedCourses, setCompanyAssignedCourses] = useState<NormalizedCourse[]>([])
  const [personalAssignedCourses, setPersonalAssignedCourses] = useState<NormalizedCourse[]>([])
  const [organizationCourses, setOrganizationCourses] = useState<NormalizedCourse[]>([])
  const [assignedCourseOrder, setAssignedCourseOrder] = useState<string[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([])
  const [companyProgram, setCompanyProgram] = useState<{
    monthlyAssignments: MonthlyCourseAssignments
    totalMonths: number
    cohortStartDate: Date | null
  } | null>(null)
  const [companyProgramCourseMap, setCompanyProgramCourseMap] = useState<Record<string, NormalizedCourse>>({})

  const [loadingUserCourses, setLoadingUserCourses] = useState(true)
  const [loadingCompanyCourses, setLoadingCompanyCourses] = useState(true)
  const [loadingPersonalCourses, setLoadingPersonalCourses] = useState(true)
  const [loadingOrganizationCourses, setLoadingOrganizationCourses] = useState(true)
  const [loadingRecentActivity, setLoadingRecentActivity] = useState(true)

  const companyCode = profile?.companyId || (profile as { companyCode?: string } | null)?.companyCode

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
    if (!user || !companyCode) {
      setCompanyAssignedCourses([])
      setLoadingCompanyCourses(false)
      return
    }

    const q = query(collection(db, 'assigned_courses'), where('companyCode', '==', companyCode))
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
            status: formatStatus(data.status || 'assigned'),
            source: 'company',
            estimatedMinutes: metadata?.estimatedMinutes,
            difficulty: metadata?.difficulty,
            image: COURSE_IMAGE_FILENAMES[title],
          }
        })
        setCompanyAssignedCourses(mapped)
        setLoadingCompanyCourses(false)
      },
      error => {
        console.error('Error loading company assigned courses', error)
        setCompanyAssignedCourses([])
        setLoadingCompanyCourses(false)
      }
    )

    return () => unsubscribe()
  }, [user, companyCode])

  useEffect(() => {
    if (!user) {
      setPersonalAssignedCourses([])
      setLoadingPersonalCourses(false)
      return
    }

    const q = query(collection(db, 'assigned_courses'), where('userId', '==', user.uid))
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
            status: formatStatus(data.status || 'assigned'),
            source: 'personal',
            estimatedMinutes: metadata?.estimatedMinutes,
            difficulty: metadata?.difficulty,
            image: COURSE_IMAGE_FILENAMES[title],
          }
        })
        setPersonalAssignedCourses(mapped)
        setLoadingPersonalCourses(false)
      },
      error => {
        console.error('Error loading personal assigned courses', error)
        setPersonalAssignedCourses([])
        setLoadingPersonalCourses(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    if (!companyCode) {
      setOrganizationCourses([])
      setAssignedCourseOrder([])
      setLoadingOrganizationCourses(false)
      setCompanyProgram(null)
      setCompanyProgramCourseMap({})
      return
    }

    const companyRef = doc(db, 'companies', companyCode)
    const unsubscribe = onSnapshot(
      companyRef,
      async snapshot => {
        try {
          if (!snapshot.exists()) {
            setOrganizationCourses([])
            setAssignedCourseOrder([])
            setLoadingOrganizationCourses(false)
            return
          }

          const companyData = snapshot.data()
          const durationRaw =
            companyData.programDuration || companyData.program_duration || companyData.duration || companyData.programLength
          const courseIds = normalizeCourseIds(
            companyData.courseAssignments || companyData.assignedCourses || companyData.defaultCourses
          )
          const { monthlyAssignments, totalMonths } = normalizeMonthlyAssignments({
            monthlyCourseAssignments: companyData.monthlyCourseAssignments,
            courseAssignments: courseIds,
            programDuration: durationRaw,
          })
          const monthlyAssignmentArray = getMonthlyAssignmentsArray(monthlyAssignments, totalMonths)
          const assignedMonthlyCourseIds = monthlyAssignmentArray.filter(Boolean)

          setAssignedCourseOrder(assignedMonthlyCourseIds)
          setCompanyProgram({
            monthlyAssignments,
            totalMonths,
            cohortStartDate: normalizeDate(companyData.cohortStartDate),
          })

          if (!assignedMonthlyCourseIds.length) {
            setOrganizationCourses([])
            setLoadingOrganizationCourses(false)
            setCompanyProgramCourseMap({})
            return
          }

          const fetchChunks: string[][] = []
          for (let i = 0; i < assignedMonthlyCourseIds.length; i += 10) {
            fetchChunks.push(assignedMonthlyCourseIds.slice(i, i + 10))
          }

          const courseDocs: NormalizedCourse[] = []
          for (const chunk of fetchChunks) {
            const coursesQuery = query(collection(db, 'courses'), where('id', 'in', chunk))
            const courseSnapshot = await getDocs(coursesQuery)
            courseSnapshot.forEach(docSnap => {
              const data = docSnap.data()
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
          const mappedCourseLookup = courseDocs.reduce<Record<string, NormalizedCourse>>((acc, course) => {
            acc[course.id] = course
            return acc
          }, {})
          setCompanyProgramCourseMap(mappedCourseLookup)
          setLoadingOrganizationCourses(false)
        } catch (error) {
          console.error('Error loading organization courses', error)
          setOrganizationCourses([])
          setAssignedCourseOrder([])
          setLoadingOrganizationCourses(false)
          setCompanyProgram(null)
          setCompanyProgramCourseMap({})
        }
      },
      error => {
        console.error('Company listener error', error)
        setOrganizationCourses([])
        setAssignedCourseOrder([])
        setLoadingOrganizationCourses(false)
        setCompanyProgram(null)
        setCompanyProgramCourseMap({})
      }
    )

    return () => unsubscribe()
  }, [companyCode])

  useEffect(() => {
    if (!user) {
      setRecentActivity([])
      setLoadingRecentActivity(false)
      return
    }

    const recentQuery = query(
      collection(db, 'user_recent_activity'),
      where('user_id', '==', user.uid),
      orderBy('lastAccessed', 'desc'),
      limit(5)
    )

    const unsubscribe = onSnapshot(
      recentQuery,
      snapshot => {
        const mapped: RecentActivityItem[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            title: (data.title || data.courseTitle || data.name || 'Untitled Course') as string,
            courseId: data.course_id || data.courseId,
            lastAccessed: normalizeDate(data.lastAccessed),
            progress: typeof data.progress === 'number' ? data.progress : undefined,
          }
        })

        setRecentActivity(mapped)
        setLoadingRecentActivity(false)
      },
      error => {
        console.error('Error loading recent activity', error)
        setRecentActivity([])
        setLoadingRecentActivity(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  const combinedAssignedCourses = useMemo(() => {
    const priority = ['user', 'personal', 'company', 'organization'] as NormalizedCourse['source'][]
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

        const shouldReplace =
          priority.indexOf(course.source) < priority.indexOf(existing.source) ||
          (existing.progress ?? 0) < (course.progress ?? 0)

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

    addCourses(userCourses)
    addCourses(personalAssignedCourses)
    addCourses(companyAssignedCourses)
    addCourses(organizationCourses)

    const result = Array.from(mergeMap.values())
    const applyFreeTierFilter = (courses: NormalizedCourse[]) =>
      isFreeTierUser
        ? courses.filter(course => course.title.trim().toLowerCase() === FREE_TIER_COURSE_TITLE.toLowerCase())
        : courses

    if (assignedCourseOrder.length) {
      const ordered = result.sort((a, b) => {
        const indexA = assignedCourseOrder.findIndex(id => id.toLowerCase() === a.title.toLowerCase() || id === a.id)
        const indexB = assignedCourseOrder.findIndex(id => id.toLowerCase() === b.title.toLowerCase() || id === b.id)
        if (indexA === -1 && indexB === -1) return a.title.localeCompare(b.title)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
      return applyFreeTierFilter(ordered)
    }

    return applyFreeTierFilter(result)
  }, [
    userCourses,
    personalAssignedCourses,
    companyAssignedCourses,
    organizationCourses,
    assignedCourseOrder,
    isFreeTierUser,
  ])

  const recommendedCourses = useMemo<RecommendedCourse[]>(() => {
    const assignedTitles = new Set(combinedAssignedCourses.map(course => course.title.toLowerCase()))
    const availableCourses = Object.keys(COURSE_DETAILS_MAPPING)
      .map(title => ({
        title,
        ...(COURSE_DETAILS_MAPPING[title] || {}),
        ...(COURSE_METADATA_MAPPING[title] || {}),
      }))
      .filter(course => !assignedTitles.has(course.title.toLowerCase()))
    const filteredCourses = isFreeTierUser
      ? availableCourses.filter(course => course.title.toLowerCase() === FREE_TIER_COURSE_TITLE.toLowerCase())
      : availableCourses

    return filteredCourses.slice(0, 4)
  }, [combinedAssignedCourses, isFreeTierUser])

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
    if (!companyCode)
      return 'Once you are assigned to a company program, your courses will appear here.'
    return 'Explore your assigned learning experiences below. Course progress and completion are tracked on the external platform.'
  }, [user, isFreeTierUser, companyCode])

  const overallLoading =
    loadingUserCourses || loadingCompanyCourses || loadingPersonalCourses || loadingOrganizationCourses

  const journeyTemplateCourses = useMemo(() => {
    if (!isFreeTierUser) return MONTHLY_JOURNEY_COURSES
    return {
      complimentary: [FREE_TIER_COURSE_TITLE],
    }
  }, [isFreeTierUser])

  const journeyTemplateCount = useMemo(() => Object.keys(journeyTemplateCourses).length, [journeyTemplateCourses])

  const recentCoursesToDisplay = useMemo(() => {
    let items: RecentActivityItem[] = []
    if (recentActivity.length) {
      items = recentActivity
    } else if (!recentActivity.length && !loadingRecentActivity && combinedAssignedCourses.length) {
      items = combinedAssignedCourses.slice(0, 3).map(course => ({
        id: course.id,
        title: course.title,
        lastAccessed: null,
        progress: course.progress,
        courseId: course.id,
      }))
    }

    return isFreeTierUser ? items.filter(item => canAccessCourse(profile, item.title)) : items
  }, [recentActivity, loadingRecentActivity, combinedAssignedCourses, isFreeTierUser, profile])

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
              {journeyTemplateCount} curated journey templates available
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
          </Stack>
        </Flex>
      </Box>

      {isFreeTierUser && (
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6} as="section">
          <GridItem>
            <Box bg="white" p={5} borderRadius="2xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
              <HStack justify="space-between" mb={4}>
                <Heading size="md" color="gray.800">
                  Courses for you
                </Heading>
                <HStack spacing={2} color="purple.600">
                  <Icon as={Sparkles} />
                  <Text fontWeight="semibold">Personalized soon</Text>
                </HStack>
              </HStack>

              {recommendedCourses.length ? (
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  {recommendedCourses.map(course => {
                    const hasAccess = canAccessCourse(profile, course.title)
                    return (
                    <Box
                      key={course.title}
                      border="1px solid"
                      borderColor="gray.100"
                      borderRadius="xl"
                      p={4}
                      bg="gray.50"
                      _hover={{ boxShadow: 'md', bg: 'white' }}
                    >
                      <Stack spacing={3}>
                        {COURSE_IMAGE_FILENAMES[course.title] ? (
                          <Image
                            src={`/${COURSE_IMAGE_FILENAMES[course.title]}`}
                            alt={course.title}
                            borderRadius="lg"
                            objectFit="cover"
                            height="120px"
                          />
                        ) : (
                          <Flex
                            borderRadius="lg"
                            border="1px solid"
                            borderColor="gray.200"
                            height="120px"
                            align="center"
                            justify="center"
                            bg="white"
                          >
                            <Icon as={BookOpen} boxSize={8} color="gray.400" />
                          </Flex>
                        )}
                        <Heading size="sm" color="gray.800">
                          {course.title}
                        </Heading>
                        <Badge
                          colorScheme={badgeColor(course.difficulty as CourseDifficulty)}
                          alignSelf="flex-start"
                          borderRadius="full"
                        >
                          {course.difficulty || 'Beginner'}
                        </Badge>
                        <Text color="gray.600" fontSize="sm">
                          {course.description}
                        </Text>
                        <HStack spacing={2} color="gray.500" fontSize="sm">
                          <Icon as={Clock} boxSize={4} />
                          <Text>{formatDuration(course.estimatedMinutes) || 'Self-paced'}</Text>
                        </HStack>
                        <Button
                          as={hasAccess && course.link ? 'a' : (RouterLink as React.ElementType)}
                          href={hasAccess ? course.link : undefined}
                          to={hasAccess ? undefined : '/upgrade'}
                          target={hasAccess ? '_blank' : undefined}
                          rel={hasAccess ? 'noopener noreferrer' : undefined}
                          rightIcon={<ArrowUpRight size={14} />}
                          colorScheme="purple"
                          variant="outline"
                          size="sm"
                          borderRadius="full"
                        >
                          {hasAccess ? 'Explore' : 'Upgrade to access'}
                        </Button>
                      </Stack>
                    </Box>
                    )
                  })}
                </SimpleGrid>
              ) : (
                <Flex direction="column" align="center" justify="center" py={8} color="gray.500" gap={3}>
                  <Icon as={Sparkles} boxSize={8} />
                  <Text fontWeight="semibold">All available courses are already in your queue...</Text>
                </Flex>
              )}
            </Box>
          </GridItem>

          <GridItem>
            <Box bg="white" p={5} borderRadius="2xl" border="1px solid" borderColor="gray.100" boxShadow="sm">
              <HStack justify="space-between" mb={4}>
                <Heading size="md" color="gray.800">
                  Recently viewed
                </Heading>
                <Badge colorScheme="purple" borderRadius="full">
                  {recentActivity.length ? 'Latest activity' : 'Start exploring'}
                </Badge>
              </HStack>

              {loadingRecentActivity && (
                <Stack spacing={3}>
                  {[1, 2].map(item => (
                    <Box key={item} border="1px solid" borderColor="gray.100" borderRadius="lg" p={3}>
                      <Skeleton height="20px" width="50%" mb={3} />
                      <Skeleton height="10px" borderRadius="full" />
                    </Box>
                  ))}
                </Stack>
              )}

              {!loadingRecentActivity && recentCoursesToDisplay.length === 0 && (
                <Flex direction="column" align="center" justify="center" py={8} color="gray.500" gap={2}>
                  <Icon as={BookOpen} boxSize={8} />
                  <Text>Start exploring your assigned courses to see them appear here.</Text>
                </Flex>
              )}

              {!loadingRecentActivity && recentCoursesToDisplay.length > 0 && (
                <Stack spacing={3}>
                  {recentCoursesToDisplay.map(item => {
                    const hasAccess = canAccessCourse(profile, item.title)
                    return (
                    <Box key={item.id} border="1px solid" borderColor="gray.100" borderRadius="lg" p={3}>
                      <HStack justify="space-between" align="start" mb={2}>
                        <Text fontWeight="semibold" color="gray.800">
                          {item.title}
                        </Text>
                        {item.lastAccessed && (
                          <Text fontSize="sm" color="gray.500">
                            Viewed {item.lastAccessed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </Text>
                        )}
                      </HStack>
                      <Progress
                        value={item.progress || 0}
                        size="sm"
                        colorScheme="purple"
                        borderRadius="full"
                        aria-hidden
                      />
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {(item.progress || 0).toFixed(0)}% complete
                      </Text>
                      <Button
                        as={hasAccess ? 'a' : (RouterLink as React.ElementType)}
                        href={hasAccess ? COURSE_DETAILS_MAPPING[item.title]?.link || '#' : undefined}
                        to={hasAccess ? undefined : '/upgrade'}
                        target={hasAccess ? '_blank' : undefined}
                        rel={hasAccess ? 'noopener noreferrer' : undefined}
                        size="xs"
                        variant="link"
                        colorScheme="purple"
                        mt={1}
                      >
                        {hasAccess ? 'Resume' : 'Upgrade to resume'}
                      </Button>
                    </Box>
                    )
                  })}
                </Stack>
              )}
            </Box>
          </GridItem>
        </Grid>
      )}

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
              No courses assigned yet
            </Heading>
            <Text color="gray.500" textAlign="center" maxW="lg">
              {isFreeTierUser
                ? 'Free members can access Transformational Leadership. Upgrade your membership to unlock the full course catalog.'
                : 'Your program administrator has not assigned any courses yet. Check back soon!'}
            </Text>
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
    </Stack>
  )
}
