-- ============================================================================
-- T4L  ·  Shared Free Users Village
-- 0044: All free (non-org) learners belong to one shared village so they can
-- peer-match, see each other's marks on the village leaderboard, and share
-- community features without each creating a tiny private village.
--
-- Depends on 0043 (villages table + helpers). Safe to re-run (idempotent).
-- ============================================================================

-- Well-known shared village id (stable across environments).
create or replace function public.free_users_village_id()
returns uuid
language sql
immutable
as $$
  select 'a0000000-0000-4000-8000-0000000000ff'::uuid;
$$;

-- Shared village has unlimited members — drop the old 10-cap if present.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'villages'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%member_count%'
  loop
    execute format('alter table public.villages drop constraint %I', r.conname);
  end loop;

  alter table public.villages
    add constraint villages_member_count_nonnegative
    check (member_count >= 0);
exception when duplicate_object then
  null;
end;
$$;

-- Seed / upsert the shared free village (platform-owned; creator = null-safe).
-- Use a service-style insert: creator_id must reference a profile, so pick the
-- oldest learner if needed, else defer creator until first free user joins.
do $$
declare
  v_id uuid := public.free_users_village_id();
  v_creator uuid;
begin
  select id into v_creator
  from public.profiles
  order by created_at nulls last, id
  limit 1;

  if v_creator is null then
    -- No profiles yet; village row still created with a placeholder creator
    -- deferred — skip until someone exists. App RPC will create on first join.
    return;
  end if;

  insert into public.villages (
    id, name, description, creator_id, member_ids, member_count, is_active
  )
  values (
    v_id,
    'Free Learners Village',
    'Shared community for all free Transformation Leader learners — peer match, compare marks, and grow together.',
    v_creator,
    '{}'::uuid[],
    0,
    true
  )
  on conflict (id) do update
    set
      name = excluded.name,
      description = excluded.description,
      is_active = true,
      updated_at = now();
end;
$$;

-- Is this profile a free, non-org learner who should live in the shared village?
create or replace function public._is_free_non_org_learner(p public.profiles)
returns boolean
language sql
stable
as $$
  select
    public._is_learner_role(p.role)
    and lower(trim(coalesce(p.membership_status, 'free'))) <> 'paid'
    and lower(trim(coalesce(p.role, ''))) in ('user', 'free_user', '')
    and nullif(trim(coalesce(p.organization_id::text, '')), '') is null
    and nullif(trim(coalesce(p.company_id::text, '')), '') is null
    and nullif(trim(coalesce(p.company_code, '')), '') is null
    and lower(trim(coalesce(p.data->>'transformationTier', '')))
        not in ('individual_paid', 'corporate_member', 'corporate_leader');
$$;

-- Ensure shared village exists (lazy create with current user as bootstrap creator).
create or replace function public._ensure_shared_free_village_row(p_bootstrap_creator uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.free_users_village_id();
begin
  insert into public.villages (
    id, name, description, creator_id, member_ids, member_count, is_active
  )
  values (
    v_id,
    'Free Learners Village',
    'Shared community for all free Transformation Leader learners — peer match, compare marks, and grow together.',
    p_bootstrap_creator,
    '{}'::uuid[],
    0,
    true
  )
  on conflict (id) do update
    set is_active = true, updated_at = now();

  return v_id;
end;
$$;

-- Join the current free user to the shared village (idempotent).
create or replace function public.ensure_free_user_village()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_id uuid := public.free_users_village_id();
  v_current text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  if not public._is_free_non_org_learner(v_me) then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'not_free_learner');
  end if;

  v_id := public._ensure_shared_free_village_row(v_uid);

  v_current := coalesce(
    nullif(trim(coalesce(v_me.village_id::text, '')), ''),
    nullif(trim(coalesce(v_me.data->>'villageId', '')), '')
  );

  -- Already in the shared village.
  if v_current = v_id::text then
    return jsonb_build_object('ok', true, 'villageId', v_id, 'alreadyJoined', true);
  end if;

  -- Free users always use the shared village (move off tiny private ones).
  perform public._set_profile_village_id(v_uid, v_id);

  update public.villages
  set
    member_count = (
      select count(*)::int from public.profiles p
      where nullif(trim(coalesce(p.village_id::text, '')), '') = v_id::text
         or nullif(trim(coalesce(p.data->>'villageId', '')), '') = v_id::text
    ),
    updated_at = now()
  where id = v_id;

  return jsonb_build_object('ok', true, 'villageId', v_id, 'joined', true);
end;
$$;

revoke all on function public.ensure_free_user_village() from public;
grant execute on function public.ensure_free_user_village() to authenticated;
grant execute on function public.free_users_village_id() to authenticated;

-- Backfill every current free non-org learner into the shared village.
do $$
declare
  v_id uuid := public.free_users_village_id();
  v_bootstrap uuid;
  r record;
  v_count int := 0;
begin
  select id into v_bootstrap from public.profiles order by created_at nulls last, id limit 1;
  if v_bootstrap is null then
    return;
  end if;

  perform public._ensure_shared_free_village_row(v_bootstrap);

  for r in
    select p.*
    from public.profiles p
    where public._is_free_non_org_learner(p)
  loop
    perform public._set_profile_village_id(r.id, v_id);
    v_count := v_count + 1;
  end loop;

  update public.villages
  set
    member_count = v_count,
    updated_at = now()
  where id = v_id;
end;
$$;

