import { PointsVerificationRequest } from '@/services/pointsVerificationService'
import { UpgradeRequest } from '@/types/upgrade'
import { ApprovalType } from '@/config/pointsConfig'

export type ApprovalWorkflowType = 'points_verification' | 'upgrade_request' | 'partner_issued'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export type ApprovalSource = PointsVerificationRequest | UpgradeRequest | Record<string, unknown>

export interface ApprovalRecord {
  id: string
  type: ApprovalWorkflowType
  approvalType?: ApprovalType
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
