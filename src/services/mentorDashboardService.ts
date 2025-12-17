import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase'

export type RiskLevel = 'engaged' | 'watch' | 'concern' | 'critical'

export interface EngagementSignals {
  daysSinceLastActive: number
  weeklyActivity: number
}

export interface EngagementRisk extends EngagementSignals {
  level: RiskLevel
  summary: string
}

export const deriveFallbackRisk = (signals: EngagementSignals): EngagementRisk => {
  const { daysSinceLastActive, weeklyActivity } = signals

  if (daysSinceLastActive <= 7 && weeklyActivity > 0) {
    return {
      level: 'engaged',
      summary: 'Active this week with consistent engagement.',
      daysSinceLastActive,
      weeklyActivity,
    }
  }

  if (daysSinceLastActive <= 14) {
    return {
      level: 'watch',
      summary: 'Slight slowdown — check in soon.',
      daysSinceLastActive,
      weeklyActivity,
    }
  }

  if (daysSinceLastActive <= 28) {
    return {
      level: 'concern',
      summary: 'Engagement is declining. Plan an intervention.',
      daysSinceLastActive,
      weeklyActivity,
    }
  }

  return {
    level: 'critical',
    summary: 'No activity in over 4 weeks. Act immediately.',
    daysSinceLastActive,
    weeklyActivity,
  }
}

export interface MentorshipSession {
  id: string
  mentorId: string
  menteeId: string
  topic?: string
  scheduled_at?: unknown
  status?: string
  [key: string]: unknown
}

export interface MentorNotification {
  id: string
  mentor_id: string
  read?: boolean
  created_at?: unknown
  [key: string]: unknown
}

const mapSnapshot = <T extends { id: string }>(snapshot: QuerySnapshot<DocumentData>) =>
  snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T))

export const subscribeToMentorshipSessionsForMentor = (
  mentorId: string,
  onUpdate: (sessions: MentorshipSession[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const sessionsQuery = query(
    collection(db, 'mentorship_sessions'),
    where('mentor_id', '==', mentorId),
    orderBy('scheduled_at', 'asc')
  )

  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      const sessions = mapSnapshot<MentorshipSession>(snapshot).map((session) => ({
        ...session,
        mentorId: (session as unknown as { mentor_id?: string }).mentor_id || session.mentorId,
      }))
      onUpdate(sessions)
    },
    (error) => onError?.(error)
  )
}

export const subscribeToMentorNotifications = (
  mentorId: string,
  onUpdate: (notifications: MentorNotification[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const notificationsQuery = query(
    collection(db, 'mentor_notifications'),
    where('mentor_id', '==', mentorId),
    orderBy('created_at', 'desc')
  )

  return onSnapshot(
    notificationsQuery,
    (snapshot) => onUpdate(mapSnapshot<MentorNotification>(snapshot)),
    (error) => onError?.(error)
  )
}

export const subscribeToUnreadMentorNotificationCount = (
  mentorId: string,
  onUpdate: (count: number) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const unreadQuery = query(
    collection(db, 'mentor_notifications'),
    where('mentor_id', '==', mentorId),
    where('read', '==', false)
  )

  return onSnapshot(
    unreadQuery,
    (snapshot) => onUpdate(snapshot.size),
    (error) => onError?.(error)
  )
}
