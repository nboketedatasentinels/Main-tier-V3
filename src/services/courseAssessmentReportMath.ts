/**
 * Course assessment report math.
 *
 * Rules (must stay correct):
 * - Ratings only (1–10); ignore text/choice answers
 * - Like-for-like items between Pre and Post (intersect by question text when known)
 * - Duplicate submissions for same rater × course × kind → average item scores
 * - Invalid response: near-uniform floor/ceiling pattern → exclude + flag
 * - Matched growth: only raters with BOTH Pre and Post
 * - Observer composite (Manager + Partner [+ mentor/coach when present]) anchors the verdict
 * - Self is reported separately (self-awareness lens), never as the headline verdict
 * - Anything we cannot compute correctly in-app is flagged for offline review
 */
import type { CourseAssessmentAnswers, CourseAssessmentResponseRow } from '@/services/courseAssessmentService'
import type { CourseAssessmentRaterRole } from '@/config/courseAssessmentRoles'
import { COURSE_ASSESSMENT_ROLE_MATRIX } from '@/config/courseAssessmentRoles'
import { findNativeCourseAssessment } from '@/config/nativeCourseAssessments'

export type ScoreBand = 'emerging' | 'developing' | 'proficient' | 'strong'

export const SCORE_BANDS: Array<{
  id: ScoreBand
  label: string
  min: number
  max: number
  description: string
}> = [
  { id: 'emerging', label: 'Emerging', min: 1, max: 3, description: 'Behavior rarely observed; needs foundational support.' },
  { id: 'developing', label: 'Developing', min: 4, max: 6, description: 'Behavior present but inconsistent.' },
  { id: 'proficient', label: 'Proficient', min: 7, max: 8, description: 'Behavior reliably observed.' },
  { id: 'strong', label: 'Strong', min: 9, max: 10, description: 'Behavior consistent and a model for others.' },
]

export const scoreBandFor = (avg: number | null | undefined): ScoreBand | null => {
  if (typeof avg !== 'number' || !Number.isFinite(avg)) return null
  if (avg <= 3) return 'emerging'
  if (avg <= 6) return 'developing'
  if (avg <= 8) return 'proficient'
  return 'strong'
}

export const scoreBandLabel = (avg: number | null | undefined): string => {
  const band = scoreBandFor(avg)
  if (!band) return '—'
  return SCORE_BANDS.find((b) => b.id === band)?.label ?? '—'
}

const round2 = (n: number) => Math.round(n * 100) / 100

const mean = (nums: number[]): number | null => {
  if (!nums.length) return null
  return round2(nums.reduce((a, b) => a + b, 0) / nums.length)
}

const isObserverRole = (role: CourseAssessmentRaterRole | null | undefined): boolean =>
  role === 'line_manager' || role === 'partner' || role === 'mentor' || role === 'coach'

/** Extract ordered numeric rating answers from a submission. */
export const extractRatingVector = (answers: CourseAssessmentAnswers): number[] => {
  const entries = Object.entries(answers)
    .map(([k, v]) => ({ index: Number(k), value: v }))
    .filter((e) => Number.isFinite(e.index))
    .sort((a, b) => a.index - b.index)

  return entries
    .map((e) => e.value)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 10)
}

/**
 * Near-uniform invalid pattern: almost all scores at floor (≤2) or ceiling (≥9)
 * with tiny spread — classic click-through / protest response.
 */
export const isInvalidRatingPattern = (ratings: number[]): boolean => {
  if (ratings.length < 4) return false
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const variance =
    ratings.reduce((acc, n) => acc + (n - avg) ** 2, 0) / ratings.length
  const atFloor = ratings.filter((n) => n <= 2).length / ratings.length
  const atCeil = ratings.filter((n) => n >= 9).length / ratings.length
  if (variance < 0.35 && (atFloor >= 0.85 || atCeil >= 0.85)) return true
  if (ratings.every((n) => n === ratings[0])) return true
  return false
}

