import { UserProfile } from '@/types'
import { normalizeRole } from './role'

/**
 * Lightweight permission helpers for admin and organization-aware checks.
 * These helpers keep role casing consistent across the app and centralize
 * the logic for partner/super-admin fallbacks.
 */

export const isSuperAdmin = (profile?: UserProfile | null) => 
  normalizeRole(profile?.role) === 'super_admin'

export const isPartnerAdmin = (profile?: UserProfile | null) => {
  const role = normalizeRole(profile?.role)
  return role === 'partner'
}

export const isAdminLike = (profile?: UserProfile | null) => 
  isSuperAdmin(profile) || isPartnerAdmin(profile)

/**
 * Extracts all organization identifiers from a partner's assignedOrganizations array.
 * Handles multiple data formats:
 * - String IDs: "abc123"
 * - Objects with organizationId: { organizationId: "abc123", status: "active" }
 * - Objects with companyCode: { companyCode: "acme", ... }
 * 
 * Returns a Set of all identifiers (both IDs and codes) for flexible matching.
 */
const extractAssignedOrgIdentifiers = (profile: UserProfile | null | undefined): Set<string> => {
  const identifiers = new Set<string>()

  if (!profile?.assignedOrganizations) return identifiers

  // Cast to unknown first for runtime safety checks (the type says string[] but runtime data may vary)
  const assignments = profile.assignedOrganizations as unknown

  // Handle if it's not an array (safety check for runtime data inconsistencies)
  if (!Array.isArray(assignments)) {
    if (typeof assignments === 'string') {
      identifiers.add(assignments.toLowerCase())
    }
    return identifiers
  }
  
  for (const assignment of assignments) {
    if (!assignment) continue
    
    // Handle string IDs directly
    if (typeof assignment === 'string') {
      identifiers.add(assignment.toLowerCase())
      continue
    }
    
    // Handle object assignments
    if (typeof assignment === 'object') {
      // Extract organizationId if present
      const orgId = (assignment as { organizationId?: string }).organizationId
      if (orgId && typeof orgId === 'string') {
        identifiers.add(orgId.toLowerCase())
      }
      
      // Extract companyCode if present (for bidirectional matching)
      const companyCode = (assignment as { companyCode?: string }).companyCode
      if (companyCode && typeof companyCode === 'string') {
        identifiers.add(companyCode.toLowerCase())
      }
      
      // Also check for 'code' field
      const code = (assignment as { code?: string }).code
      if (code && typeof code === 'string') {
        identifiers.add(code.toLowerCase())
      }
      
      // Check for 'id' field
      const id = (assignment as { id?: string }).id
      if (id && typeof id === 'string') {
        identifiers.add(id.toLowerCase())
      }
    }
  }
  
  return identifiers
}

/**
 * Checks if a partner is assigned to a specific organization.
 * 
 * This function handles the organization identifier mismatch where:
 * - Partners may be assigned by Firestore document ID (e.g., "s1nzr7yaee16x4fdhztd")
 * - Organizations may be referenced by human-readable code (e.g., "acme")
 * - The assignedOrganizations array may contain strings OR objects
 * 
 * @param profile - The user's profile
 * @param organizationId - The organization ID or code to check access for
 * @returns true if the partner has access to this organization
 */
export const isAssignedPartner = (
  profile: UserProfile | null | undefined, 
  organizationId?: string
): boolean => {
  if (!profile || !organizationId) return false
  
  // Super admins have access to all organizations
  if (isSuperAdmin(profile)) return true
  
  // Must be a partner to have assignments
  if (!isPartnerAdmin(profile)) return false
  
  // Extract all identifiers from the partner's assignments
  const assignedIdentifiers = extractAssignedOrgIdentifiers(profile)
  
  // Check if the requested org matches any assigned identifier
  const normalizedOrgId = organizationId.toLowerCase()
  
  if (assignedIdentifiers.has(normalizedOrgId)) {
    return true
  }
  
  // Also check the profile's direct organization fields for edge cases
  const profileOrgId = profile.organizationId?.toLowerCase()
  const profileCompanyCode = profile.companyCode?.toLowerCase()
  
  if (profileOrgId && assignedIdentifiers.has(profileOrgId)) {
    // Partner's own org is in their assignments
    if (normalizedOrgId === profileOrgId || normalizedOrgId === profileCompanyCode) {
      return true
    }
  }
  
  return false
}

