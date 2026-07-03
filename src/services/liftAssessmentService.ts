/**
 * LIFT Assessment data access (Supabase). RLS scopes rows to uid = auth.uid();
 * partner/admin can read all (admin view + aggregate).
 */
import { supabase } from '@/services/supabase'
import type { ItemScores, IntakeAnswers, LiftResult } from '@/utils/liftScoring'
import type { PillarKey, Archetype, LeadTier } from '@/config/liftAssessment'

export interface LiftAssessmentRow {
  uid: string
  intake: IntakeAnswers
  itemScores: ItemScores
  pillars: Record<PillarKey, number>
  liftIndex: number
  archetype: Archetype
  developmentEdge: PillarKey | null
  recommendedOffer: string
  leadTier: LeadTier
  coachingTriggered: boolean
  createdAt: string
  // Last time the snapshot was written (drives 90-day retake eligibility).
  updatedAt?: string
  // present only on admin list (joined from profiles)
  fullName?: string | null
  email?: string | null
}

/** A single take from the append-only history log (for before/after deltas). */
export interface LiftHistoryEntry {
  pillars: Record<PillarKey, number>
  liftIndex: number
  archetype: Archetype
  developmentEdge: PillarKey | null
  takenAt: string
}

type Raw = Record<string, unknown>

const mapRow = (row: Raw): LiftAssessmentRow => {
  const profile = (row.profiles as Raw | null) || null
  return {
    uid: row.uid as string,
    intake: (row.intake as IntakeAnswers) ?? {},
    itemScores: (row.item_scores as ItemScores) ?? {},
    pillars: {
      L: (row.pillar_l as number) ?? 0,
      I: (row.pillar_i as number) ?? 0,
      F: (row.pillar_f as number) ?? 0,
      T: (row.pillar_t as number) ?? 0,
    },
    liftIndex: (row.lift_index as number) ?? 0,
    archetype: row.archetype as Archetype,
    developmentEdge: (row.development_edge as PillarKey | null) ?? null,
    recommendedOffer: (row.recommended_offer as string) ?? '',
    leadTier: row.lead_tier as LeadTier,
    coachingTriggered: Boolean(row.coaching_triggered),
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? undefined,
    fullName: (profile?.full_name as string) ?? null,
    email: (profile?.email as string) ?? null,
  }
}

/** Has this user already completed the assessment? (drives the one-time gate). */
export const hasCompletedLiftAssessment = async (uid: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('lift_assessments')
    .select('uid')
    .eq('uid', uid)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

/** Fetch the signed-in user's own assessment (for the read-only results page). */
export const getOwnLiftAssessment = async (uid: string): Promise<LiftAssessmentRow | null> => {
  const { data, error } = await supabase
    .from('lift_assessments')
    .select('*')
    .eq('uid', uid)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Raw) : null
}

/** Persist a completed assessment (one row per user; uid is the PK). */
export const submitLiftAssessment = async (
  uid: string,
  intake: IntakeAnswers,
  itemScores: ItemScores,
  result: LiftResult,
): Promise<void> => {
  const { error } = await supabase.from('lift_assessments').upsert(
    {
      uid,
      intake,
      item_scores: itemScores,
      pillar_l: result.pillars.L,
      pillar_i: result.pillars.I,
      pillar_f: result.pillars.F,
      pillar_t: result.pillars.T,
      lift_index: result.liftIndex,
      archetype: result.archetype,
      development_edge: result.developmentEdge,
      recommended_offer: result.recommendedOffer.key,
      lead_tier: result.leadTier,
      coaching_triggered: result.coachingTriggered,
    },
    { onConflict: 'uid' },
  )
  if (error) throw new Error(error.message)
}

/**
 * Create an ANONYMOUS lead UP-FRONT, the moment contact details are submitted
 * (before the questions). Returns the new lead id so the funnel can complete it
 * once the visitor finishes. Capturing here - rather than at the end - means the
 * admin keeps the lead even if the visitor abandons the assessment partway.
 * Best-effort: failures are surfaced to the caller, which still runs the flow.
 */
export const createLiftLead = async (intake: IntakeAnswers): Promise<string | null> => {
  // Generate the id client-side: anonymous visitors cannot read rows back (the
  // SELECT policy is partner/admin-only), so we cannot rely on insert-returning.
  // Owning the id up-front lets us complete the same row later via UPDATE.
  const id = crypto.randomUUID()
  const { error } = await supabase.from('lift_leads').insert({
    id,
    first_name: intake.firstName ?? null,
    last_name: intake.lastName ?? null,
    email: intake.email ?? null,
    organisation: intake.organisation ?? null,
    country: intake.country ?? null,
    gender: intake.gender ?? null,
    phone: intake.phone ?? null,
    intake,
  })
  if (error) throw new Error(error.message)
  return id
}

