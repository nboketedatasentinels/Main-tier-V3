-- ============================================================================
-- T4L  ·  Admin: delete an organization (Supabase)
-- 0030: SECURITY DEFINER function to delete an organization + detach members.
--
-- The Organization Management page previously called a Firestore-based
-- deleteOrganization, which fails under Supabase auth (no Firebase session) and
-- targeted the wrong datastore entirely. Deletion also needs to clear member
-- references (organization_id / company_id / company_code) and remove the org
-- from any partner's data.assignedOrganizations list, which client RLS forbids
-- (profiles_update is self-only). This function performs those writes
-- server-side after verifying the caller is a partner/admin, mirroring the
-- assign/remove partner functions in 0013.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0013.
-- ============================================================================

create or replace function public.admin_delete_organization(org_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  org_code text;
begin
  if not public.is_partner_or_admin() then
    return 'forbidden';
  end if;

  if not exists (select 1 from public.organizations where id::text = org_id) then
    return 'org_not_found';
  end if;

  select code into org_code from public.organizations where id::text = org_id;

  -- Detach members linked by organization_id / company_id so no dangling
  -- reference (or FK) blocks the delete.
  update public.profiles
     set organization_id = null,
         updated_at = now()
   where organization_id::text = org_id;

  update public.profiles
     set company_id = null,
         updated_at = now()
   where company_id::text = org_id;

  -- Detach members linked by the org code.
  if org_code is not null then
    update public.profiles
       set company_code = null,
           updated_at = now()
     where company_code = org_code;
  end if;

  -- Remove the org from any partner's assignedOrganizations list.
  update public.profiles
     set data = jsonb_set(
           coalesce(data, '{}'::jsonb),
           '{assignedOrganizations}',
           coalesce(
             (
               select jsonb_agg(v)
               from jsonb_array_elements_text(data->'assignedOrganizations') as t(v)
               where v <> org_id
             ),
             '[]'::jsonb
           ),
           true
         ),
         updated_at = now()
   where data ? 'assignedOrganizations'
     and data->'assignedOrganizations' @> to_jsonb(org_id);

  delete from public.organizations where id::text = org_id;

  return 'ok';
end;
$$;

grant execute on function public.admin_delete_organization(text) to authenticated;
