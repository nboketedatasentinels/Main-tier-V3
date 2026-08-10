import { supabase } from '@/services/supabase'
import { JOURNEY_META, getActivitiesForJourney, type JourneyType } from '@/config/pointsConfig'
import { ROLE_OPTIONS } from '@/config/liftAssessment'
import { ageRangeLabel } from '@/config/demographics'
import { PERSONALITY_TYPES } from '@/config/personality-data'
import { getJourneyLabel } from '@/utils/journeyType'
import { hasCompletedJourney } from '@/utils/completion'
import type { PartnerOrganization, PartnerUser } from '@/hooks/partner/usePartnerAdminData'

export interface EngagementMetric {
  id: string
  label: string
  done: number
  max: number
}

export interface JourneyReportLearnerRow {
  id: string
  name: string
  initials: string
  email: string
  totalPoints: number
  maxPoints: number
  passMark: number
  growthRank: number
  completed: boolean
  status: string
  membershipTier: string
  role: string
  ageRange: string
  gender: string
  personalityType: string
  personalityLabel: string
  coreValues: string[]
  currentWeek: number
  engagement: EngagementMetric[]
}

export interface JourneyReportBucket {
  label: string
  count: number
  percent: number
}

export interface JourneyReportEngagementSummary {
  id: string
  label: string
  totalDone: number
  totalMax: number
  learnersWithAny: number
}

export interface PartnerJourneyReportData {
  orgName: string
  orgCode: string
  journeyType: JourneyType | null
  journeyLabel: string
  cohortStartDate: Date | null
  cohortEndDate: Date | null
  generatedAt: Date
  isCalendarComplete: boolean
  passMark: number
  maxPossiblePoints: number
  totals: {
    learners: number
    completed: number
    incomplete: number
    active: number
    paused: number
    onboarding: number
    avgPoints: number
    medianPoints: number
    maxPoints: number
    completionRate: number
  }
  topScorer: JourneyReportLearnerRow | null
  topScorers: JourneyReportLearnerRow[]
  ageBreakdown: JourneyReportBucket[]
  genderBreakdown: JourneyReportBucket[]
  roleBreakdown: JourneyReportBucket[]
  personalityBreakdown: JourneyReportBucket[]
  engagementSummary: JourneyReportEngagementSummary[]
  learners: JourneyReportLearnerRow[]
}

/** Activity rows shown on the Engagement card (matches partner report mock). */
const ENGAGEMENT_ACTIVITY_DEFS: { id: string; label: string; aliases: string[] }[] = [
  { id: 'weekly_session', label: 'Live sessions', aliases: ['weekly_session'] },
  { id: 'lift_module', label: 'Course modules', aliases: ['lift_module'] },
  { id: 'webinar_workbook', label: 'Webinar', aliases: ['webinar_workbook', 'webinar'] },
  { id: 'impact_log', label: 'Impact logs', aliases: ['impact_log'] },
  { id: 'capstone', label: 'Capstone', aliases: ['capstone'] },
  { id: 'peer_to_peer', label: 'Peer-to-peer', aliases: ['peer_to_peer'] },
]

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Non-binary',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
  woman: 'Woman',
  man: 'Man',
  prefer_not: 'Prefer not to say',
}

const PAGE_SIZE = 1000
const UID_BATCH = 200

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

const formatGender = (value?: string): string => {
  if (!value) return 'Unknown'
  return GENDER_LABELS[value] ?? value
}

const formatAge = (value?: string): string => {
  if (!value) return 'Unknown'
  const label = ageRangeLabel(value)
  if (!label) return value
  return label.startsWith('Under') || label.startsWith('Prefer') ? label : `Age ${label}`
}

const formatJobRole = (user: PartnerUser): string => {
  const raw =
    (typeof user.jobRole === 'string' && user.jobRole) ||
    (typeof (user as { liftRole?: string }).liftRole === 'string'
      ? (user as { liftRole?: string }).liftRole
      : undefined)
  if (raw) {
    return ROLE_OPTIONS.find((option) => option.value === raw)?.label ?? raw.replace(/_/g, ' ')
  }
  if (user.membershipTier === 'free') return 'Free learner'
  if (user.membershipTier === 'paid') return 'Paid member'
  return 'Learner'
}

const resolvePersonalityLabel = (type?: string): string => {
  if (!type) return 'Not completed'
  const match = PERSONALITY_TYPES.find((pt) => pt.type === type)
  return match ? `${match.type} - ${match.name}` : type
}

const initialsFor = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const median = (values: number[]): number => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  }
  return sorted[mid]
}

const toBuckets = (values: string[]): JourneyReportBucket[] => {
  const counts = new Map<string, number>()
  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })
  const total = values.length || 1
  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const engagementTargetsForJourney = (
  journeyType: JourneyType | null,
): { id: string; label: string; aliases: string[]; max: number }[] => {
  const defs = journeyType ? getActivitiesForJourney(journeyType) : []
  const byId = new Map<string, number>(
    defs.map((def) => [def.id, def.activityPolicy?.maxTotal ?? 0]),
  )
  return ENGAGEMENT_ACTIVITY_DEFS.map((metric) => ({
    ...metric,
    max: byId.get(metric.id) ?? 0,
  }))
}

const normalizeActivityId = (raw: string): string => {
  const id = raw.trim().toLowerCase()
  for (const metric of ENGAGEMENT_ACTIVITY_DEFS) {
    if (metric.aliases.some((alias) => id === alias || id.startsWith(`${alias}_`))) {
      return metric.id
    }
  }
  return id
}

