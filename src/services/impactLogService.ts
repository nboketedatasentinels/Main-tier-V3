/**
 * Learner Impact Log CRUD on Supabase `impact_logs` (migration 0049).
 *
 * Previously wrote to Firestore `impact_logs`, which fails after the Supabase
 * auth cutover ("Missing or insufficient permissions") because there is no
 * Firebase Auth session for Firestore rules.
 */
import { supabase } from '@/services/supabase'

/** Shape the Impact Log UI works with (camelCase). */
export type ImpactLogRecord = {
  id: string
  userId: string
  sourcePlatform?: 'transformation_tier' | 't4l_partner'
  sourceRecordId?: string
  sourceSyncedAt?: string
  readOnly?: boolean
  companyId?: string
  title: string
  description: string
  categoryGroup: 'esg' | 'business'
  /** New Impact Log v3: activity | claim | esg */
  entryKind?: 'activity' | 'claim' | 'esg'
  esgCategory?: string
  activityType?: string
  businessCategory?: string
  businessActivity?: string
  liftPillars?: string[]
  date: string
  hours: number
  peopleImpacted: number
  usdValue?: number
  outcomeLabel?: string
  verificationLevel: string
  verifierEmail?: string
  verifierName?: string
  verifierRole?: 'verifier'
  verificationStatus?: 'pending' | 'approved' | 'rejected'
  evidenceLink?: string
  transformationPartnerId?: string
  transformationPartnerName?: string
  partnerValidationStatus?: 'active' | 'inactive' | 'unknown'
  points: number
  impactValue: number
  scp: number
  verificationMultiplier: number
  unitRateApplied?: number
  volHourRateApplied?: number
  sasbTopic?: string
  usdValueSource?: 'auto' | 'manual'
  /** Improvement-claim payload (jsonb). */
  claim?: Record<string, unknown>
  claimStatus?: string
  /** Email confirmation routing for improvement claims. */
  needsFinance?: boolean
  ownerEmail?: string
  financeName?: string
  financeEmail?: string
  esgMetric?: string
  esgQty?: number
  auditTrail?: string[]
  createdAt: string
}

type ImpactLogRow = {
  id: string
  uid: string
  company_id?: string | null
  title?: string | null
  description?: string | null
  date?: string | null
  activity_date?: string | null
  hours?: number | null
  people_impacted?: number | null
  usd_value?: number | null
  verification_status?: string | null
  data?: Record<string, unknown> | null
  created_at?: string | null
}

const toRecord = (row: ImpactLogRow): ImpactLogRecord => {
  const data = (row.data && typeof row.data === 'object' ? row.data : {}) as Partial<ImpactLogRecord>
  return {
    ...data,
    id: row.id,
    userId: row.uid,
    companyId: row.company_id ?? data.companyId,
    title: row.title || data.title || 'Impact Activity',
    description: row.description ?? data.description ?? '',
    date: row.activity_date || row.date || data.date || '',
    hours: Number(row.hours ?? data.hours ?? 0),
    peopleImpacted: Number(row.people_impacted ?? data.peopleImpacted ?? 0),
    usdValue: Number(row.usd_value ?? data.usdValue ?? 0),
    verificationStatus:
      (row.verification_status as ImpactLogRecord['verificationStatus']) ||
      data.verificationStatus ||
      'pending',
    createdAt: row.created_at || data.createdAt || new Date().toISOString(),
    categoryGroup: data.categoryGroup || 'esg',
    verificationLevel: data.verificationLevel || 'Tier 1: Self-Reported',
    points: Number(data.points ?? 0),
    impactValue: Number(data.impactValue ?? 0),
    scp: Number(data.scp ?? 0),
    verificationMultiplier: Number(data.verificationMultiplier ?? 1),
  }
}

export type CreateImpactLogInput = Omit<ImpactLogRecord, 'id' | 'createdAt'> & {
  createdAt?: string
}

