-- ============================================================================
-- T4L  ·  Harden peer auto-match
-- 0089: Never leave org members unmatched when peers exist.
-- Relax eligibility + add explicit assign fallback RPC.
-- ============================================================================

create or replace function public._peer_allows_matching(p_profile public.profiles)
returns boolean
language sql
stable
as $$
  select
    public._is_learner_role(p_profile.role)
    and nullif(trim(coalesce(p_profile.email, '')), '') is not null
    and coalesce(nullif(trim(coalesce(p_profile.data->>'mergedInto', '')), ''), '') = ''
    and case lower(trim(coalesce(p_profile.data->'privacySettings'->>'allowPeerMatching', 'true')))
      when 'false' then false
      when '0' then false
      when 'no' then false
      else true
    end
    and lower(trim(coalesce(p_profile.data->>'matchRefreshPreference', 'weekly'))) <> 'disabled';
$$;

create or replace function public._peer_is_match_candidate(
  p_me public.profiles,
  p_peer public.profiles
)
returns boolean
language sql
stable
as $$
  select
    p_peer.id <> p_me.id
    and public._is_learner_role(p_peer.role)
    and nullif(trim(coalesce(p_peer.email, '')), '') is not null
    and coalesce(nullif(trim(coalesce(p_peer.data->>'mergedInto', '')), ''), '') = ''
    and public._peer_shares_org_scope(p_me, p_peer)
    and case lower(trim(coalesce(p_peer.data->'privacySettings'->>'allowPeerMatching', 'true')))
      when 'false' then false
      when '0' then false
      when 'no' then false
      else true
    end;
$$;

create or replace function public.ensure_my_current_peer_match(
  p_match_key text,
  p_refresh_preference text default 'weekly',
  p_preferred_match_day integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_existing public.peer_weekly_matches%rowtype;
  v_peer_id uuid;
  v_pref text := lower(trim(coalesce(nullif(p_refresh_preference, ''), 'weekly')));
  v_day integer := coalesce(p_preferred_match_day, 1);
  v_key text := nullif(trim(coalesce(p_match_key, '')), '');
  v_created boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'missing_match_key');
  end if;

  if v_pref = 'disabled' then
    return jsonb_build_object('ok', false, 'error', 'matching_disabled');
  end if;

  if v_day < 0 or v_day > 6 then
    v_day := 1;
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  if public._is_free_non_org_learner(v_me) then
    perform public.ensure_free_user_village();
    select * into v_me from public.profiles where id = v_uid;
  end if;

  -- Caller must be a learner with matching enabled; do not hard-fail on soft preference noise.
  if not public._is_learner_role(v_me.role) then
    return jsonb_build_object('ok', false, 'error', 'matching_disabled');
  end if;
  if lower(trim(coalesce(v_me.data->>'matchRefreshPreference', 'weekly'))) = 'disabled' then
    return jsonb_build_object('ok', false, 'error', 'matching_disabled');
  end if;

  select * into v_existing
  from public.peer_weekly_matches
  where uid = v_uid and match_key = v_key
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'match', jsonb_build_object(
        'id', v_existing.id,
        'uid', v_existing.uid,
        'peer_uid', v_existing.peer_uid,
        'match_key', v_existing.match_key,
        'match_reason', v_existing.match_reason,
        'match_status', v_existing.match_status,
        'match_refresh_preference', v_existing.match_refresh_preference,
        'preferred_match_day', v_existing.preferred_match_day,
        'refresh_count', v_existing.refresh_count,
        'automated_match', v_existing.automated_match,
        'created_at', v_existing.created_at,
        'last_refresh_at', v_existing.last_refresh_at
      )
    );
  end if;

  -- Prefer fully matchable peers, then any org/village learner (same scope as list_org_peers).
  select p.id
    into v_peer_id
  from public.profiles p
  where public._peer_is_match_candidate(v_me, p)
  order by
    case when public._peer_allows_matching(p) then 0 else 1 end,
    random()
  limit 1;

  if v_peer_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_eligible_peers');
  end if;

  insert into public.peer_weekly_matches (
    uid,
    peer_uid,
    match_key,
    match_reason,
    match_status,
    match_refresh_preference,
    preferred_match_day,
    refresh_count,
    automated_match,
    created_at,
    last_refresh_at,
    updated_at
  ) values (
    v_uid,
    v_peer_id,
    v_key,
    'Automatic match for this week',
    'new',
    v_pref,
    v_day,
    0,
    true,
    now(),
    now(),
    now()
  )
  returning * into v_existing;

  v_created := true;

  insert into public.peer_weekly_matches (
    uid,
    peer_uid,
    match_key,
    match_reason,
    match_status,
    match_refresh_preference,
    preferred_match_day,
    refresh_count,
    automated_match,
    created_at,
    last_refresh_at,
    updated_at
  ) values (
    v_peer_id,
    v_uid,
    v_key,
    'Automatic match for this week',
    'new',
    v_pref,
    v_day,
    0,
    true,
    now(),
    now(),
    now()
  )
  on conflict (uid, match_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'match', jsonb_build_object(
      'id', v_existing.id,
      'uid', v_existing.uid,
      'peer_uid', v_existing.peer_uid,
      'match_key', v_existing.match_key,
      'match_reason', v_existing.match_reason,
      'match_status', v_existing.match_status,
      'match_refresh_preference', v_existing.match_refresh_preference,
      'preferred_match_day', v_existing.preferred_match_day,
      'refresh_count', v_existing.refresh_count,
      'automated_match', v_existing.automated_match,
      'created_at', v_existing.created_at,
      'last_refresh_at', v_existing.last_refresh_at
    )
  );
