-- ============================================================================
-- T4L  ·  Learner-facing organization leadership (partner / mentor / ambassador)
-- 0042: Leadership Council was still reading Firestore orgs, which fails after
-- the Supabase auth cutover. This RPC returns the caller's org leadership from
-- Supabase so learners can see their Transformation Partner (and mentor /
-- ambassador when assigned).
--
-- Safe to re-run (idempotent).
-- ============================================================================

create or replace function public.get_my_organization_leadership()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id text;
  v_org_code text;
  v_org_name text;
  v_partner_id text;
  v_mentor_id text;
  v_ambassador_id text;
  v_profile_mentor text;
  v_profile_ambassador text;
  v_partner jsonb;
  v_mentor jsonb;
  v_ambassador jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select
    nullif(trim(coalesce(company_id, organization_id::text, '')), ''),
    nullif(trim(coalesce(company_code, '')), ''),
    nullif(trim(coalesce(mentor_id::text, '')), ''),
    nullif(trim(coalesce(ambassador_id::text, '')), '')
  into v_org_id, v_org_code, v_profile_mentor, v_profile_ambassador
  from public.profiles
  where id = v_uid;

  if v_org_id is null and v_org_code is null then
    return jsonb_build_object(
      'organization', null,
      'assignments', jsonb_build_object(
        'partnerId', null,
        'mentorId', v_profile_mentor,
        'ambassadorId', v_profile_ambassador
      ),
      'profiles', jsonb_build_object(
        'partner', null,
        'mentor', null,
        'ambassador', null
      )
    );
  end if;

  select
    o.id::text,
    o.code,
    o.name,
    nullif(trim(coalesce(o.transformation_partner_id, '')), '')
  into v_org_id, v_org_code, v_org_name, v_partner_id
  from public.organizations o
  where (v_org_id is not null and o.id::text = v_org_id)
     or (v_org_code is not null and lower(o.code) = lower(v_org_code))
  order by case when v_org_id is not null and o.id::text = v_org_id then 0 else 1 end
  limit 1;

  if v_org_id is null then
    return jsonb_build_object(
      'organization', null,
      'assignments', jsonb_build_object(
        'partnerId', null,
        'mentorId', v_profile_mentor,
        'ambassadorId', v_profile_ambassador
      ),
      'profiles', jsonb_build_object(
        'partner', null,
        'mentor', null,
        'ambassador', null
      ),
      'error', 'organization_not_found'
    );
  end if;

  -- Org-linked mentor / ambassador (profiles attached to this org with that role).
  select p.id::text into v_mentor_id
  from public.profiles p
  where lower(trim(coalesce(p.role, ''))) = 'mentor'
    and (
      p.organization_id::text = v_org_id
      or p.company_id = v_org_id
      or (v_org_code is not null and lower(trim(coalesce(p.company_code, ''))) = lower(v_org_code))
    )
  order by p.updated_at desc nulls last
  limit 1;

  select p.id::text into v_ambassador_id
  from public.profiles p
  where lower(trim(coalesce(p.role, ''))) = 'ambassador'
    and (
      p.organization_id::text = v_org_id
      or p.company_id = v_org_id
      or (v_org_code is not null and lower(trim(coalesce(p.company_code, ''))) = lower(v_org_code))
    )
  order by p.updated_at desc nulls last
  limit 1;

  v_mentor_id := coalesce(v_profile_mentor, v_mentor_id);
  v_ambassador_id := coalesce(v_profile_ambassador, v_ambassador_id);

  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'firstName', p.first_name,
    'lastName', p.last_name,
    'fullName', p.full_name,
    'role', p.role,
    'companyId', p.company_id,
    'companyCode', p.company_code,
    'companyName', p.company_name,
    'avatarUrl', coalesce(p.data->>'avatarUrl', p.data->>'photoURL', p.data->>'avatar_url'),
    'title', coalesce(p.data->>'title', 'Transformation Partner'),
    'bio', p.data->>'bio',
    'officeLocation', coalesce(p.data->>'officeLocation', p.data->>'location'),
    'timezone', p.data->>'timezone'
  )
  into v_partner
  from public.profiles p
  where v_partner_id is not null and p.id::text = v_partner_id
  limit 1;

  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'firstName', p.first_name,
    'lastName', p.last_name,
    'fullName', p.full_name,
    'role', p.role,
    'companyId', p.company_id,
    'companyCode', p.company_code,
    'companyName', p.company_name,
    'avatarUrl', coalesce(p.data->>'avatarUrl', p.data->>'photoURL', p.data->>'avatar_url'),
    'title', coalesce(p.data->>'title', 'Mentor'),
    'bio', p.data->>'bio',
    'availabilityStatus', coalesce(p.data->>'availabilityStatus', p.data->>'availability'),
    'timezone', p.data->>'timezone'
  )
  into v_mentor
  from public.profiles p
  where v_mentor_id is not null and p.id::text = v_mentor_id
  limit 1;

  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'firstName', p.first_name,
    'lastName', p.last_name,
    'fullName', p.full_name,
    'role', p.role,
    'companyId', p.company_id,
    'companyCode', p.company_code,
    'companyName', p.company_name,
    'avatarUrl', coalesce(p.data->>'avatarUrl', p.data->>'photoURL', p.data->>'avatar_url'),
    'title', coalesce(p.data->>'title', 'Ambassador'),
    'bio', p.data->>'bio',
    'availabilityStatus', coalesce(p.data->>'availabilityStatus', p.data->>'availability'),
    'timezone', p.data->>'timezone'
  )
  into v_ambassador
  from public.profiles p
  where v_ambassador_id is not null and p.id::text = v_ambassador_id
  limit 1;

  return jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org_id,
      'code', v_org_code,
      'name', v_org_name,
      'exists', true
    ),
    'assignments', jsonb_build_object(
      'partnerId', v_partner_id,
      'mentorId', v_mentor_id,
      'ambassadorId', v_ambassador_id
    ),
    'assignmentSources', jsonb_build_object(
      'partner', case when v_partner_id is not null then 'organization' else null end,
      'mentor', case
        when v_profile_mentor is not null then 'profile'
        when v_mentor_id is not null then 'organization'
        else null
      end,
      'ambassador', case
        when v_profile_ambassador is not null then 'profile'
        when v_ambassador_id is not null then 'organization'
        else null
      end
    ),
    'profiles', jsonb_build_object(
      'partner', v_partner,
      'mentor', v_mentor,
      'ambassador', v_ambassador
    )
  );
end;
$$;

revoke all on function public.get_my_organization_leadership() from public;
grant execute on function public.get_my_organization_leadership() to authenticated;
