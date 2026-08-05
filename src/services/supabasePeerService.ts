/**
 * Supabase peer-profile reads for Peer Connect.
 *
 * Uses SECURITY DEFINER RPCs (migration 0037) so learners can list / fetch
 * same-organisation peers without broad profiles SELECT or Firestore.
 */
import { supabase } from '@/services/supabase'
import { isLearnerRole } from '@/utils/role'

export type SupabasePeerRow = {
  id: string
  email?: string | null
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  role?: string | null
  membership_status?: string | null
  organization_id?: string | null
  company_id?: string | null
  company_code?: string | null
  company_name?: string | null
  journey_type?: string | null
  total_points?: number | null
  level?: number | null
  data?: Record<string, unknown> | null
}

type ListOrgPeersResult =
  | { ok: true; peers: SupabasePeerRow[] }
  | { ok: false; error: string }

type GetPeerProfileResult =
  | { ok: true; peer: SupabasePeerRow }
  | { ok: false; error: string }

/**
 * Flatten a Supabase peer row into the camelCase shape Peer Connect eligibility
 * / display helpers expect (mirrors AuthContext mapRowToProfile for peers).
 */
export const mapSupabasePeerToRecord = (row: SupabasePeerRow): Record<string, unknown> => {
  const data = (row.data ?? {}) as Record<string, unknown>
  const privacySettings =
    data.privacySettings && typeof data.privacySettings === 'object'
      ? (data.privacySettings as Record<string, unknown>)
      : undefined

  return {
    ...data,
    id: row.id,
    email: row.email ?? data.email ?? '',
    fullName: row.full_name ?? data.fullName,
    firstName: row.first_name ?? data.firstName,
    lastName: row.last_name ?? data.lastName,
    role: row.role ?? data.role,
    membershipStatus: row.membership_status ?? data.membershipStatus,
    organizationId: row.organization_id ?? data.organizationId ?? null,
    companyId: row.company_id ?? data.companyId ?? null,
    companyCode: row.company_code ?? data.companyCode ?? null,
    companyName: row.company_name ?? data.companyName ?? null,
    journeyType: row.journey_type ?? data.journeyType,
    totalPoints:
      typeof row.total_points === 'number'
        ? row.total_points
        : typeof data.totalPoints === 'number'
          ? data.totalPoints
          : undefined,
    level:
      typeof row.level === 'number'
        ? row.level
        : typeof data.level === 'number'
          ? data.level
          : undefined,
    onboardingComplete: data.onboardingComplete,
    accountStatus: data.accountStatus ?? data.status,
    status: data.status ?? data.accountStatus,
    privacySettings,
    timezone: (data.timezone as string | undefined) ?? undefined,
    interests: data.interests,
    goals: data.goals,
    corporateVillageId: data.corporateVillageId ?? data.villageId,
    villageId: data.villageId ?? data.corporateVillageId,
    cohortIdentifier: data.cohortIdentifier,
    calendarLink: data.calendarLink,
    identityTag: data.identityTag,
    avatarUrl: data.avatarUrl,
    mergedInto: data.mergedInto,
  }
}

const asPeerRows = (value: unknown): SupabasePeerRow[] => {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is SupabasePeerRow => {
    return Boolean(row && typeof row === 'object' && typeof (row as SupabasePeerRow).id === 'string')
  })
}

export const listOrgPeers = async (options?: {
  includeSelf?: boolean
}): Promise<Record<string, unknown>[]> => {
  const { data, error } = await supabase.rpc('list_org_peers', {
    p_include_self: Boolean(options?.includeSelf),
  })
  if (error) {
    const err = new Error(error.message) as Error & { code?: string }
    err.code = error.code === '42501' || /permission|rls|policy/i.test(error.message)
      ? 'permission-denied'
      : error.code
    throw err
  }

  const result = (data ?? {}) as ListOrgPeersResult
  if (!result || typeof result !== 'object') {
    throw new Error('Unexpected list_org_peers response')
  }
  if (!result.ok) {
    if (result.error === 'no_organization') {
      const err = new Error('No organisation assigned') as Error & { code?: string }
      err.code = 'no-organization'
      throw err
    }
    if (result.error === 'not_authenticated') {
      const err = new Error('Not authenticated') as Error & { code?: string }
      err.code = 'permission-denied'
      throw err
    }
    throw new Error(result.error || 'Failed to load peers')
  }

  return asPeerRows(result.peers)
    .filter((row) => isLearnerRole(row.role))
    .map(mapSupabasePeerToRecord)
}

type OrgLedgerRow = {
  id?: string
  userId?: string
  points?: number
  activityId?: string
  weekNumber?: number
  createdAt?: string
}

type ListOrgPointsLedgerResult =
  | { ok: true; rows: OrgLedgerRow[] }
  | { ok: false; error: string }

export type OrgPointsTransaction = {
  id: string
  userId: string
  points: number
  category?: string
  createdAt: string
  activityId?: string
}

export const listOrgPointsLedger = async (): Promise<OrgPointsTransaction[]> => {
  const { data, error } = await supabase.rpc('list_org_points_ledger')
  if (error) {
    const err = new Error(error.message) as Error & { code?: string }
    err.code = error.code === '42501' || /permission|rls|policy/i.test(error.message)
      ? 'permission-denied'
      : error.code
    throw err
  }

  const result = (data ?? {}) as ListOrgPointsLedgerResult
  if (!result?.ok) {
    if (result?.error === 'no_organization') return []
    throw new Error(result?.error || 'Failed to load org points ledger')
  }

  const rows = Array.isArray(result.rows) ? result.rows : []
  return rows
    .filter((row): row is OrgLedgerRow & { userId: string } => typeof row?.userId === 'string' && Boolean(row.userId))
    .map((row) => ({
      id: String(row.id ?? `${row.userId}-${row.createdAt ?? ''}-${row.activityId ?? ''}`),
      userId: row.userId,
      points: typeof row.points === 'number' ? row.points : 0,
      category: typeof row.activityId === 'string' ? row.activityId : undefined,
      createdAt:
        typeof row.createdAt === 'string'
          ? row.createdAt
          : new Date().toISOString(),
      activityId: typeof row.activityId === 'string' ? row.activityId : undefined,
    }))
}

export type PeerProfileFetchStatus =
  | { status: 'ok'; record: Record<string, unknown> }
  | { status: 'not_found' | 'permission_denied' | 'error'; code?: string }

export const fetchSupabasePeerById = async (peerId: string): Promise<PeerProfileFetchStatus> => {
  if (!peerId) return { status: 'not_found' }

  const { data, error } = await supabase.rpc('get_peer_profile', { p_peer_id: peerId })
  if (error) {
    const code = error.code === '42501' || /permission|rls|policy/i.test(error.message)
      ? 'permission-denied'
      : error.code
    if (code === 'permission-denied') return { status: 'permission_denied', code }
    console.warn('[PeerMatch] Failed to fetch peer profile via Supabase', peerId, error.message)
    return { status: 'error', code }
  }

  const result = (data ?? {}) as GetPeerProfileResult
  if (!result?.ok) {
    if (result?.error === 'not_found') return { status: 'not_found' }
    if (result?.error === 'permission_denied') return { status: 'permission_denied', code: 'permission-denied' }
    if (result?.error === 'not_authenticated') return { status: 'permission_denied', code: 'permission-denied' }
    return { status: 'error', code: result?.error }
  }

  if (!result.peer?.id) return { status: 'not_found' }
  return { status: 'ok', record: mapSupabasePeerToRecord(result.peer) }
}
