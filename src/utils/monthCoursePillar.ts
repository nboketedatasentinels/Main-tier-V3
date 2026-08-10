import { getCatalogueCourseById, type CataloguePillarCode } from '@/config/courseCatalogue'
import type { Pillar } from '@/types/pillar'
import type { MonthlyCourseAssignments } from '@/utils/monthlyCourseAssignments'

/** Catalogue letter codes → checklist / My Courses pillar keys. */
export const CATALOGUE_PILLAR_TO_PILLAR: Record<CataloguePillarCode, Pillar> = {
  L: 'leading_self',
  I: 'innovation_technology',
  F: 'fostering',
  T: 'transforming_business',
  G: 'starter_kit',
}

/** Quarter-end months on 3M / 6M / 9M — Capstone / Case Study / Practical are Pass/Fail. */
export const PROGRAMME_PASS_FAIL_MONTHS = new Set([3, 6, 9])

export const isProgrammePassFailMonth = (month: number): boolean =>
  PROGRAMME_PASS_FAIL_MONTHS.has(month)

export const cataloguePillarToPillar = (
  code?: CataloguePillarCode | null,
): Pillar | null => {
  if (!code) return null
  return CATALOGUE_PILLAR_TO_PILLAR[code] ?? null
}

/**
 * Pillar for a checklist month from the org's assigned course that month.
 * Month 1 course → that course's pillar → Month 1 capstone/case study/practicals.
 */
export const resolvePillarForMonth = (
  month: number,
  monthlyAssignments?: MonthlyCourseAssignments | null,
): Pillar | null => {
  if (!month || month < 1 || !monthlyAssignments) return null
  const courseId = monthlyAssignments[String(month)]?.trim()
  if (!courseId) return null
  const course = getCatalogueCourseById(courseId)
  return cataloguePillarToPillar(course?.pillar ?? null)
}