-- Peer scope: also match on typed profiles.village_id (not only data jsonb).
create or replace function public._peer_shares_org_scope(
  p_me public.profiles,
  p_peer public.profiles
)
returns boolean
language sql
stable
as $$
  select
    (
      nullif(trim(coalesce(p_me.organization_id::text, '')), '') is not null
      and (
        p_peer.organization_id::text = p_me.organization_id::text
        or p_peer.company_id::text = p_me.organization_id::text
      )
    )
    or (
      nullif(trim(coalesce(p_me.company_id::text, '')), '') is not null
      and (
        p_peer.company_id::text = p_me.company_id::text
        or p_peer.organization_id::text = p_me.company_id::text
      )
    )
    or (
      nullif(trim(coalesce(p_me.company_code, '')), '') is not null
      and upper(trim(coalesce(p_peer.company_code, ''))) = upper(trim(p_me.company_code))
    )
    -- Typed village_id column (shared free village + org villages)
    or (
      nullif(trim(coalesce(p_me.village_id::text, '')), '') is not null
      and nullif(trim(coalesce(p_peer.village_id::text, '')), '') = nullif(trim(coalesce(p_me.village_id::text, '')), '')
    )
    -- Village (long-tail in data jsonb)
    or (
      nullif(trim(coalesce(
        p_me.data->>'corporateVillageId',
        p_me.data->>'villageId',
        ''
      )), '') is not null
      and (
        coalesce(p_peer.data->>'corporateVillageId', '') =
          coalesce(p_me.data->>'corporateVillageId', p_me.data->>'villageId', '')
        or coalesce(p_peer.data->>'villageId', '') =
          coalesce(p_me.data->>'corporateVillageId', p_me.data->>'villageId', '')
      )
    )
    or (
      nullif(trim(coalesce(p_me.data->>'cohortIdentifier', '')), '') is not null
      and coalesce(p_peer.data->>'cohortIdentifier', '') = p_me.data->>'cohortIdentifier'
    );
$$;

-- list_org_peers: treat typed village_id as a valid scope (no_organization guard).
create or replace function public.list_org_peers(p_include_self boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_me    public.profiles%rowtype;
  v_peers jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  -- Auto-join free learners before listing (keeps peer lists populated).
  if public._is_free_non_org_learner(v_me) then
    perform public.ensure_free_user_village();
    select * into v_me from public.profiles where id = v_uid;
  end if;

  if nullif(trim(coalesce(v_me.organization_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.company_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.company_code, '')), '') is null
     and nullif(trim(coalesce(v_me.village_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.data->>'corporateVillageId', '')), '') is null
     and nullif(trim(coalesce(v_me.data->>'villageId', '')), '') is null
     and nullif(trim(coalesce(v_me.data->>'cohortIdentifier', '')), '') is null
  then
    return jsonb_build_object('ok', false, 'error', 'no_organization');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'full_name', p.full_name,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'role', p.role,
        'membership_status', p.membership_status,
        'organization_id', p.organization_id,
        'company_id', p.company_id,
        'company_code', p.company_code,
        'company_name', p.company_name,
        'journey_type', p.journey_type,
        'total_points', p.total_points,
        'level', p.level,
        'village_id', p.village_id,
        'data', coalesce(p.data, '{}'::jsonb)
      )
      order by coalesce(nullif(trim(p.full_name), ''), p.email)
    ),
    '[]'::jsonb
  )
    into v_peers
  from public.profiles p
  where (p_include_self or p.id <> v_uid)
    and public._is_learner_role(p.role)
    and (
      p.id = v_uid
      or public._peer_shares_org_scope(v_me, p)
    )
    and nullif(trim(coalesce(p.email, '')), '') is not null;

  return jsonb_build_object('ok', true, 'peers', coalesce(v_peers, '[]'::jsonb));
end;
$$;

-- Same village_id awareness for points ledger scope guard (from 0039).
create or replace function public.list_org_points_ledger()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_me     public.profiles%rowtype;
  v_rows   jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  if public._is_free_non_org_learner(v_me) then
    perform public.ensure_free_user_village();
    select * into v_me from public.profiles where id = v_uid;
  end if;

  if nullif(trim(coalesce(v_me.organization_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.company_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.company_code, '')), '') is null
     and nullif(trim(coalesce(v_me.village_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.data->>'corporateVillageId', '')), '') is null
     and nullif(trim(coalesce(v_me.data->>'villageId', '')), '') is null
     and nullif(trim(coalesce(v_me.data->>'cohortIdentifier', '')), '') is null
  then
    return jsonb_build_object('ok', false, 'error', 'no_organization');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pl.id,
        'userId', pl.uid,
        'points', pl.points,
        'activityId', pl.activity_id,
        'weekNumber', pl.week_number,
        'createdAt', pl.created_at
      )
      order by pl.created_at desc
    ),
    '[]'::jsonb
  )
    into v_rows
  from public.points_ledger pl
  join public.profiles p on p.id = pl.uid
  where public._is_learner_role(p.role)
    and (
      p.id = v_uid
      or public._peer_shares_org_scope(v_me, p)
    );

  return jsonb_build_object('ok', true, 'rows', coalesce(v_rows, '[]'::jsonb));
end;
$$;

-- Block free users from creating private villages; send them to the shared one.
create or replace function public.create_my_village(
  p_name text,
  p_description text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_not_found';
  end if;

  if public._is_free_non_org_learner(v_me) then
    v_result := public.ensure_free_user_village();
    return jsonb_build_object(
      'id', public.free_users_village_id(),
      'name', 'Free Learners Village',
      'description', 'Shared community for all free Transformation Leader learners.',
      'creatorId', v_uid,
      'memberCount', null,
      'isActive', true,
      'shared', true
    );
  end if;

  raise exception 'private_villages_disabled'
    using hint = 'Free learners join the shared Free Learners Village automatically.';
end;
$$;
