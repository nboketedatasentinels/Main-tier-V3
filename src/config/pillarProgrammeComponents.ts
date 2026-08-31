import type { Pillar } from '@/types/pillar'

/**
 * Applied programme components per pillar.
 *
 * Every pillar has three deliverables learners must complete alongside
 * their courses:
 * - Capstone - a synthesizing project
 * - Case Study - analysis of a real-world scenario
 * - Practical - hands-on exercise
 *
 * All three render on the courses page (OrganizationCoursesPage), scoped
 * to the pillar the learner's org is on. They're shown as distinct,
 * type-aware cards so a learner sees "capstone + case study + practical"
 * - not three of the same thing.
 *
 * The catalog starts as placeholders (status: 'coming_soon'). To activate
 * a component, replace its title/description with real content and set
 * status: 'available' plus an `href` to launch from.
 */
export type ProgrammeComponentType = 'capstone' | 'case_study' | 'practical'

/**
 * One sub-part of a multi-part component (e.g. Case Study 1 and Case Study
 * 2 of the Combined Case Studies). When an entry sets `parts`, the card
 * renders a list of part-launch buttons instead of a single CTA.
 */
export interface ProgrammeComponentPart {
 id: string
 title: string
 description?: string
 href: string
}

export interface ProgrammeComponentEntry {
 /** Stable id (kebab-case, prefixed with pillar slug and type). */
 id: string
 /** Which of the three component types this entry is. */
 type: ProgrammeComponentType
 /** Display title shown on the card. */
 title: string
 /** Short description shown under the title. */
 description: string
 /** Lifecycle state - drives the card's CTA and visual treatment. */
 status: 'available' | 'coming_soon' | 'locked'
 /** Optional URL the card launches to (single-deliverable components). */
 href?: string
 /** Optional list of parts (multi-deliverable components like 2 case studies). */
 parts?: ProgrammeComponentPart[]
}

