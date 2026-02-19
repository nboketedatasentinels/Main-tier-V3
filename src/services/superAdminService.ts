import {
  Timestamp,
  arrayRemove,
  addDoc,
  collection,
  deleteDoc,
  doc,
  FirestoreError,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { fetchOrganizationsByIds } from '@/services/organizationService'
import { upsertPartnerAssignments } from '@/services/partnerAdminService'
import { bulkSyncPartnerOrganizations } from '@/services/partnerAssignmentSyncService'
import { removeUndefinedFields } from '@/utils/firestore'
import {
  AdminActivityLogEntry,
  AdminFormData,
  AdminRole,
  AdminUserRecord,
  PartnerAssignment,
  PartnerAssignmentStatus,
  EngagementRiskAggregate,
  OrganizationMemberStats,
  OrganizationRecord,
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'
import { normalizeRole } from '@/utils/role'

type TrendPoint = { label: string; value: number }

const orgCollection = collection(db, ORG_COLLECTION)
const usersCollection = collection(db, 'profiles')
const auditCollection = collection(db, 'admin_activity_log')
const engagementCollection = collection(db, 'user_engagement_scores')
const orgDeletionRecoveryCollection = collection(db, 'pending_org_deletions')
const adminRoles: AdminRole[] = ['super_admin', 'partner', 'mentor', 'ambassador']

const getActorId = () => auth.currentUser?.uid
const getActorName = () => auth.currentUser?.displayName || undefined

const upsertUserMirrors = async (userId: string, payload: Record<string, unknown>) => {
  const cleaned = removeUndefinedFields(payload)
  await Promise.all([
    setDoc(doc(db, 'profiles', userId), cleaned, { merge: true }),
    setDoc(doc(db, 'users', userId), cleaned, { merge: true }),
  ])
}

const mapOrganizationStatusToPartnerAssignment = (
  status?: OrganizationRecord['status'],
): PartnerAssignmentStatus => {
  switch (status) {
    case 'watch':
      return 'watch'
    case 'paused':
      return 'paused'
    case 'inactive':
      return 'inactive'
    case 'suspended':
      return 'paused'
    case 'pending':
      return 'inactive'
    case 'active':
    default:
      return 'active'
  }
}

export const fetchDashboardMetrics = async (
  filters?: Partial<{ organizationCodes: string[]; organizationIds: string[]; trendDays: number }>,
): Promise<SuperAdminDashboardMetrics> => {
  const orgQuery = filters?.organizationCodes?.length
    ? query(orgCollection, where('code', 'in', filters.organizationCodes))
    : orgCollection

  const [orgSnapshot, userSnapshot] = await Promise.all([getDocs(orgQuery), getDocs(usersCollection)])

  const organizationCount = orgSnapshot.size
  const paidMembers = userSnapshot.docs.filter((docSnap) => (docSnap.data() as { membershipStatus?: string }).membershipStatus === 'paid').length

  const activeMembers = userSnapshot.docs.filter((docSnap) => (docSnap.data() as { accountStatus?: string }).accountStatus === 'active').length
  const newRegistrations = userSnapshot.docs.filter((docSnap) => !!(docSnap.data() as { registrationDate?: unknown }).registrationDate).length

  return {
    organizationCount,
    managedCompanies: organizationCount,
    paidMembers,
    activeMembers,
    engagementRate: 0.76,
    newRegistrations,
  }
}

export const listenToDashboardMetrics = (
  onChange: (metrics: SuperAdminDashboardMetrics) => void,
  filters?: Partial<{ organizationCodes: string[]; organizationIds: string[]; trendDays: number }>,
  onError?: (error: FirestoreError) => void,
) => {
  const orgQuery = filters?.organizationCodes?.length
    ? query(orgCollection, where('code', 'in', filters.organizationCodes))
    : orgCollection

  let orgDocs: Array<{ data: () => unknown }> = []
  let userDocs: Array<{ data: () => unknown }> = []

  const emit = () => {
    const organizationCount = orgDocs.length
    const paidMembers = userDocs.filter((docSnap) => (docSnap.data() as { membershipStatus?: string }).membershipStatus === 'paid').length
    const activeMembers = userDocs.filter((docSnap) => (docSnap.data() as { accountStatus?: string }).accountStatus === 'active').length
    const newRegistrations = userDocs.filter((docSnap) => !!(docSnap.data() as { registrationDate?: unknown }).registrationDate).length

    onChange({
      organizationCount,
      managedCompanies: organizationCount,
      paidMembers,
      activeMembers,
      engagementRate: 0.76,
      newRegistrations,
    })
  }

  const unsubscribes = [
    onSnapshot(
      orgQuery,
      (snapshot) => {
        orgDocs = snapshot.docs
        emit()
      },
      onError,
    ),
    onSnapshot(
      usersCollection,
      (snapshot) => {
        userDocs = snapshot.docs
        emit()
      },
      onError,
    ),
  ]

  return () => unsubscribes.forEach((unsub) => unsub())
}

export const fetchOrganizationMemberStats = async (
  organization: Pick<OrganizationRecord, 'id' | 'code'>,
): Promise<OrganizationMemberStats> => {
  const queries = []
  if (organization.code) {
    queries.push(getDocs(query(usersCollection, where('companyCode', '==', organization.code))))
  }
  if (organization.id) {
    queries.push(getDocs(query(usersCollection, where('companyId', '==', organization.id))))
  }

  if (!queries.length) {
    return { totalMembers: 0, activeMembers: 0, paidMembers: 0 }
  }

  const snapshots = await Promise.all(queries)
  const userIndex = new Map<string, { membershipStatus?: string; accountStatus?: string }>()

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      userIndex.set(docSnap.id, docSnap.data() as { membershipStatus?: string; accountStatus?: string })
    })
  })

  const users = Array.from(userIndex.values())
  const totalMembers = users.length
  const activeMembers = users.filter((user) => user.accountStatus === 'active').length
  const paidMembers = users.filter((user) => user.membershipStatus === 'paid').length

  return { totalMembers, activeMembers, paidMembers }
}

