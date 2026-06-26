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

// ── Contact capture (lead details collected AFTER the questions) ──────────────
// Shown once the assessment is answered, just before results are revealed. The
// values are merged into `intake` (jsonb) so they persist on both the signed-in
// save and the anonymous pending-lift hand-off - no schema change needed.
export type ContactFieldId =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'organisation'
  | 'country'
  | 'gender'
  | 'phone'

export interface ContactField {
  id: ContactFieldId
  label: string
  type: 'text' | 'email' | 'tel' | 'select'
  placeholder?: string
  required: boolean
  /** Layout hint: render this field at half width (pairs up on wider screens). */
  half?: boolean
  options?: { value: string; label: string }[]
}

export const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not', label: 'Prefer not to say' },
]

/** Country list for the contact step (alphabetical; value === label). */
export const COUNTRIES: string[] = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
  'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
  'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
  'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo',
  'Costa Rica', "Côte d'Ivoire", 'Croatia', 'Cuba', 'Cyprus', 'Czechia', 'Democratic Republic of the Congo',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador',
  'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea',
  'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran',
  'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
  'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein',
  'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta',
  'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
  'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands',
  'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman',
  'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia',
  'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
  'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand',
  'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
]

export const CONTACT_FIELDS: ContactField[] = [
  { id: 'firstName', label: 'First name', type: 'text', placeholder: 'Jordan', required: true, half: true },
  { id: 'lastName', label: 'Last name', type: 'text', placeholder: 'Mensah', required: true, half: true },
  { id: 'email', label: 'Work email', type: 'email', placeholder: 'you@company.com', required: true },
  {
    id: 'organisation',
    label: 'Organisation',
    type: 'text',
    placeholder: 'Where you lead',
    required: true,
  },
  {
    id: 'country',
    label: 'Country',
    type: 'select',
    required: true,
    options: COUNTRIES.map((c) => ({ value: c, label: c })),
  },
  { id: 'gender', label: 'Gender', type: 'select', required: true, options: GENDER_OPTIONS },
  {
    id: 'phone',
    label: 'Phone number',
    type: 'tel',
    placeholder: 'Optional',
    required: false,
  },
]

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

// ── Result content per archetype (FINAL spec) ────────────────────────────────
// Voice: American English, no em dashes, behaviour-based ("how you show up"),
// never personality labels. Static per archetype: reveal, the four pillar
// blocks, the carry/edge line, the three scenarios. Dynamic per person: the
// scores/bar widths and the development path (chosen by the lowest pillar).

/** Short pillar labels used in the pillar-by-pillar headings (e.g. "L · Leading Self"). */
export const PILLAR_SHORT_LABEL: Record<PillarKey, string> = {
  L: 'Leading Self',
  I: 'Innovation and AI',
  F: 'Fostering AI-Ready Teams',
  T: 'Transforming Business',
}

/** Accent colour per archetype (matches the official symbol's label colour). */
export const ARCHETYPE_ACCENT: Record<Archetype, string> = {
  Anchor: '#9c6f15',
  Architect: '#2563eb',
  Catalyst: '#247a4d',
  Operator: '#6b21a8',
  Practitioner: '#9c6f15',
  'Emerging Leader': '#6b7280',
}

export interface PillarBlock {
  key: PillarKey
  /** This pillar's role for the archetype (drives the "(your strength/your edge)" tag). */
  role?: 'strength' | 'edge'
  howYouShowUp: string
  asset: string
  watchFor: string
}

export interface Scenario {
  /** Bolded situation lead-in. */
  situation: string
  /** What it means for this leader and the move to make. */
  guidance: string
}

export interface DevelopmentPath {
  /** Descriptive line ("Your development edge is ..." or "Development path: ..."). */
  body: string
  /** The "Recommended next: ..." sentence. */
  recommended: string
}

