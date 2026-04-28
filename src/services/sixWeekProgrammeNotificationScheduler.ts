import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  checkSixWeekEligibility,
  fetchPillarForUser,
  fireSixWeekNotification,
} from './sixWeekProgrammeNotificationService'
import { fetchUserProfileById } from './userProfileService'
import { TRANSFORMING_BUSINESS_6W_NOTIFICATIONS } from '@/config/transformingBusiness6wNotifications'
import {
  SIX_WEEK_PROGRAMME_SLUG,
  type SixWeekDayInfo,
  type SixWeekNotificationTemplate,
  type SixWeekWeek,
} from '@/types/sixWeekProgrammeNotifications'

const PROGRAMME_TOTAL_DAYS = 42
const FIRING_DAYS_OF_WEEK = new Set<number>([1, 2, 3, 4, 5, 6])

export const computeSixWeekDay = (
  journeyStartIso: string,
  now: Date = new Date(),
): SixWeekDayInfo | null => {
  const start = new Date(journeyStartIso)
  if (Number.isNaN(start.getTime())) return null

  const startUtcMidnight = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  )
  const todayUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )
  const dayOfJourney =
    Math.floor((todayUtcMidnight - startUtcMidnight) / 86_400_000) + 1

  if (dayOfJourney < 1 || dayOfJourney > PROGRAMME_TOTAL_DAYS) return null

  const week = Math.ceil(dayOfJourney / 7) as SixWeekWeek
  const dayOfWeek = (((dayOfJourney - 1) % 7) + 1) as SixWeekDayInfo['dayOfWeek']
  return { week, dayOfWeek, dayOfJourney }
}

export interface DueSixWeekTemplate {
  template: SixWeekNotificationTemplate
  dedupeKey: string
}

const buildDedupeKey = (template: SixWeekNotificationTemplate): string =>
  `6w_${template.key}`

export const listDueSixWeekTemplates = (params: {
  dayOfJourney: number
}): DueSixWeekTemplate[] => {
  const effectiveDay = Math.min(params.dayOfJourney, PROGRAMME_TOTAL_DAYS)
  const result: DueSixWeekTemplate[] = []

  for (let d = 1; d <= effectiveDay; d++) {
    const dayOfWeek = ((d - 1) % 7) + 1
    if (!FIRING_DAYS_OF_WEEK.has(dayOfWeek)) continue

    const week = Math.ceil(d / 7) as SixWeekWeek
    const templatesForDay = TRANSFORMING_BUSINESS_6W_NOTIFICATIONS.filter(
      (t) => t.isActive && t.week === week && t.day === dayOfWeek,
    )

    for (const template of templatesForDay) {
      result.push({ template, dedupeKey: buildDedupeKey(template) })
    }
  }

  return result
}

const fetchFiredDedupeKeys = async (userId: string): Promise<Set<string>> => {
  const q = query(collection(db, 'notifications'), where('user_id', '==', userId))
  const snap = await getDocs(q)
  const keys = new Set<string>()
  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    if (data.type !== 'programme_day') continue
    const md = (data.metadata ?? {}) as {
      programme?: string
      templateKey?: string
    }
    if (md.programme === SIX_WEEK_PROGRAMME_SLUG && md.templateKey) {
      keys.add(`6w_${md.templateKey}`)
    }
  }
  return keys
}

export interface SixWeekSyncDiagnostics {
  journeyType?: string
  journeyStartDateRaw?: unknown
  journeyStartDateParsed?: string
  journeyStartDateSelfHealed?: boolean
  totalPoints?: number
  pillar?: string | null
  dayOfJourney?: number
  week?: number
  dayOfWeek?: number
  dueTemplateCount?: number
  dueTemplateKeys?: string[]
  firedDedupeKeyCount?: number
}

export interface SixWeekSyncResult {
  attempted: number
  fired: number
  skipped: number
  emailsSent: number
  pushesBuzzed: number
  reason?: string
  diagnostics: SixWeekSyncDiagnostics
}

const toIsoIfTimestamp = (value: unknown): string | undefined => {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  const maybe = value as { toDate?: () => Date; seconds?: number }
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString()
  if (typeof maybe.seconds === 'number') return new Date(maybe.seconds * 1000).toISOString()
  return undefined
}

