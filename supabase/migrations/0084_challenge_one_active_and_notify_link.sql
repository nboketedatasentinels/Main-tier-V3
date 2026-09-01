-- ============================================================================
-- One open challenge per learner; challenge notifications deep-link to accept.
-- ============================================================================
-- Rules:
--   * A learner may only be in one pending or active challenge at a time
--     (as challenger or challenged). Declined / cancelled / completed free them.
--   * create_challenge notifications include actionUrl so the recipient's OK
--     opens the Challenges tab focused on that invite.
-- ============================================================================

create or replace function public._user_has_open_challenge(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.challenges c
    where c.status in ('pending', 'active')
      and (c.challenger_id = p_uid or c.challenged_id = p_uid)
  );
$$;

create or replace function public.list_challenge_busy_user_ids()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ids jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select coalesce(jsonb_agg(distinct uid), '[]'::jsonb)
    into v_ids
  from (
    select c.challenger_id as uid
    from public.challenges c
    where c.status in ('pending', 'active')
    union
    select c.challenged_id as uid
    from public.challenges c
    where c.status in ('pending', 'active')
  ) busy;

  return jsonb_build_object('ok', true, 'user_ids', coalesce(v_ids, '[]'::jsonb));
end;
$$;

create or replace function public.create_challenge(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_peer public.profiles%rowtype;
  v_peer_id uuid;
  v_type text;
  v_duration text;
  v_start timestamptz;
  v_end timestamptz;
  v_desc text;
  v_goal text;
  v_id uuid;
  v_challenger_name text;
  v_challenged_name text;
  v_action_url text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_peer_id := nullif(trim(coalesce(p->>'challenged_id', '')), '')::uuid;
  if v_peer_id is null then
    return jsonb_build_object('ok', false, 'error', 'opponent_required');
  end if;
  if v_peer_id = v_uid then
    return jsonb_build_object('ok', false, 'error', 'cannot_challenge_self');
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;
  if not public._is_learner_role(v_me.role) then
    return jsonb_build_object('ok', false, 'error', 'learners_only');
  end if;

  select * into v_peer from public.profiles where id = v_peer_id;
  if not found or not public._is_learner_role(v_peer.role) then
    return jsonb_build_object('ok', false, 'error', 'opponent_not_found');
  end if;

  if not public._peer_shares_org_scope(v_me, v_peer) then
    return jsonb_build_object('ok', false, 'error', 'different_organization');
  end if;

  -- One open challenge per person (challenger and challenged).
  if public._user_has_open_challenge(v_uid) then
    return jsonb_build_object('ok', false, 'error', 'you_already_in_challenge');
  end if;
  if public._user_has_open_challenge(v_peer_id) then
    return jsonb_build_object('ok', false, 'error', 'opponent_already_in_challenge');
  end if;

  v_type := coalesce(nullif(trim(p->>'type'), ''), 'competitive');
  if v_type not in ('competitive', 'collaborative') then
    v_type := 'competitive';
  end if;

  v_duration := coalesce(nullif(trim(p->>'duration'), ''), 'weekly');
  v_start := date_trunc('day', now());
  v_end := case
    when v_duration = 'monthly' then v_start + interval '30 days' + interval '23 hours 59 minutes 59 seconds'
    else v_start + interval '7 days' + interval '23 hours 59 minutes 59 seconds'
  end;

  v_goal := case when v_type = 'collaborative' then nullif(trim(coalesce(p->>'custom_goal', '')), '') else null end;
  v_desc := coalesce(
    nullif(trim(coalesce(p->>'description', '')), ''),
    initcap(v_duration) || ' ' || v_type || ' challenge'
  );

  v_challenger_name := coalesce(
    nullif(trim(v_me.full_name), ''),
    nullif(trim(concat_ws(' ', v_me.first_name, v_me.last_name)), ''),
    v_me.email,
    'Member'
  );
  v_challenged_name := coalesce(
    nullif(trim(v_peer.full_name), ''),
    nullif(trim(concat_ws(' ', v_peer.first_name, v_peer.last_name)), ''),
    v_peer.email,
    'Member'
  );

  insert into public.challenges (
    challenger_id, challenged_id,
    challenger_name, challenged_name,
    challenger_email, challenged_email,
    company_id, company_code, company_name,
    participants, status, type, custom_goal, description,
    start_date, end_date
  ) values (
    v_uid, v_peer_id,
    v_challenger_name, v_challenged_name,
    v_me.email, v_peer.email,
    coalesce(v_me.organization_id::text, v_me.company_id::text),
    v_me.company_code,
    v_me.company_name,
    array[v_uid, v_peer_id],
    'pending', v_type, v_goal, v_desc,
    v_start, v_end
  )
  returning id into v_id;

  v_action_url := '/app/leaderboard?tab=challenges&challengeId=' || v_id::text;

  insert into public.notifications (
    id, uid, type, notification_type, title, message, is_read, related_id, data, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    v_peer_id,
    'challenge_request',
    'challenge_request',
    'New challenge',
    v_challenger_name || ' challenged you. Open to accept or decline.',
    false,
    v_id::text,
    jsonb_build_object(
      'challengeId', v_id,
      'challengerId', v_uid,
      'challengerName', v_challenger_name,
      'type', v_type,
      'actionUrl', v_action_url
    ),
    now(), now()
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'start_date', v_start,
    'end_date', v_end,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.list_challenge_busy_user_ids() from public;
grant execute on function public.list_challenge_busy_user_ids() to authenticated;
grant execute on function public.create_challenge(jsonb) to authenticated;
