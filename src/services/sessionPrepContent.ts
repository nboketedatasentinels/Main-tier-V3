/**
 * Session Prep content builder (mentor / coach / leader).
 * Deterministic, context-aware copy - not a live LLM call.
 * Matches the product brief: same profile, three readings.
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
  currentWeek?: number | null
  goals?: string | null
  offLimits?: string | null
  challengePreference?: string | null
  pillars?: Record<PillarKey, number> | null
  chosenPillar?: PillarKey | null
  windowStatus?: 'on_track' | 'warning' | 'alert' | 'recovery' | null
  sessionNumber?: number | null
  sessionTotal?: number | null
  scheduledLabel?: string | null
  originLine?: string | null
  purchasedCoachSessions?: number | null
  /** Programme course titles - used for AI conversation suggestions. */
  courseTitles?: string[] | null
  /** Minutes for the upcoming session when known from a live booking/slot. */
  durationMinutes?: number | null
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
  tendencies: string[]
  costs: string[]
  values: string[]
  offLimits: string | null
  goalVerbatim: string | null
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

const mentorMonthLabels = (count: number): string[] => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const start = new Date().getMonth()
  return Array.from({ length: count }, (_, i) => months[(start + i) % 12])
}

const isPersonalityType = (value: string | null | undefined): value is PersonalityType =>
  Boolean(value && PERSONALITY_TYPES.some((p) => p.type === value))

