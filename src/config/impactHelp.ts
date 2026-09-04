/** Impact Log help library: ? buttons + modal copy. Learner-facing — no Tier 1/2/3 labels. */

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
    p: 'A baseline is what the number looked like before you changed anything, measured long enough to be representative. Twelve months catches busy and quiet periods. Three to eleven months works with a caveat. Anything shorter stays indicative until evidence and confirmation are stronger.',
    eg: 'Invoice cycle time averaged 6.5 hours across 2,140 invoices from July to June. That is the baseline. Locking it before the change makes it evidence rather than an argument.',
  },
  lock: {
    t: 'Why locking matters',
    p: 'Once locked, a baseline cannot be edited quietly. Corrections create a new version with a reason; the old version stays visible. An auditor checks this first.',
    eg: 'If the extract was wrong, you version it: v1 6.5 hours, v2 6.9 hours, reason recorded. Both stay on the record.',
  },
  tier: {
    t: 'How a claim becomes approved value',
    p: 'Submitted claims start with no headline money. After the measure owner confirms, value can sit in Pipeline as indicative. Only after approval (and finance when required) does the amount count as approved savings on Your savings.',
    eg: 'Strong baseline, evidence link, enough measurement periods, and owner + finance confirm → approved cash or avoidance on the dashboard.',
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
    t: 'Cash, avoidance, and capacity — how we classify them',
    p: 'You do not pick the bucket. We classify from what you measured:\n• Cash — money that hit (or will hit) a P&L / budget line (e.g. revenue, direct spend cut).\n• Cost avoidance — spend that would have happened and did not (e.g. fewer defects / scrap / rework prevented).\n• Capacity — hours freed with no cash movement yet (tick “turned into real money” only if overtime/contractors/headcount actually changed).\nNever add the three into one headline.',
    eg: 'PPE policy stops over-drawing → cost avoidance. Automation frees 3 hrs/week with no overtime cut → capacity. Selling obsolete stock → cash.',
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
    p: 'Your claim goes to the measure owner, then finance if the band requires it. Any verifier can approve, adjust attribution, or send it back. Reminders at 7, 14, 21 days; expires at 30 with no action.',
    eg: 'A claim sent back for a real baseline keeps history; fix the gap and resubmit.',
  },
  rates: {
    t: 'What a rate is, and who supplies it',
    p: 'A rate turns your measured change into money. Time needs hourly rate; defects need cost to put one right; volume needs margin; revenue needs gross margin. Finance supplies figures once. Practitioners never invent a rate by hand.',
    eg: 'Annual cost of a supervisor $63,920 ÷ 1,880 hours = $34/hour.',
  },
  esg: {
    t: 'ESG entries',
    p: 'ESG entries record environmental, social and governance contribution in their own units. They carry no currency value and never touch the finance register.',
    eg: '96 reams of paper removed by digital approval, counted as reams, not dollars.',
  },
  rules: {
    t: 'Aggregation rules and basis of preparation',
    p: '1. Only approved claims sit in Your savings headline. Pipeline is indicative · awaiting approval.\n2. One measure, one owner, one claim per window.\n3. Never sum cash, avoidance, and capacity into one number.\n4. Per period and annualised are separate columns.\n5. One-time and recurring tagged separately.\n6. Every waste and growth type is reported, including empty ones.\n7. Finance reconciles against P&L each quarter and publishes realisation rate.',
    eg: 'These rules are fixed at tenant setup and printed on every report that leaves the platform.',
  },
  howvalued: {
    t: 'How value is calculated, end to end',
    p: 'Measured change → gross via organisation rate → attribution → realisation → confidence from evidence and confirmations → less delivery cost = net. Every factor is on the record.',
    eg: '$58,548 gross × 70% attribution × full realisation × full confidence − $5,400 cost = $35,584 net.',
  },
  integrity: {
    t: 'Points and integrity',
    p: 'Points are earned for defining a measure, locking a baseline, declaring a target, submitting evidence, getting confirmations, and passing 90 days. Points are never a function of the dollar figure. Withdrawing an honest claim costs nothing already earned. Points live on the journey dashboard, not here.',
    eg: 'A $400 claim with a strong baseline and finance validation can earn more points than a $40,000 recall claim.',
  },
  scope: {
    t: 'What this does not cover',
    p: 'This is an improvement record, not a ledger and not an ESG report. Finance reconciles it quarterly. ESG reporting is produced by the ESG team from their own set.',
    eg: 'Last quarter 86% of validated value was confirmed in the accounts, published rather than hidden.',
  },
}
