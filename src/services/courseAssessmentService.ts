import { supabase } from '@/services/supabase'
import type {
  CourseAssessmentAudience,
  CourseAssessmentDefinition,
  CourseAssessmentKind,
} from '@/config/nativeCourseAssessments'
import {
  canRoleSubmitKind,
  raterRelationshipLabel,
  raterRoleToAudience,
  type CourseAssessmentRaterRole,
} from '@/config/courseAssessmentRoles'
import { requestCourseAccessUnlock } from '@/services/courseAccessUnlockService'

export interface CourseAssessmentAnswers {
  [questionIndex: string]: number | string
}

export interface CourseAssessmentResponseRow {
  id: string
  respondent_id: string
  subject_user_id: string
  course_key: string
  course_title: string | null
  kind: CourseAssessmentKind
  audience: CourseAssessmentAudience
  rater_role: CourseAssessmentRaterRole | null
  assessment_title: string | null
  surveymonkey_id: string | null
  answers: CourseAssessmentAnswers
  score_sum: number | null
  score_count: number | null
  score_avg: number | null
  rater_relationship: string | null
  submitted_at: string
}

export interface CourseAssessmentOrgAggregateRow {
  subject_user_id: string
  course_key: string
  course_title: string | null
  kind: CourseAssessmentKind
  rater_role: CourseAssessmentRaterRole | null
  audience: CourseAssessmentAudience
  score_avg: number | null
  score_count: number | null
  submitted_at: string
  respondent_id: string
}

const summarizeRatings = (answers: CourseAssessmentAnswers) => {
  const ratings = Object.values(answers).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  if (!ratings.length) {
    return { score_sum: null as number | null, score_count: null as number | null, score_avg: null as number | null }
  }
  const score_sum = ratings.reduce((acc, n) => acc + n, 0)
  const score_count = ratings.length
  return {
    score_sum,
    score_count,
    score_avg: Math.round((score_sum / score_count) * 100) / 100,
  }
}

export const getCourseAssessmentResponse = async (params: {
  respondentId: string
  subjectUserId: string
  courseKey: string
  kind: CourseAssessmentKind
  audience: CourseAssessmentAudience
}): Promise<CourseAssessmentResponseRow | null> => {
  const { data, error } = await supabase
    .from('course_assessment_responses')
    .select('*')
    .eq('respondent_id', params.respondentId)
    .eq('subject_user_id', params.subjectUserId)
    .eq('course_key', params.courseKey)
    .eq('kind', params.kind)
    .eq('audience', params.audience)
    .maybeSingle()

  if (error) throw error
  return (data as CourseAssessmentResponseRow | null) ?? null
}

export const hasCompletedSelfCourseAssessment = async (params: {
  userId: string
  courseKey: string
  kind: CourseAssessmentKind
}): Promise<boolean> => {
  const row = await getCourseAssessmentResponse({
    respondentId: params.userId,
    subjectUserId: params.userId,
    courseKey: params.courseKey,
    kind: params.kind,
    audience: 'self',
  })
  return Boolean(row)
}

/** All submissions about a learner (self + raters), optionally filtered. */
export const listCourseAssessmentsForSubject = async (params: {
  subjectUserId: string
  courseKey?: string
  kind?: CourseAssessmentKind
}): Promise<CourseAssessmentResponseRow[]> => {
  let query = supabase
    .from('course_assessment_responses')
    .select('*')
    .eq('subject_user_id', params.subjectUserId)
    .order('submitted_at', { ascending: false })

  if (params.courseKey) query = query.eq('course_key', params.courseKey)
  if (params.kind) query = query.eq('kind', params.kind)

  const { data, error } = await query
  if (error) throw error
  return (data as CourseAssessmentResponseRow[]) ?? []
}

