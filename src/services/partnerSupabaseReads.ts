/**
 * Supabase-backed reads for the partner dashboard.
 *
 * Auth cutover (Firebase -> Supabase) left the partner dashboard reading
 * Firestore with no authenticated Firebase user, so every listener failed with
 * "Missing or insufficient permissions". These functions move the reads to
 * Supabase, where RLS already permits a partner (`is_partner_or_admin()`) to
 * select `organizations`, `profiles`, `points_ledger`, etc.
 *
 * Each function follows the established pattern (see notificationService /
 * pointsVerificationService): an initial async load, then a realtime channel
 * that re-runs the load on any change. The channel topic carries a monotonic
 * suffix because `supabase.channel(topic)` reuses an existing channel with the
 * same topic - a remount before async teardown would otherwise hit an
 * already-subscribed channel and `.on()` would throw.
 */
import { supabase } from '@/services/supabase'

// Monotonic suffixes so every subscription gets a distinct channel topic.
let assignedOrgsChannelSeq = 0
let membersChannelSeq = 0
let orgStatsChannelSeq = 0

const ASSIGNMENT_STATUSES = ['active', 'watch', 'paused']
const PAGE_SIZE = 1000

const normalizeKeys = (keys: string[]): string[] =>
  Array.from(new Set(keys.map((k) => (k ?? '').trim()).filter(Boolean)))

/**
 * Fetch every row matching a query, paging past Supabase's 1000-row cap.
 * `buildQuery` must return a fresh query builder each call (range is applied
 * here). Requires a stable order for correct paging - callers add `.order()`.
 */
async function selectAllPages<T>(
  buildQuery: () => {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
  },
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return out
}

// ============================================================================
// Partner -> assigned organization ids
// ============================================================================

type AssignedOrgRow = { id: string }
type PartnerProfileDataRow = { data: { assignedOrganizations?: unknown } | null }

/**
 * Resolves the organization ids a partner manages from BOTH sources of truth:
 *   1) `organizations.transformation_partner_id = partnerId` (canonical)
 *   2) `profiles.{partnerId}.data.assignedOrganizations` (mirror written by the
 *      admin assign-partner RPC; covers any org whose canonical write lagged)
 * The two are unioned so the dropdown never misses an assignment.
 */
export const listenToPartnerAssignedOrgIds = (
  partnerId: string,
  onChange: (orgIds: string[]) => void,
  onError?: (error: unknown) => void,
): (() => void) => {
  if (!partnerId) {
    onChange([])
    return () => {}
  }

  let cancelled = false

  const load = async () => {
    try {
      const [orgsRes, profileRes] = await Promise.all([
        supabase
          .from('organizations')
          .select('id')
          .eq('transformation_partner_id', partnerId)
          .in('status', ASSIGNMENT_STATUSES),
        supabase.from('profiles').select('data').eq('id', partnerId).maybeSingle(),
      ])

      if (cancelled) return
      if (orgsRes.error) throw orgsRes.error
      if (profileRes.error) throw profileRes.error

      const fromOrgs = (orgsRes.data as AssignedOrgRow[] | null)?.map((r) => r.id) ?? []
      const rawAssigned = (profileRes.data as PartnerProfileDataRow | null)?.data?.assignedOrganizations
      const fromProfile = Array.isArray(rawAssigned)
        ? rawAssigned
            .map((entry) =>
              typeof entry === 'string'
                ? entry.trim()
                : ((entry as { organizationId?: string })?.organizationId ?? '').trim(),
            )
            .filter(Boolean)
        : []

      onChange(normalizeKeys([...fromOrgs, ...fromProfile]))
    } catch (error) {
      if (cancelled) return
      onError?.(error)
    }
  }

  void load()

  const channel = supabase
    .channel(`partner_assigned_orgs_${++assignedOrgsChannelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => {
      void load()
    })
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}

// ============================================================================
// Partner -> per-organization member stats (activeUsers, newThisWeek)
// ============================================================================

export interface OrgStatCounts {
  activeUsers: number
  newThisWeek: number
}

type OrgStatProfileRow = {
  id: string
  organization_id: string | null
  company_code: string | null
  created_at: string | null
}

const lowerKey = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Per-organization member counts, computed from Supabase `profiles`. Replaces
 * the old Firestore `organizationStatsService` path: after the auth cutover the
 * React app has no Firebase session, so those `onSnapshot(users)` listeners
 * failed on every (re)subscribe and churned the Firestore SDK into the
 * `FIRESTORE INTERNAL ASSERTION FAILED (b815)` crash that made the dashboard
 * twitch.
 *
 * `activeUsers` is the member count for the org (profiles has no status column
 * yet - matches the super-admin metrics definition in supabaseSuperAdminService).
 * `newThisWeek` counts profiles created in the last 7 days. Results are keyed by
 * BOTH the org id and the org code (lowercased) so the caller can resolve stats
 * by whichever key its org record carries.
 */
export const listenToPartnerOrgStats = (
  orgKeys: string[],
  onChange: (stats: Map<string, OrgStatCounts>) => void,
  onError?: (error: unknown) => void,
): (() => void) => {
  const keys = normalizeKeys(orgKeys)
  if (keys.length === 0) {
    onChange(new Map())
    return () => {}
  }

  let cancelled = false

  const load = async () => {
    try {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoIso = weekAgo.toISOString()

      const rows = await selectAllPages<OrgStatProfileRow>(() => {
        return supabase
          .from('profiles')
          .select('id, organization_id, company_code, created_at')
          .or(buildOrFilter(keys))
          .order('id', { ascending: true }) as unknown as {
          range: (
            from: number,
            to: number,
          ) => PromiseLike<{ data: OrgStatProfileRow[] | null; error: unknown }>
        }
      })

      if (cancelled) return

      const stats = new Map<string, OrgStatCounts>()
      const bump = (key: string | null, isNew: boolean) => {
        if (!key) return
        const current = stats.get(key) ?? { activeUsers: 0, newThisWeek: 0 }
        current.activeUsers += 1
        if (isNew) current.newThisWeek += 1
        stats.set(key, current)
      }

      rows.forEach((row) => {
        const isNew = Boolean(row.created_at && row.created_at >= weekAgoIso)
        // A profile belongs to one org; bump both its id- and code-keyed buckets
        // so the caller can look up stats by either key (id and code buckets hold
        // the same per-org count, and the caller only reads one of them).
        bump(lowerKey(row.organization_id), isNew)
        bump(lowerKey(row.company_code), isNew)
      })

      onChange(stats)
    } catch (error) {
      if (cancelled) return
      onError?.(error)
    }
  }

  void load()

  const channel = supabase
    .channel(`partner_org_stats_${++orgStatsChannelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      void load()
    })
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}

