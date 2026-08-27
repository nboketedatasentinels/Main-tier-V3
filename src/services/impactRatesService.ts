/**
 * Organisation / benchmark value rates for Impact Log valuation.
 */
import { supabase } from '@/services/supabase'
import { DEFAULT_IMPACT_RATES, type ImpactRateCard } from '@/config/impactValueEngine'

const showRatesKey = (companyId: string) => `t4l_impact_show_rates_${companyId}`

const SHOW_RATES_SETTING = 'showImpactRatesToLearners'

/** Whether practitioners may see dollar figures on the value register. */
export async function getShowRatesToLearners(companyId?: string | null): Promise<boolean> {
  if (!companyId) return false
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', companyId)
      .maybeSingle()
    if (error) throw error
    const settings = (data?.settings as Record<string, unknown> | null) ?? {}
    if (typeof settings[SHOW_RATES_SETTING] === 'boolean') {
      return settings[SHOW_RATES_SETTING] as boolean
    }
  } catch (err) {
    console.warn('[impactRates] could not read org rate visibility', err)
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(showRatesKey(companyId)) === '1'
  }
  return false
}

export async function setShowRatesToLearners(
  companyId: string | null | undefined,
  show: boolean,
): Promise<void> {
  if (!companyId) return
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(showRatesKey(companyId), show ? '1' : '0')
  }
  const { data, error: readErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', companyId)
    .maybeSingle()
  if (readErr) throw new Error(readErr.message)
  const settings = {
    ...((data?.settings as Record<string, unknown> | null) ?? {}),
    [SHOW_RATES_SETTING]: show,
  }
  const { error } = await supabase
    .from('organizations')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', companyId)
  if (error) throw new Error(error.message)
}

export type ImpactValueRateRow = ImpactRateCard & {
  status: 'Draft' | 'Published'
  companyId?: string | null
  currency?: string
}

type DbRow = {
  id: string
  company_id?: string | null
  status?: string | null
  scope?: string | null
  country?: string | null
  grade?: string | null
  currency?: string | null
  annual_cost?: number | null
  paid_hours?: number | null
  hourly?: number | null
  margin_per_unit?: number | null
  cost_per_defect?: number | null
  effective_from?: string | null
  source?: string | null
  approved_by?: string | null
}

const mapRow = (row: DbRow): ImpactValueRateRow => {
  const hours = Number(row.paid_hours ?? 1880) || 1880
  const annual = Number(row.annual_cost ?? 0)
  const hourly = Number(row.hourly ?? 0) || (hours > 0 ? annual / hours : 0)
  return {
    id: String(row.id),
    status: row.status === 'Draft' ? 'Draft' : 'Published',
    scope: row.scope === 'Global benchmark' ? 'Global benchmark' : 'Organisation',
    country: row.country || 'Botswana',
    grade: row.grade || 'Unnamed grade',
    currency: row.currency || 'USD',
    annualCost: annual,
    hours,
    hourly: Number(hourly.toFixed(2)),
    margin: Number(row.margin_per_unit ?? 0),
    defect: Number(row.cost_per_defect ?? 0),
    from: row.effective_from || '',
    source: row.source || '',
    approved: row.approved_by || '',
    companyId: row.company_id,
  }
}

export async function listImpactValueRates(companyId?: string | null): Promise<ImpactValueRateRow[]> {
  try {
    const q = supabase.from('impact_value_rates').select('*').order('created_at', { ascending: false })
    const { data, error } = await q
    if (error) throw error
    const rows = (data as DbRow[] | null)?.map(mapRow) ?? []
    if (rows.length === 0) {
      return DEFAULT_IMPACT_RATES.map((r) => ({ ...r, status: 'Published' as const }))
    }
    if (companyId) {
      const org = rows.filter((r) => r.scope === 'Organisation' && (!r.companyId || r.companyId === companyId))
      const glob = rows.filter((r) => r.scope === 'Global benchmark')
      const merged = [...org, ...glob]
      return merged.length ? merged : rows
    }
    return rows
  } catch (err) {
    console.warn('[impactRates] falling back to defaults', err)
    return DEFAULT_IMPACT_RATES.map((r) => ({ ...r, status: 'Published' as const }))
  }
}

export async function upsertImpactValueRate(params: {
  id?: string
  companyId?: string | null
  status: 'Draft' | 'Published'
  scope: 'Organisation' | 'Global benchmark'
  country: string
  grade: string
  annualCost: number
  hours: number
  margin: number
  defect: number
  source?: string
  approvedBy?: string
  createdBy?: string
}): Promise<ImpactValueRateRow> {
  const hours = params.hours || 1880
  const hourly = hours > 0 ? Number((params.annualCost / hours).toFixed(2)) : 0
  const payload = {
    company_id: params.companyId ?? null,
    status: params.status,
    scope: params.scope,
    country: params.country,
    grade: params.grade,
    annual_cost: params.annualCost,
    paid_hours: hours,
    hourly,
    margin_per_unit: params.margin,
    cost_per_defect: params.defect,
    effective_from: new Date().toISOString().slice(0, 10),
    source: params.source || 'Programme administrator',
    approved_by: params.approvedBy || 'Not yet approved',
    created_by: params.createdBy || null,
    updated_at: new Date().toISOString(),
  }

  if (params.id && !params.id.startsWith('R') && !params.id.startsWith('G')) {
    const { data, error } = await supabase
      .from('impact_value_rates')
      .update(payload)
      .eq('id', params.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapRow(data as DbRow)
  }

  const { data, error } = await supabase.from('impact_value_rates').insert(payload).select('*').single()
  if (error) throw new Error(error.message)
  return mapRow(data as DbRow)
}

export async function deleteImpactValueRate(id: string): Promise<void> {
  const { error } = await supabase.from('impact_value_rates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function publishImpactValueRate(id: string, approvedBy?: string): Promise<void> {
  const { error } = await supabase
    .from('impact_value_rates')
    .update({
      status: 'Published',
      approved_by: approvedBy || 'Programme administrator',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
