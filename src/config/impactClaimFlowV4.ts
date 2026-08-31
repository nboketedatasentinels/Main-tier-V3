/**
 * T4L improvement claim flow v4 - presets, help, and valuation.
 * Ported from Desktop/T4L_Claim_Flow_v4.html so standard measures roll up across clients.
 */
import type { ImpactRateCard } from '@/config/impactValueEngine'

export const CLAIM_FLOW_STEPS = [
 'What kind',
 'What you measure',
 'Before',
 'Goal',
 'After',
 'Value and send',
] as const

export type ClaimFlowCat = 'cost' | 'eff' | 'rev'
export type ClaimFlowFam = 'time' | 'people' | 'money' | 'items' | 'revenue'
export type ClaimFlowNeeds =
 | 'hourly'
 | 'annual'
 | 'perError'
 | 'perTrip'
 | 'holding'
 | 'margin'
 | 'none'

export type ClaimPreset = {
 id: string
 waste?: string
 growth?: string
 cat: ClaimFlowCat
 name: string
 ask: string
 fam: ClaimFlowFam
 unit: string
 count: 'times' | 'people' | 'none'
 countQ?: string
 countEg?: string
 typical: number
 dir?: 'up'
 valueRule: string
 needs: ClaimFlowNeeds
 eg: string
}

export const CLAIM_FLOW_CATS = [
 { k: 'cost' as const, n: 'Cost savings', d: 'You spend less than before.' },
 { k: 'eff' as const, n: 'Efficiency gains', d: 'The same work takes less time or fewer people.' },
 { k: 'rev' as const, n: 'Revenue growth', d: 'Money comes in that would not have.' },
]

export const CLAIM_FLOW_WASTES = [
 { k: 'waiting', n: 'Waiting', d: 'Queues, approvals, handoffs, idle time' },
 { k: 'defects', n: 'Errors and rework', d: 'Things done twice, corrections, complaints' },
 { k: 'process', n: 'Extra steps', d: 'Work the customer does not need' },
 { k: 'talent', n: 'Skills not used', d: 'People doing work below their skill' },
 { k: 'inventory', n: 'Stock and backlog', d: 'Things sitting and waiting' },
 { k: 'transport', n: 'Moving things', d: 'Trips, transfers, deliveries' },
 { k: 'motion', n: 'Moving people', d: 'Walking, searching, fetching' },
 { k: 'overprod', n: 'Making too much', d: 'More or sooner than needed' },
]

export const CLAIM_FLOW_GROWTH = [
 { k: 'retain', n: 'Kept revenue at risk', d: 'A customer or contract you saved' },
 { k: 'acquire', n: 'Won new revenue', d: 'Customers or work that is new' },
 { k: 'upsell', n: 'Sold more to existing', d: 'More value from who you already serve' },
]

export const CLAIM_FLOW_UNITS: Record<ClaimFlowFam, { label: string; opts: string[] }> = {
 time: { label: 'Time', opts: ['minutes', 'hours', 'days'] },
 people: { label: 'People', opts: ['people'] },
 money: { label: 'Money', opts: ['USD'] },
 items: {
 label: 'Count of things',
 opts: [
 'errors',
 'rework items',
 'complaints',
 'defects',
 'items',
 'documents',
 'reports',
 'trips',
 'cases',
 'stock-outs',
 ],
 },
 revenue: { label: 'Revenue', opts: ['USD'] },
}

