/**
 * Organization & Leadership Configuration Types
 * Phase 6: Types for managing org structure and leadership dependencies
 */

import { Timestamp } from 'firebase/firestore'

/**
 * Leadership Role Enumeration
 */
export type LeadershipRole = 'mentor' | 'ambassador' | 'partner'

/**
 * Activity Visibility Reason
 */
export type VisibilityReason =
  | 'available'
  | 'leadership_unavailable'
  | 'capacity_exceeded'
  | 'feature_disabled'
  | 'custom_rule'
  | 'prerequisite_unmet'

/**
 * Pass Mark Adjustment Reason
 */
export type PassMarkAdjustmentReason =
  | 'no_mentor'
  | 'no_ambassador'
  | 'no_partner'
  | 'capacity_limited'
  | 'custom'

/**
 * Rule Trigger Type
 */
export type RuleTriggerType =
  | 'org_status_change'
  | 'leadership_change'
  | 'capacity_reached'
  | 'feature_disabled'
  | 'activity_completion'

/**
 * Rule Action Type
 */
export type RuleActionType =
  | 'adjust_pass_mark'
  | 'hide_activity'
  | 'show_activity'
  | 'notify_admin'
  | 'notify_learners'
  | 'adjust_deadline'
  | 'disable_feature'
  | 'trigger_nudge'

/**
 * Leadership Person Assignment
 */
export interface LeadershipAssignment {
  userId: string
  name: string
  email: string
  role: LeadershipRole
  available: boolean
  capacity: number
  utilized: number
  skills?: string[]
  focusAreas?: string[]
  assignedSince: Timestamp
  availability?: {
    startDate: Timestamp
    endDate?: Timestamp
    notes?: string
  }
  notes?: string
}

/**
 * Organization Leadership Configuration
 */
export interface OrganizationLeadership {
  // Individual assignments
  assignedMentorId?: string | null
  assignedAmbassadorId?: string | null
  transformationPartnerId?: string | null

  // Availability flags
  hasMentor?: boolean
  hasAmbassador?: boolean
  hasPartner?: boolean

  // Capacity tracking
  mentorCapacity?: number
  ambassadorCapacity?: number
  mentorUtilization?: number
  ambassadorUtilization?: number

  // Skills/Focus areas
  mentorSkills?: string[]
  ambassadorFocusAreas?: string[]
  partnerProgramFocus?: string[]

  // Roster (for quick access)
  assignedLeadership?: LeadershipAssignment[]

  updatedAt: Timestamp
}

/**
 * Feature Configuration
 */
export interface OrganizationFeatures {
  mentorshipRequired?: boolean
  peerMatchingEnabled?: boolean
  pointsVerificationRequired?: boolean
  cohortsEnabled?: boolean
  communityEnabled?: boolean
  leaderboardEnabled?: boolean
  customReportsEnabled?: boolean
  automatedNudgesEnabled?: boolean
  journeyCustomizationEnabled?: boolean
}

/**
 * Pass Mark Adjustment Rule
 */
export interface PassMarkAdjustmentRule {
  reason: PassMarkAdjustmentReason
  adjustment: number // Can be negative (reduce) or positive (increase)
  description: string
  enabled: boolean
}

/**
 * Activity-level Pass Mark Override
 */
export interface ActivityPassMarkOverride {
  activityId: string
  required?: boolean
  passMark?: number
  leadershipDependency?: LeadershipRole | null
  alternateActivityId?: string
  visibleWhen?: 'always' | 'leadership_available' | 'capacity_available'
}

/**
 * Pass Mark Configuration
 */
export interface PassMarkConfiguration {
  basePassMark: number // e.g., 70
  minimumPassMark?: number // e.g., 50 (don't reduce below this)

  // Dynamic adjustments
  adjustments: {
    noMentorAvailable?: number
    noAmbassadorAvailable?: number
    noPartnerAvailable?: number
    limitedCapacity?: number
  }

  // Activity-level overrides
  activityOverrides?: Record<string, ActivityPassMarkOverride>

  // Per-organization notes
  notes?: string
  updatedAt: Timestamp
}

/**
 * Dashboard Configuration
 */
export interface DashboardConfiguration {
  displayedMetrics: Array<
    | 'team_health'
    | 'engagement_score'
    | 'completion_rate'
    | 'leadership_utilization'
    | 'pass_mark_adjustments'
    | 'activity_visibility'
    | 'learner_issues'
  >

