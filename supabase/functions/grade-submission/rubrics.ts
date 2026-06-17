// Rubric registry for the grade-submission Edge Function.
//
// Merged from the per-pillar files below. Each rubric is keyed by the EXACT
// component_id (= the artefact's filename without ".html", e.g.
// "transforming-business-case-study-1"), so every submission grades against its
// OWN rubric. Edit the per-pillar files, not this one.
//
// Covers all four pillars: starter-kit (11), leading-self (10), innovation (9),
// transforming-business (10). Replaces the earlier registry, which keyed rubrics
// by unprefixed names and mis-mapped transforming-business artefacts onto
// starter-kit rubrics (Kodak/SARS/Opportunity Map) - a grading bug.

import { RUBRICS_STARTER_KIT } from './_rubrics_starter_kit.ts'
import { RUBRICS_LEADING_SELF } from './_rubrics_leading_self.ts'
import { RUBRICS_INNOVATION } from './_rubrics_innovation.ts'
import { RUBRICS_TRANSFORMING_BUSINESS } from './_rubrics_transforming_business.ts'

export const RUBRICS: Record<string, string> = {
  ...RUBRICS_STARTER_KIT,
  ...RUBRICS_LEADING_SELF,
  ...RUBRICS_INNOVATION,
  ...RUBRICS_TRANSFORMING_BUSINESS,
}

/**
 * Look up the grading rubric for a submission by its component_id. Returns null
 * when no rubric exists for that artefact (the Edge Function then skips grading
 * rather than grading against the wrong standard).
 */
export function rubricForComponent(componentId: string | null | undefined): string | null {
  if (!componentId) return null
  return RUBRICS[componentId] ?? null
}
