import { TransformationTier, UserRole } from '@/types'
import type { UserProfile } from '@/types'

type MembershipProfile = Pick<UserProfile, 'role' | 'membershipStatus' | 'transformationTier'> | null | undefined

export const FREE_TIER_COURSE_TITLE = 'Transformational Leadership'

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

export const canAccessCourse = (profile: MembershipProfile, courseTitle?: string | null): boolean => {
  if (!courseTitle) return false
  if (!isFreeUser(profile)) return true
  return courseTitle.trim().toLowerCase() === FREE_TIER_COURSE_TITLE.toLowerCase()
}
