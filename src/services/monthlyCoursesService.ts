import {
  Timestamp,
  Unsubscribe,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { UserProfile, UserRole } from '@/types'

export interface CompanyProgramInfo {
  id: string
  programDuration?: string
  courseAssignments?: string[]
  monthlyCourseAssignments?: Record<string, string>
  courseAssignmentStructure?: 'monthly' | 'array'
  cohortStartDate?: Timestamp | Date | null
}

export interface CourseDetails {
  id: string
  title: string
  description?: string
  externalUrl?: string
  isPlaceholder?: boolean
}

export type MonthlyCourseStatus =
  | 'free'
  | 'no_company'
  | 'pending_assignment'
  | 'not_started'
  | 'in_progress'
  | 'completed'

export interface MonthlyCourseData {
  status: MonthlyCourseStatus
  course?: CourseDetails
  monthNumber?: number
  totalMonths?: number
  enrollmentCode?: string
  message?: string
  cohortStartDate?: Date | null
  monthStatuses?: Array<{
    monthNumber: number
    courseId?: string
    status: 'locked' | 'current' | 'completed'
  }>
}

export type MonthlyCourseStatusIndicator = 'locked' | 'current' | 'completed'

const normalizeDate = (value?: Timestamp | Date | null): Date | null => {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  return value
}

const calculateMonthIndex = (startDate: Date, currentDate = new Date()): number => {
  if (currentDate < startDate) return 0
  const startYear = startDate.getFullYear()
  const startMonth = startDate.getMonth()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  let monthsElapsed = (currentYear - startYear) * 12 + (currentMonth - startMonth)
  if (currentDate.getDate() < startDate.getDate()) {
    monthsElapsed -= 1
  }
  return monthsElapsed < 0 ? 0 : monthsElapsed
}

const getProgramMonths = (params: {
  courseAssignments?: string[]
  monthlyCourseAssignments?: Record<string, string>
  programDuration?: string
}): number => {
  const { courseAssignments = [], monthlyCourseAssignments, programDuration } = params
  const monthlyCount = monthlyCourseAssignments ? Object.keys(monthlyCourseAssignments).length : 0
  if (monthlyCount) return monthlyCount
  if (courseAssignments.length) return courseAssignments.length
  const parsedDuration = Number(programDuration)
  if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
    return Math.ceil(parsedDuration)
  }
  return 0
}

const buildMonthlyAssignments = (
  company: CompanyProgramInfo,
  totalMonths: number,
): { assignments: string[]; assignmentMode: 'monthly' | 'array' } => {
  const hasMonthly = company.monthlyCourseAssignments && Object.keys(company.monthlyCourseAssignments).length > 0
  if (hasMonthly) {
    const assignments = Array.from({ length: totalMonths }, (_, index) => {
      const key = String(index + 1)
      return company.monthlyCourseAssignments?.[key] || ''
    })
    return { assignments, assignmentMode: 'monthly' }
  }

  const assignments = company.courseAssignments || []
  return { assignments, assignmentMode: 'array' }
}

const getMonthAvailabilityStatus = (params: {
  cohortStartDate: Date | null
  currentDate: Date
  monthIndex: number
}): MonthlyCourseStatusIndicator => {
  const { cohortStartDate, currentDate, monthIndex } = params
  if (!cohortStartDate) {
    return monthIndex === 0 ? 'current' : 'locked'
  }

  const startDate = new Date(cohortStartDate)
  startDate.setMonth(startDate.getMonth() + monthIndex)
  const endDate = new Date(cohortStartDate)
  endDate.setMonth(endDate.getMonth() + monthIndex + 1)

  if (currentDate < startDate) return 'locked'
  if (currentDate >= endDate) return 'completed'
  return 'current'
}

const fetchCourseDetails = async (courseId: string): Promise<CourseDetails | null> => {
  if (!courseId) return null
  try {
    const courseDoc = await getDoc(doc(db, 'courses', courseId))
    if (courseDoc.exists()) {
      const data = courseDoc.data()
      return {
        id: courseDoc.id,
        title: data.title || courseId,
        description: data.description,
        externalUrl: data.externalUrl || data.content_url,
      }
    }
    return {
      id: courseId,
      title: courseId,
      isPlaceholder: true,
    }
  } catch (error) {
    console.error('Error fetching course details', error)
    return {
      id: courseId,
      title: courseId,
      isPlaceholder: true,
    }
  }
}