export interface IntegrityFlag {
  code:
    | 'invalid_self_response'
    | 'invalid_observer_response'
    | 'missing_matched_self'
    | 'missing_matched_observer'
    | 'unmatched_observer_post_only'
    | 'item_alignment_trimmed'
    | 'duplicate_averaged'
    | 'cronbach_insufficient_n'
    | 'offline_required'
  severity: 'info' | 'warning' | 'blocker'
  message: string
  offline?: boolean
}

export interface RaterCourseScore {
  respondentId: string
  raterRole: CourseAssessmentRaterRole | null
  roleLabel: string
  preAvg: number | null
  postAvg: number | null
  matchedGrowth: number | null
  usedItemCount: number
  invalid: boolean
  flags: IntegrityFlag[]
}

export interface CourseReportMath {
  courseKey: string
  courseTitle: string
  /** Headline: matched observer Pre → Post (Manager+Partner[+…]) */
  observerPre: number | null
  observerPost: number | null
  observerMatchedGrowth: number | null
  /** End-state observers even if unmatched (e.g. partner Post-only) */
  observerEndState: number | null
  selfPre: number | null
  selfPost: number | null
  selfMatchedGrowth: number | null
  selfVsObserverGap: number | null
  bandEnd: ScoreBand | null
  raters: RaterCourseScore[]
  flags: IntegrityFlag[]
}

export interface LearnerReportMath {
  learnerId: string
  courses: CourseReportMath[]
  /** Mean of course-level matched observer growth */
  overallObserverPre: number | null
  overallObserverPost: number | null
  overallObserverGrowth: number | null
  flags: IntegrityFlag[]
}

export interface CohortCourseGrowth {
  courseKey: string
  courseTitle: string
  meanObserverGrowth: number | null
  assessedCount: number
}

export interface CohortReportMath {
  learners: LearnerReportMath[]
  courseGrowth: CohortCourseGrowth[]
  cronbachAlphaByCourse: Array<{
    courseKey: string
    alpha: number | null
    n: number
    flag?: IntegrityFlag
  }>
  flags: IntegrityFlag[]
}

const roleLabel = (role: CourseAssessmentRaterRole | null): string => {
  if (!role) return 'Rater'
  return COURSE_ASSESSMENT_ROLE_MATRIX[role]?.label ?? role
}

/** Prefer catalog question texts for like-for-like alignment. */
const ratingTextsFor = (
  courseTitle: string,
  kind: 'pre' | 'post',
  audience: 'self' | 'external_rater',
): string[] => {
  const def = findNativeCourseAssessment(courseTitle, kind, audience)
  if (!def) return []
  return def.questions.filter((q) => q.type === 'rating').map((q) => q.text.trim().toLowerCase())
}

/**
 * Align two rating vectors to shared items.
 * Prefer intersection by question text; fall back to min length by index.
 */
export const alignRatingVectors = (
  pre: number[],
  post: number[],
  preTexts: string[],
  postTexts: string[],
): { pre: number[]; post: number[]; trimmed: boolean } => {
  if (preTexts.length === pre.length && postTexts.length === post.length) {
    const postIndex = new Map(postTexts.map((t, i) => [t, i]))
    const sharedPre: number[] = []
    const sharedPost: number[] = []
    for (let i = 0; i < preTexts.length; i++) {
      const j = postIndex.get(preTexts[i])
      if (j == null) continue
      sharedPre.push(pre[i])
      sharedPost.push(post[j])
    }
    if (sharedPre.length >= 3) {
      const trimmed =
        sharedPre.length < pre.length || sharedPost.length < post.length
      return { pre: sharedPre, post: sharedPost, trimmed }
    }
  }
  const n = Math.min(pre.length, post.length)
  return {
    pre: pre.slice(0, n),
    post: post.slice(0, n),
    trimmed: pre.length !== post.length,
  }
}

const averageVectors = (vectors: number[][]): number[] | null => {
  if (!vectors.length) return null
  const len = Math.min(...vectors.map((v) => v.length))
  if (len < 1) return null
  const out: number[] = []
  for (let i = 0; i < len; i++) {
    const col = vectors.map((v) => v[i]).filter((n) => Number.isFinite(n))
    out.push(col.reduce((a, b) => a + b, 0) / col.length)
  }
  return out
}

