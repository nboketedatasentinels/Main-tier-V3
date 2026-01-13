import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import type { OrganizationRecord, OrganizationStatistics } from '@/types/admin'

type OrganizationKey = {
  organizationId?: string
  organizationCode?: string
}

type OrganizationStatsSnapshot = OrganizationStatistics & {
  activeUsers: number
  newThisWeek: number
  totalMembers: number
  averageEngagementRate: number
  lastActive?: string
}

const usersCollection = collection(db, 'users')
const organizationsCollection = collection(db, ORG_COLLECTION)

const COMPANY_CODE_FIELDS = ['companyCode', 'company_code', 'organization_code'] as const
const COMPANY_ID_FIELDS = ['companyId', 'organizationId'] as const

const statsCache = new Map<string, { value: OrganizationStatsSnapshot; expiresAt: number }>()

const buildCacheKey = (key: OrganizationKey) =>
  [key.organizationId || '', key.organizationCode || ''].map((value) => value.trim().toLowerCase()).join('|')

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const withRetry = async <T,>(fn: () => Promise<T>, retries = 2, delayMs = 500): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await delay(delayMs * (attempt + 1))
      }
    }
  }
  throw lastError
}

const parseTimestamp = (value?: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const asDate = (value as { toDate?: () => Date })?.toDate?.()
  return asDate || null
}

const toIsoString = (value: Date | null): string | undefined => (value ? value.toISOString() : undefined)

const normalizeCodes = (code?: string): string[] => {
  if (!code) return []
  const trimmed = code.trim()
  if (!trimmed) return []
  return Array.from(new Set([trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()]))
}

const resolveOrganizationId = async (organizationCode?: string) => {
  if (!organizationCode) return null
  const trimmed = organizationCode.trim()
  if (!trimmed) return null
  const snapshot = await getDocs(query(organizationsCollection, where('code', '==', trimmed.toUpperCase())))
  if (snapshot.empty) return null
  return snapshot.docs[0].id
}

const fetchOrganizationUserDocs = async (organizationKey: OrganizationKey) => {
  const codeCandidates = normalizeCodes(organizationKey.organizationCode)
  const idCandidates = normalizeCodes(organizationKey.organizationId)

  const queries = [
    ...codeCandidates.flatMap((code) =>
      COMPANY_CODE_FIELDS.map((field) => query(usersCollection, where(field, '==', code))),
    ),
    ...idCandidates.flatMap((id) =>
      COMPANY_ID_FIELDS.map((field) => query(usersCollection, where(field, '==', id))),
    ),
  ]

  if (!queries.length) return []

  const snapshots = await Promise.all(queries.map((queryRef) => getDocs(queryRef)))
  const userMap = new Map<string, { data: () => unknown }>()

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      userMap.set(docSnap.id, docSnap)
    })
  })

  return Array.from(userMap.values())
}

export const calculateOrganizationStatistics = async (
  organizationKey: OrganizationKey,
  options?: { cacheTtlMs?: number },
): Promise<OrganizationStatsSnapshot> => {
  const cacheKey = buildCacheKey(organizationKey)
  const cached = statsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const docs = await withRetry(() => fetchOrganizationUserDocs(organizationKey))
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  let totalMembers = 0
  let activeMembers = 0
  let paidMembers = 0
  let newMembersThisWeek = 0
  let engagementScoreSum = 0
  let engagementScoreCount = 0
  let lastActive: Date | null = null

  docs.forEach((docSnap) => {
    totalMembers += 1
    const data = docSnap.data() as {
      accountStatus?: string
      membershipStatus?: string
      createdAt?: unknown
      engagementScore?: number
      engagementRate?: number
      progressPercent?: number
      lastActiveAt?: unknown
      lastActive?: unknown
    }

    if ((data.accountStatus || 'active') === 'active') {
      activeMembers += 1
    }

    if ((data.membershipStatus || 'inactive') === 'paid') {
      paidMembers += 1
    }

    const createdAt = parseTimestamp(data.createdAt)
    if (createdAt && createdAt >= weekAgo) {
      newMembersThisWeek += 1
    }

    const lastActiveAt = parseTimestamp(data.lastActiveAt || data.lastActive)
    if (lastActiveAt && (!lastActive || lastActiveAt > lastActive)) {
      lastActive = lastActiveAt
    }

    const engagementScore =
      typeof data.engagementScore === 'number'
        ? data.engagementScore
        : typeof data.engagementRate === 'number'
          ? data.engagementRate
          : typeof data.progressPercent === 'number'
            ? data.progressPercent
            : null
    if (typeof engagementScore === 'number') {
      engagementScoreSum += engagementScore
      engagementScoreCount += 1
    }
  })

  const averageEngagementRate = engagementScoreCount
    ? Math.round(engagementScoreSum / engagementScoreCount)
    : 0

  const lastActiveIso = toIsoString(lastActive)
  const snapshot: OrganizationStatsSnapshot = {
    totalMembers,
    activeMembers,
    paidMembers,
    newMembersThisWeek,
    averageEngagementRate,
    activeUsers: activeMembers,
    newThisWeek: newMembersThisWeek,
    lastActive: lastActiveIso,
  }

  const ttlMs = options?.cacheTtlMs ?? 120000
  statsCache.set(cacheKey, { value: snapshot, expiresAt: Date.now() + ttlMs })

  return snapshot
}

