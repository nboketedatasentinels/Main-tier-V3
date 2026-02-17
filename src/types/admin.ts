import type { FieldValue, Timestamp } from 'firebase/firestore'
import type { JourneyType } from '@/config/pointsConfig'

export interface AdminActivityLogEntry {
  id: string
  action: string
  organizationName?: string
  organizationCode?: string
  userId?: string
  adminId?: string
  adminName?: string
  createdBy?: string
  createdAt?: Timestamp | string | Date
  metadata?: Record<string, unknown>
  severity?: 'info' | 'watch' | 'active' | 'critical'
}

export interface SuperAdminDashboardMetrics {
  organizationCount: number
  managedCompanies: number
  paidMembers: number
  activeMembers: number
  engagementRate: number
  newRegistrations: number
}

export type OrganizationStatus = 'active' | 'inactive' | 'pending' | 'suspended' | 'watch' | 'paused'

export interface OrganizationRecord {
  id?: string
  name: string
  code: string
  /**
   * Aggregated organization statistics written by `organizationStatsService`.
   * These fields may be absent until stats have been computed at least once.
   */
  memberCount?: number
  activeUsers?: number
  newThisWeek?: number
  averageEngagementRate?: number
  lastActive?: Timestamp | string | Date | null
  statsUpdatedAt?: Timestamp | string | Date | null
  /**
   * Cohort size and total paid license count (includes users, mentors, ambassadors, and team leaders).
   */
  teamSize?: number
  /**
   * Whether email verification is enforced for new users in this organization.
   */
  emailVerificationEnforced?: boolean
  /**
   * Per-role license allocation counts based on active users.
   */
  licenseAllocationByRole?: Record<string, number>
  /**
   * User IDs exempted from email verification enforcement.
   */
  grandfatheredUsers?: string[]
  /**
   * Role-based license weights for capacity calculations.
   */
  roleBasedLicenseWeights?: Record<string, number>
  /**
   * Remaining licenses based on team size minus weighted usage.
   */
  availableLicenses?: number
  status: OrganizationStatus
  createdAt?: Timestamp | string | Date
  updatedAt?: Timestamp | string | Date
  leadershipUpdatedAt?: Timestamp | string | Date
  leadershipUpdatedBy?: string
  organizationJourneyType?: JourneyType
  lastJourneyTypeSync?: Timestamp | string | Date
  journeyTypeSyncStatus?: 'idle' | 'pending' | 'completed' | 'failed'
  village?: string
  cluster?: string
  programStart?: string
  programEnd?: string
  assignmentCount?: number
  cohortStartDate?: Timestamp | string | Date
  programDuration?: number
  programDurationWeeks?: number
  journeyType?: JourneyType
  courseAssignments?: string[]
  monthlyCourseAssignments?: Record<string, string>
  courseAssignmentStructure?: 'monthly' | 'array'
  description?: string
  assignedMentorId?: string | null
  assignedMentorAt?: Timestamp | string | Date
  assignedMentorBy?: string | null
  assignedMentorName?: string | null
  assignedMentorEmail?: string | null
  assignedAmbassadorId?: string | null
  assignedAmbassadorAt?: Timestamp | string | Date
  assignedAmbassadorBy?: string | null
  assignedAmbassadorName?: string | null
  assignedAmbassadorEmail?: string | null
  partnerId?: string | null
  transformationPartnerId?: string | null
  assignedPartnerAt?: Timestamp | string | Date
  assignedPartnerBy?: string | null
  assignedPartnerName?: string | null
  assignedPartnerEmail?: string | null
  hasMentor?: boolean
  hasAmbassador?: boolean
  capacityLastAlertThreshold?: 75 | 90 | 95 | 100 | null
}

export interface OrganizationMemberStats {
  totalMembers: number
  activeMembers: number
  paidMembers: number
}

export interface EngagementRiskAggregate {
  total: number
  riskBuckets: Record<string, number>
}

export interface VerificationRequest {
  id: string
  userName?: string
  activityTitle?: string
  points?: number
  status?: 'pending' | 'approved' | 'rejected' | string
  created_at?: Timestamp | string | Date
}

export interface RegistrationRecord {
  id: string
  name?: string
  email?: string
  company?: string
  createdAt?: Timestamp | string | Date
  registrationDate?: Timestamp | string | Date
}

export interface SystemAlertRecord {
  id: string
  level?: string
  message?: string
  component?: string
  created_at?: Timestamp | string | Date
}

export interface TaskNotificationRecord {
  id: string
  title?: string
  message?: string
  created_at?: Timestamp | string | Date
  severity?: string
}

export type AdminRole = 'super_admin' | 'partner' | 'mentor' | 'ambassador'

export type PartnerAssignmentStatus = 'active' | 'watch' | 'paused' | 'inactive'

export interface PartnerAssignment {
  organizationId?: string | null
  companyCode?: string
  status?: PartnerAssignmentStatus
}

export interface PartnerAdminSnapshot {
  partnerId: string
  role: 'partner'
  assignedOrganizations: PartnerAssignment[]
  createdAt?: Timestamp | string | Date | FieldValue
  updatedAt?: Timestamp | string | Date | FieldValue
}