const buildDateBuckets = (days: number) => {
  const today = new Date()
  const buckets: Record<string, { label: string; start: number; end: number; value: number }> = {}

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(today.getDate() - i)
    const start = date.getTime()
    const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    buckets[label] = { label, start, end: endDate.getTime(), value: 0 }
  }

  return buckets
}

const timestampToMillis = (value?: unknown) => {
  if (!value) return 0
  if (value instanceof Timestamp) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  const asDate = (value as { toDate?: () => Date })?.toDate?.()
  if (asDate) return asDate.getTime()

  const asSeconds = (value as { seconds?: unknown })?.seconds
  if (typeof asSeconds === 'number' && Number.isFinite(asSeconds)) return asSeconds * 1000

  return 0
}

const mapAdminDoc = (docSnap: { id: string; data: () => unknown }): AdminUserRecord => {
  const data = docSnap.data() as Partial<AdminUserRecord>
  const fullName =
    data.fullName || [data.firstName, data.lastName].filter((value) => !!value).join(' ').trim() || undefined
  return {
    id: docSnap.id,
    ...data,
    fullName,
  } as AdminUserRecord
}

export const fetchRegistrationTrend = async (days = 14): Promise<TrendPoint[]> => {
  const sinceDate = new Date()
  sinceDate.setHours(0, 0, 0, 0)
  sinceDate.setDate(sinceDate.getDate() - (days - 1))
  const sinceIso = sinceDate.toISOString()

  const snapshots = await Promise.allSettled([
    getDocs(query(usersCollection, where('createdAt', '>=', sinceDate), orderBy('createdAt', 'asc'))),
    getDocs(query(usersCollection, where('createdAt', '>=', sinceIso), orderBy('createdAt', 'asc'))),
    getDocs(query(usersCollection, where('registrationDate', '>=', sinceDate), orderBy('registrationDate', 'asc'))),
    getDocs(query(usersCollection, where('registrationDate', '>=', sinceIso), orderBy('registrationDate', 'asc'))),
  ])

  const buckets = buildDateBuckets(days)
  const windowStart = sinceDate.getTime()

  const docMillisById = new Map<string, number>()

  snapshots.forEach((result) => {
    if (result.status !== 'fulfilled') return
    result.value.docs.forEach((docSnap) => {
      const data = docSnap.data() as { createdAt?: unknown; registrationDate?: unknown }
      const millis = timestampToMillis(data.registrationDate) || timestampToMillis(data.createdAt)
      if (millis && millis >= windowStart) docMillisById.set(docSnap.id, millis)
    })
  })

  docMillisById.forEach((millis) => {
    Object.values(buckets).forEach((bucket) => {
      if (millis >= bucket.start && millis <= bucket.end) {
        buckets[bucket.label].value = (buckets[bucket.label].value || 0) + 1
      }
    })
  })

  return Object.values(buckets).map((bucket) => ({ label: bucket.label, value: bucket.value || 0 }))
}

