/**
 * Supabase-backed reads + writes for the partner at-risk intervention queue.
 *
 * Live schema (profiles FK):
 *   id text PK, uid uuid, partner_uid uuid, organization_code, name, target,
 *   reason, status, deadline, risk_verdicts text[], assigned_admin_name,
 *   escalation_reason, opened_at, status_changed_at, started_at, updated_at,
 *   data jsonb
 *
 * RLS: partner/admin via is_partner_or_admin().
 */
import { supabase } from '@/services/supabase'

export interface PartnerInterventionSummary {
  id: string
  name: string
  target: string
  reason: string
  status: 'active' | 'watch' | 'critical' | 'escalated'
  deadline: string
  organizationCode?: string
  userId?: string
  partnerId?: string
  openedAt?: string
  statusChangedAt?: string
  riskVerdicts?: string[]
  assignedAdminName?: string
  escalationReason?: string
}

type InterventionRow = {
  id: string
  name: string | null
  target: string | null
  reason: string | null
  status: string | null
  deadline: string | null
  organization_code: string | null
  uid: string | null
  partner_uid: string | null
  opened_at: string | null
  status_changed_at: string | null
  risk_verdicts: unknown
  assigned_admin_name: string | null
  escalation_reason: string | null
  data?: Record<string, unknown> | null
}

const SELECT_COLUMNS =
  'id, name, target, reason, status, deadline, organization_code, uid, ' +
  'partner_uid, opened_at, status_changed_at, risk_verdicts, assigned_admin_name, ' +
  'escalation_reason, data'

let interventionsChannelSeq = 0

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const toUuidOrNull = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return UUID_RE.test(trimmed) ? trimmed : null
}

const asError = (error: unknown): Error => {
  if (error instanceof Error) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || 'Request failed')
    const details =
      'details' in error && (error as { details?: unknown }).details
        ? ` (${String((error as { details?: unknown }).details)})`
        : ''
    return new Error(`${message}${details}`)
  }
  return new Error('Request failed')
}

const mapRow = (row: InterventionRow): PartnerInterventionSummary => {
  const verdicts = Array.isArray(row.risk_verdicts)
    ? (row.risk_verdicts as unknown[]).filter((v): v is string => typeof v === 'string')
    : undefined
  const nested = (row.data ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    name: row.name || 'Intervention',
    target: row.target || 'Assigned learner',
    reason: row.reason || 'Intervention in progress',
    status: (row.status as PartnerInterventionSummary['status']) || 'active',
    deadline: row.deadline || row.opened_at || new Date().toISOString(),
    organizationCode: row.organization_code ?? undefined,
    userId: row.uid ?? undefined,
    partnerId: row.partner_uid ?? undefined,
    openedAt: row.opened_at ?? undefined,
    statusChangedAt: row.status_changed_at ?? row.opened_at ?? undefined,
    riskVerdicts: verdicts && verdicts.length ? verdicts : ['Behind on engagement targets'],
    assignedAdminName:
      row.assigned_admin_name ||
      (typeof nested.assignedAdminName === 'string' ? nested.assignedAdminName : null) ||
      'Governance Team',
    escalationReason:
      row.escalation_reason ||
      (typeof nested.escalationReason === 'string' ? nested.escalationReason : null) ||
      'SLA Breach',
  }
}

/**
 * Loads intervention cases for the partner's assigned organization codes (or all
 * cases for super_admin), then subscribes to realtime changes.
 */
export const listenToPartnerInterventions = (
  opts: { orgCodes: string[]; all: boolean },
  onChange: (rows: PartnerInterventionSummary[]) => void,
  onError?: (error: unknown) => void,
): (() => void) => {
  const codes = Array.from(new Set(opts.orgCodes.map((c) => (c ?? '').trim()).filter(Boolean)))

  if (!opts.all && codes.length === 0) {
    onChange([])
    return () => {}
  }

  let cancelled = false

  const load = async () => {
    try {
      let query = supabase
        .from('interventions')
        .select(SELECT_COLUMNS)
        .order('opened_at', { ascending: false })
      if (!opts.all) query = query.in('organization_code', codes)

      const { data, error } = await query
      if (cancelled) return
      if (error) throw error
      onChange(((data ?? []) as unknown as InterventionRow[]).map(mapRow))
    } catch (error) {
      if (cancelled) return
      onError?.(error)
    }
  }

  void load()

  const channel = supabase
    .channel(`partner_interventions_${++interventionsChannelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, () => {
      void load()
    })
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}

export interface CreateInterventionInput {
  name: string
  target: string
  reason: string
  status: string
  deadline: string
  organizationCode?: string | null
  userId?: string | null
  partnerId?: string | null
  riskVerdicts?: string[]
  assignedAdminName?: string | null
}

/** Opens a new intervention case. Returns the new row id. */
export async function createIntervention(input: CreateInterventionInput): Promise<string> {
  const nowIso = new Date().toISOString()
  const id = crypto.randomUUID()
  const uid = toUuidOrNull(input.userId)
  const partnerUid = toUuidOrNull(input.partnerId)

  const { data, error } = await supabase
    .from('interventions')
    .insert({
      id,
      name: input.name,
      target: input.target,
      reason: input.reason,
      status: input.status,
      deadline: input.deadline,
      organization_code: input.organizationCode ?? null,
      uid,
      partner_uid: partnerUid,
      opened_at: nowIso,
      status_changed_at: nowIso,
      risk_verdicts: input.riskVerdicts ?? [],
      assigned_admin_name: input.assignedAdminName ?? null,
      data: {},
    })
    .select('id')
    .single()

  if (error) throw asError(error)
  return (data as { id: string }).id
}

/** Columns that exist on the live interventions table. */
const LIVE_UPDATE_COLUMNS = new Set([
  'name',
  'target',
  'reason',
  'status',
  'deadline',
  'organization_code',
  'uid',
  'partner_uid',
  'opened_at',
  'status_changed_at',
  'started_at',
  'risk_verdicts',
  'assigned_admin_name',
  'escalation_reason',
  'updated_at',
  'data',
])

/**
 * Patches an existing case. Unknown keys (legacy Firestore fields like
 * escalated_at / completed_at) are merged into `data` jsonb so partner actions
 * still succeed against the live schema.
 */
export async function updateIntervention(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const livePatch: Record<string, unknown> = {}
  const overflow: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'user_id') {
      livePatch.uid = toUuidOrNull(typeof value === 'string' ? value : null)
      continue
    }
    if (key === 'partner_id') {
      livePatch.partner_uid = toUuidOrNull(typeof value === 'string' ? value : null)
      continue
    }
    if (LIVE_UPDATE_COLUMNS.has(key)) {
      livePatch[key] = value
    } else {
      overflow[key] = value
    }
  }

  if (Object.keys(overflow).length > 0) {
    const { data: existing } = await supabase
      .from('interventions')
      .select('data')
      .eq('id', id)
      .maybeSingle()
    const prev =
      existing && typeof existing === 'object' && existing.data && typeof existing.data === 'object'
        ? (existing.data as Record<string, unknown>)
        : {}
    livePatch.data = { ...prev, ...overflow }
  }

  const { error } = await supabase.from('interventions').update(livePatch).eq('id', id)
  if (error) throw asError(error)
}
