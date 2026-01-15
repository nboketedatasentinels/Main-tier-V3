import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { ApprovalRecord, ApprovalSource, ApprovalWorkflowType } from '@/types/approvals';
import { awardChecklistPoints } from './pointsService';
import { PointsVerificationRequest } from './pointsVerificationService';
import { getActivitiesForJourney } from '@/config/pointsConfig';
import { createNotification } from './notificationService';

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
  type: ApprovalWorkflowType;
  title: string;
  source: ApprovalSource;
  summary?: string;
  points?: number;
}): Promise<string> {
  const { userId, type, title, source, summary, points } = params;

  try {
    const approvalData = {
      userId,
      type,
      title,
      source,
      summary: summary || null,
      points: points || null,
      status: 'pending',
      createdAt: serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      searchText: `${title.toLowerCase()} ${userId.toLowerCase()}`,
    };

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
  const activities = getActivitiesForJourney(journeyType);
  const activity = activities.find((a) => a.id === request.activity_id);

  if (!activity) {
    throw new Error('Activity not found');
  }

  try {
    await updateDoc(approvalRef, {
      status: 'approved',
      reviewedBy,
      reviewedAt: serverTimestamp(),
    });

    await awardChecklistPoints({
      uid: approvalRecord.userId,
      journeyType: journeyType,
      weekNumber: request.week,
      activity: activity,
      source: 'approval',
    });
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

  try {
    await updateDoc(approvalRef, {
      status: 'rejected',
      reviewedBy,
      rejectionReason,
      reviewedAt: serverTimestamp(),
    });

    await createNotification({
      userId: approvalRecord.userId,
      title: 'Activity Submission Rejected',
      message: `Your submission for "${approvalRecord.title}" was rejected. Reason: ${rejectionReason}`,
      type: 'approval',
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
