/**
 * Podcast catalogue for the "Podcast + Submit Workbook" activity.
 *
 * Structure: keyed by pillar. Each pillar has exactly two modules covering
 * the 6-week journey. Each module has 3 episodes with a 3-question quiz.
 *
 * Episode IDs are stable and stored in `podcastProgress/{uid}.podcasts`.
 * Never rename an existing ID - learners' progress is keyed by it.
 *
 * `youtubeUrl: null` means the episode hasn't been recorded yet (or hasn't
 * been mapped here). The UI shows "Coming soon" but the quiz still works.
 */

import type { Pillar } from '@/types/pillar'

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

export interface PodcastPillarCatalogue {
  modules: [PodcastModule, PodcastModule]
  episodes: Podcast[]
}

// ─────────────────────────────────────────────────────────────────────────────
// The Practitioner (Gateway) → starter_kit
// ─────────────────────────────────────────────────────────────────────────────

const STARTER_KIT: PodcastPillarCatalogue = {
  modules: [
    { id: 'module_1', label: 'Think Like an Owner', weekRange: [1, 2] },
    { id: 'module_2', label: 'Delivering Transformation', weekRange: [3, 6] },
  ],
  episodes: [
    // ─── Module 1 - Think Like an Owner (W1-2) ───
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
      title:
        'How Do You Surface a Transformation Opportunity Senior Leaders Will Actually Fund?',
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
    // ─── Module 2 - Delivering Transformation (W3-6) ───
    {
      id: 'm2-catalogue',
      episodeCode: 'Catalogue',
      title:
        'Sales Meets Structure: Driving Digital Transformation with Project Management Precision',
      module: 'module_2',
      youtubeUrl: 'https://youtu.be/lrSUorHkXzg',
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
            prompt:
              'What is the single fastest way to add structure to a stalled transformation?',
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
            prompt:
              'What is the most common root cause of failed transformation investments?',
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
      title:
        'What Does a Status Report Look Like When the Programme Is Already in Trouble?',
      module: 'module_2',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt:
              'What is the tell-tale sign in a status report that a programme is in trouble?',
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
            prompt:
              'What does the episode advise programme leads to do when the status quietly slides red?',
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
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Leading Self in the Age of AI → leading_self
// ─────────────────────────────────────────────────────────────────────────────

const LEADING_SELF: PodcastPillarCatalogue = {
  modules: [
    { id: 'module_1', label: 'Leading Under Pressure', weekRange: [1, 3] },
    {
      id: 'module_2',
      label: 'Resilience Under Sustained Transformation Pressure',
      weekRange: [4, 6],
    },
  ],
  episodes: [
    // ─── Module 1 - Leading Under Pressure (W1-3) ───
    {
      id: 'ls-m1-motivation-myth',
      episodeCode: 'Catalogue',
      title:
        "The Motivation Myth: Why Deadlines Don't Work, Rewards Backfire, and Fear Kills Productivity",
      module: 'module_1',
      youtubeUrl: 'https://youtu.be/HixZzJmodJo',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt:
              'What is the core problem with using deadlines, rewards, and fear to motivate?',
            options: [
              'They are expensive to administer',
              'They produce short-term compliance but kill intrinsic motivation',
              'They only work in startups',
              'They require HR sign-off',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What does the episode recommend instead of fear-based productivity?',
            options: [
              'More frequent performance reviews',
              'Building intrinsic motivation through purpose, autonomy, and mastery',
              'Stricter deadlines with bigger consequences',
              'Larger financial bonuses',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What happens when leaders rely on rewards to drive performance?',
            options: [
              'Performance becomes transactional and fades once rewards stop',
              'Teams develop deeper customer empathy',
              'Engagement increases year over year',
              'Retention improves indefinitely',
            ],
            correctIndex: 0,
          },
        ],
      },
    },
    {
      id: 'ls-m1-behaviour-change',
      episodeCode: 'Catalogue',
      title: 'Behaviour Change Blueprint: The Trigger That Actually Makes Leaders Transform',
      module: 'module_1',
      youtubeUrl: 'https://youtu.be/tmG9TEQyApU',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt:
              'What is the trigger the episode identifies as actually making leaders transform?',
            options: [
              'A leadership certificate',
              'A moment of personal stakes - when the status quo starts costing them something they care about',
              'A new performance review system',
              'A bigger team budget',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'Why do most behaviour-change attempts fail?',
            options: [
              'They focus on theory and skip the personal stake',
              'They are not approved by HR',
              'They lack a steering committee',
              'They use the wrong calendar tool',
            ],
            correctIndex: 0,
          },
          {
            id: 'q3',
            prompt: 'What does sustained behaviour change actually require?',
            options: [
              'A new title',
              'Repeated practice tied to a meaningful outcome',
              'A longer employment contract',
              'A new direct report',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'ls-m1-self-sabotage',
      episodeCode: 'Catalogue',
      title: 'Conquering Self Sabotage: A Journey to Personal Growth with Nono Bokete',
      module: 'module_1',
      youtubeUrl: 'https://youtu.be/R9Redgz4T7w',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt:
              'What does the episode identify as the most common form of self-sabotage in leaders?',
            options: [
              'Working too few hours',
              'Avoiding decisions or hiding behind busywork to avoid visible risk',
              'Refusing to delegate',
              'Overdelegating critical work',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What is the first step to overcoming self-sabotage?',
            options: [
              'Hire a new coach',
              'Recognise the pattern and name what you are avoiding',
              'Change your job title',
              'Read another leadership book',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What does Nono identify as the underlying driver of most self-sabotage?',
            options: [
              'Bad nutrition',
              'An unspoken fear that success will expose a deeper insecurity',
              'A lack of mentorship',
              'Insufficient compensation',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    // ─── Module 2 - Resilience Under Sustained Transformation Pressure (W4-6) ───
    {
      id: 'ls-m2-faking-it',
      episodeCode: 'Catalogue',
      title: "How Did a 31-Year-Old 'Faking It' Become CEO of 250K People?",
      module: 'module_2',
      youtubeUrl: 'https://youtu.be/04M8pDhnJKA',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What does the episode reveal about most leaders at scale?',
            options: [
              'They feel certain at every decision',
              'Most "fake it" - they make decisions without full certainty, then learn rapidly',
              'They never need to ask for help',
              'They always come from elite schools',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What is the recommended posture toward feeling like an imposter?',
            options: [
              'Hide it from your team',
              'Acknowledge it privately and build a learning cadence to close the gap',
              'Quit and find an easier role',
              'Demand more training before taking the job',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt:
              'What separates leaders who survive at scale from those who flame out?',
            options: [
              'Academic credentials',
              'The speed at which they convert uncertainty into action and learning',
              'The size of their compensation package',
              'The number of direct reports',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'ls-m2-failing-forward',
      episodeCode: 'Catalogue',
      title: 'Failing Forward: Nobody is Watching. Nobody cares!',
      module: 'module_2',
      youtubeUrl: 'https://youtu.be/4Op9Ag2sS1A',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is the core message about failure in this episode?',
            options: [
              'Failure should be hidden at all costs',
              'Most people are not paying as much attention to your failures as you think',
              'Failure is always career-ending',
              'Avoid all visible risks',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What is the value of "failing forward"?',
            options: [
              'Avoiding failure permanently',
              'Treating each failure as a faster path to the next learning',
              'Hiring more analysts',
              'Switching companies more often',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'Why does the episode argue you should worry less about public failure?',
            options: [
              'Failure has no consequences',
              'Your audience is mostly self-focused - your stumble is your concern, not theirs',
              'HR will protect you',
              'The market always forgives',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'ls-m2-s7e15',
      episodeCode: 'S7E15',
      title: 'Three Years of Shameless Tuesday - What We Got Wrong',
      module: 'module_2',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is the core idea of "Shameless Tuesday"?',
            options: [
              'Naming failures publicly to remove their shame and unlock learning',
              'A weekly status meeting',
              'A leadership podcast format only',
              'An annual conference',
            ],
            correctIndex: 0,
          },
          {
            id: 'q2',
            prompt: 'What does the episode identify as the biggest mistake of the first three years?',
            options: [
              'Treating failure as content instead of a teaching tool',
              'Recording in the wrong studio',
              'Picking the wrong day of the week',
              'Not selling enough merchandise',
            ],
            correctIndex: 0,
          },
          {
            id: 'q3',
            prompt: 'What should leaders take away from three years of Shameless Tuesday?',
            options: [
              'Failure is best kept private',
              'Naming what did not work, early and often, builds resilient cultures',
              'Shame is a strong motivator',
              'Avoid Tuesday meetings',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Innovation and AI for Digital Transformation → innovation_technology
// ─────────────────────────────────────────────────────────────────────────────

const INNOVATION_TECHNOLOGY: PodcastPillarCatalogue = {
  modules: [
    {
      id: 'module_1',
      label: 'AI Operating Hour for Transformation Leaders',
      weekRange: [1, 1],
    },
    {
      id: 'module_2',
      label: 'Digital Transformation with Data Foundations',
      weekRange: [2, 6],
    },
  ],
  episodes: [
    // ─── Module 1 - AI Operating Hour (W1) ───
    {
      id: 'it-m1-s7e4',
      episodeCode: 'S7E4',
      title: 'AI Implementation in Africa - What Nobody Tells You',
      module: 'module_1',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is the most overlooked factor in African AI implementation?',
            options: [
              'The cost of GPUs',
              'Local context - data quality, infrastructure, and culturally specific use cases',
              'The number of AI engineers',
              'Cloud provider selection',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What does the episode warn against?',
            options: [
              'Hiring African engineers',
              'Importing AI strategies wholesale from Silicon Valley without local adaptation',
              'Investing in education',
              'Open-sourcing models',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What actually unlocks AI in Africa?',
            options: [
              'Bigger foreign investment',
              'Solving local problems with AI rather than chasing global trends',
              'More overseas internships',
              'Cheaper hardware imports',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'it-m1-jacques-ludik',
      episodeCode: 'Catalogue',
      title:
        "Smart Technology, Bold Vision: Dr. Jacques Ludik on the Role of AI in Africa's Transformation",
      module: 'module_1',
      youtubeUrl: 'https://youtu.be/kRUwfixQjoQ',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'According to Dr. Ludik, what does Africa need to lead in AI?',
            options: [
              'A direct copy of the US strategy',
              'A bold, locally-rooted vision that uses AI to solve African problems',
              'Cheaper raw materials',
              'A new trade agreement',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What is the role of "smart technology" in his framing?',
            options: [
              'Replacing human judgment',
              'Amplifying human decisions, especially in resource-constrained environments',
              'Reducing the need for leadership',
              'Cutting middle management roles',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What is the biggest barrier he identifies?',
            options: [
              'Lack of GPUs',
              'Lack of local AI talent paired with bold leadership willing to back it',
              'Internet connectivity',
              'Government regulation',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'it-m1-new8',
      episodeCode: 'NEW #8',
      title:
        "What Does an AI Operating Hour Actually Look Like When You Don't Have a Lab to Play In?",
      module: 'module_1',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is an "AI Operating Hour"?',
            options: [
              'A monthly all-hands meeting',
              'A dedicated weekly hour where leaders experiment with AI on real work problems',
              'A vendor demo session',
              'A board update',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'Why does an AI Operating Hour work without a lab?',
            options: [
              'It uses pre-built AI tools applied to real business decisions',
              'It requires no humans to participate',
              'Vendors run it for you',
              'It only works in academic settings',
            ],
            correctIndex: 0,
          },
          {
            id: 'q3',
            prompt: 'What is the first agenda item for a good AI Operating Hour?',
            options: [
              'Slide reviews',
              'A real decision the team is making this week, tested against an AI assistant',
              'A history of AI',
              'A vendor pitch',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    // ─── Module 2 - Digital Transformation with Data Foundations (W2-6) ───
    {
      id: 'it-m2-fails-before-starts',
      episodeCode: 'Catalogue + S7E1',
      title: 'Why digital transformation fails before it starts',
      module: 'module_2',
      youtubeUrl: 'https://youtu.be/8qcNtG_2PKw',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What does the episode say is the most common cause of failed transformation?',
            options: [
              'Bad code',
              'A weak or misaligned business case before the project begins',
              'Wrong vendor pick',
              'Insufficient training',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'When does most transformation failure actually occur?',
            options: [
              'After go-live',
              'During the pre-launch scoping and sponsorship phase',
              'During the build phase',
              'During post-launch support',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What does a good pre-launch phase produce?',
            options: [
              'A list of vendors',
              'A named outcome, a named sponsor, and a measurable success criterion',
              'A 60-slide deck',
              'A new org chart',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'it-m2-s7e3',
      episodeCode: 'S7E3',
      title: 'When Your Data is Right But Nobody Trusts It',
      module: 'module_2',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is the core paradox the episode names?',
            options: [
              'Data can be technically correct but operationally untrusted',
              'Data is always wrong',
              'Trust is automatic when data is fresh',
              'All data is biased',
            ],
            correctIndex: 0,
          },
          {
            id: 'q2',
            prompt: 'What builds organisational data trust?',
            options: [
              'A bigger data team',
              'Clear ownership, transparent transformation logic, and a feedback loop',
              'A new BI tool',
              'A bigger data warehouse',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What is the most common reason teams do not trust good data?',
            options: [
              'They prefer guessing',
              'They have been burned before by data that looked right but was contextually wrong',
              'They do not read dashboards',
              'They lack training in SQL',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'it-m2-chatgpt-wrong',
      episodeCode: 'Catalogue',
      title:
        "Your Team Is Already Using ChatGPT Wrong. Here's What It's Costing You",
      module: 'module_2',
      youtubeUrl: 'https://youtu.be/muTbgjbmzGs',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is the cost of teams using ChatGPT without structure?',
            options: [
              'Higher subscription fees',
              'Inconsistent outputs, no shared standards, and lost institutional knowledge',
              'Slower laptops',
              'More IT tickets',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What does the episode recommend leaders do?',
            options: [
              'Ban ChatGPT',
              'Set team-wide standards for prompts, outputs, and review',
              'Hire a Chief AI Officer',
              'Buy a competitor tool',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What is the biggest unrecognised cost mentioned?',
            options: [
              'Subscription overhead',
              'Erosion of writing and thinking skills when AI is used without judgment',
              'Slower internet',
              'Increased meeting count',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Fostering AI-Ready Teams → fostering
// ─────────────────────────────────────────────────────────────────────────────

const FOSTERING: PodcastPillarCatalogue = {
  modules: [
    {
      id: 'module_1',
      label: 'The Leader Your AI-Era Team Actually Needs',
      weekRange: [1, 2],
    },
    {
      id: 'module_2',
      label: 'Building AI-Ready Teams That Hold Together',
      weekRange: [3, 6],
    },
  ],
  episodes: [
    // ─── Module 1 - The Leader Your AI-Era Team Actually Needs (W1-2) ───
    {
      id: 'fo-m1-s7e6',
      episodeCode: 'S7E6',
      title: 'How Do You Build a Transformation Team Across Different Cultures?',
      module: 'module_1',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What does the episode identify as the biggest cross-cultural team risk?',
            options: [
              'Time zone mismatch',
              'Assuming shared norms that are not actually shared',
              'Language barriers',
              'Travel costs',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What is the recommended first move for a cross-cultural team?',
            options: [
              'Hire a translator',
              'Surface team norms explicitly - how we disagree, decide, and deliver',
              'Set up monthly socials',
              'Centralise all decisions to HQ',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What underpins effective cross-cultural collaboration?',
            options: [
              'Identical communication styles',
              'Explicit, named protocols around conflict and decision-making',
              'A single shared time zone',
              'A common first language',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'fo-m1-remote-teams',
      episodeCode: 'Catalogue',
      title: 'What Made My Best & Worst Teams Both Remote? Team Expert Reveals',
      module: 'module_1',
      youtubeUrl: 'https://youtu.be/6w3jagI--wc',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is the surprising finding the episode shares?',
            options: [
              'Remote teams are always worse',
              'Both the best and the worst teams the speaker led were remote - the variable was leadership',
              'Co-located teams always win',
              'Hybrid is universally best',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What separated the best remote teams from the worst?',
            options: [
              'Office perks',
              'Clarity of expectations and a strong rhythm of communication',
              'Number of all-hands meetings',
              'Senior leadership location',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What kills a remote team fastest?',
            options: [
              'Internet outages',
              'Ambiguity left unresolved over weeks',
              'Lack of branded swag',
              'A flat org structure',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'fo-m1-new6',
      episodeCode: 'NEW #6',
      title:
        'How Do You Lead an AI-Era Team When Half Their Job Just Got Automated?',
      module: 'module_1',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is the first thing a leader should do when AI automates half a job?',
            options: [
              'Reduce headcount immediately',
              'Identify where human judgment still creates the most leverage and redirect the team there',
              'Add more meetings',
              'Freeze all hiring',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What is the biggest leadership mistake in this scenario?',
            options: [
              'Buying more AI tools',
              'Pretending nothing has changed and asking people to do the old job slower',
              'Calling a town hall',
              'Updating job titles',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What new skill becomes central for the team?',
            options: [
              'Faster typing',
              'Reviewing, editing, and judging AI outputs rather than producing them raw',
              'Writing longer reports',
              'Manual data entry',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    // ─── Module 2 - Building AI-Ready Teams That Hold Together (W3-6) ───
    {
      id: 'fo-m2-toxic-or-tired',
      episodeCode: 'Catalogue',
      title: "Toxic or Just Tired? When Overtime Doesn't Pay",
      module: 'module_2',
      youtubeUrl: 'https://youtu.be/dmzMIgTwCnk',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is the core distinction the episode draws?',
            options: [
              'Toxic teams complain; tired teams do not',
              'A tired team needs rest; a toxic team needs systemic change',
              'Toxic teams work shorter hours',
              'Tired teams quit faster',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What does the episode say about overtime?',
            options: [
              'It signals high commitment',
              'It often signals broken systems, not individual heroics',
              'It is always paid back in bonuses',
              'It is the mark of a top performer',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What is the recommended diagnostic to tell toxic from tired?',
            options: [
              'Look at coffee consumption',
              "Ask whether the team's energy returns after a week off - if not, it is toxic, not tired",
              'Check timesheets',
              'Compare to industry benchmarks',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'fo-m2-accountability',
      episodeCode: 'Catalogue',
      title: 'Stop Avoiding Accountability: Why Your Team Actually Wants It',
      module: 'module_2',
      youtubeUrl: 'https://youtu.be/0kHU2hY6b9M',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What is the misconception the episode busts?',
            options: [
              'Teams hate accountability',
              'Teams hate vague accountability; clear accountability is what they actually want',
              "Accountability is a manager's job alone",
              'Accountability slows execution',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What makes accountability actually work?',
            options: [
              'More escalations',
              'A named owner, a named decision, and a named date - all written down',
              'A bigger team',
              'Quarterly reviews',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: "What is the leader's role in good accountability?",
            options: [
              'Punishing failure publicly',
              'Making the criteria for success explicit before the work starts',
              'Reviewing every line of work',
              'Avoiding hard conversations',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'fo-m2-s7e14',
      episodeCode: 'S7E14',
      title: 'How Do You Sustain Digital Transformation Momentum for Years, Not Months?',
      module: 'module_2',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt:
              'What does the episode identify as the biggest threat to multi-year transformation?',
            options: [
              'Budget cuts',
              'Loss of focus and a fading sense of urgency once the launch buzz fades',
              'Vendor consolidation',
              'Org chart changes',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What sustains transformation momentum for years?',
            options: [
              'A bigger budget every year',
              'Built-in rituals - recurring reviews, refreshed goals, public storytelling',
              'More consultants',
              'A new CEO every two years',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What is the role of storytelling in long transformations?',
            options: [
              'It is optional fluff',
              'It keeps the "why" alive when day-to-day execution gets tedious',
              'It is used only at year-end',
              'It belongs only in marketing',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Transforming Business with AI → transforming_business
// ─────────────────────────────────────────────────────────────────────────────

const TRANSFORMING_BUSINESS: PodcastPillarCatalogue = {
  modules: [
    {
      id: 'module_1',
      label: 'The Room You Walk Into - Connection and Stakeholder Influence',
      weekRange: [1, 2],
    },
    {
      id: 'module_2',
      label: 'Leading the Business Through AI-Era Change',
      weekRange: [3, 6],
    },
  ],
  episodes: [
    // ─── Module 1 - Connection and Stakeholder Influence (W1-2) ───
    {
      id: 'tb-m1-s7e5',
      episodeCode: 'S7E5',
      title: 'Why Digital Transformation Looks Different in Africa',
      module: 'module_1',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'What makes African digital transformation distinct?',
            options: [
              'It is exactly the same as elsewhere',
              'Stakeholder dynamics, infrastructure gaps, and leapfrog opportunities are different',
              'It always starts with hardware',
              'It requires identical playbooks to the US',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What is the biggest leverage point unique to Africa?',
            options: [
              'Cheaper raw materials',
              'Leapfrogging legacy systems straight to modern tools',
              'Existing data warehouses',
              'Long-established processes',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'Which stakeholder dynamic is most often underestimated?',
            options: [
              'Customer feedback loops',
              'Government and community trust as transformation enablers',
              'Engineer satisfaction surveys',
              'Vendor SLAs',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'tb-m1-new2',
      episodeCode: 'NEW #2',
      title:
        'How Do You Read a Boardroom When Half the Executives Have More AI Fluency Than You?',
      module: 'module_1',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt:
              'What is the recommended posture when you are outflanked on AI fluency?',
            options: [
              'Pretend to know more than you do',
              'Lead with the business question and let the fluent ones answer the technical part',
              'Avoid the meeting',
              'Hire a consultant to attend for you',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: "What is the leader's value-add in this scenario?",
            options: [
              'Demanding more demos',
              'Framing the decision, sequencing the discussion, and naming the trade-offs',
              'Speaking the most',
              'Approving the largest budget',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What is the biggest mistake to avoid?',
            options: [
              'Asking too many questions',
              'Faking technical confidence and losing credibility',
              'Bringing data',
              'Following up after the meeting',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'tb-m1-new7',
      episodeCode: 'NEW #7',
      title:
        'How Do You Build a Connection Blueprint for an Executive Who Has Already Made Up Their Mind?',
      module: 'module_1',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'When an executive has already decided, what should you change?',
            options: [
              'Their mind, directly',
              'The question - reframe the decision so a new option is on the table',
              'The reporting line',
              'The deadline',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What is the "connection blueprint" the episode describes?',
            options: [
              'A monthly survey',
              'A short, named set of moves to build trust and surface a new framing',
              'A formal escalation path',
              'A 360 review',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What rarely works on a made-up executive?',
            options: [
              'A patient conversation with no agenda',
              'A direct contradiction backed only by your own data',
              "A trusted peer's introduction",
              'A reframe of the underlying business question',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    // ─── Module 2 - Leading the Business Through AI-Era Change (W3-6) ───
    {
      id: 'tb-m2-lead-people',
      episodeCode: 'Catalogue + S7E2',
      title: "How Do You Lead People Who Don't Want to Change?",
      module: 'module_2',
      youtubeUrl: 'https://youtu.be/Zcr1B_qXTas',
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: 'How should leaders interpret resistance to change?',
            options: [
              'As a sign to fire the resistors',
              'As information about what they value or fear losing',
              'As proof the change is wrong',
              'As a personal attack',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'What is the most effective first move with resisters?',
            options: [
              'A mandate from above',
              'Listen for the underlying loss they are worried about, and address it specifically',
              'A public ultimatum',
              'A reorganisation',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What does the episode warn against?',
            options: [
              'Slowing down',
              'Conflating disagreement with disloyalty',
              'Asking for input',
              'Naming the change clearly',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'tb-m2-s7e12',
      episodeCode: 'S7E12',
      title: 'How Do You Measure the Success of a Digital Transformation?',
      module: 'module_2',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt:
              'What does the episode identify as the wrong way to measure transformation success?',
            options: [
              'Outcome-based metrics',
              'Activity-based metrics like "number of users trained" or "tickets closed"',
              'Customer impact',
              'Revenue change',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: 'When should success measures be defined?',
            options: [
              'After launch, when there is data',
              'Before launch, with the sponsor signed off',
              'Mid-project when ambiguity is highest',
              'At year-end review',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What is the test for a good success measure?',
            options: [
              'It looks good on a slide',
              'A sponsor can say "yes" or "no" to it without needing a meeting',
              'It requires a quarterly review board',
              'It is only visible to the IT team',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
    {
      id: 'tb-m2-new5',
      episodeCode: 'NEW #5',
      title:
        'Why Does the Vision Your Team Repeats After 24 Hours Sound Nothing Like the One You Launched?',
      module: 'module_2',
      youtubeUrl: null,
      assessment: {
        passingScore: 2,
        questions: [
          {
            id: 'q1',
            prompt: "Why does the team's version of the vision drift within 24 hours?",
            options: [
              'They are not paying attention',
              'Each person filters it through their own role, fears, and incentives',
              'The original was wrong',
              'The slides were too dense',
            ],
            correctIndex: 1,
          },
          {
            id: 'q2',
            prompt: "What is the leader's job after launching a vision?",
            options: [
              'Move on to the next initiative',
              'Reinforce it relentlessly in 1:1s, meetings, and decisions until it is repeated back accurately',
              'Send one follow-up email',
              'Wait for it to take hold organically',
            ],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'What does the episode recommend doing in week 2?',
            options: [
              'Refreshing the visuals',
              'Asking 5 random team members to repeat the vision in their own words, and listening for drift',
              'Doing a survey',
              'Hiring a coach',
            ],
            correctIndex: 1,
          },
        ],
      },
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const PODCAST_LIBRARY: Record<Pillar, PodcastPillarCatalogue> = {
  starter_kit: STARTER_KIT,
  leading_self: LEADING_SELF,
  innovation_technology: INNOVATION_TECHNOLOGY,
  fostering: FOSTERING,
  transforming_business: TRANSFORMING_BUSINESS,
}

/** Returns the module that contains the given week for the given pillar. */
export function getModuleForPillarAndWeek(
  pillar: Pillar | null,
  week: number,
): PodcastModule | null {
  if (!pillar) return null
  const catalogue = PODCAST_LIBRARY[pillar]
  return (
    catalogue.modules.find(
      (m) => week >= m.weekRange[0] && week <= m.weekRange[1],
    ) ?? null
  )
}

/** Returns the podcasts mapped to the current module of the given pillar/week. */
export function getPodcastsForPillarAndWeek(
  pillar: Pillar | null,
  week: number,
): Podcast[] {
  if (!pillar) return []
  const catalogue = PODCAST_LIBRARY[pillar]
  const module = getModuleForPillarAndWeek(pillar, week)
  if (!module) return []
  return catalogue.episodes.filter((p) => p.module === module.id)
}
