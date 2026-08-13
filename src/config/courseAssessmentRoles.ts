/**
 * Who fills Pre/Post course assessments (per learner × per course).
 *
 * Learner: Pre before course unlock · Post after course complete
 * Line manager: Pre + Post about the learner
 * Mentor: Pre + Post about the learner (org programme courses)
 * Coach: Pre + Post about the learner (org programme courses)
 * Partner: Pre + Post (needed for matched observer growth; Post still emphasized near journey end)
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
  mentor: { pre: true, post: true, label: 'Mentor' },
  coach: { pre: true, post: true, label: 'Coach' },
  // Partner Pre enabled so matched Manager+Partner growth is computable (sample methodology).
  partner: { pre: true, post: true, label: 'Partner' },
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
