import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { ORG_COLLECTION } from '@/constants/organizations'

export type ManagedUserRole = 'user' | 'partner' | 'super_admin' | 'mentor' | 'ambassador'
export type MembershipStatus = 'free' | 'paid' | 'inactive'

export interface OrganizationOption {
  id: string
  name: string
  code?: string
}

export interface ManagedUserRecord {
  id: string
  name: string
  email?: string
  role: ManagedUserRole
  membershipStatus: MembershipStatus
  companyId?: string | null
  companyName?: string | null
  companyCode?: string | null
  lastActive?: Date | null
  createdAt?: Date | null
  accountStatus?: string
  mentorId?: string | null
  ambassadorId?: string | null
  isActiveAmbassador?: boolean
  notes?: string | null
}

export type RiskLevel = 'critical' | 'high' | 'moderate' | 'low' | 'emerging' | 'recovering' | 'unknown'
export type InterventionStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'not_started'

export interface EngagementRosterEntry {
  id: string
  userId: string
  name: string
  email?: string
  organizationName?: string | null
  organizationCode?: string | null
  mentorName?: string | null
  mentorId?: string | null
  riskLevel: RiskLevel
  engagementScore: number
  trend30d?: number
  lastActive?: Date | null
  interventionStatus?: InterventionStatus
  lastInterventionAt?: Date | null
  nextCheckInAt?: Date | null
  companyId?: string | null
  impactPoints?: number
  role?: ManagedUserRole
}

export interface EngagementTotals {
  monitoredUsers: number
  atRisk: number
  interventionsOpen: number
  flagged: number
}

export interface RiskSummary {
  label: string
  userCount: number
  avgScore: number
  change: number
  trend: 'up' | 'down' | 'flat'
  color: string
}

export interface EngagementTrendPoint {
  label: string
  avgScore: number
  highRiskUsers: number
  interventions: number
}

const usersCollection = collection(db, 'profiles')
const organizationsCollection = collection(db, ORG_COLLECTION)
const engagementCollection = collection(db, 'user_engagement_scores')
const notificationsCollection = collection(db, 'notifications')

const parseDateValue = (value?: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const maybeDate = (value as { toDate?: () => Date })?.toDate?.()
  return maybeDate || null
}

const mapUser = (docSnap: { id: string; data: () => unknown }): ManagedUserRecord => {
  const data = docSnap.data() as Partial<ManagedUserRecord> & {
    firstName?: string
    lastName?: string
    fullName?: string
    membershipStatus?: MembershipStatus
    companyId?: string
    companyCode?: string
    companyName?: string
    accountStatus?: string
    lastActive?: Timestamp | string | number
    lastActiveAt?: Timestamp | string | number
    createdAt?: Timestamp | string | number
  }

  const name =
    data.name ||
    data.fullName ||
    [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
    data.email ||
    'Unknown user'

  return {
    id: docSnap.id,
    name,
    email: data.email,
    role: (data.role as ManagedUserRole) || 'user',
    membershipStatus: data.membershipStatus || 'free',
    companyId: data.companyId || null,
    companyCode: data.companyCode || null,
    companyName: data.companyName || null,
    lastActive: parseDateValue(data.lastActive || data.lastActiveAt),
    createdAt: parseDateValue(data.createdAt),
    accountStatus: data.accountStatus,
    mentorId: data.mentorId,
    ambassadorId: data.ambassadorId,
    isActiveAmbassador: data.isActiveAmbassador,
    notes: data.notes,
  }
}

const buildUsersQuery = () => query(usersCollection, orderBy('createdAt', 'desc'))

export const listenToUsers = ({
  onData,
  onError,
  onStatusChange,
}: {
  onData: (users: ManagedUserRecord[]) => void
  onError?: (error: unknown) => void
  onStatusChange?: (status: 'connecting' | 'connected' | 'error' | 'retrying', detail?: Record<string, unknown>) => void
}) => {
  let unsubscribe: (() => void) | null = null
  let closed = false
  let attempt = 0

  const subscribe = () => {
    if (closed) return
    onStatusChange?.('connecting')
    const usersQuery = buildUsersQuery()
    console.log('🟣 [Admin] listenToUsers => profiles query createdAt desc')
    unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        attempt = 0
        onStatusChange?.('connected')
        onData(snapshot.docs.map(mapUser))
      },
      (err) => {
        console.error('🔴 [Admin] profiles listener failed', err)
        onStatusChange?.('error', { error: err })
        onError?.(err)
        attempt += 1
        const delay = Math.min(1000 * 2 ** (attempt - 1), 30000)
        onStatusChange?.('retrying', { attempt, delay })
        setTimeout(() => {
          if (closed) return
          subscribe()
        }, delay)
      }
    )
  }

  subscribe()

  return () => {
    closed = true
    if (unsubscribe) {
      unsubscribe()
    }
  }
}

