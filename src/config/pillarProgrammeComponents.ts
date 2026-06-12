import type { Pillar } from '@/types/pillar'

/**
 * Applied programme components per pillar.
 *
 * Every pillar has three deliverables learners must complete alongside
 * their courses:
 *   - Capstone     - a synthesizing project
 *   - Case Study   - analysis of a real-world scenario
 *   - Practical    - hands-on exercise
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

const placeholderTriple = (pillarSlug: string): ProgrammeComponentEntry[] => [
  {
    id: `${pillarSlug}-capstone`,
    type: 'capstone',
    title: 'Capstone',
    description: 'Content coming soon.',
    status: 'coming_soon',
  },
  {
    id: `${pillarSlug}-case-study`,
    type: 'case_study',
    title: 'Case Study',
    description: 'Content coming soon.',
    status: 'coming_soon',
  },
  {
    id: `${pillarSlug}-practical`,
    type: 'practical',
    title: 'Practical',
    description: 'Content coming soon.',
    status: 'coming_soon',
  },
]

export const PILLAR_PROGRAMME_COMPONENTS: Record<Pillar, ProgrammeComponentEntry[]> = {
  leading_self: [
    {
      id: 'leading-self-capstone',
      type: 'capstone',
      title: 'Capstone',
      description: 'Content coming soon.',
      status: 'coming_soon',
    },
    {
      id: 'leading-self-case-study',
      type: 'case_study',
      title: 'Case Study',
      description: 'Content coming soon.',
      status: 'coming_soon',
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
        'Six-section integrated operating model for innovation and AI deployment decisions. 1500–2000 words.',
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
          description: 'GE Digital & the Predix Platform, 2011–2018',
          href: '/capstones/innovation-case-study-1.html',
        },
        {
          id: 'innovation-case-study-2',
          title: "Part 2 · The Use Case the Foundation Couldn't Support",
          description: 'MTN Group AI Ambition Across 16 African Markets, 2021–2026',
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
  transforming_business: placeholderTriple('transforming-business'),
  fostering: placeholderTriple('fostering'),
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
          description: 'Closes Lead Like a Pro (Week 6). Objectives, methodology, risks.',
          href: '/capstones/starter-kit-capstone-part-b.html',
        },
        {
          id: 'starter-kit-capstone-part-c',
          title: 'Part C · Status Report',
          description: 'Closes Project Leadership Discipline. Risk-led mid-flight report.',
          href: '/capstones/starter-kit-capstone-part-c.html',
        },
      ],
    },
    {
      id: 'starter-kit-case-study',
      type: 'case_study',
      title: 'Combined Case Studies (2 parts)',
      description:
        'Two case studies marked together: Kodak (the pitch that did not land) and SARS (the modernisation that was dismantled).',
      status: 'available',
      parts: [
        {
          id: 'starter-kit-case-study-1',
          title: 'Part 1 · The Pitch That Did Not Land',
          description: 'Kodak and the Digital Camera, 1975–1996. Closes Think Like an Owner.',
          href: '/capstones/starter-kit-case-study-1.html',
        },
        {
          id: 'starter-kit-case-study-2',
          title: 'Part 2 · The Modernisation That Was Dismantled',
          description: 'South African Revenue Service, 2014–2018. Closes Delivering Transformation.',
          href: '/capstones/starter-kit-case-study-2.html',
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
          description: 'Week 6 - the integrative artefact that closes the Starter Kit.',
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