// ============================================================================
// Partner -> member profiles
// ============================================================================

export interface PartnerMemberDoc {
  id: string
  /** Mirrors the Firestore doc-wrapper contract the dashboard already consumes. */
  data: () => Record<string, unknown>
}

type SupabaseProfileRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  role: string | null
  membership_status: string | null
  organization_id: string | null
  company_id: string | null
  company_code: string | null
  journey_type: string | null
  journey_start_date: string | null
  current_week: number | null
  total_points: number | null
  has_completed_personality_test: boolean | null
  has_completed_values_test: boolean | null
  data: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

const PROFILE_COLUMNS =
  'id, email, first_name, last_name, full_name, role, membership_status, ' +
  'organization_id, company_id, company_code, journey_type, journey_start_date, ' +
  'current_week, total_points, has_completed_personality_test, ' +
  'has_completed_values_test, data, created_at, updated_at'

/**
 * Maps a Supabase profile row to the loosely-typed object the partner dashboard
 * reads (it accepts both camelCase and snake_case aliases). The `data` jsonb is
 * spread first so long-tail keys not yet promoted to columns (onboardingComplete,
 * adminNotes, nudgeEnabled, riskReasons, nudgeResponseScore, displayName, ...)
 * still flow through; explicit columns then override.
 */
const mapMemberRow = (row: SupabaseProfileRow): Record<string, unknown> => {
  const jsonb = (row.data ?? {}) as Record<string, unknown>
  return {
    ...jsonb,
    id: row.id,
    email: row.email ?? '',
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    full_name: row.full_name ?? undefined,
    fullName: row.full_name ?? undefined,
    role: row.role ?? undefined,
    membershipStatus: row.membership_status ?? undefined,
    organizationId: row.organization_id ?? undefined,
    organization_id: row.organization_id ?? undefined,
    companyId: row.company_id ?? undefined,
    companyCode: row.company_code ?? undefined,
    company_code: row.company_code ?? undefined,
    journeyType: row.journey_type ?? (jsonb.journeyType as string | undefined),
    programStartDate: row.journey_start_date ?? undefined,
    program_start_date: row.journey_start_date ?? undefined,
    currentWeek: row.current_week ?? undefined,
    totalPoints: row.total_points ?? 0,
    total_points: row.total_points ?? 0,
    hasCompletedPersonalityTest: row.has_completed_personality_test ?? undefined,
    hasCompletedValuesTest: row.has_completed_values_test ?? undefined,
    createdAt: row.created_at ?? undefined,
    created_at: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

const buildOrFilter = (keys: string[]): string => {
  // PostgREST `.or()` expression: match either the org id or the company code.
  const list = `(${keys.map((k) => `"${k.replace(/"/g, '')}"`).join(',')})`
  return `organization_id.in.${list},company_code.in.${list}`
}

/**
 * Loads the member profiles a partner can see, scoped to their assigned org
 * keys (ids and/or codes). Pass `{ all: true }` for super_admin / debug to load
 * every profile. Returns Firestore-style doc wrappers so the dashboard's
 * existing filter/hydrate pipeline is unchanged.
 */
export const listenToPartnerMembers = (
  orgKeys: string[],
  onChange: (docs: PartnerMemberDoc[]) => void,
  onError?: (error: unknown) => void,
  options?: { all?: boolean },
): (() => void) => {
  const keys = normalizeKeys(orgKeys)
  const loadAll = options?.all === true

  if (!loadAll && keys.length === 0) {
    onChange([])
    return () => {}
  }

  let cancelled = false

  const load = async () => {
    try {
      const rows = await selectAllPages<SupabaseProfileRow>(() => {
        let q = supabase.from('profiles').select(PROFILE_COLUMNS).order('id', { ascending: true })
        if (!loadAll) q = q.or(buildOrFilter(keys))
        return q as unknown as {
          range: (
            from: number,
            to: number,
          ) => PromiseLike<{ data: SupabaseProfileRow[] | null; error: unknown }>
        }
      })

      if (cancelled) return
      onChange(rows.map((row) => ({ id: row.id, data: () => mapMemberRow(row) })))
    } catch (error) {
      if (cancelled) return
      onError?.(error)
    }
  }

  void load()

  const channel = supabase
    .channel(`partner_members_${++membersChannelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      void load()
    })
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}
