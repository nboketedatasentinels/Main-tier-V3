import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  arrayUnion,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  AdminNotification,
  NotificationRecord,
  NotificationType,
  WeeklyTargetAlert,
} from '@/types/notifications'

const notificationsCollection = collection(db, 'notifications')
const adminNotificationsCollection = collection(db, 'admin_notifications')
const weeklyAlertsCollection = collection(db, 'weekly_target_alerts')

export const listenToUserNotifications = (
  userId: string,
  onChange: (notifications: NotificationRecord[]) => void,
) => {
  const notificationsQuery = query(
    notificationsCollection,
    where('user_id', '==', userId),
    orderBy('created_at', 'desc'),
  )

  return onSnapshot(notificationsQuery, (snapshot) => {
    const items: NotificationRecord[] = snapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as NotificationRecord),
      id: docSnap.id,
    }))
    onChange(items)
  })
}

export const markNotificationRead = async (notificationId: string) => {
  const notificationRef = doc(db, 'notifications', notificationId)
  await updateDoc(notificationRef, { is_read: true, read: true })
}

export const markAllNotificationsRead = async (userId: string) => {
  const notificationsQuery = query(
    notificationsCollection,
    where('user_id', '==', userId),
    where('is_read', '==', false),
  )
  const snapshot = await getDocs(notificationsQuery)
  const updates = snapshot.docs.map((docSnap) =>
    updateDoc(docSnap.ref, { is_read: true, read: true }),
  )
  await Promise.all(updates)
}

export const updateNotificationAction = async (
  notificationId: string,
  action_response: NotificationRecord['action_response'],
) => {
  const notificationRef = doc(db, 'notifications', notificationId)
  await updateDoc(notificationRef, { action_response, is_read: true, read: true })
}

export const createInAppNotification = async (params: {
  userId: string
  type: NotificationType
  title?: string
  message: string
  metadata?: Record<string, unknown>
}) => {
  await addDoc(notificationsCollection, {
    user_id: params.userId,
    type: params.type,
    notification_type: params.type,
    title: params.title,
    message: params.message,
    metadata: params.metadata || {},
    is_read: false,
    read: false,
    created_at: serverTimestamp(),
  })
}

export const sendBelowTargetAlert = async (notification: {
  userId: string
  alertLevel: 'warning' | 'alert' | 'critical'
  percentageBehind?: number
  pointsBehind?: number
  relatedId?: string
  mentorId?: string
  partnerId?: string
  ambassadorId?: string
}) => {
  const titles = {
    warning: '⚠️ Weekly Progress Reminder',
    alert: '🔴 Weekly Progress Alert',
    critical: '🚨 Critical Progress Alert',
  }

  const messageParts = [
    'Your weekly target needs attention.',
    notification.percentageBehind
      ? `You are ${notification.percentageBehind}% behind.`
      : undefined,
    notification.pointsBehind
      ? `${notification.pointsBehind} points remaining to target.`
      : undefined,
    notification.alertLevel === 'critical'
      ? 'Consider reaching out to your mentor for help.'
      : 'Submit an activity to stay on track.',
  ].filter(Boolean)

  const basePayload = {
    type: 'system_alert' as NotificationType,
    title: titles[notification.alertLevel],
    message: messageParts.join(' '),
    metadata: {
      relatedId: notification.relatedId,
      alertLevel: notification.alertLevel,
    },
  }

  const targets = [notification.userId, notification.mentorId, notification.partnerId, notification.ambassadorId].filter(
    Boolean,
  ) as string[]

  await Promise.all(targets.map((target) => createInAppNotification({ ...basePayload, userId: target })))

  if (notification.alertLevel !== 'warning') {
    await sendEmailNotification({
      to: notification.userId,
      subject: titles[notification.alertLevel],
      template: 'weekly-target-alert',
      data: basePayload,
    })
  }
}

export const sendRecoveryNotification = async (notification: {
  userId: string
  relatedId?: string
}) => {
  await createInAppNotification({
    userId: notification.userId,
    type: 'system_alert',
    title: '🎉 Weekly Recovery',
    message: 'Nice recovery! You are back on track for your weekly target.',
    metadata: { relatedId: notification.relatedId, alertLevel: 'recovery' },
  })
}

export const sendEmailNotification = async (params: {
  to: string
  subject: string
  template: string
  data?: Record<string, unknown>
}) => {
  // Placeholder for email service integration
  console.log('Sending email notification (placeholder)', params)
}

export const saveFcmTokenToProfile = async (userId: string, token: string) => {
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    fcmTokens: arrayUnion(token),
    updatedAt: serverTimestamp(),
  })
}

export const requestBrowserNotificationPermission = async () => {
  if (!('Notification' in window)) return 'denied'

  const result = await Notification.requestPermission()
  return result
}

export const markAlertAsNotified = async (alertId: string) => {
  const alertRef = doc(db, 'weekly_target_alerts', alertId)
  await updateDoc(alertRef, { notified_at: serverTimestamp() })
}

export const acknowledgeAlert = async (alertId: string, acknowledgedBy: string) => {
  const alertRef = doc(db, 'weekly_target_alerts', alertId)
  await updateDoc(alertRef, { acknowledged_at: serverTimestamp(), acknowledgedBy })
}

export const resolveAlert = async (alertId: string) => {
  const alertRef = doc(db, 'weekly_target_alerts', alertId)
  await updateDoc(alertRef, { resolved_at: serverTimestamp() })
}

export const listenToWeeklyAlerts = (
  userId: string,
  onChange: (alerts: WeeklyTargetAlert[]) => void,
) => {
  const alertsQuery = query(
    weeklyAlertsCollection,
    where('user_id', '==', userId),
    orderBy('created_at', 'desc'),
  )

  return onSnapshot(alertsQuery, (snapshot) => {
    const alerts: WeeklyTargetAlert[] = snapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as WeeklyTargetAlert),
      id: docSnap.id,
    }))
    onChange(alerts)
  })
}

export const getUnresolvedAlerts = async (learnerId: string) => {
  const alertsQuery = query(
    weeklyAlertsCollection,
    where('user_id', '==', learnerId),
    where('resolved_at', '==', null),
  )

  const snapshot = await getDocs(alertsQuery)
  return snapshot.docs.map((docSnap) => ({
    ...(docSnap.data() as WeeklyTargetAlert),
    id: docSnap.id,
  }))
}

export const listenToAdminNotifications = (
  onChange: (notifications: AdminNotification[]) => void,
) => {
  const adminQuery = query(adminNotificationsCollection, orderBy('created_at', 'desc'))
  return onSnapshot(adminQuery, (snapshot) => {
    const items: AdminNotification[] = snapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as AdminNotification),
      id: docSnap.id,
    }))
    onChange(items)
  })
}

export const markAdminNotificationRead = async (notificationId: string) => {
  const notificationRef = doc(db, 'admin_notifications', notificationId)
  await updateDoc(notificationRef, { is_read: true })
}

export const markAllAdminNotificationsRead = async () => {
  const snapshot = await getDocs(adminNotificationsCollection)
  await Promise.all(snapshot.docs.map((docSnap) => updateDoc(docSnap.ref, { is_read: true })))
}
