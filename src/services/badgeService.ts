import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { badges } from '@/config/badges';
import { createInAppNotification } from './notificationService';

export const awardBadge = async (userId: string, badgeId: string) => {
  const badge = badges.find((b) => b.id === badgeId);
  if (!badge) {
    throw new Error(`Badge with id ${badgeId} not found.`);
  }

  const userBadgeRef = doc(db, 'userBadges', `${userId}_${badgeId}`);

  try {
    const wasAwarded = await runTransaction(db, async (transaction) => {
      const userBadgeDoc = await transaction.get(userBadgeRef);
      if (userBadgeDoc.exists()) {
        return false;
      }

      transaction.set(userBadgeRef, {
        userId,
        badgeId,
        createdAt: serverTimestamp(),
      });
      return true;
    });

    if (wasAwarded) {
      await createInAppNotification({
        userId,
        type: 'badge_awarded',
        title: 'New Badge Unlocked!',
        message: `You've earned the "${badge.name}" badge. Congratulations!`,
      });
    }
  } catch (error) {
    console.error(`Error awarding badge ${badgeId} to user ${userId}:`, error);
    throw error;
  }
};
