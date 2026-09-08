import type {
  ProgrammeAiDecision,
  ProgrammeComponentSubmission,
} from '@/services/programmeComponentSubmissionService'
import { getAiBankAScore } from '@/services/programmeComponentSubmissionService'

export type HitlDecisionLabel = ProgrammeAiDecision | 'pending' | 'none'

export interface ProgrammeAiHitlStats {
  aiCompleted: number
  awaitingHuman: number
  accepted: number
  edited: number
  rejected: number
  criteriaAcknowledged: number
  /** Average dwell (ms) among rows that recorded review_duration_ms. */
  avgDwellMs: number | null
  /** Rows with dwell time recorded. */
  dwellSamples: number
  /** |human_final - ai_overall| average when both exist and decision is edit/reject. */
  avgAbsScoreDelta: number | null
  scoreDeltaSamples: number
}

const csvEscape = (value: string | number | null | undefined): string => {
  if (value == null) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export const getHitlDecision = (row: ProgrammeComponentSubmission): HitlDecisionLabel => {
  if (row.aiDecision) return row.aiDecision
  if (row.aiGrade?.status === 'completed') return 'pending'
  return 'none'
}

export const formatDwell = (ms: number | null | undefined): string => {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return rem ? `${min}m ${rem}s` : `${min}m`
}

export const getAiOverallScore = (row: ProgrammeComponentSubmission): number | null => {
  const ai = row.aiGrade
  if (!ai || ai.status !== 'completed') return null
  if (ai.score != null && Number.isFinite(ai.score)) return Math.round(ai.score)
  const bankA = getAiBankAScore(ai)
  return bankA != null ? bankA * 2 : null
}

export const getHumanFinalScore = (row: ProgrammeComponentSubmission): number | null => {
  if (row.finalScore != null && Number.isFinite(row.finalScore)) return Math.round(row.finalScore)
  if (row.score != null && Number.isFinite(row.score)) return Math.round(row.score)
  return null
}

export function computeProgrammeAiHitlStats(
  rows: ProgrammeComponentSubmission[],
): ProgrammeAiHitlStats {
  let aiCompleted = 0
  let awaitingHuman = 0
  let accepted = 0
  let edited = 0
  let rejected = 0
  let criteriaAcknowledged = 0
  let dwellSum = 0
  let dwellSamples = 0
  let deltaSum = 0
  let scoreDeltaSamples = 0

  for (const row of rows) {
    if (row.aiGrade?.status !== 'completed') continue
    aiCompleted += 1
    if (row.criteriaAcknowledged) criteriaAcknowledged += 1
    if (row.reviewDurationMs != null && Number.isFinite(row.reviewDurationMs)) {
      dwellSum += row.reviewDurationMs
      dwellSamples += 1
    }
    const decision = getHitlDecision(row)
    if (decision === 'pending') awaitingHuman += 1
    if (decision === 'accept') accepted += 1
    if (decision === 'edit') edited += 1
    if (decision === 'reject') rejected += 1

    const aiScore = getAiOverallScore(row)
    const humanScore = getHumanFinalScore(row)
    if (
      aiScore != null &&
      humanScore != null &&
      (decision === 'edit' || decision === 'reject' || decision === 'accept')
    ) {
      deltaSum += Math.abs(humanScore - aiScore)
      scoreDeltaSamples += 1
    }
  }

  return {
    aiCompleted,
    awaitingHuman,
    accepted,
    edited,
    rejected,
    criteriaAcknowledged,
    avgDwellMs: dwellSamples > 0 ? Math.round(dwellSum / dwellSamples) : null,
    dwellSamples,
    avgAbsScoreDelta: scoreDeltaSamples > 0 ? Math.round(deltaSum / scoreDeltaSamples) : null,
    scoreDeltaSamples,
  }
}

/**
 * CSV for data scientists: AI estimate vs human decision/score (model-drift evidence).
 */
export function buildProgrammeAiHitlCsv(rows: ProgrammeComponentSubmission[]): string {
  const header = [
    'submission_id',
    'learner_email',
    'learner_name',
    'organization_id',
    'component_id',
    'component_type',
    'component_title',
    'status',
    'ai_status',
    'ai_score',
    'ai_bank_a',
    'ai_pass',
    'ai_model',
    'ai_graded_at',
    'human_decision',
    'human_decision_at',
    'human_score',
    'partner_bank_b',
    'final_score',
    'score_delta_human_minus_ai',
    'criteria_acknowledged',
    'criteria_acknowledged_at',
    'review_opened_at',
    'review_duration_ms',
    'reviewer_name',
    'reviewed_at',
  ].join(',')

  const lines = rows.map((row) => {
    const ai = row.aiGrade
    const aiScore = getAiOverallScore(row)
    const humanScore = getHumanFinalScore(row)
    const bankA = getAiBankAScore(ai)
    const decision = getHitlDecision(row)
    const delta =
      aiScore != null && humanScore != null ? humanScore - aiScore : null
    return [
      csvEscape(row.id),
      csvEscape(row.email),
      csvEscape(row.displayName),
      csvEscape(row.organizationId),
      csvEscape(row.componentId),
      csvEscape(row.componentType),
      csvEscape(row.componentTitle),
      csvEscape(row.status),
      csvEscape(ai?.status ?? null),
      csvEscape(aiScore),
      csvEscape(bankA),
      csvEscape(ai?.pass == null ? null : ai.pass ? 'true' : 'false'),
      csvEscape(ai?.model ?? null),
      csvEscape(ai?.gradedAt ?? null),
      csvEscape(decision === 'none' ? '' : decision),
      csvEscape(row.aiDecisionAt?.toISOString() ?? null),
      csvEscape(humanScore),
      csvEscape(row.partnerScore50),
      csvEscape(row.finalScore),
      csvEscape(delta),
      csvEscape(row.criteriaAcknowledged ? 'true' : 'false'),
      csvEscape(row.criteriaAcknowledgedAt?.toISOString() ?? null),
      csvEscape(row.reviewOpenedAt?.toISOString() ?? null),
      csvEscape(row.reviewDurationMs),
      csvEscape(row.reviewerName),
      csvEscape(row.reviewedAt?.toISOString() ?? null),
    ].join(',')
  })

  return [header, ...lines].join('\n')
}

export function downloadProgrammeAiHitlCsv(
  rows: ProgrammeComponentSubmission[],
  filenamePrefix = 't4l-ai-hitl-export',
): void {
  const csv = buildProgrammeAiHitlCsv(rows)
  const stamp = new Date().toISOString().slice(0, 10)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${stamp}.csv`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
