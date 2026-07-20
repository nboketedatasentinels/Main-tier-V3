import { supabase } from '@/services/supabase'

const ASSIGNMENT_STATUSES = ['active', 'watch', 'paused']

/**
 * Whether a partner may access an organization, resolved entirely from Supabase.
 *
 * The Firestore reads this replaced (`partner_organizations` + `users`
 * collections) failed with "Missing or insufficient permissions" after the
 * Firebase -> Supabase auth cutover, so every partner was denied access to their
 * own orgs. This mirrors the two sources of truth used by
 * listenToPartnerAssignedOrgIds:
 *   1) organizations.transformation_partner_id = partnerId  (canonical)
 *   2) profiles.{partnerId}.data.assignedOrganizations       (mirror)
 *
 * `organizationId` may be an org UUID or a company code — both are matched.
 */
export const canPartnerAccessOrganization = async (
  partnerId: string,
  organizationId: string,
): Promise<boolean> => {
  if (!partnerId || !organizationId) return false
  const target = organizationId.trim().toLowerCase()

  // Source 1 (canonical): orgs whose transformation_partner_id is this partner.
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, code, status')
    .eq('transformation_partner_id', partnerId)
    .in('status', ASSIGNMENT_STATUSES)
  if (orgError) {
    console.error('[partnerAccessService] organization access check failed', orgError)
  } else if (
    (orgs ?? []).some(
      (o) =>
        (o.id && String(o.id).trim().toLowerCase() === target) ||
        (o.code && String(o.code).trim().toLowerCase() === target),
    )
  ) {
    return true
  }

  // Source 2 (mirror): assignedOrganizations in the partner's profile jsonb.
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('data')
    .eq('id', partnerId)
    .maybeSingle()
  if (profileError) {
    console.error('[partnerAccessService] profile access check failed', profileError)
    return false
  }

  const assigned = (profileRow?.data as { assignedOrganizations?: unknown } | null)
    ?.assignedOrganizations
  if (!Array.isArray(assigned)) return false

  return assigned.some((entry) => {
    const value =
      typeof entry === 'string'
        ? entry
        : (entry as { organizationId?: string; companyCode?: string })?.organizationId ??
          (entry as { companyCode?: string })?.companyCode ??
          ''
    return String(value).trim().toLowerCase() === target
  })
}
