import type { Timestamp } from 'firebase/firestore'

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
  village?: string
  cluster?: string
  programStart?: string
  programEnd?: string
  assignmentCount?: number
  partnerId?: string | null
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

export type AdminRole = 'super_admin' | 'partner' | 'mentor' | 'ambassador' | 'team_leader'

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