export const listenToRegistrationTrend = (
  onChange: (trend: TrendPoint[]) => void,
  days = 14,
  onError?: (error: FirestoreError) => void,
) => {
  const sinceDate = new Date()
  sinceDate.setHours(0, 0, 0, 0)
  sinceDate.setDate(sinceDate.getDate() - (days - 1))
  const sinceIso = sinceDate.toISOString()
  const windowStart = sinceDate.getTime()

  const queries = [
    query(usersCollection, where('createdAt', '>=', sinceDate), orderBy('createdAt', 'asc')),
    query(usersCollection, where('createdAt', '>=', sinceIso), orderBy('createdAt', 'asc')),
    query(usersCollection, where('registrationDate', '>=', sinceDate), orderBy('registrationDate', 'asc')),
    query(usersCollection, where('registrationDate', '>=', sinceIso), orderBy('registrationDate', 'asc')),
  ]

  const sourceDocs = new Map<number, Map<string, number>>()

  const emit = () => {
    const merged = new Map<string, number>()
    sourceDocs.forEach((docs) => {
      docs.forEach((millis, id) => {
        if (!merged.has(id)) merged.set(id, millis)
      })
    })

    const buckets = buildDateBuckets(days)
    merged.forEach((millis) => {
      if (!millis || millis < windowStart) return
      Object.values(buckets).forEach((bucket) => {
        if (millis >= bucket.start && millis <= bucket.end) {
          buckets[bucket.label].value = (buckets[bucket.label].value || 0) + 1
        }
      })
    })

    onChange(Object.values(buckets).map((bucket) => ({ label: bucket.label, value: bucket.value || 0 })))
  }

  const unsubs = queries.map((q, index) =>
    onSnapshot(
      q,
      (snapshot) => {
        const docs = new Map<string, number>()
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as { createdAt?: unknown; registrationDate?: unknown }
          const millis = timestampToMillis(data.registrationDate) || timestampToMillis(data.createdAt)
          if (millis && millis >= windowStart) docs.set(docSnap.id, millis)
        })
        sourceDocs.set(index, docs)
        emit()
      },
      (err) => {
        onError?.(err)
      },
    ),
  )

  return () => unsubs.forEach((unsub) => unsub())
}

export const fetchUserGrowthTrend = async (days = 30): Promise<TrendPoint[]> => {
  const sinceDate = new Date()
  sinceDate.setHours(0, 0, 0, 0)
  sinceDate.setDate(sinceDate.getDate() - (days - 1))
  const sinceIso = sinceDate.toISOString()

  const snapshots = await Promise.allSettled([
    getDocs(query(usersCollection, where('createdAt', '>=', sinceDate), orderBy('createdAt', 'asc'))),
    getDocs(query(usersCollection, where('createdAt', '>=', sinceIso), orderBy('createdAt', 'asc'))),
    getDocs(query(usersCollection, where('registrationDate', '>=', sinceDate), orderBy('registrationDate', 'asc'))),
    getDocs(query(usersCollection, where('registrationDate', '>=', sinceIso), orderBy('registrationDate', 'asc'))),
  ])

  const buckets = buildDateBuckets(days)
  const windowStart = sinceDate.getTime()

  const byDay: Record<string, number> = {}
  const docMillisById = new Map<string, number>()

  snapshots.forEach((result) => {
    if (result.status !== 'fulfilled') return
    result.value.docs.forEach((docSnap) => {
      const data = docSnap.data() as { createdAt?: unknown; registrationDate?: unknown }
      const millis = timestampToMillis(data.registrationDate) || timestampToMillis(data.createdAt)
      if (millis && millis >= windowStart) docMillisById.set(docSnap.id, millis)
    })
  })

  docMillisById.forEach((millis) => {
    const bucket = Object.values(buckets).find((range) => millis >= range.start && millis <= range.end)
    if (bucket) byDay[bucket.label] = (byDay[bucket.label] || 0) + 1
  })

  let runningTotal = 0
  return Object.values(buckets).map((bucket) => {
    runningTotal += byDay[bucket.label] || 0
    return { label: bucket.label, value: runningTotal }
  })
}

