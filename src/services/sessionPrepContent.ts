/**
 * Session Prep content builder (mentor / coach / leader).
 * Deterministic, context-aware copy grounded in live profile / LIFT / goals /
 * programme / session data - never invents learner facts.
 */
import { PILLARS, type PillarKey } from '@/config/liftAssessment'
import { PERSONALITY_TYPES, type PersonalityType } from '@/config/personality-data'
import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'
import {
  getJourneyLabel,
  isJourneyType,
  isLeadershipCouncilJourney,
  JOURNEY_MONTH_COUNTS,
} from '@/utils/journeyType'
import { resolveLowestPillar, resolveHighestPillar } from '@/utils/liftScoring'

export type SessionPrepAudience = 'mentor' | 'coach' | 'leader'

export interface SessionPrepTopic {
  pillarLabel: string
  signalSource: string
  title: string
  why: string
  sayAloud: string
  sayLabel: 'Say this out loud' | 'Ask this'
}

export interface SessionPrepInput {
  audience: SessionPrepAudience
  leaderName: string
  leaderRoleTitle?: string | null
  leaderOrgContext?: string | null
  mentorName?: string | null
  mentorBio?: string | null
  personalityType?: string | null
  coreValues?: string[] | null
  journeyType?: string | null
  journeyStartDate?: Date | string | null
  currentWeek?: number | null
  goals?: string | null
  offLimits?: string | null
  challengePreference?: string | null
  pillars?: Record<PillarKey, number> | null
  chosenPillar?: PillarKey | null
  archetype?: string | null
  totalPoints?: number | null
  windowStatus?: 'on_track' | 'warning' | 'alert' | 'recovery' | null
  sessionNumber?: number | null
  sessionTotal?: number | null
  scheduledLabel?: string | null
  originLine?: string | null
  purchasedCoachSessions?: number | null
  /** Programme course titles - used for conversation suggestions. */
  courseTitles?: string[] | null
  /** Minutes for the upcoming session when known from a live booking/slot. */
  durationMinutes?: number | null
  /** Topic from the next booked / scheduled meet-up. */
  upcomingSessionTopic?: string | null
}

export interface SessionPrepModel {
  audience: SessionPrepAudience
  headline: string
  personTitle: string
  personSubtitle: string
  journeyLine: string
  sessionPill: string
  scheduledLabel: string
  originLine: string
  arcLabels: string[]
  arcCurrentIndex: number
  arcNote: string
  pillars: Record<PillarKey, number> | null
  chosenPillar: PillarKey | null
  gapPillar: PillarKey | null
  showScores: boolean
  liftPending: boolean
  tendencies: string[]
  costs: string[]
  values: string[]
  offLimits: string | null
  goalVerbatim: string | null
  archetypeLabel: string | null
  totalPointsLabel: string | null
  challengeChips: string[]
  topics: SessionPrepTopic[]
  opener: { label: string; quote: string; note: string } | null
  stanceReminders: string[]
  bringItems: Array<{ title: string; hint: string }>
  mentorCanSee: string[]
  mentorCannotSee: string[]
  primaryActionLabel: string
  secondaryActionLabel: string
}

const pillarName = (key: PillarKey): string =>
  PILLARS.find((p) => p.key === key)?.name ?? key

export const mentorMeetupCountForJourney = (journeyType?: string | null): number => {
  if (!journeyType || !isJourneyType(journeyType)) return 6
  if (!isLeadershipCouncilJourney(journeyType)) return 0
  return JOURNEY_MONTH_COUNTS[journeyType as JourneyType] || 0
}

const coachArcLabels = (count: number): string[] => {
  if (count <= 1) return ['Session']
  if (count === 5) return ['Contract', 'Constraint', 'Action', 'Review', 'Handover']
  return Array.from({ length: count }, (_, i) => `S${i + 1}`)
}

