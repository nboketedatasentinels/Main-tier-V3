/**
 * Status Change Detector Service
 * Detects status transitions and triggers automated notification workflows
 */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  Timestamp,
  addDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  LearnerStatus,
  StatusAlertRecord,
  AlertType,
  StatusTransitionEvent,
  AutomationRule,
} from '@/types/monitoring'

/**
 * Determine if a status transition requires an alert
 */
export function shouldCreateAlert(
  previousStatus: LearnerStatus,
  newStatus: LearnerStatus,
): {
  shouldAlert: boolean
  alertType: AlertType | null
  severity: 'info' | 'warning' | 'critical'
} {
  // Transitions that require alerts
  const alertTransitions: Record<
    string,
    {
      type: AlertType
      severity: 'info' | 'warning' | 'critical'
    }
  > = {
    'active->at_risk': {
      type: 'at_risk_warning',
      severity: 'warning',
    },
    'at_risk->inactive': {
      type: 'inactive_notice',
      severity: 'critical',
    },
    'active->inactive': {
      type: 'inactive_notice',
      severity: 'critical',
    },
    'at_risk->in_recovery': {
      type: 'recovery_celebration',
      severity: 'info',
    },
    'inactive->in_recovery': {
      type: 'recovery_celebration',
      severity: 'info',
    },
    'in_recovery->active': {
      type: 'recovery_celebration',
      severity: 'info',
    },
  }

  const key = `${previousStatus}->${newStatus}`
  const config = alertTransitions[key]

  if (config) {
    return {
      shouldAlert: true,
      alertType: config.type,
      severity: config.severity,
    }
  }

  return {
    shouldAlert: false,
    alertType: null,
    severity: 'info',
  }
}

/**
 * Generate suggested actions based on status and context
 */
export function generateSuggestedActions(
  newStatus: LearnerStatus,
  engagementScore: number,
  daysSinceActivity: number,
  completionRate: number,
): string[] {
  const actions: string[] = []

  if (newStatus === 'at_risk') {
    actions.push('Schedule a check-in with your mentor')
    actions.push('Review the course materials from the past week')
    actions.push('Set a specific day and time for your weekly activities')
    if (engagementScore < 30) {
      actions.push('Consider reaching out for additional support or resources')
    }
  }

  if (newStatus === 'inactive') {
    actions.push('Contact your mentor or partner for support')
    actions.push('Review your goals and commitments to the program')
    actions.push('Identify any obstacles preventing your participation')
    actions.push('Request a one-on-one session to get back on track')
  }

  if (newStatus === 'in_recovery') {
    actions.push('Keep up the momentum - one more week!')
    actions.push('Celebrate this recovery step with your community')
    actions.push('Share your progress with your mentor')
  }

  if (completionRate < 50 && actions.length < 4) {
    actions.push('Focus on completing assigned activities')
  }

  return actions.slice(0, 4) // Limit to 4 actions
}

/**
 * Create alert for status change
 */
export async function createStatusChangeAlert(
  userId: string,
  orgId: string | undefined,
  previousStatus: LearnerStatus,
  newStatus: LearnerStatus,
  metrics: {
    engagementScore: number
    daysSinceActivity: number
    completionRate: number
    pointsTrend: 'up' | 'stable' | 'down'
  },
): Promise<StatusAlertRecord | null> {
  try {
    const { shouldAlert, alertType, severity } = shouldCreateAlert(previousStatus, newStatus)

    if (!shouldAlert || !alertType) {
      return null
    }

    // Check if we've already alerted recently for this status change
    const recentAlertQuery = query(
      collection(db, 'status_alerts'),
      where('userId', '==', userId),
      where('type', '==', alertType),
      where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000))), // Last hour
    )

    const recentAlerts = await getDocs(recentAlertQuery)
    if (!recentAlerts.empty) {
      console.log(`Skipping duplicate alert for user ${userId}`)
      return null
    }

    // Generate alert content
    const { title, message, actionRequired } = generateAlertContent(newStatus, alertType, metrics)
    const suggestedActions = generateSuggestedActions(newStatus, metrics.engagementScore, metrics.daysSinceActivity, metrics.completionRate)

    // Create alert record
    const alertRecord: StatusAlertRecord = {
      id: '', // Firestore will generate
      userId,
      orgId,
      type: alertType,
      status: 'pending',
      channels: newStatus === 'inactive' ? ['email', 'in_app'] : ['in_app'],
      message,
      title,
      actionRequired,
      severity,
      reasonCode: `${previousStatus}_to_${newStatus}`,
      statusChangeTriggered: newStatus,
      suggestedActions,
      attemptCount: 0,
      maxRetries: 3,
      createdAt: Timestamp.now(),
    }

    // Save to Firestore
    const alertRef = await addDoc(collection(db, 'status_alerts'), alertRecord)

    // Update alert record with ID
    await updateDoc(alertRef, { id: alertRef.id })

    return { ...alertRecord, id: alertRef.id }
  } catch (error) {
    console.error('Error creating status change alert:', error)
    return null
  }
}

