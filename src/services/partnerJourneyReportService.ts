import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'
import { ageRangeLabel } from '@/config/demographics'
import { getJourneyLabel } from '@/utils/journeyType'
import { hasCompletedJourney } from '@/utils/completion'
import type { PartnerOrganization, PartnerUser } from '@/hooks/partner/usePartnerAdminData'

export interface JourneyReportLearnerRow {
  id: string
  name: string
  email: string
  totalPoints: number
  completed: boolean
  status: string
  membershipTier: string
  role: string
  ageRange: string
  gender: string
  personalityType: string
  currentWeek: number
}

export interface JourneyReportBucket {
  label: string
  count: number
  percent: number
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
  learners: JourneyReportLearnerRow[]
}

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

const formatGender = (value?: string): string => {
  if (!value) return 'Unknown'
  return GENDER_LABELS[value] ?? value
}

const formatAge = (value?: string): string => {
  if (!value) return 'Unknown'
  return ageRangeLabel(value) || value
}

const formatRole = (user: PartnerUser): string => {
  if (user.membershipTier === 'free') return 'Free learner'
  if (user.membershipTier === 'paid') return 'Paid member'
  if (typeof user.role === 'string' && user.role) return user.role.replace(/_/g, ' ')
  return 'Learner'
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

export const buildPartnerJourneyReportData = (
  org: Pick<PartnerOrganization, 'name' | 'code' | 'journeyType' | 'cohortStartDate'>,
  users: PartnerUser[],
): PartnerJourneyReportData => {
  const journeyType =
    org.journeyType && JOURNEY_META[org.journeyType as JourneyType]
      ? (org.journeyType as JourneyType)
      : null
  const passMark = journeyType ? JOURNEY_META[journeyType].passMarkPoints : 0
  const startDate = parseDate(org.cohortStartDate)
  const totalDays = journeyType ? JOURNEY_META[journeyType].weeks * 7 : 0
  const endDate =
    startDate && totalDays > 0
      ? new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000)
      : null
  const isCalendarComplete = Boolean(
    endDate && Date.now() >= endDate.getTime(),
  )

  const learners: JourneyReportLearnerRow[] = users
    .map((user) => {
      const totalPoints = user.totalPoints ?? 0
      const completed = journeyType
        ? hasCompletedJourney(totalPoints, journeyType)
        : passMark > 0
          ? totalPoints >= passMark
          : false
      return {
        id: user.id,
        name: user.fullName || user.name || 'Learner',
        email: user.email || '-',
        totalPoints,
        completed,
        status: user.status,
        membershipTier: user.membershipTier === 'free' ? 'Free' : 'Paid',
        role: formatRole(user),
        ageRange: formatAge(user.ageRange),
        gender: formatGender(user.gender),
        personalityType: user.personalityType || '—',
        currentWeek: user.currentWeek || 0,
      }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name))

  const points = learners.map((row) => row.totalPoints)
  const completedCount = learners.filter((row) => row.completed).length
  const avgPoints = points.length
    ? Math.round(points.reduce((sum, value) => sum + value, 0) / points.length)
    : 0

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
    learners,
  }
}