  enabledReports: Array<
    | 'daily_snapshot'
    | 'weekly_summary'
    | 'leadership_utilization'
    | 'learner_progress'
    | 'pass_mark_changes'
  >

  reportSchedule?: 'daily' | 'weekly' | 'monthly'
  reportTime?: string // HH:MM UTC
  reportRecipients?: string[] // Admin email addresses

  adminNotificationsEnabled?: boolean
  criticalAlertsOnly?: boolean

  customDashboardSettings?: Record<string, unknown>

  updatedAt: Timestamp
}

/**
 * Conditional Rule Condition
 */
export interface RuleCondition {
  field: string // e.g., 'hasMentor', 'org.status', 'learner.engagement'
  operator: 'equals' | 'gte' | 'lte' | 'gt' | 'lt' | 'contains' | 'in'
  value: unknown
  logicOp?: 'and' | 'or' // How to combine with next condition
}

/**
 * Pass Mark Adjustment Action Config
 */
export interface PassMarkAdjustmentActionConfig {
  amount: number
  reason: PassMarkAdjustmentReason
  minPassMark?: number // Don't adjust below this
  notifyLearner?: boolean
}

/**
 * Hide Activity Action Config
 */
export interface HideActivityActionConfig {
  activityId: string
  reason: string
  visibleAgainCondition?: RuleCondition
  alternateActivityId?: string
  notifyLearner?: boolean
}

/**
 * Notify Action Config
 */
export interface NotifyActionConfig {
  target: 'admin' | 'learner' | 'both'
  title: string
  message: string
  action?: string
  actionUrl?: string
}

/**
 * Rule Action
 */
export interface RuleAction {
  type: RuleActionType
  priority: number
  config:
    | PassMarkAdjustmentActionConfig
    | HideActivityActionConfig
    | NotifyActionConfig
    | Record<string, unknown>
}

/**
 * Organization Rule (Conditional Logic)
 */
export interface OrganizationRule {
  id: string
  orgId: string
  name: string
  description?: string

  // When does this rule trigger?
  trigger: RuleTriggerType
  triggerScope?: 'all_learners' | 'new_learners' | 'specific' // specific = learnerIds

  // Under what conditions?
  conditions: RuleCondition[]

  // What happens?
  actions: RuleAction[]

  // Management
  enabled: boolean
  priority: number // Higher = executed first
  runOnce?: boolean // Only trigger once per learner

  // Audit trail
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string

  // Testing
  testMode?: boolean
  lastTriggeredAt?: Timestamp
  lastTriggeredCount?: number
}

/**
 * Organization Configuration (Main Document)
 */
export interface OrganizationConfiguration {
  id: string // orgId
  orgId: string

  // Leadership
  leadership: OrganizationLeadership

  // Features
  features: OrganizationFeatures

  // Pass marks
  passMark: PassMarkConfiguration

  // Dashboard
  dashboardConfig: DashboardConfiguration

  // Rules
  journeyRules?: OrganizationRule[]

  // Metadata
  configuredAt: Timestamp
  configuredBy: string
  lastModified: Timestamp
  lastModifiedBy: string
}

/**
 * Activity Visibility Status (Real-time)
 */
export interface ActivityVisibility {
  id: string // activityId-orgId
  orgId: string
  activityId: string
  activityName?: string

  visible: boolean
  reason: VisibilityReason
  detailedReason: string

  alternativeActivityId?: string
  alternativeActivityName?: string

  // When will it become visible again?
  visibleAgainAt?: Timestamp
  visibleAgainCondition?: RuleCondition

  // For transparency
  showReasonToLearner?: boolean

  updatedAt: Timestamp
  updatedBy?: string
}

/**
 * Learner Pass Mark Adjustment
 */
export interface LearnerPassMarkAdjustment {
  id: string
  userId: string
  orgId: string
  windowId: string

  basePassMark: number

  // What adjustments apply?
  adjustments: {
    reason: PassMarkAdjustmentReason
    adjustment: number
    appliedAt: Timestamp
    appliedBy?: string
  }[]

  finalPassMark: number

  // Transparency
  transparency: {
    visibleToLearner: boolean
    explanation?: string // "Your pass mark is 60% because mentorship isn't available"
  }

  // Audit
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp

  // When does this adjustment expire?
  validUntil?: Timestamp
}

/**
 * Learner-Facing Pass Mark Info
 */
