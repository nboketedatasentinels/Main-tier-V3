import {
  BellRing,
  Megaphone,
  MessageCircle,
  MessageSquare,
  ShieldAlert,
  Star,
  Trophy,
  UserCheck,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { NotificationRecord } from '@/types/notifications'

/**
 * Shared presentation helpers for notifications. The bell dropdown
 * (NotificationItem) and the full notifications page both read from here so a
 * notification looks and behaves the same in either place.
 */

export interface NotificationDestination {
  kind: 'external' | 'internal'
  url: string
}

/**
 * A notification only has a destination when it points somewhere outside the
 * notifications surface itself (an external link or an in-app route). Plain
 * messages have none - they are read on the notifications page.
 */
export const resolveNotificationDestination = (
  notification: NotificationRecord,
): NotificationDestination | null => {
  const md = (notification.metadata ?? {}) as Record<string, unknown>

  const externalUrl = typeof md.externalUrl === 'string' ? md.externalUrl : null
  if (externalUrl) return { kind: 'external', url: externalUrl }

  const actionUrl = typeof md.actionUrl === 'string' ? md.actionUrl : null
  if (actionUrl) {
    return /^https?:\/\//i.test(actionUrl)
      ? { kind: 'external', url: actionUrl }
      : { kind: 'internal', url: actionUrl }
  }

  // Challenge invites always open the Challenges tab focused on that request,
  // even if older rows were written without actionUrl.
  if (
    notification.type === 'challenge_request' ||
    notification.type === 'challenge_invite'
  ) {
    const challengeId =
      (typeof md.challengeId === 'string' && md.challengeId) ||
      notification.related_id ||
      null
    if (challengeId) {
      return {
        kind: 'internal',
        url: `/app/leaderboard?tab=challenges&challengeId=${encodeURIComponent(challengeId)}`,
      }
    }
    return { kind: 'internal', url: '/app/leaderboard?tab=challenges' }
  }

  return null
}

export const notificationIcon = (type: NotificationRecord['type']) => {
  switch (type) {
    case 'challenge_request':
    case 'challenge_invite':
    case 'challenge_response':
      return Trophy
    case 'session_request':
    case 'mentee_checkin':
      return UserCheck
    case 'direct_message':
    case 'mention':
      return MessageCircle
    case 'admin_message':
      return Megaphone
    case 'important_update':
    case 'product_update':
    case 'progress_report':
    case 'engagement_alert':
    case 'intervention_reminder':
    case 'escalation_notice':
      return BellRing
    case 'system_alert':
    case 'maintenance':
    case 'downtime':
      return ShieldAlert
    case 'milestone':
    case 'achievement':
    case 'badge_awarded':
      return Star
    default:
      return MessageSquare
  }
}

/** Firestore Timestamps and ISO strings both reach the UI - normalise them. */
const toDate = (value?: unknown): Date | null => {
  if (!value) return null

  const date =
    typeof value === 'object' && value && 'toDate' in (value as Record<string, unknown>)
      ? (value as { toDate: () => Date }).toDate()
      : new Date(String(value))

  return Number.isNaN(date.getTime()) ? null : date
}

export const resolveTimestamp = (value?: unknown): string => {
  const date = toDate(value)
  return date ? formatDistanceToNow(date, { addSuffix: true }) : ''
}

export const resolveExactTimestamp = (value?: unknown): string => {
  const date = toDate(value)
  return date ? format(date, "d MMM yyyy 'at' HH:mm") : ''
}

export const isNotificationRead = (notification: NotificationRecord): boolean =>
  Boolean(notification.is_read || notification.read)

/**
 * Admin broadcasts store the sender under `data.from`, which the service
 * spreads onto the record itself (see mapNotificationRow).
 */
export const resolveSenderName = (notification: NotificationRecord): string | null => {
  const from = (notification as unknown as Record<string, unknown>).from
  return typeof from === 'string' && from.trim() ? from.trim() : null
}

export const sortNotificationsByDate = (
  notifications: NotificationRecord[],
): NotificationRecord[] =>
  [...notifications].sort(
    (a, b) => (toDate(b.created_at)?.getTime() || 0) - (toDate(a.created_at)?.getTime() || 0),
  )