/** Learner self Pre/Post completion map keyed by course_key. */
export const getSelfAssessmentStatusByCourse = async (
  userId: string,
): Promise<Record<string, { pre: boolean; post: boolean }>> => {
  const { data, error } = await supabase
    .from('course_assessment_responses')
    .select('course_key, kind')
    .eq('respondent_id', userId)
    .eq('subject_user_id', userId)
    .eq('audience', 'self')

  if (error) throw error

  const map: Record<string, { pre: boolean; post: boolean }> = {}
  for (const row of data ?? []) {
    const key = String((row as { course_key: string }).course_key)
    if (!map[key]) map[key] = { pre: false, post: false }
    const kind = (row as { kind: CourseAssessmentKind }).kind
    if (kind === 'pre') map[key].pre = true
    if (kind === 'post') map[key].post = true
  }
  return map
}

export const listCourseAssessmentsForSubjects = async (
  subjectUserIds: string[],
): Promise<CourseAssessmentOrgAggregateRow[]> => {
  if (!subjectUserIds.length) return []
  const { data, error } = await supabase
    .from('course_assessment_responses')
    .select(
      'subject_user_id, course_key, course_title, kind, rater_role, audience, score_avg, score_count, submitted_at, respondent_id',
    )
    .in('subject_user_id', subjectUserIds)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return (data as CourseAssessmentOrgAggregateRow[]) ?? []
}

/** Full rows including answers — required for matched Pre/Post report math. */
export const listCourseAssessmentResponsesForSubjects = async (
  subjectUserIds: string[],
): Promise<CourseAssessmentResponseRow[]> => {
  if (!subjectUserIds.length) return []
  const { data, error } = await supabase
    .from('course_assessment_responses')
    .select('*')
    .in('subject_user_id', subjectUserIds)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return (data as CourseAssessmentResponseRow[]) ?? []
}

export const submitCourseAssessmentResponse = async (params: {
  respondentId: string
  subjectUserId: string
  definition: CourseAssessmentDefinition
  raterRole: CourseAssessmentRaterRole
  courseTitle?: string | null
  answers: CourseAssessmentAnswers
  raterRelationship?: string | null
}): Promise<CourseAssessmentResponseRow> => {
  if (!canRoleSubmitKind(params.raterRole, params.definition.kind)) {
    throw new Error(
      `${raterRelationshipLabel(params.raterRole)} cannot submit ${params.definition.kind}-course assessments`,
    )
  }

  const expectedAudience = raterRoleToAudience(params.raterRole)
  if (params.definition.audience !== expectedAudience) {
    throw new Error(
      `Assessment audience mismatch: expected ${expectedAudience} for ${params.raterRole}`,
    )
  }

  if (params.raterRole === 'learner' && params.respondentId !== params.subjectUserId) {
    throw new Error('Learner assessments must be about yourself')
  }
  if (params.raterRole !== 'learner' && params.respondentId === params.subjectUserId) {
    throw new Error('External raters must rate a learner, not themselves')
  }

  const scores = summarizeRatings(params.answers)
  const payload: Record<string, unknown> = {
    respondent_id: params.respondentId,
    subject_user_id: params.subjectUserId,
    course_key: params.definition.courseKey,
    course_title: params.courseTitle ?? params.definition.courseKey,
    kind: params.definition.kind,
    audience: params.definition.audience,
    rater_role: params.raterRole,
    assessment_title: params.definition.title,
    surveymonkey_id: params.definition.surveyMonkeyId,
    answers: params.answers,
    score_sum: scores.score_sum,
    score_count: scores.score_count,
    score_avg: scores.score_avg,
    rater_relationship:
      params.raterRelationship ??
      (params.raterRole === 'learner' ? null : raterRelationshipLabel(params.raterRole)),
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('course_assessment_responses')
    .upsert(payload, {
      onConflict: 'respondent_id,subject_user_id,course_key,kind,audience',
    })
    .select('*')
    .single()

  if (error) throw error

  const row = data as CourseAssessmentResponseRow

  // Learner Pre → request course unlock (Wix stub until API is live)
  if (params.raterRole === 'learner' && params.definition.kind === 'pre') {
    try {
      await requestCourseAccessUnlock({
        userId: params.subjectUserId,
        courseKey: params.definition.courseKey,
        courseTitle: params.courseTitle,
      })
    } catch (err) {
      console.warn('[submitCourseAssessmentResponse] unlock stub failed', err)
    }
  }

  return row
}
