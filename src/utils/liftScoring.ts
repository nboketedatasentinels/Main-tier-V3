/**
 * LIFT Assessment scoring engine - pure, deterministic.
 *
 * Mirrors the confirmed spec (Part D + section 4) exactly. All thresholds and
 * content live in src/config/liftAssessment.ts; this file is logic only, so it
 * stays correct when the question text / scale / formulas are swapped in.
 */
import {
  ITEMS,
  PILLARS,
  SCALE,
  HIGHEST_PRECEDENCE,
  LOWEST_PRECEDENCE,
  COACHING_ITEMS,
  COACHING_ITEM_THRESHOLD,
  COACHING_PILLAR_THRESHOLD,
  EMERGING_INDEX_THRESHOLD,
  PRACTITIONER_PILLAR_THRESHOLD,
  TIER_A_SENIORITY,
  TIER_B_ROLES,
  INTAKE_FIELDS,
  OFFERS,
  computePillarScore,
  computeLiftIndex,
  type PillarKey,
  type Archetype,
  type LeadTier,
  type Offer,
} from '@/config/liftAssessment'

export type ItemScores = Record<string, number>
export interface IntakeAnswers {
  role?: string
  teamSize?: string
  years?: string
  orgSize?: string
  [key: string]: string | undefined
}

export interface LiftResult {
  pillars: Record<PillarKey, number>
  liftIndex: number
  archetype: Archetype
  developmentEdge: PillarKey | null
  recommendedOffer: Offer
  leadTier: LeadTier
  coachingTriggered: boolean
}

/** Pillar scores (0-100), reverse-aware, from raw item scores. */
export const computePillarScores = (itemScores: ItemScores): Record<PillarKey, number> => {
  const buckets: Record<PillarKey, number[]> = { L: [], I: [], F: [], T: [] }
  for (const item of ITEMS) {
    const raw = itemScores[item.id]
    if (typeof raw !== 'number') continue
    const effective = item.reverse ? SCALE.max - raw : raw
    buckets[item.pillar].push(effective)
  }
  return {
    L: computePillarScore(buckets.L),
    I: computePillarScore(buckets.I),
    F: computePillarScore(buckets.F),
    T: computePillarScore(buckets.T),
  }
}

/** Highest-scoring pillar; ties broken by HIGHEST_PRECEDENCE (L > I > F > T). */
export const resolveHighestPillar = (pillars: Record<PillarKey, number>): PillarKey => {
  let best = HIGHEST_PRECEDENCE[0]
  for (const key of HIGHEST_PRECEDENCE) {
    if (pillars[key] > pillars[best]) best = key
  }
  return best
}

/** Lowest-scoring pillar (development edge); ties broken by LOWEST_PRECEDENCE (T > F > I > L). */
export const resolveLowestPillar = (pillars: Record<PillarKey, number>): PillarKey => {
  let worst = LOWEST_PRECEDENCE[0]
  for (const key of LOWEST_PRECEDENCE) {
    if (pillars[key] < pillars[worst]) worst = key
  }
  return worst
}

/** Archetype - evaluate in order, stop at first match (Part D). */
export const resolveArchetype = (pillars: Record<PillarKey, number>, liftIndex: number): Archetype => {
  if (liftIndex < EMERGING_INDEX_THRESHOLD) return 'Emerging Leader'
  if (PILLARS.every((p) => pillars[p.key] >= PRACTITIONER_PILLAR_THRESHOLD)) return 'Practitioner'
  const highest = resolveHighestPillar(pillars)
  return PILLARS.find((p) => p.key === highest)!.archetype
}

/** Coaching trigger: Leading Self pillar < 50, OR (L3 <= 1 AND L5 <= 1). */
export const resolveCoachingTriggered = (
  pillars: Record<PillarKey, number>,
  itemScores: ItemScores,
): boolean => {
  if (pillars.L < COACHING_PILLAR_THRESHOLD) return true
  // missing items default to max so absence never falsely triggers
  return COACHING_ITEMS.every((id) => (itemScores[id] ?? SCALE.max) <= COACHING_ITEM_THRESHOLD)
}

const optionMin = (fieldId: string, value?: string): number => {
  if (!value) return 0
  const field = INTAKE_FIELDS.find((f) => f.id === fieldId)
  const option = field?.options.find((o) => o.value === value)
  return option?.min ?? 0
}

/** Lead tier A/B/C (section 4.3). */
export const resolveLeadTier = (intake: IntakeAnswers): LeadTier => {
  const role = intake.role ?? ''
  const teamMin = optionMin('teamSize', intake.teamSize)
  const yearsMin = optionMin('years', intake.years)
  const orgMin = optionMin('orgSize', intake.orgSize)

  // Tier A - Enterprise
  const byProfile = TIER_A_SENIORITY.has(role) && teamMin >= 11 && (yearsMin >= 10 || orgMin >= 1001)
  const byBigTeam = teamMin >= 50
  if (byProfile || byBigTeam) return 'A'

  // Tier B - Journey
  if (TIER_B_ROLES.has(role)) return 'B'

  // Tier C - Community and Coaching
  return 'C'
}

/** Primary recommended offer ("Start here"). */
export const resolveRecommendation = (archetype: Archetype, edge: PillarKey | null): Offer => {
  if (archetype === 'Emerging Leader') return OFFERS.gateway
  if (archetype === 'Practitioner') return OFFERS.topVoices
  return OFFERS.journeyByEdge[edge ?? resolveLowestPillar({ L: 0, I: 0, F: 0, T: 0 })]
}

/** Full deterministic result from raw item scores + intake answers. */
export const computeLiftResult = (itemScores: ItemScores, intake: IntakeAnswers): LiftResult => {
  const pillars = computePillarScores(itemScores)
  const liftIndex = computeLiftIndex(pillars)
  const archetype = resolveArchetype(pillars, liftIndex)
  const developmentEdge = archetype === 'Practitioner' ? null : resolveLowestPillar(pillars)
  const recommendedOffer = resolveRecommendation(archetype, developmentEdge)
  const leadTier = resolveLeadTier(intake)
  const coachingTriggered = resolveCoachingTriggered(pillars, itemScores)
  return { pillars, liftIndex, archetype, developmentEdge, recommendedOffer, leadTier, coachingTriggered }
}