export const listenToUserGrowthTrend = (
  onChange: (trend: TrendPoint[]) => void,
  days = 30,
  onError?: (error: FirestoreError) => void,
) => {
  const sinceDate = new Date()
  sinceDate.setHours(0, 0, 0, 0)
  sinceDate.setDate(sinceDate.getDate() - (days - 1))
  const sinceIso = sinceDate.toISOString()
  const windowStart = sinceDate.getTime()

  const queries = [
    query(usersCollection, where('createdAt', '>=', sinceDate), orderBy('createdAt', 'asc')),
    query(usersCollection, where('createdAt', '>=', sinceIso), orderBy('createdAt', 'asc')),
    query(usersCollection, where('registrationDate', '>=', sinceDate), orderBy('registrationDate', 'asc')),
    query(usersCollection, where('registrationDate', '>=', sinceIso), orderBy('registrationDate', 'asc')),
  ]

  const sourceDocs = new Map<number, Map<string, number>>()

  const emit = () => {
    const merged = new Map<string, number>()
    sourceDocs.forEach((docs) => {
      docs.forEach((millis, id) => {
        if (!merged.has(id)) merged.set(id, millis)
      })
    })

    const buckets = buildDateBuckets(days)
    const byDay: Record<string, number> = {}

    merged.forEach((millis) => {
      if (!millis || millis < windowStart) return
      const bucket = Object.values(buckets).find((range) => millis >= range.start && millis <= range.end)
      if (bucket) byDay[bucket.label] = (byDay[bucket.label] || 0) + 1
    })

    let runningTotal = 0
    onChange(
      Object.values(buckets).map((bucket) => {
        runningTotal += byDay[bucket.label] || 0
        return { label: bucket.label, value: runningTotal }
      }),
    )
  }

  const unsubs = queries.map((q, index) =>
    onSnapshot(
      q,
      (snapshot) => {
        const docs = new Map<string, number>()
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as { createdAt?: unknown; registrationDate?: unknown }
          const millis = timestampToMillis(data.registrationDate) || timestampToMillis(data.createdAt)
          if (millis && millis >= windowStart) docs.set(docSnap.id, millis)
        })
        sourceDocs.set(index, docs)
        emit()
      },
      (err) => onError?.(err),
    ),
  )

  return () => unsubs.forEach((unsub) => unsub())
}

export const fetchOrganizations = async (): Promise<OrganizationRecord[]> => {
  const snapshot = await getDocs(query(orgCollection, orderBy('createdAt', 'desc')))
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<OrganizationRecord, 'id'>) }))
}

export const listenToOrganizations = (
  onChange: (organizations: OrganizationRecord[]) => void,
  onError?: (error: FirestoreError) => void,
) => {
  return onSnapshot(
    query(orgCollection, orderBy('createdAt', 'desc')),
    (snapshot) => {
      onChange(
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<OrganizationRecord, 'id'>) })),
      )
    },
    onError,
  )
}

