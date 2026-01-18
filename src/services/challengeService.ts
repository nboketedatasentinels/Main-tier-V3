import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getFriendlyErrorMessage } from '@/utils/firestoreErrorHandling';
import { NotificationType } from '@/types/notifications';

export interface ChallengeData {
  challengerId: string;
  challengerName: string;
  challengeeId: string;
  challengeeName: string;
  activityType: string;
  deadline?: Date;
  wager?: number;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  organizationId?: string;
  [key: string]: any;
}

/**
 * Create a new challenge
 */
export const createChallenge = async (data: Omit<ChallengeData, 'status'>): Promise<string> => {
  try {
    const challengePayload = {
      ...data,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'challenges'), challengePayload);
    return docRef.id;
  } catch (error) {
    console.error('[challengeService] Error creating challenge:', error);
    throw new Error(getFriendlyErrorMessage(error, 'create challenge'));
  }
};

/**
 * Send notification to the challengee
 */
export const notifyChallengee = async (
  userId: string,
  challengeId: string,
  challengerName: string
): Promise<void> => {
  try {
    const notificationPayload = {
      user_id: userId,
      type: 'challenge_invite' as NotificationType,
      title: 'New Challenge!',
      message: `${challengerName} has challenged you!`,
      is_read: false,
      metadata: {
        challengeId,
        challengerName,
      },
      created_at: serverTimestamp(),
    };

    await addDoc(collection(db, 'notifications'), notificationPayload);
  } catch (error) {
    console.error('[challengeService] Error sending notification:', error);
    throw new Error(getFriendlyErrorMessage(error, 'send challenge notification'));
  }
};
