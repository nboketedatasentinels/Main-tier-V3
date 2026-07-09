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
  /** Per-month course assignment map, e.g. { "1": "courseId", "2": "" }. */
  monthlyCourseAssignments?: Record<string, string> | null
  /** Flat course assignment array (legacy/array mode). */
  courseAssignments?: string[] | null
  /** Which assignment shape the org uses. */
  courseAssignmentStructure?: 'monthly' | 'array' | null
  /** Free-text organization description. */
  description?: string | null
}

const buildSettings = (e: OrgWriteExtras): Record<string, unknown> => ({
  village: e.village ?? null,
  cluster: e.cluster ?? null,
  pillar: e.pillar ?? null,
  teamSize: e.teamSize ?? null,
  programDurationMonths: e.programDurationMonths ?? null,
  partnerEmail: e.partnerEmail ? e.partnerEmail.trim().toLowerCase() : null,
  description: e.description ?? null,
  // Course assignments live in the settings jsonb (the org table has no column
  // for them). Read back by useOrganizationProgramCourses + monthlyCoursesService.
  monthlyCourseAssignments: e.monthlyCourseAssignments ?? null,
  courseAssignments: e.courseAssignments ?? null,
  courseAssignmentStructure: e.courseAssignmentStructure ?? null,
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
    // Create the org ACTIVE so members can enroll immediately. The type-the-code
    // path (claim_organization_code) rejects any org whose status is not
    // 'active'; the DB column default is 'pending', which silently blocked
    // self-enrollment for every new org. 'active' is a valid status_check value.
    .insert({
      id,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      status: 'active',
      journey_type: input.journeyType ?? null,
      program_duration_weeks: input.programDurationWeeks ?? null,
      cohort_start_date: input.cohortStartDate || null,
      settings: buildSettings(input),
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  // If a partner email was supplied and it already belongs to a registered
  // user, link them now (promote + set transformation_partner_id) so the org
  // shows the partner instead of "Unassigned". If the email has no account yet,
  // it stays a pending claim in settings.partnerEmail (claimed on signup).
  const partnerEmail = input.partnerEmail?.trim().toLowerCase()
  if (partnerEmail) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', partnerEmail)
        .maybeSingle()
      if (profile?.id) {
        await assignPartnerToOrg(id, profile.id as string)
        // Re-read so the returned record reflects the transformation_partner_id
        // the assignment RPC just wrote.
        const { data: fresh } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', id)
          .single()
        if (fresh) return mapOrg(fresh as Raw)
      }
    } catch (linkError) {
      // Non-fatal: the org is created either way and the partner can be
      // assigned later from the organizations list.
      console.warn('[createOrganization] partner email auto-link skipped', linkError)
    }
  }

  return mapOrg(data as Raw)
}

export interface OrgJourneyInfo {
  journeyType: string | null
  programDurationWeeks: number | null
  programDurationMonths: number | null
  cohortStartDate: string | null
}

/**
 * Fetch just the journey fields for one organization (member-side).
 *
 * Drives the weekly-checklist journey + cohort start date for corporate
 * members. Reads Supabase, where organizations now live - the legacy Firestore
 * org document is empty for any org created via the admin UI after the
 * migration, which is why members otherwise fell back to the default journey.
 * Returns null when the org is missing or the read fails (caller falls back to
 * the journey the join RPC stamped on the profile).
 */
export const getOrganizationJourney = async (orgId: string): Promise<OrgJourneyInfo | null> => {
  if (!orgId) return null
  const { data, error } = await supabase
    .from('organizations')
    .select('journey_type, program_duration_weeks, cohort_start_date, settings')
    .eq('id', orgId)
    .maybeSingle()
  if (error) {
    console.warn('[supabaseOrgService] getOrganizationJourney failed', error)
    return null
  }
  if (!data) return null
  const settings = (data.settings as Record<string, unknown> | null) ?? {}
  return {
    journeyType: (data.journey_type as string) ?? null,
    programDurationWeeks: (data.program_duration_weeks as number) ?? null,
    programDurationMonths: (settings.programDurationMonths as number) ?? null,
    cohortStartDate: (data.cohort_start_date as string) ?? null,
  }
}

/**
 * Raw org program fields used by useOrganizationProgramCourses +
 * monthlyCoursesService. Mirrors the field names the old Firestore org
 * document exposed, so the existing normalization in those consumers works
 * unchanged. Journey fields are columns; the course assignments + pillar +
 * program-duration-in-months live in the settings jsonb. Returns null when the
 * org is missing or the read fails.
 */
export interface OrgProgramRaw {
  journeyType: string | null
  programDurationWeeks: number | null
  programDuration: number | null
  cohortStartDate: string | null
  monthlyCourseAssignments: Record<string, string> | null
  courseAssignments: string[] | null
  courseAssignmentStructure: 'monthly' | 'array' | null
  pillar: string | null
}

export const getOrganizationProgram = async (orgId: string): Promise<OrgProgramRaw | null> => {
  if (!orgId) return null
  const { data, error } = await supabase
    .from('organizations')
    .select('journey_type, program_duration_weeks, cohort_start_date, settings')
    .eq('id', orgId)
    .maybeSingle()
  if (error) {
    console.warn('[supabaseOrgService] getOrganizationProgram failed', error)
    return null
  }
  if (!data) return null
  const settings = (data.settings as Record<string, unknown> | null) ?? {}
  const monthly = settings.monthlyCourseAssignments
  const courses = settings.courseAssignments
  const structure = settings.courseAssignmentStructure
  return {
    journeyType: (data.journey_type as string) ?? null,
    programDurationWeeks: (data.program_duration_weeks as number) ?? null,
    programDuration: (settings.programDurationMonths as number) ?? null,
    cohortStartDate: (data.cohort_start_date as string) ?? null,
    monthlyCourseAssignments:
      monthly && typeof monthly === 'object' && !Array.isArray(monthly)
        ? (monthly as Record<string, string>)
        : null,
    courseAssignments: Array.isArray(courses) ? (courses as string[]) : null,
    courseAssignmentStructure:
      structure === 'monthly' || structure === 'array' ? structure : null,
    pillar: (settings.pillar as string) ?? null,
  }
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

export interface ClaimOrgResult {
  ok: boolean
  error?: string
  organizationId?: string
  organizationName?: string
  code?: string
  journeyType?: string
}

/**
 * Enroll the CURRENT user (auth.uid()) into an organization by its code.
 * Sets org membership + the org's journey + paid membership (role -> paid_member)
 * server-side, because client code cannot write profiles.role (revoked in 0012).
 * A user who joins via an org code belongs to that org and is never a free_user.
 * Returns the resolved org info; never throws (callers branch on `ok`).
 */
export const claimOrganizationCode = async (code: string): Promise<ClaimOrgResult> => {
  const { data, error } = await supabase.rpc('claim_organization_code', {
    p_code: code.trim().toUpperCase(),
  })
  if (error) return { ok: false, error: error.message }
  return (data ?? { ok: false, error: 'no_result' }) as ClaimOrgResult
}

export interface InviteMemberResult {
  ok: boolean
  status?: 'enrolled' | 'pending'
  error?: string
}

/**
 * Admin/partner adds a member to an org by email. If the email already has an
 * account they're enrolled immediately (org + journey + role); otherwise a
 * pending invitation is recorded and enrollment happens when they sign up with
 * that email. Mirrors the org-code path for admin-driven adds. Never throws.
 */
export const inviteOrgMember = async (
  orgId: string,
  email: string,
  role: string = 'user',
): Promise<InviteMemberResult> => {
  const { data, error } = await supabase.rpc('admin_invite_org_member', {
    p_org_id: orgId,
    p_email: email.trim().toLowerCase(),
    p_role: role || 'user',
  })
  if (error) return { ok: false, error: error.message }
  return (data ?? { ok: false, error: 'no_result' }) as InviteMemberResult
}

/**
 * Called once a session exists for a freshly signed-up user: enrolls them into
 * any organization they were invited to by email (the email counterpart to
 * claimOrganizationCode). Never throws; callers branch on `ok`.
 */
export const acceptOrgInvitations = async (): Promise<{ ok: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('accept_org_invitations')
  if (error) return { ok: false, error: error.message }
  return (data ?? { ok: false, error: 'no_result' }) as { ok: boolean; error?: string }
}
