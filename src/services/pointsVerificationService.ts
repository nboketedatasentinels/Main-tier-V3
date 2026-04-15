import {
  FieldValue,
  QueryConstraint,
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { awardChecklistPoints } from './pointsService'
import { getActivityDefinitionById, resolveCanonicalActivityId } from '@/config/pointsConfig'
import { createInAppNotification } from './notificationService'
import { resolveJourneyType } from '@/utils/journeyType'
import { logAdminAction } from './superAdminService'
import { upsertChecklistActivity } from './checklistService'

export type PointsVerificationRequestStatus = 'pending' | 'approved' | 'rejected'

export interface PointsVerificationRequest {
  id: string
  user_id: string
  organizationId?: string | null
  week: number
  activity_id: string
  activity_title?: string
  points?: number
  proof_url?: string
  notes?: string
  status?: PointsVerificationRequestStatus
  created_at?: Timestamp | FieldValue | Date | string | number | { toDate?: () => Date } | null
  approved_at?: Timestamp | FieldValue | Date | string | number | { toDate?: () => Date } | null
  approved_by?: string | null
  approved_by_name?: string | null
  rejected_at?: Timestamp | FieldValue | Date | string | number | { toDate?: () => Date } | null
  rejected_by?: string | null
  rejected_by_name?: string | null
  rejection_reason?: string | null
}

const timestampToMillis = (value: unknown): number => {
  if (!value) return 0
  if (value instanceof Timestamp) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (typeof value === 'object' && 'toDate' in value) {
    const maybeDate = (value as { toDate?: () => Date }).toDate?.()
    return maybeDate instanceof Date ? maybeDate.getTime() : 0
  }
  return 0
}

const mapAndSortRequests = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }): PointsVerificationRequest[] => {
  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as PointsVerificationRequest
      return { ...data, id: docSnap.id }
    })
    .sort((left, right) => timestampToMillis(right.created_at) - timestampToMillis(left.created_at))
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
  const baseQuery = query(collection(db, 'points_verification_requests'), where('status', '==', 'pending'))
  return onSnapshot(
    baseQuery,
    (snapshot) => {
      onChange(mapAndSortRequests(snapshot as { docs: Array<{ id: string; data: () => unknown }> }))
    },
    (error) => {
      console.error('[pointsVerificationService] Failed to subscribe to pending requests:', error)
    },
  )
}

/**
 * Listens to all points verification requests with filters.
 */
export const listenToAllPointsVerificationRequests = (
  onChange: (requests: PointsVerificationRequest[]) => void,
  options?: { status?: PointsVerificationRequestStatus | 'all'; limit?: number },
  onError?: (error: unknown) => void,
) => {
  const filters: QueryConstraint[] = []
  if (options?.status && options.status !== 'all') {
    filters.push(where('status', '==', options.status))
  }

  const unorderedQuery = query(collection(db, 'points_verification_requests'), ...filters)
  return onSnapshot(
    unorderedQuery,
    (snapshot) => {
      const mapped = mapAndSortRequests(snapshot as { docs: Array<{ id: string; data: () => unknown }> })
      onChange(options?.limit ? mapped.slice(0, options.limit) : mapped)
    },
    (error) => {
      onError?.(error)
    },
  )
}

/**
 * Listens to pending points verification requests filtered by organization IDs.
 * For partners, pass their assigned organization IDs.
 * For admins/super_admins, pass empty array or undefined to get all.
 */
export const listenToPointsVerificationRequestsByOrganizations = (
  onChange: (requests: PointsVerificationRequest[]) => void,
  organizationIds?: string[],
  onError?: (error: unknown) => void,
) => {
  const filters: QueryConstraint[] = [where('status', '==', 'pending')]

  // If organizationIds provided and not empty, add organization filter
  // Note: Firestore 'in' queries are limited to 30 items
  if (organizationIds && organizationIds.length > 0) {
    if (organizationIds.length > 30) {
      console.warn(
        '[pointsVerificationService] Organization IDs exceed Firestore limit of 30. ' +
          'Only first 30 organizations will be queried.',
      )
    }
    const queryOrgIds = organizationIds.slice(0, 30)
    filters.push(where('organizationId', 'in', queryOrgIds))
  }

  const scopedQuery = query(collection(db, 'points_verification_requests'), ...filters)
  return onSnapshot(
    scopedQuery,
    (snapshot) => {
      onChange(mapAndSortRequests(snapshot as { docs: Array<{ id: string; data: () => unknown }> }))
    },
    (error) => {
      onError?.(error)
    },
  )
}

