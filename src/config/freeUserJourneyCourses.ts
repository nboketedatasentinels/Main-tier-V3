import type { MonthlyCourseAssignments } from '@/utils/monthlyCourseAssignments'
import { weekToMonth } from '@/utils/journeyType'

/**
 * Default monthly catalogue courses for free (non-org) learners.
 * These are 3-Month journey course packs so the weekly checklist Podcast
 * activity plays the same T4L-C** episodes paid 3M orgs use.
 *
 * Month 1–3 map to the complementary / starter pathway already exposed on
 * My Courses for free users.
 */
export const FREE_USER_3M_MONTHLY_ASSIGNMENTS: MonthlyCourseAssignments = {
  '1': 'think-like-an-owner',
  '2': 'project-management-for-leaders',
  '3': 'transformational-leadership',
}

/** Catalogue course for a free-user checklist week (4W → month 1, etc.). */
export function resolveFreeUserCatalogueCourseId(
  weekOrMonth: number,
  opts?: { treatAsMonth?: boolean },
): string {
  const month = opts?.treatAsMonth
    ? Math.max(1, weekOrMonth)
    : weekToMonth(weekOrMonth)
  const clamped = Math.min(3, Math.max(1, month))
  return (
    FREE_USER_3M_MONTHLY_ASSIGNMENTS[String(clamped)] ||
    FREE_USER_3M_MONTHLY_ASSIGNMENTS['1'] ||
    'think-like-an-owner'
  )
}