export const updateOrganizationStatistics = async (organization: Pick<OrganizationRecord, 'id' | 'code'>) => {
  if (!organization.id && !organization.code) return null
  const stats = await calculateOrganizationStatistics({
    organizationId: organization.id,
    organizationCode: organization.code,
  })

  let orgId = organization.id
  if (!orgId && organization.code) {
    const resolvedOrgId = await resolveOrganizationId(organization.code)
    orgId = resolvedOrgId ?? undefined
  }

  if (orgId) {
    await withRetry(() =>
      updateDoc(doc(organizationsCollection, orgId), {
        activeUsers: stats.activeUsers,
        newThisWeek: stats.newThisWeek,
        memberCount: stats.totalMembers,
        averageEngagementRate: stats.averageEngagementRate,
        lastActive: stats.lastActive ?? null,
        statsUpdatedAt: serverTimestamp(),
      }),
    )
  }

  return stats
}

export const updateOrganizationStatisticsBatch = async (
  organizations: Array<Pick<OrganizationRecord, 'id' | 'code'>>,
) => {
  const results: Array<{ organizationId?: string; success: boolean; error?: unknown }> = []

  for (const organization of organizations) {
    try {
      await updateOrganizationStatistics(organization)
      results.push({ organizationId: organization.id, success: true })
    } catch (error) {
      results.push({ organizationId: organization.id, success: false, error })
    }
  }

  return results
}

export const listenToOrganizationStatsUpdates = (
  organization: Pick<OrganizationRecord, 'id' | 'code'>,
  options?: { debounceMs?: number; onError?: (error: unknown) => void; cacheTtlMs?: number },
) => {
  const debounceMs = options?.debounceMs ?? 1500
  let timeoutId: number | null = null
  let isProcessing = false
  let pending = false

  const handleSnapshot = () => {
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
    timeoutId = window.setTimeout(async () => {
      if (isProcessing) {
        pending = true
        return
      }
      isProcessing = true
      try {
        await calculateOrganizationStatistics(
          { organizationId: organization.id, organizationCode: organization.code },
          { cacheTtlMs: options?.cacheTtlMs },
        )
        await updateOrganizationStatistics(organization)
      } catch (error) {
        options?.onError?.(error)
      } finally {
        isProcessing = false
        if (pending) {
          pending = false
          handleSnapshot()
        }
      }
    }, debounceMs)
  }

  const codeCandidates = normalizeCodes(organization.code)
  const idCandidates = normalizeCodes(organization.id)

  const subscriptions = [
    ...codeCandidates.flatMap((code) =>
      COMPANY_CODE_FIELDS.map((field) =>
        onSnapshot(query(usersCollection, where(field, '==', code)), handleSnapshot, options?.onError),
      ),
    ),
    ...idCandidates.flatMap((id) =>
      COMPANY_ID_FIELDS.map((field) =>
        onSnapshot(query(usersCollection, where(field, '==', id)), handleSnapshot, options?.onError),
      ),
    ),
  ]

  return () => {
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
    subscriptions.forEach((unsubscribe) => unsubscribe())
  }
}

export const buildCompanyCodeDataQualityReport = async () => {
  const snapshot = await getDocs(usersCollection)
  const inconsistentUsers: Array<{ id: string; companyCode?: string; company_code?: string }> = []
  const missingCompanyCode: Array<{ id: string; email?: string }> = []

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as { companyCode?: string; company_code?: string; email?: string }
    if (data.companyCode && data.company_code && data.companyCode !== data.company_code) {
      inconsistentUsers.push({ id: docSnap.id, companyCode: data.companyCode, company_code: data.company_code })
    } else if (!data.companyCode && !data.company_code) {
      missingCompanyCode.push({ id: docSnap.id, email: data.email })
    }
  })

  return { inconsistentUsers, missingCompanyCode }
}

export const migrateCompanyCodeField = async () => {
  const snapshot = await getDocs(usersCollection)
  const updates: Array<Promise<void>> = []

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as { companyCode?: string; company_code?: string }
    if (!data.companyCode && data.company_code) {
      updates.push(updateDoc(doc(usersCollection, docSnap.id), { companyCode: data.company_code }))
    }
  })

  await Promise.all(updates)
  return updates.length
}

export const cleanupLegacyCompanyCodeField = async () => {
  const snapshot = await getDocs(usersCollection)
  const updates: Array<Promise<void>> = []

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as { companyCode?: string; company_code?: string }
    if (data.companyCode && data.company_code) {
      updates.push(updateDoc(doc(usersCollection, docSnap.id), { company_code: deleteField() }))
    }
  })

  await Promise.all(updates)
  return updates.length
}
