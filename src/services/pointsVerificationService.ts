import {
  QueryConstraint,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/services/firebase'

export type PointsVerificationRequestStatus = 'pending' | 'approved' | 'rejected'

export interface PointsVerificationRequest {
  id: string
  user_id: string
  week: number
  activity_id: string
  activity_title?: string
  points?: number
  proof_url?: string
  notes?: string
  status?: PointsVerificationRequestStatus
  created_at?: any
  approved_at?: any
  approved_by?: string | null
  approved_by_name?: string | null
  rejected_at?: any
  rejected_by?: string | null
  rejected_by_name?: string | null
  rejection_reason?: string | null
}

interface ApproverInfo {
  id?: string | null
  name?: string | null
}

/**
 * Listens to pending points verification requests.
 */
export const listenToPointsVerificationRequests = (
  onChange: (requests: PointsVerificationRequest[]) => void,
) => {
  const verificationQuery = query(
    collection(db, 'points_verification_requests'),
    where('status', '==', 'pending'),
    orderBy('created_at', 'desc'),
  )

  return onSnapshot(verificationQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as PointsVerificationRequest
        return { ...data, id: docSnap.id }
      }),
    )
  })
}

/**
 * Listens to all points verification requests with filters.
 */
export const listenToAllPointsVerificationRequests = (
  onChange: (requests: PointsVerificationRequest[]) => void,
  options?: { status?: PointsVerificationRequestStatus | 'all'; limit?: number },
  onError?: (error: unknown) => void,
) => {
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc')]
  if (options?.status && options.status !== 'all') {
    constraints.push(where('status', '==', options.status))
  }
  if (options?.limit) {
    constraints.push(limit(options.limit))
  }

  const verificationQuery = query(collection(db, 'points_verification_requests'), ...constraints)

  return onSnapshot(
    verificationQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as PointsVerificationRequest
          return { ...data, id: docSnap.id }
        }),
      )
    },
    (error) => {
      onError?.(error)
    },
  )
}

/**
 * Approves a points verification request via a secure Cloud Function.
 */
export const approvePointsVerificationRequest = async (params: {
  request: PointsVerificationRequest
  approver?: ApproverInfo
}) => {
  const approveRequest = httpsCallable<any, { success: boolean }>(
    functions,
    'approvePointsVerificationRequest'
  )
  return approveRequest({
    requestId: params.request.id,
    approverId: params.approver?.id,
    approverName: params.approver?.name,
  })
}

/**
 * Rejects a points verification request via a secure Cloud Function.
 */
export const rejectPointsVerificationRequest = async (params: {
  request: PointsVerificationRequest
  approver?: ApproverInfo
  reason?: string
}) => {
  const rejectRequest = httpsCallable<any, { success: boolean }>(
    functions,
    'rejectPointsVerificationRequest'
  )
  return rejectRequest({
    requestId: params.request.id,
    approverId: params.approver?.id,
    approverName: params.approver?.name,
    reason: params.reason,
  })
}
