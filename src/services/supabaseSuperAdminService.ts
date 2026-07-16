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
  JourneyBucket,
  JourneyProgressAggregate,
  JourneyProgressLearner,
  OrganizationLead,
  OrganizationRecord,
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'
import type { UserProfileExtended } from '@/services/userProfileService'
import { calculateUserRiskStatus, getProgramWeekNumber } from '@/utils/partnerProgress'
import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'

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

// Learner counts by role for the Admin Oversight cards. free_user / paid_member
// are the two learner roles (see CLAUDE.md role list); admins load the
// partner/mentor/ambassador counts from their own list.
export const fetchUserRoleCounts = async (): Promise<{ free: number; paid: number }> => {
  const [free, paid] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'free_user'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'paid_member'),
  ])
  if (free.error) throw new Error(free.error.message)
  if (paid.error) throw new Error(paid.error.message)
  return { free: free.count ?? 0, paid: paid.count ?? 0 }
}

// Full role breakdown for the User Management summary cards
// (free / paid / partners / mentors / ambassadors), counted from profiles.role.
export const fetchRoleBreakdownCounts = async (): Promise<{
  free: number
  paid: number
  partners: number
  mentors: number
  ambassadors: number
}> => {
  const countByRole = (role: string) =>
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', role)
  const [free, paid, partners, mentors, ambassadors] = await Promise.all([
    countByRole('free_user'),
    countByRole('paid_member'),
    countByRole('partner'),
    countByRole('mentor'),
    countByRole('ambassador'),
  ])
  const firstError =
    free.error || paid.error || partners.error || mentors.error || ambassadors.error
  if (firstError) throw new Error(firstError.message)
  return {
    free: free.count ?? 0,
    paid: paid.count ?? 0,
    partners: partners.count ?? 0,
    mentors: mentors.count ?? 0,
    ambassadors: ambassadors.count ?? 0,
  }
}

