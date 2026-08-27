/** Impact Log help library: ? buttons + modal copy. */

export type ImpactHelpKey =
  | 'baseline'
  | 'lock'
  | 'tier'
  | 'attribution'
  | 'realisation'
  | 'buckets'
  | 'annual'
  | 'waste'
  | 'journey'
  | 'rates'
  | 'esg'
  | 'rules'
  | 'howvalued'
  | 'integrity'
  | 'scope'

export const IMPACT_HELP: Record<ImpactHelpKey, { t: string; p: string; eg: string }> = {
  baseline: {
    t: 'What a baseline is, and why 12 months',
    p: 'A baseline is what the number looked like before you changed anything, measured long enough to be representative. Twelve months catches busy and quiet periods. Three to eleven months works with a caveat. Anything shorter keeps the claim indicative; it never reaches the finance headline.',
    eg: 'Invoice cycle time averaged 6.5 hours across 2,140 invoices from July to June. That is the baseline. Locking it before the change makes it evidence rather than an argument.',
  },
  lock: {
    t: 'Why locking matters',
    p: 'Once locked, a baseline cannot be edited quietly. Corrections create a new version with a reason; the old version stays visible. An auditor checks this first.',
    eg: 'If the extract was wrong, you version it: v1 6.5 hours, v2 6.9 hours, reason recorded. Both stay on the record.',
  },
  tier: {
    t: 'The three evidence tiers',
    p: 'Tier 1 Declared carries no money. Tier 2 Confirmed is indicative at 70% confidence. Tier 3 Validated carries full value and is the only tier in the headline. You do not choose your tier; it is worked out from baseline grade, evidence, window, and who has signed.',
    eg: 'A grade A baseline, an extract attached, three periods measured, and a finance validator gives Tier 3.',
  },
  attribution: {
    t: 'Attribution, and why finance asks',
    p: 'Attribution is how much of the change is down to what you did. If another project touched the same process, you share the credit. Overstating it is the fastest way to get sent back.',
    eg: 'Cycle time fell 4.1 hours, but a new supplier portal went live. Attribution set to 70%, reason recorded.',
  },
  realisation: {
    t: 'Released hours are not cash yet',
    p: 'Freeing 100 hours does not put money in the accounts unless something changed: fewer contractors, less overtime, or a post not filled. Without that evidence only half the value counts, and it is reported as capacity released.',
    eg: 'Roster building dropped from 5.5 to 1.5 hours. No overtime cut → reported as hours released, indicative dollars in brackets.',
  },
  buckets: {
    t: 'Three buckets, never added together',
    p: 'Cash impact is traceable to a P&L line. Cost avoidance is spend that would have happened and did not. Capacity released is hours freed with no cash movement. Combining them into one headline loses the finance audience.',
    eg: '$44,374 cash and avoidance per period, plus 303 hours released. Three lines, three meanings.',
  },
  annual: {
    t: 'Aggregating to the year',
    p: 'A monthly saving becomes annual only after the 90 day check confirms it is holding, and only for recurring claims. Capped at twelve months, shown in its own column, never added to the per-period figure.',
    eg: '4.5 hours/month at $34 = $153/month. After 90 days holding → $1,836/year run rate in a separate column.',
  },
  waste: {
    t: 'Why the 8 wastes',
    p: 'Filing every improvement against one of the 8 wastes turns individual wins into a pattern. When one waste keeps producing value it usually means one root cause across processes: a programme, not a series of claims.',
    eg: 'Waiting has produced three validated claims across two departments. That is a queue problem.',
  },
  journey: {
    t: 'What happens after you submit',
    p: 'Your claim goes to the measure owner, then finance if the band requires it, then a department head above $25,000. Any verifier can approve, adjust attribution, or send it back. Reminders at 7, 14, 21 days; expires at 30 with no action.',
    eg: 'A claim sent back for a real baseline keeps history; fix the gap and resubmit.',
  },
  rates: {
    t: 'What a rate is, and who supplies it',
    p: 'A rate turns your measured change into money. Time needs hourly rate; defects need cost to put one right; volume needs margin; revenue needs gross margin. Finance supplies figures once. Practitioners never type a currency value.',
    eg: 'Annual cost of a supervisor $63,920 ÷ 1,880 hours = $34/hour. Nobody calculates a rate by hand.',
  },
  esg: {
    t: 'ESG entries',
    p: 'ESG entries record environmental, social and governance contribution in their own units. They carry no currency value and never touch the finance register.',
    eg: '96 reams of paper removed by digital approval, counted as reams, not dollars.',
  },
  rules: {
    t: 'Aggregation rules and basis of preparation',
    p: '1. Validated only in the headline (Tier 3). Tier 2 is labelled pipeline. Tier 1 never carries currency.\n2. One measure, one owner, one claim per window.\n3. Never sum cash, avoidance, and capacity.\n4. Per period and annualised are separate columns.\n5. One-time and recurring tagged separately.\n6. Every waste and growth type is reported, including empty ones.\n7. Finance reconciles against P&L each quarter and publishes realisation rate.',
    eg: 'These rules are fixed at tenant setup and printed on every report that leaves the platform.',
  },
  howvalued: {
    t: 'How value is calculated, end to end',
    p: 'Measured change → gross via organisation rate → attribution → realisation → confidence (tier) → less delivery cost = net. Every factor is on the record.',
    eg: '$58,548 gross × 70% attribution × full realisation × full confidence − $5,400 cost = $35,584 net.',
  },
  integrity: {
    t: 'Points and integrity',
    p: 'Points are earned for defining a measure, locking a baseline, declaring a target, submitting evidence, reaching Tier 2/3, and passing 90 days. Points are never a function of the dollar figure. Withdrawing an honest claim costs nothing already earned. Points live on the journey dashboard, not here.',
    eg: 'A $400 claim with grade A baseline and finance validation can earn more points than a $40,000 recall claim.',
  },
  scope: {
    t: 'What this does not cover',
    p: 'This is an improvement record, not a ledger and not an ESG report. Finance reconciles it quarterly. ESG reporting is produced by the ESG team from their own set.',
    eg: 'Last quarter 86% of validated value was confirmed in the accounts, published rather than hidden.',
  },
}
