import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { auth, db } from '@/services/firebase'
import {
  COMPLEMENTARY_COURSES,
  COMPLEMENTARY_COURSE_IDS,
  COMPLEMENTARY_COURSE_TITLES,
} from '@/utils/membership'
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

const buildComplementaryAssignmentLookup = async (userId: string) => {
  const assignmentsRef = collection(db, 'user_courses')
  const lookup = new Set<string>()

  const titleQuery =
    COMPLEMENTARY_COURSE_TITLES.length > 0
      ? query(assignmentsRef, where('user_id', '==', userId), where('title', 'in', COMPLEMENTARY_COURSE_TITLES))
      : null
  const idQuery =
    COMPLEMENTARY_COURSE_IDS.length > 0
      ? query(assignmentsRef, where('user_id', '==', userId), where('courseId', 'in', COMPLEMENTARY_COURSE_IDS))
      : null
  const legacyIdQuery =
    COMPLEMENTARY_COURSE_IDS.length > 0
      ? query(assignmentsRef, where('user_id', '==', userId), where('course_id', 'in', COMPLEMENTARY_COURSE_IDS))
      : null

  const [titleSnapshot, idSnapshot, legacyIdSnapshot] = await Promise.all([
    titleQuery ? getDocs(titleQuery) : Promise.resolve(null),
    idQuery ? getDocs(idQuery) : Promise.resolve(null),
    legacyIdQuery ? getDocs(legacyIdQuery) : Promise.resolve(null),
  ])

  const snapshots = [titleSnapshot, idSnapshot, legacyIdSnapshot].filter(Boolean) as Array<
    Awaited<ReturnType<typeof getDocs>>
  >

  snapshots.forEach(snapshot => {
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Record<string, unknown>
      const title = typeof data.title === 'string' ? data.title.trim().toLowerCase() : ''
      const courseId = typeof data.courseId === 'string' ? data.courseId.trim().toLowerCase() : ''
      const legacyCourseId = typeof data.course_id === 'string' ? data.course_id.trim().toLowerCase() : ''
      if (title) lookup.add(`title:${title}`)
      if (courseId) lookup.add(`id:${courseId}`)
      if (legacyCourseId) lookup.add(`id:${legacyCourseId}`)
    })
  })

  return lookup
}

const hasMatchingAuthUser = (userId: string) => {
  const currentUserId = auth.currentUser?.uid
  if (!currentUserId || currentUserId !== userId) {
    console.warn('🟠 [CourseAssignment] Skipping complementary course assignment due to auth mismatch', {
      userId,
      currentUserId,
    })
    return false
  }
  return true
}

/**
 * Check whether any complementary course is already assigned to a user.
 */
export const hasComplementaryCourseAssigned = async (userId: string): Promise<boolean> => {
  if (!hasMatchingAuthUser(userId)) return false
  try {
    const lookup = await buildComplementaryAssignmentLookup(userId)
    return lookup.size > 0
  } catch (error) {
    console.error('🔴 [CourseAssignment] Failed to check complementary course assignment', {
      userId,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      raw: error,
    })
    return false
  }
}

/**
 * Assign complementary courses to a user if they are not already assigned.
 */
export const assignComplementaryCoursesToUser = async (userId: string): Promise<boolean> => {
  if (!hasMatchingAuthUser(userId)) return false
  try {
    const assignmentLookup = await buildComplementaryAssignmentLookup(userId)
    let assigned = false

    for (const course of COMPLEMENTARY_COURSES) {
      const normalizedTitle = course.title.trim().toLowerCase()
      const normalizedId = course.id.trim().toLowerCase()
      if (assignmentLookup.has(`title:${normalizedTitle}`) || assignmentLookup.has(`id:${normalizedId}`)) {
        continue
      }

      const courseDetails = COURSE_DETAILS_MAPPING[course.title]
      const courseMetadata = COURSE_METADATA_MAPPING[course.title]

      if (!courseDetails || !courseMetadata) {
        console.warn('🟠 [CourseAssignment] Missing course mapping data', {
          userId,
          title: course.title,
          hasDetails: Boolean(courseDetails),
          hasMetadata: Boolean(courseMetadata),
        })
      }

      await addDoc(collection(db, 'user_courses'), {
        user_id: userId,
        courseId: course.id,
        title: course.title,
        description: courseDetails?.description ?? '',
        link: courseDetails?.link ?? '',
        status: 'assigned',
        source: 'user',
        assignedAt: serverTimestamp(),
        progress: 0,
        estimatedMinutes: courseMetadata?.estimatedMinutes ?? 0,
        difficulty: courseMetadata?.difficulty ?? 'Beginner',
      })

      assigned = true
      assignmentLookup.add(`title:${normalizedTitle}`)
      assignmentLookup.add(`id:${normalizedId}`)
    }

    if (assigned) {
      console.log('🟢 [CourseAssignment] Assigned complementary courses to user', { userId })
    } else {
      console.log('🟡 [CourseAssignment] Complementary courses already assigned', { userId })
    }

    return assigned
  } catch (error) {
    console.error('🔴 [CourseAssignment] Failed to assign complementary courses', {
      userId,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
      raw: error,
    })
    return false
  }
}

export const mergeOrganizationCourseIdsWithComplementary = (organizationCourseIds: string[]): string[] => {
  const merged = new Set<string>(organizationCourseIds)
  COMPLEMENTARY_COURSE_IDS.forEach(courseId => merged.add(courseId))
  return Array.from(merged)
}

export const getComplementaryCourseIdsForOrganization = (organizationCourseIds: string[]): string[] => {
  const organizationSet = new Set(organizationCourseIds)
  return COMPLEMENTARY_COURSE_IDS.filter(courseId => !organizationSet.has(courseId))
}
