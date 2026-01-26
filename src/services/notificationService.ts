import {
  addDoc,
  collection,
  doc,
  getDoc,
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

export const respondToChallenge = async (challengeId: string, action: 'accepted' | 'declined') => {
  const challengeRef = doc(db, 'challenges', challengeId)
  const challengeSnap = await getDoc(challengeRef)
  if (!challengeSnap.exists()) return

  const challengeData = challengeSnap.data() as Record<string, unknown>
  const responderName = (challengeData.challenged_name as string) || 'Your peer'
  const challengerId = challengeData.challenger_id as string | undefined
  const status = action === 'accepted' ? 'active' : 'declined'

  await updateDoc(challengeRef, {
    status,
    responded_at: serverTimestamp(),
    accepted_at: action === 'accepted' ? serverTimestamp() : null,
    declined_at: action === 'declined' ? serverTimestamp() : null,
  })

  if (challengerId) {
    await addDoc(notificationsCollection, {
      user_id: challengerId,
      type: 'challenge_response',
      title: 'Challenge response',
      message: `${responderName} ${action === 'accepted' ? 'accepted' : 'declined'} your challenge.`,
      related_id: challengeId,
      is_read: false,
      read: false,
      created_at: serverTimestamp(),
    })
  }
}

export const handleNotificationAction = async (
  notification: NotificationRecord,
  action_response: NotificationRecord['action_response'],
) => {
  const notificationRef = doc(db, 'notifications', notification.id)
  await updateDoc(notificationRef, { action_response, is_read: true, read: true })

  if (
    notification.type === 'challenge_request' &&
    notification.related_id &&
    (action_response === 'accepted' || action_response === 'declined')
  ) {
    await respondToChallenge(notification.related_id, action_response)
  }
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
    'Your minimum weekly points requirement needs attention.',
    notification.percentageBehind
      ? `You are ${notification.percentageBehind}% behind.`
      : undefined,
    notification.pointsBehind
      ? `${notification.pointsBehind} points remaining to hit the minimum.`
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

export const notifyMentorOfLearnerAlert = async (params: {
  mentorId: string
  learnerId: string
  learnerName: string
  status: string
  pointsEarned: number
  windowTarget: number
}) => {
  const message = `${params.learnerName} has fallen into "${params.status}" status (${params.pointsEarned} / ${params.windowTarget} pts). Consider reaching out to provide support.`

  await createInAppNotification({
    userId: params.mentorId,
    type: 'engagement_alert',
    title: `Learner Status Alert: ${params.learnerName}`,
    message,
    metadata: {
      learnerId: params.learnerId,
      learnerName: params.learnerName,
      status: params.status,
      pointsEarned: params.pointsEarned,
      windowTarget: params.windowTarget
    }
  })
}

export const notifyPartnerOfLearnerAlert = async (params: {
  organizationId: string
  learnerId: string
  learnerName: string
  status: string
}) => {
  const message = `Learner ${params.learnerName} from your organization is currently in "${params.status}" status.`

  await addDoc(adminNotificationsCollection, {
    type: 'engagement_alert',
    title: `Organization Learner Alert`,
    message,
    severity: 'warning',
    target_roles: ['partner'],
    related_id: params.organizationId,
    metadata: {
      learnerId: params.learnerId,
      learnerName: params.learnerName,
      status: params.status
    },
    created_at: serverTimestamp(),
  })
}

export const sendRecoveryNotification = async (notification: {
  userId: string
  relatedId?: string
}) => {
  await createInAppNotification({
    userId: notification.userId,
    type: 'system_alert',
    title: '🎉 Weekly Recovery',
    message: "Nice recovery! You are back on track for this week's minimum points.",
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

type WeeklyStatus = 'on_track' | 'warning' | 'at_risk'

const statusCopy: Record<WeeklyStatus, { title: string; message: string; severity: AdminNotification['severity'] }> = {
  on_track: {
    title: '🎉 Back on track',
    message: 'Momentum restored. Weekly progress is back on target.',
    severity: 'success',
  },
  warning: {
    title: '⚠️ Weekly progress reminder',
    message: 'You are close to the weekly target. Log another activity to stay on track.',
    severity: 'warning',
  },
  at_risk: {
    title: '🔴 Weekly progress alert',
    message: 'Weekly progress is at risk. Consider outreach and support resources.',
    severity: 'critical',
  },
}

export const createStatusChangeNotification = async (params: {
  userId: string
  weekNumber: number
  weekYear: number
  previousStatus: WeeklyStatus
  newStatus: WeeklyStatus
  pointsEarned: number
  targetPoints: number
}) => {
  const copy = statusCopy[params.newStatus]
  const message = `${copy.message} (${params.pointsEarned.toLocaleString()} / ${params.targetPoints.toLocaleString()} pts).`

  await createInAppNotification({
    userId: params.userId,
    type: 'progress_report',
    title: copy.title,
    message,
    metadata: {
      weekNumber: params.weekNumber,
      weekYear: params.weekYear,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      pointsEarned: params.pointsEarned,
      targetPoints: params.targetPoints,
    },
  })

  await addDoc(adminNotificationsCollection, {
    type: 'progress_report',
    title: `Status shift: ${params.newStatus.replace('_', ' ')}`,
    message,
    severity: copy.severity,
    target_roles: ['partner', 'super_admin'],
    related_id: params.userId,
    metadata: {
      weekNumber: params.weekNumber,
      weekYear: params.weekYear,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      pointsEarned: params.pointsEarned,
      targetPoints: params.targetPoints,
    },
    created_at: serverTimestamp(),
  })
}

export const createPartnerDigestNotification = async (params: {
  title: string
  message: string
  summary: Record<string, number>
  generatedFor: string
}) => {
  await addDoc(adminNotificationsCollection, {
    type: 'progress_report',
    title: params.title,
    message: params.message,
    severity: 'info',
    target_roles: ['partner', 'super_admin'],
    metadata: {
      summary: params.summary,
      generatedFor: params.generatedFor,
    },
    created_at: serverTimestamp(),
  })
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

export const sendCapacityAlert = async (params: {
  organizationId: string
  organizationName: string
  currentMembers: number
  teamSize: number
  capacityPercentage: number
  threshold: 75 | 90 | 95 | 100
  severity: 'info' | 'warning' | 'critical'
  targetRoles: string[]
}) => {
  const alertMessages: Record<number, string> = {
    75: 'Approaching capacity',
    90: 'Nearly full',
    95: 'Critical capacity',
    100: 'At capacity',
  }

  const message = `${alertMessages[params.threshold]}: ${params.organizationName} is using ${
    params.currentMembers
  } of ${params.teamSize} licenses (${params.capacityPercentage}%).`

  await addDoc(adminNotificationsCollection, {
    type: 'system_alert',
    title: `Capacity alert (${params.threshold}%)`,
    message,
    severity: params.severity,
    metadata: {
      organizationId: params.organizationId,
      organizationName: params.organizationName,
      currentMembers: params.currentMembers,
      teamSize: params.teamSize,
      capacityPercentage: params.capacityPercentage,
      threshold: params.threshold,
    },
    target_roles: params.targetRoles,
    is_read: false,
    created_at: serverTimestamp(),
  })

  if (params.threshold >= 95) {
    await sendEmailNotification({
      to: 'super_admins',
      subject: `Critical capacity alert: ${params.organizationName}`,
      template: 'capacity-alert',
      data: {
        ...params,
        message,
        actionUrl: `/admin/organizations/${params.organizationId}`,
        suggestion: 'Consider increasing team size or removing inactive users.',
      },
    })
  }
}
