import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { fetchOrganizationsByIds } from '@/services/organizationService'
import type {
  PartnerAdminDataSnapshot,
  PartnerAdminPointsOverview,
  PartnerAdminSnapshot,
  PartnerAssignment,
} from '@/types/admin'

// ============================================================================
// CRITICAL FIX: Query users collection by companyCode (matching Company Admin)
// 
// ROOT CAUSE: Partners are assigned organization document IDs (e.g., "3fA9xKlmPq")
// but users have companyCode values (e.g., "T4L-ACME"). The old code was trying
// to match org IDs against user fields, which never worked.
//
// THE FIX: 
// 1. Resolve org IDs → org documents → org.code values
// 2. Query users WHERE companyCode IN [org codes]
// 3. This matches exactly how Company Admin queries users
// ============================================================================

const usersCollection = collection(db, 'users')

const normalizeAssignments = (assignments: PartnerAssignment[] = []): PartnerAssignment[] =>
  assignments
    .map((assignment) => {
      const organizationId = assignment.organizationId?.trim()
      const companyCode = assignment.companyCode?.trim()
      if (!organizationId && !companyCode) return null
      return {
        organizationId: organizationId || undefined,
        companyCode: companyCode || undefined,
        status: assignment.status ?? 'active',
      }
    })
    .filter((assignment): assignment is PartnerAssignment => !!assignment)

const buildEmptyPointsOverview = (): PartnerAdminPointsOverview => ({
  totalPoints: 0,
  weeklyPoints: 0,
  pendingPoints: 0,
  approvedPoints: 0,
  rejectedPoints: 0,
})

/**
 * Fetch users by company codes - EXACTLY like Company Admin does.
 * This is the critical fix: query by companyCode, not organizationId.
 */
