import {
  collection,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'
import { createInAppNotification } from './notificationService'
import { fetchUserProfileById } from './userProfileService'
import {
  TRANSFORMING_BUSINESS_6W_NOTIFICATIONS,
  getSixWeekNotificationTemplate,
} from '@/config/transformingBusiness6wNotifications'
import {
  SIX_WEEK_PROGRAMME_SLUG,
  type SixWeekChannel,
  type SixWeekContentKind,
  type SixWeekNotificationTemplate,
  type SixWeekNotificationTokens,
  type SixWeekProgressVariant,
  type SixWeekWeek,
  type SixWeekDay,
} from '@/types/sixWeekProgrammeNotifications'
import { isPillar, type Pillar } from '@/types/pillar'
import type { UserProfile } from '@/types'

const SUPPORTED_PILLAR: Pillar = 'transforming_business'

const TEMPLATE_COLLECTION = 'programme_notification_templates'
const EMAIL_CALLABLE_NAME = 'sendProgrammeEmail'

const formatPoints = (points: number): string => {
  if (!Number.isFinite(points) || points < 0) return '0'
  return Math.round(points).toLocaleString('en-US')
}

export const applySixWeekTokens = (
  body: string,
  tokens: SixWeekNotificationTokens,
): string => {
  let result = body
  const entries = Object.entries(tokens) as Array<
    [keyof SixWeekNotificationTokens, string | undefined]
  >
  entries.forEach(([key, value]) => {
    if (value === undefined) return
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, value)
  })
  return result
}

const mapRemoteToTemplate = (
  data: DocumentData,
): SixWeekNotificationTemplate | null => {
  if (!data || typeof data.key !== 'string') return null
  if (data.programme !== SIX_WEEK_PROGRAMME_SLUG) return null
  return {
    key: data.key,
    programme: data.programme,
    week: data.week as SixWeekWeek,
    day: data.day as SixWeekDay,
    contentKind: data.contentKind as SixWeekContentKind,
    channel: data.channel as SixWeekChannel,
    progressVariant: data.progressVariant as SixWeekProgressVariant | undefined,
    title: data.title,
    messageBody: data.messageBody,
    externalUrl: data.externalUrl,
    emailContent: data.emailContent,
    referenceContent: data.referenceContent,
    targetAudience: data.targetAudience,
    isActive: data.isActive !== false,
  }
}

export const fetchSixWeekTemplate = async (
  key: string,
): Promise<SixWeekNotificationTemplate | null> => {
  try {
    const q = query(
      collection(db, TEMPLATE_COLLECTION),
      where('key', '==', key),
      where('programme', '==', SIX_WEEK_PROGRAMME_SLUG),
      limit(1),
    )
    const snap = await getDocs(q)
    if (!snap.empty) {
      const mapped = mapRemoteToTemplate(snap.docs[0].data())
      if (mapped) return mapped
    }
  } catch (error) {
    console.warn(
      `[6w-notifications] Firestore fetch failed for ${key}, using local fallback`,
      error,
    )
  }
  return getSixWeekNotificationTemplate(key) ?? null
}

export type SixWeekEligibility =
  | { eligible: true; pillar: Pillar }
  | { eligible: false; reason: string }

export const checkSixWeekEligibility = (
  profile: Pick<UserProfile, 'journeyType'>,
  context: { pillar?: Pillar | null },
): SixWeekEligibility => {
  if (profile.journeyType !== '6W') {
    return {
      eligible: false,
      reason: `User is on journey ${profile.journeyType ?? 'unknown'}, not 6W`,
    }
  }
  if (!context.pillar) {
    return {
      eligible: false,
      reason: 'No pillar set on user organization — cannot select notification copy',
    }
  }
  if (context.pillar !== SUPPORTED_PILLAR) {
    return {
      eligible: false,
      reason: `Pillar ${context.pillar} not yet supported (only ${SUPPORTED_PILLAR} has notification copy)`,
    }
  }
  return { eligible: true, pillar: context.pillar }
}

/**
 * Reads the org doc for the user (by organizationId or companyId) and returns
 * the pillar value, if any.
 */
export const fetchPillarForUser = async (
  profile: Pick<UserProfile, 'organizationId' | 'companyId'>,
): Promise<Pillar | null> => {
  const orgId = profile.organizationId || profile.companyId
  if (!orgId) return null
  try {
    const snap = await getDoc(doc(db, 'organizations', orgId))
    if (!snap.exists()) return null
    const value = snap.data()?.pillar
    return isPillar(value) ? value : null
  } catch (err) {
    console.warn('[6w-notifications] failed to read org pillar', err)
    return null
  }
}

const deriveFirstName = (profile: UserProfile): string => {
  const trimmedFirst = profile.firstName?.trim()
  if (trimmedFirst) return trimmedFirst
  const firstFromFullName = profile.fullName?.trim().split(/\s+/)[0]
  if (firstFromFullName) return firstFromFullName
  return 'Leader'
}

const isBrowserEnvironment = (): boolean =>
  typeof window !== 'undefined' && typeof Notification !== 'undefined'

