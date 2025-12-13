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
}

const normalizeDate = (value?: Timestamp | Date | null): Date | null => {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  return value
}

const calculateMonthIndex = (startDate: Date, currentDate = new Date()): number => {
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

const getProgramMonths = (courseAssignments: string[] = [], programDuration?: string): number => {
  if (courseAssignments.length) return courseAssignments.length
  const parsedDuration = Number(programDuration)
  if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
    return Math.ceil(parsedDuration)
  }
  return 0
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
  const assignments = company.courseAssignments || []
  const totalMonths = getProgramMonths(assignments, company.programDuration)

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
    }
  }

  return {
    status: 'in_progress',
    course: courseDetails,
    monthNumber: currentIndex + 1,
    totalMonths,
    cohortStartDate: cohortStart,
  }
}

export const listenToCompanyProgram = (
  profile: UserProfile | null,
  onData: (company: CompanyProgramInfo | null) => void,
  onError: (error: Error) => void,
): Unsubscribe | null => {
  if (!profile || profile.role !== UserRole.PAID_MEMBER) return null

  if (profile.companyId) {
    const companyRef = doc(db, 'companies', profile.companyId)
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
          cohortStartDate: data.cohortStartDate || null,
        })
      },
      error => onError(error as Error),
    )
  }

  if (profile.companyCode) {
    const companyQuery = query(collection(db, 'companies'), where('code', '==', profile.companyCode))
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
          cohortStartDate: data.cohortStartDate || null,
        })
      },
      error => onError(error as Error),
    )
  }

  onData(null)
  return null
}