const parseStartDate = (value?: Date | string | null): Date | null => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export const mentorMonthLabels = (count: number, journeyStartDate?: Date | string | null): string[] => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const start = parseStartDate(journeyStartDate)
  const startMonth = start ? start.getMonth() : new Date().getMonth()
  return Array.from({ length: Math.max(0, count) }, (_, i) => months[(startMonth + i) % 12])
}

const isPersonalityType = (value: string | null | undefined): value is PersonalityType =>
  Boolean(value && PERSONALITY_TYPES.some((p) => p.type === value))

const tendencyLines = (name: string, type?: string | null): string[] => {
  if (!isPersonalityType(type)) return []
  const meta = PERSONALITY_TYPES.find((p) => p.type === type)
  const specific: Partial<Record<PersonalityType, string[]>> = {
    INTJ: [
      'Often has the full argument built before speaking, so their thinking is usually further along than the room realizes.',
      'Tends to trust evidence over consensus and holds a position when the numbers support it.',
    ],
    INTP: [
      'Works through problems in layers before sharing a conclusion.',
      'Will reopen a settled point if a better model appears.',
    ],
    ENTJ: [
      'Moves quickly to decisions and expects others to keep pace.',
      'Frames conversations around outcomes and ownership.',
    ],
    INFJ: [
      'Reads the relational undercurrent before speaking to the content.',
      'May carry more of the room’s tension than they show.',
    ],
    ISTJ: [
      'Prefers clear standards and completed loops over exploratory talk.',
      'Shows care through reliability more than enthusiasm.',
    ],
  }
  if (specific[type]) return specific[type]!
  return [
    `${name} shows ${meta?.name ?? type} patterns (${type}).`,
    'Match their tempo first, then stretch the blind spot.',
  ]
}

const costLines = (name: string, type?: string | null, values?: string[] | null): string[] => {
  if (!isPersonalityType(type) && !(values && values.length)) return []
  const lines: string[] = []
  if (isPersonalityType(type)) {
    const map: Partial<Record<PersonalityType, string[]>> = {
      INTJ: [
        'Arriving with a finished argument can read as arriving with the decision already made.',
        'Depth on the technical case may crowd out the work of bringing people with them.',
      ],
      ENTJ: ['Speed can leave quieter stakeholders unconvinced even when the case is strong.'],
      INTP: ['Exploring every angle can delay a decision the room already needed.'],
    }
    lines.push(...(map[type] ?? [`The same strength that helps ${name} can stall alignment if left unnamed.`]))
  }
  if (values && values.length) {
    lines.push(`Named values: ${values.slice(0, 5).join(', ')}. Watch where those collide with organisational politics.`)
  }
  return lines
}

