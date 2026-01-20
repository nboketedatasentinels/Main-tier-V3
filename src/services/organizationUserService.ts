import { Timestamp, collection, doc, DocumentSnapshot, getDoc, getDocs, query, where } from 'firebase/firestore'
import { type OrganizationStatistics, type OrganizationUserProfile } from '@/types/admin'
import { db } from './firebase'

// ============================================================================
// CRITICAL FIX: Changed from 'users' to 'profiles'
// ============================================================================
const profilesCollection = collection(db, 'profiles')
const usersCollection = collection(db, 'users')

// DEBUG: Log on module load to confirm this file is being used
console.log('[organizationUserService] ✅ Module loaded - querying PROFILES collection')

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
 */
const fetchOrganizationUserDocs = async (organizationKey: string): Promise<DocumentSnapshot[]> => {
  const trimmed = organizationKey.trim()
  
  // DEBUG: Log every call
  console.log('[fetchOrganizationUserDocs] 🔍 Called with organizationKey:', trimmed)
  
  if (!trimmed) {
    console.log('[fetchOrganizationUserDocs] ⚠️ Empty organizationKey, returning []')
    return []
  }
  
  console.log('[fetchOrganizationUserDocs] 📡 Querying PROFILES collection...')
  
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
  
  // DEBUG: Log results from each query
  console.log('[fetchOrganizationUserDocs] 📊 Query results:', {
    companyCode: companySnapshot.docs.length,
    company_code: legacyCompanySnapshot.docs.length,
    organization_code: orgCodeSnapshot.docs.length,
    companyId: companyIdSnapshot.docs.length,
    organizationId: organizationIdSnapshot.docs.length,
  })
  
  // Deduplicate by document ID
  const usersMap = new Map<string, DocumentSnapshot>()
  companySnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  legacyCompanySnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  orgCodeSnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  companyIdSnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  organizationIdSnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  
  const result = Array.from(usersMap.values())
  console.log('[fetchOrganizationUserDocs] ✅ Total unique profiles found:', result.length)
  
  // DEBUG: Log sample data from first profile
  if (result.length > 0) {
    const sampleData = result[0].data()
    console.log('[fetchOrganizationUserDocs] 📋 Sample profile data:', {
      id: result[0].id,
      name: sampleData?.name || sampleData?.fullName,
      email: sampleData?.email,
      role: sampleData?.role,
      organizationId: sampleData?.organizationId,
      companyCode: sampleData?.companyCode,
    })
  }
  
  return result
}

/**
 * Check whether a user has access to an organization based on assigned organizations.
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
 */
export const fetchOrganizationUsers = async (organizationKey: string): Promise<OrganizationUserProfile[]> => {
  console.log('[fetchOrganizationUsers] 🚀 Called with organizationKey:', organizationKey)
  
  if (!organizationKey) {
    console.log('[fetchOrganizationUsers] ⚠️ Empty organizationKey, returning []')
    return []
  }
  
  const docs = await fetchOrganizationUserDocs(organizationKey)
  
  console.log('[fetchOrganizationUsers] 📊 Processing', docs.length, 'profiles')
  
  const result = docs.map((docSnap) => {
    const data = docSnap.data() as {
      fullName?: string
      name?: string
      firstName?: string
      lastName?: string
      email?: string
      role?: string
      membershipStatus?: OrganizationUserProfile['membershipStatus']
      accountStatus?: OrganizationUserProfile['accountStatus']
      status?: string
      lastActiveAt?: Timestamp | string | Date | number
      lastActive?: Timestamp | string | Date | number
      updatedAt?: Timestamp | string | Date | number
      createdAt?: Timestamp | string | Date | number
      avatarUrl?: string
      photoURL?: string
      organizationId?: string
      organization_id?: string
      companyCode?: string
      company_code?: string
      progressPercent?: number
      progress_percent?: number
      currentWeek?: number
      current_week?: number
      weeklyEarned?: number
      weekly_earned?: number
      weeklyRequired?: number
      weekly_required?: number
      riskStatus?: string
      risk_status?: string
      riskReasons?: string[]
      risk_reasons?: string[]
      nudgeEnabled?: boolean
      nudge_enabled?: boolean
      adminNotes?: string
      admin_notes?: string
    }
    
    const organizationId = data.organizationId || data.organization_id || null
    const companyCode = data.companyCode || data.company_code || null
    
    const fullName =
      data.fullName ||
      data.name ||
      [data.firstName, data.lastName].filter((value) => !!value).join(' ').trim() ||
      data.email ||
      'Unknown user'
    
    const rawRole = data.role || 'learner'
    const role = rawRole.toLowerCase() as OrganizationUserProfile['role']
    
    const accountStatus = data.accountStatus || data.status || 'active'
    const normalizedStatus = accountStatus === 'Active' ? 'active' : accountStatus
    
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
  
  console.log('[fetchOrganizationUsers] ✅ Returning', result.length, 'users')
  
  return result
}