export interface LearnerPassMarkInfo {
  passmark: number
  basePassmark: number
  adjustments: {
    reason: string
    amount: number
  }[]
  explanation?: string
  visibleActivities: string[]
  hiddenActivities: {
    activityId: string
    reason: string
    willBeAvailableWhen?: string
  }[]
}

/**
 * Organization Team Statistics
 */
export interface OrganizationTeamStats {
  totalMembers: number
  activeMembers: number
  inactiveLearners: number

  // Engagement
  avgEngagementScore?: number
  avgCompletionRate?: number

  // Progress
  learnersAtRisk?: number
  learnersOnTrack?: number
  learnersCompleted?: number

  // Diversity
  activeInTags?: string[] // Which tags are learners engaging with?
  topChallenges?: string[]
}

/**
 * Organization Leadership Utilization
 */
export interface OrganizationLeadershipStats {
  mentorUtilization?: number // 0-100%
  ambassadorUtilization?: number
  partnerUtilization?: number

  // Capacity
  mentorCapacityRemaining?: number
  ambassadorCapacityRemaining?: number

  // Effectiveness
  avgMentorSessionsPerWeek?: number
  avgAmbassadorEngagements?: number
}

/**
 * Organization Dashboard Snapshot
 */
export interface OrganizationDashboardSnapshot {
  id: string
  orgId: string
  date: string // YYYY-MM-DD

  // Team health
  teamStats: OrganizationTeamStats

  // Leadership utilization
  leadershipStats: OrganizationLeadershipStats

  // Pass mark adjustments
  adjustmentStats: {
    learnersWithAdjustments: number
    avgAdjustmentAmount: number
    reasonBreakdown: Record<PassMarkAdjustmentReason, number>
  }

  // Activity visibility
  activityStats: {
    totalActivities: number
    visibleActivities: number
    hiddenActivities: number
    reasonBreakdown: Record<VisibilityReason, number>
  }

  // Issues & alerts
  alerts: {
    severity: 'info' | 'warning' | 'critical'
    message: string
    action?: string
    actionUrl?: string
  }[]

  // Metadata
  createdAt: Timestamp
  generatedAt: Timestamp
}

/**
 * Configuration Change Record (for audit trail)
 */
export interface ConfigurationChangeRecord {
  id: string
  orgId: string

  changeType:
    | 'leadership_assigned'
    | 'leadership_removed'
    | 'feature_enabled'
    | 'feature_disabled'
    | 'pass_mark_updated'
    | 'activity_visibility_changed'
    | 'rule_created'
    | 'rule_modified'

  before?: Record<string, unknown>
  after?: Record<string, unknown>

  madeBy: string
  madeAt: Timestamp

  // Approval flow (if needed)
  approved?: boolean
  approvedBy?: string
  approvedAt?: Timestamp
  rejectionReason?: string
}

/**
 * Organization Preferences
 */
export interface OrganizationPreferences {
  id: string
  orgId: string

  // Notification preferences
  notifications: {
    criticalAlertsEmail?: boolean
    weeklyDigestEmail?: boolean
    learnerUpdatesEmail?: boolean
    leadershipChangesEmail?: boolean
  }

  // Display preferences
  theme?: 'light' | 'dark'
  language?: string
  timezone?: string

  // Feature preferences
  betaFeaturesEnabled?: boolean
  advancedMetricsEnabled?: boolean
  automatedRulesEnabled?: boolean

  updatedAt: Timestamp
}

/**
 * Org-Learner Pass Mark Context
 */
export interface OrgLearnerPassMarkContext {
  learnerUserId: string
  orgId: string
  windowId: string

  // Configuration at time of evaluation
  basePassMark: number
  orgConfiguration: OrganizationConfiguration

  // Current org state
  leadership: OrganizationLeadership
  features: OrganizationFeatures

  // Calculate result
  calculatePassMark(): number
  getExplanation(): string
  getVisibleActivities(): string[]
  getHiddenActivities(): {
    id: string
    reason: string
  }[]
}

/**
 * Activity Completion Context (with org config)
 */
export interface ActivityCompletionContext {
  learnerUserId: string
  orgId: string
  activityId: string
  windowId: string

  // What's required?
  leadershipRequired?: LeadershipRole
  pointsRequired?: number

  // Is it available?
  isVisible: boolean
  visibilityReason?: VisibilityReason

  // What's the path forward?
  allowCompletion: boolean
  completionMessage?: string
  pendingApprovalFrom?: LeadershipRole[]

  // Calculate reward
  earnedPoints?: number
  countsTowardPassMark: boolean
  countsTowardCompletion: boolean
}
