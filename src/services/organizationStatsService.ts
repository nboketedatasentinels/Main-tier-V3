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

// Primary field for organization membership (per firestore-schema.md)
const PRIMARY_COMPANY_CODE_FIELD = 'companyCode'
// Legacy fields still checked for backwards compatibility
const LEGACY_COMPANY_CODE_FIELDS = ['company_code', 'organization_code'] as const
const LEGACY_COMPANY_ID_FIELDS = ['companyId', 'organizationId'] as const

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

const resolveOrganizationId = async (organizationCode?: string) => {
  if (!organizationCode) return null
  const trimmed = organizationCode.trim()
  if (!trimmed) return null
  const snapshot = await getDocs(query(organizationsCollection, where('code', '==', trimmed.toUpperCase())))
  if (snapshot.empty) return null
  return snapshot.docs[0].id
}

/**
 * OPTIMIZED: Fetch organization users with reduced query count.
 *
 * Previously this created up to 15 parallel queries (3 code variants × 3 fields + 3 id variants × 2 fields).
 * Now it uses a two-phase approach:
 * 1. Primary query on canonical 'companyCode' field (single query, lowercase normalized)
 * 2. Fallback to legacy fields only if primary returns no results
 *
 * This reduces typical queries from 15 to 1-3.
 */
const fetchOrganizationUserDocs = async (organizationKey: OrganizationKey) => {
  const trimmedCode = organizationKey.organizationCode?.trim()
  const trimmedId = organizationKey.organizationId?.trim()

  if (!trimmedCode && !trimmedId) return []

  const buildVariants = (value: string | undefined) => {
    const trimmed = value?.trim()
    if (!trimmed) return []
    const variants = [trimmed, trimmed.toLowerCase(), trimmed.toUpperCase()]
    return Array.from(new Set(variants.filter(Boolean)))
  }

  const codeVariants = buildVariants(trimmedCode)
  const idVariants = buildVariants(trimmedId)

  const buildQueryForVariants = (field: string, variants: string[]) => {
    if (variants.length <= 0) return null
    if (variants.length === 1) {
      return query(usersCollection, where(field, '==', variants[0]))
    }
    return query(usersCollection, where(field, 'in', variants.slice(0, 10)))
  }

  const userMap = new Map<string, { data: () => unknown }>()

  // Phase 1: Query on primary canonical field (companyCode) with lowercase value
  // This is the expected field per firestore-schema.md
  if (codeVariants.length) {
    const primaryQuery = buildQueryForVariants(PRIMARY_COMPANY_CODE_FIELD, codeVariants)
    const primarySnapshot = primaryQuery ? await getDocs(primaryQuery) : null

    primarySnapshot?.docs.forEach((docSnap) => {
      userMap.set(docSnap.id, docSnap)
    })

    // If we found users with primary field, return early (most common case)
    if (userMap.size > 0) {
      return Array.from(userMap.values())
    }
  }

  // Phase 2: Fallback to legacy fields if primary returned no results
  // This handles data that hasn't been migrated yet
  const legacyQueries: ReturnType<typeof query>[] = []

  if (codeVariants.length) {
    // Try legacy code fields
    LEGACY_COMPANY_CODE_FIELDS.forEach((field) => {
      const q = buildQueryForVariants(field, codeVariants)
      if (q) legacyQueries.push(q)
    })
  }

  if (idVariants.length) {
    // Try ID fields
    LEGACY_COMPANY_ID_FIELDS.forEach((field) => {
      const q = buildQueryForVariants(field, idVariants)
      if (q) legacyQueries.push(q)
    })
  }

  if (legacyQueries.length > 0) {
    const legacySnapshots = await Promise.all(legacyQueries.map((q) => getDocs(q)))

    legacySnapshots.forEach((snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        userMap.set(docSnap.id, docSnap)
      })
    })
  }

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

/**
 * OPTIMIZED: Listen to organization user changes with reduced listener count.
 *
 * Previously this created up to 15 listeners per organization.
 * Now it uses a single listener on the canonical 'companyCode' field.
 *
 * Note: If data uses legacy fields exclusively, stats may not update in real-time
 * until the data is migrated. However, manual refresh and batch updates still work.
 */
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

  // OPTIMIZED: Single listener on canonical field instead of multiple listeners
  const trimmedCode = organization.code?.trim()
  const subscriptions: (() => void)[] = []

  const buildVariants = (value: string | undefined) => {
    const trimmed = value?.trim()
    if (!trimmed) return []
    const variants = [trimmed, trimmed.toLowerCase(), trimmed.toUpperCase()]
    return Array.from(new Set(variants.filter(Boolean)))
  }

  const codeVariants = buildVariants(trimmedCode)

  if (codeVariants.length) {
    // Primary listener on canonical companyCode field
    const primaryQuery =
      codeVariants.length === 1
        ? query(usersCollection, where(PRIMARY_COMPANY_CODE_FIELD, '==', codeVariants[0]))
        : query(usersCollection, where(PRIMARY_COMPANY_CODE_FIELD, 'in', codeVariants.slice(0, 10)))
    subscriptions.push(
      onSnapshot(
        primaryQuery,
        handleSnapshot,
        options?.onError
      )
    )
  }

  // Optionally add a single fallback listener for organizationId if code is not available
  if (!codeVariants.length && organization.id) {
    const idVariants = buildVariants(organization.id)
    if (idVariants.length) {
      const idQuery =
        idVariants.length === 1
          ? query(usersCollection, where('organizationId', '==', idVariants[0]))
          : query(usersCollection, where('organizationId', 'in', idVariants.slice(0, 10)))
      subscriptions.push(
        onSnapshot(
          idQuery,
          handleSnapshot,
          options?.onError
        )
      )
    }
  }

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