const tryBrowserNotification = (title: string, body: string): boolean => {
  if (!isBrowserEnvironment()) return false
  try {
    if (Notification.permission !== 'granted') return false
    new Notification(title, {
      body,
      icon: '/t4.png',
      tag: `t4l-6w-${title}`,
    })
    return true
  } catch (err) {
    console.warn('[6w-notifications] browser Notification failed', err)
    return false
  }
}

interface SendProgrammeEmailPayload {
  to: string
  recipientName: string
  subject: string
  preview: string
  bodyHtml: string
  bodyText: string
  programme: string
  templateKey: string
}

const callSendProgrammeEmail = async (
  payload: SendProgrammeEmailPayload,
): Promise<{ success: boolean; messageId?: string }> => {
  const callable = httpsCallable<
    SendProgrammeEmailPayload,
    { success: boolean; messageId?: string }
  >(functions, EMAIL_CALLABLE_NAME)
  const res = await callable(payload)
  return res.data
}

export interface FireSixWeekParams {
  userId: string
  templateKey: string
  currentPoints?: number
  /**
   * If supplied, skips the per-fire org pillar lookup. Pass this when the
   * scheduler has already resolved pillar once for the user.
   */
  pillar?: Pillar | null
}

export interface FireSixWeekResult {
  sent: boolean
  reason?: string
  channelDelivered?: SixWeekChannel
  emailSent?: boolean
  pushBuzzed?: boolean
}

export const fireSixWeekNotification = async (
  params: FireSixWeekParams,
): Promise<FireSixWeekResult> => {
  const profile = await fetchUserProfileById(params.userId)
  if (!profile) {
    return { sent: false, reason: `Profile not found for user ${params.userId}` }
  }

  const pillar = params.pillar !== undefined ? params.pillar : await fetchPillarForUser(profile)
  const eligibility = checkSixWeekEligibility(profile, { pillar })
  if (!eligibility.eligible) {
    return {
      sent: false,
      reason: `Not eligible for 6W programme notifications: ${eligibility.reason}`,
    }
  }

  const template = await fetchSixWeekTemplate(params.templateKey)
  if (!template) {
    return { sent: false, reason: `Template not found: ${params.templateKey}` }
  }
  if (!template.isActive) {
    return { sent: false, reason: `Template inactive: ${params.templateKey}` }
  }
  if (template.programme !== SIX_WEEK_PROGRAMME_SLUG) {
    return {
      sent: false,
      reason: `Template ${params.templateKey} is not for the 6-Week programme`,
    }
  }

  const tokens: SixWeekNotificationTokens = {
    firstName: deriveFirstName(profile),
    currentPoints:
      params.currentPoints !== undefined ? formatPoints(params.currentPoints) : undefined,
  }

  const personalizedTitle = applySixWeekTokens(template.title, tokens)
  const personalizedBody = applySixWeekTokens(template.messageBody, tokens)

  const sharedMetadata = {
    programme: template.programme,
    week: template.week,
    day: template.day,
    contentKind: template.contentKind,
    channel: template.channel,
    progressVariant: template.progressVariant ?? null,
    externalUrl: template.externalUrl ?? null,
    templateKey: template.key,
  }

  let emailSent = false
  let pushBuzzed = false

  if (template.channel === 'email') {
    if (!template.emailContent) {
      return {
        sent: false,
        reason: `Template ${params.templateKey} is on email channel but has no emailContent`,
      }
    }
    if (!profile.email) {
      console.warn(
        `[6w-notifications] user ${params.userId} has no email; skipping email send for ${template.key}`,
      )
    } else {
      try {
        const personalizedHtml = applySixWeekTokens(template.emailContent.bodyHtml, tokens)
        const personalizedText = applySixWeekTokens(template.emailContent.bodyText, tokens)
        const result = await callSendProgrammeEmail({
          to: profile.email,
          recipientName: tokens.firstName,
          subject: template.emailContent.subject,
          preview: template.emailContent.preview,
          bodyHtml: personalizedHtml,
          bodyText: personalizedText,
          programme: template.programme,
          templateKey: template.key,
        })
        emailSent = !!result?.success
      } catch (err) {
        console.error(
          `[6w-notifications] sendProgrammeEmail failed for ${template.key}`,
          err,
        )
      }
    }
  } else if (template.channel === 'push') {
    pushBuzzed = tryBrowserNotification(personalizedTitle, personalizedBody)
  }

  await createInAppNotification({
    userId: params.userId,
    type: 'programme_day',
    title: personalizedTitle,
    message: personalizedBody,
    metadata: {
      ...sharedMetadata,
      emailSent,
      pushBuzzed,
      priority: template.channel === 'push' ? 'push' : 'normal',
    },
  })

  return {
    sent: true,
    channelDelivered: template.channel,
    emailSent,
    pushBuzzed,
  }
}

export const listAllSixWeekTemplates = (): readonly SixWeekNotificationTemplate[] =>
  TRANSFORMING_BUSINESS_6W_NOTIFICATIONS

export const pickSixWeekProgressVariant = (params: {
  day: 2 | 5
}): SixWeekProgressVariant => (params.day === 2 ? 'day_2' : 'day_5')