export const listenToDashboardMetrics = (
  onChange: (metrics: SuperAdminDashboardMetrics) => void,
  _filters?: unknown,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const since30 = windowStart(30).toISOString()
      const [orgs, total, paid, recent, engaged] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('membership_status', 'paid'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since30),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('total_points', 0),
      ])
      const firstError = orgs.error || total.error || paid.error || recent.error || engaged.error
      if (firstError) throw new Error(firstError.message)
      if (cancelled) return

      const organizationCount = orgs.count ?? 0
      // No suspension/status column on profiles yet, so "active" = the full
      // registered user base (best available signal until a status column lands).
      const totalMembers = total.count ?? 0
      // Real engagement: the share of users who have earned any points.
      const engagementRate = totalMembers > 0 ? (engaged.count ?? 0) / totalMembers : 0
      onChange({
        organizationCount,
        managedCompanies: organizationCount,
        paidMembers: paid.count ?? 0,
        activeMembers: totalMembers,
        engagementRate,
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

/** Roles that are not learners and so are excluded from journey progress. */
const NON_LEARNER_ROLES = new Set([
  'partner',
  'super_admin',
  'admin',
  'company_admin',
  'mentor',
  'ambassador',
])

type ProgressRow = {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  role?: string | null
  organization_id?: string | null
  journey_type?: string | null
  journey_start_date?: string | null
  current_week?: number | null
  total_points?: number | null
}

const PROGRESS_COLS =
  'id, full_name, first_name, last_name, email, role, organization_id, ' +
  'journey_type, journey_start_date, current_week, total_points'

/**
 * Internal / test accounts that should not count as real learners: anyone on
 * the @t4leader.com domain (staff) or whose name/email looks like a test or
 * demo account. Keeps the learner numbers honest without hiding real users.
 */
const isInternalOrTest = (row: ProgressRow): boolean => {
  const email = (row.email ?? '').toLowerCase()
  if (email.endsWith('@t4leader.com')) return true
  const haystack = `${email} ${[row.full_name, row.first_name, row.last_name].filter(Boolean).join(' ')}`.toLowerCase()
  return haystack.includes('test') || haystack.includes('demo')
}

const emptyJourneyProgress = (): JourneyProgressAggregate => ({
  total: 0,
  completed: 0,
  onTrack: 0,
  needsNudge: 0,
  behind: 0,
  critical: 0,
  notStarted: 0,
  learners: [],
})

/**
 * Classifies every learner into a single journey-progress bucket using the same
 * pace-ratio rules partners see, then returns the counts plus a "needs
 * attention" list of the most-delayed learners (org name joined in).
 *
 * Reads Supabase `profiles` + `organizations` once (admin metrics don't need
 * realtime) and returns a cancel function, matching the other listeners here.
 */
export const listenToJourneyProgress = (
  onChange: (aggregate: JourneyProgressAggregate) => void,
  onError?: ErrCb,
): Unsub => {
  let cancelled = false
  void (async () => {
    try {
      const [profilesRes, orgsRes] = await Promise.all([
        supabase.from('profiles').select(PROGRESS_COLS),
        supabase.from('organizations').select('id, name'),
      ])
      if (profilesRes.error) throw new Error(profilesRes.error.message)
      if (cancelled) return

      const orgNames = new Map<string, string>()
      ;(orgsRes.data ?? []).forEach((o) => {
        const row = o as { id?: string; name?: string }
        if (row.id) orgNames.set(row.id, row.name ?? '')
      })

      const agg = emptyJourneyProgress()
      const learners: JourneyProgressLearner[] = []

      for (const raw of (profilesRes.data ?? []) as unknown as ProgressRow[]) {
        const role = raw.role ?? undefined
        if (role && NON_LEARNER_ROLES.has(role)) continue
        if (isInternalOrTest(raw)) continue

        agg.total += 1

        const journeyType = raw.journey_type ?? undefined
        const totalPoints = raw.total_points ?? 0
        const currentWeek = raw.current_week ?? getProgramWeekNumber(raw.journey_start_date ?? undefined)

        let bucket: JourneyBucket
        let deficit = 0

        if (!journeyType || (totalPoints === 0 && currentWeek <= 1)) {
          // Not started: no journey assigned, or no progress at the very start.
          bucket = 'notStarted'
        } else {
          const meta = JOURNEY_META[journeyType as JourneyType]
          const passMark = meta?.passMarkPoints ?? 0
          if (passMark && totalPoints >= passMark) {
            bucket = 'completed'
          } else {
            const risk = calculateUserRiskStatus(currentWeek, {}, {}, undefined, {
              journeyType,
              totalPoints,
            })
            deficit = risk.points_deficit ?? 0
            bucket =
              risk.level === 'critical'
                ? 'critical'
                : risk.level === 'behind'
                  ? 'behind'
                  : risk.level === 'warning'
                    ? 'needsNudge'
                    : 'onTrack'
          }
        }

        agg[bucket] += 1

        const name =
          raw.full_name ||
          [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() ||
          raw.email ||
          'Unknown learner'
        learners.push({
          id: raw.id,
          name,
          email: raw.email ?? undefined,
          organization: raw.organization_id ? orgNames.get(raw.organization_id) || undefined : undefined,
          journeyType,
          currentWeek,
          totalPoints,
          bucket,
          deficit,
        })
      }

      // Most-behind first within any group, so an opened list leads with the worst.
      learners.sort((a, b) => b.deficit - a.deficit)
      agg.learners = learners

      if (!cancelled) onChange(agg)
    } catch (err) {
      if (!cancelled) onError?.(toErr(err, 'Failed to load learner journey progress'))
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
  total_points?: number | null
  company_id?: string | null
  organization_id?: string | null
  company_code?: string | null
  company_name?: string | null
  membership_status?: string | null
  transformation_tier?: string | null
  account_status?: string | null
  journey_type?: string | null
  assigned_organizations?: unknown
  data?: Record<string, unknown> | null
}

// The Users Management tab needs the org/membership/tier fields to filter and
// display rows. mapAdminUser returns this superset (assignable to
// AdminUserRecord for the admin-oversight consumer) so the tab's mapper can read
// companyId/membershipStatus/etc. instead of getting undefined for every user.
type ManagedProfileRecord = AdminUserRecord & {
  companyId?: string | null
  companyCode?: string | null
  companyName?: string | null
  membershipStatus?: string | null
  transformationTier?: string | null
  journeyType?: string | null
}

const ADMIN_ROLES = ['super_admin', 'partner', 'mentor', 'ambassador']

const mapAdminUser = (row: ProfileRow): ManagedProfileRecord => {
  const data = (row.data ?? {}) as Record<string, unknown>
  // Read a field from its snake_case column, else the camelCase key in `data`.
  const str = (col: unknown, key: string): string | null => {
    if (typeof col === 'string' && col) return col
    const fromData = data[key]
    return typeof fromData === 'string' && fromData ? fromData : null
  }

  const assignedOrganizations = Array.isArray(row.assigned_organizations)
    ? (row.assigned_organizations.filter(Boolean) as string[])
    : Array.isArray(data.assignedOrganizations)
      ? (data.assignedOrganizations as string[])
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
    // Org/membership/tier fields the Users Management tab filters and displays.
    // company_id is the org FK the org filter matches; fall back to
    // organization_id for rows stamped by the join RPC, then the data jsonb.
    companyId: row.company_id ?? row.organization_id ?? str(undefined, 'companyId') ?? str(undefined, 'organizationId'),
    companyCode: str(row.company_code, 'companyCode'),
    companyName: str(row.company_name, 'companyName'),
    membershipStatus: str(row.membership_status, 'membershipStatus'),
    transformationTier: str(row.transformation_tier, 'transformationTier'),
    journeyType: str(row.journey_type, 'journeyType'),
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

// Select every column so this never 400s on a column that isn't in the profiles
// schema (e.g. account_status does not exist). mapAdminUser then reads each field
// from its column when present, or from the `data` jsonb as a fallback.
const PROFILE_COLS = '*'

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

// Single profile by id for the User Profile page. Replaces the Firestore
// fetchUserProfileById (which throws "Missing or insufficient permissions" under
// Supabase auth). Spreads the `data` jsonb first so long-tail keys (coreValues,
// notes, socialLinks, milestonesProgress, personalityType, ...) flow through,
// then overlays the first-class columns.
export const fetchUserProfileById = async (
  userId: string,
): Promise<UserProfileExtended | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as Record<string, unknown>
  const jsonb = (row.data as Record<string, unknown> | null) ?? {}
  const str = (col: unknown, key: string): string | undefined => {
    if (typeof col === 'string' && col) return col
    const v = jsonb[key]
    return typeof v === 'string' && v ? v : undefined
  }
  const num = (col: unknown, key: string): number | undefined => {
    if (typeof col === 'number') return col
    const v = jsonb[key]
    return typeof v === 'number' ? v : undefined
  }
  const fullName =
    (row.full_name as string) ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    (jsonb.fullName as string) ||
    undefined
  const assignedOrganizations = Array.isArray(row.assigned_organizations)
    ? (row.assigned_organizations as string[]).filter(Boolean)
    : Array.isArray(jsonb.assignedOrganizations)
      ? (jsonb.assignedOrganizations as string[])
      : undefined

  const nowIso = new Date().toISOString()
  return {
    ...(jsonb as Partial<UserProfileExtended>),
    id: row.id as string,
    firstName: str(row.first_name, 'firstName') ?? '',
    lastName: str(row.last_name, 'lastName') ?? '',
    fullName: fullName ?? '',
    email: (row.email as string) ?? '',
    role: (row.role as UserProfileExtended['role']) ?? (jsonb.role as UserProfileExtended['role']),
    membershipStatus: str(row.membership_status, 'membershipStatus') as UserProfileExtended['membershipStatus'],
    accountStatus: str(row.account_status, 'accountStatus'),
    transformationTier: str(row.transformation_tier, 'transformationTier'),
    companyId: str(row.company_id, 'companyId') ?? str(row.organization_id, 'organizationId') ?? null,
    companyCode: str(row.company_code, 'companyCode') ?? null,
    companyName: str(row.company_name, 'companyName') ?? null,
    organizationId: str(row.organization_id, 'organizationId') ?? null,
    journeyType: (str(row.journey_type, 'journeyType') ?? '') as UserProfileExtended['journeyType'],
    currentWeek: num(row.current_week, 'currentWeek'),
    programDurationWeeks: num(row.program_duration_weeks, 'programDurationWeeks'),
    totalPoints: num(row.total_points, 'totalPoints') ?? 0,
    level: num(row.level, 'level') ?? 0,
    assignedOrganizations,
    createdAt: (row.created_at as string) ?? nowIso,
    updatedAt: (row.updated_at as string) ?? nowIso,
    registrationDate: (row.created_at as string) ?? (jsonb.registrationDate as string) ?? undefined,
    lastActive: (jsonb.lastActiveAt as string) ?? (jsonb.last_active_at as string) ?? undefined,
    lastActiveAt: (jsonb.lastActiveAt as string) ?? (jsonb.last_active_at as string) ?? undefined,
  } as UserProfileExtended
}

const mapOrganization = (row: Record<string, unknown>): OrganizationRecord => {
  const settings = (row.settings as Record<string, unknown> | null) ?? {}
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    code: (row.code as string) ?? '',
    status: ((row.status as string) ?? 'active') as OrganizationRecord['status'],
    archived: Boolean(settings.archived),
    archivedAt: (settings.archivedAt as string) ?? undefined,
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
    // Course assignments + description live in the settings jsonb. Read them
    // back so the Edit Organization modal can show which courses were selected
    // per window instead of "Unassigned".
    description: (settings.description as string) ?? undefined,
    courseAssignments: (settings.courseAssignments as string[]) ?? undefined,
    monthlyCourseAssignments: (settings.monthlyCourseAssignments as Record<string, string>) ?? undefined,
    courseAssignmentStructure:
      (settings.courseAssignmentStructure as OrganizationRecord['courseAssignmentStructure']) ?? undefined,
  }
}

export interface OrgMemberRecord {
  id: string
  name: string
  email?: string
  role: string
  membershipStatus?: string | null
  createdAt?: string | null
  totalPoints?: number | null
  lastActiveAt?: string | null
}

// Members of an organization: profiles linked by company_id / organization_id /
// company_code. Used by the Edit Organization modal and the org detail page to
// show who belongs to it.
export const fetchOrganizationMembers = async (org: {
  id?: string | null
  code?: string | null
}): Promise<OrgMemberRecord[]> => {
  const orClauses: string[] = []
  if (org.id) orClauses.push(`company_id.eq.${org.id}`, `organization_id.eq.${org.id}`)
  if (org.code) orClauses.push(`company_code.eq.${org.code}`)
  if (!orClauses.length) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, first_name, last_name, email, role, membership_status, created_at, total_points, data')
    .or(orClauses.join(','))
    .order('full_name', { ascending: true })
  if (error) throw new Error(error.message)

  const seen = new Set<string>()
  const members: OrgMemberRecord[] = []
  for (const raw of (data ?? []) as unknown as ProfileRow[]) {
    if (!raw.id || seen.has(raw.id)) continue
    seen.add(raw.id)
    const name =
      raw.full_name ||
      [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() ||
      raw.email ||
      'Unknown'
    // Activity isn't a first-class column; it's tracked inside the `data` jsonb
    // (lastActiveAt / last_active_at), the same source the partner dashboard reads.
    const jsonb = (raw.data ?? {}) as Record<string, unknown>
    const lastActiveRaw = jsonb.lastActiveAt ?? jsonb.last_active_at
    members.push({
      id: raw.id,
      name,
      email: raw.email ?? undefined,
      role: raw.role ?? 'free_user',
      membershipStatus: raw.membership_status ?? null,
      createdAt: raw.created_at ?? null,
      totalPoints: raw.total_points ?? null,
      lastActiveAt: typeof lastActiveRaw === 'string' ? lastActiveRaw : null,
    })
  }
  return members
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
