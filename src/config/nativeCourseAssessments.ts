/**
 * Native course Pre/Post assessment catalog.
 *
 * Catalog rows map course titles → survey instruments + question snapshots.
 * Runtime uses the catalog only (SurveyMonkey live hydrate retired).
 * Pre and Post for the same courseKey + audience share one instrument:
 * Post reuses Pre question wording so growth math is like-for-like.
 *
 * Regenerate snapshot: node scripts/import-native-course-assessments.mjs
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

const questionFingerprint = (questions: CourseAssessmentQuestion[]): string =>
  questions
    .filter((q) => q.type !== 'info')
    .map((q) => `${q.type}:${q.text}`)
    .join('|')

/**
 * Product rule: Pre and Post are the same instrument (self / rater language).
 * When Post differs from Pre for the same courseKey+audience, reuse Pre questions.
 */
export const alignPostInstrumentToPre = (
  definition: CourseAssessmentDefinition,
): CourseAssessmentDefinition => {
  if (definition.kind !== 'post') return definition
  const pre = NATIVE_COURSE_ASSESSMENTS.find(
    (row) =>
      row.kind === 'pre' &&
      row.audience === definition.audience &&
      row.courseKey === definition.courseKey,
  )
  if (!pre?.questions?.length) return definition
  if (questionFingerprint(pre.questions) === questionFingerprint(definition.questions)) {
    return definition
  }
  return {
    ...definition,
    questions: pre.questions.map((q) => ({ ...q })),
  }
}

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
  let bestScore = -1
  for (const row of candidates) {
    for (const matcher of [row.courseKey, ...row.courseMatchers]) {
      const needle = normalize(matcher)
      if (!needle) continue
      if (!(haystack.includes(needle) || needle.includes(haystack))) continue

      const ratingCount = row.questions.filter((q) => q.type === 'rating').length
      const sizePenalty =
        ratingCount === 0 ? 1000 : ratingCount > 20 ? ratingCount * 10 : ratingCount < 3 ? 50 : 0
      const score = needle.length * 100 - sizePenalty
      if (score > bestScore) {
        best = row
        bestScore = score
      }
    }
  }
  return best ? alignPostInstrumentToPre(best) : null
}

export const listNativeCourseAssessments = (
  kind?: CourseAssessmentKind,
  audience?: CourseAssessmentAudience,
): CourseAssessmentDefinition[] =>
  NATIVE_COURSE_ASSESSMENTS.filter((row) => {
    if (kind && row.kind !== kind) return false
    if (audience && row.audience !== audience) return false
    return true
  }).map(alignPostInstrumentToPre)
