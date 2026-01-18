import { collection, onSnapshot, orderBy, query, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { createSnapshotErrorHandler } from '@/utils/firestoreErrorHandling';

export interface VerificationRequest {
  id: string;
  userName: string;
  activityTitle: string;
  points: number;
  created_at?: string;
}

export interface Registration {
  id: string;
  name: string;
  email: string;
  company?: string;
  created_at?: string;
}

export interface SystemAlert {
  id: string;
  level: string;
  message: string;
  component?: string;
  created_at?: string;
}

/**
 * Listen to points verification requests in real-time
 */
export const listenToPointsVerifications = (
  onChange: (verifications: VerificationRequest[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const verificationQuery = query(
    collection(db, 'points_verifications'),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(
    verificationQuery,
    (snapshot) => {
      const verifications = snapshot.docs.map((doc) => ({
        ...(doc.data() as VerificationRequest),
        id: doc.id,
      }));
      onChange(verifications);
    },
    createSnapshotErrorHandler('verification requests', onError)
  );
};

/**
 * Listen to new user registrations in real-time
 */
export const listenToRegistrations = (
  onChange: (registrations: Registration[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const registrationQuery = query(
    collection(db, 'registrations'),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(
    registrationQuery,
    (snapshot) => {
      const registrations = snapshot.docs.map((doc) => ({
        ...(doc.data() as Registration),
        id: doc.id,
      }));
      onChange(registrations);
    },
    createSnapshotErrorHandler('registrations', onError)
  );
};

/**
 * Listen to system health alerts in real-time
 */
export const listenToSystemAlerts = (
  onChange: (alerts: SystemAlert[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const systemAlertsQuery = query(
    collection(db, 'system_health_alerts'),
    orderBy('created_at', 'desc')
  );

  return onSnapshot(
    systemAlertsQuery,
    (snapshot) => {
      const alerts = snapshot.docs.map((doc) => ({
        ...(doc.data() as SystemAlert),
        id: doc.id,
      }));
      onChange(alerts);
    },
    createSnapshotErrorHandler('system health alerts', onError)
  );
};
