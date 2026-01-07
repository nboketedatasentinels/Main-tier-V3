export type NudgeTemplateCategory =
  | 'Initial Outreach'
  | 'Follow-up'
  | 'Critical Alert'
  | 'Encouragement'
  | 'Resource Sharing'

export type NudgeChannel = 'email' | 'in_app' | 'both'

export type NudgeDeliveryStatus = 'pending' | 'sent' | 'failed' | 'scheduled'

export interface NudgeTemplateRecord {
  id: string
  name: string
  subject: string
  message_body: string
  template_type: NudgeTemplateCategory
  target_audience?: string | null
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface NudgeSentRecord {
  id: string
  user_id: string
  template_id?: string | null
  sent_at: string
  sent_by_admin_id?: string | null
  delivery_status: NudgeDeliveryStatus
  channel: NudgeChannel
  metadata?: Record<string, unknown>
}

export interface NudgeEffectivenessRecord {
  id: string
  nudge_id?: string | null
  user_id: string
  engagement_score_before?: number | null
  engagement_score_after?: number | null
  tasks_completed_before?: number | null
  tasks_completed_after?: number | null
  days_to_response?: number | null
  responded: boolean
  measured_at: string
}

export interface NudgeCampaignRecord {
  id: string
  name: string
  description?: string | null
  target_risk_levels: string[]
  start_date?: string | null
  end_date?: string | null
  created_by?: string | null
  status: 'draft' | 'active' | 'paused' | 'completed'
}

export interface NudgePersonalizationTokens {
  userName: string
  organizationName: string
  daysInactive: number
  engagementScore: number
}

export interface NudgeAutomationRule {
  id: string
  label: string
  trigger: 'days_inactive' | 'risk_level' | 'engagement_score'
  threshold: number
  templateType: NudgeTemplateCategory
  frequencyLimitDays: number
  quietHours: { start: string; end: string }
  cooldownDays: number
  active: boolean
}
