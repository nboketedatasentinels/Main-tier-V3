/**
 * Supabase-native organization management + partner assignment (admin).
 *
 * Org create/list/update go directly to the organizations table (RLS:
 * is_partner_or_admin). Partner assignment goes through SECURITY DEFINER
 * functions (migration 0013) because it writes another user's profile.
 */
import { supabase } from '@/services/supabase'

export interface OrgRecord {
  id: string
  code: string | null
  name: string | null
  status: string
  transformationPartnerId: string | null
  journeyType: string | null
  programDurationWeeks: number | null
  memberCount: number
  createdAt: string
}

export interface PartnerCandidate {
  id: string
  fullName: string | null
  email: string | null
  role: string | null
}

type Raw = Record<string, unknown>

const mapOrg = (row: Raw): OrgRecord => ({
  id: row.id as string,
  code: (row.code as string) ?? null,
  name: (row.name as string) ?? null,
  status: (row.status as string) ?? 'active',
  transformationPartnerId: (row.transformation_partner_id as string) ?? null,
  journeyType: (row.journey_type as string) ?? null,
  programDurationWeeks: (row.program_duration_weeks as number) ?? null,
  memberCount: (row.member_count as number) ?? 0,
  createdAt: (row.created_at as string) ?? '',
})

export const listOrganizations = async (): Promise<OrgRecord[]> => {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapOrg(r as Raw))
}

/**
 * The non-column org fields (village, cluster, pillar, cohort size, the
 * program-duration-in-months the form uses) live in the organizations.settings
 * jsonb long-tail. cohort_start_date is its own timestamptz column.
 */
export interface OrgWriteExtras {
  status?: string
  cohortStartDate?: string | null
  village?: string | null
  cluster?: string | null
  pillar?: string | null
  teamSize?: number | null
  programDurationMonths?: number | null
  /** Email of the assigned transformation partner (they claim it on signup). */
  partnerEmail?: string | null
}

const buildSettings = (e: OrgWriteExtras): Record<string, unknown> => ({
  village: e.village ?? null,
  cluster: e.cluster ?? null,
  pillar: e.pillar ?? null,
  teamSize: e.teamSize ?? null,
  programDurationMonths: e.programDurationMonths ?? null,
  partnerEmail: e.partnerEmail ? e.partnerEmail.trim().toLowerCase() : null,
})

/** Add a SECURITY DEFINER claim used by partner signup (see claim_partner_access RPC). */
export const claimPartnerAccess = async (): Promise<string> => {
  const { data, error } = await supabase.rpc('claim_partner_access')
  if (error) throw new Error(error.message)
  return (data as string) ?? 'error'
}

export interface CreateOrgInput extends OrgWriteExtras {
  name: string
  code: string
  journeyType?: string | null
  programDurationWeeks?: number | null
}

export const createOrganization = async (input: CreateOrgInput): Promise<OrgRecord> => {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `org_${Date.now()}`
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      id,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      status: input.status ?? 'active',
      journey_type: input.journeyType ?? null,
      program_duration_weeks: input.programDurationWeeks ?? null,
      cohort_start_date: input.cohortStartDate || null,
      settings: buildSettings(input),
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapOrg(data as Raw)
}

export interface UpdateOrgInput extends OrgWriteExtras {
  name?: string
  code?: string
  journeyType?: string | null
  programDurationWeeks?: number | null
}

/** Update an organization's fields (RLS: is_partner_or_admin). */
export const updateOrganization = async (id: string, patch: UpdateOrgInput): Promise<OrgRecord> => {
  const updates: Record<string, unknown> = {}
  if (patch.name !== undefined) updates.name = patch.name.trim()
  if (patch.code !== undefined) updates.code = patch.code.trim().toUpperCase()
  if (patch.status !== undefined) updates.status = patch.status
  if (patch.journeyType !== undefined) updates.journey_type = patch.journeyType
  if (patch.programDurationWeeks !== undefined) updates.program_duration_weeks = patch.programDurationWeeks
  if (patch.cohortStartDate !== undefined) updates.cohort_start_date = patch.cohortStartDate || null
  updates.settings = buildSettings(patch)
  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapOrg(data as Raw)
}

/** Candidate users for the partner picker (any user can be promoted). */
export const listPartnerCandidates = async (): Promise<PartnerCandidate[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .order('full_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => {
    const row = r as Raw
    return {
      id: row.id as string,
      fullName: (row.full_name as string) ?? null,
      email: (row.email as string) ?? null,
      role: (row.role as string) ?? null,
    }
  })
}

/** Assign (or change) an org's transformation partner. Promotes to partner + adds org to their list. */
export const assignPartnerToOrg = async (orgId: string, partnerUid: string): Promise<void> => {
  const { data, error } = await supabase.rpc('admin_assign_partner', {
    org_id: orgId,
    partner_uid: partnerUid,
  })
  if (error) throw new Error(error.message)
  if (data !== 'ok') throw new Error(`Assignment failed: ${data}`)
}

export const removePartnerFromOrg = async (orgId: string): Promise<void> => {
  const { data, error } = await supabase.rpc('admin_remove_partner', { org_id: orgId })
  if (error) throw new Error(error.message)
  if (data !== 'ok') throw new Error(`Removal failed: ${data}`)
}
