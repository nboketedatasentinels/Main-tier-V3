/**
 * T4L Impact Log: value taxonomy + valuation engine (prototype v3).
 * Points stay on the journey dashboard; this module only computes money / tiers.
 */

export const IMPACT_CATS = [
  {
    k: 'cost' as const,
    n: 'Cost savings',
    d: 'Reduce waste and operating cost through process change, automation or Kaizen.',
  },
  {
    k: 'eff' as const,
    n: 'Efficiency gains',
    d: 'Increase throughput or productivity with continuous improvement and better tools.',
  },
  {
    k: 'rev' as const,
    n: 'Revenue growth',
    d: 'Drive new revenue with pilots, innovation and growth work.',
  },
]

export type ImpactCatKey = (typeof IMPACT_CATS)[number]['k']

export const IMPACT_WASTES = [
  { k: 'defects', n: 'Defects', d: 'Rework, errors, scrap, corrections' },
  { k: 'overprod', n: 'Overproduction', d: 'Making more or sooner than needed' },
  { k: 'waiting', n: 'Waiting', d: 'Idle time, approvals, queues, handoffs' },
  { k: 'talent', n: 'Non-utilized talent', d: 'Skills and ideas not being used' },
  { k: 'transport', n: 'Transportation', d: 'Unnecessary movement of material or files' },
  { k: 'inventory', n: 'Inventory', d: 'Stock, work in progress, backlog held' },
  { k: 'motion', n: 'Motion', d: 'Unnecessary movement of people' },
  { k: 'process', n: 'Extra processing', d: 'Steps the customer does not value' },
] as const

export type ImpactWasteKey = (typeof IMPACT_WASTES)[number]['k']

export const IMPACT_GROWTH = [
  { k: 'acquire', n: 'New customer acquisition', d: 'Customers won that were not there before' },
  { k: 'upsell', n: 'Upsell and cross-sell', d: 'More value from existing customers' },
  { k: 'pricemix', n: 'Price and mix', d: 'Better mix or recovered leakage' },
  { k: 'retain', n: 'Retention and churn', d: 'Revenue kept that was at risk' },
  { k: 'newprod', n: 'New product or pilot', d: 'Revenue from something newly launched' },
  { k: 'channel', n: 'New channel or market', d: 'Revenue from a new route to market' },
] as const

export type ImpactGrowthKey = (typeof IMPACT_GROWTH)[number]['k']

export const IMPACT_ESG_PILLARS = [
  {
    k: 'env' as const,
    n: 'Environmental',
    items: [
      'Energy reduced (kWh)',
      'Emissions avoided (tCO2e)',
      'Waste diverted from landfill (kg)',
      'Water saved (litres)',
      'Paper removed (reams)',
    ],
  },
  {
    k: 'soc' as const,
    n: 'Social',
    items: [
      'People trained (headcount)',
      'Youth or graduates reached',
      'Women in technical roles supported',
      'Community hours contributed',
      'Safety incidents avoided',
    ],
  },
  {
    k: 'gov' as const,
    n: 'Governance',
    items: [
      'Policy or standard published',
      'Control or audit finding closed',
      'Data or AI governance step completed',
      'Supplier compliance improved',
      'Risk register item retired',
    ],
  },
]

export const IMPACT_LIFT_PILLARS = [
  'Leading Self in the Age of AI',
  'Innovation and AI for Digital Transformation',
  'Fostering AI-Ready Teams',
  'Transforming Business with AI',
] as const

