import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getFriendlyErrorMessage } from '@/utils/firestoreErrorHandling';

export interface NotificationPreferences {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  weeklyDigest?: boolean;
  challengeInvites?: boolean;
  pointsUpdates?: boolean;
  impactReports?: boolean;
  [key: string]: any;
}

/**
 * Get user's notification preferences
 */
export const getNotificationPreferences = async (userId: string): Promise<NotificationPreferences> => {
  try {
    const ref = doc(db, 'notification_settings', userId);
    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      return snapshot.data() as NotificationPreferences;
    }

    // Return default preferences if none exist
    return {
      emailNotifications: true,
      pushNotifications: true,
      weeklyDigest: true,
      challengeInvites: true,
      pointsUpdates: true,
      impactReports: true,
    };
  } catch (error) {
    console.error('[notificationSettingsService] Error fetching preferences:', error);
    throw new Error(getFriendlyErrorMessage(error, 'load notification preferences'));
  }
};

/**
 * Save user's notification preferences
 */
export const saveNotificationPreferences = async (
  userId: string,
  preferences: NotificationPreferences
): Promise<void> => {
  try {
    const ref = doc(db, 'notification_settings', userId);
    await setDoc(ref, preferences, { merge: true });
  } catch (error) {
    console.error('[notificationSettingsService] Error saving preferences:', error);
    throw new Error(getFriendlyErrorMessage(error, 'save notification preferences'));
  }
};
