import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { removeUndefinedFields } from '@/utils/firestore';
import { ApprovalRecord, ApprovalSource, ApprovalWorkflowType } from '@/types/approvals';
import { ApprovalType } from '@/config/pointsConfig';
import { awardChecklistPoints } from './pointsService';
import { PointsVerificationRequest } from './pointsVerificationService';
import { getActivityDefinitionById, resolveCanonicalActivityId } from '@/config/pointsConfig';
import { createInAppNotification } from './notificationService';
import { logAdminAction } from './superAdminService';
import { upsertChecklistActivity } from './checklistService';

/**
 * Creates a new approval request in the `approvals` collection.
 *
 * @param params - The parameters for the approval request.
 * @param params.userId - The ID of the user submitting the request.
 * @param params.type - The type of the approval workflow.
 * @param params.title - The title of the approval request.
 * @param params.source - The source of the approval request.
 * @param params.summary - A summary of the request.
 * @param params.points - The number of points associated with the request.
 * @returns The ID of the newly created approval record.
 */
export async function createApprovalRequest(params: {
  userId: string;
  organizationId?: string | null;
  type: ApprovalWorkflowType;
  approvalType?: ApprovalType;
  title: string;
  source: ApprovalSource;
  summary?: string;
  points?: number;
  status?: string;
}): Promise<string> {
  const {
    userId,
    organizationId,
    type,
    approvalType,
    title,
    source,
    summary,
    points,
    status = 'pending',
  } = params;

  try {
    const approvalData = removeUndefinedFields({
      userId,
      organizationId: organizationId || null,
      type,
      approvalType,
      title,
      source,
      summary: summary || null,
      points: points || null,
      status,
      createdAt: serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      searchText: `${title.toLowerCase()} ${userId.toLowerCase()} ${approvalType || ''}`,
    });

    const approvalRef = await addDoc(collection(db, 'approvals'), approvalData);

    return approvalRef.id;
  } catch (error) {
    console.error('Error creating approval request:', error);
    throw new Error('Failed to create approval request');
  }
}

/**
 * Approves an approval request.
 *
 * @param approvalId - The ID of the approval record to approve.
 * @param reviewedBy - The ID of the user who reviewed the request.
 */
export async function approveRequest(approvalId: string, reviewedBy: string): Promise<void> {
  const approvalRef = doc(db, 'approvals', approvalId);
  const approvalSnap = await getDoc(approvalRef);
  if (!approvalSnap.exists()) {
    throw new Error('Approval request not found');
  }
  const approvalRecord = approvalSnap.data() as ApprovalRecord;
  const request = approvalRecord.source as PointsVerificationRequest;
  const userProfileRef = doc(db, 'profiles', approvalRecord.userId);
  const userProfileSnap = await getDoc(userProfileRef);
  if (!userProfileSnap.exists()) {
    throw new Error('User profile not found');
  }
  const journeyType = userProfileSnap.data().journeyType;
  const activity = getActivityDefinitionById({
    journeyType,
    activityId: request.activity_id,
  });
  const canonicalActivityId = resolveCanonicalActivityId(request.activity_id) ?? request.activity_id;

  if (!activity) {
    throw new Error('Activity not found');
  }

  try {
    const approvalPayload = {
      status: 'approved',
      reviewedBy,
      reviewedAt: serverTimestamp(),
    };

    await updateDoc(approvalRef, approvalPayload);

    try {
      await awardChecklistPoints({
        uid: approvalRecord.userId,
        journeyType: journeyType,
        weekNumber: request.week,
        activity: activity,
        source: 'approval',
      });
    } catch (error) {
      console.error('[approvalsService] Failed to award checklist points after approval:', error);
      try {
        await updateDoc(approvalRef, {
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
        });
      } catch (revertError) {
        console.error(
          '[approvalsService] Failed to revert approval record after award failure:',
          revertError,
        );
      }
      throw error;
    }

    // Mirror status into points_verification_requests/checklists (if this approval was created from that flow).
    if (request?.id) {
      try {
        await updateDoc(doc(db, 'points_verification_requests', request.id), {
          status: 'approved',
          approved_by: reviewedBy,
          approved_at: serverTimestamp(),
        });
      } catch (error) {
        console.error('[approvalsService] Failed to update points_verification_requests after approval:', error);
      }
    }

    try {
      await upsertChecklistActivity({
        userId: approvalRecord.userId,
        weekNumber: request.week,
        activityId: canonicalActivityId,
        patch: {
          status: 'completed',
          hasInteracted: true,
          proofUrl: request.proof_url ?? null,
          notes: request.notes ?? null,
          rejectionReason: null,
        },
      });
    } catch (error) {
      console.error('[approvalsService] Failed to update checklist after approval:', error);
    }

    try {
      await createInAppNotification({
        userId: approvalRecord.userId,
        title: 'Activity Submission Approved',
        message: `Your submission for "${approvalRecord.title}" was approved and ${activity.points.toLocaleString()} points were added.`,
        type: 'approval',
        relatedId: request?.id || approvalId,
        metadata: request?.activity_id && typeof request?.week === 'number'
          ? {
              actionUrl: `/app/weekly-checklist?week=${encodeURIComponent(String(request.week))}`,
              week: request.week,
              activityId: canonicalActivityId,
              requestId: request.id,
              points: activity.points,
            }
          : { points: activity.points },
      });
    } catch (error) {
      console.error('[approvalsService] Failed to notify user after approval:', error);
    }

    // Log admin action (after points are awarded)
    try {
      await logAdminAction({
        action: 'approval_request_approved',
        adminId: reviewedBy,
        userId: approvalRecord.userId,
        metadata: {
          approvalId,
          type: approvalRecord.type,
          title: approvalRecord.title,
          points: approvalRecord.points,
        },
      });
    } catch (error) {
      console.error('[approvalsService] Failed to log admin action:', error);
    }
  } catch (error) {
    console.error('Error approving request:', error);
    throw new Error('Failed to approve request');
  }
}

