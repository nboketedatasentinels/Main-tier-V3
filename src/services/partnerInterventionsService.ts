/**
 * Supabase-backed reads + writes for the partner at-risk intervention queue.
 *
 * Replaces the Firestore `interventions` collection (auth cutover left it with
 * no Firebase session, so every read/write hit "Missing or insufficient
 * permissions"). RLS lets any partner/admin read + manage cases - see
 * supabase/migrations/0024_partner_interventions.sql.
 *
 * The listener follows the established partner-reads pattern (see
 * partnerSupabaseReads): an initial async load, then a realtime channel that
 * re-runs the load on any change, with a monotonic channel-topic suffix.
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
}

const SELECT_COLUMNS =
  'id, name, target, reason, status, deadline, organization_code, uid, ' +
  'partner_uid, opened_at, status_changed_at, risk_verdicts, assigned_admin_name, ' +
  'escalation_reason'

let interventionsChannelSeq = 0

const mapRow = (row: InterventionRow): PartnerInterventionSummary => {
  const verdicts = Array.isArray(row.risk_verdicts)
    ? (row.risk_verdicts as unknown[]).filter((v): v is string => typeof v === 'string')
    : undefined
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
    assignedAdminName: row.assigned_admin_name || 'Governance Team',
    escalationReason: row.escalation_reason || 'SLA Breach',
  }
}

/**
 * Loads intervention cases for the partner's assigned organization codes (or all
 * cases for super_admin), then subscribes to realtime changes. Returns mapped
 * summaries; the caller applies any finer-grained partner/selected-org filter.
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
}

/** Opens a new intervention case. Returns the new row id. */
export async function createIntervention(input: CreateInterventionInput): Promise<string> {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('interventions')
    .insert({
      name: input.name,
      target: input.target,
      reason: input.reason,
      status: input.status,
      deadline: input.deadline,
      organization_code: input.organizationCode ?? null,
      uid: input.userId ?? null,
      partner_uid: input.partnerId ?? null,
      opened_at: nowIso,
      status_changed_at: nowIso,
      risk_verdicts: input.riskVerdicts ?? [],
    })
    .select('id')
    .single()

  if (error) throw error
  return (data as { id: string }).id
}

/** Patches an existing case (status transitions, escalation, extension, etc.). */
export async function updateIntervention(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('interventions').update(patch).eq('id', id)
  if (error) throw error
}