const fetchUsersByCompanyCodes = async (
  companyCodes: string[]
): Promise<PartnerAdminDataSnapshot['users']> => {
  if (!companyCodes.length) {
    console.log('[fetchUsersByCompanyCodes] No company codes provided, returning empty array')
    return []
  }

  console.log('[fetchUsersByCompanyCodes] Fetching users for company codes:', companyCodes)

  const usersMap = new Map<string, PartnerAdminDataSnapshot['users'][number]>()

  // Query users for each company code (same as Company Admin)
  for (const code of companyCodes) {
    if (!code) continue
    
    try {
      const snapshot = await getDocs(
        query(usersCollection, where('companyCode', '==', code))
      )

      console.log(`[fetchUsersByCompanyCodes] Found ${snapshot.docs.length} users for companyCode="${code}"`)

      snapshot.docs.forEach((docSnap) => {
        if (usersMap.has(docSnap.id)) return // Skip duplicates
        
        const data = docSnap.data() as {
          fullName?: string
          name?: string
          firstName?: string
          lastName?: string
          email?: string
          role?: string
          status?: string
          accountStatus?: string
          membershipStatus?: string
          lastActiveAt?: unknown
          lastActive?: unknown
          updatedAt?: unknown
          createdAt?: unknown
          avatarUrl?: string
          photoURL?: string
          organizationId?: string
          companyCode?: string
          progressPercent?: number
          currentWeek?: number
          weeklyEarned?: number
          weeklyRequired?: number
          riskStatus?: string
          riskReasons?: string[]
          nudgeEnabled?: boolean
          adminNotes?: string
        }

        // Build name with fallbacks
        const fullName =
          data.fullName ||
          data.name ||
          [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
          data.email ||
          'Unknown user'

        // Normalize role to lowercase
        const role = (data.role || 'learner').toLowerCase()

        // Normalize status
        const accountStatus = data.accountStatus || data.status || 'active'
        const normalizedStatus = accountStatus === 'Active' ? 'active' : accountStatus

        usersMap.set(docSnap.id, {
          id: docSnap.id,
          name: fullName,
          email: data.email ?? '',
          role: role as 'learner' | 'mentor' | 'ambassador' | 'admin' | 'user',
          membershipStatus: (data.membershipStatus || 'inactive') as 'active' | 'inactive' | 'paid' | 'trial',
          accountStatus: normalizedStatus as 'active' | 'inactive' | 'suspended',
          status: normalizedStatus === 'active' ? 'Active' : 'Inactive',
          lastActive: data.lastActiveAt || data.lastActive || data.updatedAt || null,
          createdAt: data.createdAt || null,
          avatarUrl: data.avatarUrl ?? data.photoURL ?? null,
          organizationId: data.organizationId?.trim() || null,
          companyCode: data.companyCode?.trim() || code, // Use the code we queried with as fallback
          
          // Progress fields with defaults
          progressPercent: data.progressPercent ?? 0,
          currentWeek: data.currentWeek ?? 0,
          weeklyEarned: data.weeklyEarned ?? 0,
          weeklyRequired: data.weeklyRequired ?? 0,
          
          // Risk fields with defaults
          riskStatus: (data.riskStatus ?? 'engaged') as 'engaged' | 'watch' | 'concern' | 'critical' | 'at_risk',
          riskReasons: data.riskReasons ?? [],
          
          // Nudge fields with defaults
          nudgeEnabled: data.nudgeEnabled ?? true,
          adminNotes: data.adminNotes ?? '',
        })
      })
    } catch (error) {
      console.error(`[fetchUsersByCompanyCodes] Error fetching users for code "${code}":`, error)
    }
  }

  const users = Array.from(usersMap.values())
  console.log('[fetchUsersByCompanyCodes] Total unique users found:', users.length)
  
  return users
}

export const fetchPartnerAdminSnapshot = async (
  partnerId: string,
  data: Partial<PartnerAdminSnapshot>,
): Promise<PartnerAdminDataSnapshot> => {
  console.log('[fetchPartnerAdminSnapshot] Starting for partner:', partnerId)
  
  const assignedOrganizations = normalizeAssignments(data.assignedOrganizations || [])
  console.log('[fetchPartnerAdminSnapshot] Assigned organizations:', assignedOrganizations)

  // Extract organization IDs from assignments
  const assignedOrganizationIds = Array.from(
    new Set(
      assignedOrganizations
        .map((assignment) => assignment.organizationId?.trim())
        .filter((orgId): orgId is string => !!orgId),
    ),
  )
  console.log('[fetchPartnerAdminSnapshot] Organization IDs to fetch:', assignedOrganizationIds)

  // Fetch the actual organization documents to get their codes
  const organizations = assignedOrganizationIds.length
    ? await fetchOrganizationsByIds(assignedOrganizationIds)
    : []
  console.log('[fetchPartnerAdminSnapshot] Fetched organizations:', organizations.map(o => ({ id: o.id, code: o.code, name: o.name })))

  // =========================================================================
  // CRITICAL FIX: Extract company codes from organizations
  // These codes are what users have in their companyCode field
  // =========================================================================
  const companyCodes = Array.from(
    new Set(
      [
        // From organization documents (primary source)
        ...organizations.map((org) => org.code?.trim()).filter(Boolean),
        // Also include any companyCode values directly from assignments (fallback)
        ...assignedOrganizations.map((a) => a.companyCode?.trim()).filter(Boolean),
      ].filter((code): code is string => !!code)
    )
  )
  console.log('[fetchPartnerAdminSnapshot] Company codes to query users:', companyCodes)

  // =========================================================================
  // CRITICAL FIX: Fetch users by companyCode (same as Company Admin)
  // =========================================================================
  const users = await fetchUsersByCompanyCodes(companyCodes)
  console.log('[fetchPartnerAdminSnapshot] Users fetched:', users.length)

  return {
    partnerId,
    assignedOrganizations,
    organizations,
    users,
    usersFetchedAt: new Date(),
    pointsOverview: buildEmptyPointsOverview(),
    createdAt: data.createdAt as PartnerAdminDataSnapshot['createdAt'],
    updatedAt: data.updatedAt as PartnerAdminDataSnapshot['updatedAt'],
  }
}