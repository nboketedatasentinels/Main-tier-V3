/**
 * LIFT Assessment - single source of truth (content + scoring config).
 *
 * Everything the assessment renders and scores is driven from THIS file: the
 * four pillars, the 20 items, the answer scale, the intake fields, the scoring
 * formulas, the archetype result copy, and the offers/coaching constants. The
 * scoring engine, gate, result page, storage, and admin view all read from here,
 * so editing a question or label needs no logic changes (the assessment is fully
 * config-driven / dynamic).
 *
 * Item IDs (L1-L5, I1-I5, F1-F5, T1-T5) are STABLE - the engine groups by them
 * and L3/L5 drive the coaching trigger - so change `text`, never `id`.
 */

export type PillarKey = 'L' | 'I' | 'F' | 'T'

export type Archetype =
  | 'Anchor'
  | 'Architect'
  | 'Catalyst'
  | 'Operator'
  | 'Practitioner'
  | 'Emerging Leader'

export type LeadTier = 'A' | 'B' | 'C'

export interface Pillar {
  key: PillarKey
  /** Display name. */
  name: string
  /** Archetype awarded when this is the single highest pillar. */
  archetype: Exclude<Archetype, 'Practitioner' | 'Emerging Leader'>
}

/** The four LIFT pillars, in highest-tie-break precedence order: L > I > F > T. */
export const PILLARS: Pillar[] = [
  { key: 'L', name: 'Leading Self in the Age of AI', archetype: 'Anchor' },
  { key: 'I', name: 'Innovation and AI for Digital Transformation', archetype: 'Architect' },
  { key: 'F', name: 'Fostering AI-Ready Teams', archetype: 'Catalyst' },
  { key: 'T', name: 'Transforming Business with AI', archetype: 'Operator' },
]

/** Highest-pillar tie-break precedence (first wins). */
export const HIGHEST_PRECEDENCE: PillarKey[] = ['L', 'I', 'F', 'T']
/** Lowest-pillar (development edge) tie-break precedence (reverse; first wins). */
export const LOWEST_PRECEDENCE: PillarKey[] = ['T', 'F', 'I', 'L']

// ── Answer scale (five points, 0-4) ──────────────────────────────────────────
export const SCALE = {
  min: 0,
  max: 4,
  // index 0..max
  labels: [
    'Strongly disagree',
    'Disagree',
    'Neutral',
    'Agree',
    'Strongly agree',
  ],
} as const

export interface AssessmentItem {
  id: string
  pillar: PillarKey
  text: string
  /** If true, the item is reverse-scored: effective = SCALE.max - raw. */
  reverse?: boolean
}

// ── The 20 items, 5 per pillar. IDs are STABLE and used by the engine;
// L3 and L5 drive the coaching trigger.
export const ITEMS: AssessmentItem[] = [
  { id: 'L1', pillar: 'L', text: 'I stay steady and clear-headed when a transformation gets chaotic.' },
  { id: 'L2', pillar: 'L', text: 'I regulate my own reactions before responding under pressure.' },
  { id: 'L3', pillar: 'L', text: 'I actively manage my energy and resilience over long change cycles.' },
  { id: 'L4', pillar: 'L', text: 'I seek honest feedback on how I show up as a leader.' },
  { id: 'L5', pillar: 'L', text: 'I have practices that keep me grounded when stakes are high.' },

  { id: 'I1', pillar: 'I', text: 'I can tell where AI and data realistically fit in our work.' },
  { id: 'I2', pillar: 'I', text: 'I distinguish genuine opportunity from hype.' },
  { id: 'I3', pillar: 'I', text: 'I translate technical possibility into a credible plan.' },
  { id: 'I4', pillar: 'I', text: 'I keep current with AI tools relevant to my domain.' },
  { id: 'I5', pillar: 'I', text: 'I design solutions that account for real constraints.' },

  { id: 'F1', pillar: 'F', text: 'I get teams to actually adopt new ways of working.' },
  { id: 'F2', pillar: 'F', text: 'I read and dissolve resistance to change.' },
  { id: 'F3', pillar: 'F', text: 'I build psychological safety for experimentation.' },
  { id: 'F4', pillar: 'F', text: 'I coach others through the discomfort of change.' },
  { id: 'F5', pillar: 'F', text: 'I create conditions where teams keep learning.' },

  { id: 'T1', pillar: 'T', text: 'I frame transformation in terms executives act on.' },
  { id: 'T2', pillar: 'T', text: 'I build the operating model that sustains change.' },
  { id: 'T3', pillar: 'T', text: 'I win sponsorship and budget for transformation.' },
  { id: 'T4', pillar: 'T', text: 'I connect transformation to measurable business value.' },
  { id: 'T5', pillar: 'T', text: 'I keep change on track across the long haul.' },
]

