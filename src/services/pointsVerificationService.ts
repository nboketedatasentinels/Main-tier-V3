import {
  FieldValue,
  Timestamp,
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { supabase } from '@/services/supabase'
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

// Supabase migration: `point_verifications` (0002) is the canonical store - it
// consolidates the legacy Firestore `points_verification_requests` and
// `points_verifications`, distinguished by `status`. Maps a snake_case row to
// the shape the admin UI already consumes.
type PointVerificationRow = {
  id: string
  uid: string | null
  organization_id: string | null
  week: number | null
  activity_id: string | null
  activity_title: string | null
  points: number | null
  proof_url: string | null
  notes: string | null
  status: PointsVerificationRequestStatus | null
  created_at: string | null
  approved_at: string | null
  approved_by: string | null
  approved_by_name: string | null
  rejected_at: string | null
  rejected_by: string | null
  rejected_by_name: string | null
  rejection_reason: string | null
}

const mapVerificationRow = (row: PointVerificationRow): PointsVerificationRequest => ({
  id: row.id,
  user_id: row.uid ?? '',
  organizationId: row.organization_id ?? null,
  week: row.week ?? 0,
  activity_id: row.activity_id ?? '',
  activity_title: row.activity_title ?? undefined,
  points: row.points ?? undefined,
  proof_url: row.proof_url ?? undefined,
  notes: row.notes ?? undefined,
  status: row.status ?? undefined,
  created_at: row.created_at,
  approved_at: row.approved_at,
  approved_by: row.approved_by,
  approved_by_name: row.approved_by_name,
  rejected_at: row.rejected_at,
  rejected_by: row.rejected_by,
  rejected_by_name: row.rejected_by_name,
  rejection_reason: row.rejection_reason,
})

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
 * Subscribes to all points verification requests with filters.
 *
 * Supabase-backed: does an initial fetch from `point_verifications`, then keeps
 * the list live via a realtime channel. Returns an unsubscribe that tears the
 * channel down, preserving the original listener contract. (The Firestore
 * onSnapshot version failed with "Missing or insufficient permissions" once
 * auth moved to Supabase - the user is no longer authenticated to Firebase.)
 */
// Monotonic suffix so every realtime subscription gets a distinct channel topic
// (see the comment at the channel() call for why this is required).
let pointVerificationChannelSeq = 0

export const listenToAllPointsVerificationRequests = (
  onChange: (requests: PointsVerificationRequest[]) => void,
  options?: { status?: PointsVerificationRequestStatus | 'all'; limit?: number },
  onError?: (error: unknown) => void,
) => {
  let cancelled = false

  const load = async () => {
    let q = supabase
      .from('point_verifications')
      .select('*')
      .order('created_at', { ascending: false })
    if (options?.status && options.status !== 'all') {
      q = q.eq('status', options.status)
    }
    if (options?.limit) {
      q = q.limit(options.limit)
    }
    const { data, error } = await q
    if (cancelled) return
    if (error) {
      onError?.(error)
      return
    }
    onChange((data ?? []).map((row) => mapVerificationRow(row as PointVerificationRow)))
  }

  void load()

  // Unique topic per subscription: supabase.channel(topic) reuses an existing
  // channel with the same topic, so a remount before the async teardown
  // completes (or two mounts at once) would hit an already-subscribed channel
  // and `.on()` would throw "cannot add postgres_changes callbacks after
  // subscribe()". A monotonic suffix guarantees a fresh channel each time.
  const channel = supabase
    .channel(`point_verifications_admin_${++pointVerificationChannelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'point_verifications' },
      () => {
        void load()
      },
    )
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
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
  let cancelled = false
  const orgIds = Array.from(
    new Set((organizationIds ?? []).map((id) => (id ?? '').trim()).filter(Boolean)),
  )

  const load = async () => {
    let q = supabase
      .from('point_verifications')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    // No org filter for super_admin (empty list) -> all pending requests.
    if (orgIds.length > 0) {
      q = q.in('organization_id', orgIds)
    }
    const { data, error } = await q
    if (cancelled) return
    if (error) {
      onError?.(error)
      return
    }
    onChange((data ?? []).map((row) => mapVerificationRow(row as PointVerificationRow)))
  }

  void load()

  const channel = supabase
    .channel(`point_verifications_org_${++pointVerificationChannelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'point_verifications' },
      () => {
        void load()
      },
    )
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}

/**
 * Approves a points verification request by updating Firestore directly and awarding points.
 */
export const approvePointsVerificationRequest = async (params: {
  request: PointsVerificationRequest
  approver?: ApproverInfo
}) => {
  // Resolve the learner's journey type from the Supabase profile so we can look
  // up the activity's point value.
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('journey_type')
    .eq('id', params.request.user_id)
    .maybeSingle()
  if (profileError) throw new Error(profileError.message)

  const journeyType =
    resolveJourneyType({
      journeyType: (profileRow as { journey_type?: string | null } | null)?.journey_type ?? undefined,
    }) ?? '6W'
  const activity = getActivityDefinitionById({
    journeyType,
    activityId: params.request.activity_id,
  })
  const canonicalActivityId = resolveCanonicalActivityId(params.request.activity_id) ?? params.request.activity_id

  if (!activity) {
    throw new Error('Activity not found')
  }

  // Mark approved in the Supabase queue (the store the admin/partner UI reads).
  const { error: approveError } = await supabase
    .from('point_verifications')
    .update({
      status: 'approved',
      approved_by: params.approver?.id ?? null,
      approved_by_name: params.approver?.name ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', params.request.id)
  if (approveError) throw new Error(approveError.message)

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
    // Roll the queue row back to pending so the request can be retried.
    try {
      await supabase
        .from('point_verifications')
        .update({ status: 'pending', approved_by: null, approved_by_name: null, approved_at: null })
        .eq('id', params.request.id)
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
  // Mark rejected in the Supabase queue (the store the admin/partner UI reads).
  const { error: rejectError } = await supabase
    .from('point_verifications')
    .update({
      status: 'rejected',
      rejected_by: params.approver?.id ?? null,
      rejected_by_name: params.approver?.name ?? null,
      rejected_at: new Date().toISOString(),
      rejection_reason: params.reason ?? null,
    })
    .eq('id', params.request.id)
  if (rejectError) throw new Error(rejectError.message)

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

  // Notify user of rejection (best-effort).
  try {
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
  } catch (error) {
    console.error('[pointsVerificationService] Failed to notify user after rejection:', error)
  }

  return { data: { success: true } }
}
