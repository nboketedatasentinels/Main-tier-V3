-- ============================================================================
-- T4L  ·  Peer Connect — list org peers (Supabase)
-- 0037: SECURITY DEFINER RPCs so authenticated learners can load peer
-- profiles in their organisation without direct Firestore (or broad
-- profiles SELECT) access.
--
-- After the auth cutover, Peer Connect still queried Firestore `profiles`
-- with Firebase `request.auth` null → permission-denied. These RPCs are the
-- intended read path: auth.uid() must be set, and only same-org mates are
-- returned.
--
-- Safe to re-run (idempotent).
-- ============================================================================

-- ── helpers: does peer share the caller's org scope? ──────────────────────────
create or replace function public._peer_shares_org_scope(
  p_me public.profiles,
  p_peer public.profiles
)
returns boolean
language sql
stable
as $$
  select
    -- UUID / text org id (claim RPCs stamp both organization_id and company_id)
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
    -- Org / company code
    or (
      nullif(trim(coalesce(p_me.company_code, '')), '') is not null
      and upper(trim(coalesce(p_peer.company_code, ''))) = upper(trim(p_me.company_code))
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
    -- Cohort
    or (
      nullif(trim(coalesce(p_me.data->>'cohortIdentifier', '')), '') is not null
      and coalesce(p_peer.data->>'cohortIdentifier', '') = p_me.data->>'cohortIdentifier'
    );
$$;

-- ── list peers in the caller's organisation ───────────────────────────────────
-- p_include_self: Peer Connect excludes the caller; Leadership Board includes them.
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

  if nullif(trim(coalesce(v_me.organization_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.company_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.company_code, '')), '') is null
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
        'data', coalesce(p.data, '{}'::jsonb)
      )
      order by coalesce(nullif(trim(p.full_name), ''), p.email)
    ),
    '[]'::jsonb
  )
    into v_peers
  from public.profiles p
  where (p_include_self or p.id <> v_uid)
    and (
      p.id = v_uid
      or public._peer_shares_org_scope(v_me, p)
    )
    and nullif(trim(coalesce(p.email, '')), '') is not null;

  return jsonb_build_object('ok', true, 'peers', coalesce(v_peers, '[]'::jsonb));
end;
$$;

-- ── org points ledger (for leaderboard timeframes / breakdown) ────────────────
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

  if nullif(trim(coalesce(v_me.organization_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.company_id::text, '')), '') is null
     and nullif(trim(coalesce(v_me.company_code, '')), '') is null
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
  where p.id = v_uid
     or public._peer_shares_org_scope(v_me, p);

  return jsonb_build_object('ok', true, 'rows', coalesce(v_rows, '[]'::jsonb));
end;
$$;

-- ── single peer profile (same-org only) ───────────────────────────────────────
create or replace function public.get_peer_profile(p_peer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_me   public.profiles%rowtype;
  v_peer public.profiles%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_peer_id is null then
    return jsonb_build_object('ok', false, 'error', 'peer_id_required');
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  select * into v_peer from public.profiles where id = p_peer_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Own profile is always allowed (edge case for rematch tooling).
  if v_peer.id <> v_uid and not public._peer_shares_org_scope(v_me, v_peer) then
    return jsonb_build_object('ok', false, 'error', 'permission_denied');
  end if;

  return jsonb_build_object(
    'ok', true,
    'peer', jsonb_build_object(
      'id', v_peer.id,
      'email', v_peer.email,
      'full_name', v_peer.full_name,
      'first_name', v_peer.first_name,
      'last_name', v_peer.last_name,
      'role', v_peer.role,
      'membership_status', v_peer.membership_status,
      'organization_id', v_peer.organization_id,
      'company_id', v_peer.company_id,
      'company_code', v_peer.company_code,
      'company_name', v_peer.company_name,
      'journey_type', v_peer.journey_type,
      'total_points', v_peer.total_points,
      'level', v_peer.level,
      'data', coalesce(v_peer.data, '{}'::jsonb)
    )
  );
end;
$$;

revoke all on function public._peer_shares_org_scope(public.profiles, public.profiles) from public;
revoke all on function public.list_org_peers(boolean) from public;
revoke all on function public.list_org_points_ledger() from public;
revoke all on function public.get_peer_profile(uuid) from public;

grant execute on function public.list_org_peers(boolean) to authenticated;
grant execute on function public.list_org_points_ledger() to authenticated;
grant execute on function public.get_peer_profile(uuid) to authenticated;

-- Drop zero-arg overload if an earlier draft of this migration created it.
drop function if exists public.list_org_peers();
