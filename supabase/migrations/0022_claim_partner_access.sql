-- ============================================================================
-- T4L  ·  Partner self-service activation (Supabase)
-- 0022: SECURITY DEFINER function the partner signup/sign-in flow calls to
-- promote the signed-in user to the 'partner' role.
--
-- An admin assigns a partner to an organization by EMAIL before that partner
-- has an account (createOrganization stores it in settings.partnerEmail; an
-- existing account is linked immediately via admin_assign_partner / 0013,
-- which stamps organizations.transformation_partner_id). Either way, the
-- privileged writes - promoting role and writing transformation_partner_id /
-- assignedOrganizations - are forbidden to the client: profiles_update is
-- self-only, the role column is locked down (0012), and the org write is
-- partner/admin-only. So the claim runs server-side here.
--
-- The grant rule (chosen: "org assignment"): a caller becomes a partner ONLY if
-- their email is already tied to at least one organization - either
--   * organizations.transformation_partner_id = auth.uid()       (already linked), or
--   * lower(settings->>'partnerEmail') = caller's email          (pending by email).
-- Anyone else gets 'not_assigned' and stays un-promoted. This mirrors
-- admin_assign_partner (0013): never downgrades super_admin/partner, adds each
-- org to data.assignedOrganizations, and sets organization_id when unset.
--
-- Callable by any authenticated user (it only grants based on a pre-existing
-- admin assignment to the caller's own email). Safe to re-run (idempotent).
-- Run in the Supabase SQL editor AFTER 0013.
-- ============================================================================

create or replace function public.claim_partner_access()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_email    text;
  v_orgs     text[];
  v_existing text[];
begin
  if v_uid is null then
    return 'not_authenticated';
  end if;

  -- Resolve the caller's email. Prefer the profile row (the signup flow upserts
  -- it before calling), fall back to the JWT for a brand-new row that has no
  -- email column yet.
  select lower(email) into v_email from public.profiles where id = v_uid;
  if v_email is null or v_email = '' then
    v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  end if;
  if v_email = '' then
    return 'not_assigned';
  end if;

  -- Every org the caller is entitled to: already linked by uid, OR a pending
  -- assignment recorded against their email.
  select coalesce(array_agg(distinct id), '{}')
    into v_orgs
    from public.organizations
   where transformation_partner_id = v_uid::text
      or lower(coalesce(settings->>'partnerEmail', '')) = v_email;

  if array_length(v_orgs, 1) is null then
    return 'not_assigned';
  end if;

  -- Claim the pending-by-email orgs (stamp the partner uid). Orgs already linked
  -- to this uid are left as-is; we never steal an org pointing at someone else
  -- unless the admin recorded THIS caller's email as the pending partner.
  update public.organizations
     set transformation_partner_id = v_uid::text,
         updated_at = now()
   where id = any(v_orgs)
     and transformation_partner_id is distinct from v_uid::text
     and (transformation_partner_id is null
          or lower(coalesce(settings->>'partnerEmail', '')) = v_email);

  -- Merge org ids into the partner's assignedOrganizations and promote the role.
  select coalesce(array(select jsonb_array_elements_text(data->'assignedOrganizations')), '{}')
    into v_existing
    from public.profiles
   where id = v_uid;

  select coalesce(array_agg(distinct e), '{}')
    into v_existing
    from unnest(v_existing || v_orgs) as e;

  update public.profiles
     set role = case when role in ('super_admin', 'partner') then role else 'partner' end,
         organization_id = coalesce(organization_id, v_orgs[1]),
         data = jsonb_set(coalesce(data, '{}'::jsonb), '{assignedOrganizations}', to_jsonb(v_existing), true),
         updated_at = now()
   where id = v_uid;

  return 'ok';
end;
$$;

revoke all on function public.claim_partner_access() from public;
grant execute on function public.claim_partner_access() to authenticated;
