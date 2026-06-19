-- ============================================================================
-- T4L  ·  Admin org member invites (Supabase)
-- 0018: let an admin add members to an organization by email and have them land
-- on the org's paid journey - the email counterpart to claim_organization_code.
--
-- Two enrollment moments:
--   * Existing user (email already has an account)  -> enrolled immediately.
--   * New email (no account yet)                    -> recorded as a pending
--     invitation and enrolled the moment they sign up with that email.
--
-- Like claim_organization_code, the privileged writes (role, another user's
-- profile) run server-side: client role writes are revoked (0012) and the
-- invitations table is partner/admin-only (0006), so a brand-new signer-up
-- can't read it - acceptance must be a SECURITY DEFINER function keyed on the
-- caller's own email.
--
-- Reuses the existing public.invitations table (0006). Safe to re-run.
-- ============================================================================

-- ── helper: resolve an org's journey type ─────────────────────────────────────
-- Mirrors journeyTypeFromDurationWeeks() in src/utils/journeyType.ts and the
-- inline logic in claim_organization_code (0017).
create or replace function public.t4l_org_journey(p_org_id text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jt       text;
  v_pdw      int;
  v_settings jsonb;
  v_weeks    int;
begin
  select nullif(journey_type, ''), program_duration_weeks, settings
    into v_jt, v_pdw, v_settings
    from public.organizations
   where id = p_org_id;

  if v_jt is null then
    v_weeks := coalesce(v_pdw, round((v_settings->>'programDurationMonths')::numeric * 4)::int);
    v_jt := case
      when v_weeks is null or v_weeks <= 0 then null
      when v_weeks <= 4  then '4W'
      when v_weeks <= 6  then '6W'
      when v_weeks <= 12 then '3M'
      when v_weeks <= 24 then '6M'
      else '9M'
    end;
  end if;

  return coalesce(v_jt, '4W');
end;
$$;

-- ── helper: enroll a profile into an org with a mapped role ───────────────────
-- Plain members ('user'/null) become paid_member; partner/mentor/ambassador are
-- honored. Never downgrades an existing privileged role. Internal only.
create or replace function public.t4l_enroll_member(p_uid uuid, p_org_id text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      record;
  v_journey  text;
  v_start    date;
  v_prev_org text;
  v_role     text;
  v_assigned text[];
begin
  select id, name, code, cohort_start_date into v_org
    from public.organizations where id = p_org_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'org_not_found');
  end if;

  v_journey := public.t4l_org_journey(p_org_id);
  v_start   := coalesce(v_org.cohort_start_date::date, current_date);

  -- Map the invite role to a profile role. A plain org member is a paid member.
  v_role := case
    when p_role in ('partner', 'mentor', 'ambassador', 'super_admin') then p_role
    else 'paid_member'
  end;

  select organization_id into v_prev_org from public.profiles where id = p_uid;

  update public.profiles
     set organization_id     = v_org.id,
         company_id          = v_org.id,
         company_code        = v_org.code,
         company_name        = v_org.name,
         journey_type        = v_journey,
         journey_start_date  = coalesce(journey_start_date, v_start),
         membership_status   = 'paid',
         transformation_tier = 'corporate_member',
         -- Never downgrade an existing privileged role; otherwise apply the
         -- mapped invite role.
         role = case
                  when role in ('super_admin', 'partner', 'mentor', 'ambassador') then role
                  else v_role
                end,
         updated_at = now()
   where id = p_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  -- Partners track their orgs in data.assignedOrganizations (dashboards rely on
  -- it), matching admin_assign_partner (0013).
  if v_role = 'partner' then
    select coalesce(array(select jsonb_array_elements_text(data->'assignedOrganizations')), '{}')
      into v_assigned from public.profiles where id = p_uid;
    if not (v_org.id = any(v_assigned)) then
      v_assigned := v_assigned || v_org.id;
    end if;
    update public.profiles
       set data = jsonb_set(coalesce(data, '{}'::jsonb), '{assignedOrganizations}', to_jsonb(v_assigned), true)
     where id = p_uid;
  end if;

  -- Count a genuinely new membership.
  if v_prev_org is distinct from v_org.id then
    update public.organizations
       set member_count = coalesce(member_count, 0) + 1, updated_at = now()
     where id = v_org.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'organizationId', v_org.id,
    'organizationName', v_org.name,
    'journeyType', v_journey,
    'role', (case when v_role = 'paid_member' then 'paid_member' else v_role end)
  );
end;
$$;

-- ── admin: invite a member by email ───────────────────────────────────────────
-- Existing account -> enrolled now. New email -> pending invitation row.
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
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_role   text := coalesce(nullif(trim(p_role), ''), 'user');
  v_uid    uuid;
  v_enroll jsonb;
  v_status text;
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

  select id into v_uid from public.profiles where lower(email) = v_email limit 1;

  if v_uid is not null then
    v_enroll := public.t4l_enroll_member(v_uid, p_org_id, v_role);
    if (v_enroll->>'ok')::boolean is not true then
      return jsonb_build_object('ok', false, 'error', coalesce(v_enroll->>'error', 'enroll_failed'));
    end if;
    v_status := 'enrolled';
  else
    v_status := 'pending';
  end if;

  -- Record the invitation (audit + pending lookup at signup). Idempotent on the
  -- (org, email) pair via a deterministic id.
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

-- ── signing-up user: accept any pending invitation matching their email ───────
create or replace function public.accept_org_invitations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_inv    record;
  v_enroll jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select lower(email) into v_email from public.profiles where id = v_uid;
  if v_email is null or v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'no_email');
  end if;

  select * into v_inv
    from public.invitations
   where lower(email) = v_email
     and coalesce(status, 'pending') = 'pending'
     and organization_id is not null
     and (expires_at is null or expires_at > now())
   order by created_at desc nulls last
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_pending_invitation');
  end if;

  v_enroll := public.t4l_enroll_member(v_uid, v_inv.organization_id, coalesce(v_inv.role, 'user'));
  if (v_enroll->>'ok')::boolean is not true then
    return jsonb_build_object('ok', false, 'error', coalesce(v_enroll->>'error', 'enroll_failed'));
  end if;

  update public.invitations
     set status = 'accepted',
         data = jsonb_set(coalesce(data, '{}'::jsonb), '{acceptedUserId}', to_jsonb(v_uid::text), true),
         updated_at = now()
   where id = v_inv.id;

  return jsonb_build_object('ok', true, 'enrolled', v_enroll);
end;
$$;

-- Helpers are internal (called only by the definer functions above).
revoke all on function public.t4l_org_journey(text) from public;
revoke all on function public.t4l_enroll_member(uuid, text, text) from public;

revoke all on function public.admin_invite_org_member(text, text, text) from public;
grant execute on function public.admin_invite_org_member(text, text, text) to authenticated;
revoke all on function public.accept_org_invitations() from public;
grant execute on function public.accept_org_invitations() to authenticated;
