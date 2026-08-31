/**
 * Improvement-claim email confirmation (measure owner → finance).
 * Reuses impact_verifications tokens + /verify-impact public page.
 */
import { supabase } from '@/services/supabase'
import { sendImpactVerificationEmail } from '@/services/impactVerificationService'
import { formatMoney, bandOf, bandNeedsFinance } from '@/config/impactValueEngine'

export type ClaimConfirmRole = 'measure_owner' | 'finance'

export async function createImpactClaimConfirmation(params: {
  impactLogId: string
  role: ClaimConfirmRole
  verifierName: string
  verifierEmail: string
  activityTitle: string
  learnerName?: string | null
  learnerEmail?: string | null
  summary: Record<string, unknown>
}): Promise<{ id: string; token: string; verifierEmail: string; verifierName: string }> {
  const { data, error } = await supabase.rpc('create_impact_claim_confirmation', {
    p_impact_log_id: params.impactLogId,
    p_verifier_name: params.verifierName.trim(),
    p_verifier_email: params.verifierEmail.trim().toLowerCase(),
    p_role: params.role,
    p_activity_title: params.activityTitle,
    p_impact_summary: {
      kind: 'improvement_claim',
      role: params.role,
      ...params.summary,
    },
    p_learner_name: params.learnerName ?? null,
    p_learner_email: params.learnerEmail ?? null,
    p_user_id: null,
  })
  if (error) throw new Error(error.message)
  const row = data as {
    id?: string
    token?: string
    verifierEmail?: string
    verifierName?: string
  }
  if (!row?.token || !row?.id) throw new Error('Failed to create claim confirmation')
  return {
    id: row.id,
    token: row.token,
    verifierEmail: row.verifierEmail || params.verifierEmail,
    verifierName: row.verifierName || params.verifierName,
  }
}

/** After a claim is saved, email the measure owner (and note finance for later). */
export async function requestClaimConfirmations(params: {
  impactLogId: string
  measureTitle: string
  net: number
  tier: number
  bucket: string
  ownerName: string
  ownerEmail: string
  financeName?: string
  financeEmail?: string
  learnerName: string
  learnerEmail?: string | null
  organizationName?: string | null
  evidenceRef?: string
  source?: string
  window?: string
}): Promise<{ ownerEmailed: boolean; needsFinance: boolean; warning?: string }> {
  const band = bandOf(params.net)
  const needsFinance =
    bandNeedsFinance(params.net) && Boolean(params.financeEmail?.trim())

  const created = await createImpactClaimConfirmation({
    impactLogId: params.impactLogId,
    role: 'measure_owner',
    verifierName: params.ownerName,
    verifierEmail: params.ownerEmail,
    activityTitle: params.measureTitle,
    learnerName: params.learnerName,
    learnerEmail: params.learnerEmail,
    summary: {
      net: Math.round(params.net),
      tier: params.tier,
      bucket: params.bucket,
      band: band.name,
      needsFinance,
      financeName: params.financeName || '',
      financeEmail: params.financeEmail?.trim().toLowerCase() || '',
      source: params.source || '',
      window: params.window || '',
      evidence: params.evidenceRef || '',
      valueLabel: params.tier === 1 ? 'No currency value yet' : formatMoney(params.net),
    },
  })

  const emailed = await sendImpactVerificationEmail({
    to: created.verifierEmail,
    verifierName: created.verifierName,
    learnerName: params.learnerName,
    learnerEmail: params.learnerEmail,
    token: created.token,
    activityTitle: `Improvement claim · ${params.measureTitle}`,
    organizationName: params.organizationName,
    sections: [
      {
        title: 'What you are confirming',
        rows: [
          { label: 'Claim', value: params.measureTitle },
          { label: 'Learner', value: params.learnerName },
          { label: 'Indicative net / period', value: params.tier === 1 ? 'None at Tier 1' : formatMoney(params.net) },
          { label: 'Bucket', value: params.bucket },
          { label: 'Your role', value: 'Measure owner' },
          {
            label: 'Next step',
            value: needsFinance
              ? 'After you confirm, finance will be emailed to validate before headline value.'
              : 'Your confirmation recognizes this claim on the Impact Log dashboard.',
          },
        ],
      },
      {
        title: 'Evidence',
        rows: [
          { label: 'Source', value: params.source || '-' },
          { label: 'Window', value: params.window || '-' },
          { label: 'Evidence ref', value: params.evidenceRef || '-' },
        ],
      },
    ],
  })

  if (!emailed.success) {
    return {
      ownerEmailed: false,
      needsFinance,
      warning: 'Claim saved, but the confirmation email could not be sent. Ask your partner to resend or confirm in-app.',
    }
  }

  return { ownerEmailed: true, needsFinance }
}
