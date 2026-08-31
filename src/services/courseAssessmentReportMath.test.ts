import { describe, expect, it } from 'vitest'
import {
 computeCourseReportMath,
 cronbachAlpha,
 extractRatingVector,
 isInvalidRatingPattern,
} from '@/services/courseAssessmentReportMath'
import type { CourseAssessmentResponseRow } from '@/services/courseAssessmentService'
import { detectIdentityDuplicates } from '@/services/courseAssessmentReportNarratives'

const row = (
 partial: Partial<CourseAssessmentResponseRow> &
 Pick<
 CourseAssessmentResponseRow,
 'subject_user_id' | 'respondent_id' | 'course_key' | 'kind' | 'answers'
 >,
): CourseAssessmentResponseRow =>
 ({
 id: partial.id ?? `${partial.respondent_id}-${partial.kind}`,
 course_title: partial.course_title ?? 'Systems Thinking',
 audience: partial.audience ?? 'external_rater',
 rater_role: partial.rater_role ?? 'line_manager',
 submitted_at: partial.submitted_at ?? '2026-01-01T00:00:00Z',
 ...partial,
 }) as CourseAssessmentResponseRow

describe('extractRatingVector', () => {
 it('keeps only 1-10 numeric ratings in index order', () => {
 expect(
 extractRatingVector({
 '1': 7,
 '0': 5,
 '2': 'text',
 '3': 11,
 '4': 0,
 }),
 ).toEqual([5, 7])
 })
})

describe('isInvalidRatingPattern', () => {
 it('flags near-uniform ceiling click-through', () => {
 expect(isInvalidRatingPattern([10, 10, 10, 10, 9, 10])).toBe(true)
 })

 it('allows varied ratings', () => {
 expect(isInvalidRatingPattern([4, 6, 5, 7, 8, 6])).toBe(false)
 })
})

describe('cronbachAlpha', () => {
 it('returns null when n < 3', () => {
 expect(
 cronbachAlpha([
 [5, 6, 7],
 [6, 7, 8],
 ]),
 ).toBeNull()
 })

 it('returns a bounded alpha for consistent items', () => {
 const alpha = cronbachAlpha([
 [5, 5, 6],
 [6, 6, 7],
 [7, 7, 8],
 [4, 4, 5],
 ])
 expect(alpha).not.toBeNull()
 expect(alpha!).toBeGreaterThan(0.5)
 expect(alpha!).toBeLessThanOrEqual(1)
 })
})

describe('computeCourseReportMath', () => {
 it('computes matched observer growth and ignores post-only for growth', () => {
 const subject = 'learner-1'
 const rows = [
 row({
 subject_user_id: subject,
 respondent_id: 'mgr-1',
 course_key: 'systems',
 kind: 'pre',
 rater_role: 'line_manager',
 answers: { '0': 4, '1': 5, '2': 4, '3': 5 },
 }),
 row({
 subject_user_id: subject,
 respondent_id: 'mgr-1',
 course_key: 'systems',
 kind: 'post',
 rater_role: 'line_manager',
 answers: { '0': 7, '1': 8, '2': 7, '3': 8 },
 }),
 row({
 subject_user_id: subject,
 respondent_id: 'partner-1',
 course_key: 'systems',
 kind: 'post',
 rater_role: 'partner',
 answers: { '0': 9, '1': 9, '2': 8, '3': 9 },
 }),
 row({
 subject_user_id: subject,
 respondent_id: subject,
 course_key: 'systems',
 kind: 'pre',
 audience: 'self',
 rater_role: 'learner',
 answers: { '0': 5, '1': 5, '2': 6, '3': 5 },
 }),
 row({
 subject_user_id: subject,
 respondent_id: subject,
 course_key: 'systems',
 kind: 'post',
 audience: 'self',
 rater_role: 'learner',
 answers: { '0': 8, '1': 8, '2': 8, '3': 7 },
 }),
 ]

 const math = computeCourseReportMath({
 subjectUserId: subject,
 courseKey: 'systems',
 courseTitle: 'Systems Thinking',
 rows,
 })

 // Manager only is matched: (7.5 - 4.5) = 3
 expect(math.observerMatchedGrowth).toBe(3)
 expect(math.observerPre).toBe(4.5)
 expect(math.observerPost).toBe(7.5)
 // End-state includes partner post-only
 expect(math.observerEndState).toBe(8.13)
 expect(math.selfMatchedGrowth).toBe(2.5)
 expect(math.raters.some((r) => r.raterRole === 'partner' && r.matchedGrowth == null)).toBe(
 true,
 )
 })

 it('excludes invalid near-uniform observer from matched growth', () => {
 const subject = 'learner-2'
 const rows = [
 row({
 subject_user_id: subject,
 respondent_id: 'mgr-bad',
 course_key: 'systems',
 kind: 'pre',
 answers: { '0': 10, '1': 10, '2': 10, '3': 10 },
 }),
 row({
 subject_user_id: subject,
 respondent_id: 'mgr-bad',
 course_key: 'systems',
 kind: 'post',
 answers: { '0': 10, '1': 10, '2': 10, '3': 10 },
 }),
 ]
 const math = computeCourseReportMath({
 subjectUserId: subject,
 courseKey: 'systems',
 courseTitle: 'Systems Thinking',
 rows,
 })
 expect(math.observerMatchedGrowth).toBeNull()
 expect(math.flags.some((f) => f.code === 'invalid_observer_response')).toBe(true)
 })

 it('averages duplicate submissions for the same rater', () => {
 const subject = 'learner-3'
 const rows = [
 row({
 id: 'a',
 subject_user_id: subject,
 respondent_id: 'mgr-1',
 course_key: 'systems',
 kind: 'pre',
 answers: { '0': 3, '1': 4, '2': 5, '3': 4 },
 }),
 row({
 id: 'b',
 subject_user_id: subject,
 respondent_id: 'mgr-1',
 course_key: 'systems',
 kind: 'pre',
 answers: { '0': 5, '1': 6, '2': 7, '3': 6 },
 }),
 row({
 id: 'c',
 subject_user_id: subject,
 respondent_id: 'mgr-1',
 course_key: 'systems',
 kind: 'post',
 answers: { '0': 7, '1': 8, '2': 8, '3': 7 },
 }),
 ]
 const math = computeCourseReportMath({
 subjectUserId: subject,
 courseKey: 'systems',
 courseTitle: 'Systems Thinking',
 rows,
 })
 // Pre averaged to [4,5,6,5] mean 5; post mean 7.5 → growth 2.5
 expect(math.observerPre).toBe(5)
 expect(math.observerMatchedGrowth).toBe(2.5)
 expect(math.flags.some((f) => f.code === 'duplicate_averaged')).toBe(true)
 })
})

describe('detectIdentityDuplicates', () => {
 it('flags same normalized name on different ids', () => {
 const flags = detectIdentityDuplicates([
 { id: '1', name: 'Ada Lovelace' },
 { id: '2', name: 'ada lovelace' },
 { id: '3', name: 'Grace Hopper' },
 ])
 expect(flags).toHaveLength(1)
 expect(flags[0].learnerIds).toEqual(['1', '2'])
 })
})
