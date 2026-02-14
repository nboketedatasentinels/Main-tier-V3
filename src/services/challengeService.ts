import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';

export const cancelChallenge = async (
  challengeId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const challengeRef = doc(db, 'challenges', challengeId);
    const challengeSnap = await getDoc(challengeRef);

    if (!challengeSnap.exists()) {
      return { success: false, error: 'Challenge not found' };
    }

    const data = challengeSnap.data();

    // Verify user is a participant
    const isParticipant =
      data.challenger_id === userId ||
      data.challenged_id === userId ||
      data.participants?.includes(userId);

    if (!isParticipant) {
      return { success: false, error: 'You are not part of this challenge' };
    }

    // Only allow cancellation of pending/active challenges
    if (data.status === 'completed') {
      return { success: false, error: 'Cannot cancel a completed challenge' };
    }

    // Check if challenge has started (active)
    const now = new Date();
    const startDate = data.start_date?.toDate?.() || new Date(data.start_date);
    const hasStarted = now >= startDate;

    const isActiveChallenge = hasStarted && data.status === 'active';

    // Firestore rules allow participants/admins to update challenges, not delete them.
    // Mark cancelled challenges as completed so they move to history and cannot be cancelled again.
    await updateDoc(challengeRef, {
      status: 'completed',
      cancelled_by: userId,
      cancelled_at: serverTimestamp(),
      ...(isActiveChallenge
        ? {
            result: userId === data.challenger_id
              ? 'challenged_forfeit_win'
              : 'challenger_forfeit_win',
          }
        : {
            result: 'cancelled',
          }),
    });

    return { success: true };
  } catch (error) {
    console.error('[ChallengeService] Cancel failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel challenge'
    };
  }
};
