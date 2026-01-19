/**
 * Phase 5: Status Monitoring & Notification Types
 * Defines all types for learner status tracking, engagement metrics, and notification system
 */

// ============================================================================
// STATUS TYPES
// ============================================================================

export type LearnerStatus = 'active' | 'at_risk' | 'inactive' | 'in_recovery'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type AlertType =
  | 'at_risk_warning'
  | 'inactive_notice'
  | 'recovery_celebration'
  | 'milestone_achieved'
  | 'low_engagement'
  | 'missed_deadline'
  | 'activity_approved'

export interface LearnerStatusRecord {
  id: string // user_id
  userId: string
  orgId?: string
  currentStatus: LearnerStatus
  previousStatus?: LearnerStatus
  statusChangedAt: Timestamp

  // Engagement Metrics
  engagementScore: number // 0-100
  completionRate: number // 0-100
  consistencyScore: number // 0-100
  lastActivityDate?: Timestamp
  daysSinceLastActivity: number

  // Window Progress
  currentWindowNumber: number
  pointsInCurrentWindow: number
  targetPointsForWindow: number
  windowProgressPercentage: number

  // Recovery Tracking
  recoveryStartedAt?: Timestamp
  recoveryNotificationSent?: boolean
  consecutiveActiveWeeks: number

  // Alert Management
  alertSeverity?: AlertSeverity
  alertReason?: string
  alertsSentToday: number
  lastAlertSentAt?: Timestamp

  // Thresholds crossed
  engagementDropDetected?: boolean
  missedDeadlineCount: number

  updatedAt: Timestamp
  calculatedAt: Timestamp
}

export interface LearnerStatusHistory {
  id: string
  userId: string
  orgId?: string
  previousStatus: LearnerStatus
  newStatus: LearnerStatus
  reason: string
  engagementScore: number
  daysSinceActivity: number
  triggeredAutomationRules: string[]
  metadata?: Record<string, unknown>
  createdAt: Timestamp
}

// ============================================================================
// ENGAGEMENT METRICS TYPES
// ============================================================================

export interface EngagementMetrics {
  id: string
  userId: string
  orgId?: string
  date: string // YYYY-MM-DD format

  // Daily activity
  pointsEarned: number
  activitiesCompleted: number
  activitiesAttempted: number

  // Streaks
  dailyActiveStreakDays: number
  isActiveToday: boolean

  // Rolling metrics
  last7DaysPoints: number
  last14DaysPoints: number
  last30DaysPoints: number
  last7DaysActivityCount: number
  last14DaysActivityCount: number
  last30DaysActivityCount: number

  // Calculated fields
  dailyAverage: number
  weeklyTrend: 'increasing' | 'stable' | 'decreasing'

  createdAt: Timestamp
}

export interface EngagementScore {
  score: number // 0-100
  factors: {
    recentActivity: number // 0-100, weight 40%
    completionRate: number // 0-100, weight 30%
    consistency: number // 0-100, weight 20%
    streakBonus: number // 0-10, weight 10%
  }
  calculatedAt: Timestamp
  nextRecalculationAt: Timestamp
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface StatusAlertRecord {
  id: string
  userId: string
  orgId?: string
  type: AlertType
  status: 'pending' | 'sent' | 'failed' | 'skipped' | 'deferred'
  channels: Array<'email' | 'in_app'>

  // Alert Content
  message: string
  title: string
  actionRequired: boolean
  actionUrl?: string
  suggestedActions?: string[]

  // Alert Properties
  severity: AlertSeverity
  reasonCode: string
  statusChangeTriggered?: LearnerStatus

  // Retry Handling
  attemptCount: number
  maxRetries: number
  lastAttemptAt?: Timestamp
  nextRetryAt?: Timestamp
  lastError?: string

  // Timing
  scheduledFor?: Timestamp
  createdAt: Timestamp
  sentAt?: Timestamp
}

export interface NotificationPreferences {
  id: string
  userId: string

  // Global toggles
  emailNotificationsEnabled: boolean
  inAppNotificationsEnabled: boolean

  // Status alerts
  statusAlerts: {
    enabled: boolean
    frequency: 'instant' | 'daily'
    includeAtRiskWarnings: boolean
    includeInactiveNotices: boolean
  }

  // Recovery notifications
  recoveryNotifications: {
    enabled: boolean
  }

  // Weekly content
  weeklyDigests: {
    enabled: boolean
    frequency: 'weekly' | 'biweekly'
    preferredDay: string // e.g., 'monday'
    preferredTime: string // HH:MM UTC
  }

  // For partners/mentors
  partnerAlerts?: {
    enabled: boolean
    frequency: 'instant' | 'daily' | 'weekly'
    includeAtRiskTeamMembers: boolean
    includeWeeklyDigest: boolean
    dailyDigestTime?: string // HH:MM UTC
  }

  // Do Not Disturb
  doNotDisturbEnabled?: boolean
  doNotDisturbStart?: string // HH:MM
  doNotDisturbEnd?: string // HH:MM
  doNotDisturbTimezone?: string

