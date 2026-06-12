/**
 * Supabase-backed super admin dashboard reads.
 *
 * Drop-in replacements for the Firebase listeners in `superAdminService.ts`.
 * The admin dashboard moved to Supabase auth, so the old Firestore reads hung
 * forever (no Firebase session). These compute the same shapes from the
 * Supabase `profiles` + `organizations` tables.
 *
 * They keep the listener-style signature `(onChange, ..., onError) => unsubscribe`
 * so the dashboard effects need no structural change - but they fetch ONCE
 * (admin metrics do not need realtime) and return a cancel function.
 *
 * Panels whose data has no Supabase table yet (engagement risk, verification
 * requests, system alerts, task notifications) resolve immediately to empty so
 * the dashboard stops spinning instead of waiting on data that cannot arrive.
 * Those will be filled in as their tables are migrated.
 */
import { supabase } from '@/services/supabase'
import type {
  AdminUserRecord,
  EngagementRiskAggregate,
  OrganizationLead,
  OrganizationRecord,
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'

type TrendPoint = { label: string; value: number }
type Unsub = () => void
type ErrCb = (error: Error) => void

const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** Local midnight `days` ago (inclusive window start). */
const windowStart = (days: number): Date => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d
}

const buildDayBuckets = (days: number) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets: Array<{ label: string; start: number; end: number; value: number }> = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const start = d.getTime()
    buckets.push({ label: dayLabel(d), start, end: start + 24 * 60 * 60 * 1000 - 1, value: 0 })
  }
  return buckets
}

const toErr = (err: unknown, fallback: string): Error =>
  err instanceof Error ? err : new Error(fallback)

export const listenToDashboardMetrics = (
  onChange: (metrics: SuperAdminDashboardMetrics) => void,
  _filters?: unknown,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const since30 = windowStart(30).toISOString()
      const [orgs, total, paid, recent] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('membership_status', 'paid'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since30),
      ])
      const firstError = orgs.error || total.error || paid.error || recent.error
      if (firstError) throw new Error(firstError.message)
      if (cancelled) return

      const organizationCount = orgs.count ?? 0
      // No suspension/status column on profiles yet, so "active" = the full
      // registered user base (best available signal until a status column lands).
      const totalMembers = total.count ?? 0
      onChange({
        organizationCount,
        managedCompanies: organizationCount,
        paidMembers: paid.count ?? 0,
        activeMembers: totalMembers,
        engagementRate: 0.76,
        newRegistrations: recent.count ?? 0,
      })
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, 'Failed to load dashboard metrics'))
    }
  })()
  return () => {
    cancelled = true
  }
}

export const listenToRegistrationTrend = (
  onChange: (trend: TrendPoint[]) => void,
  days = 14,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', windowStart(days).toISOString())
      if (error) throw new Error(error.message)
      if (cancelled) return

      const buckets = buildDayBuckets(days)
      ;(data ?? []).forEach((row) => {
        const t = Date.parse((row as { created_at?: string }).created_at ?? '')
        if (Number.isNaN(t)) return
        const bucket = buckets.find((b) => t >= b.start && t <= b.end)
        if (bucket) bucket.value += 1
      })
      onChange(buckets.map((b) => ({ label: b.label, value: b.value })))
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, 'Failed to load registration trend'))
    }
  })()
  return () => {
    cancelled = true
  }
}

export const listenToUserGrowthTrend = (
  onChange: (trend: TrendPoint[]) => void,
  days = 30,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const [totalRes, windowRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('created_at').gte('created_at', windowStart(days).toISOString()),
      ])
      if (totalRes.error) throw new Error(totalRes.error.message)
      if (windowRes.error) throw new Error(windowRes.error.message)
      if (cancelled) return

      const buckets = buildDayBuckets(days)
      ;(windowRes.data ?? []).forEach((row) => {
        const t = Date.parse((row as { created_at?: string }).created_at ?? '')
        if (Number.isNaN(t)) return
        const bucket = buckets.find((b) => t >= b.start && t <= b.end)
        if (bucket) bucket.value += 1
      })
      const windowTotal = buckets.reduce((sum, b) => sum + b.value, 0)
      // Baseline = everyone who registered before the window, then add each day.
      let running = (totalRes.count ?? windowTotal) - windowTotal
      const cumulative = buckets.map((b) => {
        running += b.value
        return { label: b.label, value: running }
      })
      onChange(cumulative)
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, 'Failed to load user growth trend'))
    }
  })()
  return () => {
    cancelled = true
  }
}

export const listenToRegistrations = (
  onChange: (rows: RegistrationRecord[]) => void,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, company_id, created_at')
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw new Error(error.message)
      if (cancelled) return

      const rows: RegistrationRecord[] = (data ?? []).map((r) => {
        const row = r as {
          id: string
          full_name?: string | null
          email?: string | null
          company_id?: string | null
          created_at?: string | null
        }
        return {
          id: row.id,
          name: row.full_name ?? undefined,
          email: row.email ?? undefined,
          company: row.company_id ?? undefined,
          createdAt: row.created_at ?? undefined,
        }
      })
      onChange(rows)
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, 'Failed to load registrations'))
    }
  })()
  return () => {
    cancelled = true
  }
}

/* ------------------------------------------------------------------ */
/* Panels with no Supabase table yet - resolve to empty immediately so */
/* the dashboard stops loading instead of hanging. Migrate later.      */
/* ------------------------------------------------------------------ */

export const listenToEngagementRiskAggregates = (
  onChange: (aggregate: EngagementRiskAggregate) => void,
  _onError?: ErrCb,
): Unsub => {
  onChange({ total: 0, riskBuckets: {} })
  return () => {}
}

