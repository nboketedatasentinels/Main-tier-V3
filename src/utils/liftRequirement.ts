import type { JourneyType } from '@/config/pointsConfig'
import { isLeadershipCouncilJourney } from '@/utils/journeyType'
import { resolveRole } from '@/utils/role'

/** Learner roles that must complete LIFT when on a mentor/coach journey. */
const LEARNER_ROLES = new Set(['free_user', 'paid_member', 'user'])

/**
 * LIFT is compulsory for normal users from the 3-month journey up - the
 * programmes where mentor and/or coach are available (3M / 6M / 9M).
 * Mentors, coaches, partners, and admins are never blocked.
 */
export const requiresMandatoryLiftAssessment = (params: {
 role?: string | null
 journeyType?: JourneyType | null
}): boolean => {
 const role = resolveRole(params.role)
 if (!role || !LEARNER_ROLES.has(role)) return false
 return isLeadershipCouncilJourney(params.journeyType)
}
