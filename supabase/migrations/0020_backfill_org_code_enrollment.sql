-- ============================================================================
-- T4L  ·  Backfill: org-code members stuck on the free plan
-- 0020: enroll every user who signed up with an org code but never got the
-- claim applied, so they are still free_user with no organization.
--
-- Why this is needed:
--   The client claim (0017) only read the pending code from auth metadata +
--   localStorage. Older / email-confirmation signups stashed the code ONLY in
--   profiles.data.pendingCompanyCode, where the client never looked - so the
--   claim never fired and the user stayed free despite holding a valid code.
--   (The client is hardened separately to also read profiles.data.)
--
-- This repair reads BOTH locations (auth metadata + profiles.data) and enrolls
-- via the deployed t4l_enroll_member (0018), which applies the org's journey,
-- paid membership, corporate_member tier, and the member_count bump.
--
-- Safe to re-run: only touches profiles with no org AND a stored code matching
-- an active org; once enrolled, organization_id is set so they no longer match.
-- Run in the Supabase SQL editor AFTER 0017/0018.
-- ============================================================================

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.id as uid, o.id as org_id
    from public.profiles p
    join auth.users u on u.id = p.id
    join public.organizations o
      on upper(o.code) = upper(coalesce(
           u.raw_user_meta_data->>'pending_company_code',
           p.data->>'pendingCompanyCode'))
    where p.organization_id is null
      and p.company_id is null
      and coalesce(o.status, 'active') = 'active'
  loop
    perform public.t4l_enroll_member(r.uid, r.org_id, 'user');
    n := n + 1;
  end loop;
  raise notice 'Backfill: enrolled % stuck org-code member(s)', n;
end $$;