export const createOrganization = async (organization: OrganizationRecord) => {
  const payload = {
    ...organization,
    createdAt: organization.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const docRef = await addDoc(orgCollection, payload)
  return docRef.id
}

export const updateOrganization = async (id: string, updates: Partial<OrganizationRecord>) => {
  const orgRef = doc(db, ORG_COLLECTION, id)
  await updateDoc(orgRef, { ...updates, updatedAt: serverTimestamp() })
}

export const deleteOrganization = async (id: string) => {
  if (!id?.trim()) return
  const orgId = id.trim()
  const orgRef = doc(db, ORG_COLLECTION, orgId)
  const usersMirrorCollection = collection(db, 'users')

  const [profileAssignments, userAssignments] = await Promise.all([
    getDocs(query(usersCollection, where('assignedOrganizations', 'array-contains', orgId))),
    getDocs(query(usersMirrorCollection, where('assignedOrganizations', 'array-contains', orgId))),
  ])

  const detachPayload = {
    assignedOrganizations: arrayRemove(orgId),
    assignedOrganizationsUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const assignmentRefs = [
    ...profileAssignments.docs.map((docSnap) => docSnap.ref),
    ...userAssignments.docs.map((docSnap) => docSnap.ref),
  ]
  const getRefPath = (ref: unknown): string => {
    const asRef = ref as { path?: unknown }
    return typeof asRef.path === 'string' ? asRef.path : ''
  }
  const getRefUserId = (ref: unknown): string => {
    const asRef = ref as { id?: unknown; path?: unknown }
    if (typeof asRef.id === 'string' && asRef.id.trim()) return asRef.id
    if (typeof asRef.path === 'string') {
      const parts = asRef.path.split('/').filter(Boolean)
      const tail = parts[parts.length - 1]
      return tail || 'unknown'
    }
    return 'unknown'
  }
  const affectedUserIds = Array.from(new Set(assignmentRefs.map((ref) => getRefUserId(ref))))
  const persistDeletionFailure = async (params: {
    processed: number
    attemptedChunkRefs: unknown[]
    remainingCount: number
    includesOrgDelete: boolean
    commitError: unknown
  }): Promise<string | null> => {
    const attemptedUserIds = Array.from(new Set(params.attemptedChunkRefs.map((ref) => getRefUserId(ref))))
    const recoveryPayload = {
      type: 'pendingOrgDeletion',
      status: 'pending_recovery',
      organizationId: orgId,
      organizationRefPath: getRefPath(orgRef) || `${ORG_COLLECTION}/${orgId}`,
      processedCount: params.processed,
      totalAssignmentRefs: assignmentRefs.length,
      remainingCount: params.remainingCount,
      includesOrgDelete: params.includesOrgDelete,
      attemptedChunkRefPaths: params.attemptedChunkRefs.map((ref) => getRefPath(ref)),
      attemptedUserIds,
      affectedUserIds,
      errorMessage:
        params.commitError instanceof Error
          ? params.commitError.message
          : typeof params.commitError === 'string'
            ? params.commitError
            : 'Unknown commit failure',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: {
        operation: 'deleteOrganization',
      },
    }
    try {
      const markerDoc = await addDoc(orgDeletionRecoveryCollection, recoveryPayload)
      return markerDoc.id
    } catch (markerError) {
      console.error('[SuperAdmin] Failed to persist org deletion recovery marker', {
        organizationId: orgId,
        markerError,
      })
      return null
    }
  }
  const throwWithRecoveryContext = async (params: {
    processed: number
    attemptedChunkRefs: unknown[]
    remainingCount: number
    includesOrgDelete: boolean
    commitError: unknown
  }): Promise<never> => {
    const attemptedUserIds = Array.from(new Set(params.attemptedChunkRefs.map((ref) => getRefUserId(ref))))
    const context = {
      organizationId: orgId,
      organizationRefPath: getRefPath(orgRef) || `${ORG_COLLECTION}/${orgId}`,
      processedCount: params.processed,
      totalAssignmentRefs: assignmentRefs.length,
      remainingCount: params.remainingCount,
      attemptedChunkRefPaths: params.attemptedChunkRefs.map((ref) => getRefPath(ref)),
      attemptedUserIds,
      affectedUserIds,
      includesOrgDelete: params.includesOrgDelete,
    }

    console.error('[SuperAdmin] Organization deletion batch commit failed', {
      ...context,
      commitError: params.commitError,
    })
    const recoveryMarkerId = await persistDeletionFailure(params)
    const errorMessage = recoveryMarkerId
      ? `Failed to delete organization ${orgId}. Recovery marker ${recoveryMarkerId} was recorded in pending_org_deletions.`
      : `Failed to delete organization ${orgId}. Recovery marker could not be recorded; use logged context for manual recovery.`
    const recoveryError = Object.assign(new Error(errorMessage), {
      cause: params.commitError,
      recoveryContext: context,
      recoveryMarkerId: recoveryMarkerId ?? undefined,
    })
    throw recoveryError
  }
  const maxBatchWrites = 500
  let processed = 0

  if (!assignmentRefs.length) {
    const batch = writeBatch(db)
    batch.delete(orgRef)
    try {
      await batch.commit()
    } catch (commitError) {
      await throwWithRecoveryContext({
        processed: 0,
        attemptedChunkRefs: [],
        remainingCount: 0,
        includesOrgDelete: true,
        commitError,
      })
    }
    return
  }

  while (processed < assignmentRefs.length) {
    const remaining = assignmentRefs.length - processed
    const reserveDeleteOperation = remaining <= maxBatchWrites
    const chunkSize = reserveDeleteOperation ? maxBatchWrites - 1 : maxBatchWrites
    const chunkRefs = assignmentRefs.slice(processed, processed + chunkSize)
    const batch = writeBatch(db)

    chunkRefs.forEach((ref) => {
      batch.update(ref, detachPayload)
    })

    const processedAfterCommit = processed + chunkRefs.length
    if (processedAfterCommit === assignmentRefs.length) {
      batch.delete(orgRef)
    }

    try {
      await batch.commit()
      processed = processedAfterCommit
    } catch (commitError) {
      await throwWithRecoveryContext({
        processed,
        attemptedChunkRefs: chunkRefs,
        remainingCount: assignmentRefs.length - processed,
        includesOrgDelete: processedAfterCommit === assignmentRefs.length,
        commitError,
      })
    }
  }
}

export const fetchEngagementRiskAggregates = async (): Promise<EngagementRiskAggregate> => {
  const snapshot = await getDocs(engagementCollection)
  const byRisk: Record<string, number> = {}
  snapshot.docs.forEach((docSnap) => {
    const riskLevel = (docSnap.data() as { riskLevel?: string }).riskLevel || 'unknown'
    byRisk[riskLevel] = (byRisk[riskLevel] || 0) + 1
  })

  return {
    total: snapshot.size,
    riskBuckets: byRisk,
  }
}

export const listenToEngagementRiskAggregates = (
  onChange: (aggregate: EngagementRiskAggregate) => void,
  onError?: (error: FirestoreError) => void,
) => {
  return onSnapshot(
    engagementCollection,
    (snapshot) => {
      const byRisk: Record<string, number> = {}
      snapshot.docs.forEach((docSnap) => {
        const riskLevel = (docSnap.data() as { riskLevel?: string }).riskLevel || 'unknown'
        byRisk[riskLevel] = (byRisk[riskLevel] || 0) + 1
      })

      onChange({
        total: snapshot.size,
        riskBuckets: byRisk,
      })
    },
    onError,
  )
}

export const fetchAdminActivityLog = async (limitCount = 10): Promise<AdminActivityLogEntry[]> => {
  const snapshot = await getDocs(query(auditCollection, orderBy('createdAt', 'desc'), limit(limitCount)))
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as AdminActivityLogEntry
    return { ...data, id: docSnap.id }
  })
}

