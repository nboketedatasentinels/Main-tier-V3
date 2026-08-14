/**
 * Mentor coaching insights: rule/template based, clearly labeled AI-generated.
 * Not a live LLM call; copy is deterministic from personality + values + journey.
 */
import {
  getPersonalityDescription,
  PERSONALITY_TYPES,
  type PersonalityType,
} from '@/config/personality-data'
import type { JourneyType } from '@/config/pointsConfig'
import { isJourneyType, getJourneyLabel } from '@/utils/journeyType'

export interface MentorMenteeInsightInput {
  name: string
  personalityType?: string | null
  coreValues?: string[] | null
  ageRange?: string | null
  journeyType?: string | null
  currentWeek?: number | null
  courseTitles?: string[]
}

export interface StrengthsWeaknessesWriteUp {
  strengths: string[]
  growthEdges: string[]
  summary: string
}

export interface AiInferenceBlock {
  lines: string[]
  label: 'AI-generated'
  disclaimer: string
}

export interface MentoringSessionPlan {
  recommendedSessionCount: number
  journeyLabel: string
  sessions: Array<{
    index: number
    title: string
    focus: string
    suggestedTopics: string[]
    tip: string
  }>
}

const isPersonalityType = (value: string | null | undefined): value is PersonalityType =>
  Boolean(value && PERSONALITY_TYPES.some((p) => p.type === value))

const personalityStrengthHints: Partial<Record<PersonalityType, string[]>> = {
  INTJ: ['Systems thinking', 'Long-range planning', 'Independent judgment'],
  INTP: ['Analytical depth', 'Conceptual clarity', 'Curious problem framing'],
  ENTJ: ['Decisive leadership', 'Organizing people toward goals', 'Strategic drive'],
  ENTP: ['Idea generation', 'Intellectual agility', 'Challenge framing'],
  INFJ: ['Empathic insight', 'Values-led guidance', 'Seeing potential in others'],
  INFP: ['Authenticity', 'Deep listening', 'Meaning-centered motivation'],
  ENFJ: ['Inspiring others', 'Team cohesion', 'Developmental coaching instinct'],
  ENFP: ['Energizing people', 'Creative options', 'Connecting dots across contexts'],
  ISTJ: ['Reliability', 'Process discipline', 'Follow-through'],
  ISFJ: ['Steady support', 'Protecting standards', 'Practical care for others'],
  ESTJ: ['Operational clarity', 'Accountable execution', 'Clear expectations'],
  ESFJ: ['Relationship warmth', 'Community building', 'Service orientation'],
  ISTP: ['Practical troubleshooting', 'Calm under pressure', 'Efficient craft'],
  ISFP: ['Aesthetic judgment', 'Quiet authenticity', 'Hands-on contribution'],
  ESTP: ['Action orientation', 'Crisis pragmatism', 'Reading the room quickly'],
  ESFP: ['Morale lift', 'Bringing people together', 'Present-moment engagement'],
}

const personalityGrowthHints: Partial<Record<PersonalityType, string[]>> = {
  INTJ: ['Invite more stakeholder dialogue before locking the plan'],
  INTP: ['Translate insight into a visible next action with a deadline'],
  ENTJ: ['Slow down to hear quieter voices before deciding'],
  ENTP: ['Close loops: pick one idea and finish it'],
  INFJ: ['Protect energy; not every tension needs absorbing'],
  INFP: ['Name a concrete experiment when ideals feel distant'],
  ENFJ: ['Avoid over-owning others’ development outcomes'],
  ENFP: ['Prioritize one thread when excitement scatters focus'],
  ISTJ: ['Practice flexible responses when plans shift mid-stream'],
  ISFJ: ['Ask for support instead of carrying the load alone'],
  ESTJ: ['Leave space for experimentation alongside process'],
  ESFJ: ['Separate harmony from honest performance feedback'],
  ISTP: ['Narrate thinking so collaborators can follow'],
  ISFP: ['Advocate for your perspective earlier in group decisions'],
  ESTP: ['Build reflective pause before the next move'],
  ESFP: ['Anchor enthusiasm to a measurable commitment'],
}

