import type {
  ProgrammeAiDecision,
  ProgrammeComponentSubmission,
} from '@/services/programmeComponentSubmissionService'
import { getAiBankAScore } from '@/services/programmeComponentSubmissionService'

export type HitlDecisionLabel = ProgrammeAiDecision | 'pending' | 'none'

/**
 * Working Stage-1 thresholds (MON-T4L / Chuulu feedback).
 * Soft = warn in UI; hard = require written justification before save.
 * Partners may still correct AI — large moves must be explained (bias control).
 */
export const HITL_SCORE_DELTA_WARN = 15
export const HITL_SCORE_DELTA_MAX = 40
/** Accept dwell under this (ms) counts toward rubber-stamp watch share (M6). */
export const HITL_LOW_DWELL_ACCEPT_MS = 20_000
/** Watch when share of Accepts under low-dwell threshold exceeds this. */
export const HITL_LOW_DWELL_ACCEPT_WATCH_SHARE = 0.2
/** Minimum characters required in partner notes when |Δ| >= HITL_SCORE_DELTA_MAX. */
export const HITL_OVERRIDE_JUSTIFICATION_MIN_CHARS = 20

export type HitlFlagSeverity = 'watch' | 'escalate'

export interface HitlFlag {
  id: string
  severity: HitlFlagSeverity
  title: string
  detail: string
}

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
  /** |human_final - ai_overall| average when both exist and decision is edit/reject/accept. */
  avgAbsScoreDelta: number | null
  scoreDeltaSamples: number
  /** ai_grade.status = error */
  aiErrors: number
  /** Decided rows where |human − AI| >= HITL_SCORE_DELTA_WARN */
  largeDeltaCount: number
  /** Decided rows where |human − AI| >= HITL_SCORE_DELTA_MAX */
  extremeDeltaCount: number
  /** Accept decisions with dwell under HITL_LOW_DWELL_ACCEPT_MS */
  lowDwellAccepts: number
  /** Derived monitoring flags for the current org filter */
  flags: HitlFlag[]
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

export const absScoreDelta = (human: number | null, ai: number | null): number | null => {
  if (human == null || ai == null) return null
  if (!Number.isFinite(human) || !Number.isFinite(ai)) return null
  return Math.abs(Math.round(human) - Math.round(ai))
}

export type ScoreDeltaBand = 'ok' | 'warn' | 'block'

export const classifyScoreDelta = (delta: number | null): ScoreDeltaBand => {
  if (delta == null || !Number.isFinite(delta)) return 'ok'
  if (delta >= HITL_SCORE_DELTA_MAX) return 'block'
  if (delta >= HITL_SCORE_DELTA_WARN) return 'warn'
  return 'ok'
}

/**
 * Live check while the partner is editing: large AI overrides need a written reason.
 */
export function validatePartnerScoreOverride(input: {
  aiScore: number | null
  humanScore: number | null
  decision: ProgrammeAiDecision | ''
  partnerNotes: string
}): { ok: true } | { ok: false; title: string; description: string } {
  const { aiScore, humanScore, decision, partnerNotes } = input
  if (decision !== 'edit' && decision !== 'reject') return { ok: true }
  const delta = absScoreDelta(humanScore, aiScore)
  const band = classifyScoreDelta(delta)
  if (band !== 'block') return { ok: true }
  const notes = partnerNotes.trim()
  if (notes.length >= HITL_OVERRIDE_JUSTIFICATION_MIN_CHARS) return { ok: true }
  return {
    ok: false,
    title: 'Explain this large score change',
    description: `Your score differs from the AI by ${delta} points (limit without notes: ${HITL_SCORE_DELTA_MAX}). Add at least ${HITL_OVERRIDE_JUSTIFICATION_MIN_CHARS} characters of feedback explaining why — this reduces unchecked partner bias.`,
  }
}

