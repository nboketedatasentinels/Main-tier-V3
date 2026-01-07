import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { COURSE_DETAILS_MAPPING, COURSE_METADATA_MAPPING } from '@/constants/courseCatalog'
import { db } from '@/services/firebase'
import { FREE_TIER_COURSE_TITLE } from '@/utils/membership'

/**
 * Firestore user_courses document schema:
 * - user_id: string (Firebase Auth UID)
 * - title: string (course title)
 * - description: string
 * - link: string (external course URL)
 * - status: string ("assigned", "in_progress", "completed")
 * - source: string ("user", "company", "personal", "organization")
 * - assignedAt: Timestamp
 * - progress: number (0-100)
 * - estimatedMinutes: number
 * - difficulty: string ("Beginner", "Intermediate", "Advanced")
 */
export interface UserCourseDocument {
  user_id: string
  title: string
  description: string
  link: string
  status: 'assigned' | 'in_progress' | 'completed'
  source: 'user' | 'company' | 'personal' | 'organization'
  assignedAt: ReturnType<typeof serverTimestamp>
  progress: number
  estimatedMinutes: number
  difficulty: string
}

const normalizeTitle = (value?: string | null) => (value || '').trim().toLowerCase()

/**
 * Checks if the complimentary free-tier course has already been assigned to the user.
 */
export const hasFreeCourseAssigned = async (userId: string): Promise<boolean> => {
  try {
    const snapshot = await getDocs(query(collection(db, 'user_courses'), where('user_id', '==', userId)))
    const normalizedFreeTitle = normalizeTitle(FREE_TIER_COURSE_TITLE)
    const hasAssignment = snapshot.docs.some((docSnap) => {
      const data = docSnap.data() as { title?: string }
      return normalizeTitle(data.title) === normalizedFreeTitle
    })
    console.log('🟣 [CourseAssignment] Checked free course assignment status', {
      userId,
      hasAssignment,
      checkedCount: snapshot.size,
    })
    return hasAssignment
  } catch (error) {
    console.error('🔴 [CourseAssignment] Failed to check free course assignment', {
      userId,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      raw: error,
    })
    throw error
  }
}

/**
 * Assigns the complimentary free-tier course to a user if it is not already present.
 */
export const assignFreeCourseToUser = async (userId: string): Promise<{ assigned: boolean }> => {
  try {
    const alreadyAssigned = await hasFreeCourseAssigned(userId)
    if (alreadyAssigned) {
      console.log('🟣 [CourseAssignment] Free course already assigned, skipping', { userId })
      return { assigned: false }
    }

    const courseDetails = COURSE_DETAILS_MAPPING[FREE_TIER_COURSE_TITLE]
    const courseMetadata = COURSE_METADATA_MAPPING[FREE_TIER_COURSE_TITLE]

    if (!courseDetails || !courseMetadata) {
      console.warn('🟠 [CourseAssignment] Free course metadata missing; using fallbacks', {
        userId,
        hasDetails: Boolean(courseDetails),
        hasMetadata: Boolean(courseMetadata),
      })
    }

    const payload: UserCourseDocument = {
      user_id: userId,
      title: FREE_TIER_COURSE_TITLE,
      description: courseDetails?.description ?? 'Complimentary course assignment.',
      link: courseDetails?.link ?? '',
      status: 'assigned',
      source: 'user',
      assignedAt: serverTimestamp(),
      progress: 0,
      estimatedMinutes: courseMetadata?.estimatedMinutes ?? 0,
      difficulty: courseMetadata?.difficulty ?? 'Beginner',
    }

    await addDoc(collection(db, 'user_courses'), payload)
    console.log('🟢 [CourseAssignment] Assigned free course to user', { userId })
    return { assigned: true }
  } catch (error) {
    console.error('🔴 [CourseAssignment] Failed to assign free course', {
      userId,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      raw: error,
    })
    return { assigned: false }
  }
}
