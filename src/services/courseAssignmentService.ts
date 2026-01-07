import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { FREE_TIER_COURSE_TITLE } from '@/utils/membership'
import { COURSE_DETAILS_MAPPING, COURSE_METADATA_MAPPING } from '@/utils/courseMappings'

/**
 * user_courses collection schema
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

/**
 * Check whether the free course is already assigned to a user.
 */
export const hasFreeCourseAssigned = async (userId: string): Promise<boolean> => {
  try {
    const assignmentsRef = collection(db, 'user_courses')
    const assignmentsQuery = query(
      assignmentsRef,
      where('user_id', '==', userId),
      where('title', '==', FREE_TIER_COURSE_TITLE),
      limit(1)
    )
    const snapshot = await getDocs(assignmentsQuery)
    return !snapshot.empty
  } catch (error) {
    console.error('🔴 [CourseAssignment] Failed to check free course assignment', {
      userId,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      raw: error,
    })
    return false
  }
}

/**
 * Assign the free course to a user if it is not already assigned.
 */
export const assignFreeCourseToUser = async (userId: string): Promise<boolean> => {
  try {
    const alreadyAssigned = await hasFreeCourseAssigned(userId)
    if (alreadyAssigned) {
      console.log('🟡 [CourseAssignment] Free course already assigned', { userId })
      return false
    }

    const courseDetails = COURSE_DETAILS_MAPPING[FREE_TIER_COURSE_TITLE]
    const courseMetadata = COURSE_METADATA_MAPPING[FREE_TIER_COURSE_TITLE]

    if (!courseDetails || !courseMetadata) {
      console.warn('🟠 [CourseAssignment] Missing course mapping data', {
        userId,
        title: FREE_TIER_COURSE_TITLE,
        hasDetails: Boolean(courseDetails),
        hasMetadata: Boolean(courseMetadata),
      })
    }

    await addDoc(collection(db, 'user_courses'), {
      user_id: userId,
      title: FREE_TIER_COURSE_TITLE,
      description: courseDetails?.description ?? '',
      link: courseDetails?.link ?? '',
      status: 'assigned',
      source: 'user',
      assignedAt: serverTimestamp(),
      progress: 0,
      estimatedMinutes: courseMetadata?.estimatedMinutes ?? 0,
      difficulty: courseMetadata?.difficulty ?? 'Beginner',
    })

    console.log('🟢 [CourseAssignment] Assigned free course to user', { userId })
    return true
  } catch (error) {
    console.error('🔴 [CourseAssignment] Failed to assign free course', {
      userId,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      raw: error,
    })
    return false
  }
}