export interface PartnerAdminUser {
  id: string
  name: string
  fullName?: string
  createdAt?: string
  lastActiveAt?: string
  programStartDate?: string
  email: string
  companyCode: string
  organizationId?: string
  progressPercent: number
  currentWeek: number
  status: 'Active' | 'Paused' | 'Onboarding'
  lastActive: string
  riskStatus: 'engaged' | 'watch' | 'concern' | 'critical' | 'at_risk'
  weeklyEarned: number
  weeklyRequired: number
  role?: 'learner' | 'mentor' | 'user' | 'team_leader'
  riskReasons?: string[]
  registrationDate?: string
  interventions?: number
  nudgeEnabled?: boolean
  adminNotes?: string
  membershipStatus?: 'active' | 'inactive' | 'paid' | 'trial'
  accountStatus?: 'active' | 'inactive' | 'suspended'
  avatarUrl?: string | null
}

export interface PartnerAdminPointsOverview {
  totalPoints: number
  weeklyPoints: number
  pendingPoints: number
  approvedPoints: number
  rejectedPoints: number
}

export interface PartnerAdminDataSnapshot {
  partnerId: string
  assignedOrganizations: PartnerAssignment[]
  organizations: OrganizationRecord[]
  users: PartnerAdminUser[]
  pointsOverview: PartnerAdminPointsOverview
  usersFetchedAt?: Date
  createdAt?: Timestamp | string | Date
  updatedAt?: Timestamp | string | Date
}

export interface AdminUserRecord {
  id: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  role: AdminRole
  assignedOrganizations?: string[]
  assignedOrganizationsUpdatedAt?: Timestamp | string | Date
  assignedOrganizationsUpdatedBy?: string | null
  accountStatus?: 'active' | 'suspended'
  lastActive?: Timestamp | string | Date
  createdAt?: Timestamp | string | Date
  avatarUrl?: string
}

export type AdminFormData = {
  firstName: string
  lastName: string
  email: string
  role: AdminRole
  assignedOrganizations: string[]
  accountStatus: 'active' | 'suspended'
}

export interface AdminMetrics {
  total: number
  active: number
  partners: number
  mentors: number
  ambassadors: number
}

export type InvitationMethod = 'email' | 'one_time_code'

export interface InviteDraft {
  id: string
  name: string
  email: string
  role: AdminRole | 'user'
  method: InvitationMethod
}

export interface InvitationPayload {
  name: string
  email?: string
  role: AdminRole | 'user'
  method: InvitationMethod
  organizationId: string
}

export interface InvitationResultEntry {
  id: string
  name: string
  email?: string
  role: AdminRole | 'user'
  method: InvitationMethod
  status: 'success' | 'failed'
  message?: string
  code?: string
}

export interface BulkInvitationResult {
  total: number
  success: number
  failed: number
  results: InvitationResultEntry[]
}

export interface CourseOption {
  id: string
  title: string
  description?: string
}

export interface OrganizationLead {
  id: string
  name: string
  email?: string
}

export interface ProgramDurationOption {
  value: number
  label: string
  courseCount: number
}

export type OrganizationDetailStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'suspended'
  | 'watch'
  | 'paused'
  | 'critical'

export interface OrganizationDetailView {
  id: string
  name: string
  code: string
  status: OrganizationDetailStatus
  /**
   * Cohort size and paid license count.
   */
  teamSize?: number
  village?: string
  cluster?: string
  programStart?: string
  programEnd?: string
  cohortStartDate?: string
  programDuration?: number
  programDurationWeeks?: number
  journeyType?: JourneyType
  description?: string
  transformationPartnerId?: string | null
  leadershipUpdatedAt?: string
  leadershipUpdatedBy?: string
  assignedMentorId?: string | null
  assignedAmbassadorId?: string | null
  assignedMentorName?: string | null
  assignedMentorEmail?: string | null
  assignedAmbassadorName?: string | null
  assignedAmbassadorEmail?: string | null
  assignedPartnerName?: string | null
  assignedPartnerEmail?: string | null
  createdAt?: string
  updatedAt?: string
  courseAssignments?: string[]
}

export interface OrganizationUserProfile {
  id: string
  name: string
  email?: string
  role: AdminRole | 'user'
  membershipStatus: 'free' | 'paid' | 'inactive'
  accountStatus: 'active' | 'suspended'
  lastActive?: Date | null
  createdAt?: Date | null
  avatarUrl?: string | null
  organizationId?: string | null
  companyCode?: string | null
}

export interface OrganizationInvitationProfile {
  id: string
  name: string
  email?: string
  role: string
  method: InvitationMethod
  status: string
  createdAt?: Date | null
  expiresAt?: Date | null
  code?: string
}

export interface OrganizationStatistics {
  totalMembers: number
  activeMembers: number
  paidMembers: number
  newMembersThisWeek: number
  averageEngagementRate: number
}

export type OrganizationUserRoleFilter =
  | 'all'
  | 'user'
  | 'mentor'
  | 'ambassador'
  | 'partner'

export type OrganizationMembershipFilter = 'all' | 'free' | 'paid' | 'inactive'
export type OrganizationAccountStatusFilter = 'all' | 'active' | 'suspended'
export type OrganizationUserSortKey =
  | 'name'
  | 'email'
  | 'role'
  | 'membershipStatus'
  | 'accountStatus'
  | 'lastActive'
export type OrganizationUserSortDirection = 'asc' | 'desc'