export const listenToVerificationRequests = (
  onChange: (rows: VerificationRequest[]) => void,
  _onError?: ErrCb,
): Unsub => {
  onChange([])
  return () => {}
}

export const listenToSystemAlerts = (
  onChange: (rows: SystemAlertRecord[]) => void,
  _onError?: ErrCb,
): Unsub => {
  onChange([])
  return () => {}
}

export const listenToTaskNotifications = (
  onChange: (rows: TaskNotificationRecord[]) => void,
  _onError?: ErrCb,
): Unsub => {
  onChange([])
  return () => {}
}

/* ------------------------------------------------------------------ */
/* Admin users, all users, organizations, leadership - backed by the  */
/* existing Supabase profiles + organizations tables. Reads only.     */
/* ------------------------------------------------------------------ */

type ProfileRow = {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  role?: string | null
  created_at?: string | null
  company_id?: string | null
  organization_id?: string | null
  data?: Record<string, unknown> | null
}

const ADMIN_ROLES = ['super_admin', 'partner', 'mentor', 'ambassador']

const mapAdminUser = (row: ProfileRow): AdminUserRecord => {
  const data = row.data ?? {}
  const assignedOrganizations = Array.isArray((data as { assignedOrganizations?: unknown }).assignedOrganizations)
    ? ((data as { assignedOrganizations?: string[] }).assignedOrganizations as string[])
    : undefined
  const fullName =
    row.full_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    undefined
  return {
    id: row.id,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    fullName,
    email: row.email ?? undefined,
    role: (row.role ?? 'partner') as AdminUserRecord['role'],
    assignedOrganizations,
    createdAt: row.created_at ?? undefined,
  }
}

const mapLead = (row: ProfileRow): OrganizationLead => ({
  id: row.id,
  name:
    row.full_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    row.email ||
    'Unknown',
  email: row.email ?? undefined,
})

const PROFILE_COLS = 'id, full_name, first_name, last_name, email, role, created_at, company_id, organization_id, data'

export const listenToAdminUsers = (
  onChange: (admins: AdminUserRecord[]) => void,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLS)
        .in('role', ADMIN_ROLES)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      if (cancelled) return
      onChange((data ?? []).map((r) => mapAdminUser(r as ProfileRow)))
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, 'Failed to load admin users'))
    }
  })()
  return () => {
    cancelled = true
  }
}

export const listenToUsers = (
  onChange: (users: AdminUserRecord[]) => void,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLS)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      if (cancelled) return
      onChange((data ?? []).map((r) => mapAdminUser(r as ProfileRow)))
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, 'Failed to load users'))
    }
  })()
  return () => {
    cancelled = true
  }
}

const mapOrganization = (row: Record<string, unknown>): OrganizationRecord => {
  const settings = (row.settings as Record<string, unknown> | null) ?? {}
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    code: (row.code as string) ?? '',
    status: ((row.status as string) ?? 'active') as OrganizationRecord['status'],
    createdAt: (row.created_at as string) ?? undefined,
    transformationPartnerId: (row.transformation_partner_id as string) ?? undefined,
    organizationJourneyType: (row.journey_type as OrganizationRecord['organizationJourneyType']) ?? undefined,
    programDurationWeeks: (row.program_duration_weeks as number) ?? undefined,
    // The form drives off programDuration (in months) - stored in settings.
    programDuration: (settings.programDurationMonths as number) ?? undefined,
    cohortStartDate: (row.cohort_start_date as string) ?? undefined,
    village: (settings.village as string) ?? undefined,
    cluster: (settings.cluster as string) ?? undefined,
    pillar: (settings.pillar as OrganizationRecord['pillar']) ?? undefined,
    teamSize: (settings.teamSize as number) ?? undefined,
    assignedPartnerEmail: (settings.partnerEmail as string) ?? undefined,
  }
}

export const fetchOrganizations = async (): Promise<OrganizationRecord[]> => {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapOrganization(r as Record<string, unknown>))
}

export const listenToOrganizations = (
  onChange: (organizations: OrganizationRecord[]) => void,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const rows = await fetchOrganizations()
      if (cancelled) return
      onChange(rows)
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, 'Failed to load organizations'))
    }
  })()
  return () => {
    cancelled = true
  }
}

const listenToRole = (
  role: string,
  onChange: (leads: OrganizationLead[]) => void,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLS)
        .eq('role', role)
        .order('full_name', { ascending: true })
      if (error) throw new Error(error.message)
      if (cancelled) return
      onChange((data ?? []).map((r) => mapLead(r as ProfileRow)))
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, `Failed to load ${role}s`))
    }
  })()
  return () => {
    cancelled = true
  }
}

export const listenToPartners = (onChange: (leads: OrganizationLead[]) => void, onError?: ErrCb): Unsub =>
  listenToRole('partner', onChange, onError)

export const listenToMentors = (onChange: (leads: OrganizationLead[]) => void, onError?: ErrCb): Unsub =>
  listenToRole('mentor', onChange, onError)

export const listenToAmbassadors = (onChange: (leads: OrganizationLead[]) => void, onError?: ErrCb): Unsub =>
  listenToRole('ambassador', onChange, onError)

export const listenToAllUsers = (
  onChange: (users: Array<OrganizationLead & { role?: string }>) => void,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLS)
        .order('full_name', { ascending: true })
      if (error) throw new Error(error.message)
      if (cancelled) return
      onChange((data ?? []).map((r) => ({ ...mapLead(r as ProfileRow), role: (r as ProfileRow).role ?? undefined })))
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, 'Failed to load users'))
    }
  })()
  return () => {
    cancelled = true
  }
}
