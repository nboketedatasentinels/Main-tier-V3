import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore'
import { OrgProfileLike } from './organizationTypes'

export type OrgScope =
  | { isValid: true; type: 'company'; companyId: string }
  | { isValid: true; type: 'company_code'; companyCode: string }
  | { isValid: false }

export const getOrgScope = (profile?: OrgProfileLike | null): OrgScope => {
  if (!profile) return { isValid: false }
  if (profile.companyId) {
    return { isValid: true, type: 'company', companyId: profile.companyId }
  }
  if (profile.organizationId) {
    return { isValid: true, type: 'company', companyId: profile.organizationId }
  }
  if (profile.companyCode) {
    return { isValid: true, type: 'company_code', companyCode: profile.companyCode }
  }
  if (profile.organizationCode) {
    return { isValid: true, type: 'company_code', companyCode: profile.organizationCode }
  }
  return { isValid: false }
}

export const isProfileInOrg = (profile: OrgProfileLike | null | undefined, orgScope: OrgScope): boolean => {
  if (!orgScope.isValid || !profile) return false
  if (orgScope.type === 'company') {
    const profileCompanyId = profile.companyId || profile.organizationId
    return profileCompanyId === orgScope.companyId
  }
  const profileCompanyCode = profile.companyCode || profile.organizationCode
  return profileCompanyCode === orgScope.companyCode
}

export const fetchOrgMembers = async (
  db: Firestore,
  orgScope: OrgScope,
  excludeId?: string,
): Promise<Record<string, unknown>[]> => {
  if (!orgScope.isValid) return []

  // CRITICAL FIX: Changed from 'users' to 'profiles' - user data is stored in profiles collection
  const peersRef = collection(db, 'profiles')

  // Query multiple field variants to catch all organization members
  const orgValue = orgScope.type === 'company' ? orgScope.companyId : orgScope.companyCode

  const queries = [
    query(peersRef, where('companyId', '==', orgValue)),
    query(peersRef, where('companyCode', '==', orgValue)),
    query(peersRef, where('organizationId', '==', orgValue)),
    query(peersRef, where('organizationCode', '==', orgValue)),
    query(peersRef, where('company_code', '==', orgValue)),
    query(peersRef, where('organization_code', '==', orgValue)),
  ]

  console.log('[OrgMembers] Running queries with scope', orgScope, 'value:', orgValue)

  const snapshots = await Promise.all(queries.map((q) => getDocs(q)))

  // Deduplicate by user ID
  const membersMap = new Map<string, Record<string, unknown>>()
  snapshots.forEach((snapshot) => {
    snapshot.docs
      .filter((docSnap) => !(excludeId && docSnap.id === excludeId))
      .forEach((docSnap) => {
        if (!membersMap.has(docSnap.id)) {
          membersMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
        }
      })
  })

  const members = Array.from(membersMap.values()).sort((a, b) =>
    String((a as Record<string, unknown>).fullName || '').localeCompare(
      String((b as Record<string, unknown>).fullName || ''),
    ),
  )

  console.log('[OrgMembers] Fetched profiles', members)
  console.log('[OrgMembers] Fetched profiles count', members.length)

  return members
}