export const buildMonthlyCourseState = async (
  company: CompanyProgramInfo,
  currentDate = new Date(),
): Promise<MonthlyCourseData> => {
  const totalMonths = getProgramMonths({
    courseAssignments: company.courseAssignments,
    monthlyCourseAssignments: company.monthlyCourseAssignments,
    programDuration: company.programDuration,
  })
  const { assignments } = buildMonthlyAssignments(company, totalMonths)

  if (!assignments.length) {
    return {
      status: 'pending_assignment',
      totalMonths,
      message: 'Course assignments are being configured. Please check back soon.',
    }
  }

  const cohortStart = normalizeDate(company.cohortStartDate)

  if (cohortStart && currentDate < cohortStart) {
    const firstCourseDetails = await fetchCourseDetails(assignments[0])
    return {
      status: 'not_started',
      course: firstCourseDetails || undefined,
      monthNumber: 1,
      totalMonths,
      cohortStartDate: cohortStart,
      message: 'Your cohort is starting soon. Here is a preview of your first course.',
    }
  }

  const monthIndex = cohortStart ? calculateMonthIndex(cohortStart, currentDate) : 0

  if (monthIndex >= assignments.length) {
    const lastCourseDetails = await fetchCourseDetails(assignments[assignments.length - 1])
    return {
      status: 'completed',
      course: lastCourseDetails || undefined,
      monthNumber: assignments.length,
      totalMonths,
      cohortStartDate: cohortStart,
      message: 'You have completed all assigned courses for this program.',
      monthStatuses: assignments.map((courseId, index) => ({
        monthNumber: index + 1,
        courseId: courseId || undefined,
        status: 'completed',
      })),
    }
  }

  let currentIndex = monthIndex
  let courseDetails: CourseDetails | null = null

  while (currentIndex < assignments.length && !courseDetails) {
    const courseId = assignments[currentIndex]
    if (!courseId) {
      currentIndex += 1
      continue
    }

    const availability = getMonthAvailabilityStatus({
      cohortStartDate: cohortStart,
      currentDate,
      monthIndex: currentIndex,
    })

    if (availability !== 'current') {
      break
    }

    const fetchedDetails = await fetchCourseDetails(courseId)
    if (fetchedDetails) {
      courseDetails = fetchedDetails
    } else {
      currentIndex += 1
    }
  }

  if (!courseDetails) {
    return {
      status: 'pending_assignment',
      totalMonths,
      message: 'Course details are missing for this month. Please contact an admin.',
      monthStatuses: assignments.map((courseId, index) => ({
        monthNumber: index + 1,
        courseId: courseId || undefined,
        status: getMonthAvailabilityStatus({
          cohortStartDate: cohortStart,
          currentDate,
          monthIndex: index,
        }),
      })),
    }
  }

  return {
    status: 'in_progress',
    course: courseDetails,
    monthNumber: currentIndex + 1,
    totalMonths,
    cohortStartDate: cohortStart,
    monthStatuses: assignments.map((courseId, index) => ({
      monthNumber: index + 1,
      courseId: courseId || undefined,
      status: getMonthAvailabilityStatus({
        cohortStartDate: cohortStart,
        currentDate,
        monthIndex: index,
      }),
    })),
  }
}

export const listenToCompanyProgram = (
  profile: UserProfile | null,
  onData: (company: CompanyProgramInfo | null) => void,
  onError: (error: Error) => void,
): Unsubscribe | null => {
  if (!profile || profile.role !== UserRole.PAID_MEMBER) return null

  if (profile.companyId) {
    const companyRef = doc(db, 'organizations', profile.companyId)
    return onSnapshot(
      companyRef,
      snapshot => {
        if (!snapshot.exists()) {
          onData(null)
          return
        }
        const data = snapshot.data()
        onData({
          id: snapshot.id,
          programDuration: data.programDuration,
          courseAssignments: data.courseAssignments || data.defaultCourses || [],
          monthlyCourseAssignments: data.monthlyCourseAssignments || undefined,
          courseAssignmentStructure: data.courseAssignmentStructure || undefined,
          cohortStartDate: data.cohortStartDate || null,
        })
      },
      error => onError(error as Error),
    )
  }

  if (profile.companyCode) {
    const companyQuery = query(collection(db, 'organizations'), where('code', '==', profile.companyCode))
    return onSnapshot(
      companyQuery,
      snapshot => {
        const docSnapshot = snapshot.docs[0]
        if (!docSnapshot) {
          onData(null)
          return
        }
        const data = docSnapshot.data()
        onData({
          id: docSnapshot.id,
          programDuration: data.programDuration,
          courseAssignments: data.courseAssignments || data.defaultCourses || [],
          monthlyCourseAssignments: data.monthlyCourseAssignments || undefined,
          courseAssignmentStructure: data.courseAssignmentStructure || undefined,
          cohortStartDate: data.cohortStartDate || null,
        })
      },
      error => onError(error as Error),
    )
  }

  onData(null)
  return null
}