export const IMPACT_METRIC_FAMILIES = [
  { k: 'cost' as const, n: 'Cost', units: ['USD', 'BWP', 'GHS', 'KES'], conv: 'currency' as const },
  {
    k: 'time' as const,
    n: 'Cycle time / hours',
    units: ['hours', 'days', 'minutes'],
    conv: 'hours' as const,
  },
  {
    k: 'volume' as const,
    n: 'Volume / throughput',
    units: ['units', 'transactions', 'cases'],
    conv: 'margin' as const,
  },
  {
    k: 'quality' as const,
    n: 'Quality / defect rate',
    units: ['defects', 'errors', 'rework items', 'ppm'],
    conv: 'defect' as const,
  },
  {
    k: 'revenue' as const,
    n: 'Revenue',
    units: ['USD', 'BWP', 'GHS', 'KES'],
    conv: 'revenue' as const,
  },
  {
    k: 'risk' as const,
    n: 'Risk / compliance',
    units: ['findings', 'incidents', '%'],
    conv: 'none' as const,
  },
]

export type ImpactFamilyKey = (typeof IMPACT_METRIC_FAMILIES)[number]['k']

export const IMPACT_ACTIVITY_TYPES = [
  'Process change',
  'Kaizen / CI',
  'Automation',
  'AI agent deployed',
  'Training session',
  'Workshop delivered',
  'Policy or standard change',
  'Other',
] as const

export const IMPACT_SOURCES = [
  'SAP ERP',
  'Oracle Financials',
  'Service desk (Jira / Freshservice)',
  'CRM (Zoho / Salesforce)',
  'Timesheet system',
  'HR system',
  'Manual register signed by owner',
  'Practitioner recall (no system)',
] as const

export const IMPACT_EVIDENCE_TYPES = [
  'System extract (CSV / report)',
  'Signed manual register',
  'Finance report or GL line',
  'Invoice or purchase order',
  'Approval email',
  'Dashboard screenshot',
] as const

export const IMPACT_REASONS = [
  'Sole owner of the process change',
  'Shared with a concurrent project',
  'Vendor-led with internal support',
  'Part of a wider programme',
] as const

export const IMPACT_RECURRENCE = [
  'Recurring (repeats every period)',
  'One-time (single event)',
] as const

/** Default published rates until admin Value Rates ships. */
export type ImpactRateCard = {
  id: string
  scope: 'Organisation' | 'Global benchmark'
  country: string
  grade: string
  annualCost: number
  hours: number
  hourly: number
  margin: number
  defect: number
  from: string
  source: string
  approved: string
}

export const DEFAULT_IMPACT_RATES: ImpactRateCard[] = [
  {
    id: 'R2',
    scope: 'Organisation',
    country: 'Botswana',
    grade: 'Supervisor / Section lead',
    annualCost: 63920,
    hours: 1880,
    hourly: 34,
    margin: 140,
    defect: 85,
    from: '2026-01-01',
    source: 'Finance return (default)',
    approved: 'CFO',
  },
  {
    id: 'R1',
    scope: 'Organisation',
    country: 'Botswana',
    grade: 'Officer / Analyst',
    annualCost: 41360,
    hours: 1880,
    hourly: 22,
    margin: 140,
    defect: 85,
    from: '2026-01-01',
    source: 'Finance return (default)',
    approved: 'CFO',
  },
  {
    id: 'R3',
    scope: 'Organisation',
    country: 'Botswana',
    grade: 'Manager',
    annualCost: 109040,
    hours: 1880,
    hourly: 58,
    margin: 140,
    defect: 85,
    from: '2026-01-01',
    source: 'Finance return (default)',
    approved: 'CFO',
  },
  {
    id: 'G1',
    scope: 'Global benchmark',
    country: 'Sub-Saharan Africa',
    grade: 'Any (blended)',
    annualCost: 33840,
    hours: 1880,
    hourly: 18,
    margin: 100,
    defect: 65,
    from: '2026-01-01',
    source: 'T4L benchmark set',
    approved: 'Indicative only',
  },
]

export type ImpactClaimInputs = {
  family: ImpactFamilyKey
  unit: string
  base: number
  post: number
  occ: number
  rateId: string
  attribution: number
  realization: number
  implCost: number
  months: number
  obs: number
  lockedBefore: boolean
  source: string
  evidence: string
  owner: string
  finance: string
  windowP: number
  recurrence: string
  sustain90?: string
  tierOverride?: 1 | 2 | 3
}