/**
 * Async version of isAssignedPartner that can perform additional lookups
 * to resolve organization ID <-> code mismatches.
 * 
 * This is useful when you need to check access and the organization's
 * code might not be in the partner's assignment list (only the ID, or vice versa).
 */
export const isAssignedPartnerAsync = async (
  profile: UserProfile | null | undefined,
  organizationId: string | undefined,
  lookupOrgById?: (id: string) => Promise<{ id: string; code?: string } | null>
): Promise<boolean> => {
  // First try synchronous check
  if (isAssignedPartner(profile, organizationId)) {
    return true
  }
  
  // If we have a lookup function and the sync check failed,
  // try to resolve the org and check against its code
  if (lookupOrgById && organizationId && profile) {
    try {
      const org = await lookupOrgById(organizationId)
      if (org?.code) {
        // Check if the partner is assigned to this org by its code
        const assignedIdentifiers = extractAssignedOrgIdentifiers(profile)
        if (assignedIdentifiers.has(org.code.toLowerCase())) {
          return true
        }
      }
    } catch (error) {
      console.warn('[permissions] Failed to lookup organization:', error)
    }
  }
  
  return false
}

export const canManageOrganization = (
  profile: UserProfile | null | undefined, 
  organizationId?: string
): boolean => {
  if (!profile) return false
  if (isSuperAdmin(profile)) return true
  return isAssignedPartner(profile, organizationId)
}

/**
 * Async version that performs organization lookup for ID/code resolution
 */
export const canManageOrganizationAsync = async (
  profile: UserProfile | null | undefined,
  organizationId: string | undefined,
  lookupOrgById?: (id: string) => Promise<{ id: string; code?: string } | null>
): Promise<boolean> => {
  if (!profile) return false
  if (isSuperAdmin(profile)) return true
  return isAssignedPartnerAsync(profile, organizationId, lookupOrgById)
}

export const guardByRole = (
  profile: UserProfile | null | undefined, 
  allowedRoles: string[]
): boolean => {
  if (!profile) return false
  const normalized = normalizeRole(profile.role)
  return allowedRoles.map(normalizeRole).includes(normalized)
}

export const getRoleLabel = (profile: UserProfile | null | undefined): string => {
  if (!profile) return 'guest'
  const normalized = normalizeRole(profile.role)
  switch (normalized) {
    case 'super_admin':
      return 'Super Admin'
    case 'partner':
      return 'Partner'
    case 'mentor':
      return 'Mentor'
    case 'ambassador':
      return 'Ambassador'
    case 'user':
    case 'free_user':
    case 'paid_member':
      return 'Learner'
    default:
      return 'Member'
  }
}

/**
 * Gets all organization IDs/codes that a partner has access to.
 * Useful for filtering queries to only show assigned organizations.
 */
export const getAssignedOrganizationIds = (
  profile: UserProfile | null | undefined
): string[] => {
  if (!profile) return []
  if (isSuperAdmin(profile)) return [] // Super admin sees all, no filter needed
  
  const identifiers = extractAssignedOrgIdentifiers(profile)
  return Array.from(identifiers)
}

/**
 * Checks if a user belongs to an organization that the partner manages.
 * Handles the identifier mismatch by checking multiple fields.
 */
export const canPartnerViewUser = (
  partnerProfile: UserProfile | null | undefined,
  userProfile: { 
    companyCode?: string | null
    organizationId?: string | null 
    companyId?: string | null
  } | null | undefined
): boolean => {
  if (!partnerProfile || !userProfile) return false
  if (isSuperAdmin(partnerProfile)) return true
  if (!isPartnerAdmin(partnerProfile)) return false
  
  const assignedIdentifiers = extractAssignedOrgIdentifiers(partnerProfile)
  if (assignedIdentifiers.size === 0) return false
  
  // Check all possible user organization identifiers
  const userIdentifiers = [
    userProfile.companyCode,
    userProfile.organizationId,
    userProfile.companyId,
  ].filter((id): id is string => !!id)
  
  for (const identifier of userIdentifiers) {
    if (assignedIdentifiers.has(identifier.toLowerCase())) {
      return true
    }
  }
  
  return false
}