import type { Timestamp } from 'firebase/firestore'
import type { OrganizationRecord } from './admin'
import type { UserProfile } from './index'

export interface PartnerAdminRootDoc {
  id: string
  name?: string
  displayName?: string
  status?: string
  isActive?: boolean
  assignedOrganizations?: string[]
  createdAt?: Timestamp | string | Date
  updatedAt?: Timestamp | string | Date
}

export interface PartnerAdminPointsOverview {
  totalPoints?: number
  pendingRequests?: number
  approvedRequests?: number
}

export interface PartnerAdminPointsRequest {
  id: string
  userId?: string
  organizationId?: string
  points?: number
  status?: string
  createdAt?: Timestamp | string | Date
}

export interface PartnerAdminAnalytics {
  activeUsers?: number
  totalUsers?: number
  engagementRate?: number
}

export interface PartnerAdminAuditLogEntry {
  id: string
  action: string
  adminId?: string
  createdAt?: Timestamp | string | Date
  metadata?: Record<string, unknown>
}

export interface PartnerAdminImpactLogEntry {
  id: string
  userId?: string
  organizationId?: string
  createdAt?: Timestamp | string | Date
  metadata?: Record<string, unknown>
}

export interface PartnerAdminSnapshot {
  partner: PartnerAdminRootDoc | null
  organizations: OrganizationRecord[]
  users: UserProfile[]
  pointsOverview?: PartnerAdminPointsOverview
  pointsRequests?: PartnerAdminPointsRequest[]
  analytics?: PartnerAdminAnalytics
  auditLog?: PartnerAdminAuditLogEntry[]
  impactLog?: PartnerAdminImpactLogEntry[]
}
