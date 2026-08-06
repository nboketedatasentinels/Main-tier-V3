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
  createdAt: string
}

type ImpactLogRow = {
  id: string
  uid: string
  company_id?: string | null
  title?: string | null
  description?: string | null
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
    date: row.activity_date || data.date || '',
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

export type CreateImpactLogInput = Omit<ImpactLogRecord, 'id'>

export async function createImpactLog(entry: CreateImpactLogInput): Promise<ImpactLogRecord> {
  const { data, error } = await supabase
    .from('impact_logs')
    .insert({
      uid: entry.userId,
      company_id: entry.companyId ?? null,
      title: entry.title || 'Impact Activity',
      description: entry.description || '',
      activity_date: entry.date || null,
      hours: entry.hours ?? 0,
      people_impacted: entry.peopleImpacted ?? 0,
      usd_value: entry.usdValue ?? 0,
      verification_status: entry.verificationStatus || 'pending',
      data: entry,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
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
