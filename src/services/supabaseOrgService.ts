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

export interface CreateOrgInput {
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
      status: 'active',
      journey_type: input.journeyType ?? null,
      program_duration_weeks: input.programDurationWeeks ?? null,
    })
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
