import { TransformationTier, UserRole } from '@/types'
import type { UserProfile } from '@/types'

type MembershipProfile = Pick<UserProfile, 'role' | 'membershipStatus' | 'transformationTier'> | null | undefined

export type ComplementaryCourseConfig = {
  id: string
  title: string
}

export const COMPLEMENTARY_COURSES: ComplementaryCourseConfig[] = [
  {
    id: 'transformational-leadership',
    title: 'Transformational Leadership',
  },
]

export const COMPLEMENTARY_COURSE_IDS = COMPLEMENTARY_COURSES.map(course => course.id)
export const COMPLEMENTARY_COURSE_TITLES = COMPLEMENTARY_COURSES.map(course => course.title)

const normalizeCourseKey = (value?: string | null) => (value ?? '').trim().toLowerCase()

export const isComplementaryCourse = (courseTitle?: string | null, courseId?: string | null): boolean => {
  const normalizedTitle = normalizeCourseKey(courseTitle)
  const normalizedId = normalizeCourseKey(courseId)
  return (
    (Boolean(normalizedTitle) &&
      COMPLEMENTARY_COURSE_TITLES.some(title => normalizeCourseKey(title) === normalizedTitle)) ||
    (Boolean(normalizedId) && COMPLEMENTARY_COURSE_IDS.some(id => normalizeCourseKey(id) === normalizedId))
  )
}

export const isFreeUser = (profile?: MembershipProfile): boolean => {
  const roleValue = profile?.role?.toString().toLowerCase()
  const membershipStatus = profile?.membershipStatus?.toString().toLowerCase()
  const transformationTier = profile?.transformationTier?.toString().toLowerCase()

  if (roleValue === UserRole.PAID_MEMBER) return false
  if (membershipStatus === 'paid') return false
  if (
    transformationTier === TransformationTier.CORPORATE_MEMBER ||
    transformationTier === TransformationTier.CORPORATE_LEADER
  ) {
    return false
  }

  return (
    roleValue === UserRole.FREE_USER ||
    membershipStatus === 'free' ||
    transformationTier === TransformationTier.INDIVIDUAL_FREE
  )
}

export const canAccessCourse = (
  profile: MembershipProfile,
  courseTitle?: string | null,
  courseId?: string | null
): boolean => {
  if (!courseTitle && !courseId) return false
  if (isComplementaryCourse(courseTitle, courseId)) return true
  if (!isFreeUser(profile)) return true
  return false
}
