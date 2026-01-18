import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface AnalyticsEvent {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  eventType: string;
  source: string;
  metadata?: Record<string, any>;
}

/**
 * Log a generic analytics event
 */
export const logEvent = async (event: AnalyticsEvent): Promise<void> => {
  try {
    const payload = {
      ...event,
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(db, 'analytics_events'), payload);
  } catch (error) {
    // Analytics errors should not break the user experience
    console.error('[analyticsService] Error logging event:', error);
  }
};

/**
 * Log a book club hub visit
 */
export const logBookClubVisit = async (
  userId: string | null,
  userEmail: string | null,
  userName: string | null,
  source: string
): Promise<void> => {
  try {
    await addDoc(collection(db, 'bookClubVisits'), {
      userId,
      userEmail,
      userName,
      source,
      clickedAt: serverTimestamp(),
    });
  } catch (error) {
    // Analytics errors should not break the user experience
    console.error('[analyticsService] Error logging book club visit:', error);
  }
};
