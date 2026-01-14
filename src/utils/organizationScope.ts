import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore'

export type OrgScope = {
  companyId?: string
  companyCode?: string
  isValid: boolean
}

type OrgProfileLike = {
  companyId?: string | null
  organizationId?: string | null
  companyCode?: string | null
  organizationCode?: string | null
}

export const getOrgScope = (profile?: OrgProfileLike | null): OrgScope => {
  const companyId = profile?.companyId || profile?.organizationId || ''
  const companyCode = profile?.companyCode || profile?.organizationCode || ''
  return {
    companyId: companyId || undefined,
    companyCode: companyCode || undefined,
    isValid: Boolean(companyId || companyCode),
  }
}

export const isProfileInOrg = (profile: OrgProfileLike | null | undefined, orgScope: OrgScope): boolean => {
  if (!orgScope.isValid || !profile) return false
  const profileCompanyId = profile.companyId || profile.organizationId
  const profileCompanyCode = profile.companyCode || profile.organizationCode
  if (orgScope.companyId && profileCompanyId === orgScope.companyId) return true
  if (orgScope.companyCode && profileCompanyCode === orgScope.companyCode) return true
  return false
}

export const fetchOrgMembers = async (
  db: Firestore,
  orgScope: OrgScope,
  excludeId?: string,
): Promise<Record<string, unknown>[]> => {
  if (!orgScope.isValid) return []
  const peersRef = collection(db, 'profiles')
  const queries = [
    orgScope.companyId ? query(peersRef, where('companyId', '==', orgScope.companyId)) : null,
    orgScope.companyCode ? query(peersRef, where('companyCode', '==', orgScope.companyCode)) : null,
  ].filter(Boolean) as ReturnType<typeof query>[]

  const snapshots = await Promise.all(queries.map((peerQuery) => getDocs(peerQuery)))
  const merged = new Map<string, Record<string, unknown>>()

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      if (excludeId && docSnap.id === excludeId) return
      merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
    })
  })

  return Array.from(merged.values()).sort((a, b) =>
    String(a.fullName || '').localeCompare(String(b.fullName || '')),
  )
}