/** Count positive ledger claims per user/activity for engagement meters. */
const fetchActivityClaimCounts = async (
  userIds: string[],
): Promise<Record<string, Record<string, number>>> => {
  const counts: Record<string, Record<string, number>> = {}
  userIds.forEach((uid) => {
    counts[uid] = {}
  })
  if (!userIds.length) return counts

  for (const batch of chunk(userIds, UID_BATCH)) {
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('points_ledger')
        .select('uid, activity_id, points')
        .in('uid', batch)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      const page = (data ?? []) as Array<{
        uid: string | null
        activity_id: string | null
        points: number | null
      }>
      page.forEach((row) => {
        if (!row.uid || !row.activity_id) return
        const points = typeof row.points === 'number' ? row.points : 0
        if (points <= 0) return
        const activityId = normalizeActivityId(row.activity_id)
        const userCounts = counts[row.uid] ?? (counts[row.uid] = {})
        userCounts[activityId] = (userCounts[activityId] ?? 0) + 1
      })
      if (page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  return counts
}

export const buildPartnerJourneyReportData = async (
  org: Pick<PartnerOrganization, 'name' | 'code' | 'journeyType' | 'cohortStartDate'>,
  users: PartnerUser[],
): Promise<PartnerJourneyReportData> => {
  const journeyType =
    org.journeyType && JOURNEY_META[org.journeyType as JourneyType]
      ? (org.journeyType as JourneyType)
      : null
  const passMark = journeyType ? JOURNEY_META[journeyType].passMarkPoints : 0
  const maxPossiblePoints = journeyType ? JOURNEY_META[journeyType].maxPossiblePoints : 0
  const startDate = parseDate(org.cohortStartDate)
  const totalDays = journeyType ? JOURNEY_META[journeyType].weeks * 7 : 0
  const endDate =
    startDate && totalDays > 0
      ? new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000)
      : null
  const isCalendarComplete = Boolean(endDate && Date.now() >= endDate.getTime())
  const engagementTargets = engagementTargetsForJourney(journeyType)

  let claimCounts: Record<string, Record<string, number>> = {}
  try {
    claimCounts = await fetchActivityClaimCounts(users.map((user) => user.id))
  } catch (error) {
    console.warn('[partnerJourneyReport] Unable to load activity claims', error)
  }

  const learners: JourneyReportLearnerRow[] = users
    .map((user) => {
      const totalPoints = user.totalPoints ?? 0
      const completed = journeyType
        ? hasCompletedJourney(totalPoints, journeyType)
        : passMark > 0
          ? totalPoints >= passMark
          : false
      const userClaims = claimCounts[user.id] ?? {}
      const engagement = engagementTargets.map((metric) => ({
        id: metric.id,
        label: metric.label,
        done: Math.min(userClaims[metric.id] ?? 0, metric.max || Number.MAX_SAFE_INTEGER),
        max: metric.max,
      }))
      const name = user.fullName || user.name || 'Learner'
      return {
        id: user.id,
        name,
        initials: initialsFor(name),
        email: user.email || '-',
        totalPoints,
        maxPoints: maxPossiblePoints,
        passMark,
        growthRank: 0,
        completed,
        status: user.status,
        membershipTier: user.membershipTier === 'free' ? 'Free' : 'Paid',
        role: formatJobRole(user),
        ageRange: formatAge(user.ageRange),
        gender: formatGender(user.gender),
        personalityType: user.personalityType || '',
        personalityLabel: resolvePersonalityLabel(user.personalityType),
        coreValues: Array.isArray(user.coreValues) ? user.coreValues.slice(0, 5) : [],
        currentWeek: user.currentWeek || 0,
        engagement,
      }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, growthRank: index + 1 }))

  const points = learners.map((row) => row.totalPoints)
  const completedCount = learners.filter((row) => row.completed).length
  const avgPoints = points.length
    ? Math.round(points.reduce((sum, value) => sum + value, 0) / points.length)
    : 0

  const engagementSummary: JourneyReportEngagementSummary[] = engagementTargets.map((metric) => {
    const totalDone = learners.reduce((sum, learner) => {
      const match = learner.engagement.find((item) => item.id === metric.id)
      return sum + (match?.done ?? 0)
    }, 0)
    const totalMax = metric.max * learners.length
    const learnersWithAny = learners.filter((learner) =>
      learner.engagement.some((item) => item.id === metric.id && item.done > 0),
    ).length
    return {
      id: metric.id,
      label: metric.label,
      totalDone,
      totalMax,
      learnersWithAny,
    }
  })

  return {
    orgName: org.name || org.code || 'Organization',
    orgCode: org.code || '',
    journeyType,
    journeyLabel: journeyType ? getJourneyLabel(journeyType) : 'Journey not configured',
    cohortStartDate: startDate,
    cohortEndDate: endDate,
    generatedAt: new Date(),
    isCalendarComplete,
    passMark,
    maxPossiblePoints,
    totals: {
      learners: learners.length,
      completed: completedCount,
      incomplete: Math.max(0, learners.length - completedCount),
      active: learners.filter((row) => row.status === 'Active').length,
      paused: learners.filter((row) => row.status === 'Paused').length,
      onboarding: learners.filter((row) => row.status === 'Onboarding').length,
      avgPoints,
      medianPoints: median(points),
      maxPoints: points[0] ?? 0,
      completionRate: learners.length
        ? Math.round((completedCount / learners.length) * 100)
        : 0,
    },
    topScorer: learners[0] ?? null,
    topScorers: learners.slice(0, 10),
    ageBreakdown: toBuckets(learners.map((row) => row.ageRange)),
    genderBreakdown: toBuckets(learners.map((row) => row.gender)),
    roleBreakdown: toBuckets(learners.map((row) => row.role)),
    personalityBreakdown: toBuckets(learners.map((row) => row.personalityLabel)),
    engagementSummary,
    learners,
  }
}
