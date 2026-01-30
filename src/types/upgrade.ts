import { Timestamp } from 'firebase/firestore'

export type UpgradeRequestType = 'individual' | 'corporate_approval' | 'tier_change'
export type UpgradeRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export interface UpgradeRequest {
  id: string
  user_id: string
  request_type: UpgradeRequestType
  current_tier: string | null
  requested_tier: string | null
  status: UpgradeRequestStatus
  message?: string | null
  admin_notes?: string | null
  villageId?: string | null
  villageName?: string | null
  villageDescription?: string | null
  userDetails?: {
    fullName?: string | null
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    role?: string | null
    phoneNumber?: string | null
    companyId?: string | null
    organizationId?: string | null
  } | null
  requested_at: string
  reviewed_at?: string | null
  reviewed_by?: string | null
  contact_preference?: string | null
  contact_details?: string | null
}

export interface RawUpgradeRequest extends Omit<UpgradeRequest, 'requested_at' | 'reviewed_at'> {
  requested_at: Timestamp | null
  reviewed_at?: Timestamp | null
}

export interface UpgradeRequestForm {
  requestType: UpgradeRequestType
  currentTier?: string | null
  requestedTier?: string | null
  message?: string
  contactPreference?: 'email' | 'phone'
  contactDetails?: string
}