/**
 * Generate alert content based on status transition
 */
function generateAlertContent(
  newStatus: LearnerStatus,
  alertType: AlertType,
  metrics: {
    engagementScore: number
    daysSinceActivity: number
    completionRate: number
    pointsTrend: 'up' | 'stable' | 'down'
  },
): {
  title: string
  message: string
  actionRequired: boolean
} {
  switch (alertType) {
    case 'at_risk_warning':
      return {
        title: 'Stay on Track! 🎯',
        message: `We've noticed you haven't been as active lately (${metrics.daysSinceActivity} days). Your engagement score is ${metrics.engagementScore}/100. Let's get you back on track - schedule a quick check-in with your mentor or set aside time this week to catch up on activities.`,
        actionRequired: false,
      }

    case 'inactive_notice':
      return {
        title: 'We Miss You! 😔',
        message: `It's been ${metrics.daysSinceActivity} days since your last activity. We want to support you in getting back into the program. Reach out to your mentor or partner - they're here to help!`,
        actionRequired: true,
      }

    case 'recovery_celebration':
      return {
        title: 'Welcome Back! 🎉',
        message: `Great job getting back into the program! Your activity has picked up and your engagement is improving (${metrics.engagementScore}/100). Keep up this momentum - you're on the right track!`,
        actionRequired: false,
      }

    case 'low_engagement':
      return {
        title: 'Low Engagement Alert',
        message: `Your engagement score is below our threshold (${metrics.engagementScore}/100). Please review your progress and reach out if you need support.`,
        actionRequired: true,
      }

    case 'missed_deadline':
      return {
        title: 'Activity Deadline Approaching',
        message: 'You have pending activities coming due. Please complete them to stay on track with your cohort.',
        actionRequired: true,
      }

    case 'activity_approved':
      return {
        title: '✅ Activity Approved',
        message: 'Great work! One of your submitted activities has been approved. Keep up the excellent progress!',
        actionRequired: false,
      }

    case 'milestone_achieved':
      return {
        title: '🏆 Milestone Reached!',
        message: 'Congratulations! You\'ve reached an important milestone in your journey. Keep going!',
        actionRequired: false,
      }

    default:
      return {
        title: 'Status Update',
        message: 'Your status has been updated. Check your dashboard for details.',
        actionRequired: false,
      }
  }
}

/**
 * Trigger automation rules based on status transition
 */
export async function triggerAutomationRules(
  event: StatusTransitionEvent,
): Promise<string[]> {
  try {
    const rulesQuery = query(
      collection(db, 'automation_rules'),
      where('enabled', '==', true),
      where('trigger', '==', 'status_change'),
    )

    const rulesSnapshot = await getDocs(rulesQuery)
    const triggeredRules: string[] = []

    for (const ruleDoc of rulesSnapshot.docs) {
      const rule = ruleDoc.data() as AutomationRule

      // Check if conditions match
      if (evaluateRuleConditions(rule, event)) {
        triggeredRules.push(rule.id)

        // Execute rule actions
        await executeRuleActions(rule, event)
      }
    }

    return triggeredRules
  } catch (error) {
    console.error('Error triggering automation rules:', error)
    return []
  }
}

/**
 * Evaluate if a rule's conditions match the event
 */
function evaluateRuleConditions(rule: AutomationRule, event: StatusTransitionEvent): boolean {
  return rule.conditions.every((condition) => {
    const eventValue = (event as Record<string, unknown>)[condition.field]

    switch (condition.operator) {
      case 'equals':
        return eventValue === condition.value
      case 'gte':
        return Number(eventValue) >= Number(condition.value)
      case 'lte':
        return Number(eventValue) <= Number(condition.value)
      case 'gt':
        return Number(eventValue) > Number(condition.value)
      case 'lt':
        return Number(eventValue) < Number(condition.value)
      case 'contains':
        return String(eventValue).includes(String(condition.value))
      default:
        return false
    }
  })
}

/**
 * Execute rule actions
 */
