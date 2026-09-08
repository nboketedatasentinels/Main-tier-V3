import type { JourneyType } from '@/config/pointsConfig'
import { resolveRole } from '@/utils/role'

/** Learner roles that must complete LIFT before entering the app. */
const LEARNER_ROLES = new Set(['free_user', 'paid_member', 'user'])

/**
 * LIFT is compulsory for every learner (free or paid, any journey including 4W/6W).
 * Mentors, coaches, partners, and admins are never blocked.
 *
 * `journeyType` is accepted for call-site compatibility but does not gate the requirement.
 */
export const requiresMandatoryLiftAssessment = (params: {
  role?: string | null
  journeyType?: JourneyType | null
}): boolean => {
  const role = resolveRole(params.role)
  if (!role || !LEARNER_ROLES.has(role)) return false
  return true
}