function buildHitlFlags(stats: Omit<ProgrammeAiHitlStats, 'flags'>): HitlFlag[] {
  const flags: HitlFlag[] = []

  if (stats.aiErrors > 0) {
    flags.push({
      id: 'ai_errors',
      severity: stats.aiErrors >= 3 ? 'escalate' : 'watch',
      title: 'AI grading errors',
      detail: `${stats.aiErrors} submission${stats.aiErrors === 1 ? '' : 's'} failed Gemini grading. Partners can still score manually.`,
    })
  }

  if (stats.accepted > 0) {
    const share = stats.lowDwellAccepts / stats.accepted
    if (share > HITL_LOW_DWELL_ACCEPT_WATCH_SHARE) {
      flags.push({
        id: 'low_dwell_accept',
        severity: share > 0.4 ? 'escalate' : 'watch',
        title: 'Low-dwell Accepts',
        detail: `${Math.round(share * 100)}% of Accepts under ${HITL_LOW_DWELL_ACCEPT_MS / 1000}s dwell (${stats.lowDwellAccepts}/${stats.accepted}). Watch for rubber-stamping.`,
      })
    }
  }

  if (stats.extremeDeltaCount > 0) {
    flags.push({
      id: 'extreme_delta',
      severity: 'escalate',
      title: 'Extreme AI vs human deltas',
      detail: `${stats.extremeDeltaCount} review${stats.extremeDeltaCount === 1 ? '' : 's'} moved the score by ≥${HITL_SCORE_DELTA_MAX} points. Sample for calibration.`,
    })
  } else if (stats.largeDeltaCount >= 3) {
    flags.push({
      id: 'large_delta',
      severity: 'watch',
      title: 'Large AI vs human deltas',
      detail: `${stats.largeDeltaCount} reviews differ by ≥${HITL_SCORE_DELTA_WARN} points. Check consistency across partners.`,
    })
  }

  const decided = stats.accepted + stats.edited + stats.rejected
  if (decided >= 10 && stats.edited + stats.rejected === 0) {
    flags.push({
      id: 'accept_only',
      severity: 'watch',
      title: 'No Edit or Reject yet',
      detail: `${decided} human decisions and all are Accept. Investigate possible rubber-stamping.`,
    })
  }

  return flags
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
  let aiErrors = 0
  let largeDeltaCount = 0
  let extremeDeltaCount = 0
  let lowDwellAccepts = 0

  for (const row of rows) {
    if (row.aiGrade?.status === 'error') aiErrors += 1
    if (row.aiGrade?.status !== 'completed') continue
    aiCompleted += 1
    if (row.criteriaAcknowledged) criteriaAcknowledged += 1
    if (row.reviewDurationMs != null && Number.isFinite(row.reviewDurationMs)) {
      dwellSum += row.reviewDurationMs
      dwellSamples += 1
    }
    const decision = getHitlDecision(row)
    if (decision === 'pending') awaitingHuman += 1
    if (decision === 'accept') {
      accepted += 1
      if (
        row.reviewDurationMs != null &&
        Number.isFinite(row.reviewDurationMs) &&
        row.reviewDurationMs < HITL_LOW_DWELL_ACCEPT_MS
      ) {
        lowDwellAccepts += 1
      }
    }
    if (decision === 'edit') edited += 1
    if (decision === 'reject') rejected += 1

    const aiScore = getAiOverallScore(row)
    const humanScore = getHumanFinalScore(row)
    if (
      aiScore != null &&
      humanScore != null &&
      (decision === 'edit' || decision === 'reject' || decision === 'accept')
    ) {
      const delta = Math.abs(humanScore - aiScore)
      deltaSum += delta
      scoreDeltaSamples += 1
      if (delta >= HITL_SCORE_DELTA_WARN) largeDeltaCount += 1
      if (delta >= HITL_SCORE_DELTA_MAX) extremeDeltaCount += 1
    }
  }

  const base: Omit<ProgrammeAiHitlStats, 'flags'> = {
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
    aiErrors,
    largeDeltaCount,
    extremeDeltaCount,
    lowDwellAccepts,
  }

  return {
    ...base,
    flags: buildHitlFlags(base),
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
    'abs_score_delta',
    'delta_band',
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
    const delta = aiScore != null && humanScore != null ? humanScore - aiScore : null
    const abs = absScoreDelta(humanScore, aiScore)
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
      csvEscape(abs),
      csvEscape(classifyScoreDelta(abs)),
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