/** Same preset ids across every client → T4L can aggregate by sector / waste. */
export const CLAIM_PRESETS: ClaimPreset[] = [
 {
 id: 'WAIT-TASK',
 waste: 'waiting',
 cat: 'eff',
 name: 'Time to get one task done',
 ask: 'How long does one of these take from start to finish?',
 fam: 'time',
 unit: 'hours',
 count: 'times',
 countQ: 'How many of these happen in a month?',
 countEg: 'e.g. 420 invoices a month',
 typical: 40,
 valueRule:
 'Time saved on each one, multiplied by how many happen, valued at your organization\'s hourly rate.',
 needs: 'hourly',
 eg: 'Invoice approval took 6.5 hours, now takes 2.4.',
 },
 {
 id: 'WAIT-APPROVE',
 waste: 'waiting',
 cat: 'eff',
 name: 'Days waiting for a decision or approval',
 ask: 'How many days does the wait last?',
 fam: 'time',
 unit: 'days',
 count: 'times',
 countQ: 'How many of these decisions happen in a month?',
 countEg: 'e.g. 30 requisitions a month',
 typical: 50,
 valueRule: 'Days saved, multiplied by how many decisions, valued at your hourly rate.',
 needs: 'hourly',
 eg: 'Purchase approval took 9 days, now takes 3.',
 },
 {
 id: 'TAL-PEOPLE',
 waste: 'talent',
 cat: 'eff',
 name: 'How many people it takes to do this',
 ask: 'How many people are needed for this work?',
 fam: 'people',
 unit: 'people',
 count: 'none',
 typical: 25,
 valueRule:
 'People freed, valued at the annual cost of employment for their grade, spread across the year.',
 needs: 'annual',
 eg: 'Month-end close needed 4 people, now needs 3.',
 },
 {
 id: 'TAL-SKILL',
 waste: 'talent',
 cat: 'eff',
 name: 'Hours spent on work below someone\'s skill level',
 ask: 'How many hours a month go on this?',
 fam: 'time',
 unit: 'hours',
 count: 'people',
 countQ: 'How many people do this?',
 countEg: 'e.g. 6 engineers',
 typical: 45,
 valueRule: 'Hours saved per person, multiplied by the number of people, at your hourly rate.',
 needs: 'hourly',
 eg: 'Engineers spent 9 hours a month pulling data by hand, now 3.5.',
 },
 {
 id: 'DEF-ERRORS',
 waste: 'defects',
 cat: 'cost',
 name: 'Errors or rework in a month',
 ask: 'How many happen in a month?',
 fam: 'items',
 unit: 'errors',
 count: 'none',
 typical: 35,
 valueRule: 'Errors avoided, valued at what your finance team says one costs to put right.',
 needs: 'perError',
 eg: 'Pick errors were 240 a month, now 150.',
 },
 {
 id: 'DEF-COMPLAINTS',
 waste: 'defects',
 cat: 'cost',
 name: 'Customer complaints or credits in a month',
 ask: 'How many in a month?',
 fam: 'items',
 unit: 'complaints',
 count: 'none',
 typical: 30,
 valueRule: 'Complaints avoided, valued at the cost of putting one right.',
 needs: 'perError',
 eg: 'Billing complaints were 88 a month, now 54.',
 },
 {
 id: 'INV-VALUE',
 waste: 'inventory',
 cat: 'cost',
 name: 'Value of stock or spares held',
 ask: 'What is the value being held?',
 fam: 'money',
 unit: 'USD',
 count: 'none',
 typical: 20,
 valueRule: 'The reduction, valued at what it costs to hold stock for a year. Not the whole reduction.',
 needs: 'holding',
 eg: 'Slow-moving spares were $14,800, now $11,200.',
 },
 {
 id: 'INV-BACKLOG',
 waste: 'inventory',
 cat: 'cost',
 name: 'Items sitting in a backlog',
 ask: 'How many are waiting in the queue?',
 fam: 'items',
 unit: 'cases',
 count: 'none',
 typical: 40,
 valueRule: 'Backlog cleared, valued at the cost of handling one case late.',
 needs: 'perError',
 eg: 'Open service cases were 310, now 196.',
 },
 {
 id: 'PROC-REPORT',
 waste: 'process',
 cat: 'eff',
 name: 'Hours to produce a report or pack',
 ask: 'How many hours does one take to produce?',
 fam: 'time',
 unit: 'hours',
 count: 'times',
 countQ: 'How many times is it produced in a month?',
 countEg: 'e.g. 1 a month, or 3 for three sites',
 typical: 60,
 valueRule: 'Hours saved each time, multiplied by how often, at your hourly rate.',
 needs: 'hourly',
 eg: 'A monthly stock report took 6 hours by hand, now 45 minutes.',
 },
 {
 id: 'PROC-STEPS',
 waste: 'process',
 cat: 'eff',
 name: 'Steps or approvals in a process',
 ask: 'How many steps does it take?',
 fam: 'items',
 unit: 'items',
 count: 'none',
 typical: 35,
 valueRule: 'Steps removed carry no value on their own. Add the time saved as a second claim.',
 needs: 'none',
 eg: 'A purchase went through 11 steps, now 6.',
 },
 {
 id: 'TRA-TRIPS',
 waste: 'transport',
 cat: 'cost',
 name: 'Trips or site visits in a month',
 ask: 'How many trips in a month?',
 fam: 'items',
 unit: 'trips',
 count: 'none',
 typical: 50,
 valueRule: 'Trips avoided, valued at the average cost of one trip.',
 needs: 'perTrip',
 eg: 'Field visits were 6 a month, now 2.',
 },
 {
 id: 'MOT-SEARCH',
 waste: 'motion',
 cat: 'eff',
 name: 'Hours spent walking, searching or fetching',
 ask: 'How many hours a month?',
 fam: 'time',
 unit: 'hours',
 count: 'people',
 countQ: 'How many people do this?',
 countEg: 'e.g. 12 store staff',
 typical: 40,
 valueRule: 'Hours saved per person, times the number of people, at your hourly rate.',
 needs: 'hourly',
 eg: 'Stores staff spent 5 hours a month searching for parts, now 2.',
 },
 {
 id: 'OVR-COPIES',
 waste: 'overprod',
 cat: 'cost',
 name: 'Reports or copies produced that nobody uses',
 ask: 'How many are produced in a month?',
 fam: 'items',
 unit: 'reports',
 count: 'none',
 typical: 60,
 valueRule: 'Copies avoided, valued at the cost of producing one.',
 needs: 'perError',
 eg: '14 printed packs a month, now 2.',
 },
 {
 id: 'COST-SPEND',
 waste: 'process',
 cat: 'cost',
 name: 'Money spent on this in a month',
 ask: 'What does it cost a month today?',
 fam: 'money',
 unit: 'USD',
 count: 'none',
 typical: 25,
 valueRule:
 'The reduction, straight through. This is the cleanest kind of claim because finance can see it.',
 needs: 'none',
 eg: 'Overtime in planning was $4,100 a month, now $2,600.',
 },
 {
 id: 'REV-RETAIN',
 growth: 'retain',
 cat: 'rev',
 name: 'Revenue at risk that you kept',
 ask: 'What is the annual value of the contract or customer?',
 fam: 'revenue',
 unit: 'USD',
 count: 'none',
 typical: 0,
 dir: 'up',
 valueRule: 'Counted at gross margin, never at the full contract value.',
 needs: 'margin',
 eg: 'A $186,000 renewal that was going to be lost.',
 },
 {
 id: 'REV-NEW',
 growth: 'acquire',
 cat: 'rev',
 name: 'New revenue you brought in',
 ask: 'How much new revenue in the period?',
 fam: 'revenue',
 unit: 'USD',
 count: 'none',
 typical: 0,
 dir: 'up',
 valueRule: 'Counted at gross margin, never at gross revenue.',
 needs: 'margin',
 eg: 'A pilot billed $42,000 in its first quarter.',
 },
]

