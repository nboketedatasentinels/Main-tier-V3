import {
  collection,
  CollectionReference,
  getDocs,
  onSnapshot,
  query,
  Query,
  where,
  type Firestore,
} from 'firebase/firestore'
import { OrgProfileLike } from './organizationTypes'
import { normalizeEmail } from '@/utils/email'

export type OrgScope =
  | { isValid: true; type: 'company'; companyId: string }
  | { isValid: true; type: 'company_code'; companyCode: string }
  | { isValid: true; type: 'village'; villageId: string }
  | { isValid: true; type: 'cohort'; cohortIdentifier: string }
  | { isValid: false }

export const getOrgScope = (profile?: OrgProfileLike | null): OrgScope => {
  if (!profile) return { isValid: false }
  if (profile.cohortIdentifier) {
    return { isValid: true, type: 'cohort', cohortIdentifier: profile.cohortIdentifier }
  }
  if (profile.corporateVillageId) {
    return { isValid: true, type: 'village', villageId: profile.corporateVillageId }
  }
  if (profile.villageId) {
    return { isValid: true, type: 'village', villageId: profile.villageId }
  }
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

export const buildScopeQueries = (peersRef: CollectionReference, scope: OrgScope): Query[] => {
  if (!scope.isValid) return []

  const build = (fields: string[], value: string): Query[] => {
    const uniqueFields = Array.from(new Set(fields))
    return uniqueFields.map((field) => query(peersRef, where(field, '==', value)))
  }

  if (scope.type === 'company') {
    return build(
      [
        'companyId',
        'companyCode',
        'organizationId',
        'organizationCode',
        'company_code',
        'organization_code',
      ],
      scope.companyId,
    )
  }

  if (scope.type === 'company_code') {
    return build(
      [
        'companyCode',
        'organizationCode',
        'company_code',
        'organization_code',
        'companyId',
        'organizationId',
      ],
      scope.companyCode,
    )
  }

  if (scope.type === 'village') {
    return build(
      ['corporateVillageId', 'villageId', 'corporate_village_id', 'village_id'],
      scope.villageId,
    )
  }

  if (scope.type === 'cohort') {
    return build(['cohortIdentifier', 'cohort_identifier'], scope.cohortIdentifier)
  }

  return []
}

export const isProfileInOrg = (profile: OrgProfileLike | null | undefined, orgScope: OrgScope): boolean => {
  if (!orgScope.isValid || !profile) return false
  if (orgScope.type === 'company') {
    const profileCompanyId = profile.companyId || profile.organizationId
    return profileCompanyId === orgScope.companyId
  }
  if (orgScope.type === 'company_code') {
    const profileCompanyCode = profile.companyCode || profile.organizationCode
    return profileCompanyCode === orgScope.companyCode
  }
  if (orgScope.type === 'village') {
    const profileVillageId = profile.corporateVillageId || profile.villageId
    return profileVillageId === orgScope.villageId
  }
  if (orgScope.type === 'cohort') {
    return profile.cohortIdentifier === orgScope.cohortIdentifier
  }
  return false
}

export const fetchOrgMembers = async (
  db: Firestore,
  orgScope: OrgScope,
  excludeId?: string,
): Promise<Record<string, unknown>[]> => {
  if (!orgScope.isValid) return []

  const normalizeAccountStatus = (status: unknown) => (typeof status === 'string' ? status.trim().toLowerCase() : '')

  const hasSignedInMarkers = (member: Record<string, unknown>) => {
    if (typeof member.totalPoints === 'number') return true
    if (typeof member.level === 'number') return true
    if (typeof member.journeyType === 'string' && member.journeyType.trim().length > 0) return true
    if (typeof member.onboardingComplete === 'boolean') return true
    return false
  }

  const isEligibleMember = (member: Record<string, unknown>) => {
    if (member.mergedInto) return false

    const status = normalizeAccountStatus(member.accountStatus ?? member.status)
    if (status && status !== 'active') return false

    const email = typeof member.email === 'string' ? member.email : ''
    if (!normalizeEmail(email)) return false

    // Exclude stub/pending invitation profiles that haven't completed a real sign-in bootstrap yet.
    if (!hasSignedInMarkers(member)) return false

    return true
  }

  const scoreMemberForCanonical = (member: Record<string, unknown>, index: number) => {
    let score = 0

    const status = normalizeAccountStatus(member.accountStatus ?? member.status)
    if (status === 'active') score += 50

    if (typeof member.totalPoints === 'number') score += 20
    if (typeof member.level === 'number') score += 10
    if (typeof member.journeyType === 'string' && member.journeyType.trim().length > 0) score += 10

    if ((member.membershipStatus as string | undefined)?.toString() === 'paid') score += 10

    const role = typeof member.role === 'string' ? member.role.trim().toLowerCase() : ''
    if (role && role !== 'free_user') score += 5

    if (member.companyId || member.organizationId) score += 4
    if (member.companyCode || member.organizationCode) score += 2

    if (Array.isArray(member.assignedOrganizations) && member.assignedOrganizations.length > 0) score += 2

    // Stable tie-breaker: prefer earlier (first) document in traversal.
    return { score, index }
  }

  const dedupeByEmail = (members: Record<string, unknown>[]) => {
    const bestByEmail = new Map<string, { member: Record<string, unknown>; score: number; index: number }>()

    members.forEach((member, index) => {
      const emailKey = normalizeEmail(typeof member.email === 'string' ? member.email : '')
      if (!emailKey) return
      const { score } = scoreMemberForCanonical(member, index)
      const existing = bestByEmail.get(emailKey)
      if (!existing || score > existing.score || (score === existing.score && index < existing.index)) {
        bestByEmail.set(emailKey, { member, score, index })
      }
    })

    return Array.from(bestByEmail.values()).map((entry) => entry.member)
  }

  // CRITICAL FIX: Changed from 'users' to 'profiles' - user data is stored in profiles collection
  const peersRef = collection(db, 'profiles')

  const queries = buildScopeQueries(peersRef, orgScope)
  if (!queries.length) {
    console.warn('[OrgMembers] No queries generated for scope', orgScope)
    return []
  }

  console.log('[OrgMembers] Running queries with scope', orgScope, 'queryCount:', queries.length)

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

  const eligible = members.filter(isEligibleMember)
  const deduped = dedupeByEmail(eligible).sort((a, b) =>
    String((a as Record<string, unknown>).fullName || '').localeCompare(
      String((b as Record<string, unknown>).fullName || ''),
    ),
  )

  console.log('[OrgMembers] Fetched profiles count', members.length)
  console.log('[OrgMembers] Eligible profiles count', deduped.length)

  return deduped
}

export type OrgMembersCallback = (members: Record<string, unknown>[]) => void
export type OrgMembersErrorCallback = (error: unknown) => void

export const listenToOrgMembers = (
  db: Firestore,
  orgScope: OrgScope,
  onMembers: OrgMembersCallback,
  onError?: OrgMembersErrorCallback,
  excludeId?: string,
): (() => void) => {
  if (!orgScope.isValid) {
    onMembers([])
    return () => {}
  }

  const peersRef = collection(db, 'profiles')

  const queries = buildScopeQueries(peersRef, orgScope)
  if (!queries.length) {
    console.warn('[OrgMembers] No queries generated for scope', orgScope)
    onMembers([])
    return () => {}
  }

  const membersMap = new Map<string, Record<string, unknown>>()
  const queryDocIds = new Map<number, Set<string>>()
  let pendingInitial = queries.length
  let hasReceivedInitialData = false
  const unsubscribers: (() => void)[] = []

  const normalizeAccountStatus = (status: unknown) => (typeof status === 'string' ? status.trim().toLowerCase() : '')

  const hasSignedInMarkers = (member: Record<string, unknown>) => {
    if (typeof member.totalPoints === 'number') return true
    if (typeof member.level === 'number') return true
    if (typeof member.journeyType === 'string' && member.journeyType.trim().length > 0) return true
    if (typeof member.onboardingComplete === 'boolean') return true
    return false
  }

  const isEligibleMember = (member: Record<string, unknown>) => {
    if (member.mergedInto) return false

    const status = normalizeAccountStatus(member.accountStatus ?? member.status)
    if (status && status !== 'active') return false

    const email = typeof member.email === 'string' ? member.email : ''
    if (!normalizeEmail(email)) return false

    if (!hasSignedInMarkers(member)) return false

    return true
  }

  const scoreMemberForCanonical = (member: Record<string, unknown>, index: number) => {
    let score = 0

    const status = normalizeAccountStatus(member.accountStatus ?? member.status)
    if (status === 'active') score += 50

    if (typeof member.totalPoints === 'number') score += 20
    if (typeof member.level === 'number') score += 10
    if (typeof member.journeyType === 'string' && member.journeyType.trim().length > 0) score += 10

    if ((member.membershipStatus as string | undefined)?.toString() === 'paid') score += 10

    const role = typeof member.role === 'string' ? member.role.trim().toLowerCase() : ''
    if (role && role !== 'free_user') score += 5

    if (member.companyId || member.organizationId) score += 4
    if (member.companyCode || member.organizationCode) score += 2

    if (Array.isArray(member.assignedOrganizations) && member.assignedOrganizations.length > 0) score += 2

    return { score, index }
  }

  const dedupeByEmail = (members: Record<string, unknown>[]) => {
    const bestByEmail = new Map<string, { member: Record<string, unknown>; score: number; index: number }>()

    members.forEach((member, index) => {
      const emailKey = normalizeEmail(typeof member.email === 'string' ? member.email : '')
      if (!emailKey) return
      const { score } = scoreMemberForCanonical(member, index)
      const existing = bestByEmail.get(emailKey)
      if (!existing || score > existing.score || (score === existing.score && index < existing.index)) {
        bestByEmail.set(emailKey, { member, score, index })
      }
    })

    return Array.from(bestByEmail.values()).map((entry) => entry.member)
  }

  const emitMembers = () => {
    const members = Array.from(membersMap.values()).filter((m) => !(excludeId && m.id === excludeId))
    const eligible = members.filter(isEligibleMember)
    const deduped = dedupeByEmail(eligible).sort((a, b) =>
      String((a as Record<string, unknown>).fullName || '').localeCompare(
        String((b as Record<string, unknown>).fullName || ''),
      ),
    )
    onMembers(deduped)
  }

  queries.forEach((q, queryIndex) => {
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const ids = queryDocIds.get(queryIndex) || new Set<string>()
        queryDocIds.set(queryIndex, ids)

        snapshot.docChanges().forEach((change) => {
          const docSnap = change.doc
          if (change.type === 'removed') {
            ids.delete(docSnap.id)
            let stillReferenced = false
            for (const otherIds of queryDocIds.values()) {
              if (otherIds.has(docSnap.id)) {
                stillReferenced = true
                break
              }
            }
            if (!stillReferenced) {
              membersMap.delete(docSnap.id)
            }
          } else {
            ids.add(docSnap.id)
            membersMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
          }
        })

        if (!hasReceivedInitialData) {
          pendingInitial--
          if (pendingInitial <= 0) {
            hasReceivedInitialData = true
            emitMembers()
          }
        } else {
          emitMembers()
        }
      },
      (error) => {
        console.error(`[OrgMembers] Real-time query ${queryIndex} error`, error)
        onError?.(error)
      },
    )
    unsubscribers.push(unsub)
  })

  console.log('[OrgMembers] Real-time listeners started with scope', orgScope, 'queryCount:', queries.length)

  return () => {
    unsubscribers.forEach((unsub) => unsub())
    console.log('[OrgMembers] Real-time listeners cleaned up')
  }
}
