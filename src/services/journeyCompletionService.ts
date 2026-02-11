import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { evaluateJourneyCompletion, CompletionResult } from '@/utils/completion';
import { JourneyType } from '@/config/pointsConfig';
import { awardBadge } from './badgeService';
import { badges } from '@/config/badges';

export const getJourneyBadgeId = (journeyType: JourneyType) => {
  return badges.find(b => b.journeyType === journeyType)?.id;
};

export const updateJourneyStatus = async (
  userId: string,
  status: 'active' | 'completed' | 'failed' | 'abandoned',
  completionDetails?: CompletionResult
) => {
  const userRef = doc(db, 'users', userId);
  const updates: Record<string, unknown> = {
    journeyStatus: status,
    updatedAt: serverTimestamp(),
  };

  if (status === 'completed') {
    updates.completedAt = new Date().toISOString();
  }

  await setDoc(userRef, updates, { merge: true });

  if (status === 'completed' && completionDetails) {
    const historyRef = collection(db, 'users', userId, 'journeyHistory');
    await addDoc(historyRef, {
      journeyType: completionDetails.journeyType,
      status,
      pointsEarned: completionDetails.pointsEarned,
      passMark: completionDetails.passMark,
      totalTarget: completionDetails.totalTarget,
      adjustmentDetails: completionDetails.adjustmentDetails,
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }
};

export const checkAndHandleJourneyCompletion = async (userId: string, journeyType: JourneyType) => {
  try {
    const result = await evaluateJourneyCompletion(userId, journeyType);
    if (result.isCompleted) {
      // 1. Award badge
      const badgeId = getJourneyBadgeId(journeyType);
      if (badgeId) {
        await awardBadge(userId, badgeId);
      }

      // 2. Update status and history
      // Note: awardBadge is idempotent, but we should also be careful with status updates
      // However, updating to 'completed' multiple times is generally fine if it's already completed.
      await updateJourneyStatus(userId, 'completed', result);
    }
  } catch (error) {
    console.error(`Error in checkAndHandleJourneyCompletion for user ${userId}:`, error);
  }
};
