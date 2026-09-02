-- ============================================================================
-- Challenges are collaborative only (competitive option retired).
-- ============================================================================

alter table public.challenges
  alter column type set default 'collaborative';

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
  v_type text := 'collaborative';
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

  if public._user_has_open_challenge(v_uid) then
    return jsonb_build_object('ok', false, 'error', 'you_already_in_challenge');
  end if;
  if public._user_has_open_challenge(v_peer_id) then
    return jsonb_build_object('ok', false, 'error', 'opponent_already_in_challenge');
  end if;

  -- Competitive is retired; always create collaborative challenges.
  v_type := 'collaborative';

  v_duration := coalesce(nullif(trim(p->>'duration'), ''), 'weekly');
  v_start := date_trunc('day', now());
  v_end := case
    when v_duration = 'monthly' then v_start + interval '30 days' + interval '23 hours 59 minutes 59 seconds'
    else v_start + interval '7 days' + interval '23 hours 59 minutes 59 seconds'
  end;

  v_goal := nullif(trim(coalesce(p->>'custom_goal', '')), '');
  v_desc := coalesce(
    nullif(trim(coalesce(p->>'description', '')), ''),
    initcap(v_duration) || ' collaborative challenge'
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
    v_challenger_name || ' invited you to a collaborative challenge. Open to accept or decline.',
    false,
    v_id::text,
    jsonb_build_object(
      'challengeId', v_id::text,
      'actionUrl', v_action_url,
      'challengerId', v_uid::text,
      'challengerName', v_challenger_name
    ),
    now(),
    now()
  );

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
