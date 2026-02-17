import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { createInAppNotification, sendEmailNotification, notifyMentorOfLearnerAlert, notifyPartnerOfLearnerAlert } from './notificationService'
import { checkNudgeCooldown, updateNudgeCooldown } from './nudgeMonitorService'
import type { NudgeTemplateRecord, NudgeTemplateCategory } from '@/types/nudges'

type NotificationSettings = {
  statusNudgesEnabled?: boolean
  statusNudgePreferences?: Record<string, boolean>
}

export async function triggerNudgeByStatus(params: {
  uid: string
  journeyType: string
  status: 'on_track' | 'warning' | 'alert' | 'recovery'
  previousStatus?: string
  pointsEarned: number
  windowTarget: number
}) {
  const { uid, status, pointsEarned, windowTarget } = params

  // 1. Determine template category and cooldown
  let category: NudgeTemplateCategory
  let cooldownHours = 24

  switch (status) {
    case 'warning':
      category = 'Status Warning'
      cooldownHours = 24
      break
    case 'alert':
      category = 'Status Alert'
      cooldownHours = 48
      break
    case 'recovery':
      category = 'Status Recovery'
      cooldownHours = 0 // No cooldown for recovery
      break
    case 'on_track':
      category = 'Status On Track'
      cooldownHours = 72
      break
    default:
      return
  }

  // 2. Check cooldown
  if (cooldownHours > 0) {
    const isEligible = await checkNudgeCooldown(uid, status, cooldownHours)
    if (!isEligible) return
  }

  // 3. Fetch template
  const template = await fetchLatestTemplate(category)
  if (!template) {
    console.warn(`[NudgeTrigger] No active template found for category: ${category}`)
    return
  }

  // 4. Fetch user details for personalization
  const userProfile = await fetchUserProfile(uid)
  if (!userProfile) return

  // Check user preferences
  const settings = userProfile.notificationSettings as NotificationSettings | undefined
  if (settings) {
    if (settings.statusNudgesEnabled === false) return
    if (settings.statusNudgePreferences) {
      const prefKey = status === 'on_track' ? 'on_track' : status
      if (settings.statusNudgePreferences[prefKey] === false) return
    }
  }

  const tokens = {
    userName: userProfile.fullName || 'Learner',
    organizationName: userProfile.organizationName || 'T4L',
    pointsGap: Math.max(0, windowTarget - pointsEarned),
    weeklyTarget: windowTarget,
    mentorName: userProfile.mentorName || 'your mentor',
  }

  const message = buildPersonalizedMessage(template.message_body, tokens)
  const subject = buildPersonalizedMessage(template.subject, tokens)

  // 5. Deliver Nudge
  try {
    if (status === 'warning') {
      // In-app only
      await createInAppNotification({
        userId: uid,
        type: 'system_alert',
        title: subject,
        message: message,
        metadata: { status, pointsEarned, windowTarget }
      })
    } else if (status === 'alert') {
      // Email + In-app + Mentor Ping
      await createInAppNotification({
        userId: uid,
        type: 'system_alert',
        title: subject,
        message: message,
        metadata: { status, pointsEarned, windowTarget }
      })

      if (userProfile.email) {
        await sendEmailNotification({
          to: userProfile.email,
          subject: subject,
          template: 'nudge-status-alert',
          data: { message, ...tokens }
        })
      }

      // Mentor Ping
      if (userProfile.mentorId) {
        await notifyMentorOfLearnerAlert({
          mentorId: userProfile.mentorId,
          learnerId: uid,
          learnerName: userProfile.fullName,
          status: 'alert',
          pointsEarned,
          windowTarget
        })
      }

      // Partner Ping
      if (userProfile.organizationId) {
        await notifyPartnerOfLearnerAlert({
          organizationId: userProfile.organizationId,
          learnerId: uid,
          learnerName: userProfile.fullName,
          status: 'alert'
        })
      }
    } else if (status === 'recovery') {
      // Positive reinforcement in-app
      await createInAppNotification({
        userId: uid,
        type: 'achievement',
        title: subject,
        message: message,
        metadata: { status, recovery: true }
      })
    } else if (status === 'on_track') {
       // Optional celebration
       await createInAppNotification({
        userId: uid,
        type: 'milestone',
        title: subject,
        message: message,
        metadata: { status }
      })
    }

    // 6. Update cooldown
    await updateNudgeCooldown(uid, status)

  } catch (error) {
    console.error(`[NudgeTrigger] Error delivering nudge for status ${status}:`, error)
  }
}

async function fetchLatestTemplate(category: NudgeTemplateCategory): Promise<NudgeTemplateRecord | null> {
  const q = query(
    collection(db, 'nudge_templates'),
    where('template_type', '==', category),
    where('is_active', '==', true),
    limit(1)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as NudgeTemplateRecord
}

async function fetchUserProfile(uid: string) {
  const profileDoc = await getDoc(doc(db, 'profiles', uid))
  if (!profileDoc.exists()) return null
  return profileDoc.data()
}

function buildPersonalizedMessage(template: string, tokens: Record<string, unknown>) {
  let result = template
  Object.keys(tokens).forEach(key => {
    const value = tokens[key]
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, value?.toString() || '')
  })
  return result
}