const buildTopics = (input: SessionPrepInput): SessionPrepTopic[] => {
  const name = input.leaderName.split(' ')[0] || input.leaderName
  const gap = input.pillars ? resolveLowestPillar(input.pillars) : null
  const chosen =
    input.chosenPillar || (input.pillars ? resolveHighestPillar(input.pillars) : null)
  const goal = (input.goals || '').trim()
  const isCoach = input.audience === 'coach'
  const sayLabel = isCoach ? ('Ask this' as const) : ('Say this out loud' as const)
  const courses = (input.courseTitles || []).map((t) => t.trim()).filter(Boolean)
  const upcomingTopic = input.upcomingSessionTopic?.trim() || null
  const topics: SessionPrepTopic[] = []

  if (upcomingTopic) {
    topics.push({
      pillarLabel: 'This meet-up',
      signalSource: 'scheduled session',
      title: upcomingTopic,
      why: `${name} already has this on the calendar. Stay with their framing before you widen it.`,
      sayAloud: isCoach
        ? `What would make "${upcomingTopic}" a success by the end of this hour?`
        : `When you booked "${upcomingTopic}", what outcome were you hoping someone else would notice?`,
      sayLabel,
    })
  }

  if (goal) {
    topics.push({
      pillarLabel: chosen ? pillarName(chosen) : 'Goal',
      signalSource: 'stated goal',
      title: isCoach ? 'Separate the outcomes in one sentence' : 'Pressure-test the stated goal',
      why: isCoach
        ? `"${goal}" may be two outcomes. Contracting is cleaner if ${name} picks which one matters most.`
        : `${name} wrote: "${goal}". Use the meet-up to make progress observable.`,
      sayAloud: isCoach
        ? `If "${goal}" landed tomorrow, what would still feel unfinished?`
        : `What part of "${goal}" is hardest to say out loud in the room that decides?`,
      sayLabel,
    })
  }

  for (const course of courses.slice(0, 2)) {
    topics.push({
      pillarLabel: 'Programme',
      signalSource: 'assigned courses',
      title: `Progress on ${course}`,
      why: `${name}'s organisation programme includes ${courses.slice(0, 3).join(', ')}.`,
      sayAloud: isCoach
        ? `Where is ${course} actually stuck - skill, politics, or authority?`
        : `Where has ${course} stalled under scrutiny, and what would restart it?`,
      sayLabel,
    })
  }

  if (gap && input.pillars) {
    const gapScore = Math.round(input.pillars[gap])
    const chosenScore = chosen ? Math.round(input.pillars[chosen]) : null
    topics.push({
      pillarLabel: pillarName(gap),
      signalSource: 'LIFT assessment',
      title: `The ${pillarName(gap)} gap`,
      why:
        chosen && chosen !== gap && chosenScore != null
          ? `${name}'s LIFT shape is strongest on ${pillarName(chosen)} (${chosenScore}) and lowest on ${pillarName(gap)} (${gapScore}).`
          : `${name}'s lowest LIFT pillar is ${pillarName(gap)} (${gapScore}).`,
      sayAloud: isCoach
        ? `What would change if you treated ${pillarName(gap)} as the real constraint this month?`
        : `Who needs to see stronger ${pillarName(gap)} from you before they trust the rest of the case?`,
      sayLabel,
    })
  }

  if (input.windowStatus === 'warning' || input.windowStatus === 'alert') {
    const week = input.currentWeek
    topics.push({
      pillarLabel: 'Pace',
      signalSource: 'engagement pattern',
      title: 'What is being carried',
      why: week
        ? `${name} is in week ${week} with a ${input.windowStatus} engagement signal.`
        : `${name} currently has a ${input.windowStatus} engagement signal.`,
      sayAloud: isCoach
        ? 'What are you carrying that nobody has asked you about?'
        : 'What have you quietly stopped doing since this programme intensified?',
      sayLabel,
    })
  }

  if (!topics.length) {
    topics.push({
      pillarLabel: 'Contract',
      signalSource: 'limited prep data',
      title: 'Make the outcome observable',
      why: `${name} has limited prep signals yet (goal, LIFT, or programme detail). Use the opening minutes to agree what success looks like.`,
      sayAloud: isCoach
        ? 'By the end of this session, what should someone else be able to see that they cannot see now?'
        : 'What is the one question you most need a clear answer to before we finish?',
      sayLabel,
    })
  }

  return topics.slice(0, 4)
}

const buildHeadline = (input: SessionPrepInput, first: string, goal: string | null): string => {
  const courses = (input.courseTitles || []).map((t) => t.trim()).filter(Boolean)
  const upcoming = input.upcomingSessionTopic?.trim()
  if (goal) {
    return input.audience === 'coach'
      ? `Work the goal they wrote: "${goal}".`
      : `${first} asked for progress on: "${goal}".`
  }
  if (upcoming) return `Stay with the booked topic: ${upcoming}.`
  if (courses[0]) return `Their programme points at ${courses[0]} - test where it is actually stuck.`
  if (input.pillars) {
    const gap = resolveLowestPillar(input.pillars)
    return `LIFT shows ${pillarName(gap)} as the development edge - open there if the room allows.`
  }
  return `Limited prep data for ${first} yet. Contract the outcome before you explore.`
}