export type ImpactBaselineGrade = 'A' | 'B' | 'C' | 'D'

export function gradeFromBaseline(
  months: number,
  obs: number,
  lockedBefore: boolean,
  source: string,
): ImpactBaselineGrade {
  if (source === 'Practitioner recall (no system)' || (!months && obs < 20)) return 'D'
  if (!lockedBefore) return 'C'
  if (months >= 12) return 'A'
  if (months >= 3 || obs >= 20) return 'B'
  return 'D'
}

const gradeCeiling = (g: ImpactBaselineGrade): 1 | 2 | 3 =>
  g === 'A' || g === 'B' ? 3 : g === 'C' ? 2 : 1

export function tierFromClaim(c: ImpactClaimInputs): 1 | 2 | 3 {
  if (c.tierOverride) return c.tierOverride
  const grade = gradeFromBaseline(c.months, c.obs, c.lockedBefore, c.source)
  const ceiling = gradeCeiling(grade)
  if (ceiling === 1) return 1
  if (ceiling === 3 && c.evidence && c.windowP >= 3 && c.owner && c.finance) return 3
  if (c.evidence && c.windowP >= 1 && c.owner) return 2
  return 1
}

const CONF: Record<1 | 2 | 3, number> = { 1: 0, 2: 0.7, 3: 1 }

export function rateOf(id: string, rates: ImpactRateCard[] = DEFAULT_IMPACT_RATES): ImpactRateCard {
  return rates.find((r) => r.id === id) || rates[0]
}

export function famOf(k: ImpactFamilyKey) {
  return IMPACT_METRIC_FAMILIES.find((f) => f.k === k) || IMPACT_METRIC_FAMILIES[0]
}

export function deltaOf(base: number, post: number): number {
  return Math.abs(Number(base || 0) - Number(post || 0))
}

export function grossOf(c: ImpactClaimInputs, rates: ImpactRateCard[] = DEFAULT_IMPACT_RATES): number {
  const r = rateOf(c.rateId, rates)
  const f = famOf(c.family)
  const d = deltaOf(c.base, c.post)
  const occ = Number(c.occ || 1)
  if (f.conv === 'currency') return d
  if (f.conv === 'revenue') return d * 0.35
  if (f.conv === 'hours') {
    let h = d
    if (c.unit === 'days') h = d * 8
    if (c.unit === 'minutes') h = d / 60
    return h * occ * r.hourly
  }
  if (f.conv === 'margin') return d * occ * r.margin
  if (f.conv === 'defect') return d * occ * r.defect
  return 0
}

export type ImpactValuation = {
  tier: 1 | 2 | 3
  grade: ImpactBaselineGrade
  gross: number
  afterA: number
  afterR: number
  afterC: number
  cost: number
  net: number
  annual: number | null
  conf: number
  bucket: 'cash' | 'avoidance' | 'capacity' | 'none'
}

export function valueBucket(c: ImpactClaimInputs): ImpactValuation['bucket'] {
  const f = famOf(c.family)
  if (f.conv === 'none') return 'none'
  if (f.conv === 'hours' && Number(c.realization) < 1) return 'capacity'
  if (f.conv === 'defect') return 'avoidance'
  return 'cash'
}