export const listenToAdminActivityLog = (
  onChange: (entries: AdminActivityLogEntry[]) => void,
  limitCount = 10,
  onError?: (error: FirestoreError) => void,
) => {
  return onSnapshot(
    query(auditCollection, orderBy('createdAt', 'desc'), limit(limitCount)),
    (snapshot) => {
      onChange(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as AdminActivityLogEntry
          return { ...data, id: docSnap.id }
        }),
      )
    },
    onError,
  )
}

export const logAdminAction = async (entry: Omit<AdminActivityLogEntry, 'id' | 'createdAt'>) => {
  const actorId = getActorId() || entry.adminId
  const sanitizedEntry = removeUndefinedFields({
    ...entry,
    createdBy: actorId,
    createdAt: serverTimestamp(),
  })
  await addDoc(auditCollection, sanitizedEntry)
}

export const fetchAdminUsers = async (): Promise<AdminUserRecord[]> => {
  const adminQuery = query(usersCollection, where('role', 'in', adminRoles), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(adminQuery)
  return snapshot.docs.map(mapAdminDoc)
}

export const listenToAdminUsers = (
  onChange: (admins: AdminUserRecord[]) => void,
  onError?: (error: FirestoreError) => void,
) => {
  const adminQuery = query(usersCollection, where('role', 'in', adminRoles), orderBy('createdAt', 'desc'))
  return onSnapshot(
    adminQuery,
    (snapshot) => {
      onChange(snapshot.docs.map(mapAdminDoc))
    },
    onError,
  )
}

export const createAdminUser = async (
  adminData: AdminFormData & Partial<AdminUserRecord> & { createdBy?: string; createdByName?: string },
) => {
  const { createdBy, createdByName, assignedOrganizations, ...rest } = adminData

  // Check if user with this email already exists
  const existingUserQuery = query(usersCollection, where('email', '==', adminData.email), limit(1))
  const existingUserSnapshot = await getDocs(existingUserQuery)

  if (!existingUserSnapshot.empty) {
    // User exists - update their existing profile instead of creating a duplicate
    const existingDoc = existingUserSnapshot.docs[0]
    const existingId = existingDoc.id
    const updatePayload = {
      ...rest,
      fullName: adminData.fullName || `${adminData.firstName} ${adminData.lastName}`.trim(),
      accountStatus: adminData.accountStatus || 'active',
      updatedAt: serverTimestamp(),
    }
    await upsertUserMirrors(existingId, updatePayload)
    await logAdminAction({
      action: 'admin_role_assigned',
      adminId: createdBy,
      adminName: createdByName,
      userId: existingId,
      metadata: { role: adminData.role, organizations: assignedOrganizations, wasExistingUser: true },
    })
    return existingId
  }

  // User doesn't exist - create new document (for inviting new admins)
  const payload = {
    ...rest,
    fullName: adminData.fullName || `${adminData.firstName} ${adminData.lastName}`.trim(),
    accountStatus: adminData.accountStatus || 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const docRef = doc(usersCollection)
  await upsertUserMirrors(docRef.id, payload)
  await logAdminAction({
    action: 'admin_created',
    adminId: createdBy,
    adminName: createdByName,
    userId: docRef.id,
    metadata: { role: adminData.role, organizations: assignedOrganizations },
  })
  return docRef.id
}

export const updateAdminUser = async (adminId: string, updates: Partial<AdminUserRecord>) => {
  await upsertUserMirrors(adminId, { ...updates, updatedAt: serverTimestamp() })
  await logAdminAction({
    action: 'admin_updated',
    userId: adminId,
    metadata: updates,
  })
}

export const deleteAdminUser = async (adminId: string) => {
  await Promise.all([
    deleteDoc(doc(db, 'profiles', adminId)),
    deleteDoc(doc(db, 'users', adminId)),
  ])
  await logAdminAction({
    action: 'admin_deleted',
    userId: adminId,
  })
}

export const assignOrganizations = async (adminId: string, orgIds: string[]) => {
  const adminRef = doc(db, 'users', adminId)
  const profileRef = doc(db, 'profiles', adminId)
  const actorId = getActorId()
  const actorName = getActorName()
  // assignedOrganizations MUST contain organization document IDs only, never codes.
  const sanitizedOrgIds = Array.from(
    new Set(
      (orgIds || [])
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  )
  const updatePayload = {
    assignedOrganizations: sanitizedOrgIds,
    assignedOrganizationsUpdatedAt: serverTimestamp(),
    assignedOrganizationsUpdatedBy: actorId || null,
    updatedAt: serverTimestamp(),
  }

  const adminSnapshot = await getDoc(adminRef)
  const adminData = adminSnapshot.data() as { role?: string; assignedOrganizations?: string[] } | undefined
  const adminRole = normalizeRole(adminData?.role)
  const previousOrgIds = (adminData?.assignedOrganizations || []) as string[]

  const partnerAssignments: PartnerAssignment[] =
    adminRole === 'partner'
      ? await (async () => {
        const orgRecords = await fetchOrganizationsByIds(sanitizedOrgIds)
        const orgById = new Map(orgRecords.map((org) => [org.id, org]))
        return sanitizedOrgIds.map((organizationId) => {
          const orgRecord = orgById.get(organizationId)
          return {
            organizationId,
            companyCode: orgRecord?.code,
            status: mapOrganizationStatusToPartnerAssignment(orgRecord?.status),
          }
        })
      })()
      : []

  await Promise.all([
    updateDoc(adminRef, updatePayload),
    updateDoc(profileRef, updatePayload),
    adminRole === 'partner'
      ? upsertPartnerAssignments(adminId, partnerAssignments)
      : Promise.resolve(),
  ])

  // Sync organization documents if this is a partner assignment
  if (adminRole === 'partner') {
    await bulkSyncPartnerOrganizations(adminId, sanitizedOrgIds, previousOrgIds)
  }

  await logAdminAction({
    action: 'admin_orgs_updated',
    adminId: actorId,
    adminName: actorName,
    userId: adminId,
    metadata: { orgIds: sanitizedOrgIds },
  })
}

export const updateAdminRole = async (adminId: string, newRole: AdminRole) => {
  await upsertUserMirrors(adminId, { role: newRole, updatedAt: serverTimestamp() })
  await logAdminAction({
    action: 'admin_role_updated',
    userId: adminId,
    metadata: { newRole },
  })
}

export const toggleAdminStatus = async (adminId: string, status: 'active' | 'suspended') => {
  await upsertUserMirrors(adminId, { accountStatus: status, updatedAt: serverTimestamp() })
  await logAdminAction({
    action: 'admin_status_updated',
    userId: adminId,
    metadata: { status },
  })
}

export const listenToVerificationRequests = (
  onChange: (requests: VerificationRequest[]) => void,
  onError?: (error: FirestoreError) => void,
) => {
  const verificationQuery = query(collection(db, 'points_verification_requests'), where('status', '==', 'pending'))

  const mapRequests = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) =>
    snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as VerificationRequest
        return { ...data, id: docSnap.id }
      })
      .sort((left, right) => timestampToMillis(right.created_at) - timestampToMillis(left.created_at))
      .slice(0, 10)

  return onSnapshot(
    verificationQuery,
    (snapshot) => {
      onChange(mapRequests(snapshot as { docs: Array<{ id: string; data: () => unknown }> }))
    },
    onError,
  )
}