export const fetchOrganizationsList = async (): Promise<OrganizationOption[]> => {
  const snapshot = await getDocs(query(organizationsCollection, orderBy('name', 'asc')))
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as { name?: string; code?: string }
    return { id: docSnap.id, name: data.name || 'Untitled organization', code: data.code }
  })
}

export const updateUserRole = async (userId: string, role: ManagedUserRole, companyId?: string | null) => {
  const userRef = doc(db, 'profiles', userId)
  const updates: Record<string, unknown> = {
    role,
    updatedAt: serverTimestamp(),
  }
  if (typeof companyId !== 'undefined') {
    updates.companyId = companyId
  }
  await updateDoc(userRef, updates)
}

export const updateMembershipStatus = async (userId: string, membershipStatus: MembershipStatus) => {
  const userRef = doc(db, 'profiles', userId)
  await updateDoc(userRef, {
    membershipStatus,
    updatedAt: serverTimestamp(),
  })
}

export const deleteUserAccount = async (userId: string) => {
  const userRef = doc(db, 'profiles', userId)
  await deleteDoc(userRef)
}

export const bulkUpdateRole = async (userIds: string[], role: ManagedUserRole) => {
  const results = await Promise.allSettled(userIds.map((id) => updateUserRole(id, role)))
  const failedIds = results
    .map((result, idx) => (result.status === 'rejected' ? userIds[idx] : null))
    .filter((id): id is string => typeof id === 'string')
  return {
    successfulIds: userIds.filter((id) => !failedIds.includes(id)),
    failedIds,
  }
}

export const bulkUpdateMembershipStatus = async (userIds: string[], membershipStatus: MembershipStatus) => {
  const results = await Promise.allSettled(userIds.map((id) => updateMembershipStatus(id, membershipStatus)))
  const failedIds = results
    .map((result, idx) => (result.status === 'rejected' ? userIds[idx] : null))
    .filter((id): id is string => typeof id === 'string')
  return {
    successfulIds: userIds.filter((id) => !failedIds.includes(id)),
    failedIds,
  }
}

export const assignRoleToUser = async (
  userId: string,
  role: Extract<ManagedUserRole, 'mentor' | 'ambassador'>,
  company?: OrganizationOption | null,
  notes?: string,
) => {
  const payload: Record<string, unknown> = {
    role,
    accountStatus: 'active',
    updatedAt: serverTimestamp(),
  }

  if (role === 'ambassador') {
    payload.isActiveAmbassador = true
  }

  if (company) {
    payload.companyId = company.id
    payload.companyCode = company.code || null
    payload.companyName = company.name
  }

  if (notes) {
    payload.notes = notes
  }

  await updateDoc(doc(db, 'profiles', userId), payload)

  await addDoc(notificationsCollection, {
    user_id: userId,
    type: 'role_assignment',
    message: `You have been assigned the role of ${role}.`,
    is_read: false,
    created_at: serverTimestamp(),
    metadata: {
      notes: notes || null,
    },
  })
}

