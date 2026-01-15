/**
 * Status Notification Service
 * Handles sending in-app and email notifications for status changes
 */

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from './firebase'
import { sendEmailNotification, createInAppNotification } from './notificationService'
import type {
  StatusAlertRecord,
  StatusChangeNotificationPayload,
  RecoveryNotificationPayload,
} from '@/types/monitoring'

/**
 * Send status change notification (in-app + optional email)
 */
export async function sendStatusChangeNotification(
  payload: StatusChangeNotificationPayload,
): Promise<{ inAppSent: boolean; emailSent: boolean }> {
  try {
    const { userId, previousStatus, newStatus, engagementScore, daysSinceActivity, suggestedActions } = payload

    // Get user profile for email
    const userRef = doc(db, 'profiles', userId)
    const userSnapshot = await (async () => {
      try {
        return await (await import('firebase/firestore')).getDoc(userRef)
      } catch {
        return null
      }
    })()

    const user = userSnapshot?.data() as Record<string, unknown> | undefined
    const userEmail = user?.email as string | undefined
    const userName = user?.fullName as string | undefined

    let inAppSent = false
    let emailSent = false

    // In-app notification
    try {
      const message = buildStatusChangeMessage(newStatus, daysSinceActivity, engagementScore)
      const title = buildStatusChangeTitle(newStatus)

      await createInAppNotification({
        userId,
        type: newStatus === 'inactive' ? 'system_alert' : 'engagement_alert',
        title,
        message,
        metadata: {
          statusChange: `${previousStatus} -> ${newStatus}`,
          engagementScore,
          suggestedActions,
        },
      })
      inAppSent = true
    } catch (error) {
      console.error('Error sending in-app notification:', error)
    }

    // Email notification (only for critical transitions)
    if ((newStatus === 'inactive' || newStatus === 'at_risk') && userEmail && userName) {
      try {
        const emailSubject = buildEmailSubject(newStatus)
        const emailBody = buildEmailBody(newStatus, daysSinceActivity, suggestedActions, userName)

        await sendEmailNotification({
          to: userEmail,
          subject: emailSubject,
          template: 'status-change-alert',
          data: {
            userName,
            status: newStatus,
            daysSinceActivity,
            engagementScore,
            suggestedActions: suggestedActions.join('\n'),
            message: emailBody,
          },
        })
        emailSent = true
      } catch (error) {
        console.error('Error sending email notification:', error)
      }
    }

    return { inAppSent, emailSent }
  } catch (error) {
    console.error('Error in sendStatusChangeNotification:', error)
    return { inAppSent: false, emailSent: false }
  }
}

/**
 * Send recovery celebration notification
 */
export async function sendRecoveryNotification(
  payload: RecoveryNotificationPayload,
): Promise<{ sent: boolean }> {
  try {
    const {
      userId,
      userName,
      recoveryDuration,
      activitiesCompleted,
      pointsEarned,
      streakDays,
      encouragementMessage,
    } = payload

    // Get user email
    const userRef = doc(db, 'profiles', userId)
    const userSnapshot = await (async () => {
      try {
        return await (await import('firebase/firestore')).getDoc(userRef)
      } catch {
        return null
      }
    })()

    const user = userSnapshot?.data() as Record<string, unknown> | undefined
    const userEmail = user?.email as string | undefined

    // In-app notification (always)
    const inAppMessage = `🎉 Welcome back! You've been active for ${recoveryDuration} days and completed ${activitiesCompleted} activities. Great momentum! ${encouragementMessage}`

    await createInAppNotification({
      userId,
      type: 'achievement',
      title: '🎉 You\'re Back on Track!',
      message: inAppMessage,
      metadata: {
        recoveryDuration,
        activitiesCompleted,
        pointsEarned,
        streakDays,
      },
    })

    // Email notification
    if (userEmail && userName) {
      await sendEmailNotification({
        to: userEmail,
        subject: 'Welcome Back! 🎉 You\'re Making Great Progress',
        template: 'recovery-celebration',
        data: {
          userName,
          recoveryDuration,
          activitiesCompleted,
          pointsEarned,
          streakDays,
          encouragementMessage,
          celebrationUrl: `${process.env.VITE_APP_URL}/dashboard?view=recovery`,
        },
      })
    }

    return { sent: true }
  } catch (error) {
    console.error('Error sending recovery notification:', error)
    return { sent: false }
  }
}

