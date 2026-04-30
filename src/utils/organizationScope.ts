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
  | { isValid: false; error: string }

export const getOrgScope = (profile?: OrgProfileLike | null): OrgScope => {
  if (!profile) {
    return { isValid: false, error: 'No profile provided' }
  }
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
  return {
    isValid: false,
    error: 'No organization assigned to your profile. Please contact your administrator.',
  }
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

// Reconciles totalPoints/level between the canonical `profiles/{uid}` doc
// (what the leaderboard reads) and the `users/{uid}` mirror (what AuthContext
// reads when the user logs in). They are dual-written by pointsService, but
// any drift (legacy data, partial backfills) would cause the leaderboard
// number to disagree with the user's own profile. Taking max() guarantees
// the leaderboard never shows a value lower than what the user sees.
const reconcilePointsAndLevel = (
  profileMember: Record<string, unknown>,
  userMirror: Record<string, unknown> | undefined | null,
): Record<string, unknown> => {
  if (!userMirror) return profileMember
  const profilePoints = typeof profileMember.totalPoints === 'number' ? profileMember.totalPoints : 0
  const userPoints = typeof userMirror.totalPoints === 'number' ? userMirror.totalPoints : 0
  const profileLevel = typeof profileMember.level === 'number' ? profileMember.level : 0
  const userLevel = typeof userMirror.level === 'number' ? userMirror.level : 0
  const totalPoints = Math.max(profilePoints, userPoints)
  const level = Math.max(profileLevel, userLevel)
  if (totalPoints === profilePoints && level === profileLevel) return profileMember
  return { ...profileMember, totalPoints, level }
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

  const isEligibleMember = (member: Record<string, unknown>) => {
    if (member.mergedInto) return false

    // Only hide users explicitly suspended by a partner/admin. Empty/undefined status passes.
    const status = normalizeAccountStatus(member.accountStatus ?? member.status)
    if (status && status !== 'active') return false

    const email = typeof member.email === 'string' ? member.email : ''
    if (!normalizeEmail(email)) return false

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

  // Run profile + user-mirror queries in parallel. Same scope on both
  // collections — the users/{uid} mirror is what AuthContext reads to display
  // each user's profile points, so reconciling against it guarantees the
  // leaderboard matches what every user sees on their own profile.
  const usersRef = collection(db, 'users')
  const userQueries = buildScopeQueries(usersRef, orgScope)
  const [snapshots, userSnapshots] = await Promise.all([
    Promise.all(queries.map((q) => getDocs(q))),
    Promise.all(userQueries.map((q) => getDocs(q))),
  ])

  const userMirrorMap = new Map<string, Record<string, unknown>>()
  userSnapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      if (!userMirrorMap.has(docSnap.id)) {
        userMirrorMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
      }
    })
  })

  // Deduplicate by user ID
  const membersMap = new Map<string, Record<string, unknown>>()
  snapshots.forEach((snapshot) => {
    snapshot.docs
      .filter((docSnap) => !(excludeId && docSnap.id === excludeId))
      .forEach((docSnap) => {
        if (!membersMap.has(docSnap.id)) {
          const profileData = { id: docSnap.id, ...docSnap.data() }
          membersMap.set(docSnap.id, reconcilePointsAndLevel(profileData, userMirrorMap.get(docSnap.id)))
        }
      })
  })

  // Surface user-mirror records that have no matching profiles/{uid} doc — this
  // happens for legacy users created before the dual-write existed. Without
  // this, those users would be invisible on the leaderboard despite having
  // valid points in users/.
  userMirrorMap.forEach((mirror, uid) => {
    if (excludeId && uid === excludeId) return
    if (membersMap.has(uid)) return
    membersMap.set(uid, mirror)
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
  const usersRef = collection(db, 'users')

  const queries = buildScopeQueries(peersRef, orgScope)
  const userQueries = buildScopeQueries(usersRef, orgScope)
  if (!queries.length) {
    console.warn('[OrgMembers] No queries generated for scope', orgScope)
    onMembers([])
    return () => {}
  }

  const membersMap = new Map<string, Record<string, unknown>>()
  // Mirror map of `users/{uid}` data, kept live alongside profiles/. Used to
  // reconcile totalPoints/level so the leaderboard matches what every user
  // sees on their own profile when logged in.
  const userMirrorMap = new Map<string, Record<string, unknown>>()
  const queryDocIds = new Map<number, Set<string>>()
  const userQueryDocIds = new Map<number, Set<string>>()
  let pendingInitial = queries.length
  let hasReceivedInitialData = false
  const unsubscribers: (() => void)[] = []

  const normalizeAccountStatus = (status: unknown) => (typeof status === 'string' ? status.trim().toLowerCase() : '')

  const isEligibleMember = (member: Record<string, unknown>) => {
    if (member.mergedInto) return false

    // Only hide users explicitly suspended by a partner/admin. Empty/undefined status passes.
    const status = normalizeAccountStatus(member.accountStatus ?? member.status)
    if (status && status !== 'active') return false

    const email = typeof member.email === 'string' ? member.email : ''
    if (!normalizeEmail(email)) return false

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
    // Merge profile members + user-mirror records, reconciling totalPoints/level
    // so the value matches what each user sees on their own logged-in profile.
    const merged = new Map<string, Record<string, unknown>>()
    membersMap.forEach((member, uid) => {
      if (excludeId && uid === excludeId) return
      merged.set(uid, reconcilePointsAndLevel(member, userMirrorMap.get(uid)))
    })
    // Surface user-mirror-only records (legacy users with no profiles/{uid} doc)
    // so they don't disappear from the leaderboard.
    userMirrorMap.forEach((mirror, uid) => {
      if (excludeId && uid === excludeId) return
      if (merged.has(uid)) return
      merged.set(uid, mirror)
    })
    const members = Array.from(merged.values())
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

  // Parallel listeners on `users/` so totalPoints/level updates flow into the
  // leaderboard the moment they're written, regardless of which collection the
  // write hit. Profile listeners drive the `pendingInitial` gate; user-mirror
  // listeners only re-emit if data has already been delivered, to avoid
  // emitting half-loaded data.
  userQueries.forEach((q, queryIndex) => {
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const ids = userQueryDocIds.get(queryIndex) || new Set<string>()
        userQueryDocIds.set(queryIndex, ids)

        let touched = false
        snapshot.docChanges().forEach((change) => {
          const docSnap = change.doc
          touched = true
          if (change.type === 'removed') {
            ids.delete(docSnap.id)
            let stillReferenced = false
            for (const otherIds of userQueryDocIds.values()) {
              if (otherIds.has(docSnap.id)) {
                stillReferenced = true
                break
              }
            }
            if (!stillReferenced) {
              userMirrorMap.delete(docSnap.id)
            }
          } else {
            ids.add(docSnap.id)
            userMirrorMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
          }
        })

        if (touched && hasReceivedInitialData) {
          emitMembers()
        }
      },
      (error) => {
        console.warn(`[OrgMembers] User-mirror query ${queryIndex} error`, error)
        // Don't fail the whole listener — profiles/ data alone still works.
      },
    )
    unsubscribers.push(unsub)
  })

  console.log('[OrgMembers] Real-time listeners started with scope', orgScope, 'queryCount:', queries.length, 'userQueryCount:', userQueries.length)

  return () => {
    unsubscribers.forEach((unsub) => unsub())
    console.log('[OrgMembers] Real-time listeners cleaned up')
  }
}
