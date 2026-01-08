import type { Timestamp } from 'firebase/firestore'

export type NudgeTemplateCategory =
  | 'Initial Outreach'
  | 'Follow-up'
  | 'Critical Alert'
  | 'Encouragement'
  | 'Resource Sharing'

export type NudgeChannel = 'email' | 'in_app' | 'both'

export type NudgeDeliveryStatus = 'pending' | 'sent' | 'failed' | 'scheduled'

export type FirestoreTimestamp = Timestamp | null

export interface NudgeTemplateRecord {
  id: string
  name: string
  subject: string
  message_body: string
  template_type: NudgeTemplateCategory
  target_audience?: string | null
  created_at?: FirestoreTimestamp
  updated_at?: FirestoreTimestamp
  is_active: boolean
}

export interface NudgeSentRecord {
  id: string
  user_id: string
  template_id?: string | null
  sent_at?: FirestoreTimestamp
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
  measured_at?: FirestoreTimestamp
}

export interface NudgeCampaignRecord {
  id: string
  name: string
  description?: string | null
  target_risk_levels: string[]
  start_date?: FirestoreTimestamp
  end_date?: FirestoreTimestamp
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
