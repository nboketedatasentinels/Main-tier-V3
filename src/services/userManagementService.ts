import {
  Timestamp,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from './firebase'
import { supabase } from '@/services/supabase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { removeUndefinedFields } from '@/utils/firestore'
import { normalizeEmail } from '@/utils/email'
import { normalizeRole } from '@/utils/role'
import { resetUserJourney } from './userJourneyService'
import type { JourneyType } from '@/config/pointsConfig'

export type ManagedUserRole = 'user' | 'partner' | 'admin' | 'super_admin' | 'team_leader' | 'mentor' | 'ambassador'
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
  transformationTier?: string | null
  journeyType?: JourneyType | null
  mentorId?: string | null
  ambassadorId?: string | null
  isActiveAmbassador?: boolean
  notes?: string | null
  assignedOrganizations?: string[]
  accessLastUpdatedAt?: Date | null
  accessLastUpdatedBy?: string | null
  accessLastUpdatedByName?: string | null
  accessLastReason?: string | null
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

const usersCollection = collection(db, 'users')
const organizationsCollection = collection(db, ORG_COLLECTION)
const engagementCollection = collection(db, 'user_engagement_scores')

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
    transformationTier?: string
    lastActive?: Timestamp | string | number
    lastActiveAt?: Timestamp | string | number
    createdAt?: Timestamp | string | number
    accessLastUpdatedAt?: Timestamp | string | number
    accessLastUpdatedBy?: string
    accessLastUpdatedByName?: string
    accessLastReason?: string
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
    accountStatus: data.accountStatus || 'active',
    transformationTier: data.transformationTier || null,
    journeyType: (data.journeyType as JourneyType) || null,
    mentorId: data.mentorId,
    ambassadorId: data.ambassadorId,
    isActiveAmbassador: data.isActiveAmbassador,
    assignedOrganizations: Array.isArray(data.assignedOrganizations)
      ? data.assignedOrganizations.filter((assignment): assignment is string => Boolean(assignment))
      : undefined,
    notes: data.notes,
    accessLastUpdatedAt: parseDateValue(data.accessLastUpdatedAt),
    accessLastUpdatedBy: data.accessLastUpdatedBy || null,
    accessLastUpdatedByName: data.accessLastUpdatedByName || null,
    accessLastReason: data.accessLastReason || null,
  }
}

const buildUsersQuery = () => query(usersCollection, orderBy('createdAt', 'desc'))

const scoreUserDocForEmailCanonical = (docSnap: { id: string; data: () => unknown }, index: number) => {
  const data = docSnap.data() as {
    id?: string
    membershipStatus?: MembershipStatus
    companyId?: string | null
    companyCode?: string | null
    assignedOrganizations?: unknown
    role?: string | null
    mergedInto?: string | null
  }

  if (data.mergedInto) return { score: -1000, index }

  let score = 0
  if (data.id && data.id === docSnap.id) score += 100
  if (data.membershipStatus === 'paid') score += 25
  if (data.companyId) score += 15
  if (data.companyCode) score += 5
  if (Array.isArray(data.assignedOrganizations) && data.assignedOrganizations.length > 0) score += 5
  if (data.role && data.role !== 'free_user') score += 2

  return { score, index }
}

export const dedupeUserDocsByEmail = <T extends { id: string; data: () => unknown }>(docs: T[]): T[] => {
  const bestByEmail = new Map<string, { id: string; score: number; index: number }>()

  docs.forEach((docSnap, index) => {
    const data = docSnap.data() as { email?: string | null }
    const emailKey = normalizeEmail(data.email || '')
    if (!emailKey) return

    const { score } = scoreUserDocForEmailCanonical(docSnap, index)
    const current = bestByEmail.get(emailKey)
    if (!current || score > current.score || (score === current.score && index < current.index)) {
      bestByEmail.set(emailKey, { id: docSnap.id, score, index })
    }
  })

  return docs.filter((docSnap) => {
    const data = docSnap.data() as { email?: string | null }
    const emailKey = normalizeEmail(data.email || '')
    if (!emailKey) return true
    return bestByEmail.get(emailKey)?.id === docSnap.id
  })
}

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
        const deduped = dedupeUserDocsByEmail(snapshot.docs)
        onData(deduped.map(mapUser))
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

