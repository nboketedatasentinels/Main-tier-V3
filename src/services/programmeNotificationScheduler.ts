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
  checkTransformationalLeadership4wEligibility,
  fireProgrammeNotification,
  pickProgressCheckVariant,
} from './programmeNotificationService'
import { fetchUserProfileById } from './userProfileService'
import { TRANSFORMATIONAL_LEADERSHIP_NOTIFICATIONS } from '@/config/transformationalLeadershipNotifications'
import type { ProgrammeNotificationTemplate } from '@/types/programmeNotifications'

const PROGRAMME_TOTAL_DAYS = 28
const FIRING_DAYS_OF_WEEK = new Set<number>([1, 2, 3, 5])

export interface ProgrammeDayInfo {
  week: 1 | 2 | 3 | 4
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7
  dayOfJourney: number
}

export const computeProgrammeDay = (
  journeyStartIso: string,
  now: Date = new Date(),
): ProgrammeDayInfo | null => {
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

  const week = Math.ceil(dayOfJourney / 7) as 1 | 2 | 3 | 4
  const dayOfWeek = (((dayOfJourney - 1) % 7) + 1) as ProgrammeDayInfo['dayOfWeek']
  return { week, dayOfWeek, dayOfJourney }
}

export interface DueTemplate {
  template: ProgrammeNotificationTemplate
  dedupeKey: string
}

const buildDedupeKey = (template: ProgrammeNotificationTemplate): string =>
  `w${template.week}_d${template.day}_${template.contentKind}`

export const listDueInAppTemplates = (params: {
  dayOfJourney: number
  currentPoints: number
}): DueTemplate[] => {
  const effectiveDay = Math.min(params.dayOfJourney, PROGRAMME_TOTAL_DAYS)
  const result: DueTemplate[] = []

  for (let d = 1; d <= effectiveDay; d++) {
    const dayOfWeek = ((d - 1) % 7) + 1
    if (!FIRING_DAYS_OF_WEEK.has(dayOfWeek)) continue

    const week = Math.ceil(d / 7) as 1 | 2 | 3 | 4
    const templatesForDay = TRANSFORMATIONAL_LEADERSHIP_NOTIFICATIONS.filter(
      (t) =>
        t.isActive &&
        t.channel === 'in_app' &&
        t.week === week &&
        t.day === dayOfWeek,
    )

    for (const template of templatesForDay) {
      if (template.contentKind === 'progress_check') {
        const targetVariant = pickProgressCheckVariant({
          week: template.week,
          day: template.day as 2 | 5,
          currentPoints: params.currentPoints,
        })
        if (template.progressVariant !== targetVariant) continue
      }
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
      week?: number
      day?: number
      contentKind?: string
    }
    if (md.week && md.day && md.contentKind) {
      keys.add(`w${md.week}_d${md.day}_${md.contentKind}`)
    }
  }
  return keys
}

export interface ProgrammeSyncDiagnostics {
  journeyType?: string
  journeyStartDateRaw?: unknown
  journeyStartDateParsed?: string
  journeyStartDateSelfHealed?: boolean
  membershipStatus?: string
  organizationId?: string | null
  companyId?: string | null
  companyCode?: string | null
  totalPoints?: number
  dayOfJourney?: number
  week?: number
  dayOfWeek?: number
  dueTemplateCount?: number
  dueTemplateKeys?: string[]
  firedDedupeKeyCount?: number
}

export interface ProgrammeSyncResult {
  attempted: number
  fired: number
  skipped: number
  reason?: string
  diagnostics: ProgrammeSyncDiagnostics
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

export const syncProgrammeNotificationsForUser = async (
  userId: string,
): Promise<ProgrammeSyncResult> => {
  const diagnostics: ProgrammeSyncDiagnostics = {}
  const profile = await fetchUserProfileById(userId)
  if (!profile) {
    return { attempted: 0, fired: 0, skipped: 0, reason: 'profile not found', diagnostics }
  }

  diagnostics.journeyType = profile.journeyType as unknown as string
  diagnostics.journeyStartDateRaw = profile.journeyStartDate
  diagnostics.membershipStatus = profile.membershipStatus
  diagnostics.organizationId = profile.organizationId ?? null
  diagnostics.companyId = profile.companyId ?? null
  diagnostics.companyCode = profile.companyCode ?? null
  diagnostics.totalPoints = profile.totalPoints ?? 0

  const eligibility = checkTransformationalLeadership4wEligibility(profile)
  if (!eligibility.eligible) {
    return { attempted: 0, fired: 0, skipped: 0, reason: eligibility.reason, diagnostics }
  }

  let parsedStart = toIsoIfTimestamp(profile.journeyStartDate)
  diagnostics.journeyStartDateParsed = parsedStart
  if (!parsedStart) {
    parsedStart = await selfHealJourneyStartDate(userId)
    diagnostics.journeyStartDateParsed = parsedStart
    diagnostics.journeyStartDateSelfHealed = true
  }

  const dayInfo = computeProgrammeDay(parsedStart)
  if (!dayInfo) {
    return {
      attempted: 0,
      fired: 0,
      skipped: 0,
      reason: `programme not active — journeyStartDate=${parsedStart}, now=${new Date().toISOString()}`,
      diagnostics,
    }
  }
  diagnostics.dayOfJourney = dayInfo.dayOfJourney
  diagnostics.week = dayInfo.week
  diagnostics.dayOfWeek = dayInfo.dayOfWeek

  const currentPoints = profile.totalPoints ?? 0
  const dueTemplates = listDueInAppTemplates({
    dayOfJourney: dayInfo.dayOfJourney,
    currentPoints,
  })
  diagnostics.dueTemplateCount = dueTemplates.length
  diagnostics.dueTemplateKeys = dueTemplates.map((d) => d.template.key)

  if (dueTemplates.length === 0) {
    return { attempted: 0, fired: 0, skipped: 0, reason: 'no templates due yet', diagnostics }
  }

  const firedKeys = await fetchFiredDedupeKeys(userId)
  diagnostics.firedDedupeKeyCount = firedKeys.size

  let fired = 0
  let skipped = 0
  for (const { template, dedupeKey } of dueTemplates) {
    if (firedKeys.has(dedupeKey)) {
      skipped++
      continue
    }

    const result = await fireProgrammeNotification({
      userId,
      templateKey: template.key,
      currentPoints,
    })

    if (result.sent) {
      fired++
      firedKeys.add(dedupeKey)
    } else {
      skipped++
      console.warn(
        `[programmeScheduler] ${template.key} skipped: ${result.reason ?? 'unknown'}`,
      )
    }
  }

  return { attempted: dueTemplates.length, fired, skipped, diagnostics }
}