export const PILLAR_PROGRAMME_COMPONENTS: Record<Pillar, ProgrammeComponentEntry[]> = {
 leading_self: [
 {
 id: 'leading-self-capstone',
 type: 'capstone',
 title: 'Combined Capstone (2 parts)',
 description:
 'Two parts marked together: Mindset Action Plan (Course 1) and Resilience Action Plan (Course 2). Combined weight 50% of competence pass.',
 status: 'available',
 parts: [
 {
 id: 'leading-self-capstone-part-a',
 title: 'Part A · Mindset Action Plan',
 description:
 'Closes Course 1 - Leading Under Pressure. Patterns, alternatives, calendar trigger, environmental design, and Digital Edge AI reflection.',
 href: '/capstones/leading-self-capstone-part-a.html',
 },
 {
 id: 'leading-self-capstone-part-b',
 title: 'Part B · Resilience Action Plan',
 description:
 'Closes Course 2 and the Journey. Shame literacy, body as data, trigger map, accountability partner, three legs of the stool, and 90-day commitment.',
 href: '/capstones/leading-self-capstone-part-b.html',
 },
 ],
 },
 {
 id: 'leading-self-case-study',
 type: 'case_study',
 title: 'Combined Case Studies (2 parts)',
 description:
 'Two case studies marked together. Case Study 1: Nadella (Course 1). Case Study 2: Okonjo-Iweala (Course 2). Combined weight 30% of competence pass.',
 status: 'available',
 parts: [
 {
 id: 'leading-self-case-study-1',
 title: 'Case Study 1 · The Pattern That Was Costing the Company',
 description:
 "Course 1 - Leading Under Pressure. Satya Nadella's first year at Microsoft, 2014. Pattern recognition and deliberate alternatives.",
 href: '/capstones/leading-self-case-study-1.html',
 },
 {
 id: 'leading-self-case-study-2',
 title: 'Case Study 2 · Telling My Story Is Risky',
 description:
 'Course 2 - Resilience Under Sustained Transformation Pressure. Ngozi Okonjo-Iweala and the cost of leading, Nigeria 2012. Shame patterns and strategic vulnerability.',
 href: '/capstones/leading-self-case-study-2.html',
 },
 ],
 },
 {
 id: 'leading-self-practical',
 type: 'practical',
 title: 'Practicals Portfolio (6 parts)',
 description:
 'Six weekly practicals across the Leading Self in the Age of AI Journey. All required; together they form the Practicals Portfolio component.',
 status: 'available',
 parts: [
 {
 id: 'leading-self-practical-1',
 title: 'Practical 1 · Pattern Profile',
 description: 'Week 1 - name how you default under pressure: one pattern, three real moments, the belief underneath.',
 href: '/capstones/leading-self-practical-1.html',
 },
 {
 id: 'leading-self-practical-2',
 title: 'Practical 2 · Protocol Card',
 description: 'Week 2 - build the named protocol you deploy when the pattern fires, then practise it for five days.',
 href: '/capstones/leading-self-practical-2.html',
 },
 {
 id: 'leading-self-practical-3',
 title: 'Practical 3 · Mindset Action Plan Draft',
 description: 'Week 3 - the working draft that feeds your Capstone: replacement belief, new behaviour, 30-day metric.',
 href: '/capstones/leading-self-practical-3.html',
 },
 {
 id: 'leading-self-practical-4',
 title: 'Practical 4 · Carrying Inventory',
 description: 'Week 4 - take stock of the masks you carry into high-stakes rooms, then choose what to put down.',
 href: '/capstones/leading-self-practical-4.html',
 },
 {
 id: 'leading-self-practical-5',
 title: 'Practical 5 · Trigger Map',
 description: 'Week 5 - map one trigger in detail: body signal, old action, pause point, deliberate alternative.',
 href: '/capstones/leading-self-practical-5.html',
 },
 {
 id: 'leading-self-practical-6',
 title: 'Practical 6 · Accountability Brief',
 description: 'Week 6 - name who holds you to the work, the cadence, the truth-telling territory, and the first ask.',
 href: '/capstones/leading-self-practical-6.html',
 },
 ],
 },
 ],
 innovation_technology: [
 {
 id: 'innovation-technology-capstone',
 type: 'capstone',
 title: 'The Transformation Operating Model',
 description:
 'Six-section integrated operating model for innovation and AI deployment decisions. 1500-2000 words.',
 status: 'available',
 href: '/capstones/innovation-capstone.html',
 },
 {
 id: 'innovation-technology-case-study',
 type: 'case_study',
 title: 'Combined Case Studies (2 parts)',
 description:
 'Two case studies marked together. Both required: GE Predix (thesis fragility) and MTN Ambition 2030 (foundation gap).',
 status: 'available',
 parts: [
 {
 id: 'innovation-case-study-1',
 title: "Part 1 · The Thesis That Couldn't Survive a CEO Change",
 description: 'GE Digital & the Predix Platform, 2011-2018',
 href: '/capstones/innovation-case-study-1.html',
 },
 {
 id: 'innovation-case-study-2',
 title: "Part 2 · The Use Case the Foundation Couldn't Support",
 description: 'MTN Group AI Ambition Across 16 African Markets, 2021-2026',
 href: '/capstones/innovation-case-study-2.html',
 },
 ],
 },
 {
 id: 'innovation-technology-practical',
 type: 'practical',
 title: 'Practicals Portfolio (6 parts)',
 description:
 'Six weekly practicals across the Journey. All required; together they form the Practicals Portfolio component.',
 status: 'available',
 parts: [
 {
 id: 'innovation-practical-1',
 title: 'Practical 1 · The AI Operating Hour Log',
 description: 'Week 1 - establishing the recurring discipline.',
 href: '/capstones/innovation-practical-1.html',
 },
 {
 id: 'innovation-practical-2',
 title: 'Practical 2 · The Transformation Thesis',
 description: 'Week 2 - a thesis defensible to an incoming CEO.',
 href: '/capstones/innovation-practical-2.html',
 },
 {
 id: 'innovation-practical-3',
 title: 'Practical 3 · The Capability Map',
 description: 'Week 3 - claimed vs observable capability for one AI use case.',
 href: '/capstones/innovation-practical-3.html',
 },
 {
 id: 'innovation-practical-4',
 title: 'Practical 4 · The Data Foundation Audit',
 description: 'Week 4 - the heaviest week. Five data dimensions, the recommended call.',
 href: '/capstones/innovation-practical-4.html',
 },
 {
 id: 'innovation-practical-5',
 title: 'Practical 5 · The Adoption Curve Reading',
 description: 'Week 5 - cited metric vs underlying signal, shift signals.',
 href: '/capstones/innovation-practical-5.html',
 },
 {
 id: 'innovation-practical-6',
 title: 'Practical 6 · Operating Model + Lessons Synthesis',
 description: 'Week 6 - the integrative artefact that closes Module 2.',
 href: '/capstones/innovation-practical-6.html',
 },
 ],
 },
 ],
 transforming_business: [
 {
 id: 'transforming-business-capstone',
 type: 'capstone',
 title: 'Combined Capstone (2 parts)',
 description:
 'Two parts marked together: Connection Blueprint (Week 2) and Transformation Memo (Week 6). Combined weight 50% of competence pass.',
 status: 'available',
 parts: [
 {
 id: 'transforming-business-capstone-part-a',
 title: 'Part A · The Connection Blueprint',
 description:
 'Week 2 - four-section persuasion artefact (Position, Now, Stake, Survival) for one named executive. 600-800 words.',
 href: '/capstones/transforming-business-capstone-part-a.html',
 },
 {
 id: 'transforming-business-capstone-part-b',
 title: 'Part B · The Transformation Memo',
 description:
 'Week 6 - five-section sponsor memo (vision, resistance, reset, cadence, ask) plus AI Integration judgement. 800-1000 words.',
 href: '/capstones/transforming-business-capstone-part-b.html',
 },
 ],
 },
 {
 id: 'transforming-business-case-study',
 type: 'case_study',
 title: 'Combined Case Studies (2 parts)',
 description:
 'Two case studies marked together. Case Study 1: Standard Bank (Module 1). Case Study 2: Safaricom (Module 2). Combined weight 30% of competence pass.',
 status: 'available',
 parts: [
 {
 id: 'transforming-business-case-study-1',
 title: 'Case Study 1 · The Vision the Team Stopped Repeating',
 description:
 'Module 1 - Standard Bank\'s AI-led Transformation, South Africa and 21 sub-Saharan markets, 2020-2025. Vision cascade, Door Practice, and Connection Blueprint.',
 href: '/capstones/transforming-business-case-study-1.html',
 },
 {
 id: 'transforming-business-case-study-2',
 title: 'Case Study 2 · The Resistance Everyone Misread',
 description:
 'Module 2 - Safaricom\'s Zuri AI Chatbot and the M-Pesa High Court Petition, Kenya, 2025. Vision portability, resistance categories, and operating system drift.',
 href: '/capstones/transforming-business-case-study-2.html',
 },
 ],
 },
 {
 id: 'transforming-business-practical',
 type: 'practical',
 title: 'Practicals Portfolio (6 parts)',
 description:
 'Six weekly practicals across the Transforming Business with AI Journey. All required; together they form the Practicals Portfolio component.',
 status: 'available',
 parts: [
 {
 id: 'transforming-business-practical-1',
 title: 'Practical 1 · The Door Practice Log',
 description:
 'Week 1 - log five real meetings with a pre-entry Door Practice read: AI fluency, unspoken success definition, vendor narrative, and what shifted in your behaviour.',
 href: '/capstones/transforming-business-practical-1.html',
 },
 {
 id: 'transforming-business-practical-2',
 title: 'Practical 2 · The Connection Blueprint',
 description:
 'Week 2 - Capstone Part A. Four-section persuasion artefact (Position, Now, Stake, Survival) for one named executive whose decision matters in the next 90 days.',
 href: '/capstones/transforming-business-practical-2.html',
 },
 {
 id: 'transforming-business-practical-3',
 title: 'Practical 3 · The Vision Sentence Test',
 description:
 'Week 3 - write one 15-20 word vision sentence and run three independent 24-hour recall tests; revise against the failure mode the data surfaces.',
 href: '/capstones/transforming-business-practical-3.html',
 },
 {
 id: 'transforming-business-practical-4',
 title: 'Practical 4 · The Resistance Reframe',
 description:
 'Week 4 (heaviest) - run a resistance conversation, then reflect across five stages: default read vs correct category (informed risk, fear, identity, political), category-matched move, and what is now in motion.',
 href: '/capstones/transforming-business-practical-4.html',
 },
 {
 id: 'transforming-business-practical-5',
 title: 'Practical 5 · The Drift Heatmap',
 description:
 'Week 5 - score five operating rhythms green/amber/red against 60-day evidence, pick the most-drifted rhythm, and book a cause-not-symptom reset with named participants and a 30-day success measure.',
 href: '/capstones/transforming-business-practical-5.html',
 },
 {
 id: 'transforming-business-practical-6',
 title: 'Practical 6 · The Transformation Memo',
 description:
 'Week 6 - Capstone Part B. Five-section memo for a named executive sponsor (vision, resistance, reset, cadence, ask) plus Lessons Synthesis and AI integration judgement. Closes the Combined Capstone.',
 href: '/capstones/transforming-business-practical-6.html',
 },
 ],
 },
 ],
 fostering: [
 {
 id: 'fostering-capstone',
 type: 'capstone',
 title: 'Combined Capstone (2 parts)',
 description:
 'Two parts marked together: Heart-Centered Leader Blueprint (Week 2) and 90-Day Operating Plan (Week 6). Combined weight 50% of competence pass.',
 status: 'available',
 parts: [
 {
 id: 'fostering-capstone-part-a',
 title: 'Part A · The Heart-Centered Leader Blueprint',
 description:
 'Week 2 - five-section Blueprint: EQ pillar, alternative behaviour, three recurring moments, empathy in action, and a 30-day observable metric. 600-800 words.',
 href: '/capstones/fostering-capstone-part-a.html',
 },
 {
 id: 'fostering-capstone-part-b',
 title: 'Part B · The 90-Day Operating Plan',
 description:
 'Week 6 - seven-section operating plan: team current state, heatmap, 30/60/90 conversations, system resets, leader cadence, success indicators, and AI integration. 800-1000 words.',
 href: '/capstones/fostering-capstone-part-b.html',
 },
 ],
 },
 {
 id: 'fostering-case-study',
 type: 'case_study',
 title: 'Combined Case Studies (2 parts)',
 description:
 'Two case studies marked together. Case Study 1: Klarna (Module 1). Case Study 2: MTN (Module 2). Combined weight 30% of competence pass.',
 status: 'available',
 parts: [
 {
 id: 'fostering-case-study-1',
 title: 'Case Study 1 · The Pillar That Cracked First',
 description:
 'Module 1 - Klarna and the AI Customer Service Reversal, 2024-2025. Leadership pillars under AI rollout pressure.',
 href: '/capstones/fostering-case-study-1.html',
 },
 {
 id: 'fostering-case-study-2',
 title: 'Case Study 2 · The Senior Engineer Who Stopped Asking',
 description:
 'Module 2 - MTN Group AI Network Operations, Nigeria and South Africa, 2023-2024. Real org chart, difficult conversations, and early signals.',
 href: '/capstones/fostering-case-study-2.html',
 },
 ],
 },
 {
 id: 'fostering-practical',
 type: 'practical',
 title: 'Practicals Portfolio (6 parts)',
 description:
 'Six weekly practicals across the Fostering AI-Ready Teams Journey. All required; together they form the Practicals Portfolio component.',
 status: 'available',
 parts: [
 {
 id: 'fostering-practical-1',
 title: 'Practical 1 · Five Pillars Self-Audit',
 description:
 'Week 1 - score your team on the five pillars of heart-centred leadership against observable behaviour, then name the lowest pillar and its AI-era cost.',
 href: '/capstones/fostering-practical-1.html',
 },
 {
 id: 'fostering-practical-2',
 title: 'Practical 2 · Heart-Centered Blueprint',
 description:
 'Week 2 - Capstone Part A. Design the five-section Blueprint from the lowest pillar: alternative behaviour, three recurring moments, empathy in the room, and a 30-day metric.',
 href: '/capstones/fostering-practical-2.html',
 },
 {
 id: 'fostering-practical-3',
 title: 'Practical 3 · The Real Org Chart',
 description:
 'Week 3 - map hard, soft, and expert power in your team, then name the three biggest divergences from the formal chart and what each is costing the AI rollout.',
 href: '/capstones/fostering-practical-3.html',
 },
 {
 id: 'fostering-practical-4',
 title: "Practical 4 · The Conversation You've Been Avoiding",
 description:
 'Week 4 - run the deferred conversation, then reflect across five stages: who, opening line verbatim, what you heard, what shifted, what is now in motion.',
 href: '/capstones/fostering-practical-4.html',
 },
 {
 id: 'fostering-practical-5',
 title: 'Practical 5 · Heatmap Before the Exit Interview',
 description:
 'Week 5 - score the team across six dimensions, name the highest-risk role and ignored signal, then design a dated intervention with a 30-day success measure.',
 href: '/capstones/fostering-practical-5.html',
 },
 {
 id: 'fostering-practical-6',
 title: 'Practical 6 · 90-Day Operating Plan + Lessons Synthesis',
 description:
 'Week 6 - Capstone Part B. Design the six-section 90-day operating plan and write the Lessons Synthesis in your own voice.',
 href: '/capstones/fostering-practical-6.html',
 },
 ],
 },
 ],
 starter_kit: [
 {
 id: 'starter-kit-capstone',
 type: 'capstone',
 title: 'Combined Capstone (3 parts)',
 description:
 'Three parts marked together: One-Page Proposal, Project Scope Document, and Status Report. All required.',
 status: 'available',
 parts: [
 {
 id: 'starter-kit-capstone-part-a',
 title: 'Part A · One-Page Proposal',
 description: 'Closes Think Like an Owner (Week 2). Audience-matched pitch.',
 href: '/capstones/starter-kit-capstone-part-a.html',
 },
 {
 id: 'starter-kit-capstone-part-b',
 title: 'Part B · Project Scope Document',
 description:
 'Second Practitioner Capstone. Closes Lead Like a Pro (Week 6). Objectives, methodology, risks.',
 href: '/capstones/starter-kit-capstone-part-b.html',
 },
 {
 id: 'starter-kit-capstone-part-c',
 title: 'Part C · Status Report',
 description:
 'Third Practitioner Capstone. Closes Project Leadership Discipline. Risk-led mid-flight report.',
 href: '/capstones/starter-kit-capstone-part-c.html',
 },
 ],
 },
 {
 id: 'starter-kit-case-study',
 type: 'case_study',
 title: 'Combined Case Studies (4 parts)',
 description:
 'Four case studies marked together. Case Study 1: Nadella. Case Study 2: Kodak. Case Study 3: Okonjo-Iweala. Case Study 4: SARS. Combined weight 30% of competence pass.',
 status: 'available',
 parts: [
 {
 id: 'starter-kit-case-study-1',
 title: 'Part 1 · The Pattern That Was Costing the Company',
 description:
 'First Practitioner Case Study. Satya Nadella\'s first year at Microsoft, 2014. Pattern recognition under pressure.',
 href: '/capstones/starter-kit-case-study-1.html',
 },
 {
 id: 'starter-kit-case-study-2',
 title: 'Part 2 · The Pitch That Did Not Land',
 description:
 'Second Practitioner Case Study. Kodak and the digital camera, 1975-1996. Opportunity recognition and audience-matched framing.',
 href: '/capstones/starter-kit-case-study-2.html',
 },
 {
 id: 'starter-kit-case-study-3',
 title: 'Part 3 · Telling My Story Is Risky',
 description:
 'Third Practitioner Case Study. Ngozi Okonjo-Iweala and the cost of leading, Nigeria 2012. Shame patterns and strategic vulnerability.',
 href: '/capstones/starter-kit-case-study-3.html',
 },
 {
 id: 'starter-kit-case-study-4',
 title: 'Part 4 · The Modernisation That Was Dismantled',
 description:
 'Fourth Practitioner Case Study. South African Revenue Service, 2014-2018. Scope discipline, escalation, and senior reporting under pressure.',
 href: '/capstones/starter-kit-case-study-4.html',
 },
 ],
 },
 {
 id: 'starter-kit-practical',
 type: 'practical',
 title: 'Practicals Portfolio (6 parts)',
 description:
 'Six weekly practicals across the Journey. All required; together they form the Practicals Portfolio component.',
 status: 'available',
 parts: [
 {
 id: 'starter-kit-practical-1',
 title: 'Practical 1 · Opportunity Map',
 description: 'Week 1 - three named AI/digital opportunities in your current scope.',
 href: '/capstones/starter-kit-practical-1.html',
 },
 {
 id: 'starter-kit-practical-2',
 title: 'Practical 2 · Stakeholder Position Paper',
 description: 'Week 2 - map and position five key stakeholders.',
 href: '/capstones/starter-kit-practical-2.html',
 },
 {
 id: 'starter-kit-practical-3',
 title: 'Practical 3 · Methodology Justification',
 description: 'Week 3 - defend the delivery approach you would actually run.',
 href: '/capstones/starter-kit-practical-3.html',
 },
 {
 id: 'starter-kit-practical-4',
 title: 'Practical 4 · Risk Register Draft',
 description: 'Week 4 - name the real risks, owners, and mitigations.',
 href: '/capstones/starter-kit-practical-4.html',
 },
 {
 id: 'starter-kit-practical-5',
 title: 'Practical 5 · Stakeholder Briefing Script',
 description: 'Week 5 - the script you would use in the room.',
 href: '/capstones/starter-kit-practical-5.html',
 },
 {
 id: 'starter-kit-practical-6',
 title: 'Practical 6 · Lessons Synthesis',
 description:
 'Week 6 - synthesise patterns across Practicals 1-5 and commit to one 90-day growth edge.',
 href: '/capstones/starter-kit-practical-6.html',
 },
 ],
 },
 ],
}

export const PROGRAMME_COMPONENT_LABEL: Record<ProgrammeComponentType, string> = {
 capstone: 'Capstone',
 case_study: 'Case Study',
 practical: 'Practical',
}
