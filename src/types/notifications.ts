export type NotificationCategory =
  | 'action_required'
  | 'important_updates'
  | 'mentions'
  | 'system_alerts'
  | 'other'

export type NotificationActionResponse = 'accepted' | 'declined' | 'acknowledged' | null

export type NotificationType =
  | 'challenge_request'
  | 'challenge_invite'
  | 'challenge_response'
  | 'session_request'
  | 'task_due'
  | 'direct_message'
  | 'mention'
  | 'system_alert'
  | 'maintenance'
  | 'downtime'
  | 'milestone'
  | 'achievement'
  | 'important_update'
  | 'product_update'
  | 'engagement_alert'
  | 'intervention_reminder'
  | 'escalation_notice'
  | 'system_event'
  | 'progress_report'
  | 'mentee_checkin'
  | 'approval'
  | 'badge_awarded'
  | 'referral_success'
  | 'referral_reward'
  | 'unknown'

export interface NotificationRecord {
  id: string
  user_id?: string
  type: NotificationType
  notification_type?: NotificationType
  title?: string
  message: string
  is_read?: boolean
  read?: boolean
  related_id?: string
  category?: NotificationCategory
  action_response?: NotificationActionResponse
  metadata?: Record<string, unknown>
  created_at?: string
  severity?: 'info' | 'warning' | 'critical' | 'success' | 'default'
  target_roles?: string[]
}

export interface WeeklyTargetAlert {
  id: string
  user_id: string
  type: 'alert' | 'warning' | 'recovery'
  message: string
  status?: string
  created_at?: string
}

export type NotificationSettingsPreferences = {
  emailNotificationsEnabled: boolean
  inAppNotificationsEnabled: boolean
  emailNotificationPreferences: Record<NotificationCategory, boolean>
  inAppNotificationPreferences: Record<NotificationCategory, boolean>
  emailNotificationFrequency: 'instant' | 'hourly' | 'daily'
  inAppNotificationFrequency: 'instant' | 'hourly' | 'daily'
  notificationDigestMode: 'instant' | 'daily' | 'weekly'
  statusNudgesEnabled: boolean
  statusNudgePreferences: {
    warning: boolean
    alert: boolean
    recovery: boolean
    on_track: boolean
  }
}

export type AdminNotificationSeverity = 'info' | 'warning' | 'critical' | 'success' | 'default'

export interface AdminNotification extends NotificationRecord {
  target_roles?: string[]
  severity?: AdminNotificationSeverity
}