export async function createImpactLog(entry: CreateImpactLogInput): Promise<ImpactLogRecord> {
  const id = crypto.randomUUID()
  const { data, error } = await supabase
    .from('impact_logs')
    .insert({
      id,
      uid: entry.userId,
      company_id: entry.companyId ?? null,
      title: entry.title || 'Impact Activity',
      description: entry.description || '',
      // Legacy column is `date`; newer readers also use `activity_date`.
      date: entry.date || null,
      activity_date: entry.date || null,
      hours: entry.hours ?? 0,
      people_impacted: entry.peopleImpacted ?? 0,
      usd_value: entry.usdValue ?? 0,
      points: entry.points ?? 0,
      impact_value: entry.impactValue ?? 0,
      category_group: entry.categoryGroup || null,
      esg_category: entry.esgCategory || null,
      activity_type: entry.activityType || null,
      business_category: entry.businessCategory || null,
      business_activity: entry.businessActivity || null,
      verification_level: entry.verificationLevel || null,
      verification_status: entry.verificationStatus || 'pending',
      source_platform: entry.sourcePlatform || 'transformation_tier',
      read_only: entry.readOnly ?? false,
      data: entry,
    })
    .select('*')
    .single()

  if (error) {
    const msg = error.message || ''
    const hint = (error as { hint?: string }).hint || ''
    if (msg.includes('impact_log_free_limit_reached') || hint.includes('2 Impact Log')) {
      throw new Error('impact_log_free_limit_reached')
    }
    throw new Error(msg)
  }
  return toRecord(data as ImpactLogRow)
}

export async function listMyImpactLogs(userId: string): Promise<ImpactLogRecord[]> {
  const { data, error } = await supabase
    .from('impact_logs')
    .select('*')
    .eq('uid', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as ImpactLogRow[] | null)?.map(toRecord) ?? []
}

export async function listCompanyImpactLogs(companyId: string): Promise<ImpactLogRecord[]> {
  const { data, error } = await supabase
    .from('impact_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as ImpactLogRow[] | null)?.map(toRecord) ?? []
}

/** Platform-wide list for T4L admin sector rollup (RLS: partner/admin). */
export async function listAllImpactLogs(limit = 2000): Promise<ImpactLogRecord[]> {
  const { data, error } = await supabase
    .from('impact_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data as ImpactLogRow[] | null)?.map(toRecord) ?? []
}

export async function updateImpactLogVerificationStatus(
  id: string,
  status: NonNullable<ImpactLogRecord['verificationStatus']>,
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from('impact_logs')
    .select('data')
    .eq('id', id)
    .maybeSingle()
  if (readError) throw new Error(readError.message)

  const prev = (existing?.data && typeof existing.data === 'object' ? existing.data : {}) as Record<
    string,
    unknown
  >

  const { error } = await supabase
    .from('impact_logs')
    .update({
      verification_status: status,
      data: { ...prev, verificationStatus: status },
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/** Merge fields into impact_logs.data (+ optional top-level columns). */
export async function patchImpactLog(
  id: string,
  patch: Partial<ImpactLogRecord> & { auditLine?: string },
): Promise<ImpactLogRecord> {
  const { data: existing, error: readError } = await supabase
    .from('impact_logs')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (readError) throw new Error(readError.message)
  if (!existing) throw new Error('Impact log not found.')

  const prev = (
    existing.data && typeof existing.data === 'object' ? existing.data : {}
  ) as Record<string, unknown>
  const { auditLine, ...rest } = patch
  const audit = Array.isArray(prev.auditTrail) ? [...(prev.auditTrail as string[])] : []
  if (auditLine) audit.push(auditLine)

  const nextData = {
    ...prev,
    ...rest,
    claim: rest.claim ? { ...(prev.claim as object), ...rest.claim } : prev.claim,
    auditTrail: audit,
  }

  const updateRow: Record<string, unknown> = {
    data: nextData,
    updated_at: new Date().toISOString(),
  }
  if (rest.usdValue != null) updateRow.usd_value = rest.usdValue
  if (rest.verificationStatus) updateRow.verification_status = rest.verificationStatus
  if (rest.title) updateRow.title = rest.title
  if (rest.description != null) updateRow.description = rest.description

  const { data, error } = await supabase
    .from('impact_logs')
    .update(updateRow)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return toRecord(data as ImpactLogRow)
}

export async function deleteImpactLog(id: string): Promise<void> {
  const { error } = await supabase.from('impact_logs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function countMyImpactLogs(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('impact_logs')
    .select('id', { count: 'exact', head: true })
    .eq('uid', userId)

  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Lifetime Impact Log submits (survives deletes). Falls back to live row count
 * until migration 0082 is applied / backfilled.
 */
export async function getMyImpactLogLifetimeCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('impact_log_lifetime_count')
    .eq('id', userId)
    .maybeSingle()

  if (!error && data && typeof (data as { impact_log_lifetime_count?: unknown }).impact_log_lifetime_count === 'number') {
    return (data as { impact_log_lifetime_count: number }).impact_log_lifetime_count
  }

  return countMyImpactLogs(userId)
}
