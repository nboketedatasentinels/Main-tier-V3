/**
 * Who fills Pre/Post course assessments (per learner × per course).
 *
 * Learner: Pre before course unlock · Post after course complete
 * Line manager: Pre + Post about the learner
 * Mentor / Coach / Partner: Post only (product call)
 */
import type { CourseAssessmentKind } from '@/config/nativeCourseAssessments'

export type CourseAssessmentRaterRole =
  | 'learner'
  | 'line_manager'
  | 'mentor'
  | 'coach'
  | 'partner'

export type { CourseAssessmentKind }

export const COURSE_ASSESSMENT_ROLE_MATRIX: Record<
  CourseAssessmentRaterRole,
  { pre: boolean; post: boolean; label: string }
> = {
  learner: { pre: true, post: true, label: 'Learner' },
  line_manager: { pre: true, post: true, label: 'Line manager' },
  mentor: { pre: false, post: true, label: 'Mentor' },
  coach: { pre: false, post: true, label: 'Coach' },
  partner: { pre: false, post: true, label: 'Partner' },
}

export const canRoleSubmitKind = (
  role: CourseAssessmentRaterRole,
  kind: CourseAssessmentKind,
): boolean => Boolean(COURSE_ASSESSMENT_ROLE_MATRIX[role]?.[kind])

export const raterRoleToAudience = (
  role: CourseAssessmentRaterRole,
): 'self' | 'external_rater' => (role === 'learner' ? 'self' : 'external_rater')

export const raterRelationshipLabel = (role: CourseAssessmentRaterRole): string =>
  COURSE_ASSESSMENT_ROLE_MATRIX[role].label

/**
 * SurveyMonkey imports asked for name / email / relationship.
 * In-app raters already selected a learner and are signed in - skip those prompts.
 */
export const isInAppIdentityQuestion = (text: string): boolean => {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
  return (
    /^(participant'?s?\s+)?(full\s+)?name\b/.test(normalized) ||
    /^(your\s+)?name\b/.test(normalized) ||
    /^(participant'?s?\s+)?email\b/.test(normalized) ||
    /^(your\s+)?email\b/.test(normalized) ||
    /relationship\s+to\s+(the\s+)?participant/.test(normalized) ||
    /your\s+relationship/.test(normalized)
  )
}

/** Map app rater role onto the imported SurveyMonkey relationship wording when useful. */
export const raterRelationshipChoiceLabel = (role: CourseAssessmentRaterRole): string => {
  if (role === 'line_manager') return 'Manager'
  if (role === 'partner') return 'Partner'
  if (role === 'mentor') return 'Mentor'
  if (role === 'coach') return 'Coach'
  return raterRelationshipLabel(role)
}

/** Soft window: partner Post is encouraged near journey end (not a hard block). */
export const isPartnerPostWindowSuggested = (params: {
  journeyStatus?: string | null
  currentWeek?: number | null
  totalWeeks?: number | null
}): boolean => {
  if (params.journeyStatus === 'completed') return true
  const week = params.currentWeek ?? 0
  const total = params.totalWeeks ?? 0
  if (total <= 0) return week > 0
  return week >= Math.max(1, Math.ceil(total * 0.75))
}
