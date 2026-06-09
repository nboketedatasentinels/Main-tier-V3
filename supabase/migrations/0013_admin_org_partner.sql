-- ============================================================================
-- T4L  ·  Admin: organization management + partner assignment (Supabase)
-- 0013: SECURITY DEFINER functions to assign/remove a transformation partner.
--
-- Org create/list/update is done directly by the client (organizations_write
-- RLS already allows is_partner_or_admin). But assigning a partner also writes
-- ANOTHER user's profile (role -> 'partner', + the org added to their
-- assignedOrganizations list), which client RLS forbids (profiles_update is
-- self-only) and which the role-column lockdown from 0012 blocks. These
-- functions perform those writes server-side after verifying the caller is a
-- partner/admin. A partner can be assigned to one OR many organizations - each
-- assignment adds the org id to data.assignedOrganizations.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0001/0012.
-- ============================================================================

-- ── assign (or change) an organization's transformation partner ───────────────
create or replace function public.admin_assign_partner(org_id text, partner_uid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text[];
begin
  if not public.is_partner_or_admin() then
    return 'forbidden';
  end if;

  update public.organizations
     set transformation_partner_id = partner_uid::text,
         updated_at = now()
   where id = org_id;
  if not found then
    return 'org_not_found';
  end if;

  -- current assignedOrganizations for this partner
  select coalesce(array(select jsonb_array_elements_text(data->'assignedOrganizations')), '{}')
    into existing
    from public.profiles
   where id = partner_uid;

  if existing is null then
    return 'partner_not_found';
  end if;

  if not (org_id = any(existing)) then
    existing := existing || org_id;
  end if;

  update public.profiles
     set role = case when role in ('super_admin', 'partner') then role else 'partner' end,
         organization_id = coalesce(organization_id, org_id),
         data = jsonb_set(coalesce(data, '{}'::jsonb), '{assignedOrganizations}', to_jsonb(existing), true),
         updated_at = now()
   where id = partner_uid;

  return 'ok';
end;
$$;

-- ── remove an organization's partner (and drop the org from their list) ───────
create or replace function public.admin_remove_partner(org_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  partner_uid uuid;
  existing text[];
begin
  if not public.is_partner_or_admin() then
    return 'forbidden';
  end if;

  select transformation_partner_id::uuid into partner_uid
    from public.organizations where id = org_id;

  update public.organizations
     set transformation_partner_id = null, updated_at = now()
   where id = org_id;

  if partner_uid is not null then
    select coalesce(array(select jsonb_array_elements_text(data->'assignedOrganizations')), '{}')
      into existing from public.profiles where id = partner_uid;
    existing := array_remove(existing, org_id);
    update public.profiles
       set data = jsonb_set(coalesce(data, '{}'::jsonb), '{assignedOrganizations}', to_jsonb(existing), true),
           updated_at = now()
     where id = partner_uid;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.admin_assign_partner(text, uuid) from public;
revoke all on function public.admin_remove_partner(text) from public;
grant execute on function public.admin_assign_partner(text, uuid) to authenticated;
grant execute on function public.admin_remove_partner(text) to authenticated;