/** Cronbach's α for item matrix (rows = raters, cols = items). */
export const cronbachAlpha = (matrix: number[][]): number | null => {
  const n = matrix.length
  if (n < 3) return null
  const k = Math.min(...matrix.map((r) => r.length))
  if (k < 2) return null
  const cols = Array.from({ length: k }, (_, j) => matrix.map((r) => r[j]))
  const itemVars = cols.map((col) => {
    const m = col.reduce((a, b) => a + b, 0) / col.length
    return col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length
  })
  const totals = matrix.map((row) => row.slice(0, k).reduce((a, b) => a + b, 0))
  const totalMean = totals.reduce((a, b) => a + b, 0) / totals.length
  const totalVar = totals.reduce((a, b) => a + (b - totalMean) ** 2, 0) / totals.length
  if (totalVar <= 0) return null
  const sumItemVar = itemVars.reduce((a, b) => a + b, 0)
  const alpha = (k / (k - 1)) * (1 - sumItemVar / totalVar)
  if (!Number.isFinite(alpha)) return null
  return round2(Math.max(0, Math.min(1, alpha)))
}

interface RawRaterBundle {
  respondentId: string
  raterRole: CourseAssessmentRaterRole | null
  audience: 'self' | 'external_rater'
  preVectors: number[][]
  postVectors: number[][]
  duplicateAveraged: boolean
}

const bundleResponses = (
  rows: CourseAssessmentResponseRow[],
  courseKey: string,
  subjectUserId: string,
): RawRaterBundle[] => {
  const mine = rows.filter(
    (r) => r.subject_user_id === subjectUserId && r.course_key === courseKey,
  )
  const map = new Map<string, RawRaterBundle>()

  for (const row of mine) {
    const key = `${row.respondent_id}::${row.audience}::${row.rater_role ?? 'unknown'}`
    let bundle = map.get(key)
    if (!bundle) {
      bundle = {
        respondentId: row.respondent_id,
        raterRole: row.rater_role,
        audience: row.audience,
        preVectors: [],
        postVectors: [],
        duplicateAveraged: false,
      }
      map.set(key, bundle)
    }
    const vector = extractRatingVector(row.answers || {})
    if (!vector.length) continue
    if (row.kind === 'pre') bundle.preVectors.push(vector)
    if (row.kind === 'post') bundle.postVectors.push(vector)
  }

  for (const bundle of map.values()) {
    if (bundle.preVectors.length > 1 || bundle.postVectors.length > 1) {
      bundle.duplicateAveraged = true
    }
  }
  return Array.from(map.values())
}

