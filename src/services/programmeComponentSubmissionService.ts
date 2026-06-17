import { supabase } from '@/services/supabase'
import { getActivityDefinitionById, type JourneyType } from '@/config/pointsConfig'
import { awardChecklistPoints } from './pointsService'
import { createInAppNotification } from './notificationService'

export type ProgrammeComponentType = 'capstone' | 'case_study' | 'practical'

// Pillar components are one-off, journey-long deliverables (not week-bound), so
// we attribute the award to a fixed week. This keeps the ledger doc id stable
// across re-approvals - combined with claimRef below it makes awarding fully
// idempotent. See docs/points-system.md.
const PILLAR_AWARD_WEEK = 1

const TABLE = 'programme_component_submissions'

export type ProgrammeSubmissionStatus =
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'needs_revision'

/**
 * AI grade written server-side by the `grade-submission` Supabase Edge Function
 * (triggered by a DB webhook on insert/update). ADVISORY ONLY - it never sets
 * status or awards points; partners remain the gate.
 */
export interface AiGrade {
  status: 'completed' | 'error'
  score: number | null
  feedback: string | null
  pass: boolean | null
  model: string | null
  error: string | null
  gradedAt: Date | null
}

export interface ProgrammeComponentSubmission {
  /** Supabase row uuid (primary key). */
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
  // AI grade (advisory) - written by the grade-submission Edge Function.
  aiGrade: AiGrade | null
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const parseAiGrade = (raw: unknown): AiGrade | null => {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const status = d.status === 'error' ? 'error' : 'completed'
  return {
    status,
    score: typeof d.score === 'number' ? d.score : null,
    feedback: typeof d.feedback === 'string' ? d.feedback : null,
    pass: typeof d.pass === 'boolean' ? d.pass : null,
    model: typeof d.model === 'string' ? d.model : null,
    error: typeof d.error === 'string' ? d.error : null,
    // edge function writes snake_case `graded_at`; tolerate `gradedAt` too.
    gradedAt: toDate(d.graded_at ?? d.gradedAt),
  }
}

const sanitizeAnswers = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
    if (typeof v === 'string') out[k] = v
    else if (v !== null && v !== undefined) out[k] = String(v)
  })
  return out
}

type Row = Record<string, unknown>

const fromRow = (row: Row): ProgrammeComponentSubmission => {
  const componentType = row.component_type
  return {
    id: String(row.id ?? ''),
    uid: typeof row.user_id === 'string' ? row.user_id : '',
    // email/displayName aren't stored on the submission row; the partner UI
    // resolves the learner from organisation membership where needed.
    email: typeof row.email === 'string' ? row.email : null,
    displayName: typeof row.display_name === 'string' ? row.display_name : null,
    organizationId: typeof row.organization_id === 'string' ? row.organization_id : null,
    componentId: typeof row.component_id === 'string' ? row.component_id : '',
    componentType: (['capstone', 'case_study', 'practical'] as const).includes(
      componentType as ProgrammeComponentType,
    )
      ? (componentType as ProgrammeComponentType)
      : null,
    componentTitle: typeof row.component_title === 'string' ? row.component_title : null,
    pillar: typeof row.pillar === 'string' ? row.pillar : null,
    partId: typeof row.part_id === 'string' ? row.part_id : null,
    partTitle: typeof row.part_title === 'string' ? row.part_title : null,
    answers: sanitizeAnswers(row.answers),
    answerCount: typeof row.answer_count === 'number' ? row.answer_count : 0,
    status:
      row.status === 'in_review' ||
      row.status === 'approved' ||
      row.status === 'needs_revision'
        ? (row.status as ProgrammeSubmissionStatus)
        : 'submitted',
    submittedAt: toDate(row.submitted_at),
    lastUpdatedAt: toDate(row.last_updated_at),
    resubmittedAt: toDate(row.resubmitted_at),
    sourcePage: typeof row.source_page === 'string' ? row.source_page : null,
    reviewedAt: toDate(row.reviewed_at),
    reviewedBy: typeof row.reviewed_by === 'string' ? row.reviewed_by : null,
    reviewerName: typeof row.reviewer_name === 'string' ? row.reviewer_name : null,
    partnerNotes: typeof row.partner_notes === 'string' ? row.partner_notes : null,
    score: typeof row.score === 'number' ? row.score : null,
    aiGrade: parseAiGrade(row.ai_grade),
  }
}

const sortByLastUpdatedDesc = (
  a: ProgrammeComponentSubmission,
  b: ProgrammeComponentSubmission,
): number => {
  const aT = (a.lastUpdatedAt ?? a.submittedAt)?.getTime() ?? 0
  const bT = (b.lastUpdatedAt ?? b.submittedAt)?.getTime() ?? 0
  return bT - aT
}

