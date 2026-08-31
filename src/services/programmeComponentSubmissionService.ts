import { supabase } from './supabase'
import { getActivityDefinitionById, type JourneyType } from '@/config/pointsConfig'
import { awardChecklistPoints } from './pointsService'
import { createInAppNotification } from './notificationService'

export type ProgrammeComponentType = 'capstone' | 'case_study' | 'practical'

// Pillar components are one-off, journey-long deliverables (not week-bound), so
// we attribute the award to a fixed week. This keeps the ledger doc id stable
// across re-approvals - combined with claimRef below it makes awarding fully
// idempotent. See docs/points-system.md.
const PILLAR_AWARD_WEEK = 1

export type ProgrammeSubmissionStatus =
 | 'submitted'
 | 'in_review'
 | 'approved'
 | 'needs_revision'

/** Advisory Gemini grade written by `grade-submission` (never awards points alone). */
export type ProgrammeAiGrade = {
 status: 'pending' | 'completed' | 'error' | string
 /** Legacy 0-100 advisory score from current grader. */
 score?: number | null
 /** Bank A score 0-50 when 50/50 schema is used. */
 aiScore50?: number | null
 feedback?: string | null
 feedbackForPartner?: string | null
 pass?: boolean | null
 model?: string | null
 gradedAt?: string | null
 error?: string | null
}

export interface ProgrammeComponentSubmission {
 /** Firestore doc id - format: `{uid}__{componentId}`. */
 id: string
 uid: string
 email: string | null
 displayName: string | null
 organizationId: string | null
 componentId: string
 componentType: ProgrammeComponentType | null
 componentTitle: string | null
 pillar: string | null
 partId: string | null
 partTitle: string | null
 answers: Record<string, string>
 answerCount: number
 status: ProgrammeSubmissionStatus
 submittedAt: Date | null
 lastUpdatedAt: Date | null
 resubmittedAt: Date | null
 sourcePage: string | null
 // Partner review fields
 reviewedAt: Date | null
 reviewedBy: string | null
 reviewerName: string | null
 partnerNotes: string | null
 score: number | null
 /** Gemini advisory grade (Bank A / legacy 0-100). */
 aiGrade: ProgrammeAiGrade | null
 /** Partner Bank B score 0-50 (judgment/context). */
 partnerScore50: number | null
 /** Combined final 0-100 when both banks are set. */
 finalScore: number | null
}

/**
 * Subscribe to all submissions for a set of organization ids.
 *
 * Live reads come from Supabase `programme_component_submissions` (RLS
 * `pcs_select`: partners/admins can read). Learner email/name are resolved
 * from `profiles`. Capstone HTML forms write via `/capstones/_capstone-runtime.js`.
 */
type Raw = Record<string, unknown>

const toDate = (v: unknown): Date | null => {
 if (!v || typeof v !== 'string') return null
 const d = new Date(v)
 return Number.isNaN(d.getTime()) ? null : d
}

const toFiniteNumber = (v: unknown): number | null => {
 if (typeof v === 'number' && Number.isFinite(v)) return v
 if (typeof v === 'string' && v.trim() !== '') {
 const n = Number(v)
 return Number.isFinite(n) ? n : null
 }
 return null
}

export function mapAiGrade(raw: unknown): ProgrammeAiGrade | null {
 if (!raw || typeof raw !== 'object') return null
 const g = raw as Record<string, unknown>
 const status = typeof g.status === 'string' ? g.status : 'pending'
 const score = toFiniteNumber(g.score)
 const aiScore50 =
 toFiniteNumber(g.ai_score_50) ??
 (score != null ? Math.min(50, Math.round(score / 2)) : null)
 return {
 status,
 score,
 aiScore50,
 feedback: typeof g.feedback === 'string' ? g.feedback : null,
 feedbackForPartner:
 typeof g.feedback_for_partner === 'string' ? g.feedback_for_partner : null,
 pass: typeof g.pass === 'boolean' ? g.pass : null,
 model: typeof g.model === 'string' ? g.model : null,
 gradedAt: typeof g.graded_at === 'string' ? g.graded_at : null,
 error: typeof g.error === 'string' ? g.error : null,
 }
}

/** Prefer Bank A 0-50, else half of legacy 0-100, else null. */
export function getAiBankAScore(ai: ProgrammeAiGrade | null | undefined): number | null {
 if (!ai || ai.status !== 'completed') return null
 if (ai.aiScore50 != null && Number.isFinite(ai.aiScore50)) {
 return Math.max(0, Math.min(50, Math.round(ai.aiScore50)))
 }
 if (ai.score != null && Number.isFinite(ai.score)) {
 return Math.max(0, Math.min(50, Math.round(ai.score / 2)))
 }
 return null
}