/**
 * Rejects an approval request.
 *
 * @param approvalId - The ID of the approval record to reject.
 * @param reviewedBy - The ID of the user who reviewed the request.
 * @param rejectionReason - The reason for rejecting the request.
 */
export async function rejectRequest(
  approvalId: string,
  reviewedBy: string,
  rejectionReason: string
): Promise<void> {
  const approvalRef = doc(db, 'approvals', approvalId);
  const approvalSnap = await getDoc(approvalRef);
  if (!approvalSnap.exists()) {
    throw new Error('Approval request not found');
  }
  const approvalRecord = approvalSnap.data() as ApprovalRecord;
  const request = approvalRecord.source as Partial<PointsVerificationRequest> | undefined;

  try {
    await updateDoc(approvalRef, {
      status: 'rejected',
      reviewedBy,
      rejectionReason,
      reviewedAt: serverTimestamp(),
    });

    // Mirror status into points_verification_requests/checklists (if this approval was created from that flow).
    if (request?.id && request?.activity_id && typeof request?.week === 'number') {
      const canonicalActivityId = resolveCanonicalActivityId(request.activity_id) ?? request.activity_id;
      try {
        await updateDoc(doc(db, 'points_verification_requests', request.id), {
          status: 'rejected',
          rejected_by: reviewedBy,
          rejected_at: serverTimestamp(),
          rejection_reason: rejectionReason,
        });
      } catch (error) {
        console.error('[approvalsService] Failed to update points_verification_requests after rejection:', error);
      }

      try {
        await upsertChecklistActivity({
          userId: approvalRecord.userId,
          weekNumber: request.week,
          activityId: canonicalActivityId,
          patch: {
            status: 'rejected',
            hasInteracted: false,
            proofUrl: (request as PointsVerificationRequest).proof_url ?? null,
            notes: (request as PointsVerificationRequest).notes ?? null,
            rejectionReason: rejectionReason,
          },
        });
      } catch (error) {
        console.error('[approvalsService] Failed to update checklist after rejection:', error);
      }
    }

    // Log admin action
    try {
      await logAdminAction({
        action: 'approval_request_rejected',
        adminId: reviewedBy,
        userId: approvalRecord.userId,
        metadata: {
          approvalId,
          type: approvalRecord.type,
          title: approvalRecord.title,
          reason: rejectionReason,
        },
      });
    } catch (error) {
      console.error('[approvalsService] Failed to log admin action:', error);
    }

    await createInAppNotification({
      userId: approvalRecord.userId,
      title: 'Activity Submission Rejected',
      message: `Your submission for "${approvalRecord.title}" was rejected. Reason: ${rejectionReason}`,
      type: 'approval',
      relatedId: request?.id,
      metadata: request?.activity_id && typeof request?.week === 'number'
        ? {
            actionUrl: `/app/weekly-checklist?week=${encodeURIComponent(String(request.week))}&activityId=${encodeURIComponent(String(resolveCanonicalActivityId(request.activity_id) ?? request.activity_id))}&openProof=1`,
            week: request.week,
            activityId: resolveCanonicalActivityId(request.activity_id) ?? request.activity_id,
            requestId: request.id,
          }
        : {},
    });
  } catch (error) {
    console.error('Error rejecting request:', error);
    throw new Error('Failed to reject request');
  }
}

/**
 * Approves multiple approval requests in a batch.
 *
 * @param approvalIds - An array of IDs of the approval records to approve.
 * @param reviewedBy - The ID of the user who reviewed the requests.
 */
export async function bulkApproveRequests(approvalIds: string[], reviewedBy: string): Promise<void> {
  const errors: { approvalId: string; error: unknown }[] = [];

  for (const approvalId of approvalIds) {
    try {
      await approveRequest(approvalId, reviewedBy);
    } catch (error) {
      console.error(`Failed to approve request ${approvalId}:`, error);
      errors.push({ approvalId, error });
    }
  }

  if (errors.length > 0) {
    const failedIds = errors.map((e) => e.approvalId).join(', ');
    throw new Error(`Failed to approve some requests. IDs: ${failedIds}`);
  }
}
