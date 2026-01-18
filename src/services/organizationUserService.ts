import { Timestamp, collection, doc, DocumentSnapshot, getDoc, getDocs, query, where } from 'firebase/firestore'
import { type OrganizationStatistics, type OrganizationUserProfile } from '@/types/admin'
import { db } from './firebase'
import { executeWithPartialFailureRecovery } from '@/utils/firestoreErrorHandling'

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

const fetchOrganizationUserDocs = async (organizationKey: string): Promise<DocumentSnapshot[]> => {
  const trimmed = organizationKey.trim()
  if (!trimmed) return []

  // Use executeWithPartialFailureRecovery to handle field variant query failures
  const { results, failures } = await executeWithPartialFailureRecovery([
    getDocs(query(usersCollection, where('companyCode', '==', trimmed))),
    getDocs(query(usersCollection, where('company_code', '==', trimmed))),
    getDocs(query(usersCollection, where('organization_code', '==', trimmed))),
    getDocs(query(usersCollection, where('companyId', '==', trimmed))),
    getDocs(query(usersCollection, where('organizationId', '==', trimmed))),
  ], 'organizationUserService.fetchOrganizationUserDocs')

  if (failures.length > 0) {
    console.warn(`[organizationUserService] ${failures.length} field query(ies) failed, merging available results`)
  }

  const usersMap = new Map<string, DocumentSnapshot>()
  const [
    companySnapshot,
    legacyCompanySnapshot,
    orgCodeSnapshot,
    companyIdSnapshot,
    organizationIdSnapshot,
  ] = results

  if (companySnapshot) companySnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  if (legacyCompanySnapshot) legacyCompanySnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  if (orgCodeSnapshot) orgCodeSnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  if (companyIdSnapshot) companyIdSnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  organizationIdSnapshot.docs.forEach((docSnap) => usersMap.set(docSnap.id, docSnap))
  return Array.from(usersMap.values())
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
      createdAt?: Timestamp | string | Date | number
      engagementScore?: number
      engagementRate?: number
    }
    if ((data.accountStatus || 'active') === 'active') {
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
  if (!organizationKey) return []
  const docs = await fetchOrganizationUserDocs(organizationKey)
  return docs.map((docSnap) => {
    const data = docSnap.data() as {
      fullName?: string
      name?: string
      firstName?: string
      lastName?: string
      email?: string
      role?: OrganizationUserProfile['role']
      membershipStatus?: OrganizationUserProfile['membershipStatus']
      accountStatus?: OrganizationUserProfile['accountStatus']
      lastActiveAt?: Timestamp | string | Date | number
      lastActive?: Timestamp | string | Date | number
      createdAt?: Timestamp | string | Date | number
      avatarUrl?: string
      photoURL?: string
    }
    const fullName =
      data.fullName ||
      data.name ||
      [data.firstName, data.lastName].filter((value) => !!value).join(' ').trim() ||
      data.email ||
      'Unknown user'
    return {
      id: docSnap.id,
      name: fullName,
      email: data.email,
      role: data.role || 'user',
      membershipStatus: data.membershipStatus || 'inactive',
      accountStatus: data.accountStatus || 'active',
      lastActive: parseUserDate(data.lastActiveAt || data.lastActive),
      createdAt: parseUserDate(data.createdAt),
      avatarUrl: data.avatarUrl ?? data.photoURL ?? null,
    }
  })
}
