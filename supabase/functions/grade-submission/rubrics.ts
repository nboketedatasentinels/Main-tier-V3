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
  if (RUBRICS[componentId]) return RUBRICS[componentId]
  // Course podcast written assessments share a generic advisory rubric.
  if (componentId.startsWith('course-podcast-')) {
    return [
      'You are grading a Transformation Leader course-podcast written assessment.',
      'The submission includes "What good looks like" plus the learner answers.',
      'Score 0-100. Pass if the answers substantively address the questions with concrete workplace examples.',
      'Fail if answers are generic, empty, or ignore the standard.',
      'Write feedbackForPartner and feedback that EXPLAINS WHY the score was given,',
      'citing the standard and specific gaps or strengths — a human may disagree and must understand your reasoning.',
      'Return JSON: { score, feedback, pass }.',
    ].join(' ')
  }
  return null
}
