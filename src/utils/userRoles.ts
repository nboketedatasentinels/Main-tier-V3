import { PartnerUser } from '@/hooks/usePartnerDashboardData'
import { isAdminLike } from '@/utils/permissions'

/**
 * Checks if a user has a leader role (mentor or team_leader).
 * Note: In some parts of the system, 'user' is also used for mentors,
 * but specifically checking for 'mentor' and 'team_leader' is the preferred pattern.
 */
export const isLeader = (user: PartnerUser): boolean => {
  return user.role === 'mentor' || user.role === 'team_leader' || user.role === 'user'
}

/**
 * Checks if a user is currently at risk based on their riskStatus.
 */
export const isAtRisk = (user: PartnerUser): boolean => {
  return ['watch', 'concern', 'critical', 'at_risk'].includes(user.riskStatus)
}

/**
 * Checks if a profile can approve points (uses consolidated admin check).
 */
export const canApprove = (profile: any): boolean => {
  return isAdminLike(profile)
}