export type ClaimFlowHelpKey =
 | 'kind'
 | 'waste'
 | 'measure'
 | 'unit'
 | 'before'
 | 'months'
 | 'lock'
 | 'goal'
 | 'after'
 | 'count'
 | 'periods'
 | 'who'
 | 'flow'
 | 'states'
 | 'roll'

export const CLAIM_FLOW_HELP: Record<ClaimFlowHelpKey, { t: string; b: string }> = {
 kind: {
 t: 'Which one do I pick',
 b: 'Cost savings is when you spend less. Efficiency gains is when the same work takes less time or fewer people. Revenue growth is when money comes in that would not have. If you saved time and that let you cut overtime, it is still efficiency, and we ask about the overtime later.',
 },
 waste: {
 t: 'What was getting in the way',
 b: 'These are the eight classic reasons work costs more than it should. Pick the main one. If two apply, pick the one your numbers actually measure.',
 },
 measure: {
 t: 'Why pick from a list',
 b: 'Because the same improvement then means the same thing at every client. It also sets your units and does the sums for you, so you never have to work out what your time is worth. If nothing fits, you can describe your own, but it will not roll up into the cross-client figures.',
 },
 unit: {
 t: 'Units',
 b: 'A before number is not always hours. It can be people, days, money, errors, trips, cases, reports. Pick whatever your team actually counts. Whatever you choose here is used for the goal and the after number too, so you are always comparing like with like.',
 },
 before: {
 t: 'The before number',
 b: 'What it looked like before you changed anything. Get it from a system if you can, and get it before you start. Twelve months is best because it covers busy and quiet spells. If all you have is your memory, that is allowed, the claim just stays an estimate.',
 },
 months: {
 t: 'How far back',
 b: 'A single week can be a fluke. A year covers your seasonal ups and downs. This does not block anything, it only decides whether the number can become verified or stays an estimate.',
 },
 lock: {
 t: 'Locking',
 b: 'Once locked, the before number cannot be quietly changed. If you need to correct it, you add a new version with a reason and the old one stays visible. This is the single thing that makes a reviewer trust the rest.',
 },
 goal: {
 t: 'The goal',
 b: 'What you were aiming for, set before you measured the result. We record when you set it. Setting it afterwards is allowed but your reviewer sees that it happened, and it weakens the claim.',
 },
 after: {
 t: 'The after number',
 b: 'What it is now, counted exactly the same way as the before number. Same system, same definition, same scope.',
 },
 count: {
 t: 'How often, or how many people',
 b: 'These are two different questions and we only ask the one that fits. How often means how many times the task happens in a month, like 420 invoices. How many people means the number of people who do this work, like 6 engineers. Getting these mixed up is the most common reason a claim comes back.',
 },
 periods: {
 t: 'How long you watched it',
 b: 'One good month can be luck. Three or more consecutive months is what a finance team will accept as real. Under three, your number still counts as yours, it just stays an estimate.',
 },
 who: {
 t: 'Who checks it',
 b: 'Someone who knows the number is right, usually your manager or whoever owns that process. It cannot be you. If the improvement is worth $1,000 a month or more, finance checks it too.',
 },
 flow: {
 t: 'Unverified, then verified',
 b: 'Everything starts unverified. That means it is your number, visible to you, but not counted in any total. Your manager confirms it, finance signs it off if it is big enough, and then it is locked and counted.',
 },
 states: {
 t: 'The four states',
 b: 'Not sent yet means it is a draft. Being checked means someone has it. Needs your answer means they asked a question. Verified and locked means it is done, counted, and can no longer be edited.',
 },
 roll: {
 t: 'Why only verified figures roll up',
 b: 'A claimed number is a person\'s honest estimate. A verified number has been checked by the client\'s own manager and finance team and locked. Only the second kind is quoted anywhere outside the client. By sector is for T4L admin so we see how organisations are doing on the platform.',
 },
}

