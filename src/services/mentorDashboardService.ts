import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { differenceInCalendarDays } from 'date-fns'
import { db } from '@/services/firebase'
import type { UserProfile } from '@/types'

export type RiskLevel = 'engaged' | 'watch' | 'concern' | 'critical'

export interface EngagementSignals {
  daysSinceLastActive: number
  weeklyActivity: number
}

export interface EngagementRisk extends EngagementSignals {
  level: RiskLevel
  summary: string
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

export type EngagementStatus = 'active' | 'idle' | 'disengaged'

export interface AssignedMentee extends UserProfile {
  weeklyActivity?: number
  milestonesProgress?: number
  progress?: number
  goalsCompleted?: number
  goalsTotal?: number
  risk: EngagementRisk
  daysSinceLastActive: number
  engagementStatus: EngagementStatus
}

export interface MenteeFilters {
  riskLevel?: RiskLevel | 'all'
  searchTerm?: string
  engagementStatus?: EngagementStatus | 'all'
}

export interface ServiceResult<T> {
  data: T
  error: Error | null
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

const mapSnapshot = <T extends { id: string }>(snapshot: QuerySnapshot) =>
  snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T))

const deriveEngagementStatus = (daysSinceLastActive: number): EngagementStatus => {
  if (daysSinceLastActive <= 7) return 'active'
  if (daysSinceLastActive <= 21) return 'idle'
  return 'disengaged'
}

const resolveValidLastActive = (profile: UserProfile & Record<string, unknown>): string => {
  const candidates = [profile.lastActive, profile.lastActiveAt, profile.updatedAt]
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const parsed = new Date(candidate)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    }
  }

  return new Date().toISOString()
}

const withComputedMenteeFields = (profile: UserProfile & Record<string, unknown>): AssignedMentee => {
  const lastActive = resolveValidLastActive(profile)
  const weeklyActivity = Number(profile.weeklyActivity ?? 0)
  const daysSinceLastActive = differenceInCalendarDays(new Date(), new Date(lastActive))
  const risk = deriveFallbackRisk({ daysSinceLastActive, weeklyActivity })
  const engagementStatus = deriveEngagementStatus(daysSinceLastActive)

  return {
    ...profile,
    risk,
    weeklyActivity,
    goalsCompleted: Number(profile.goalsCompleted ?? 0),
    goalsTotal: Number(profile.goalsTotal ?? 0),
    daysSinceLastActive,
    engagementStatus,
  }
}

const applyFilters = (mentees: AssignedMentee[], filters?: MenteeFilters) => {
  if (!filters) return mentees
  const { riskLevel, searchTerm, engagementStatus } = filters

  return mentees.filter((mentee) => {
    const matchesRisk = !riskLevel || riskLevel === 'all' || mentee.risk?.level === riskLevel

    const matchesEngagement =
      !engagementStatus || engagementStatus === 'all' || mentee.engagementStatus === engagementStatus

    const matchesSearch = (() => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        mentee.fullName?.toLowerCase().includes(term) ||
        mentee.email?.toLowerCase().includes(term) ||
        mentee.companyName?.toLowerCase().includes(term) ||
        mentee.companyCode?.toLowerCase().includes(term)
      )
    })()

    return matchesRisk && matchesEngagement && matchesSearch
  })
}

const handleServiceError = (context: string, error: unknown): Error => {
  const normalized = error instanceof Error ? error : new Error(String(error))
  console.error(`🔴 [MentorDashboardService] ${context}`, {
    message: normalized.message,
    stack: normalized.stack,
    raw: error,
  })
  return normalized
}

export const fetchAssignedMentees = async (
  mentorId: string,
  filters?: MenteeFilters
): Promise<ServiceResult<AssignedMentee[]>> => {
  try {
    const constraints: QueryConstraint[] = [where('mentorId', '==', mentorId)]
    const menteeQuery = query(collection(db, 'users'), ...constraints)
    const snapshot = await getDocs(menteeQuery)
    const mentees = snapshot.docs.map((doc) =>
      withComputedMenteeFields({
        ...(doc.data() as UserProfile),
        id: doc.id,
      })
    )

    return { data: applyFilters(mentees, filters), error: null }
  } catch (error) {
    const normalized = handleServiceError('fetchAssignedMentees failed', error)
    return { data: [], error: normalized }
  }
}

export const subscribeToAssignedMentees = (
  mentorId: string,
  onUpdate: (mentees: AssignedMentee[]) => void,
  onError?: (error: Error) => void,
  filters?: MenteeFilters
): Unsubscribe => {
  const menteeQuery = query(collection(db, 'users'), where('mentorId', '==', mentorId))

  return onSnapshot(
    menteeQuery,
    (snapshot) => {
      const mentees = snapshot.docs.map((doc) =>
        withComputedMenteeFields({
          ...(doc.data() as UserProfile),
          id: doc.id,
        })
      )
      onUpdate(applyFilters(mentees, filters))
    },
    (error) => {
      const normalized = handleServiceError('subscribeToAssignedMentees failed', error)
      onError?.(normalized)
    }
  )
}

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
    (error) => onError?.(handleServiceError('subscribeToMentorshipSessionsForMentor failed', error))
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
    (error) => onError?.(handleServiceError('subscribeToMentorNotifications failed', error))
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
    (error) => onError?.(handleServiceError('subscribeToUnreadMentorNotificationCount failed', error))
  )
}
