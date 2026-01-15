import { PointsVerificationRequest } from '@/services/pointsVerificationService'
import { UpgradeRequest } from '@/types/upgrade'

export type ApprovalWorkflowType = 'points_verification' | 'upgrade_request'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export type ApprovalSource = PointsVerificationRequest | UpgradeRequest

export interface ApprovalRecord {
  id: string
  type: ApprovalWorkflowType
  status: ApprovalStatus
  createdAt: Date | null
  userId: string
  title: string
  summary?: string | null
  points?: number | null
  source: ApprovalSource
  searchText: string
  rejectionReason?: string
  reviewedBy?: string
  reviewedAt?: Date | null
}
