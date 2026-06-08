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
  // present only on admin list (joined from profiles)
  fullName?: string | null
  email?: string | null
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

/** Admin/partner: list all assessments with the learner's name/email (aggregate view). */
export const listLiftAssessments = async (): Promise<LiftAssessmentRow[]> => {
  const { data, error } = await supabase
    .from('lift_assessments')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapRow(r as Raw))
}
