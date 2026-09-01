import type { Archetype } from '@/config/liftAssessment'

/**
 * Session-prep prompts keyed by LIFT archetype.
 * Nana can replace copy later; structure is stable for MentorshipGoalsCard.
 */
export type ArchetypeSessionPrompt = {
  /** Short label shown above the answer field. */
  label: string
  /** Question the learner answers for their mentor/coach. */
  question: string
  placeholder: string
}

export const ARCHETYPE_SESSION_PROMPTS: Record<Archetype, ArchetypeSessionPrompt[]> = {
  Anchor: [
    {
      label: 'Steady under pressure',
      question: 'Where do you most need to stay grounded this month, and what usually knocks you off?',
      placeholder: 'e.g. Board updates — I rush and over-explain when challenged.',
    },
    {
      label: 'Energy & resilience',
      question: 'What practice will you protect this week so you do not run empty?',
      placeholder: 'e.g. No meetings before 9am; walk after hard calls.',
    },
    {
      label: 'Ask of your mentor',
      question: 'What do you want your mentor to hold you accountable for?',
      placeholder: 'e.g. Call out when I avoid a hard conversation.',
    },
  ],
  Architect: [
    {
      label: 'System you are shaping',
      question: 'Which AI / digital system are you trying to make portable across teams?',
      placeholder: 'e.g. Fraud detection playbook that markets can actually repeat.',
    },
    {
      label: 'Translation gap',
      question: 'Where does your vision currently fail to survive 24 hours after you leave the room?',
      placeholder: 'e.g. Middle managers still describe it as “the vendor project”.',
    },
    {
      label: 'Ask of your mentor',
      question: 'What judgment call do you want help stress-testing?',
      placeholder: 'e.g. Whether to slow the rollout to fix data quality first.',
    },
  ],
  Catalyst: [
    {
      label: 'Team readiness',
      question: 'Which team is least ready for AI-era change, and what is the real blocker?',
      placeholder: 'e.g. Ops — fear of headcount cuts, not skill.',
    },
    {
      label: 'Fostering others',
      question: 'Who needs you to multiply capability this month instead of doing the work yourself?',
      placeholder: 'e.g. Two team leads who still escalate every exception to me.',
    },
    {
      label: 'Ask of your mentor',
      question: 'Where should your mentor push you to let go?',
      placeholder: 'e.g. Stop rewriting other people’s decks.',
    },
  ],
  Operator: [
    {
      label: 'Operating rhythm',
      question: 'What operating system (cadence, owners, metrics) are you installing for this transformation?',
      placeholder: 'e.g. Weekly risk stand-up with named owners and a 30-day kill criteria.',
    },
    {
      label: 'AI-specific risk',
      question: 'Name the most important AI-specific risk and why it would not show up on a normal register.',
      placeholder: 'e.g. Model drift after we change the customer mix in Q3.',
    },
    {
      label: 'Ask of your mentor',
      question: 'What decision do you need help making irreversible (or reversible) this fortnight?',
      placeholder: 'e.g. Whether to freeze the vendor scope before legal reviews finish.',
    },
  ],
  Practitioner: [
    {
      label: 'Cross-pillar stretch',
      question: 'You score high across pillars — which edge still feels soft in live work?',
      placeholder: 'e.g. I design well but still struggle to land sponsorship.',
    },
    {
      label: 'Multiplication',
      question: 'How will you multiply impact through others this month instead of carrying it alone?',
      placeholder: 'e.g. Hand the weekly briefing to my deputy with a clear rubric.',
    },
    {
      label: 'Ask of your mentor',
      question: 'What should your mentor challenge so you do not plateau?',
      placeholder: 'e.g. Push me to say no to two low-leverage committees.',
    },
  ],
  'Emerging Leader': [
    {
      label: 'Foundation',
      question: 'What is the one leadership habit you will practise every week this month?',
      placeholder: 'e.g. Write a weekly reflection before our meet-up.',
    },
    {
      label: 'Real context',
      question: 'Describe one live situation at work where you want to show up differently.',
      placeholder: 'e.g. When my manager dumps urgent work at 5pm.',
    },
    {
      label: 'Ask of your mentor',
      question: 'What support do you need so this does not stay theoretical?',
      placeholder: 'e.g. Role-play the conversation once before I have it.',
    },
  ],
}

export const getArchetypeSessionPrompts = (archetype: Archetype | null | undefined): ArchetypeSessionPrompt[] => {
  if (!archetype) {
    return [
      {
        label: 'What you are trying to achieve',
        question: 'In one or two sentences, what outcome do you want from mentoring/coaching right now?',
        placeholder: 'e.g. Hold a direct conversation with my head of data without backing down.',
      },
      {
        label: 'What is in the way',
        question: 'What usually gets in the way of that outcome?',
        placeholder: 'e.g. I soften the ask when they push back.',
      },
      {
        label: 'Ask of your mentor/coach',
        question: 'What do you want them to notice or challenge?',
        placeholder: 'e.g. Call it out when I change the subject.',
      },
    ]
  }
  return ARCHETYPE_SESSION_PROMPTS[archetype]
}