const valueToStrength = (value: string): string => {
  const v = value.toLowerCase()
  if (v.includes('growth') || v.includes('learning') || v.includes('curiosity')) {
    return 'Learning orientation'
  }
  if (v.includes('accountability') || v.includes('discipline') || v.includes('excellence')) {
    return 'Standards and follow-through'
  }
  if (v.includes('compassion') || v.includes('family') || v.includes('loyalty') || v.includes('trust')) {
    return 'Relational trust'
  }
  if (v.includes('influence') || v.includes('ambition') || v.includes('success')) {
    return 'Drive to make an impact'
  }
  if (v.includes('authenticity') || v.includes('honesty') || v.includes('ethics')) {
    return 'Integrity under pressure'
  }
  return `Values-led focus on ${value}`
}

export const buildStrengthsWeaknessesWriteUp = (
  input: MentorMenteeInsightInput,
): StrengthsWeaknessesWriteUp => {
  const type = isPersonalityType(input.personalityType) ? input.personalityType : null
  const strengths = [
    ...(type ? personalityStrengthHints[type] ?? [] : []),
    ...(input.coreValues ?? []).slice(0, 3).map(valueToStrength),
  ]
  const growthEdges = [
    ...(type ? personalityGrowthHints[type] ?? [] : []),
    ...(input.coreValues?.length
      ? []
      : ['Capture verified core values so coaching can stay values-aligned']),
    ...(type ? [] : ['Complete a verified personality profile to sharpen coaching leverage']),
  ]

  const summary = type
    ? `${input.name} shows ${PERSONALITY_TYPES.find((p) => p.type === type)?.name ?? type} patterns${
        input.coreValues?.length ? ` with values around ${(input.coreValues ?? []).slice(0, 3).join(', ')}` : ''
      }. Use strengths as levers; coach growth edges with concrete weekly experiments.`
    : `${input.name}'s profile is still incomplete. Start with goals and observed behavior, then fill personality and values to deepen the coaching brief.`

  return {
    strengths: strengths.slice(0, 5),
    growthEdges: growthEdges.slice(0, 4),
    summary,
  }
}

export const buildAiInference = (input: MentorMenteeInsightInput): AiInferenceBlock => {
  const type = isPersonalityType(input.personalityType) ? input.personalityType : null
  const journey =
    input.journeyType && isJourneyType(input.journeyType)
      ? getJourneyLabel(input.journeyType)
      : input.journeyType || 'their journey'
  const courses =
    input.courseTitles && input.courseTitles.length
      ? input.courseTitles.slice(0, 2).join(' and ')
      : 'current course work'
  const values =
    input.coreValues && input.coreValues.length
      ? input.coreValues.slice(0, 3).join(', ')
      : 'emerging personal values'

  const lines: string[] = []
  if (type) {
    lines.push(
      `${input.name} (${type}) likely coaches best through ${getPersonalityDescription(type).split('.')[0].toLowerCase()}.`,
    )
  } else {
    lines.push(
      `${input.name}'s coaching style is still forming. Lead with curiosity about how they make decisions under pressure.`,
    )
  }
  lines.push(
    `On ${journey}, anchor sessions in ${courses} while honoring ${values}; ask what changed in practice since the last meeting.`,
  )
  if (input.ageRange) {
    lines.push(
      `With an age band of ${input.ageRange}, keep examples career-stage relevant and avoid one-size-fits-all leadership tropes.`,
    )
  } else {
    lines.push(
      `Close each session with one observable commitment and a date. That converts insight into journey points and real behavior.`,
    )
  }

  return {
    lines: lines.slice(0, 3),
    label: 'AI-generated',
    disclaimer:
      'AI-generated coaching suggestion based on personality, values, and journey data. Review before using; not a clinical or performance verdict.',
  }
}

const sessionBlueprints = [
  {
    title: 'Contract & context',
    focus: 'Trust, goals, and how you will work together',
    topics: [
      'What success looks like by journey end',
      'Where they feel stuck this fortnight',
      'Preferred feedback style',
    ],
    tip: 'Co-create 1-2 mentorship goals the learner owns in writing.',
  },
  {
    title: 'Practice & stretch',
    focus: 'Apply course learning to a live work situation',
    topics: [
      'A recent leadership moment they handled',
      'Course concept to try this week',
      'Stakeholder they need to influence',
    ],
    tip: 'Leave with one micro-experiment and a check-in date.',
  },
  {
    title: 'Impact & ownership',
    focus: 'Evidence of change and next-level responsibility',
    topics: [
      'Impact log or result they can show',
      'Self vs observer perception gaps',
      'What they will teach or model for peers',
    ],
    tip: 'Celebrate progress, then raise the bar with a stretch commitment.',
  },
  {
    title: 'Integration',
    focus: 'Sustain habits beyond the program',
    topics: [
      'Habits to keep after the journey',
      'Support network inside the org',
      'Open questions for the next chapter',
    ],
    tip: 'Document wins for their partner report and personal portfolio.',
  },
]

