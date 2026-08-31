import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'
import { isJourneyType } from '@/utils/journeyType'
import type { OrganizationUserProfile } from '@/types/admin'

export type AdminFollowUpRiskReason = 'never_joined' | 'low_points' | 'inactive'

export interface AdminFollowUpRisk {
  atRisk: boolean
  reasons: AdminFollowUpRiskReason[]
  labels: string[]
}

const REASON_LABELS: Record<AdminFollowUpRiskReason, string> = {
  never_joined: 'Never joined / no activity',
  low_points: 'Below points target',
  inactive: 'Membership inactive',
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const resolveJourneyType = (raw?: string | null): JourneyType | null => {
  if (!raw) return null
  return isJourneyType(raw) ? raw : null
}

/**
 * Admin Follow-up is only for at-risk learners:
 * - never joined / no last activity
 * - inactive membership
 * - low points vs expected journey pace (< 75% of elapsed pass-mark pace)
 */
export const evaluateAdminFollowUpRisk = (
  user: Pick<OrganizationUserProfile, 'lastActive' | 'points' | 'membershipStatus' | 'createdAt'>,
  opts?: {
    journeyType?: string | null
    cohortStartDate?: string | Date | null
    now?: Date
  },
): AdminFollowUpRisk => {
  const reasons: AdminFollowUpRiskReason[] = []
  const now = opts?.now ?? new Date()

  if (!user.lastActive) {
    reasons.push('never_joined')
  }

  if (user.membershipStatus === 'inactive') {
    reasons.push('inactive')
  }

  const journeyType = resolveJourneyType(opts?.journeyType ?? null)
  const cohortRaw = opts?.cohortStartDate
  const cohortStart =
    cohortRaw instanceof Date
      ? cohortRaw
      : typeof cohortRaw === 'string' && cohortRaw
        ? new Date(cohortRaw)
        : null

  if (journeyType && cohortStart && !Number.isNaN(cohortStart.getTime())) {
    const meta = JOURNEY_META[journeyType]
    const daysElapsed = Math.max(0, Math.floor((now.getTime() - cohortStart.getTime()) / MS_PER_DAY))
    // Give a 3-day grace after cohort start before points pace applies.
    if (daysElapsed >= 3) {
      const weeksElapsed = Math.min(meta.weeks, Math.max(1, Math.ceil(daysElapsed / 7)))
      const expectedPace = (meta.passMarkPoints / meta.weeks) * weeksElapsed
      const lowBar = expectedPace * 0.75
      const points = typeof user.points === 'number' && Number.isFinite(user.points) ? user.points : 0
      if (points < lowBar) {
        reasons.push('low_points')
      }
    }
  }

  const unique = Array.from(new Set(reasons))
  return {
    atRisk: unique.length > 0,
    reasons: unique,
    labels: unique.map((r) => REASON_LABELS[r]),
  }
}

/** Pending invites have never joined - always eligible for partner follow-up. */
export const pendingInviteFollowUpRisk = (): AdminFollowUpRisk => ({
  atRisk: true,
  reasons: ['never_joined'],
  labels: [REASON_LABELS.never_joined],
})

/** Map risk reasons onto the Follow-up issue chips used in the modal. */
export const followUpIssuesFromRisk = (risk: AdminFollowUpRisk): string[] => {
  const issues: string[] = []
  if (risk.reasons.includes('never_joined')) issues.push('Not active', 'Incomplete onboarding')
  if (risk.reasons.includes('low_points')) issues.push('Below points target', 'Slow progress')
  if (risk.reasons.includes('inactive')) issues.push('Membership lapsed', 'Low engagement')
  return Array.from(new Set(issues))
}