const mapRow = (
 row: Raw,
 nameByUid: Map<string, { email: string | null; fullName: string | null }>,
): ProgrammeComponentSubmission => {
 const uid = String(row.user_id ?? '')
 const who = nameByUid.get(uid)
 return {
 id: String(row.id ?? ''),
 uid,
 email: who?.email ?? null,
 displayName: who?.fullName ?? null,
 organizationId: (row.organization_id as string) ?? null,
 componentId: (row.component_id as string) ?? '',
 componentType: (row.component_type as ProgrammeComponentType | null) ?? null,
 componentTitle: (row.component_title as string) ?? null,
 pillar: (row.pillar as string) ?? null,
 partId: (row.part_id as string) ?? null,
 partTitle: (row.part_title as string) ?? null,
 answers: (row.answers as Record<string, string>) ?? {},
 answerCount: typeof row.answer_count === 'number' ? row.answer_count : 0,
 status: (row.status as ProgrammeSubmissionStatus) ?? 'submitted',
 submittedAt: toDate(row.submitted_at),
 lastUpdatedAt: toDate(row.last_updated_at),
 resubmittedAt: toDate(row.resubmitted_at),
 sourcePage: (row.source_page as string) ?? null,
 reviewedAt: toDate(row.reviewed_at),
 reviewedBy: (row.reviewed_by as string) ?? null,
 reviewerName: (row.reviewer_name as string) ?? null,
 partnerNotes: (row.partner_notes as string) ?? null,
 score: toFiniteNumber(row.score),
 aiGrade: mapAiGrade(row.ai_grade),
 partnerScore50: toFiniteNumber(row.partner_score_50),
 finalScore: toFiniteNumber(row.final_score),
 }
}

// Unique realtime topic per subscription (supabase.channel reuses a channel with
// the same topic, which throws on a fast remount).
let pcsChannelSeq = 0

/**
 * Live submissions for a set of organization ids, read from Supabase
 * `programme_component_submissions` (RLS `pcs_select`: partners of the org can
 * read). Learner email/name are resolved from `profiles`. Replaces the disabled
 * Firestore `onSnapshot(programmeComponentSubmissions)` listener.
 */
export function subscribeToSubmissionsByOrgIds(
 organizationIds: string[],
 onUpdate: (rows: ProgrammeComponentSubmission[]) => void,
 onError?: (err: Error) => void,
): () => void {
 const orgIds = (organizationIds ?? []).filter(Boolean)
 if (orgIds.length === 0) {
 onUpdate([])
 return () => undefined
 }

 let active = true

 const load = async () => {
 const { data: rows, error } = await supabase
 .from('programme_component_submissions')
 .select('*')
 .in('organization_id', orgIds)
 .order('last_updated_at', { ascending: false })
 if (!active) return
 if (error) {
 console.error('[programmeComponentSubmissionService] load failed', error)
 onError?.(new Error(error.message))
 return
 }
 const list = (rows ?? []) as Raw[]
 const uids = Array.from(new Set(list.map((r) => String(r.user_id)).filter(Boolean)))
 const nameByUid = new Map<string, { email: string | null; fullName: string | null }>()
 if (uids.length) {
 const { data: profs } = await supabase
 .from('profiles')
 .select('id, email, full_name')
 .in('id', uids)
 ;(profs ?? []).forEach((p) =>
 nameByUid.set(String(p.id), {
 email: (p.email as string) ?? null,
 fullName: (p.full_name as string) ?? null,
 }),
 )
 }
 if (!active) return
 onUpdate(list.map((r) => mapRow(r, nameByUid)))
 }

 void load()

 const channel = supabase
 .channel(`pcs_partner_${++pcsChannelSeq}`)
 .on(
 'postgres_changes',
 { event: '*', schema: 'public', table: 'programme_component_submissions' },
 () => void load(),
 )
 .subscribe()

 return () => {
 active = false
 void supabase.removeChannel(channel)
 }
}

export interface ReviewUpdate {
 status: ProgrammeSubmissionStatus
 partnerNotes: string | null
 score: number | null
 /** Optional Bank B (0-50). When set with AI Bank A, also writes final_score. */
 partnerScore50?: number | null
 finalScore?: number | null
 reviewerId: string
 reviewerName: string
}

export async function updateSubmissionReview(
 submissionId: string,
 update: ReviewUpdate,
): Promise<void> {
 const nowIso = new Date().toISOString()
 const patch: Record<string, unknown> = {
 status: update.status,
 partner_notes: update.partnerNotes,
 score: update.score,
 reviewed_by: update.reviewerId,
 reviewer_name: update.reviewerName,
 reviewed_at: nowIso,
 last_updated_at: nowIso,
 }
 if (update.partnerScore50 !== undefined) {
 patch.partner_score_50 = update.partnerScore50
 }
 if (update.finalScore !== undefined) {
 patch.final_score = update.finalScore
 }
 const { error } = await supabase
 .from('programme_component_submissions')
 .update(patch)
 .eq('id', submissionId)
 if (error) throw new Error(error.message)
}

