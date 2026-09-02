-- ============================================================================
-- T4L  ·  Peer match race notifications
-- 0090: When a weekly peer match is created, notify both people immediately
-- with the beat-your-match 1,000-point race rule.
-- ============================================================================

create or replace function public._profile_display_name(p public.profiles)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(p.full_name), ''),
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
    nullif(trim(p.email), ''),
    'a peer'
  );
$$;

create or replace function public._notify_peer_match_pair(
  p_user_a uuid,
  p_user_b uuid,
  p_match_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a public.profiles%rowtype;
  v_b public.profiles%rowtype;
  v_name_a text;
  v_name_b text;
begin
  select * into v_a from public.profiles where id = p_user_a;
  select * into v_b from public.profiles where id = p_user_b;
  if not found then
    return;
  end if;

  v_name_a := public._profile_display_name(v_a);
  v_name_b := public._profile_display_name(v_b);

  -- Notify A about B
  insert into public.notifications (
    id, uid, type, notification_type, title, message, is_read, related_id, data, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    p_user_a,
    'peer_match',
    'peer_match',
    'You''re matched this week',
    'You are matched with ' || v_name_b ||
      '. Gain more points than them this week to earn 1,000 points. If you don''t outscore them, you get nothing.',
    false,
    p_match_key,
    jsonb_build_object(
      'matchKey', p_match_key,
      'peerUid', p_user_b,
      'peerName', v_name_b,
      'actionUrl', '/app/peer-connect',
      'actionLabel', 'Open Peer Connect',
      'racePoints', 1000
    ),
    now(),
    now()
  );

  -- Notify B about A
  insert into public.notifications (
    id, uid, type, notification_type, title, message, is_read, related_id, data, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    p_user_b,
    'peer_match',
    'peer_match',
    'You''re matched this week',
    'You are matched with ' || v_name_a ||
      '. Gain more points than them this week to earn 1,000 points. If you don''t outscore them, you get nothing.',
    false,
    p_match_key,
    jsonb_build_object(
      'matchKey', p_match_key,
      'peerUid', p_user_a,
      'peerName', v_name_a,
      'actionUrl', '/app/peer-connect',
      'actionLabel', 'Open Peer Connect',
      'racePoints', 1000
    ),
    now(),
    now()
  );
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
    uid, peer_uid, match_key, match_reason, match_status,
    match_refresh_preference, preferred_match_day, refresh_count,
    automated_match, created_at, last_refresh_at, updated_at
  ) values (
    v_uid, v_peer_id, v_key,
    'Weekly points race. Outscore your match for 1,000 points',
    'new', v_pref, v_day, 0, true, now(), now(), now()
  )
  returning * into v_existing;

  v_created := true;

  insert into public.peer_weekly_matches (
    uid, peer_uid, match_key, match_reason, match_status,
    match_refresh_preference, preferred_match_day, refresh_count,
    automated_match, created_at, last_refresh_at, updated_at
  ) values (
    v_peer_id, v_uid, v_key,
    'Weekly points race. Outscore your match for 1,000 points',
    'new', v_pref, v_day, 0, true, now(), now(), now()
  )
  on conflict (uid, match_key) do nothing;

  perform public._notify_peer_match_pair(v_uid, v_peer_id, v_key);

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
  v_created boolean := false;
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
    v_uid, p_peer_uid, v_key,
    'Weekly points race. Outscore your match for 1,000 points',
    'new', v_pref, v_day, 0, true, now(), now(), now()
  )
  returning * into v_existing;

  v_created := true;

  insert into public.peer_weekly_matches (
    uid, peer_uid, match_key, match_reason, match_status,
    match_refresh_preference, preferred_match_day, refresh_count,
    automated_match, created_at, last_refresh_at, updated_at
  ) values (
    p_peer_uid, v_uid, v_key,
    'Weekly points race. Outscore your match for 1,000 points',
    'new', v_pref, v_day, 0, true, now(), now(), now()
  )
  on conflict (uid, match_key) do nothing;

  perform public._notify_peer_match_pair(v_uid, p_peer_uid, v_key);

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

revoke all on function public._profile_display_name(public.profiles) from public;
revoke all on function public._notify_peer_match_pair(uuid, uuid, text) from public;
grant execute on function public.ensure_my_current_peer_match(text, text, integer) to authenticated;
grant execute on function public.assign_my_peer_match(text, uuid, text, integer) to authenticated;