// Supabase migration helpers.
// The app's MembershipStatus type includes 'inactive', but the public.profiles
// membership_status column only accepts 'free' | 'paid'. We map 'inactive' to
// 'free' so the write does not violate the column constraint.
const toProfilesMembershipStatus = (status: MembershipStatus): 'free' | 'paid' =>
  status === 'paid' ? 'paid' : 'free'

// profiles.role CHECK accepts only: free_user|paid_member|mentor|ambassador|
// partner|super_admin. normalizeRole maps legacy values (admin->partner, etc.)
// but returns 'user' as its base; the DB enum uses 'free_user'. Coerce here so a
// role write never violates the CHECK constraint.
const toProfilesRole = (role: ManagedUserRole): string => {
  const normalized = normalizeRole(role)
  return normalized === 'user' ? 'free_user' : normalized
}

const throwIfSupabaseError = (error: { message: string } | null, action: string) => {
  if (error) {
    throw new Error(`${action} failed: ${error.message}`)
  }
}

export const updateUserRole = async (userId: string, role: ManagedUserRole, companyId?: string | null) => {
  const updates: Record<string, unknown> = {
    role: toProfilesRole(role),
    updated_at: new Date().toISOString(),
  }
  if (typeof companyId !== 'undefined') {
    updates.company_id = companyId
  }
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
  throwIfSupabaseError(error, 'updateUserRole')
}

