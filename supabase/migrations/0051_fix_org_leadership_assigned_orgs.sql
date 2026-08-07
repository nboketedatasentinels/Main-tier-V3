-- ============================================================================
-- T4L  ·  Leadership Council: resolve partner/coach/mentor via assigned orgs
-- 0051: Learners were seeing "No partner assigned" even when a partner (and
-- coach) existed for their org. get_my_organization_leadership only read
-- organizations.transformation_partner_id and profiles linked by
-- company_id/organization_id. Multi-org partners/coaches often live only in
-- profiles.data.assignedOrganizations (and/or settings.partnerEmail /
-- pending invitations after org setup or a data wipe).
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
  v_partner_email text;
  v_mentor_email text;
  v_ambassador_email text;
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
      'pending', jsonb_build_object(
        'partnerEmail', null,
        'mentorEmail', null,
        'ambassadorEmail', null
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
    nullif(trim(coalesce(o.transformation_partner_id, '')), ''),
    nullif(trim(lower(coalesce(o.settings->>'partnerEmail', o.settings->>'assignedPartnerEmail', ''))), ''),
    nullif(trim(lower(coalesce(o.settings->>'mentorEmail', o.settings->>'assignedMentorEmail', ''))), ''),
    nullif(trim(lower(coalesce(o.settings->>'ambassadorEmail', o.settings->>'coachEmail', o.settings->>'assignedAmbassadorEmail', ''))), '')
  into v_org_id, v_org_code, v_org_name, v_partner_id, v_partner_email, v_mentor_email, v_ambassador_email
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
      'pending', jsonb_build_object(
        'partnerEmail', null,
        'mentorEmail', null,
        'ambassadorEmail', null
      ),
      'profiles', jsonb_build_object(
        'partner', null,
        'mentor', null,
        'ambassador', null
      ),
      'error', 'organization_not_found'
    );
  end if;

  -- Pending invite emails fill gaps when leadership hasn't signed up yet.
  if v_partner_email is null then
    select nullif(trim(lower(coalesce(i.email, ''))), '')
      into v_partner_email
    from public.invitations i
    where i.organization_id = v_org_id
      and lower(coalesce(i.status, 'pending')) = 'pending'
      and lower(trim(coalesce(i.role, ''))) = 'partner'
    order by i.created_at desc nulls last
    limit 1;
  end if;

  if v_mentor_email is null then
    select nullif(trim(lower(coalesce(i.email, ''))), '')
      into v_mentor_email
    from public.invitations i
    where i.organization_id = v_org_id
      and lower(coalesce(i.status, 'pending')) = 'pending'
      and lower(trim(coalesce(i.role, ''))) = 'mentor'
    order by i.created_at desc nulls last
    limit 1;
  end if;

  if v_ambassador_email is null then
    select nullif(trim(lower(coalesce(i.email, ''))), '')
      into v_ambassador_email
    from public.invitations i
    where i.organization_id = v_org_id
      and lower(coalesce(i.status, 'pending')) = 'pending'
      and lower(trim(coalesce(i.role, ''))) in ('ambassador', 'coach')
    order by i.created_at desc nulls last
    limit 1;
  end if;

  -- Partner fallbacks when transformation_partner_id is empty.
  if v_partner_id is null then
    select p.id::text into v_partner_id
    from public.profiles p
    where lower(trim(coalesce(p.role, ''))) = 'partner'
      and (
        p.organization_id::text = v_org_id
        or p.company_id = v_org_id
        or (v_org_code is not null and lower(trim(coalesce(p.company_code, ''))) = lower(v_org_code))
        or exists (
          select 1
          from jsonb_array_elements_text(coalesce(p.data->'assignedOrganizations', '[]'::jsonb)) as org_key
          where lower(trim(org_key)) = lower(v_org_id)
             or (v_org_code is not null and lower(trim(org_key)) = lower(v_org_code))
        )
        or (
          v_partner_email is not null
          and lower(trim(coalesce(p.email, ''))) = v_partner_email
        )
      )
    order by
      case when p.organization_id::text = v_org_id or p.company_id = v_org_id then 0 else 1 end,
      p.updated_at desc nulls last
    limit 1;
  end if;

  select p.id::text into v_mentor_id
  from public.profiles p
  where lower(trim(coalesce(p.role, ''))) = 'mentor'
    and (
      p.organization_id::text = v_org_id
      or p.company_id = v_org_id
      or (v_org_code is not null and lower(trim(coalesce(p.company_code, ''))) = lower(v_org_code))
      or exists (
        select 1
        from jsonb_array_elements_text(coalesce(p.data->'assignedOrganizations', '[]'::jsonb)) as org_key
        where lower(trim(org_key)) = lower(v_org_id)
           or (v_org_code is not null and lower(trim(org_key)) = lower(v_org_code))
      )
      or (
        v_mentor_email is not null
        and lower(trim(coalesce(p.email, ''))) = v_mentor_email
      )
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
      or exists (
        select 1
        from jsonb_array_elements_text(coalesce(p.data->'assignedOrganizations', '[]'::jsonb)) as org_key
        where lower(trim(org_key)) = lower(v_org_id)
           or (v_org_code is not null and lower(trim(org_key)) = lower(v_org_code))
      )
      or (
        v_ambassador_email is not null
        and lower(trim(coalesce(p.email, ''))) = v_ambassador_email
      )
    )
  order by p.updated_at desc nulls last
  limit 1;

  v_mentor_id := coalesce(v_profile_mentor, v_mentor_id);
  v_ambassador_id := coalesce(v_profile_ambassador, v_ambassador_id);

  -- Clear pending emails once a live profile is resolved.
  if v_partner_id is not null then
    v_partner_email := null;
  end if;
  if v_mentor_id is not null then
    v_mentor_email := null;
  end if;
  if v_ambassador_id is not null then
    v_ambassador_email := null;
  end if;

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
    'pending', jsonb_build_object(
      'partnerEmail', v_partner_email,
      'mentorEmail', v_mentor_email,
      'ambassadorEmail', v_ambassador_email
    ),
    'assignmentSources', jsonb_build_object(
      'partner', case when v_partner_id is not null then 'organization' when v_partner_email is not null then 'organization' else null end,
      'mentor', case
        when v_profile_mentor is not null then 'profile'
        when v_mentor_id is not null or v_mentor_email is not null then 'organization'
        else null
      end,
      'ambassador', case
        when v_profile_ambassador is not null then 'profile'
        when v_ambassador_id is not null or v_ambassador_email is not null then 'organization'
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