export const buildSessionPrepModel = (input: SessionPrepInput): SessionPrepModel => {
  const first = input.leaderName.split(' ')[0] || input.leaderName
  const journeyType = input.journeyType && isJourneyType(input.journeyType) ? input.journeyType : null
  const journeyLabel = journeyType ? getJourneyLabel(journeyType) : null
  const totalWeeks = journeyType ? JOURNEY_META[journeyType].weeks : null
  const week = input.currentWeek ?? null
  const pillars = input.pillars ?? null
  const gapPillar = pillars ? resolveLowestPillar(pillars) : null
  const chosenPillar =
    input.chosenPillar || (pillars ? resolveHighestPillar(pillars) : null)

  const mentorTotal = input.sessionTotal ?? mentorMeetupCountForJourney(journeyType)
  const coachTotal = input.purchasedCoachSessions ?? input.sessionTotal ?? null
  const sessionNumber = Math.max(1, input.sessionNumber ?? 1)
  const goal = input.goals?.trim() || null
  const personalityTendencies = tendencyLines(first, input.personalityType)
  const personalityCosts = costLines(first, input.personalityType, input.coreValues)

  if (input.audience === 'leader') {
    const mentorFirst = (input.mentorName || 'your mentor').split(' ')[0]
    const total = Math.max(1, mentorTotal || 1)
    return {
      audience: 'leader',
      headline: '',
      personTitle: input.mentorName || 'Your mentor',
      personSubtitle: input.mentorBio || 'Assigned mentor on your organisation programme',
      journeyLine: [
        journeyLabel,
        week && totalWeeks ? `Week ${week} of ${totalWeeks}` : week ? `Week ${week}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      sessionPill: `Meet-up ${sessionNumber} of ${total}`,
      scheduledLabel: input.scheduledLabel || 'No upcoming meet-up scheduled',
      originLine: input.originLine || 'You request these. If you do not request one, it does not happen.',
      arcLabels: mentorMonthLabels(total, input.journeyStartDate),
      arcCurrentIndex: Math.min(sessionNumber - 1, total - 1),
      arcNote: journeyLabel
        ? `One meet-up per month across your ${journeyLabel}. You request, they accept.`
        : 'One meet-up per month. You request, they accept.',
      pillars,
      chosenPillar,
      gapPillar,
      showScores: Boolean(pillars),
      liftPending: !pillars,
      tendencies: [],
      costs: [],
      values: input.coreValues ?? [],
      offLimits: input.offLimits?.trim() || null,
      goalVerbatim: goal,
      archetypeLabel: input.archetype?.trim() || null,
      totalPointsLabel:
        typeof input.totalPoints === 'number' && Number.isFinite(input.totalPoints)
          ? `${Math.round(input.totalPoints).toLocaleString()} pts`
          : null,
      challengeChips: [],
      topics: [],
      opener: goal
        ? {
            label: 'If you only ask them one thing',
            quote: `What would unblock "${goal}" fastest from your seat?`,
            note: 'Lead with your written goal.',
          }
        : null,
      stanceReminders: [],
      bringItems: [
        {
          title: 'The moment the work stalled',
          hint: `${mentorFirst} has likely seen this. Ask what actually restarted it.`,
        },
        {
          title: 'Who you have not yet convinced',
          hint: 'You may have the case. The question is who needed to hear it before the meeting.',
        },
        {
          title: 'What this is costing you',
          hint: 'Worth saying out loud to someone outside the pressure.',
        },
      ],
      mentorCanSee: [
        'Your goal, in your words',
        'Your LIFT Index shape and archetype',
        'Your journey points',
        'Your values',
        'What you asked them not to raise',
      ],
      mentorCannotSee: [],
      primaryActionLabel: 'Join session',
      secondaryActionLabel: 'Request a different time',
    }
  }

  const isCoach = input.audience === 'coach'
  const total = Math.max(1, (isCoach ? coachTotal : mentorTotal) || 1)
  const topics = buildTopics(input)

  return {
    audience: input.audience,
    headline: buildHeadline(input, first, goal),
    personTitle: input.leaderName,
    personSubtitle:
      [input.leaderRoleTitle, input.leaderOrgContext].filter(Boolean).join('\n') ||
      'Leader on your organisation programme',
    journeyLine: [
      journeyLabel,
      chosenPillar && pillars ? pillarName(chosenPillar) : null,
      week && totalWeeks ? `Week ${week} of ${totalWeeks}` : week ? `Week ${week}` : null,
      input.personalityType ? input.personalityType : null,
    ]
      .filter(Boolean)
      .join(' · '),
    sessionPill: isCoach
      ? `Session ${sessionNumber} of ${total}${sessionNumber === 1 ? ' · contracting' : ''}`
      : `Meet-up ${sessionNumber} of ${total}`,
    scheduledLabel:
      input.scheduledLabel ||
      (input.durationMinutes
        ? `Upcoming · ${input.durationMinutes} minutes`
        : 'No upcoming session scheduled'),
    originLine:
      input.originLine ||
      (isCoach
        ? coachTotal
          ? `${coachTotal} coaching session${coachTotal === 1 ? '' : 's'} purchased for this leader.`
          : 'Purchased session count is not set for this leader yet.'
        : 'They request. You accept or propose another time.'),
    arcLabels: isCoach ? coachArcLabels(total) : mentorMonthLabels(total, input.journeyStartDate),
    arcCurrentIndex: Math.min(sessionNumber - 1, total - 1),
    arcNote: isCoach
      ? total <= 1
        ? 'Single-session purchase: contract and commitment only.'
        : `Coaching arc across ${total} purchased sessions.`
      : journeyLabel
        ? `One meet-up per month across their ${journeyLabel}. They request, you accept.`
        : 'One meet-up per month. They request, you accept.',
    pillars,
    chosenPillar,
    gapPillar,
    showScores: Boolean(pillars),
    liftPending: !pillars,
    tendencies: personalityTendencies,
    costs: personalityCosts,
    values: input.coreValues ?? [],
    offLimits: input.offLimits?.trim() || null,
    goalVerbatim: goal,
    archetypeLabel: input.archetype?.trim() || null,
    totalPointsLabel:
      typeof input.totalPoints === 'number' && Number.isFinite(input.totalPoints)
        ? `${Math.round(input.totalPoints).toLocaleString()} pts`
        : null,
    challengeChips: [input.challengePreference]
      .filter((v): v is string => Boolean(v && v.trim())),
    topics,
    opener:
      sessionNumber === 1
        ? {
            label: 'Opening question · first meeting only',
            quote: goal
              ? `What would make real progress on "${goal}" undeniable to someone who was not in the room?`
              : coursesFirstQuestion(input, isCoach),
            note: input.challengePreference
              ? `They asked for: ${input.challengePreference}.`
              : goal
                ? 'Open from their written goal.'
                : 'Open by contracting what success looks like.',
          }
        : null,
    stanceReminders: isCoach
      ? [
          'Contract before you explore. Get the outcome to something observable by someone other than them.',
          'Roughly eighty percent questions. If you give a practitioner view, say so, then step back.',
          'If a Capstone artifact overlaps this topic, coach the thinking. Do not edit the draft.',
        ]
      : [],
    bringItems: [],
    mentorCanSee: [],
    mentorCannotSee: [],
    primaryActionLabel: isCoach ? 'Mark session complete' : 'Mark meet-up complete',
    secondaryActionLabel: isCoach ? 'Suggest different areas' : 'Suggest different topics',
  }
}

const coursesFirstQuestion = (input: SessionPrepInput, isCoach: boolean): string => {
  const course = (input.courseTitles || []).map((t) => t.trim()).filter(Boolean)[0]
  if (course) {
    return isCoach
      ? `What would have to be true for ${course} to move this week?`
      : `Where has ${course} stalled, and who noticed?`
  }
  return isCoach
    ? 'By the end of this hour, what should someone else be able to see?'
    : 'What is the question you have been carrying that you have not had anyone to ask?'
}