export interface ArchetypeContent {
  /** Strongest-pillar line shown under the symbol. */
  strongest: string
  reveal: string
  /** Four pillar blocks, strength first (spec order). */
  pillarBlocks: PillarBlock[]
  carryEdge: string
  /** Three "how this plays out under pressure" scenarios. */
  scenarios: Scenario[]
  /** Practitioner & Emerging Leader use a fixed path; others resolve by lowest pillar. */
  fixedDevelopmentPath?: DevelopmentPath
}

// ── Development paths, selected by the person's LOWEST pillar (Section 2) ──────
export const DEVELOPMENT_PATHS: Record<PillarKey, DevelopmentPath> = {
  L: {
    body: 'Your development edge is Leading Self in the Age of AI: holding your judgment, steadiness, and ethics when the change gets loud.',
    recommended: 'Recommended next: the Leading Self pillar journey.',
  },
  I: {
    body: 'Your development edge is Innovation and AI for Digital Transformation: reading where AI and data genuinely fit, and telling ambition from reality.',
    recommended: 'Recommended next: the Innovation and AI pillar journey.',
  },
  F: {
    body: 'Your development edge is Fostering AI-Ready Teams: getting people to adopt change and dissolving the resistance that stalls most transformations.',
    recommended: 'Recommended next: the Fostering AI-Ready Teams pillar journey.',
  },
  T: {
    body: 'Your development edge is Transforming Business with AI: moving the business and the boardroom, and framing change for executives.',
    recommended: 'Recommended next: the Transforming Business pillar journey.',
  },
}

/** Foundation path used when there is no single lowest pillar to act on. */
export const DEFAULT_DEVELOPMENT_PATH: DevelopmentPath = {
  body: 'Your development path is the foundation across all four pillars.',
  recommended:
    'Recommended next: the Gateway Journey, The Transformation Practitioner, which builds the foundation across all four pillars.',
}

// ── Static chrome shared by the result page and email ─────────────────────────
export const RESULT_CHROME = {
  eyebrow: 'YOUR LIFT INDEX RESULT',
  mission: 'We develop the leaders who make AI and digital transformation succeed.',
  retake: 'Retake the LIFT Index in 90 days to see how your pattern shifts.',
  carryBadge: 'CARRIES YOU',
  edgeBadge: 'GROWTH EDGE',
  primaryCta: 'Start the Gateway Journey',
} as const