const tendencyLines = (name: string, type?: string | null): string[] => {
  if (!isPersonalityType(type)) {
    return [
      `${name}'s working style is still forming. Lead with curiosity about how they decide under pressure.`,
      'Watch what they protect first: the argument, the relationship, or the timeline.',
    ]
  }
  const map: Partial<Record<PersonalityType, string[]>> = {
    INTJ: [
      'Often has the full argument built before speaking, so their thinking is usually further along than the room realizes.',
      'Tends to trust evidence over consensus and holds a position when the numbers support it.',
      'Values mastery, so they are likely to go deeper on a problem than the role strictly requires.',
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
  return map[type] ?? [
    `${name} shows ${PERSONALITY_TYPES.find((p) => p.type === type)?.name ?? type} patterns in how they prepare and decide.`,
    'Match their tempo first, then stretch the blind spot.',
  ]
}

const costLines = (name: string, type?: string | null): string[] => {
  if (!isPersonalityType(type)) {
    return [`Without a clear preference map, watch where ${name} over-owns versus under-asks.`]
  }
  const map: Partial<Record<PersonalityType, string[]>> = {
    INTJ: [
      'Arriving with a finished argument can read as arriving with the decision already made.',
      'Depth on the technical case may be crowding out the work of bringing people with them.',
    ],
    ENTJ: [
      'Speed can leave quieter stakeholders unconvinced even when the case is strong.',
    ],
    INTP: [
      'Exploring every angle can delay a decision the room already needed.',
    ],
  }
  return map[type] ?? [`The same strength that helps ${name} can stall alignment if left unnamed.`]
}

const buildTopics = (input: SessionPrepInput): SessionPrepTopic[] => {
  const name = input.leaderName.split(' ')[0] || input.leaderName
  const gap = input.pillars ? resolveLowestPillar(input.pillars) : null
  const chosen =
    input.chosenPillar || (input.pillars ? resolveHighestPillar(input.pillars) : null)
  const goal = (input.goals || '').trim()
  const isCoach = input.audience === 'coach'
  const sayLabel = isCoach ? ('Ask this' as const) : ('Say this out loud' as const)

  const topics: SessionPrepTopic[] = []

  topics.push({
    pillarLabel: chosen ? pillarName(chosen) : 'Direction',
    signalSource: goal ? 'her stated goal\ncurrent situation' : 'stated direction',
    title: isCoach
      ? 'Separate the two goals in one sentence'
      : 'Getting a stalled program moving again',
    why: goal
      ? isCoach
        ? `"${goal}" may be two outcomes. Contracting is cleaner if ${name} picks which one matters most.`
        : `${name} wants progress on: "${goal}". You have likely been in a room like this.`
      : `${name} has not written a goal yet. Use the session to make the desired outcome observable.`,
    sayAloud: isCoach
      ? 'If approval came through but you still had to defend every line, would that be a win?'
      : 'What do you think that committee said about your program after you left the room?',
    sayLabel,
  })

  if (gap && chosen && gap !== chosen) {
    topics.push({
      pillarLabel: pillarName(gap),
      signalSource: 'capability gap\nintent tension',
      title: isCoach ? 'Who the stall is working for' : 'The part of the case that is not a case',
      why: isCoach
        ? `The shape shows where ${name} is strong and where they are not, and they have chosen to work on a pillar they are already strong in. Programs rarely stall for the reason given in the meeting.`
        : `Look at the shape. ${name} is strongest on one side and weakest on ${pillarName(gap)}, and they have chosen to work on a pillar they are already good at. The gap is often the real stall.`,
      sayAloud: isCoach
        ? 'Who is more comfortable with this program stalled than moving?'
        : 'Who in that room needed convincing before the meeting, and did anyone do that work?',
      sayLabel,
    })
  }

  if (chosen) {
    topics.push({
      pillarLabel: pillarName('L'),
      signalSource: goal ? 'their own words\nwants to be pushed' : 'leading self',
      title: isCoach ? 'The untested assumption' : 'Defending it line by line',
      why: isCoach
        ? `${name} may be carrying an assumption about how much authority they are given. Test whether there is evidence for it.`
        : goal
          ? `Their own language around the goal suggests the issue may be less about the case and more about how much authority they are granted before they open their mouth.`
          : `Ask whether the room trusts the case, or trusts them with the case.`,
      sayAloud: isCoach
        ? 'What are you assuming about how they see you that you have never tested?'
        : 'Is it the case they do not trust, or is it you?',
      sayLabel,
    })
  }

  if (input.windowStatus === 'warning' || input.windowStatus === 'alert') {
    topics.push({
      pillarLabel: 'Capacity',
      signalSource: 'engagement pattern',
      title: isCoach ? 'What is being carried' : 'What this is costing her',
      why: isCoach
        ? `A Journey and live work pressure at the same time. Worth one question, not a whole session, unless ${name} opens it.`
        : `They are into the Journey with live scrutiny. Worth finding out what has quietly been dropped.`,
      sayAloud: isCoach
        ? 'What are you carrying that nobody has asked you about?'
        : 'What have you stopped doing since this started?',
      sayLabel,
    })
  }

  const courses = (input.courseTitles || []).map((t) => t.trim()).filter(Boolean)
  if (courses.length) {
    const primary = courses[0]
    topics.unshift({
      pillarLabel: 'Programme',
      signalSource: 'assigned courses',
      title: `Getting ${primary} moving again`,
      why: `${name} is on ${courses.slice(0, 3).join(', ')}. Suggest conversation points from the live programme - they do not have to use them.`,
      sayAloud: `Where has ${primary} stalled under scrutiny, and what would restart it?`,
      sayLabel,
    })
    if (courses.some((c) => /ai|data|digital/i.test(c))) {
      topics.splice(1, 0, {
        pillarLabel: 'Innovation',
        signalSource: 'course context',
        title: 'The parts of AI-ready teams they are avoiding',
        why: `Their programme includes digital / AI / data work. Test whether the block is skill, politics, or authority.`,
        sayAloud: 'What part of becoming AI-ready is your team pretending is already done?',
        sayLabel,
      })
    }
  }

  return topics.slice(0, 4)
}

export const buildSessionPrepModel = (input: SessionPrepInput): SessionPrepModel => {
  const first = input.leaderName.split(' ')[0] || input.leaderName
  const journeyType = input.journeyType && isJourneyType(input.journeyType) ? input.journeyType : null
  const journeyLabel = journeyType ? getJourneyLabel(journeyType) : 'Journey'
  const totalWeeks = journeyType ? JOURNEY_META[journeyType].weeks : null
  const week = input.currentWeek ?? null
  const pillars = input.pillars ?? null
  const gapPillar = pillars ? resolveLowestPillar(pillars) : null
  const chosenPillar =
    input.chosenPillar || (pillars ? resolveHighestPillar(pillars) : null)

  const mentorTotal = input.sessionTotal ?? mentorMeetupCountForJourney(journeyType)
  const coachTotal = input.purchasedCoachSessions ?? input.sessionTotal ?? 5
  const sessionNumber = Math.max(1, input.sessionNumber ?? 1)

  if (input.audience === 'leader') {
    const mentorFirst = (input.mentorName || 'your mentor').split(' ')[0]
    return {
      audience: 'leader',
      headline: '',
      personTitle: input.mentorName || 'Your mentor',
      personSubtitle: input.mentorBio || 'Assigned mentor on your organisation programme',
      journeyLine: input.mentorBio
        ? ''
        : 'They can see your goal, your LIFT shape, and what you asked them not to raise.',
      sessionPill: `Meet-up ${sessionNumber} of ${mentorTotal}`,
      scheduledLabel: input.scheduledLabel || 'Upcoming meet-up · 60 minutes',
      originLine: input.originLine || 'You request these. If you do not request one, it does not happen.',
      arcLabels: mentorMonthLabels(mentorTotal),
      arcCurrentIndex: Math.min(sessionNumber - 1, mentorTotal - 1),
      arcNote: 'One a month, yours to request. If you do not request one, it does not happen.',
      pillars,
      chosenPillar,
      gapPillar,
      showScores: true,
      tendencies: [],
      costs: [],
      values: input.coreValues ?? [],
      offLimits: input.offLimits?.trim() || null,
      goalVerbatim: input.goals?.trim() || null,
      challengeChips: [],
      topics: [],
      opener: {
        label: 'If you only ask them one thing',
        quote: 'What did it cost you to keep going when yours was paused?',
        note: 'First meetings go better when someone asks a real question early.',
      },
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
        'Your LIFT Index shape',
        'Your values',
        'The topic suggestions',
        'What you asked them not to raise',
      ],
      mentorCannotSee: [
        'Your points or pace',
        'Your assessment marks',
        'Your module quiz scores',
        'Anything from your coaching sessions',
      ],
      primaryActionLabel: 'Join session',
      secondaryActionLabel: 'Request a different time',
    }
  }

  const isCoach = input.audience === 'coach'
  const total = isCoach ? coachTotal : mentorTotal
  const topics = buildTopics(input)
  const goal = input.goals?.trim() || null

  const headline = isCoach
    ? goal
      ? `The stated goal is progress. The workable goal is more likely what happens in the room before the decision.`
      : `Contract first. Make the outcome observable by someone other than ${first}.`
    : goal
      ? `${first} needs to hear how someone else survived a stalled push under scrutiny, and what it cost them.`
      : `Find the real question ${first} has been carrying and has not had anyone to ask.`

  return {
    audience: input.audience,
    headline,
    personTitle: input.leaderName,
    personSubtitle:
      [input.leaderRoleTitle, input.leaderOrgContext].filter(Boolean).join('\n') ||
      'Leader on your organisation programme',
    journeyLine: [
      journeyLabel,
      chosenPillar ? pillarName(chosenPillar) : null,
      week && totalWeeks ? `Week ${week} of ${totalWeeks}` : week ? `Week ${week}` : null,
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
        ? 'Session count comes from what was purchased for this leader.'
        : 'They request. You accept or propose another time.'),
    arcLabels: isCoach ? coachArcLabels(total) : mentorMonthLabels(total),
    arcCurrentIndex: Math.min(sessionNumber - 1, total - 1),
    arcNote: isCoach
      ? total <= 1
        ? 'Single-session purchase: contract and commitment only.'
        : 'Standard coaching arc from the purchase record.'
      : `One meet-up per month across their ${journeyLabel}. They request, you accept.`,
    pillars,
    chosenPillar,
    gapPillar,
    showScores: false,
    tendencies: isCoach ? [] : tendencyLines(first, input.personalityType),
    costs: isCoach ? [] : costLines(first, input.personalityType),
    values: input.coreValues ?? [],
    offLimits: input.offLimits?.trim() || null,
    goalVerbatim: isCoach ? goal : null,
    challengeChips: isCoach
      ? [input.challengePreference].filter((v): v is string => Boolean(v && v.trim()))
      : [],
    topics,
    opener:
      !isCoach && sessionNumber === 1
        ? {
            label: 'Opening question · first meeting only',
            quote: 'What is the question you have been carrying that you have not had anyone to ask?',
            note: input.challengePreference
              ? `They asked for: ${input.challengePreference}. A real question respects that.`
              : 'First meetings go better when someone asks a real question early.',
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
