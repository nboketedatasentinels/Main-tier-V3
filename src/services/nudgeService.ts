import { createInAppNotification, sendEmailNotification } from '@/services/notificationService'
import {
  createNudgeTemplate,
  createNudgeCampaign,
  fetchNudgeCampaigns,
  fetchNudgeTemplates,
  logNudgeEffectiveness,
  logNudgeSent,
  updateNudgeTemplate,
} from '@/services/firebaseNudgeService'
import type {
  NudgeAutomationRule,
  NudgeCampaignRecord,
  NudgeChannel,
  NudgeEffectivenessRecord,
  NudgePersonalizationTokens,
  NudgeSentRecord,
  NudgeTemplateCategory,
  NudgeTemplateRecord,
} from '@/types/nudges'

export const getActiveNudgeTemplates = async () => {
  return fetchNudgeTemplates(true)
}

export const getAllNudgeTemplates = async () => {
  return fetchNudgeTemplates(false)
}

export const toggleTemplateStatus = async (id: string, isActive: boolean) => {
  return updateNudgeTemplate(id, { is_active: isActive })
}

const buildPersonalizedMessage = (message: string, tokens: NudgePersonalizationTokens) => {
  return message
    .replace(/{{\s*userName\s*}}/g, tokens.userName)
    .replace(/{{\s*organizationName\s*}}/g, tokens.organizationName)
    .replace(/{{\s*daysInactive\s*}}/g, `${tokens.daysInactive}`)
    .replace(/{{\s*engagementScore\s*}}/g, `${tokens.engagementScore}`)
}

export const sendNudgeToUser = async (params: {
  userId: string
  userEmail?: string
  adminId: string
  template: NudgeTemplateRecord
  channel: NudgeChannel
  personalization: NudgePersonalizationTokens
  metadata?: Record<string, unknown>
}) => {
  const message = buildPersonalizedMessage(params.template.message_body, params.personalization)
  const subject = buildPersonalizedMessage(params.template.subject, params.personalization)

  if ((params.channel === 'email' || params.channel === 'both') && !params.userEmail) {
    throw new Error('Email address is required for email delivery.')
  }

  if (params.channel === 'email' || params.channel === 'both') {
    await sendEmailNotification({
      to: params.userEmail as string,
      subject,
      template: 'nudge-template',
      data: { message, subject },
    })
  }

  if (params.channel === 'in_app' || params.channel === 'both') {
    await createInAppNotification({
      userId: params.userId,
      type: 'system_alert',
      title: subject,
      message,
      metadata: params.metadata,
    })
  }

  const nudgeRecord = await logNudgeSent({
    user_id: params.userId,
    template_id: params.template.id,
    sent_by_admin_id: params.adminId,
    delivery_status: 'sent',
    channel: params.channel,
    metadata: params.metadata ?? {},
  })

  return nudgeRecord
}

export const sendBulkNudges = async (params: {
  users: Array<{ id: string; email?: string; name: string; organizationName: string; daysInactive: number; engagementScore: number }>
  adminId: string
  template: NudgeTemplateRecord
  channel: NudgeChannel
  scheduleAt?: string
}) => {
  const results: { success: NudgeSentRecord[]; failed: Array<{ userId: string; error: string }> } = {
    success: [],
    failed: [],
  }
  const shouldSchedule = Boolean(params.scheduleAt && params.scheduleAt.trim())
  const requiresEmail = params.channel === 'email' || params.channel === 'both'

  for (const user of params.users) {
    try {
      if (requiresEmail && !user.email) {
        throw new Error('Email address is required for email delivery.')
      }

      if (shouldSchedule) {
        const record = await logNudgeSent({
          user_id: user.id,
          template_id: params.template.id,
          sent_by_admin_id: params.adminId,
          delivery_status: 'scheduled',
          channel: params.channel,
          metadata: {
            bulk: true,
            scheduleAt: params.scheduleAt,
          },
        })
        results.success.push(record)
        continue
      }

      const record = await sendNudgeToUser({
        userId: user.id,
        userEmail: user.email,
        adminId: params.adminId,
        template: params.template,
        channel: params.channel,
        personalization: {
          userName: user.name,
          organizationName: user.organizationName,
          daysInactive: user.daysInactive,
          engagementScore: user.engagementScore,
        },
        metadata: { bulk: true },
      })
      results.success.push(record)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.failed.push({ userId: user.id, error: message })
    }
  }

  return results
}

export const calculateEffectivenessMetrics = async (params: {
  nudgeId: string
  userId: string
  before: { engagementScore: number; tasksCompleted: number }
  after: { engagementScore: number; tasksCompleted: number }
  responded: boolean
  daysToResponse: number
}) => {
  const payload: Omit<NudgeEffectivenessRecord, 'id' | 'measured_at'> = {
    nudge_id: params.nudgeId,
    user_id: params.userId,
    engagement_score_before: params.before.engagementScore,
    engagement_score_after: params.after.engagementScore,
    tasks_completed_before: params.before.tasksCompleted,
    tasks_completed_after: params.after.tasksCompleted,
    responded: params.responded,
    days_to_response: params.daysToResponse,
  }

  return logNudgeEffectiveness(payload)
}

export const scheduleAutomatedNudges = async (params: {
  users: Array<{ id: string; riskLevel: string; daysInactive: number; engagementScore: number }>
  templates: NudgeTemplateRecord[]
  rules: NudgeAutomationRule[]
}) => {
  const eligible = [] as Array<{ userId: string; template: NudgeTemplateRecord; rule: NudgeAutomationRule }>

  params.users.forEach((user) => {
    params.rules.forEach((rule) => {
      if (!rule.active) return
      if (rule.trigger === 'days_inactive' && user.daysInactive < rule.threshold) return
      if (rule.trigger === 'engagement_score' && user.engagementScore > rule.threshold) return
      if (rule.trigger === 'risk_level' && user.riskLevel !== rule.threshold.toString()) return

      const matchedTemplate = params.templates.find((template) => template.template_type === rule.templateType)
      if (matchedTemplate) {
        eligible.push({ userId: user.id, template: matchedTemplate, rule })
      }
    })
  })

  return eligible
}

export const createNudgeCampaignPlan = async (payload: Omit<NudgeCampaignRecord, 'id'>) => {
  return createNudgeCampaign(payload)
}

export const createNudgeTemplateRecord = async (
  payload: Omit<NudgeTemplateRecord, 'id' | 'created_at' | 'updated_at'>,
) => {
  return createNudgeTemplate(payload)
}

export const listNudgeCampaigns = async () => {
  return fetchNudgeCampaigns()
}

export const groupTemplatesByCategory = (templates: NudgeTemplateRecord[]) => {
  return templates.reduce<Record<NudgeTemplateCategory, NudgeTemplateRecord[]>>(
    (acc, template) => {
      const category = template.template_type
      acc[category] = [...(acc[category] || []), template]
      return acc
    },
    {
      'Initial Outreach': [],
      'Follow-up': [],
      'Critical Alert': [],
      'Encouragement': [],
      'Resource Sharing': [],
      'Status Warning': [],
      'Status Alert': [],
      'Status Recovery': [],
      'Status On Track': [],
    },
  )
}
