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
  const peersRef = collection(db, 'users')
  const peerQuery =
    orgScope.type === 'company'
      ? query(peersRef, where('companyId', '==', orgScope.companyId))
      : query(peersRef, where('companyCode', '==', orgScope.companyCode))

  console.log('[OrgMembers] Running query with scope', orgScope)
  const snapshot = await getDocs(peerQuery)
  const members = snapshot.docs
    .filter((docSnap) => !(excludeId && docSnap.id === excludeId))
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) =>
      String((a as any).fullName || '').localeCompare(String((b as any).fullName || '')),
    )

  console.log('[OrgMembers] Fetched profiles', members)
  console.log('[OrgMembers] Fetched profiles count', members.length)

  return members
}