export function presetOf(id: string | null | undefined): ClaimPreset | null {
 if (!id || id === 'CUSTOM') return null
 return CLAIM_PRESETS.find((p) => p.id === id) || null
}

export function presetsFor(cat: ClaimFlowCat, waste: string, growth: string): ClaimPreset[] {
 if (cat === 'rev') {
 const list = CLAIM_PRESETS.filter((p) => p.growth === growth)
 return list.length ? list : CLAIM_PRESETS.filter((p) => p.cat === 'rev')
 }
 const list = CLAIM_PRESETS.filter(
 (p) => p.waste === waste && (p.cat === cat || cat === 'eff' || cat === 'cost'),
 )
 return list.length ? list : CLAIM_PRESETS.filter((p) => p.cat === cat).slice(0, 4)
}

function toHours(v: number, unit: string): number {
 if (unit === 'minutes') return v / 60
 if (unit === 'days') return v * 8
 return v
}

export type ClaimFlowCalc = {
 gross: number
 net: number
 basis: string
 real: number
 fam: ClaimFlowFam | null
 delta: number
 cnt: number
 bucket: 'cash' | 'avoidance' | 'capacity'
 rateLabel: string
 rateSupplied: boolean
}

export function calcClaimFlow(
 draft: {
 preset: string | null
 unit: string
 before: string | number
 after: string | number
 count: string | number
 realized?: boolean
 },
 rates: ImpactRateCard[],
): ClaimFlowCalc {
 const p = presetOf(draft.preset)
 const before = Number(draft.before) || 0
 const after = Number(draft.after) || 0
 const delta = Math.abs(before - after)
 const cnt = !p || p.count === 'none' ? 1 : Math.max(1, Number(draft.count) || 0)
 const r = rates[0]
 const hourly = r?.hourly ?? 34
 const annual = r?.annualCost ?? 63920
 const perError = r?.defect ?? 85
 const marginPct = 35
 const holdingPct = 22
 const perTrip = 180

 let gross = 0
 let basis = ''
 let rateLabel = 'Organization rate'
 let rateSupplied = true
 const fam = p?.fam ?? null

 if (!p || !before || !after) {
 return {
 gross: 0,
 net: 0,
 basis: '',
 real: 1,
 fam,
 delta,
 cnt,
 bucket: 'cash',
 rateLabel,
 rateSupplied,
 }
 }

 if (fam === 'time') {
 const h = toHours(delta, draft.unit) * cnt
 gross = h * hourly
 basis = `${h.toLocaleString(undefined, { maximumFractionDigits: 2 })} hours a period at $${hourly}/hour`
 rateLabel = `Hourly · ${r?.grade || 'grade'}`
 } else if (fam === 'people') {
 gross = delta * (annual / 12)
 basis = `${delta} people at $${annual.toLocaleString()}/year, one month's share`
 rateLabel = 'Annual cost of employment'
 } else if (fam === 'items') {
 const unitCost = p.needs === 'perTrip' ? perTrip : perError
 gross = delta * cnt * unitCost
 basis = `${(delta * cnt).toLocaleString()} avoided at $${unitCost} each`
 rateLabel = p.needs === 'perTrip' ? 'Cost per trip (default)' : 'Cost per error'
 rateSupplied = p.needs !== 'perTrip'
 } else if (fam === 'money') {
 if (p.needs === 'holding') {
 gross = delta * (holdingPct / 100)
 basis = `$${delta.toLocaleString()} less stock at ${holdingPct}% a year to hold`
 rateLabel = 'Stock holding cost (default)'
 rateSupplied = false
 } else {
 gross = delta
 basis = `$${delta.toLocaleString()} less spend a period`
 rateLabel = 'Direct spend'
 }
 } else if (fam === 'revenue') {
 gross = delta * (marginPct / 100)
 basis = `$${delta.toLocaleString()} at ${marginPct}% gross margin`
 rateLabel = 'Gross margin'
 }

 const real = (fam === 'time' || fam === 'people') && !draft.realized ? 0.5 : 1
 const net = gross * real
 const bucket: ClaimFlowCalc['bucket'] =
 fam === 'revenue'
 ? 'cash'
 : (fam === 'time' || fam === 'people') && !draft.realized
 ? 'capacity'
 : fam === 'items'
 ? 'avoidance'
 : 'cash'

 return { gross, net, basis, real, fam, delta, cnt, bucket, rateLabel, rateSupplied }
}

export function suggestedGoal(
 preset: ClaimPreset | null,
 before: number,
): number | null {
 if (!preset || !before) return null
 if (preset.dir === 'up') return before * 1.25
 return before * (1 - (preset.typical || 30) / 100)
}

export function formatMoneyFlow(n: number): string {
 return `$${Math.round(n).toLocaleString()}`
}