export const updateMembershipStatus = async (userId: string, membershipStatus: MembershipStatus) => {
  const { error } = await supabase
    .from('profiles')
    .update({
      membership_status: toProfilesMembershipStatus(membershipStatus),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  throwIfSupabaseError(error, 'updateMembershipStatus')
}

// Reassigns a learner's journey when their membership changes (free <-> paid).
// Writes the journey fields the learner app reads from Supabase profiles
// (journey_type / journey_start_date / current_week) AND refreshes the Firestore
// user_journeys doc the points/windows system reads, so the change reflects on
// both the weekly checklist and the points dashboard. Resets the timeline to
// Week 1 / Window 1 with a fresh start date.
export const assignUserJourney = async (params: {
  userId: string
  journeyType: JourneyType
  journeyStartDateISO: string
  actorId?: string | null
  actorName?: string | null
  reason?: string | null
}) => {
  const { userId, journeyType, journeyStartDateISO, actorId, actorName, reason } = params
  const nowISO = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update({
      journey_type: journeyType,
      journey_start_date: journeyStartDateISO,
      current_week: 1,
      updated_at: nowISO,
    })
    .eq('id', userId)
  throwIfSupabaseError(error, 'assignUserJourney')

  // Keep the Firestore user_journeys doc (points dashboard / windows) in sync.
  // Best-effort: a failure here must not undo the profile write above.
  try {
    await resetUserJourney(userId, journeyType, journeyStartDateISO)
  } catch (journeyDocError) {
    console.warn('[assignUserJourney] failed to sync user_journeys doc', journeyDocError)
  }

  // Best-effort audit row so the journey reassignment is traceable alongside the
  // access change that triggered it.
  const auditEntry = removeUndefinedFields({
    action: 'user_journey_reassigned',
    user_id: userId,
    admin_id: actorId || undefined,
    admin_name: actorName || undefined,
    created_at: nowISO,
    metadata: {
      reason: reason || null,
      journeyType,
      journeyStartDate: journeyStartDateISO,
    },
  })
  const { error: auditError } = await supabase.from('admin_activity_log').insert(auditEntry)
  if (auditError) {
    console.warn('[assignUserJourney] failed to write audit log', auditError.message)
  }
}

export const deleteUserAccount = async (userId: string) => {
  // A browser (anon) Supabase client cannot delete an auth.users row - that
  // requires the service-role key and must be done server-side (e.g. an Edge
  // Function / admin API). Here we only remove the public.profiles row.
  const { error } = await supabase.from('profiles').delete().eq('id', userId)
  throwIfSupabaseError(error, 'deleteUserAccount')
}

export const bulkUpdateRole = async (userIds: string[], role: ManagedUserRole) => {
  if (!userIds.length) {
    return { successfulIds: [], failedIds: [] }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ role: toProfilesRole(role), updated_at: new Date().toISOString() })
    .in('id', userIds)
  // Single bulk statement: it succeeds or fails as a whole, so we cannot report
  // per-id failures the way the old per-doc loop did.
  if (error) {
    return { successfulIds: [], failedIds: [...userIds] }
  }
  return { successfulIds: [...userIds], failedIds: [] }
}

export const bulkUpdateMembershipStatus = async (userIds: string[], membershipStatus: MembershipStatus) => {
  if (!userIds.length) {
    return { successfulIds: [], failedIds: [] }
  }
  const { error } = await supabase
    .from('profiles')
    .update({
      membership_status: toProfilesMembershipStatus(membershipStatus),
      updated_at: new Date().toISOString(),
    })
    .in('id', userIds)
  if (error) {
    return { successfulIds: [], failedIds: [...userIds] }
  }
  return { successfulIds: [...userIds], failedIds: [] }
}

export const assignRoleToUser = async (
  userId: string,
  role: Extract<ManagedUserRole, 'mentor' | 'ambassador'>,
  company?: OrganizationOption | null,
  notes?: string,
) => {
  const payload: Record<string, unknown> = {
    role: toProfilesRole(role),
    account_status: 'active',
    updated_at: new Date().toISOString(),
  }

  if (role === 'ambassador') {
    payload.is_active_ambassador = true
  }

  if (company) {
    payload.company_id = company.id
    payload.company_code = company.code || null
    payload.company_name = company.name
  }

  if (notes) {
    payload.notes = notes
  }

  const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
  throwIfSupabaseError(error, 'assignRoleToUser')

  // Best-effort role-assignment notification. A failure here must not roll back
  // the role assignment above, so we log and continue rather than throw.
  const { error: notificationError } = await supabase.from('notifications').insert({
    user_id: userId,
    type: 'role_assignment',
    message: `You have been assigned the role of ${role}.`,
    is_read: false,
    created_at: new Date().toISOString(),
    metadata: {
      notes: notes || null,
    },
  })
  if (notificationError) {
    console.warn('[assignRoleToUser] failed to create notification', notificationError.message)
  }
}

// Maps the camelCase ManagedUserRecord fields that correspond to real
// public.profiles columns onto their snake_case column names. Only mappable
// fields are forwarded; unmapped record fields (e.g. derived/display values)
// are dropped so the Supabase write does not reference unknown columns.
const mapManagedUserUpdatesToProfileColumns = (updates: Partial<ManagedUserRecord>) => {
  const columns: Record<string, unknown> = {}
  if (typeof updates.role !== 'undefined') columns.role = toProfilesRole(updates.role)
  if (typeof updates.membershipStatus !== 'undefined') {
    columns.membership_status = toProfilesMembershipStatus(updates.membershipStatus)
  }
  if (typeof updates.companyId !== 'undefined') columns.company_id = updates.companyId
  if (typeof updates.companyCode !== 'undefined') columns.company_code = updates.companyCode
  if (typeof updates.companyName !== 'undefined') columns.company_name = updates.companyName
  if (typeof updates.transformationTier !== 'undefined') {
    columns.transformation_tier = updates.transformationTier
  }
  // NOTE: account_status and assigned_organizations are intentionally NOT
  // written here - they are not columns on public.profiles (account_status does
  // not exist; assigned_organizations is mirrored in the `data` jsonb / handled
  // by the separate org-assignment path). Including them made every access
  // update 400 ("column profiles.account_status does not exist"), silently
  // failing the whole Edit Access save (role/membership/tier included).
  if (typeof updates.notes !== 'undefined') columns.notes = updates.notes
  if (typeof updates.mentorId !== 'undefined') columns.mentor_id = updates.mentorId
  if (typeof updates.ambassadorId !== 'undefined') columns.ambassador_id = updates.ambassadorId
  if (typeof updates.isActiveAmbassador !== 'undefined') {
    columns.is_active_ambassador = updates.isActiveAmbassador
  }
  return columns
}

export const updateUser = async (userId: string, updates: Partial<ManagedUserRecord>) => {
  const payload = mapManagedUserUpdatesToProfileColumns(updates)
  payload.updated_at = new Date().toISOString()
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
  throwIfSupabaseError(error, 'updateUser')
}

type AccessAuditField =
  | 'role'
  | 'membershipStatus'
  | 'accountStatus'
  | 'transformationTier'
  | 'companyId'
  | 'companyName'
  | 'companyCode'
  | 'assignedOrganizations'

const accessAuditFields: AccessAuditField[] = [
  'role',
  'membershipStatus',
  'accountStatus',
  'transformationTier',
  'companyId',
  'companyName',
  'companyCode',
  'assignedOrganizations',
]

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .sort()
}

