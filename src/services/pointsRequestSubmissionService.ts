import { supabase } from '@/services/supabase'
import type { ApprovalType } from '@/config/pointsConfig'

export class PendingRequestExistsError extends Error {
  constructor() {
    super('pending_request_exists')
    this.name = 'PendingRequestExistsError'
  }
}

/**
 * Submit a points-verification request to the approval queue.
 *
 * Writes to the Supabase `point_verifications` table - the SAME store the admin
 * Approval Center and partner queues read from. (This previously wrote to the
 * Firestore `points_verification_requests` collection, which nothing reads
 * anymore, so submissions never reached partners/admins.)
 *
 * The user column is `uid`. A learner may only have one PENDING request per
 * (week, activity); a rejected request can be resubmitted (a new row).
 */
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
  attemptNumber?: number
}) {
  const { data: existing, error: existingError } = await supabase
    .from('point_verifications')
    .select('id')
    .eq('uid', params.userId)
    .eq('week', params.week)
    .eq('activity_id', params.activityId)
    .eq('status', 'pending')
    .limit(1)
  if (existingError) throw new Error(existingError.message)
  if (existing && existing.length > 0) {
    throw new PendingRequestExistsError()
  }

  const { data, error } = await supabase
    .from('point_verifications')
    .insert({
      uid: params.userId,
      organization_id: params.organizationId ?? null,
      week: params.week,
      activity_id: params.activityId,
      activity_title: params.activityTitle,
      points: params.activityPoints,
      proof_url: params.proofUrl,
      notes: params.notes ?? null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  return { requestId: (data as { id: string }).id }
}