/**
 * Approves a points verification request by updating Firestore directly and awarding points.
 */
export const approvePointsVerificationRequest = async (params: {
  request: PointsVerificationRequest
  approver?: ApproverInfo
}) => {
  const requestRef = doc(db, 'points_verification_requests', params.request.id)

  // Get user profile for journey type
  const userProfileRef = doc(db, 'profiles', params.request.user_id)
  const userProfileSnap = await getDoc(userProfileRef)
  if (!userProfileSnap.exists()) {
    throw new Error('User profile not found')
  }

  const profileData = userProfileSnap.data()
  const journeyType =
    resolveJourneyType({
      journeyType: profileData.journeyType,
      programDurationWeeks: profileData.programDurationWeeks,
      programDuration: profileData.programDuration,
    }) ?? '6W'
  const activity = getActivityDefinitionById({
    journeyType,
    activityId: params.request.activity_id,
  })
  const canonicalActivityId = resolveCanonicalActivityId(params.request.activity_id) ?? params.request.activity_id

  if (!activity) {
    throw new Error('Activity not found')
  }

  const approverPayload = {
    status: 'approved',
    approved_by: params.approver?.id ?? null,
    approved_by_name: params.approver?.name ?? null,
    approved_at: serverTimestamp(),
  }

  // Update request status before awarding to keep locks in place
  await updateDoc(requestRef, approverPayload)

  try {
    await awardChecklistPoints({
      uid: params.request.user_id,
      journeyType,
      weekNumber: params.request.week,
      activity,
      source: 'approval',
      claimRef: params.request.id,
    })
  } catch (error) {
    console.error('[pointsVerificationService] Failed to award checklist points after approval:', error)
    try {
      await updateDoc(requestRef, {
        status: 'pending',
        approved_by: null,
        approved_by_name: null,
        approved_at: null,
      })
      await setDoc(
        doc(db, 'approvals', params.request.id),
        {
          userId: params.request.user_id,
          organizationId: params.request.organizationId ?? null,
          type: 'points_verification',
          approvalType: 'partner_approved',
          title: params.request.activity_title || params.request.activity_id,
          source: {
            ...params.request,
            id: params.request.id,
          },
          summary: params.request.notes ?? null,
          points: params.request.points ?? null,
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
          updatedAt: serverTimestamp(),
          searchText: `${(params.request.activity_title || params.request.activity_id || '').toLowerCase()} ${params.request.user_id.toLowerCase()} partner_approved`,
        },
        { merge: true },
      )
    } catch (revertError) {
      console.error('[pointsVerificationService] Failed to revert approval status after award failure:', revertError)
    }
    throw error
  }

  try {
    await upsertChecklistActivity({
      userId: params.request.user_id,
      weekNumber: params.request.week,
      activityId: canonicalActivityId,
      patch: {
        status: 'completed',
        hasInteracted: true,
        proofUrl: params.request.proof_url ?? null,
        notes: params.request.notes ?? null,
        rejectionReason: null,
      },
    })
  } catch (error) {
    console.error('[pointsVerificationService] Failed to update checklist after approval:', error)
  }

  // Log admin action (after points cleared)
  try {
    await logAdminAction({
      action: 'points_request_approved',
      adminId: params.approver?.id || undefined,
      adminName: params.approver?.name || undefined,
      userId: params.request.user_id,
      metadata: {
        requestId: params.request.id,
        activityId: canonicalActivityId,
        points: activity.points,
      },
    })
  } catch (error) {
    console.error('[pointsVerificationService] Failed to log admin action:', error)
  }

  try {
    await setDoc(
      doc(db, 'approvals', params.request.id),
      {
        userId: params.request.user_id,
        organizationId: params.request.organizationId ?? null,
        type: 'points_verification',
        approvalType: 'partner_approved',
        title: params.request.activity_title || params.request.activity_id,
        source: {
          ...params.request,
          id: params.request.id,
        },
        summary: params.request.notes ?? null,
        points: activity.points,
        status: 'approved',
        reviewedBy: params.approver?.id ?? null,
        reviewedAt: serverTimestamp(),
        rejectionReason: null,
        updatedAt: serverTimestamp(),
        searchText: `${(params.request.activity_title || params.request.activity_id || '').toLowerCase()} ${params.request.user_id.toLowerCase()} partner_approved`,
      },
      { merge: true },
    )
  } catch (error) {
    console.error('[pointsVerificationService] Failed to mirror approved status to approvals:', error)
  }

  try {
    await createInAppNotification({
      userId: params.request.user_id,
      title: 'Activity Submission Approved',
      message: `Your submission for "${params.request.activity_title || params.request.activity_id}" was approved and ${activity.points.toLocaleString()} points were added.`,
      type: 'approval',
      relatedId: params.request.id,
      metadata: {
        week: params.request.week,
        activityId: canonicalActivityId,
        requestId: params.request.id,
        points: activity.points,
        actionUrl: '/app/weekly-checklist',
      },
    })
  } catch (error) {
    console.error('[pointsVerificationService] Failed to notify user after approval:', error)
  }

  return { data: { success: true } }
}