export const computeCourseReportMath = (params: {
  subjectUserId: string
  courseKey: string
  courseTitle: string
  rows: CourseAssessmentResponseRow[]
}): CourseReportMath => {
  const { subjectUserId, courseKey, courseTitle, rows } = params
  const flags: IntegrityFlag[] = []
  const bundles = bundleResponses(rows, courseKey, subjectUserId)
  const raters: RaterCourseScore[] = []

  const selfPreTexts = ratingTextsFor(courseTitle, 'pre', 'self')
  const selfPostTexts = ratingTextsFor(courseTitle, 'post', 'self')
  const obsPreTexts = ratingTextsFor(courseTitle, 'pre', 'external_rater')
  const obsPostTexts = ratingTextsFor(courseTitle, 'post', 'external_rater')

  for (const bundle of bundles) {
    const raterFlags: IntegrityFlag[] = []
    if (bundle.duplicateAveraged) {
      raterFlags.push({
        code: 'duplicate_averaged',
        severity: 'info',
        message: 'Duplicate submissions for this rater were averaged.',
      })
    }

    const preVec = averageVectors(bundle.preVectors)
    const postVec = averageVectors(bundle.postVectors)
    const preInvalid = preVec ? isInvalidRatingPattern(preVec) : false
    const postInvalid = postVec ? isInvalidRatingPattern(postVec) : false
    const invalid = preInvalid || postInvalid
    if (invalid) {
      raterFlags.push({
        code: bundle.audience === 'self' ? 'invalid_self_response' : 'invalid_observer_response',
        severity: 'warning',
        message: 'Near-uniform response pattern — excluded from matched growth.',
      })
    }

    let matchedGrowth: number | null = null
    let usedItemCount = 0
    let preAvg = preVec && !preInvalid ? mean(preVec) : null
    let postAvg = postVec && !postInvalid ? mean(postVec) : null

    if (preVec && postVec && !invalid) {
      const textsPre = bundle.audience === 'self' ? selfPreTexts : obsPreTexts
      const textsPost = bundle.audience === 'self' ? selfPostTexts : obsPostTexts
      const aligned = alignRatingVectors(preVec, postVec, textsPre, textsPost)
      if (aligned.trimmed) {
        raterFlags.push({
          code: 'item_alignment_trimmed',
          severity: 'info',
          message: 'Pre/Post item sets differed; growth uses like-for-like overlapping items only.',
        })
      }
      usedItemCount = aligned.pre.length
      preAvg = mean(aligned.pre)
      postAvg = mean(aligned.post)
      if (preAvg != null && postAvg != null) {
        matchedGrowth = round2(postAvg - preAvg)
      }
    } else if (postVec && !preVec && isObserverRole(bundle.raterRole)) {
      raterFlags.push({
        code: 'unmatched_observer_post_only',
        severity: 'info',
        message: `${roleLabel(bundle.raterRole)} has Post only — included in end-state, not matched growth.`,
      })
    }

    raters.push({
      respondentId: bundle.respondentId,
      raterRole: bundle.raterRole,
      roleLabel: roleLabel(bundle.raterRole),
      preAvg,
      postAvg,
      matchedGrowth,
      usedItemCount,
      invalid,
      flags: raterFlags,
    })
    flags.push(...raterFlags)
  }

  const matchedObservers = raters.filter(
    (r) => isObserverRole(r.raterRole) && !r.invalid && r.matchedGrowth != null,
  )
  const endStateObservers = raters.filter(
    (r) => isObserverRole(r.raterRole) && !r.invalid && r.postAvg != null,
  )
  const self = raters.find((r) => r.raterRole === 'learner' || (!r.raterRole && r.respondentId === subjectUserId))
    ?? raters.find((r) => !isObserverRole(r.raterRole) && r.respondentId === subjectUserId)

  const observerPre = mean(matchedObservers.map((r) => r.preAvg!).filter((n) => n != null))
  const observerPostMatched = mean(matchedObservers.map((r) => r.postAvg!).filter((n) => n != null))
  const observerMatchedGrowth = mean(matchedObservers.map((r) => r.matchedGrowth!))
  const observerEndState = mean(endStateObservers.map((r) => r.postAvg!))
  const observerPost = observerPostMatched ?? observerEndState

  const selfPre = self && !self.invalid ? self.preAvg : null
  const selfPost = self && !self.invalid ? self.postAvg : null
  const selfMatchedGrowth = self && !self.invalid ? self.matchedGrowth : null

  if (self?.invalid) {
    flags.push({
      code: 'invalid_self_response',
      severity: 'warning',
      message: 'Self-assessment excluded as invalid (near-uniform pattern).',
    })
  }
  if (selfMatchedGrowth == null) {
    flags.push({
      code: 'missing_matched_self',
      severity: 'info',
      message: 'No matched self Pre/Post on file for this course.',
    })
  }
  if (observerMatchedGrowth == null) {
    flags.push({
      code: 'missing_matched_observer',
      severity: 'warning',
      message:
        'No matched observer Pre/Post (Manager/Partner). Headline growth cannot be computed — flag for offline if needed.',
      offline: endStateObservers.length === 0,
    })
  }

  const selfVsObserverGap =
    selfPost != null && observerEndState != null ? round2(selfPost - observerEndState) : null

  return {
    courseKey,
    courseTitle,
    observerPre,
    observerPost,
    observerMatchedGrowth,
    observerEndState,
    selfPre,
    selfPost,
    selfMatchedGrowth,
    selfVsObserverGap,
    bandEnd: scoreBandFor(observerEndState ?? observerPost),
    raters,
    flags,
  }
}