exception
  when unique_violation then
    select * into v_existing
    from public.peer_weekly_matches
    where uid = v_uid and match_key = v_key
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'created', false,
        'match', jsonb_build_object(
          'id', v_existing.id,
          'uid', v_existing.uid,
          'peer_uid', v_existing.peer_uid,
          'match_key', v_existing.match_key,
          'match_reason', v_existing.match_reason,
          'match_status', v_existing.match_status,
          'match_refresh_preference', v_existing.match_refresh_preference,
          'preferred_match_day', v_existing.preferred_match_day,
          'refresh_count', v_existing.refresh_count,
          'automated_match', v_existing.automated_match,
          'created_at', v_existing.created_at,
          'last_refresh_at', v_existing.last_refresh_at
        )
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'unique_violation');
end;
$$;

-- Explicit assign when the client already knows an org peer exists.
create or replace function public.assign_my_peer_match(
  p_match_key text,
  p_peer_uid uuid,
  p_refresh_preference text default 'weekly',
  p_preferred_match_day integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_peer public.profiles%rowtype;
  v_existing public.peer_weekly_matches%rowtype;
  v_pref text := lower(trim(coalesce(nullif(p_refresh_preference, ''), 'weekly')));
  v_day integer := coalesce(p_preferred_match_day, 1);
  v_key text := nullif(trim(coalesce(p_match_key, '')), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if v_key is null or p_peer_uid is null then
    return jsonb_build_object('ok', false, 'error', 'missing_match_key');
  end if;
  if p_peer_uid = v_uid then
    return jsonb_build_object('ok', false, 'error', 'cannot_match_self');
  end if;
  if v_pref = 'disabled' then
    return jsonb_build_object('ok', false, 'error', 'matching_disabled');
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  select * into v_existing
  from public.peer_weekly_matches
  where uid = v_uid and match_key = v_key
  limit 1;
  if found then
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'match', jsonb_build_object(
        'id', v_existing.id,
        'uid', v_existing.uid,
        'peer_uid', v_existing.peer_uid,
        'match_key', v_existing.match_key,
        'match_reason', v_existing.match_reason,
        'match_status', v_existing.match_status,
        'match_refresh_preference', v_existing.match_refresh_preference,
        'preferred_match_day', v_existing.preferred_match_day,
        'refresh_count', v_existing.refresh_count,
        'automated_match', v_existing.automated_match,
        'created_at', v_existing.created_at,
        'last_refresh_at', v_existing.last_refresh_at
      )
    );
  end if;

  select * into v_peer from public.profiles where id = p_peer_uid;
  if not found or not public._peer_is_match_candidate(v_me, v_peer) then
    return jsonb_build_object('ok', false, 'error', 'participant_not_found');
  end if;

  insert into public.peer_weekly_matches (
    uid, peer_uid, match_key, match_reason, match_status,
    match_refresh_preference, preferred_match_day, refresh_count,
    automated_match, created_at, last_refresh_at, updated_at
  ) values (
    v_uid, p_peer_uid, v_key, 'Automatic match for this week', 'new',
    v_pref, v_day, 0, true, now(), now(), now()
  )
  returning * into v_existing;

  insert into public.peer_weekly_matches (
    uid, peer_uid, match_key, match_reason, match_status,
    match_refresh_preference, preferred_match_day, refresh_count,
    automated_match, created_at, last_refresh_at, updated_at
  ) values (
    p_peer_uid, v_uid, v_key, 'Automatic match for this week', 'new',
    v_pref, v_day, 0, true, now(), now(), now()
  )
  on conflict (uid, match_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'match', jsonb_build_object(
      'id', v_existing.id,
      'uid', v_existing.uid,
      'peer_uid', v_existing.peer_uid,
      'match_key', v_existing.match_key,
      'match_reason', v_existing.match_reason,
      'match_status', v_existing.match_status,
      'match_refresh_preference', v_existing.match_refresh_preference,
      'preferred_match_day', v_existing.preferred_match_day,
      'refresh_count', v_existing.refresh_count,
      'automated_match', v_existing.automated_match,
      'created_at', v_existing.created_at,
      'last_refresh_at', v_existing.last_refresh_at
    )
  );
exception
  when unique_violation then
    select * into v_existing
    from public.peer_weekly_matches
    where uid = v_uid and match_key = v_key
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'created', false,
        'match', jsonb_build_object(
          'id', v_existing.id,
          'uid', v_existing.uid,
          'peer_uid', v_existing.peer_uid,
          'match_key', v_existing.match_key,
          'match_reason', v_existing.match_reason,
          'match_status', v_existing.match_status,
          'match_refresh_preference', v_existing.match_refresh_preference,
          'preferred_match_day', v_existing.preferred_match_day,
          'refresh_count', v_existing.refresh_count,
          'automated_match', v_existing.automated_match,
          'created_at', v_existing.created_at,
          'last_refresh_at', v_existing.last_refresh_at
        )
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'unique_violation');
end;
$$;

revoke all on function public._peer_is_match_candidate(public.profiles, public.profiles) from public;
revoke all on function public.assign_my_peer_match(text, uuid, text, integer) from public;
grant execute on function public.assign_my_peer_match(text, uuid, text, integer) to authenticated;
grant execute on function public.ensure_my_current_peer_match(text, text, integer) to authenticated;
