import { Timestamp, collection, doc, DocumentSnapshot, getDoc, getDocs, query, where } from 'firebase/firestore'
import { type OrganizationStatistics, type OrganizationUserProfile } from '@/types/admin'
import { db } from './firebase'

// ============================================================================
// CRITICAL FIX: Changed from 'users' to 'profiles'
// 
// The bug: Partner dashboard was querying the 'users' collection, but user data
// actually lives in the 'profiles' collection. This caused:
// - Metrics to show numbers (computed elsewhere from profiles)
// - Partner UI to show "No users found" (because 'users' collection is empty/different)
// - Super Admin to see users (because it reads from profiles)
// ============================================================================
const profilesCollection = collection(db, 'profiles')

// Keep a reference to users collection for operations that still need it
// (e.g., checkOrganizationAccess which checks assignedOrganizations on users)
const usersCollection = collection(db, 'users')

const parseUserDate = (value?: Timestamp | string | Date | number | null): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const maybeDate = (value as { toDate?: () => Date })?.toDate?.()
  return maybeDate || null
}

/**
 * Fetch profile documents for users belonging to an organization.
 * Queries the 'profiles' collection (not 'users') using multiple field variants.
 */
const fetchOrganizationUserDocs = async (organizationKey: string): Promise<DocumentSnapshot[]> => {
  const trimmed = organizationKey.trim()
  if (!trimmed) return []
  
  // Query profiles collection with all possible organization identifier fields
  const [
    companySnapshot,
    legacyCompanySnapshot,
    orgCodeSnapshot,
    companyIdSnapshot,
    organizationIdSnapshot,
  ] = await Promise.all([
    getDocs(query(profilesCollection, where('companyCode', '==', trimmed))),
    getDocs(query(profilesCollection, where('company_code', '==', trimmed))),
    getDocs(query(profilesCollection, where('organization_code', '==', trimmed))),
    getDocs(query(profilesCollection, where('companyId', '==', trimmed))),
    getDocs(query(profilesCollection, where('organizationId', '==', trimmed))),
  ])
  
  // Deduplicate by document ID
  const usersMap = new Map<string, DocumentSnapshot>()
  companySnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  legacyCompanySnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  orgCodeSnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  companyIdSnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  organizationIdSnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  
  return Array.from(usersMap.values())
}

/**
 * Check whether a user has access to an organization based on assigned organizations.
 * Note: This still queries the 'users' collection because assignedOrganizations
 * is stored there for admin/partner users.
 */
export const checkOrganizationAccess = async (
  userId: string,
  organizationId?: string,
  organizationCode?: string,
): Promise<{ authorized: boolean }> => {
  if (!userId) return { authorized: false }
  const userSnap = await getDoc(doc(usersCollection, userId))
  if (!userSnap.exists()) return { authorized: false }
  const data = userSnap.data() as { assignedOrganizations?: string[] }
  const assignments = (data.assignedOrganizations || [])
    .map((entry) => entry?.trim().toLowerCase())
    .filter((entry): entry is string => !!entry)
  if (!assignments.length) return { authorized: false }

  const targets = [organizationId, organizationCode]
    .map((entry) => entry?.trim().toLowerCase())
    .filter((entry): entry is string => !!entry)

  const authorized = targets.some((target) => assignments.includes(target))
  return { authorized }
}

/**
 * Calculate engagement and membership statistics for an organization.
 * Now queries 'profiles' collection.
 */
export const fetchOrganizationEngagementStats = async (organizationKey: string): Promise<OrganizationStatistics> => {
  if (!organizationKey) {
    return {
      totalMembers: 0,
      activeMembers: 0,
      paidMembers: 0,
      newMembersThisWeek: 0,
      averageEngagementRate: 0,
    }
  }

  const docs = await fetchOrganizationUserDocs(organizationKey)
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 7)

  let totalMembers = 0
  let activeMembers = 0
  let paidMembers = 0
  let newMembersThisWeek = 0
  let engagementScoreSum = 0
  let engagementScoreCount = 0

  docs.forEach((docSnap) => {
    totalMembers += 1
    const data = docSnap.data() as {
      membershipStatus?: OrganizationUserProfile['membershipStatus']
      accountStatus?: OrganizationUserProfile['accountStatus']
      status?: string
      createdAt?: Timestamp | string | Date | number
      engagementScore?: number
      engagementRate?: number
    }
    // Check both accountStatus and status fields
    const accountStatus = data.accountStatus || data.status || 'active'
    if (accountStatus === 'active' || accountStatus === 'Active') {
      activeMembers += 1
    }
    if ((data.membershipStatus || 'inactive') === 'paid') {
      paidMembers += 1
    }
    const createdAt = parseUserDate(data.createdAt)
    if (createdAt && createdAt >= weekAgo) {
      newMembersThisWeek += 1
    }
    const score = typeof data.engagementScore === 'number' ? data.engagementScore : data.engagementRate
    if (typeof score === 'number') {
      engagementScoreSum += score
      engagementScoreCount += 1
    }
  })

  const averageEngagementRate = engagementScoreCount ? Math.round(engagementScoreSum / engagementScoreCount) : 0

  return {
    totalMembers,
    activeMembers,
    paidMembers,
    newMembersThisWeek,
    averageEngagementRate,
  }
}

