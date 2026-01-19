import { ApprovalWorkflowType } from '@/types/approvals'

export type ApprovalTypeMeta = {
  label: string
  description: string
  badgeColor: string
}

const approvalTypeMap: Record<ApprovalWorkflowType, ApprovalTypeMeta> = {
  points_verification: {
    label: 'Points Verification',
    description: 'Partner-submitted proof awaiting points confirmation.',
    badgeColor: 'purple',
  },
  upgrade_request: {
    label: 'Upgrade Request',
    description: 'Tier upgrades and corporate approval requests.',
    badgeColor: 'blue',
  },
  partner_issued: {
    label: 'Partner Issued',
    description: 'Activities directly assigned by a partner.',
    badgeColor: 'teal',
  },
}

export const getApprovalTypeMeta = (type: ApprovalWorkflowType): ApprovalTypeMeta => approvalTypeMap[type]