export const buildMentoringSessionPlan = (
  input: MentorMenteeInsightInput,
): MentoringSessionPlan => {
  const jt =
    input.journeyType && isJourneyType(input.journeyType)
      ? (input.journeyType as JourneyType)
      : null
  // Rough session cadence by journey length (mentor_meetup frequency bands).
  const recommended =
    jt === '4W' || jt === '6W' ? 2 : jt === '3M' ? 3 : jt === '6M' ? 4 : jt === '9M' ? 5 : 3

  const journeyLabel = jt ? getJourneyLabel(jt) : 'Journey'
  const count = Math.min(recommended, sessionBlueprints.length)

  return {
    recommendedSessionCount: count,
    journeyLabel,
    sessions: sessionBlueprints.slice(0, count).map((bp, i) => ({
      index: i + 1,
      title: bp.title,
      focus: bp.focus,
      suggestedTopics: bp.topics,
      tip: bp.tip,
    })),
  }
}

/** Five-session Transformation Coaching arc (Coach Guidelines §6). */
const coachingArcBlueprints = [
  {
    title: 'Contract & real goal',
    focus: 'Contracting and the outcome they can observe',
    topics: [
      'What “done” looks like to someone else',
      'Off-limits and challenge preference',
      'How many sessions you have and how you will use them',
    ],
    tip: 'Expect the stated goal to change by session two. Write the outcome, not the topic.',
  },
  {
    title: 'The constraint',
    focus: 'What is actually in the way, named honestly',
    topics: [
      'What has already stopped them',
      'What they would have to give up',
      'Who benefits from the status quo',
    ],
    tip: 'Stay with the silence when the real constraint surfaces. Do not rescue it.',
  },
  {
    title: 'First live attempt',
    focus: 'Action between sessions — something happens in the world',
    topics: [
      'The first move they can make tomorrow',
      'What will get in the way',
      'Who needs to know',
    ],
    tip: 'Between sessions the client works, not you. No decks as a habit.',
  },
  {
    title: 'What happened',
    focus: 'Reality has interfered with the plan',
    topics: [
      'What they tried and what broke',
      'What the attempt revealed about the constraint',
      'The next sharper commitment',
    ],
    tip: 'Usually the most valuable session. Treat failure as data, not drama.',
  },
  {
    title: 'Consolidation & handover',
    focus: 'What they take forward without you',
    topics: [
      'The pattern they will recognize next time',
      'Support they will use without this coach',
      'One practice they will keep',
    ],
    tip: 'End cleanly. A reassignment in session two is normal; in session five it is late.',
  },
]

/**
 * Coach-built learning plan sized to purchased sessions (1–5).
 * One-session engagements get a compressed single-session plan.
 */
export const buildCoachingSessionPlan = (
  input: MentorMenteeInsightInput & { purchasedSessions?: number | null },
): MentoringSessionPlan => {
  const purchased = Math.min(5, Math.max(1, Math.round(input.purchasedSessions ?? 5) || 5))
  const journeyLabel =
    purchased === 1 ? 'Single-session coaching' : `${purchased}-session coaching arc`

  if (purchased === 1) {
    return {
      recommendedSessionCount: 1,
      journeyLabel,
      sessions: [
        {
          index: 1,
          title: 'One real decision',
          focus: 'Contract fast, sharpen the goal, find one constraint, commit',
          suggestedTopics: [
            'Observable outcome for this hour',
            'The one thing in the way',
            'A commitment they can keep without a second session',
          ],
          tip: 'Do not open something you cannot close. One sharp decision is success.',
        },
      ],
    }
  }

  return {
    recommendedSessionCount: purchased,
    journeyLabel,
    sessions: coachingArcBlueprints.slice(0, purchased).map((bp, i) => ({
      index: i + 1,
      title: bp.title,
      focus: bp.focus,
      suggestedTopics: bp.topics,
      tip: bp.tip,
    })),
  }
}

export const mentoringTipsLibrary = [
  'Open with their energy: what went well since last time before diving into gaps.',
  'Ask for a concrete story (“tell me about Tuesday”) instead of abstract self-ratings.',
  'Mirror one strength you observed, then ask what support would make the stretch safer.',
  'End every session with a written commitment the learner can paste into their checklist.',
  'If values and behavior diverge, explore the conflict gently. That is often the real work.',
]