/**
 * Subscribe to all submissions for a set of organization ids. Does an initial
 * fetch, then live-refetches on any change via a Supabase realtime channel.
 * RLS (migration 0014, `partner_manages_org`) scopes rows to orgs the caller
 * manages, so the org filter here is belt-and-braces.
 */
export function subscribeToSubmissionsByOrgIds(
  organizationIds: string[],
  onUpdate: (rows: ProgrammeComponentSubmission[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const ids = Array.from(new Set(organizationIds.filter((id) => Boolean(id))))
  if (ids.length === 0) {
    onUpdate([])
    return () => undefined
  }

  let cancelled = false

  const fetchRows = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .in('organization_id', ids)
      if (error) throw error
      if (cancelled) return
      const rows = (data ?? []).map((r) => fromRow(r as Row)).sort(sortByLastUpdatedDesc)
      onUpdate(rows)
    } catch (err) {
      console.error('[programmeComponentSubmissionService] fetch failed', err)
      onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  void fetchRows()

  // Live updates: re-fetch on any change to the table. RLS still scopes what
  // this client can actually read, so a broad listener is safe.
  const channel = supabase
    .channel(`pcs-${ids.join('_').slice(0, 40)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      () => {
        void fetchRows()
      },
    )
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}

export interface ReviewUpdate {
  status: ProgrammeSubmissionStatus
  partnerNotes: string | null
  score: number | null
  reviewerId: string
  reviewerName: string
}

export async function updateSubmissionReview(
  submissionId: string,
  update: ReviewUpdate,
): Promise<void> {
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: update.status,
      partner_notes: update.partnerNotes,
      score: update.score,
      reviewed_by: update.reviewerId,
      reviewer_name: update.reviewerName,
      reviewed_at: nowIso,
      last_updated_at: nowIso,
    })
    .eq('id', submissionId)
  if (error) throw error
}

/**
 * Points a pillar component is worth, for display before approving. Pillar
 * points live on the 6W journey config (capstone/case_study/practical).
 */
export function getComponentPoints(componentType: ProgrammeComponentType | null): number {
  if (!componentType) return 0
  return getActivityDefinitionById({ activityId: componentType, journeyType: '6W' })?.points ?? 0
}

export interface ApproveAndAwardResult {
  awarded: boolean
  /** Points the component is worth. */
  points: number
  /** True when an award already existed (idempotent re-approval, no new points). */
  alreadyAwarded: boolean
  /** False for components that are reviewed but don't award points (e.g. practical). */
  pointsEligible: boolean
}

/**
 * Mark a submission approved AND award the learner the component's points.
 *
 * The submission row lives in Supabase; the points award stays on the canonical
 * partner-issued ledger path (`awardChecklistPoints`) so the ledger remains the
 * single source of truth. `claimRef` is the componentId, which:
 *  - keeps awarding idempotent per submission (re-approving never double-awards), and
 *  - lets the two case studies (which share activityId "case_study") each award.
 */
export async function approveSubmissionAndAward(params: {
  submission: ProgrammeComponentSubmission
  reviewerId: string
  reviewerName: string
  partnerNotes: string | null
  score: number | null
}): Promise<ApproveAndAwardResult> {
  const { submission, reviewerId, reviewerName, partnerNotes, score } = params

  if (!submission.uid) throw new Error('Submission is missing the learner id.')
  if (!submission.componentType) throw new Error('Submission is missing its component type.')

  // Resolve the learner's journey so progress is attributed correctly; pillar
  // components only exist on 6W, so fall back to 6W to resolve the points.
  let journeyType: JourneyType = '6W'
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('journey_type')
      .eq('id', submission.uid)
      .maybeSingle()
    if (profile?.journey_type) journeyType = profile.journey_type as JourneyType
  } catch (err) {
    console.warn('[programmeComponentSubmissionService] journey_type lookup failed; defaulting to 6W', err)
  }

  const activity =
    getActivityDefinitionById({ activityId: submission.componentType, journeyType }) ??
    getActivityDefinitionById({ activityId: submission.componentType, journeyType: '6W' })

  // Some pillar components are reviewed but don't award checklist points
  // (e.g. practical). Record the partner's decision without awarding.
  if (!activity) {
    await updateSubmissionReview(submission.id, {
      status: 'approved',
      partnerNotes,
      score,
      reviewerId,
      reviewerName,
    })
    return { awarded: false, points: 0, alreadyAwarded: false, pointsEligible: false }
  }

  const awardResult = await awardChecklistPoints({
    uid: submission.uid,
    journeyType,
    weekNumber: PILLAR_AWARD_WEEK,
    activity,
    source: 'partner_issued',
    claimRef: submission.componentId,
  })

  // Record the partner's decision either way (status/notes/score/reviewer).
  await updateSubmissionReview(submission.id, {
    status: 'approved',
    partnerNotes,
    score,
    reviewerId,
    reviewerName,
  })

  // Only notify the learner when points were actually new.
  if (awardResult.awarded) {
    try {
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
