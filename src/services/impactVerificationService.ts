import { supabase } from '@/services/supabase'
import { upsertChecklistActivity } from '@/services/checklistService'

const SEND_FN = 'send-impact-verification-email'
const RESOLVE_FN = 'resolve-impact-verification'

export type ImpactVerificationStatus = 'pending' | 'approved' | 'rejected'

export interface ImpactVerificationRecord {
  id: string
  impactLogId: string
  userId: string
  learnerName?: string | null
  learnerEmail?: string | null
  verifierName: string
  verifierEmail: string
  verifierRole?: string
  status: ImpactVerificationStatus
  weekNumber: number
  journeyType?: string | null
  activityTitle?: string | null
  pointsToAward?: number
  impactSummary?: Record<string, unknown>
  rejectionReason?: string | null
  resolvedAt?: string | null
  createdAt?: string
}

export interface CreateImpactVerificationParams {
  impactLogId: string
  verifierName: string
  verifierEmail: string
  weekNumber: number
  journeyType: string
  activityTitle: string
  pointsToAward: number
  learnerName?: string | null
  learnerEmail?: string | null
  impactSummary?: Record<string, unknown>
}

export interface CreateImpactVerificationResult {
  id: string
  token: string
  status: ImpactVerificationStatus
  verifierEmail: string
  verifierName: string
  verifierUserId?: string | null
  pointsToAward?: number
}

/** Create a pending verification row and return the one-time email token. */
export async function createImpactVerification(
  params: CreateImpactVerificationParams,
): Promise<CreateImpactVerificationResult> {
  const { data, error } = await supabase.rpc('create_impact_verification', {
    p_impact_log_id: params.impactLogId,
    p_verifier_name: params.verifierName.trim(),
    p_verifier_email: params.verifierEmail.trim().toLowerCase(),
    p_week_number: params.weekNumber,
    p_journey_type: params.journeyType,
    p_activity_title: params.activityTitle,
    p_impact_summary: params.impactSummary ?? {},
    p_learner_name: params.learnerName ?? null,
    p_learner_email: params.learnerEmail ?? null,
    p_points_to_award: params.pointsToAward,
  })
  if (error) throw new Error(error.message)
  const row = data as CreateImpactVerificationResult
  if (!row?.token || !row?.id) {
    throw new Error('Failed to create impact verification')
  }
  return row
}

export type ImpactVerificationEmailSection = {
  title: string
  rows: Array<{ label: string; value: string }>
}

/** Best-effort email to the verifier with approve/reject links. */
export async function sendImpactVerificationEmail(params: {
  to: string
  verifierName: string
  learnerName: string
  learnerEmail?: string | null
  token: string
  activityTitle: string
  submittedAt?: string
  organizationName?: string | null
  sections?: ImpactVerificationEmailSection[]
  summaryLines?: string[]
}): Promise<{ success: boolean }> {
  const appBaseUrl = (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.replace(/\/$/, '')
  try {
    const { data, error } = await supabase.functions.invoke<{ success: boolean }>(SEND_FN, {
      body: {
        to: params.to,
        verifierName: params.verifierName,
        learnerName: params.learnerName,
        learnerEmail: params.learnerEmail ?? undefined,
        token: params.token,
        activityTitle: params.activityTitle,
        submittedAt: params.submittedAt,
        organizationName: params.organizationName ?? undefined,
        sections: params.sections ?? [],
        summaryLines: params.summaryLines ?? [],
        ...(appBaseUrl ? { appBaseUrl } : {}),
      },
    })
    if (error) throw error
    return { success: Boolean(data?.success) }
  } catch (error) {
    console.warn('[impactVerificationService] Failed to send verifier email', error)
    return { success: false }
  }
}

/** Mark checklist impact_log as pending while waiting on the verifier. */
export async function markImpactLogChecklistPending(params: {
  userId: string
  weekNumber: number
}): Promise<void> {
  await upsertChecklistActivity({
    userId: params.userId,
    weekNumber: params.weekNumber,
    activityId: 'impact_log',
    patch: {
      status: 'pending',
      hasInteracted: true,
      rejectionReason: null,
      notes: 'Awaiting verifier approval',
    },
  })
}

async function invokeResolve(params: {
  token: string
  decision: 'preview' | 'approve' | 'reject'
  rejectionReason?: string
}) {
  const { data, error } = await supabase.functions.invoke<{
    success: boolean
    verification?: ImpactVerificationRecord
    alreadyResolved?: boolean
    pointsAwarded?: boolean
    error?: string
    message?: string
  }>(RESOLVE_FN, {
    body: {
      token: params.token,
      decision: params.decision,
      rejectionReason: params.rejectionReason,
    },
  })
  if (error) throw new Error(error.message)
  if (!data?.success && data?.error) {
    throw new Error(data.message || data.error)
  }
  return data
}

export async function previewImpactVerification(token: string): Promise<ImpactVerificationRecord> {
  const data = await invokeResolve({ token, decision: 'preview' })
  if (!data?.verification) throw new Error('Verification not found')
  return data.verification as ImpactVerificationRecord
}

export async function approveImpactVerification(token: string) {
  return invokeResolve({ token, decision: 'approve' })
}

export async function rejectImpactVerification(token: string, rejectionReason?: string) {
  return invokeResolve({ token, decision: 'reject', rejectionReason })
}

/** Overlay verification status from Supabase onto impact log ids. */
export async function fetchVerificationStatusByImpactLogIds(
  impactLogIds: string[],
): Promise<Record<string, ImpactVerificationStatus>> {
  if (!impactLogIds.length) return {}
  const { data, error } = await supabase
    .from('impact_verifications')
    .select('impact_log_id, status')
    .in('impact_log_id', impactLogIds)
  if (error) {
    console.warn('[impactVerificationService] status fetch failed', error.message)
    return {}
  }
  const map: Record<string, ImpactVerificationStatus> = {}
  for (const row of data ?? []) {
    const id = (row as { impact_log_id?: string }).impact_log_id
    const status = (row as { status?: ImpactVerificationStatus }).status
    if (id && status) map[id] = status
  }
  return map
}