const selfHealJourneyStartDate = async (userId: string): Promise<string> => {
  const todayIso = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    ),
  ).toISOString()
  const payload = {
    journeyStartDate: todayIso,
    currentWeek: 1,
    updatedAt: serverTimestamp(),
  }
  await Promise.allSettled([
    updateDoc(doc(db, 'profiles', userId), payload),
    updateDoc(doc(db, 'users', userId), payload),
  ])
  return todayIso
}

export const syncSixWeekNotificationsForUser = async (
  userId: string,
): Promise<SixWeekSyncResult> => {
  const diagnostics: SixWeekSyncDiagnostics = {}
  const profile = await fetchUserProfileById(userId)
  if (!profile) {
    return {
      attempted: 0,
      fired: 0,
      skipped: 0,
      emailsSent: 0,
      pushesBuzzed: 0,
      reason: 'profile not found',
      diagnostics,
    }
  }

  diagnostics.journeyType = profile.journeyType as unknown as string
  diagnostics.journeyStartDateRaw = profile.journeyStartDate
  diagnostics.totalPoints = profile.totalPoints ?? 0

  const pillar = await fetchPillarForUser(profile)
  diagnostics.pillar = pillar ?? null

  const eligibility = checkSixWeekEligibility(profile, { pillar })
  if (!eligibility.eligible) {
    return {
      attempted: 0,
      fired: 0,
      skipped: 0,
      emailsSent: 0,
      pushesBuzzed: 0,
      reason: eligibility.reason,
      diagnostics,
    }
  }

  let parsedStart = toIsoIfTimestamp(profile.journeyStartDate)
  diagnostics.journeyStartDateParsed = parsedStart
  if (!parsedStart) {
    parsedStart = await selfHealJourneyStartDate(userId)
    diagnostics.journeyStartDateParsed = parsedStart
    diagnostics.journeyStartDateSelfHealed = true
  }

  const dayInfo = computeSixWeekDay(parsedStart)
  if (!dayInfo) {
    return {
      attempted: 0,
      fired: 0,
      skipped: 0,
      emailsSent: 0,
      pushesBuzzed: 0,
      reason: `programme not active — journeyStartDate=${parsedStart}, now=${new Date().toISOString()}`,
      diagnostics,
    }
  }
  diagnostics.dayOfJourney = dayInfo.dayOfJourney
  diagnostics.week = dayInfo.week
  diagnostics.dayOfWeek = dayInfo.dayOfWeek

  const currentPoints = profile.totalPoints ?? 0
  const dueTemplates = listDueSixWeekTemplates({ dayOfJourney: dayInfo.dayOfJourney })
  diagnostics.dueTemplateCount = dueTemplates.length
  diagnostics.dueTemplateKeys = dueTemplates.map((d) => d.template.key)

  if (dueTemplates.length === 0) {
    return {
      attempted: 0,
      fired: 0,
      skipped: 0,
      emailsSent: 0,
      pushesBuzzed: 0,
      reason: 'no templates due yet',
      diagnostics,
    }
  }

  const firedKeys = await fetchFiredDedupeKeys(userId)
  diagnostics.firedDedupeKeyCount = firedKeys.size

  let fired = 0
  let skipped = 0
  let emailsSent = 0
  let pushesBuzzed = 0
  for (const { template, dedupeKey } of dueTemplates) {
    if (firedKeys.has(dedupeKey)) {
      skipped++
      continue
    }

    const result = await fireSixWeekNotification({
      userId,
      templateKey: template.key,
      currentPoints,
      pillar,
    })

    if (result.sent) {
      fired++
      if (result.emailSent) emailsSent++
      if (result.pushBuzzed) pushesBuzzed++
      firedKeys.add(dedupeKey)
    } else {
      skipped++
      console.warn(
        `[6w-scheduler] ${template.key} skipped: ${result.reason ?? 'unknown'}`,
      )
    }
  }

  return {
    attempted: dueTemplates.length,
    fired,
    skipped,
    emailsSent,
    pushesBuzzed,
    diagnostics,
  }
}