export const ARCHETYPE_CONTENT: Record<Archetype, ArchetypeContent> = {
  Anchor: {
    strongest: 'Leading Self in the Age of AI',
    reveal:
      'You are the leader a team stays steady around when the transformation gets loud. Your judgment holds when the plan stops behaving, and people borrow that steadiness from you without realising they are doing it.',
    pillarBlocks: [
      {
        key: 'L',
        role: 'strength',
        howYouShowUp:
          'You regulate yourself before you act. When the plan stops behaving, your judgment holds, and the room reads that as permission to stay calm.',
        asset: 'Teams co-regulate off you. You are the steady signal in a noisy change.',
        watchFor:
          'Steadiness can read as not feeling the urgency. Say the stakes out loud so calm is not mistaken for low investment.',
      },
      {
        key: 'F',
        howYouShowUp:
          'People trust you, so you can move them through changes they would resist from someone else.',
        asset: 'You hold real trust capital, the kind you can spend on a hard transition.',
        watchFor:
          "You may absorb the team's distress instead of surfacing it. Distribute the load before it sits only on you.",
      },
      {
        key: 'I',
        howYouShowUp:
          'You weigh AI decisions calmly and are slow to chase a tool because it is loud this quarter.',
        asset: 'You will not get stampeded by a board demo into adopting the wrong thing.',
        watchFor:
          'Calm can slide into wait. Put a date on the decision so wait does not quietly become the default.',
      },
      {
        key: 'T',
        role: 'edge',
        howYouShowUp:
          'You hold the work together on the ground, but you are less inclined to push it up into the boardroom and frame it for executives.',
        asset: 'You give a programme a dependable delivery floor.',
        watchFor:
          'This is your edge. Your steadiness stays internal. The next step is translating it into executive language, sponsorship, and budget.',
      },
    ],
    carryEdge:
      'What carries you: Leading Self. Typical growth edge: Transforming Business. Your edge is not a weakness, it is the most useful place to put your next 90 days.',
    scenarios: [
      {
        situation: 'A rollout stalls at month three.',
        guidance:
          'You will hold the team steady, which most leaders cannot. The risk is that you absorb the pressure instead of escalating it to the sponsors who can clear the blocker. Escalate earlier than feels comfortable.',
      },
      {
        situation: 'The board wants AI, and wants it now.',
        guidance:
          'You will not get stampeded, and that is an asset. Make sure your calm reads as a position, not hesitation. Walk in with a dated adopt, adapt, or wait recommendation.',
      },
      {
        situation: 'Your strongest person resists the change.',
        guidance:
          'You will keep the relationship intact where others would break it. Watch that you do not carry their resistance quietly on their behalf. Name it, and keep moving.',
      },
    ],
  },
  Architect: {
    strongest: 'Innovation and AI for Digital Transformation',
    reveal:
      'You are the leader who sees the technical path before anyone else, and can tell a real AI fit from a loud one. Where others get sold, you assess.',
    pillarBlocks: [
      {
        key: 'I',
        role: 'strength',
        howYouShowUp:
          'You read where AI and data genuinely fit and separate ambition from reality quickly.',
        asset: 'You will not waste a budget cycle on a tool that demos well and delivers nothing.',
        watchFor:
          'Being right is not the same as being followed. The clearest path still needs people willing to walk it.',
      },
      {
        key: 'L',
        howYouShowUp:
          'You trust your own read, which steadies you, though the pressure of being the one who sees it can sit heavy.',
        asset: 'Conviction other people borrow.',
        watchFor: 'Hold the line between confidence and not hearing the room.',
      },
      {
        key: 'F',
        role: 'edge',
        howYouShowUp:
          'You can explain the path, but bringing people emotionally with you is less instinctive.',
        asset: 'Clarity people can follow once they are on board.',
        watchFor: 'A correct plan a team resists still fails. Spend real time on adoption, not just logic.',
      },
      {
        key: 'T',
        howYouShowUp:
          'You can frame the technical case, but translating it into boardroom and budget language is less natural.',
        asset: 'Substance behind the pitch.',
        watchFor: 'Executives buy outcomes and risk, not architecture. Lead with what it does for the business.',
      },
    ],
    carryEdge:
      'What carries you: Innovation and AI. Typical growth edge: Fostering AI-Ready Teams. The path you see only matters if people walk it.',
    scenarios: [
      {
        situation: 'The board wants a tool you know is wrong.',
        guidance:
          "You will see it clearly. The risk is winning the argument and losing the room. Frame your case in their language, not the tool's.",
      },
      {
        situation: 'Your team is not adopting the path you mapped.',
        guidance:
          'You will be tempted to re-explain the logic. The block usually is not logic, it is buy-in. Bring them into the why before the what.',
      },
      {
        situation: 'Two AI options, both plausible.',
        guidance:
          'This is your strength. Score them against the transformation, not the feature list, and put a date on the call so analysis does not become delay.',
      },
    ],
  },
  Catalyst: {
    strongest: 'Fostering AI-Ready Teams',
    reveal:
      'You are the leader who gets people to actually move. Where transformations stall on resistance, you are the one who dissolves it.',
    pillarBlocks: [
      {
        key: 'F',
        role: 'strength',
        howYouShowUp:
          'You read team dynamics and shift trust, status, and safety so people adopt change instead of bracing against it.',
        asset: 'You unstick the human resistance that kills most transformations.',
        watchFor:
          'You can carry the team so well that leadership never sees the cost. Make the work visible.',
      },
      {
        key: 'L',
        howYouShowUp: "You feel the team's state deeply, which is both your gift and your load.",
        asset: 'Empathy that earns trust fast.',
        watchFor: 'You may absorb everyone’s pressure and neglect your own steadiness. Protect it.',
      },
      {
        key: 'I',
        howYouShowUp: 'You focus on people over tools, so AI-fit judgment is less your instinct.',
        asset: 'You keep technology in service of people.',
        watchFor:
          'Lean on the framework to tell real AI fit from hype, so you do not adopt just to keep people comfortable.',
      },
      {
        key: 'T',
        role: 'edge',
        howYouShowUp:
          'You move people on the ground, but translating that into the executive frame is less natural.',
        asset: 'Proof that change is landing where it counts.',
        watchFor: 'Your edge: turn ground-level wins into the language that wins sponsorship and budget.',
      },
    ],
    carryEdge:
      'What carries you: Fostering AI-Ready Teams. Typical growth edge: Transforming Business. The room that funds the work speaks a different language than the team doing it.',
    scenarios: [
      {
        situation: 'A resistant team is stalling the rollout.',
        guidance:
          'This is your strength. You will move them. Make sure leadership sees what that took, or it gets taken for granted.',
      },
      {
        situation: 'You need budget to keep the change alive.',
        guidance:
          'Translate the ground-level wins into business outcomes and risk. The boardroom funds what it can measure.',
      },
      {
        situation: 'A tool everyone likes is not actually working.',
        guidance:
          'You will be tempted to keep the peace. Name the gap. Comfortable and effective are not the same thing.',
      },
    ],
  },
  Operator: {
    strongest: 'Transforming Business with AI',
    reveal:
      'You are the leader who moves the business and the room. You frame change for executives and build the operating system that holds it together.',
    pillarBlocks: [
      {
        key: 'T',
        role: 'strength',
        howYouShowUp:
          'You map stakeholders, frame transformation for the boardroom, and build the structure that makes change survive contact.',
        asset: 'You make change stick at the organisational level, not just the pilot.',
        watchFor:
          'Systems move organisations, but people live inside them. Do not let the operating model outrun the humans in it.',
      },
      {
        key: 'L',
        role: 'edge',
        howYouShowUp: 'You carry a lot of organisational weight, which can quietly cost you.',
        asset: 'You hold under load.',
        watchFor:
          'Sustaining yourself across the long haul is the edge closest to home. Guard your own steadiness.',
      },
      {
        key: 'I',
        howYouShowUp: 'You make sound calls on where AI fits at the business level.',
        asset: 'A strategic read on technology.',
        watchFor:
          "Stay close enough to the detail that the board's enthusiasm does not override the actual fit.",
      },
      {
        key: 'F',
        howYouShowUp:
          'You move the structure, but the felt experience of the people inside it can get less attention.',
        asset: 'Clear direction people can orient to.',
        watchFor:
          "Change adopted on paper is not adopted. Invest in the team's lived transition, not just the plan.",
      },
    ],
    carryEdge:
      'What carries you: Transforming Business. Typical growth edge: Leading Self. You can hold the organisation, the risk is not holding yourself.',
    scenarios: [
      {
        situation: 'The transformation is on track but morale is sinking.',
        guidance:
          'You will see the plan working. Watch the people. Structure without sustained humans stalls at month three.',
      },
      {
        situation: 'You are carrying the whole programme.',
        guidance:
          'Your strength is also your risk. Build in what sustains you and the people doing the work, or the long haul wins.',
      },
      {
        situation: 'The board wants it faster.',
        guidance:
          'You can frame the trade-offs better than anyone. Make the human cost of speed part of the conversation, not an afterthought.',
      },
    ],
  },
  Practitioner: {
    strongest: 'Balanced across all four pillars',
    reveal:
      'You are strong across all four pillars at once, which is rare. This is what the whole LIFT framework points toward.',
    pillarBlocks: [
      {
        key: 'L',
        howYouShowUp: 'You hold yourself steady, and it is visible to the people around you.',
        asset: 'A steady centre others orient to.',
        watchFor:
          'The risk at this level is autopilot. Keep examining your own patterns when the change gets hard.',
      },
      {
        key: 'I',
        howYouShowUp: 'You judge AI fit well and are hard to sell.',
        asset: 'Sound technology decisions under pressure.',
        watchFor: 'Stay curious. The tools keep moving, and yesterday’s read expires.',
      },
      {
        key: 'F',
        howYouShowUp: 'You move teams through change others would lose.',
        asset: 'Adoption you can rely on.',
        watchFor: 'Keep developing other people, not only delivering through them.',
      },
      {
        key: 'T',
        howYouShowUp: 'You move the business and the boardroom.',
        asset: 'Organisational reach.',
        watchFor: 'Use your range to lift the people around you, not to do it all yourself.',
      },
    ],
    carryEdge:
      'No single weak pillar. Your edge is not a gap, it is staying sharp and helping others get there.',
    scenarios: [
      {
        situation: 'You are the most capable person in the room.',
        guidance:
          'The trap is doing it all yourself. Your highest-leverage move now is to multiply through others.',
      },
      {
        situation: 'A pillar you are strong in starts to feel automatic.',
        guidance: 'Comfort is the risk at your level. Keep pressure-testing your own reasoning.',
      },
      {
        situation: 'Someone junior is where you were years ago.',
        guidance:
          'Developing them is worth more than out-delivering them. That is the work now.',
      },
    ],
    fixedDevelopmentPath: {
      body: "Development path: range and reach. Stay sharp across all four pillars and turn your capability into other people's.",
      recommended:
        'Recommended next: Top Voices membership and Transformation Coaching, which are built for practitioners at this level.',
    },
  },
  'Emerging Leader': {
    strongest: 'Early across the four pillars',
    reveal:
      'You are early in the journey, with the instinct to lead transformation and the honesty to find out where you stand. That honesty is the part most people skip.',
    pillarBlocks: [
      {
        key: 'L',
        howYouShowUp: 'You are building the steadiness that holds under pressure.',
        asset: 'Self-awareness, which is where it starts.',
        watchFor: 'First step: notice your own pattern when change gets hard.',
      },
      {
        key: 'I',
        howYouShowUp: 'You are learning to tell a real AI fit from hype.',
        asset: 'Openness without being sold.',
        watchFor: 'First step: use the adopt, adapt, or wait lens on one real decision.',
      },
      {
        key: 'F',
        howYouShowUp: 'You are learning to move people through change.',
        asset: 'Instinct for people.',
        watchFor: 'First step: read where the trust and the resistance actually sit.',
      },
      {
        key: 'T',
        howYouShowUp: 'You are learning to frame change for the business.',
        asset: 'Ambition pointed in the right direction.',
        watchFor: 'First step: write one one-page proposal on a real opportunity.',
      },
    ],
    carryEdge:
      'Everything is a growth edge right now, and that is exactly where every practitioner started. The honesty to measure it is the hard part, and you have already done it.',
    scenarios: [
      {
        situation: 'You are handed your first real change initiative.',
        guidance:
          'You will feel underprepared. Everyone does. Structure beats instinct here, and structure can be learned.',
      },
      {
        situation: 'Someone senior asks what you think about an AI tool.',
        guidance:
          'You do not need to be the expert. A simple adopt, adapt, or wait read is more useful than a confident guess.',
      },
      {
        situation: 'A teammate resists a change you are driving.',
        guidance:
          'Do not take it personally or push harder. Start by understanding the resistance.',
      },
    ],
    fixedDevelopmentPath: {
      body: 'Development path: build the foundation.',
      recommended:
        'Recommended next: the Gateway Journey, The Transformation Practitioner, which gives you the structure first so you do not learn it the hard way.',
    },
  },
}

/**
 * Resolve the development path for the result. Practitioner and Emerging Leader
 * use their fixed path; every other archetype is driven off the ACTUAL lowest
 * pillar (not the archetype's "typical" edge), per the spec.
 */
export const resolveDevelopmentPath = (
  archetype: Archetype,
  edge: PillarKey | null,
): DevelopmentPath => {
  const fixed = ARCHETYPE_CONTENT[archetype].fixedDevelopmentPath
  if (fixed) return fixed
  if (edge) return DEVELOPMENT_PATHS[edge]
  return DEFAULT_DEVELOPMENT_PATH
}