async function executeRuleActions(rule: AutomationRule, event: StatusTransitionEvent): Promise<void> {
  for (const action of rule.actions) {
    try {
      switch (action.type) {
        case 'create_alert':
          // Alert already created in createStatusChangeAlert
          break

        case 'send_notification':
          // Handled by notification service
          break

        case 'assign_nudge':
          // Assign nudge template to user
          if (action.config.nudgeTemplateId) {
            const nudgesCollection = collection(db, 'nudge_assignments')
            await addDoc(nudgesCollection, {
              userId: event.userId,
              templateId: action.config.nudgeTemplateId,
              status: 'pending',
              createdAt: Timestamp.now(),
            })
          }
          break

        case 'escalate_to_mentor':
          // Create escalation alert for mentor
          if (event.orgId) {
            const escalationsCollection = collection(db, 'mentor_escalations')
            await addDoc(escalationsCollection, {
              userId: event.userId,
              orgId: event.orgId,
              reason: `Status change to ${event.newStatus}`,
              priority: event.newStatus === 'inactive' ? 'high' : 'medium',
              status: 'open',
              createdAt: Timestamp.now(),
            })
          }
          break

        default:
          console.warn(`Unknown action type: ${action.type}`)
      }
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error)
    }
  }
}

/**
 * Handle incoming activity update - triggers status recalculation if needed
 */
export async function onActivityCompleted(
  userId: string,
  orgId: string | undefined,
  pointsEarned: number,
): Promise<void> {
  try {
    // Update engagement metrics
    const today = new Date().toISOString().split('T')[0]
    const metricsRef = doc(db, 'engagement_metrics', `${userId}-${today}`)

    await updateDoc(metricsRef, {
      pointsEarned: pointsEarned,
      activitiesCompleted: 1, // Increment
      isActiveToday: true,
      updatedAt: Timestamp.now(),
    }).catch(async () => {
      // Create if doesn't exist
      await setDoc(metricsRef, {
        userId,
        orgId,
        date: today,
        pointsEarned,
        activitiesCompleted: 1,
        activitiesAttempted: 1,
        dailyActiveStreakDays: 1,
        isActiveToday: true,
        createdAt: Timestamp.now(),
      })
    })

    // Trigger status recalculation (could be optimized with scheduled functions)
    // For now, this would be called by scheduled Cloud Function
  } catch (error) {
    console.error('Error on activity completed:', error)
  }
}

/**
 * Get all pending alerts for a user
 */
export async function getUserPendingAlerts(userId: string): Promise<StatusAlertRecord[]> {
  try {
    const alertsQuery = query(
      collection(db, 'status_alerts'),
      where('userId', '==', userId),
      where('status', '==', 'pending'),
    )

    const snapshot = await getDocs(alertsQuery)
    return snapshot.docs.map((doc) => doc.data() as StatusAlertRecord)
  } catch (error) {
    console.error('Error fetching user alerts:', error)
    return []
  }
}

/**
 * Update alert status
 */
export async function updateAlertStatus(
  alertId: string,
  status: 'pending' | 'sent' | 'failed' | 'skipped' | 'deferred',
  error?: string,
): Promise<void> {
  try {
    const alertRef = doc(db, 'status_alerts', alertId)
    const updates: Record<string, unknown> = {
      status,
      updatedAt: Timestamp.now(),
    }

    if (status === 'sent') {
      updates.sentAt = Timestamp.now()
    }

    if (error) {
      updates.lastError = error
    }

    await updateDoc(alertRef, updates)
  } catch (error) {
    console.error('Error updating alert status:', error)
  }
}

/**
 * Batch retry failed alerts
 */
export async function retryFailedAlerts(maxRetries: number = 3): Promise<{
  retried: number
  failed: number
}> {
  try {
    const failedAlertsQuery = query(
      collection(db, 'status_alerts'),
      where('status', '==', 'failed'),
      where('attemptCount', '<', maxRetries),
    )

    const snapshot = await getDocs(failedAlertsQuery)
    let retried = 0
    let failed = 0

    for (const alertDoc of snapshot.docs) {
      try {
        const alert = alertDoc.data() as StatusAlertRecord
        await updateDoc(alertDoc.ref, {
          status: 'pending',
          attemptCount: alert.attemptCount + 1,
          nextRetryAt: null,
        })
        retried++
      } catch (error) {
        console.error(`Error retrying alert ${alertDoc.id}:`, error)
        failed++
      }
    }

    return { retried, failed }
  } catch (error) {
    console.error('Error in batch retry:', error)
    return { retried: 0, failed: 1 }
  }
}