/** Items that drive the coaching trigger (raw score <= COACHING_ITEM_THRESHOLD). */
export const COACHING_ITEMS: [string, string] = ['L3', 'L5']
export const COACHING_ITEM_THRESHOLD = 1 // "score is 1 or 0"
export const COACHING_PILLAR_THRESHOLD = 50 // Leading Self pillar < 50

// Archetype thresholds (on the 0-100 pillar / index scale)
export const EMERGING_INDEX_THRESHOLD = 50 // LIFT Index < 50 -> Emerging Leader
export const PRACTITIONER_PILLAR_THRESHOLD = 70 // all four pillars >= 70 -> Practitioner

// ── Scoring formulas ─────────────────────────────────────────────────────────
/** Pillar score 0-100 from its item raw scores (reverse-aware). */
export const computePillarScore = (rawScores: number[]): number => {
  if (rawScores.length === 0) return 0
  const sum = rawScores.reduce((a, b) => a + b, 0)
  const maxSum = rawScores.length * SCALE.max
  return Math.round((sum / maxSum) * 100)
}
/** LIFT Index 0-100 from the four pillar scores (mean of the four pillars). */
export const computeLiftIndex = (pillars: Record<PillarKey, number>): number =>
  Math.round((pillars.L + pillars.I + pillars.F + pillars.T) / 4)

// ── Part A intake (the `min` fields drive lead-tier logic) ───────────────────
export interface IntakeOption {
  value: string
  label: string
  /** Lower bound used by lead-tier numeric thresholds (team size / years / org size). */
  min?: number
}
export interface IntakeField {
  id: 'role' | 'teamSize' | 'years' | 'orgSize'
  label: string
  options: IntakeOption[]
}

