-- ============================================================================
-- T4L  ·  Block email reuse across different roles
-- 0038: when inviting/assigning by email, refuse if the address is already a
-- different role (profile or pending invitation). Same-role reuse is allowed
-- (e.g. partner on multiple orgs, user enrolled in another org).
--
-- Safe to re-run (idempotent).
-- ============================================================================

create or replace function public.t4l_role_conflict_bucket(p_role text)
returns text
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(p_role, ''))) in ('user', 'paid_member', 'free_user', '') then 'user'
    when lower(trim(coalesce(p_role, ''))) in ('company_admin', 'admin', 'administrator') then 'partner'
    else lower(trim(coalesce(p_role, '')))
  end;
$$;

create or replace function public.t4l_role_conflict_label(p_role text)
returns text
language sql
immutable
as $$
  select case public.t4l_role_conflict_bucket(p_role)
    when 'partner' then 'Partner'
    when 'mentor' then 'Mentor'
    when 'ambassador' then 'Ambassador'
    when 'super_admin' then 'Super Admin'
    else 'User'
  end;
$$;

-- ── admin_invite_org_member: refuse cross-role reuse ──────────────────────────
create or replace function public.admin_invite_org_member(
  p_org_id text,
  p_email  text,
  p_role   text default 'user'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email          text := lower(trim(coalesce(p_email, '')));
  v_role           text := coalesce(nullif(trim(p_role), ''), 'user');
  v_uid            uuid;
  v_existing_role  text;
  v_enroll         jsonb;
  v_status         text;
begin
  if not public.is_partner_or_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    return jsonb_build_object('ok', false, 'error', 'org_not_found');
  end if;

  select id, role into v_uid, v_existing_role
    from public.profiles
   where lower(email) = v_email
   limit 1;

  if v_uid is null then
    select role into v_existing_role
      from public.invitations
     where lower(email) = v_email
       and coalesce(status, 'pending') = 'pending'
     order by created_at desc nulls last
     limit 1;
  end if;

  if v_existing_role is not null
     and public.t4l_role_conflict_bucket(v_existing_role)
         <> public.t4l_role_conflict_bucket(v_role)
  then
    return jsonb_build_object(
      'ok', false,
      'error',
        v_email || ' is already assigned as a ' ||
        public.t4l_role_conflict_label(v_existing_role) ||
        '. Don''t use this email for a different role (' ||
        public.t4l_role_conflict_label(v_role) || ').'
    );
  end if;

  if v_uid is not null then
    v_enroll := public.t4l_enroll_member(v_uid, p_org_id, v_role);
    if (v_enroll->>'ok')::boolean is not true then
      return jsonb_build_object('ok', false, 'error', coalesce(v_enroll->>'error', 'enroll_failed'));
    end if;
    v_status := 'enrolled';
  else
    v_status := 'pending';
  end if;

  insert into public.invitations (id, email, role, organization_id, method, status, created_at, updated_at)
  values (p_org_id || ':' || v_email, v_email, v_role, p_org_id, 'email',
          case when v_uid is not null then 'accepted' else 'pending' end, now(), now())
  on conflict (id) do update
     set role = excluded.role,
         status = excluded.status,
         updated_at = now();

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

-- ── admin_assign_partner: refuse promoting a non-partner privileged role ──────
create or replace function public.admin_assign_partner(org_id text, partner_uid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text[];
  v_role   text;
begin
  if not public.is_partner_or_admin() then
    return 'forbidden';
  end if;

  select role into v_role from public.profiles where id = partner_uid;
  if not found then
    return 'partner_not_found';
  end if;

  if public.t4l_role_conflict_bucket(v_role) not in ('partner', 'user') then
    return 'role_conflict:' || public.t4l_role_conflict_label(v_role);
  end if;

  update public.organizations
     set transformation_partner_id = partner_uid::text,
         updated_at = now()
   where id = org_id;
  if not found then
    return 'org_not_found';
  end if;

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

revoke all on function public.t4l_role_conflict_bucket(text) from public;
revoke all on function public.t4l_role_conflict_label(text) from public;
revoke all on function public.admin_invite_org_member(text, text, text) from public;
grant execute on function public.admin_invite_org_member(text, text, text) to authenticated;
revoke all on function public.admin_assign_partner(text, uuid) from public;
grant execute on function public.admin_assign_partner(text, uuid) to authenticated;