  updatedAt: Timestamp
  updatedBy?: string
}

export interface StatusChangeNotificationPayload {
  userId: string
  previousStatus: LearnerStatus
  newStatus: LearnerStatus
  engagementScore: number
  daysSinceActivity: number
  suggestedActions: string[]
  recoveryTips?: string[]
  partnerName?: string
}

export interface RecoveryNotificationPayload {
  userId: string
  userName: string
  recoveryDuration: number // days
  activitiesCompleted: number
  pointsEarned: number
  streakDays: number
  nextMilestone?: string
  encouragementMessage: string
}

// ============================================================================
// PARTNER DIGEST TYPES
// ============================================================================

export interface PartnerDailyDigest {
  id: string
  partnerId: string // mentor/ambassador user_id
  partnerName: string
  orgId: string
  digestDate: string // YYYY-MM-DD
  status: 'pending' | 'sent' | 'failed'

  // Summary statistics
  totalTeamMembers: number
  activeMembers: number
  atRiskCount: number
  inactiveCount: number
  recoveredCount: number

  // Changes since last digest
  newAtRiskCount: number
  newRecoveredCount: number
  completedMilestones: number

  // Learner details
  atRiskLearners: Array<{
    userId: string
    name: string
    email?: string
    engagementScore: number
    daysSinceActivity: number
    suggestedActions: string[]
    recoveryTips: string[]
    statusChangedAt: Timestamp
  }>

  // Performance metrics
  teamAverageEngagementScore: number
  teamCompletionRate: number
  weeklyPointsAverage: number

  // Summary for email
  summaryText: string
  criticalItems: string[]

  metadata?: Record<string, unknown>

  createdAt: Timestamp
  sentAt?: Timestamp
  nextDigestAt?: Timestamp
}

export interface DigestSchedule {
  id: string
  partnerId: string
  orgId: string

  frequency: 'daily' | 'weekly' | 'biweekly'
  preferredTime: string // HH:MM UTC
  preferredDay?: string // for weekly/biweekly: 'monday', 'tuesday', etc.
  timezone?: string // IANA timezone

  enabled: boolean
  lastDigestSentAt?: Timestamp
  nextDigestAt?: Timestamp

  updatedAt: Timestamp
}

// ============================================================================
// STATUS CALCULATION CONFIGURATION
// ============================================================================

export interface StatusCalculationConfig {
  // Thresholds for status transitions
  at_risk: {
    daysSinceLastActivityMin: number // default: 7
    daysSinceLastActivityMax: number // default: 14
    engagementScoreThreshold: number // default: 40
  }
  inactive: {
    daysSinceLastActivityMin: number // default: 14
    engagementScoreThreshold: number // default: 20
  }
  recovery: {
    daysInRecoveryBeforeActive: number // default: 7
    pointsRequiredToRecover: number // default: minimum weekly target
  }

  // Alert configuration
  alerts: {
    maxAlertsPerDay: number // default: 3
    alertDebounceMinutes: number // default: 60 - don't send same alert twice within this window
    earlyWarningDaysBefore: number // default: 3 - warn before at_risk threshold
  }

  // Calculation frequency
  recalculationIntervalMinutes: number // default: 60
  metricsUpdateIntervalHours: number // default: 24
}

export interface StatusTransitionEvent {
  userId: string
  orgId?: string
  previousStatus: LearnerStatus
  newStatus: LearnerStatus
  triggeringMetrics: {
    engagementScore: number
    daysSinceActivity: number
    completionRate: number
    pointsTrend: 'up' | 'stable' | 'down'
  }
  timestamp: Timestamp
  automationRulesTriggered: string[]
}

// ============================================================================
// ALERT RULES ENGINE
// ============================================================================

export type RuleTrigger =
  | 'status_change'
  | 'engagement_drop'
  | 'missed_deadline'
  | 'low_score_achieved'
  | 'recovery_detected'
  | 'milestone_achieved'

export interface AutomationRule {
  id: string
  name: string
  description: string
  enabled: boolean

  trigger: RuleTrigger
  conditions: Array<{
    field: string
    operator: 'equals' | 'gte' | 'lte' | 'gt' | 'lt' | 'contains'
    value: unknown
  }>

  actions: Array<{
    type: 'create_alert' | 'send_notification' | 'assign_nudge' | 'escalate_to_mentor'
    config: Record<string, unknown>
  }>

  priority: number // 1-10, higher = more important
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ============================================================================
// ACTIVITY COMPLETION TRACKING (For Status Calculation)
// ============================================================================

export interface WeeklyActivityReport {
  userId: string
  orgId?: string
  weekNumber: number
  windowId: string

  targetPoints: number
  pointsEarned: number
  activitiesRequired: number
  activitiesCompleted: number

  complianceStatus: 'on_track' | 'behind' | 'at_risk' | 'critical'
  completionPercentage: number

  activities: Array<{
    id: string
    title: string
    status: 'pending' | 'completed' | 'failed_to_complete'
    pointsEarned?: number
    completedAt?: Timestamp
  }>

  calculatedAt: Timestamp
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Timestamp = any // Firebase Timestamp

export interface StatusDashboardData {
  currentStatus: LearnerStatus
  engagementScore: number
  completionRate: number
  daysActive: number
  pointsEarned: number
  targetPoints: number
  windowProgress: number
  statusChangedAt: Timestamp
  nextMilestone?: string
  suggestedActions: string[]
}

export interface PartnerDashboardData {
  teamStats: {
    total: number
    active: number
    atRisk: number
    inactive: number
    recovered: number
  }
  criticalAlerts: StatusAlertRecord[]
  atRiskLearners: Array<{
    userId: string
    name: string
    status: LearnerStatus
    engagementScore: number
    daysSinceActivity: number
  }>
  recentRecoveries: Array<{
    userId: string
    name: string
    recoveredAt: Timestamp
  }>
}