export const INTAKE_FIELDS: IntakeField[] = [
  {
    id: 'role',
    label: 'Which best describes your role?',
    options: [
      { value: 'c_suite', label: 'C-suite (CEO, CTO, CFO, etc.)' },
      { value: 'vp_head', label: 'VP / Head of function' },
      { value: 'director', label: 'Director' },
      { value: 'senior_manager', label: 'Senior Manager' },
      { value: 'manager', label: 'Manager' },
      { value: 'team_lead', label: 'Team Lead' },
      { value: 'individual_contributor', label: 'Individual contributor' },
      { value: 'consultant', label: 'Consultant' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    id: 'teamSize',
    label: 'How many people do you lead?',
    options: [
      { value: '0', label: 'None', min: 0 },
      { value: '1_10', label: '1-10', min: 1 },
      { value: '11_49', label: '11-49', min: 11 },
      { value: '50_plus', label: '50+', min: 50 },
    ],
  },
  {
    id: 'years',
    label: 'Years of leadership experience',
    options: [
      { value: 'lt5', label: 'Under 5', min: 0 },
      { value: '5_9', label: '5-9', min: 5 },
      { value: '10_plus', label: '10 or more', min: 10 },
    ],
  },
  {
    id: 'orgSize',
    label: 'Organization size',
    options: [
      { value: '1_50', label: '1-50', min: 1 },
      { value: '51_1000', label: '51-1,000', min: 51 },
      { value: '1001_plus', label: '1,001+', min: 1001 },
    ],
  },
]

// Role groupings for lead-tier logic
export const TIER_A_SENIORITY = new Set(['c_suite', 'vp_head'])
export const TIER_B_ROLES = new Set(['director', 'senior_manager', 'manager', 'team_lead'])

// ── Offers / recommendations ─────────────────────────────────────────────────
export interface Offer {
  key: string
  label: string
  price?: string
}
export const OFFERS = {
  gateway: { key: 'gateway', label: 'The Transformation Practitioner Power Journey (Gateway)', price: '$375' },
  topVoices: { key: 'top_voices', label: 'Top Voices Membership', price: '$500/year' },
  journeyByEdge: {
    L: { key: 'journey_L', label: 'Leading Self in the Age of AI Power Journey' },
    I: { key: 'journey_I', label: 'Innovation and AI for Digital Transformation Power Journey' },
    F: { key: 'journey_F', label: 'Fostering AI-Ready Teams Power Journey' },
    T: { key: 'journey_T', label: 'Transforming Business with AI Power Journey' },
  } as Record<PillarKey, Offer>,
} as const

export const COACHING = {
  single: '$350 single session',
  pack: '$1,500 for five sessions',
  blurb: 'Delivered by an experienced practitioner coach.',
} as const

/** Lead-tier routing owners (used for Zoho routing later + admin display). */
export const TIER_OWNERS: Record<LeadTier, string> = {
  A: 'Nono',
  B: 'Nyaga',
  C: 'Ayakwa',
}

// ── Result-page copy per archetype (FINAL - provided by client) ───────────────
export interface ArchetypeCopy {
  strength: string
  body: string
  sayItOutLoud: string
  /** Show the development edge line for this archetype? (false for Practitioner) */
  showEdge: boolean
}

export const ARCHETYPE_COPY: Record<Archetype, ArchetypeCopy> = {
  Anchor: {
    strength: 'Leading Self in the Age of AI',
    body: 'You lead yourself well under pressure, and people feel it. You hold steadiness when transformations get loud, and that is rarer than it sounds. Your edge is turning that inner steadiness outward, into the business and the boardroom, so the calm becomes momentum others can follow.',
    sayItOutLoud: 'I scored as The Anchor on the LIFT Index.',
    showEdge: true,
  },
  Architect: {
    strength: 'Innovation and AI for Digital Transformation',
    body: 'You see the technical path others miss. You read where AI and data actually fit, and you can tell ambition from reality. Your edge is the human side of the work, bringing teams and executives with you so the path you see actually gets walked.',
    sayItOutLoud: 'I scored as The Architect on the LIFT Index.',
    showEdge: true,
  },
  Catalyst: {
    strength: 'Fostering AI-Ready Teams',
    body: 'You get teams to actually adopt change. You read people and dissolve resistance that stops most transformations cold. Your edge is the executive frame, translating what you do on the ground into the language that wins sponsorship and budget upstairs.',
    sayItOutLoud: 'I scored as The Catalyst on the LIFT Index.',
    showEdge: true,
  },
  Operator: {
    strength: 'Transforming Business with AI',
    body: 'You move the business and the room. You frame transformation for executives, read resistance, and build the operating system that holds change together. Your edge is closer to home: sustaining the people doing the work, and yourself, across the long haul.',
    sayItOutLoud: 'I scored as The Operator on the LIFT Index.',
    showEdge: true,
  },
  Practitioner: {
    strength: 'Balanced across all four LIFT pillars',
    body: 'You lead transformation across all four pillars. This is the integrated profile the LIFT framework points toward, and very few people land here. The work now is not catching up, it is staying sharp and helping others get here.',
    sayItOutLoud: 'I scored as The Practitioner on the LIFT Index.',
    showEdge: false,
  },
  'Emerging Leader': {
    strength: 'All four LIFT pillars (your foundation to build)',
    body: 'You are early, and you are in the right place. You have the instinct to lead transformation and the honesty to find out where you stand, which is exactly where every practitioner starts. The fastest way forward is the Gateway, the journey built for practitioners new to the framework.',
    sayItOutLoud: 'I scored as an Emerging Leader on the LIFT Index. Ask me again in six months.',
    showEdge: false,
  },
}