/**
 * Points a pillar component is worth, for display before approving.
 * 6W uses checklist points; 3M / 6M / 9M keep these at 0 (Pass/Fail mark).
 */
export function getComponentPoints(
 componentType: ProgrammeComponentType | null,
 journeyType: JourneyType = '6W',
): number {
 if (!componentType) return 0
 return (
 getActivityDefinitionById({ activityId: componentType, journeyType })?.points ??
 getActivityDefinitionById({ activityId: componentType, journeyType: '6W' })?.points ??
 0
 )
}

export interface ApproveAndAwardResult {
 awarded: boolean
 /** Points the component is worth. */
 points: number
 /** True when an award already existed (idempotent re-approval, no new points). */
 alreadyAwarded: boolean
 /** False when the activity is missing from the journey config. */
 pointsEligible: boolean
}

/**
 * Mark a submission approved AND award the learner the component's points.
 *
 * Reuses the canonical partner-issued points path (awardChecklistPoints) so the
 * ledger stays the single source of truth. `claimRef` is the part id when
 * present (else componentId), which:
 * - keeps awarding idempotent per deliverable (re-approving never double-awards), and
 * - lets multi-part components (case studies, practicals) each count separately.
 */
export async function approveSubmissionAndAward(params: {
 submission: ProgrammeComponentSubmission
 reviewerId: string
 reviewerName: string
 partnerNotes: string | null
 score: number | null
 partnerScore50?: number | null
 finalScore?: number | null
}): Promise<ApproveAndAwardResult> {
 const {
 submission,
 reviewerId,
 reviewerName,
 partnerNotes,
 score,
 partnerScore50,
 finalScore,
 } = params

 if (!submission.uid) throw new Error('Submission is missing the learner id.')
 if (!submission.componentType) throw new Error('Submission is missing its component type.')

 // Resolve the learner's journey so progress is attributed correctly; pillar
 // components only exist on 6W, so fall back to 6W to resolve the points.
 const { data: profileRow } = await supabase
 .from('profiles')
 .select('journey_type, data')
 .eq('id', submission.uid)
 .maybeSingle()
 const journeyType = ((profileRow?.journey_type as string) ||
 ((profileRow?.data as { journeyType?: string } | null)?.journeyType) ||
 '6W') as JourneyType

 const activity =
 getActivityDefinitionById({ activityId: submission.componentType, journeyType }) ??
 getActivityDefinitionById({ activityId: submission.componentType, journeyType: '6W' })

 // Unknown component type: still record the review, but skip awarding.
 if (!activity) {
 await updateSubmissionReview(submission.id, {
 status: 'approved',
 partnerNotes,
 score,
 partnerScore50,
 finalScore,
 reviewerId,
 reviewerName,
 })
 return { awarded: false, points: 0, alreadyAwarded: false, pointsEligible: false }
 }

 const claimRef = submission.partId || submission.componentId

 const awardResult = await awardChecklistPoints({
 uid: submission.uid,
 journeyType,
 weekNumber: PILLAR_AWARD_WEEK,
 activity,
 source: 'partner_issued',
 claimRef,
 })

 // Record the partner's decision either way (status/notes/score/reviewer).
 await updateSubmissionReview(submission.id, {
 status: 'approved',
 partnerNotes,
 score,
 partnerScore50,
 finalScore,
 reviewerId,
 reviewerName,
 })

 // Notify the learner: points when earned, otherwise a Pass mark (3M/6M/9M).
 if (awardResult.awarded) {
 try {
 if (activity.points > 0) {
 await createInAppNotification({
 userId: submission.uid,
 type: 'approval',
 title: `🎉 +${activity.points.toLocaleString()} points awarded`,
 message: `Your partner approved "${submission.componentTitle || activity.title}" and awarded you ${activity.points.toLocaleString()} points.`,
 metadata: {
 priority: 'push',
 activityId: activity.id,
 componentId: submission.componentId,
 points: activity.points,
 source: 'partner_issued',
 },
 relatedId: activity.id,
 })
 } else {
 await createInAppNotification({
 userId: submission.uid,
 type: 'approval',
 title: 'Passed',
 message: `Your partner marked "${submission.componentTitle || activity.title}" as Pass.`,
 metadata: {
 priority: 'push',
 activityId: activity.id,
 componentId: submission.componentId,
 points: 0,
 outcome: 'pass',
 source: 'partner_issued',
 },
 relatedId: activity.id,
 })
 }
 } catch (notifyErr) {
 // Non-fatal: points + review already wrote successfully.
 console.warn('[programmeComponentSubmissionService] learner notify failed', notifyErr)
 }
 }

 return {
 awarded: awardResult.awarded,
 points: activity.points,
 alreadyAwarded: !awardResult.awarded,
 pointsEligible: true,
 }
}
