import {
  FieldValue,
  QueryConstraint,
  Timestamp,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { awardChecklistPoints } from './pointsService'
import { getActivitiesForJourney } from '@/config/pointsConfig'
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
 * Listens to pending points verification requests filtered by organization IDs.
 * For partners, pass their assigned organization IDs.
 * For admins/super_admins, pass empty array or undefined to get all.
 */
export const listenToPointsVerificationRequestsByOrganizations = (
  onChange: (requests: PointsVerificationRequest[]) => void,
  organizationIds?: string[],
  onError?: (error: unknown) => void,
) => {
  const constraints: QueryConstraint[] = [
    where('status', '==', 'pending'),
    orderBy('created_at', 'desc'),
  ]

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
    constraints.push(where('organizationId', 'in', queryOrgIds))
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
  const activities = getActivitiesForJourney(journeyType)
  const activity = activities.find((a) => a.id === params.request.activity_id)

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
    } catch (revertError) {
      console.error('[pointsVerificationService] Failed to revert approval status after award failure:', revertError)
    }
    throw error
  }

  try {
    await upsertChecklistActivity({
      userId: params.request.user_id,
      weekNumber: params.request.week,
      activityId: params.request.activity_id,
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
        activityId: params.request.activity_id,
        points: activity.points,
      },
    })
  } catch (error) {
    console.error('[pointsVerificationService] Failed to log admin action:', error)
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
    await upsertChecklistActivity({
      userId: params.request.user_id,
      weekNumber: params.request.week,
      activityId: params.request.activity_id,
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
      actionUrl: `/app/weekly-checklist?week=${encodeURIComponent(String(params.request.week))}&activityId=${encodeURIComponent(params.request.activity_id)}&openProof=1`,
      week: params.request.week,
      activityId: params.request.activity_id,
      requestId: params.request.id,
    },
  })

  return { data: { success: true } }
}
