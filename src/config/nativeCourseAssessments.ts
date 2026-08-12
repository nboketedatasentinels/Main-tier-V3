/**
 * Native course Pre/Post assessment catalog (imported from SurveyMonkey).
 * Regenerate with: node scripts/import-native-course-assessments.mjs
 */
import catalogJson from './nativeCourseAssessments.catalog.json'

export type CourseAssessmentKind = 'pre' | 'post'
export type CourseAssessmentAudience = 'self' | 'external_rater'

export type CourseAssessmentQuestion =
  | { type: 'info'; text: string }
  | { type: 'rating'; text: string; min: number; max: number }
  | { type: 'single_choice'; text: string; choices: string[] }
  | { type: 'short_text' | 'long_text'; text: string }

export interface CourseAssessmentDefinition {
  surveyMonkeyId: string
  title: string
  kind: CourseAssessmentKind
  audience: CourseAssessmentAudience
  courseKey: string
  courseMatchers: string[]
  questions: CourseAssessmentQuestion[]
}

export const NATIVE_COURSE_ASSESSMENTS = catalogJson as CourseAssessmentDefinition[]

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export const findNativeCourseAssessment = (
  courseTitle: string | null | undefined,
  kind: CourseAssessmentKind,
  audience: CourseAssessmentAudience = 'self',
): CourseAssessmentDefinition | null => {
  if (!courseTitle?.trim()) return null
  const haystack = normalize(courseTitle)
  const candidates = NATIVE_COURSE_ASSESSMENTS.filter(
    (row) => row.kind === kind && row.audience === audience,
  )

  let best: CourseAssessmentDefinition | null = null
  let bestLen = 0
  for (const row of candidates) {
    for (const matcher of [row.courseKey, ...row.courseMatchers]) {
      const needle = normalize(matcher)
      if (!needle) continue
      if ((haystack.includes(needle) || needle.includes(haystack)) && needle.length > bestLen) {
        best = row
        bestLen = needle.length
      }
    }
  }
  return best
}

export const listNativeCourseAssessments = (
  kind?: CourseAssessmentKind,
  audience?: CourseAssessmentAudience,
): CourseAssessmentDefinition[] =>
  NATIVE_COURSE_ASSESSMENTS.filter((row) => {
    if (kind && row.kind !== kind) return false
    if (audience && row.audience !== audience) return false
    return true
  })