export const computeLearnerReportMath = (params: {
  learnerId: string
  rows: CourseAssessmentResponseRow[]
}): LearnerReportMath => {
  const courseKeys = Array.from(
    new Set(
      params.rows
        .filter((r) => r.subject_user_id === params.learnerId)
        .map((r) => r.course_key),
    ),
  )

  const courses = courseKeys.map((courseKey) => {
    const sample = params.rows.find(
      (r) => r.subject_user_id === params.learnerId && r.course_key === courseKey,
    )
    return computeCourseReportMath({
      subjectUserId: params.learnerId,
      courseKey,
      courseTitle: sample?.course_title || courseKey,
      rows: params.rows,
    })
  })

  const withGrowth = courses.filter((c) => c.observerMatchedGrowth != null)
  const overallObserverGrowth = mean(withGrowth.map((c) => c.observerMatchedGrowth!))
  const overallObserverPre = mean(
    courses.map((c) => c.observerPre).filter((n): n is number => n != null),
  )
  const overallObserverPost = mean(
    courses.map((c) => c.observerPost).filter((n): n is number => n != null),
  )

  const flags = courses.flatMap((c) => c.flags)
  return {
    learnerId: params.learnerId,
    courses,
    overallObserverPre,
    overallObserverPost,
    overallObserverGrowth,
    flags,
  }
}

export const computeCohortReportMath = (params: {
  learnerIds: string[]
  rows: CourseAssessmentResponseRow[]
}): CohortReportMath => {
  const learners = params.learnerIds.map((id) =>
    computeLearnerReportMath({ learnerId: id, rows: params.rows }),
  )

  const courseMap = new Map<string, { title: string; growths: number[]; assessed: number }>()
  for (const learner of learners) {
    for (const course of learner.courses) {
      const entry = courseMap.get(course.courseKey) ?? {
        title: course.courseTitle,
        growths: [],
        assessed: 0,
      }
      entry.assessed += 1
      if (course.observerMatchedGrowth != null) entry.growths.push(course.observerMatchedGrowth)
      courseMap.set(course.courseKey, entry)
    }
  }

  const courseGrowth: CohortCourseGrowth[] = Array.from(courseMap.entries()).map(
    ([courseKey, v]) => ({
      courseKey,
      courseTitle: v.title,
      meanObserverGrowth: mean(v.growths),
      assessedCount: v.assessed,
    }),
  )

  // Cronbach α on observer Post item vectors per course (needs ≥3 valid observers)
  const cronbachAlphaByCourse = Array.from(courseMap.keys()).map((courseKey) => {
    const matrix: number[][] = []
    for (const row of params.rows) {
      if (row.course_key !== courseKey) continue
      if (row.kind !== 'post' || row.audience !== 'external_rater') continue
      const vec = extractRatingVector(row.answers || {})
      if (!vec.length || isInvalidRatingPattern(vec)) continue
      matrix.push(vec)
    }
    if (matrix.length < 3) {
      const flag: IntegrityFlag = {
        code: 'cronbach_insufficient_n',
        severity: 'warning',
        message: `Cronbach's α for "${courseKey}" needs ≥3 observer Post submissions (have ${matrix.length}). Compute offline if required.`,
        offline: true,
      }
      return { courseKey, alpha: null, n: matrix.length, flag }
    }
    return { courseKey, alpha: cronbachAlpha(matrix), n: matrix.length }
  })

  const flags: IntegrityFlag[] = [
    ...learners.flatMap((l) => l.flags),
    ...cronbachAlphaByCourse.map((c) => c.flag).filter((f): f is IntegrityFlag => Boolean(f)),
  ]

  const offlineNeeded = flags.some((f) => f.offline)
  if (offlineNeeded) {
    flags.push({
      code: 'offline_required',
      severity: 'warning',
      message:
        'Some integrity checks could not be completed correctly in-app. Numbers shown use matched available data; flagged items need offline review before external scrutiny.',
      offline: true,
    })
  }

  return { learners, courseGrowth, cronbachAlphaByCourse, flags }
}
