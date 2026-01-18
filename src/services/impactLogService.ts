import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { createSnapshotErrorHandler } from '@/utils/firestoreErrorHandling';

export interface ImpactLogEntry {
  id: string;
  userId: string;
  companyId?: string;
  category: string;
  description: string;
  hoursInvested?: number;
  valueGenerated?: number;
  peopleImpacted?: number;
  verificationLevel: 'self_attested' | 'mentor_verified' | 'partner_verified';
  createdAt: any;
  [key: string]: any;
}

/**
 * Listen to a user's personal impact logs in real-time
 */
export const listenToUserImpactLogs = (
  userId: string,
  onChange: (logs: ImpactLogEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'impact_logs'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ImpactLogEntry[];
      onChange(logs);
    },
    createSnapshotErrorHandler('personal impact logs', onError)
  );
};

/**
 * Listen to a company's impact logs in real-time
 */
export const listenToCompanyImpactLogs = (
  companyId: string,
  onChange: (logs: ImpactLogEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'impact_logs'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ImpactLogEntry[];
      onChange(logs);
    },
    createSnapshotErrorHandler('company impact logs', onError)
  );
};

/**
 * Add a new impact log entry
 */
export const addImpactLog = async (entry: Omit<ImpactLogEntry, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const payload = {
      ...entry,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'impact_logs'), payload);
    return docRef.id;
  } catch (error) {
    console.error('[impactLogService] Error adding impact log:', error);
    throw new Error('Failed to add impact log. Please try again.');
  }
};

/**
 * Delete an impact log entry
 */
export const deleteImpactLog = async (entryId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'impact_logs', entryId));
  } catch (error) {
    console.error('[impactLogService] Error deleting impact log:', error);
    throw new Error('Failed to delete impact log. Please try again.');
  }
};