export function valuation(
  c: ImpactClaimInputs,
  rates: ImpactRateCard[] = DEFAULT_IMPACT_RATES,
): ImpactValuation {
  const grade = gradeFromBaseline(c.months, c.obs, c.lockedBefore, c.source)
  const tier = tierFromClaim(c)
  const gross = grossOf(c, rates)
  const a = Number(c.attribution || 100) / 100
  const rz = Number(c.realization || 1)
  const cf = CONF[tier]
  const afterA = gross * a
  const afterR = afterA * rz
  const afterC = afterR * cf
  const cost = Number(c.implCost || 0)
  const net = Math.max(0, afterC - cost)
  const annual =
    (c.recurrence || '').startsWith('Recurring') && c.sustain90 === 'Holding' ? net * 12 : null
  return {
    tier,
    grade,
    gross,
    afterA,
    afterR,
    afterC,
    cost,
    net,
    annual,
    conf: cf,
    bucket: valueBucket(c),
  }
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`
}

export const CLAIM_JOURNEY_STEPS = [
  ['01', 'You submit', 'Baseline, result, evidence and the calculation are locked to the claim.'],
  ['02', 'Owner of the number confirms', 'Approves, adjusts your attribution with a reason, or sends it back.'],
  ['03', 'Finance validates', 'Required from $1,000. Checks your extract against the source system.'],
  ['04', 'Department head signs', 'Only above $25,000. Above $250,000 finance recalculates independently.'],
  ['05', 'Recognised', 'Enters the register and the headline figure.'],
  ['06', '90 and 180 day check', 'Still holding, partly, or not. The value follows the answer.'],
] as const

export type ImpactEntryKind = 'activity' | 'claim' | 'esg'

export type ImpactClaimStatus =
  | 'Submitted'
  | 'Measure Owner Confirmed'
  | 'Finance Validated'
  | 'Recognized'
  | 'Returned for Revision'
  | 'Reversed'
  | 'Confirmed by partner'
  | 'Awaiting partner confirmation'
  | 'Sent to ESG team'

export const CLAIM_STATE_ORDER: ImpactClaimStatus[] = [
  'Submitted',
  'Measure Owner Confirmed',
  'Finance Validated',
  'Recognized',
]

export const IMPACT_VALUE_BANDS = [
  { max: 0, name: 'No currency value', need: ['owner'], ev: 'Description only' },
  { max: 1000, name: 'Band 1 · under $1,000', need: ['owner'], ev: 'Description plus one attachment' },
  {
    max: 25000,
    name: 'Band 2 · $1,000 to $25,000',
    need: ['owner', 'finance'],
    ev: 'Source extract plus baseline reference',
  },
  {
    max: 250000,
    name: 'Band 3 · $25,001 to $250,000',
    need: ['owner', 'finance', 'deptA'],
    ev: 'Full evidence pack plus methodology note',
  },
  {
    max: 1e12,
    name: 'Band 4 · above $250,000',
    need: ['owner', 'finance', 'deptA', 'steerco'],
    ev: 'Full pack plus independent recalculation',
  },
] as const

export function bandOf(net: number) {
  return IMPACT_VALUE_BANDS.find((b) => net <= b.max) || IMPACT_VALUE_BANDS[IMPACT_VALUE_BANDS.length - 1]
}

export const IMPACT_RATE_LIB = [
  {
    pat: 'Manual report replaced by an automated or digital report',
    rate: 'Hourly rate for the grade doing it',
    needs: 'Cost of employment for the grade',
    fam: 'time' as const,
    ex: 'A monthly stock report took 6 hours; digital takes 1.5. 4.5 hrs × rate × 12.',
  },
  {
    pat: 'Approval or handoff waiting time cut',
    rate: 'Hourly rate for the grade waiting',
    needs: 'Cost of employment for the grade',
    fam: 'time' as const,
    ex: 'Invoices waited 6.5 hours, now 2.4; hours released × rate.',
  },
  {
    pat: 'Rework, errors or corrections reduced',
    rate: 'Cost to put one item right',
    needs: 'Average cost of a correction',
    fam: 'quality' as const,
    ex: '114 fewer rework tickets × $85 each.',
  },
  {
    pat: 'More output from the same team',
    rate: 'Contribution margin per unit',
    needs: 'What is left from one more unit after direct costs',
    fam: 'volume' as const,
    ex: '40 more cases × $140 margin.',
  },
  {
    pat: 'Stock, spares or work in progress reduced',
    rate: 'None. The saving is already money.',
    needs: 'Nothing. Enter currency change directly',
    fam: 'cost' as const,
    ex: 'Spares fell $14,800 → $11,200 = $3,600.',
  },
  {
    pat: 'Revenue won, kept or recovered',
    rate: 'Gross margin percentage',
    needs: 'Gross margin for that product/segment',
    fam: 'revenue' as const,
    ex: 'A $186,000 renewal is counted at margin, not gross.',
  },
  {
    pat: 'Overtime or contractor spend reduced',
    rate: 'None, plus proof of the spend cut',
    needs: 'Payroll or invoice evidence',
    fam: 'cost' as const,
    ex: 'Overtime fell $2,100/month on the payroll report.',
  },
  {
    pat: 'Compliance finding or risk closed',
    rate: 'No currency value',
    needs: 'Nothing',
    fam: 'risk' as const,
    ex: 'Recorded with severity, never inside the money headline.',
  },
]

export const IMPACT_INDUSTRIES = [
  {
    k: 'mining',
    n: 'Mining and resources',
    unit: 'a tonne produced, or a shift completed',
    roles: [
      'Operator',
      'Artisan or tradesperson',
      'Shift supervisor',
      'Section leader',
      'Mine overseer',
      'Metallurgist',
      'Mining engineer',
      'Superintendent',
      'Safety officer',
      'Planner',
      'Mine manager',
    ],
  },
  {
    k: 'bank',
    n: 'Banking and financial services',
    unit: 'an account opened, or a loan disbursed',
    roles: [
      'Teller or customer service officer',
      'Relationship officer',
      'Credit analyst',
      'Operations officer',
      'Branch supervisor',
      'Branch manager',
      'Risk officer',
      'Compliance officer',
      'Head of department',
    ],
  },
  {
    k: 'tech',
    n: 'Technology and software',
    unit: 'a licence or seat sold',
    roles: [
      'Support engineer',
      'Software engineer',
      'Senior engineer',
      'Data analyst',
      'QA engineer',
      'Product manager',
      'Engineering manager',
      'Solutions architect',
      'Head of engineering',
    ],
  },
  {
    k: 'generic',
    n: 'Something else, use generic grades',
    unit: 'a unit sold',
    roles: [
      'Officer or analyst',
      'Supervisor or section lead',
      'Manager',
      'Senior manager',
      'Specialist',
      'Technician',
      'Executive',
    ],
  },
] as const

export function formatMoneyK(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  }
  return formatMoney(n)
}

export function claimInputsFromRecord(e: {
  claim?: Record<string, unknown>
  usdValue?: number
}): ImpactClaimInputs | null {
  const c = e.claim
  if (!c || typeof c !== 'object') return null
  return {
    family: (c.family as ImpactFamilyKey) || 'time',
    unit: String(c.unit || 'hours'),
    base: Number(c.base || 0),
    post: Number(c.post || 0),
    occ: Number(c.occ || 1),
    rateId: String(c.rateId || 'R2'),
    attribution: Number(c.attribution || 100),
    realization: Number(c.realization || 1),
    implCost: Number(c.implCost || 0),
    months: Number(c.months || 0),
    obs: Number(c.obs || 0),
    lockedBefore: Boolean(c.lockedBefore ?? true),
    source: String(c.source || ''),
    evidence: String(c.evidence || ''),
    owner: String(c.owner || ''),
    finance: String(c.finance || ''),
    windowP: Number(c.windowP || 0),
    recurrence: String(c.recurrence || ''),
    sustain90: typeof c.sustain90 === 'string' ? c.sustain90 : undefined,
    tierOverride: c.tier === 1 || c.tier === 2 || c.tier === 3 ? (c.tier as 1 | 2 | 3) : undefined,
  }
}

export function nextClaimStatus(current: string): ImpactClaimStatus | null {
  if (current === 'Submitted') return 'Measure Owner Confirmed'
  if (current === 'Measure Owner Confirmed') return 'Recognized'
  if (current === 'Finance Validated') return 'Recognized'
  return null
}