export const updateUser = async (userId: string, updates: Partial<ManagedUserRecord>) => {
  const payload = { ...updates }
  delete (payload as { id?: string }).id
  await updateDoc(doc(db, 'profiles', userId), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export const fetchEngagementRoster = async (): Promise<EngagementRosterEntry[]> => {
  const [engagementSnapshot, usersSnapshot, companiesSnapshot] = await Promise.all([
    getDocs(engagementCollection),
    getDocs(usersCollection),
    getDocs(organizationsCollection),
  ])

  const userIndex = new Map<string, ManagedUserRecord>()
  usersSnapshot.docs.forEach((docSnap) => userIndex.set(docSnap.id, mapUser(docSnap)))

  const companyIndex = new Map<string, { name?: string; code?: string }>()
  companiesSnapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as { name?: string; code?: string }
    companyIndex.set(docSnap.id, data)
  })

  return engagementSnapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Partial<EngagementRosterEntry> & {
      userId?: string
      organizationId?: string
      organizationCode?: string
      organizationName?: string
      mentorName?: string
      mentorId?: string
      companyId?: string
      riskLevel?: RiskLevel
      engagementScore?: number
      trend30d?: number
      lastActive?: Timestamp | string | number
      interventionStatus?: InterventionStatus
      lastInterventionAt?: Timestamp | string | number
      nextCheckInAt?: Timestamp | string | number
      impactPoints?: number
    }

    const userId = data.userId || docSnap.id
    const user = userIndex.get(userId)
    const companyId = data.companyId || user?.companyId || data.organizationId || null
    const company = companyId ? companyIndex.get(companyId) : undefined

    return {
      id: docSnap.id,
      userId,
      name: user?.name || data.name || 'Unknown user',
      email: user?.email,
      organizationName: data.organizationName || company?.name || user?.companyName || null,
      organizationCode: data.organizationCode || company?.code || user?.companyCode || null,
      mentorName: data.mentorName || null,
      mentorId: data.mentorId || null,
      riskLevel: (data.riskLevel as RiskLevel) || 'unknown',
      engagementScore: data.engagementScore ?? 0,
      trend30d: data.trend30d,
      lastActive: parseDateValue(data.lastActive),
      interventionStatus: data.interventionStatus,
      lastInterventionAt: parseDateValue(data.lastInterventionAt),
      nextCheckInAt: parseDateValue(data.nextCheckInAt),
      companyId,
      impactPoints: data.impactPoints,
      role: user?.role,
    }
  })
}

export const fetchEngagementTrendSeries = async (): Promise<EngagementTrendPoint[]> => {
  const trendCollection = collection(db, 'engagement_trends')
  const snapshot = await getDocs(trendCollection)

  if (snapshot.empty) {
    return []
  }

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Partial<EngagementTrendPoint> & {
      label?: string
      avgScore?: number
      highRiskUsers?: number
      interventions?: number
    }

    return {
      label: data.label || docSnap.id,
      avgScore: data.avgScore ?? 0,
      highRiskUsers: data.highRiskUsers ?? 0,
      interventions: data.interventions ?? 0,
    }
  })
}

export const fetchEngagementHistory = async (userId: string): Promise<Array<{ label: string; engagementScore: number; impactPoints?: number }>> => {
  const historyCollection = collection(db, 'profiles', userId, 'engagement_history')
  const snapshot = await getDocs(historyCollection)
  if (snapshot.empty) return []

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as { label?: string; engagementScore?: number; impactPoints?: number }
    return {
      label: data.label || docSnap.id,
      engagementScore: data.engagementScore ?? 0,
      impactPoints: data.impactPoints,
    }
  })
}

export const fetchRecentActivities = async (
  userId: string,
): Promise<Array<{ title: string; description?: string; timestamp?: Date | null; category?: string; actor?: string; type?: string }>> => {
  const activityCollection = collection(db, 'profiles', userId, 'recent_activity')
  const snapshot = await getDocs(activityCollection)
  if (snapshot.empty) return []

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as {
      title?: string
      description?: string
      timestamp?: Timestamp | string | number
      category?: string
      actor?: string
      type?: string
    }
    return {
      title: data.title || 'Activity',
      description: data.description,
      timestamp: parseDateValue(data.timestamp),
      category: data.category,
      actor: data.actor,
      type: data.type,
    }
  })
}
