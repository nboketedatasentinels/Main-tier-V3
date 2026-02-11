import { db } from '@/services/firebase'
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { removeUndefinedFields } from '@/utils/firestore'
import type { ApprovalType } from '@/config/pointsConfig'
import type { PointsVerificationRequest } from './pointsVerificationService'

export class PendingRequestExistsError extends Error {
  constructor() {
    super('pending_request_exists')
    this.name = 'PendingRequestExistsError'
  }
}

export async function submitPointsVerificationRequestAtomic(params: {
  userId: string
  organizationId?: string | null
  week: number
  activityId: string
  activityTitle: string
  activityPoints: number
  proofUrl: string
  notes?: string
  approvalType: ApprovalType
}) {
  const requestId = `${params.userId}__w${params.week}__${params.activityId}`
  const verificationRef = doc(db, 'points_verification_requests', requestId)
  const approvalRef = doc(db, 'approvals', requestId)

  await runTransaction(db, async (tx) => {
    const existingVerification = await tx.get(verificationRef)
    const existingStatus = existingVerification.exists()
      ? (existingVerification.data()?.status ?? 'pending')
      : null

    if (existingStatus === 'pending') {
      throw new PendingRequestExistsError()
    }

    const preservedCreatedAt = existingVerification.exists()
      ? (existingVerification.data()?.created_at ?? serverTimestamp())
      : serverTimestamp()

    const sourcePayload: PointsVerificationRequest = {
      id: requestId,
      user_id: params.userId,
      organizationId: params.organizationId ?? null,
      week: params.week,
      activity_id: params.activityId,
      activity_title: params.activityTitle,
      points: params.activityPoints,
      proof_url: params.proofUrl,
      notes: params.notes,
      status: 'pending',
      created_at: preservedCreatedAt,
    }

    tx.set(
      verificationRef,
      removeUndefinedFields({
        user_id: params.userId,
        organizationId: params.organizationId ?? null,
        week: params.week,
        activity_id: params.activityId,
        activity_title: params.activityTitle,
        points: params.activityPoints,
        proof_url: params.proofUrl,
        notes: params.notes,
        status: 'pending',
        created_at: preservedCreatedAt,
        updated_at: serverTimestamp(),
        approval_id: requestId,
      }),
      { merge: true },
    )

    tx.set(
      approvalRef,
      removeUndefinedFields({
        userId: params.userId,
        organizationId: params.organizationId ?? null,
        type: 'points_verification',
        approvalType: params.approvalType,
        title: params.activityTitle,
        source: sourcePayload,
        summary: params.notes || null,
        points: params.activityPoints,
        status: 'pending',
        createdAt: preservedCreatedAt,
        updatedAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        searchText: `${params.activityTitle.toLowerCase()} ${params.userId.toLowerCase()} ${params.approvalType.toLowerCase()}`,
      }),
      { merge: true },
    )
  })

  return { requestId }
}