/**
 * Fetch user profiles associated with an organization.
 * 
 * CRITICAL FIX: Now queries 'profiles' collection and maps all fields
 * with proper defaults so the UI renders correctly.
 */
export const fetchOrganizationUsers = async (organizationKey: string): Promise<OrganizationUserProfile[]> => {
  if (!organizationKey) return []
  
  const docs = await fetchOrganizationUserDocs(organizationKey)
  
  return docs.map((docSnap) => {
    const data = docSnap.data() as {
      // Name fields
      fullName?: string
      name?: string
      firstName?: string
      lastName?: string
      email?: string
      
      // Role and status
      role?: string
      membershipStatus?: OrganizationUserProfile['membershipStatus']
      accountStatus?: OrganizationUserProfile['accountStatus']
      status?: string
      
      // Timestamps
      lastActiveAt?: Timestamp | string | Date | number
      lastActive?: Timestamp | string | Date | number
      updatedAt?: Timestamp | string | Date | number
      createdAt?: Timestamp | string | Date | number
      
      // Avatar
      avatarUrl?: string
      photoURL?: string
      
      // Organization identifiers
      organizationId?: string
      organization_id?: string
      companyCode?: string
      company_code?: string
      
      // Progress fields (for PartnerUser compatibility)
      progressPercent?: number
      progress_percent?: number
      currentWeek?: number
      current_week?: number
      weeklyEarned?: number
      weekly_earned?: number
      weeklyRequired?: number
      weekly_required?: number
      
      // Risk fields
      riskStatus?: string
      risk_status?: string
      riskReasons?: string[]
      risk_reasons?: string[]
      
      // Nudge fields
      nudgeEnabled?: boolean
      nudge_enabled?: boolean
      adminNotes?: string
      admin_notes?: string
    }
    
    // Resolve organization identifiers
    const organizationId = data.organizationId || data.organization_id || null
    const companyCode = data.companyCode || data.company_code || null
    
    // Resolve name with fallbacks
    const fullName =
      data.fullName ||
      data.name ||
      [data.firstName, data.lastName].filter((value) => !!value).join(' ').trim() ||
      data.email ||
      'Unknown user'
    
    // Resolve role (normalize to lowercase)
    const rawRole = data.role || 'learner'
    const role = rawRole.toLowerCase() as OrganizationUserProfile['role']
    
    // Resolve status
    const accountStatus = data.accountStatus || data.status || 'active'
    const normalizedStatus = accountStatus === 'Active' ? 'active' : accountStatus
    
    // Resolve lastActive with multiple fallbacks
    const lastActive = parseUserDate(
      data.lastActiveAt || data.lastActive || data.updatedAt || null
    )
    
    return {
      id: docSnap.id,
      name: fullName,
      email: data.email ?? '',
      role,
      membershipStatus: data.membershipStatus || 'inactive',
      accountStatus: normalizedStatus as OrganizationUserProfile['accountStatus'],
      status: normalizedStatus === 'active' ? 'Active' : 'Inactive',
      lastActive,
      createdAt: parseUserDate(data.createdAt),
      avatarUrl: data.avatarUrl ?? data.photoURL ?? null,
      organizationId: organizationId?.trim() || null,
      companyCode: companyCode?.trim() || null,
      
      // ========================================================================
      // REQUIRED DEFAULTS for PartnerUser compatibility
      // Without these, the UI will have silent failures or show incorrect data
      // ========================================================================
      progressPercent: data.progressPercent ?? data.progress_percent ?? 0,
      currentWeek: data.currentWeek ?? data.current_week ?? 0,
      weeklyEarned: data.weeklyEarned ?? data.weekly_earned ?? 0,
      weeklyRequired: data.weeklyRequired ?? data.weekly_required ?? 0,
      riskStatus: (data.riskStatus ?? data.risk_status ?? 'engaged') as 'engaged' | 'watch' | 'concern' | 'critical' | 'at_risk',
      riskReasons: data.riskReasons ?? data.risk_reasons ?? [],
      nudgeEnabled: data.nudgeEnabled ?? data.nudge_enabled ?? true,
      adminNotes: data.adminNotes ?? data.admin_notes ?? '',
    }
  })
}