import type { Timestamp } from 'firebase/firestore'
import type { JourneyType } from '@/config/pointsConfig'

export interface AdminActivityLogEntry {
  id: string
  action: string
  organizationName?: string
  organizationCode?: string
  userId?: string
  adminId?: string
  adminName?: string
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

export type OrganizationStatus = 'active' | 'inactive' | 'pending' | 'suspended' | 'watch'

export interface OrganizationRecord {
  id?: string
  name: string
  code: string
  teamSize?: number
  status: OrganizationStatus
  transformationPartner?: string
  createdAt?: Timestamp | string | Date
  updatedAt?: Timestamp | string | Date
  village?: string
  cluster?: string
  programStart?: string
  programEnd?: string
  assignmentCount?: number
  partnerId?: string | null
  cohortStartDate?: Timestamp | string | Date
  programDuration?: number
  programDurationWeeks?: number
  journeyType?: JourneyType
  courseAssignments?: string[]
  monthlyCourseAssignments?: Record<string, string>
  courseAssignmentStructure?: 'monthly' | 'array'
  description?: string
  assignedMentorId?: string | null
  assignedMentorName?: string | null
  assignedMentorEmail?: string | null
  assignedAmbassadorId?: string | null
  assignedAmbassadorName?: string | null
  assignedAmbassadorEmail?: string | null
  assignedPartnerId?: string | null
  assignedPartnerName?: string | null
  assignedPartnerEmail?: string | null
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

export type AdminRole = 'super_admin' | 'partner' | 'admin' | 'mentor' | 'ambassador' | 'team_leader'

export interface AdminUserRecord {
  id: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  role: AdminRole
  assignedOrganizations?: string[]
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
  teamLeaders: number
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
  transformationPartner?: string
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
  | 'team_leader'
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