/**
 * Complete a previously-created lead with the assessment scores/result. Locks
 * the row (sets `completed_at`) so it stays immutable from the client after.
 *
 * Goes through the `complete_lift_lead` SECURITY DEFINER RPC, NOT a direct
 * .update(): `lift_leads` SELECT is partner/admin-only, and RLS requires a row
 * to be visible via SELECT before an UPDATE can match it — so an anonymous
 * .update() silently affects 0 rows (200, no error) and completed_at never gets
 * set. The RPC runs as the owner, bypasses RLS for this one controlled write,
 * and keeps reads locked down. See migration 0029.
 */
export const completeLiftLead = async (
  id: string,
  intake: IntakeAnswers,
  itemScores: ItemScores,
  result: LiftResult,
): Promise<void> => {
  const { error } = await supabase.rpc('complete_lift_lead', {
    p_id: id,
    p_intake: intake,
    p_item_scores: itemScores,
    p_pillar_l: result.pillars.L,
    p_pillar_i: result.pillars.I,
    p_pillar_f: result.pillars.F,
    p_pillar_t: result.pillars.T,
    p_lift_index: result.liftIndex,
    p_archetype: result.archetype,
    p_development_edge: result.developmentEdge,
    p_recommended_offer: result.recommendedOffer.key,
    p_lead_tier: result.leadTier,
    p_coaching_triggered: result.coachingTriggered,
  })
  if (error) throw new Error(error.message)
}

/**
 * Persist an ANONYMOUS lead from the public funnel in one shot (no account).
 * Fallback for when the up-front `createLiftLead` did not yield an id - the
 * contact details are carried inside `intake`; we also lift them into dedicated
 * columns so partner/admin can list/filter leads without digging into jsonb.
 * Best-effort: failures are surfaced to the caller, which still shows results.
 */
export const submitLiftLead = async (
  intake: IntakeAnswers,
  itemScores: ItemScores,
  result: LiftResult,
): Promise<void> => {
  const { error } = await supabase.from('lift_leads').insert({
    first_name: intake.firstName ?? null,
    last_name: intake.lastName ?? null,
    email: intake.email ?? null,
    organisation: intake.organisation ?? null,
    country: intake.country ?? null,
    gender: intake.gender ?? null,
    phone: intake.phone ?? null,
    intake,
    item_scores: itemScores,
    pillar_l: result.pillars.L,
    pillar_i: result.pillars.I,
    pillar_f: result.pillars.F,
    pillar_t: result.pillars.T,
    lift_index: result.liftIndex,
    archetype: result.archetype,
    development_edge: result.developmentEdge,
    recommended_offer: result.recommendedOffer.key,
    lead_tier: result.leadTier,
    coaching_triggered: result.coachingTriggered,
    completed_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

const mapLeadRow = (row: Raw): LiftAssessmentRow => {
  const intake = (row.intake as IntakeAnswers) ?? {}
  const fullName = `${(row.first_name as string) ?? ''} ${(row.last_name as string) ?? ''}`.trim()
  return {
    uid: row.id as string,
    intake,
    itemScores: (row.item_scores as ItemScores) ?? {},
    pillars: {
      L: (row.pillar_l as number) ?? 0,
      I: (row.pillar_i as number) ?? 0,
      F: (row.pillar_f as number) ?? 0,
      T: (row.pillar_t as number) ?? 0,
    },
    liftIndex: (row.lift_index as number) ?? 0,
    archetype: row.archetype as Archetype,
    developmentEdge: (row.development_edge as PillarKey | null) ?? null,
    recommendedOffer: (row.recommended_offer as string) ?? '',
    leadTier: row.lead_tier as LeadTier,
    coachingTriggered: Boolean(row.coaching_triggered),
    createdAt: (row.created_at as string) ?? '',
    fullName: fullName || null,
    email: (row.email as string) ?? null,
  }
}

/**
 * Admin/partner: list all ANONYMOUS leads from the public funnel (no account).
 * Contact details (organisation, country, gender, phone, ...) live inside each
 * row's `intake`, so the admin view reads them straight off `row.intake`.
 */
export const listLiftLeads = async (): Promise<LiftAssessmentRow[]> => {
  const { data, error } = await supabase
    .from('lift_leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapLeadRow(r as Raw))
}

/** Admin/partner: list all assessments with the learner's name/email (aggregate view). */
export const listLiftAssessments = async (): Promise<LiftAssessmentRow[]> => {
  const { data, error } = await supabase
    .from('lift_assessments')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapRow(r as Raw))
}