const isAuditValueEqual = (left: unknown, right: unknown) => {
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftArray = normalizeStringArray(left)
    const rightArray = normalizeStringArray(right)
    if (leftArray.length !== rightArray.length) return false
    return leftArray.every((value, index) => value === rightArray[index])
  }
  return (left ?? null) === (right ?? null)
}

const pickAccessAuditSnapshot = (record: Partial<ManagedUserRecord>) => {
  const snapshot = {
    role: record.role ?? null,
    membershipStatus: record.membershipStatus ?? null,
    accountStatus: record.accountStatus ?? null,
    transformationTier: record.transformationTier ?? null,
    companyId: record.companyId ?? null,
    companyName: record.companyName ?? null,
    companyCode: record.companyCode ?? null,
    assignedOrganizations: normalizeStringArray(record.assignedOrganizations),
  }
  return removeUndefinedFields(snapshot)
}

export const updateUserAccessWithAudit = async (params: {
  userId: string
  updates: Partial<ManagedUserRecord>
  before: Partial<ManagedUserRecord>
  after: Partial<ManagedUserRecord>
  actorId?: string | null
  actorName?: string | null
  reason?: string | null
  source?: string
}) => {
  const {
    userId,
    updates,
    before,
    after,
    actorId,
    actorName,
    reason,
    source = 'users_management_panel',
  } = params

  const changedFields = accessAuditFields.filter((field) => !isAuditValueEqual(before[field], after[field]))
  if (!changedFields.length) return

  const payload = mapManagedUserUpdatesToProfileColumns(updates)
  payload.access_last_updated_at = new Date().toISOString()
  payload.access_last_updated_by = actorId || null
  payload.access_last_updated_by_name = actorName || null
  payload.access_last_reason = reason || null
  payload.updated_at = new Date().toISOString()

  const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
  throwIfSupabaseError(error, 'updateUserAccessWithAudit')

  // Best-effort audit trail. A failure to record the audit row must not undo
  // the access change that already succeeded above, so we log and continue.
  const auditEntry = removeUndefinedFields({
    action: 'user_access_updated',
    user_id: userId,
    admin_id: actorId || undefined,
    admin_name: actorName || undefined,
    created_at: new Date().toISOString(),
    metadata: {
      reason: reason || null,
      source,
      changedFields,
      before: pickAccessAuditSnapshot(before),
      after: pickAccessAuditSnapshot(after),
    },
  })

  const { error: auditError } = await supabase.from('admin_activity_log').insert(auditEntry)
  if (auditError) {
    console.warn('[updateUserAccessWithAudit] failed to write audit log', auditError.message)
  }
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
