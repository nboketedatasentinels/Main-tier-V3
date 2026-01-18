import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { createSnapshotErrorHandler } from '@/utils/firestoreErrorHandling';

export interface WeeklyProgress {
  uid: string;
  weekNumber: number;
  monthNumber: number;
  pointsEarned: number;
  weeklyTarget: number;
  engagementCount: number;
  status: 'on_track' | 'warning' | 'alert' | 'recovery';
  updatedAt?: any;
}

export interface WindowProgress {
  uid: string;
  windowNumber: number;
  pointsEarned: number;
  windowTarget: number;
  status: 'on_track' | 'warning' | 'alert' | 'recovery';
  updatedAt?: any;
  [key: string]: any;
}

export interface ChecklistState {
  activities: Array<{
    id: string;
    status: 'available' | 'completed' | 'locked';
    hasInteracted?: boolean;
    proofUrl?: string;
    notes?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

/**
 * Listen to weekly progress for a specific week
 */
export const listenToWeeklyProgress = (
  userId: string,
  weekNumber: number,
  onChange: (progress: WeeklyProgress | null) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const ref = doc(db, 'weeklyProgress', `${userId}__${weekNumber}`);

  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onChange(snap.data() as WeeklyProgress);
      } else {
        onChange(null);
      }
    },
    createSnapshotErrorHandler('weekly progress', onError)
  );
};

/**
 * Listen to window progress for a specific window
 */
export const listenToWindowProgress = (
  userId: string,
  windowNumber: number,
  onChange: (progress: WindowProgress | null) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const ref = doc(db, 'windowProgress', `${userId}__${windowNumber}`);

  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onChange(snap.data() as WindowProgress);
      } else {
        onChange(null);
      }
    },
    createSnapshotErrorHandler('window progress', onError)
  );
};

/**
 * Persist checklist state to Firestore
 */
export const persistChecklistState = async (
  userId: string,
  weekNumber: number,
  state: ChecklistState
): Promise<void> => {
  try {
    const checklistRef = doc(db, 'checklists', `${userId}_${weekNumber}`);
    await setDoc(
      checklistRef,
      {
        ...state,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('[weeklyProgressService] Error persisting checklist:', error);
    throw new Error('Failed to save checklist state. Please try again.');
  }
};