/**
 * Send at-risk warning to learner with action items
 */
export async function sendAtRiskWarning(
  userId: string,
  engagementScore: number,
  daysSinceActivity: number,
  suggestedActions: string[],
): Promise<void> {
  try {
    const title = '📊 Stay on Track!'
    const message = `We've noticed your engagement score is ${engagementScore}/100 with ${daysSinceActivity} days since your last activity. Let's get you back on track!`

    await createInAppNotification({
      userId,
      type: 'engagement_alert',
      title,
      message,
      metadata: {
        actionType: 'at_risk_warning',
        engagementScore,
        suggestedActions,
      },
    })

    // Queue email for later (not immediate)
    const alertRef = await addDoc(collection(db, 'status_alerts'), {
      userId,
      type: 'at_risk_warning',
      status: 'pending',
      channels: ['email'],
      title,
      message,
      severity: 'warning',
      createdAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error sending at-risk warning:', error)
  }
}

/**
 * Send inactive notice (more urgent)
 */
export async function sendInactiveNotice(
  userId: string,
  daysSinceActivity: number,
  mentorName?: string,
): Promise<void> {
  try {
    const title = '⏰ Let\'s Reconnect'
    const message = `It's been ${daysSinceActivity} days since your last activity. We want to support you! ${mentorName ? `Reach out to ${mentorName} or ` : ''}contact your partner for help getting back on track.`

    await createInAppNotification({
      userId,
      type: 'system_alert',
      title,
      message,
      metadata: {
        actionType: 'inactive_notice',
        daysSinceActivity,
      },
    })

    // Queue email
    await addDoc(collection(db, 'status_alerts'), {
      userId,
      type: 'inactive_notice',
      status: 'pending',
      channels: ['email'],
      title,
      message,
      severity: 'critical',
      actionRequired: true,
      createdAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error sending inactive notice:', error)
  }
}

/**
 * Get notification delivery statistics
 */
export async function getNotificationStats(userId: string, hoursBack: number = 24): Promise<{
  totalSent: number
  emailsSent: number
  inAppNotifications: number
  failureRate: number
}> {
  try {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000)

    const alertsQuery = query(
      collection(db, 'status_alerts'),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(cutoffTime)),
    )

    const snapshot = await getDocs(alertsQuery)
    const alerts = snapshot.docs.map((doc) => doc.data() as StatusAlertRecord)

    const sent = alerts.filter((a) => a.status === 'sent').length
    const failed = alerts.filter((a) => a.status === 'failed').length
    const emails = alerts.filter((a) => a.channels.includes('email')).length
    const inApp = alerts.filter((a) => a.channels.includes('in_app')).length

    return {
      totalSent: sent,
      emailsSent: emails,
      inAppNotifications: inApp,
      failureRate: alerts.length > 0 ? failed / alerts.length : 0,
    }
  } catch (error) {
    console.error('Error getting notification stats:', error)
    return {
      totalSent: 0,
      emailsSent: 0,
      inAppNotifications: 0,
      failureRate: 0,
    }
  }
}

/**
 * Build status change message based on transition
 */
function buildStatusChangeMessage(
  newStatus: string,
  daysSinceActivity: number,
  engagementScore: number,
): string {
  switch (newStatus) {
    case 'at_risk':
      return `Your engagement has dipped (${engagementScore}/100). With ${daysSinceActivity} days since your last activity, let's get you back on track!`

    case 'inactive':
      return `We haven't seen activity from you in ${daysSinceActivity} days. Your engagement is declining. We're here to support you - reach out!`

    case 'in_recovery':
      return `Great! We're seeing activity again. Keep up this momentum - you're on the road to recovery!`

    case 'active':
      return `Welcome back to active status! You're fully engaged and making great progress.`

    default:
      return 'Your status has been updated. Check your dashboard for details.'
  }
}

/**
 * Build status change title
 */
function buildStatusChangeTitle(newStatus: string): string {
  switch (newStatus) {
    case 'at_risk':
      return '⚠️ Stay on Track'

    case 'inactive':
      return '🔴 We Miss You'

    case 'in_recovery':
      return '🎯 Nice Recovery!'

    case 'active':
      return '✅ Back on Track'

    default:
      return 'Status Update'
  }
}

/**
 * Build email subject
 */
function buildEmailSubject(newStatus: string): string {
  switch (newStatus) {
    case 'at_risk':
      return 'Stay engaged: Quick check-in needed'

    case 'inactive':
      return 'We want to support you - let\'s reconnect'

    case 'in_recovery':
      return 'Great! You\'re making progress again'

    default:
      return 'Program Status Update'
  }
}

/**
 * Build email body
 */
function buildEmailBody(
  newStatus: string,
  daysSinceActivity: number,
  suggestedActions: string[],
  userName: string,
): string {
  let body = `Hi ${userName},\n\n`

  switch (newStatus) {
    case 'at_risk':
      body += `We've noticed your engagement has declined. With ${daysSinceActivity} days since your last activity, we want to help you get back on track.\n\nHere are some things you can do:\n`
      break

    case 'inactive':
      body += `It's been ${daysSinceActivity} days since we last saw activity from you. We want to support you in getting back into the program.\n\nSuggested steps:\n`
      break

    case 'in_recovery':
      body += `Great news! We're seeing activity from you again. You're making progress!\n\nKeep it up with:\n`
      break

    default:
      body += `Here's what you can do next:\n`
  }

  suggestedActions.forEach((action, index) => {
    body += `\n${index + 1}. ${action}`
  })

  body += '\n\nYour mentor and partner are here to help. Don\'t hesitate to reach out!\n\nBest regards,\nThe T4L Team'

  return body
}

/**
 * Process pending alerts and send via appropriate channels
 */
export async function processPendingAlerts(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  try {
    const pendingQuery = query(
      collection(db, 'status_alerts'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
      limit(100),
    )

    const snapshot = await getDocs(pendingQuery)
    let succeeded = 0
    let failed = 0

    for (const alertDoc of snapshot.docs) {
      const alert = alertDoc.data() as StatusAlertRecord

      try {
        // Send via channels
        let channelSuccess = false

        if (alert.channels.includes('email')) {
          // Send email
          const userRef = doc(db, 'profiles', alert.userId)
          const userSnapshot = await (async () => {
            try {
              return await (await import('firebase/firestore')).getDoc(userRef)
            } catch {
              return null
            }
          })()

          const user = userSnapshot?.data() as Record<string, unknown> | undefined
          if (user?.email) {
            await sendEmailNotification({
              to: user.email as string,
              subject: alert.title,
              template: 'status-alert',
              data: {
                message: alert.message,
                severity: alert.severity,
                actionRequired: alert.actionRequired,
              },
            })
            channelSuccess = true
          }
        }

        if (alert.channels.includes('in_app')) {
          // Send in-app
          await createInAppNotification({
            userId: alert.userId,
            type: 'system_alert',
            title: alert.title,
            message: alert.message,
          })
          channelSuccess = true
        }

        if (channelSuccess) {
          await updateDoc(alertDoc.ref, {
            status: 'sent',
            sentAt: Timestamp.now(),
          })
          succeeded++
        } else {
          throw new Error('No channels succeeded')
        }
      } catch (error) {
        console.error(`Error processing alert ${alertDoc.id}:`, error)
        failed++

        // Update attempt count
        await updateDoc(alertDoc.ref, {
          attemptCount: alert.attemptCount + 1,
          lastError: String(error),
          status: alert.attemptCount + 1 >= alert.maxRetries ? 'failed' : 'pending',
        })
      }
    }

    return {
      processed: snapshot.docs.length,
      succeeded,
      failed,
    }
  } catch (error) {
    console.error('Error processing pending alerts:', error)
    return {
      processed: 0,
      succeeded: 0,
      failed: 1,
    }
  }
}