/**
 * Rejects a points verification request by updating Firestore directly and notifying the user.
 */
export const rejectPointsVerificationRequest = async (params: {
  request: PointsVerificationRequest
  approver?: ApproverInfo
  reason?: string
}) => {
  const requestRef = doc(db, 'points_verification_requests', params.request.id)

  await updateDoc(requestRef, {
    status: 'rejected',
    rejected_by: params.approver?.id ?? null,
    rejected_by_name: params.approver?.name ?? null,
    rejected_at: serverTimestamp(),
    rejection_reason: params.reason ?? null,
  })

  try {
    await setDoc(
      doc(db, 'approvals', params.request.id),
      {
        userId: params.request.user_id,
        organizationId: params.request.organizationId ?? null,
        type: 'points_verification',
        approvalType: 'partner_approved',
        title: params.request.activity_title || params.request.activity_id,
        source: {
          ...params.request,
          id: params.request.id,
        },
        summary: params.request.notes ?? null,
        points: params.request.points ?? null,
        status: 'rejected',
        reviewedBy: params.approver?.id ?? null,
        reviewedAt: serverTimestamp(),
        rejectionReason: params.reason ?? null,
        updatedAt: serverTimestamp(),
        searchText: `${(params.request.activity_title || params.request.activity_id || '').toLowerCase()} ${params.request.user_id.toLowerCase()} partner_approved`,
      },
      { merge: true },
    )
  } catch (error) {
    console.error('[pointsVerificationService] Failed to mirror rejected status to approvals:', error)
  }

  try {
    await upsertChecklistActivity({
      userId: params.request.user_id,
      weekNumber: params.request.week,
      activityId: resolveCanonicalActivityId(params.request.activity_id) ?? params.request.activity_id,
      patch: {
        status: 'rejected',
        // Unlock so the learner can resubmit after rejection.
        hasInteracted: false,
        proofUrl: params.request.proof_url ?? null,
        notes: params.request.notes ?? null,
        rejectionReason: params.reason ?? null,
      },
    })
  } catch (error) {
    console.error('[pointsVerificationService] Failed to update checklist after rejection:', error)
  }

  // Log admin action
  try {
    await logAdminAction({
      action: 'points_request_rejected',
      adminId: params.approver?.id || undefined,
      adminName: params.approver?.name || undefined,
      userId: params.request.user_id,
      metadata: {
        requestId: params.request.id,
        activityId: params.request.activity_id,
        reason: params.reason,
      },
    })
  } catch (error) {
    console.error('[pointsVerificationService] Failed to log admin action:', error)
  }

  // Notify user of rejection
  await createInAppNotification({
    userId: params.request.user_id,
    title: 'Activity Submission Rejected',
    message: `Your submission for "${params.request.activity_title || params.request.activity_id}" was rejected.${params.reason ? ` Reason: ${params.reason}` : ''}`,
    type: 'approval',
    relatedId: params.request.id,
    metadata: {
      actionUrl: `/app/weekly-checklist?week=${encodeURIComponent(String(params.request.week))}&activityId=${encodeURIComponent(resolveCanonicalActivityId(params.request.activity_id) ?? params.request.activity_id)}&openProof=1`,
      week: params.request.week,
      activityId: resolveCanonicalActivityId(params.request.activity_id) ?? params.request.activity_id,
      requestId: params.request.id,
    },
  })

  return { data: { success: true } }
}
