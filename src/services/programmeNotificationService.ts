import {
  collection,
  type DocumentData,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { createInAppNotification } from './notificationService'
import { fetchUserProfileById } from './userProfileService'
import {
  TRANSFORMATIONAL_LEADERSHIP_NOTIFICATIONS,
  getProgrammeNotificationTemplate,
} from '@/config/transformationalLeadershipNotifications'
import type { UserProfile } from '@/types'
import type {
  ProgrammeChannel,
  ProgrammeContentKind,
  ProgrammeNotificationTemplate,
  ProgrammeNotificationTokens,
  ProgrammeSlug,
  ProgressCheckVariant,
} from '@/types/programmeNotifications'

const COLLECTION = 'programme_notification_templates'

const formatPoints = (points: number): string => {
  if (!Number.isFinite(points) || points < 0) return '0'
  return Math.round(points).toLocaleString('en-US')
}

export const applyProgrammeTokens = (
  body: string,
  tokens: ProgrammeNotificationTokens,
): string => {
  let result = body
  const entries = Object.entries(tokens) as Array<[keyof ProgrammeNotificationTokens, string | undefined]>
  entries.forEach(([key, value]) => {
    if (value === undefined) return
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, value)
  })
  return result
}

const mapRemoteToTemplate = (data: DocumentData): ProgrammeNotificationTemplate | null => {
  if (!data || typeof data.key !== 'string') return null
  return {
    key: data.key,
    programme: data.programme,
    week: data.week,
    day: data.day,
    contentKind: data.contentKind,
    channel: data.channel,
    progressVariant: data.progressVariant,
    title: data.title,
    messageBody: data.messageBody,
    externalUrl: data.externalUrl,
    referenceContent: data.referenceContent,
    targetAudience: data.targetAudience,
    isActive: data.isActive !== false,
  } as ProgrammeNotificationTemplate
}

export const fetchProgrammeNotificationTemplate = async (
  key: string,
): Promise<ProgrammeNotificationTemplate | null> => {
  try {
    const q = query(collection(db, COLLECTION), where('key', '==', key), limit(1))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const mapped = mapRemoteToTemplate(snap.docs[0].data())
      if (mapped) return mapped
    }
  } catch (error) {
    console.warn(`[programmeNotifications] Firestore fetch failed for ${key}, using local fallback`, error)
  }

  return getProgrammeNotificationTemplate(key) ?? null
}

export interface ProgrammeNotificationLookup {
  programme: ProgrammeSlug
  week: 1 | 2 | 3 | 4
  day: 1 | 2 | 3 | 5
  contentKind: ProgrammeContentKind
  channel: ProgrammeChannel
  progressVariant?: ProgressCheckVariant
}

export const findProgrammeNotificationTemplate = (
  lookup: ProgrammeNotificationLookup,
): ProgrammeNotificationTemplate | undefined =>
  TRANSFORMATIONAL_LEADERSHIP_NOTIFICATIONS.find(
    (template) =>
      template.programme === lookup.programme &&
      template.week === lookup.week &&
      template.day === lookup.day &&
      template.contentKind === lookup.contentKind &&
      template.channel === lookup.channel &&
      (lookup.progressVariant === undefined ||
        template.progressVariant === lookup.progressVariant),
  )

export const pickProgressCheckVariant = (params: {
  week: 1 | 2 | 3 | 4
  day: 2 | 5
  currentPoints: number
}): ProgressCheckVariant => {
  if (params.day === 2) return 'day_2'
  const { week, currentPoints } = params
  const weeklyTargets: Record<1 | 2 | 3, number> = {
    1: 2500,
    2: 5000,
    3: 7500,
  }
  if (week === 4) {
    return currentPoints >= 9000 ? 'day_5_pass' : 'day_5_no_pass'
  }
  return currentPoints >= weeklyTargets[week] ? 'day_5_on_track' : 'day_5_behind'
}

export type TransformationalLeadership4wEligibility =
  | { eligible: true }
  | { eligible: false; reason: string }

export const checkTransformationalLeadership4wEligibility = (
  profile: Pick<
    UserProfile,
    'membershipStatus' | 'organizationId' | 'companyId' | 'companyCode' | 'journeyType'
  >,
): TransformationalLeadership4wEligibility => {
  if (profile.membershipStatus === 'paid') {
    return { eligible: false, reason: 'User has paid membership status' }
  }
  if (profile.organizationId) {
    return { eligible: false, reason: 'User is linked to an organization' }
  }
  if (profile.companyId) {
    return { eligible: false, reason: 'User has a companyId' }
  }
  if (profile.companyCode) {
    return { eligible: false, reason: 'User signed up with a company code' }
  }
  if (profile.journeyType !== '4W') {
    return {
      eligible: false,
      reason: `User is on journey ${profile.journeyType}, not 4W`,
    }
  }
  return { eligible: true }
}

const deriveFirstName = (profile: UserProfile): string => {
  const trimmedFirst = profile.firstName?.trim()
  if (trimmedFirst) return trimmedFirst
  const firstFromFullName = profile.fullName?.trim().split(/\s+/)[0]
  if (firstFromFullName) return firstFromFullName
  return 'Leader'
}

export interface FireProgrammeNotificationParams {
  userId: string
  templateKey: string
  currentPoints?: number
}

export const fireProgrammeNotification = async (
  params: FireProgrammeNotificationParams,
): Promise<{ sent: boolean; reason?: string }> => {
  const profile = await fetchUserProfileById(params.userId)
  if (!profile) {
    return { sent: false, reason: `Profile not found for user ${params.userId}` }
  }

  const eligibility = checkTransformationalLeadership4wEligibility(profile)
  if (!eligibility.eligible) {
    return {
      sent: false,
      reason: `Not eligible for 4W programme notifications: ${eligibility.reason}`,
    }
  }

  const template = await fetchProgrammeNotificationTemplate(params.templateKey)
  if (!template) {
    return { sent: false, reason: `Template not found: ${params.templateKey}` }
  }
  if (!template.isActive) {
    return { sent: false, reason: `Template inactive: ${params.templateKey}` }
  }
  if (template.programme !== 'transformational-leadership-4w') {
    return {
      sent: false,
      reason: `Template ${params.templateKey} is not for the 4-Week programme`,
    }
  }

  const tokens: ProgrammeNotificationTokens = {
    firstName: deriveFirstName(profile),
    currentPoints:
      params.currentPoints !== undefined ? formatPoints(params.currentPoints) : undefined,
  }

  const personalized = applyProgrammeTokens(template.messageBody, tokens)

  await createInAppNotification({
    userId: params.userId,
    type: 'programme_day',
    title: template.title,
    message: personalized,
    metadata: {
      programme: template.programme,
      week: template.week,
      day: template.day,
      contentKind: template.contentKind,
      channel: template.channel,
      progressVariant: template.progressVariant ?? null,
      externalUrl: template.externalUrl ?? null,
      templateKey: template.key,
    },
  })

  return { sent: true }
}