export const listenToRegistrations = (
  onChange: (registrations: RegistrationRecord[]) => void,
  onError?: (error: FirestoreError) => void,
) => {
  // Use the same canonical collection (`profiles`) as other super-admin user streams,
  // so role/membership/org fields are consistent across dashboards.
  const registrationQuery = query(usersCollection, orderBy('createdAt', 'desc'), limit(8))
  return onSnapshot(
    registrationQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as RegistrationRecord
          return { ...data, id: docSnap.id }
        }),
      )
    },
    onError,
  )
}

export const listenToSystemAlerts = (
  onChange: (alerts: SystemAlertRecord[]) => void,
  onError?: (error: FirestoreError) => void,
) => {
  const alertsQuery = query(collection(db, 'system_health_alerts'), orderBy('created_at', 'desc'), limit(8))
  return onSnapshot(
    alertsQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as SystemAlertRecord
          return { ...data, id: docSnap.id }
        }),
      )
    },
    onError,
  )
}

export const listenToTaskNotifications = (
  onChange: (tasks: TaskNotificationRecord[]) => void,
  onError?: (error: FirestoreError) => void,
) => {
  const taskQuery = query(collection(db, 'task_notifications'), orderBy('created_at', 'desc'), limit(8))
  return onSnapshot(
    taskQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as TaskNotificationRecord
          return { ...data, id: docSnap.id }
        }),
      )
    },
    onError,
  )
}

export const listenToUsers = (
  onChange: (users: AdminUserRecord[]) => void,
  onError?: (error: FirestoreError) => void,
) => {
  const usersQuery = query(usersCollection, orderBy('createdAt', 'desc'))
  return onSnapshot(
    usersQuery,
    (snapshot) => {
      onChange(snapshot.docs.map(mapAdminDoc))
    },
    onError,
  )
}
