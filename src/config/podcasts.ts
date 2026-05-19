/**
 * Podcast catalogue for the "Podcast + Submit Workbook" activity.
 *
 * Each module's podcasts surface when the learner's `currentWeek` falls
 * in that module's week range. YouTube URLs are placeholders for now —
 * swap them in when the real episodes are uploaded.
 */

export type PodcastModuleId = 'module_1' | 'module_2'

export interface AssessmentQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
}

export interface Podcast {
  id: string
  episodeCode: string
  title: string
  module: PodcastModuleId
  youtubeUrl: string | null
  assessment: {
    questions: AssessmentQuestion[]
    /** Number of correct answers needed to pass (out of `questions.length`). */
    passingScore: number
  }
}

export interface PodcastModule {
  id: PodcastModuleId
  label: string
  /** Inclusive week range that this module covers in the journey. */
  weekRange: [number, number]
}

export const PODCAST_MODULES: PodcastModule[] = [
  { id: 'module_1', label: 'Think Like an Owner', weekRange: [1, 2] },
  { id: 'module_2', label: 'Delivering Transformation', weekRange: [3, 6] },
]

export const PODCASTS: Podcast[] = [
  // ───────────────── Module 1 — Think Like an Owner (W1-2) ─────────────────
  {
    id: 'm1-s7e10',
    episodeCode: 'S7E10',
    title: 'The Skills Gap Nobody Talks About in Digital Transformation',
    module: 'module_1',
    youtubeUrl: null,
    assessment: {
      passingScore: 2,
      questions: [
        {
          id: 'q1',
          prompt: 'What is the central skills gap the episode identifies?',
          options: [
            'Technical tooling knowledge',
            'Owner-level commercial thinking inside delivery teams',
            'Project management certifications',
            'Vendor procurement experience',
          ],
          correctIndex: 1,
        },
        {
          id: 'q2',
          prompt: 'Why does the gap matter for transformation outcomes?',
          options: [
            'It slows down ticket triage',
            'It causes teams to optimise for activity, not business value',
            'It increases vendor lock-in',
            'It raises licensing costs',
          ],
          correctIndex: 1,
        },
        {
          id: 'q3',
          prompt: 'What is the recommended first move to close the gap?',
          options: [
            'Hire a Chief Transformation Officer',
            'Buy more training licences',
            'Coach delivery leads to think like the P&L owner',
            'Outsource everything to a consultancy',
          ],
          correctIndex: 2,
        },
      ],
    },
  },
  {
    id: 'm1-new3',
    episodeCode: 'NEW #3',
    title: 'How Do You Surface a Transformation Opportunity Senior Leaders Will Actually Fund?',
    module: 'module_1',
    youtubeUrl: null,
    assessment: {
      passingScore: 2,
      questions: [
        {
          id: 'q1',
          prompt: 'What does the episode say leaders fund first?',
          options: [
            'Polished slide decks',
            'Opportunities tied to a named business pain and a measurable upside',
            'Whatever the loudest team proposes',
            'Initiatives with the most external endorsements',
          ],
          correctIndex: 1,
        },
        {
          id: 'q2',
          prompt: 'What is the single most useful framing for an opportunity pitch?',
          options: [
            '"It is the future"',
            '"Our competitor is doing it"',
            'A before/after picture of a business metric, with a credible path',
            'A 60-slide technical architecture',
          ],
          correctIndex: 2,
        },
        {
          id: 'q3',
          prompt: 'Why do most transformation ideas die before funding?',
          options: [
            'Sponsors hate change',
            'They are presented as projects instead of as bets on a business outcome',
            'They lack a code name',
            'They are not first reviewed by IT',
          ],
          correctIndex: 1,
        },
      ],
    },
  },
  {
    id: 'm1-new4',
    episodeCode: 'NEW #4',
    title: "How Do You Pitch an Idea Internally When You Don't Own the Decision?",
    module: 'module_1',
    youtubeUrl: null,
    assessment: {
      passingScore: 2,
      questions: [
        {
          id: 'q1',
          prompt: 'When you do not own the decision, what is the smartest first move?',
          options: [
            'Send an email to everyone above you',
            'Find the person who does own it, and learn what they need to say yes',
            'Wait to be invited',
            'Build the prototype anyway and demo it',
          ],
          correctIndex: 1,
        },
        {
          id: 'q2',
          prompt: 'What does the episode warn against in internal pitches?',
          options: [
            'Bringing data',
            'Presenting the idea as obviously correct without addressing risk',
            'Talking to peers first',
            'Naming the initiative',
          ],
          correctIndex: 1,
        },
        {
          id: 'q3',
          prompt: 'What turns a "maybe" into a "yes" most often?',
          options: [
            'A bigger budget ask',
            'Showing you have already de-risked the next step',
            'External case studies',
            'A deadline ultimatum',
          ],
          correctIndex: 1,
        },
      ],
    },
  },

  // ─────────────────── Module 2 — Delivering Transformation (W3-6) ───────────────────
  {
    id: 'm2-catalogue',
    episodeCode: 'Catalogue',
    title: 'Sales Meets Structure: Driving Digital Transformation with Project Management Precision',
    module: 'module_2',
    youtubeUrl: null,
    assessment: {
      passingScore: 2,
      questions: [
        {
          id: 'q1',
          prompt: 'What does "sales meets structure" mean in this episode?',
          options: [
            'Hiring more salespeople',
            'Bringing project rigour to commercial conversations',
            'Outsourcing PM to a vendor',
            'Replacing the PMO with sales ops',
          ],
          correctIndex: 1,
        },
        {
          id: 'q2',
          prompt: 'What is the biggest precision risk the episode highlights?',
          options: [
            'Slide formatting',
            'Mistaking activity tracking for outcome tracking',
            'Using the wrong PM tool',
            'Choosing the wrong project name',
          ],
          correctIndex: 1,
        },
        {
          id: 'q3',
          prompt: 'What is the single fastest way to add structure to a stalled transformation?',
          options: [
            'A weekly status colour',
            'A small, named outcome and a date for the next decision',
            'Hiring an external consultancy',
            'Replacing the sponsor',
          ],
          correctIndex: 1,
        },
      ],
    },
  },
  {
    id: 'm2-s7e13',
    episodeCode: 'S7E13',
    title: "Why Most Digital Transformation Investments Don't Deliver What They Promise",
    module: 'module_2',
    youtubeUrl: null,
    assessment: {
      passingScore: 2,
      questions: [
        {
          id: 'q1',
          prompt: 'What is the most common root cause of failed transformation investments?',
          options: [
            'Wrong technology choice',
            'A weak link between investment and a measurable business outcome',
            'Lack of agile training',
            'No dedicated PMO',
          ],
          correctIndex: 1,
        },
        {
          id: 'q2',
          prompt: 'When investments stall, what fails before the technology?',
          options: [
            'The architecture',
            'The decision-making cadence',
            'The vendor contracts',
            'The release plan',
          ],
          correctIndex: 1,
        },
        {
          id: 'q3',
          prompt: 'What is the recommended way to keep an investment honest?',
          options: [
            'Add more dashboards',
            'Define the "what good looks like" measure on day one and revisit it every cycle',
            'Increase the budget',
            'Hire more analysts',
          ],
          correctIndex: 1,
        },
      ],
    },
  },
  {
    id: 'm2-new1',
    episodeCode: 'NEW #1',
    title: 'What Does a Status Report Look Like When the Programme Is Already in Trouble?',
    module: 'module_2',
    youtubeUrl: null,
    assessment: {
      passingScore: 2,
      questions: [
        {
          id: 'q1',
          prompt: 'What is the tell-tale sign in a status report that a programme is in trouble?',
          options: [
            'Lots of green',
            'Status colours that no longer match what people privately say',
            'A new logo',
            'A long appendix',
          ],
          correctIndex: 1,
        },
        {
          id: 'q2',
          prompt: 'What should a good "in trouble" status report explicitly include?',
          options: [
            'A blame list',
            'The decision the sponsor is being asked to make this week',
            'A 20-slide review',
            'A morale survey',
          ],
          correctIndex: 1,
        },
        {
          id: 'q3',
          prompt: 'What does the episode advise programme leads to do when the status quietly slides red?',
          options: [
            'Hide it until next quarter',
            'Name it early, with a clear ask and a small set of options',
            'Wait for the steering committee to notice',
            'Reorganise the team',
          ],
          correctIndex: 1,
        },
      ],
    },
  },
]

/** Returns the module that contains the given week, or `null` if none match. */
export function getModuleForWeek(week: number): PodcastModule | null {
  return (
    PODCAST_MODULES.find(
      (m) => week >= m.weekRange[0] && week <= m.weekRange[1],
    ) ?? null
  )
}

export function getPodcastsForWeek(week: number): Podcast[] {
  const module = getModuleForWeek(week)
  if (!module) return []
  return PODCASTS.filter((p) => p.module === module.id)
}
