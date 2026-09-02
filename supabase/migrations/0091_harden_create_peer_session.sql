-- ============================================================================
-- T4L  ·  Harden create_peer_session
-- 0091: Catch unhandled exceptions (bad timezone formatting, invalid UUID
-- casts, notification insert failures) so the client gets a clear ok:false
-- payload instead of a PostgREST 500 / opaque failure. Soften minimum peers
-- to 1 (host + one friend). Make invite notifications best-effort.
--
-- Safe to re-run (idempotent replace).
-- ============================================================================

create or replace function public.create_peer_session(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles%rowtype;
  v_peer public.profiles%rowtype;
  v_participant_ids uuid[] := '{}';
  v_raw_participants jsonb;
  v_raw_id text;
  v_participant_id uuid;
  v_title text;
  v_description text;
  v_platform text;
  v_meeting_link text;
  v_timezone text;
  v_scheduled_at timestamptz;
  v_deadline timestamptz;
  v_session_id uuid;
  v_creator_name text;
  v_creator_email text;
  v_invite_message text;
  v_when_label text;
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

  v_title := nullif(trim(coalesce(p->>'title', '')), '');
  if v_title is null then
    return jsonb_build_object('ok', false, 'error', 'title_required');
  end if;

  v_description := nullif(trim(coalesce(p->>'description', '')), '');
  v_platform := coalesce(nullif(trim(p->>'platform'), ''), 'Zoom');
  if v_platform not in ('Zoom', 'Google Meet', 'Zoho Meet') then
    v_platform := 'Zoom';
  end if;
  v_meeting_link := nullif(trim(coalesce(p->>'meeting_link', p->>'meetingLink', '')), '');
  v_timezone := coalesce(nullif(trim(p->>'timezone'), ''), 'UTC');

  begin
    v_scheduled_at := (p->>'scheduled_at')::timestamptz;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_scheduled_at');
  end;

  if v_scheduled_at is null or v_scheduled_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'scheduled_at_must_be_future');
  end if;

  v_deadline := v_scheduled_at - interval '2 hours';

  v_raw_participants := coalesce(p->'participants', '[]'::jsonb);
  if jsonb_typeof(v_raw_participants) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'participants_required');
  end if;

  for v_raw_id in
    select distinct nullif(trim(elem), '')
    from jsonb_array_elements_text(v_raw_participants) as t(elem)
    where nullif(trim(elem), '') is not null
  loop
    begin
      v_participant_id := v_raw_id::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'participant_not_found', 'participant_id', v_raw_id);
    end;

    if v_participant_id = v_uid then
      continue;
    end if;

    select * into v_peer from public.profiles where id = v_participant_id;
    if not found or not public._is_learner_role(v_peer.role) then
      return jsonb_build_object('ok', false, 'error', 'participant_not_found', 'participant_id', v_participant_id);
    end if;
    if not public._peer_shares_org_scope(v_me, v_peer) then
      return jsonb_build_object('ok', false, 'error', 'different_organization', 'participant_id', v_participant_id);
    end if;

    v_participant_ids := array_append(v_participant_ids, v_participant_id);
  end loop;

  -- Host + at least one peer (organise with a friend)
  if coalesce(array_length(v_participant_ids, 1), 0) < 1 then
    return jsonb_build_object('ok', false, 'error', 'min_participants');
  end if;

  v_creator_name := coalesce(
    nullif(trim(coalesce(p->>'creator_name', '')), ''),
    nullif(trim(v_me.full_name), ''),
    nullif(trim(concat_ws(' ', v_me.first_name, v_me.last_name)), ''),
    v_me.email,
    'Peer'
  );
  v_creator_email := coalesce(
    nullif(trim(coalesce(p->>'creator_email', '')), ''),
    v_me.email,
    ''
  );

  begin
    insert into public.peer_sessions (
      title,
      description,
      platform,
      meeting_link,
      timezone,
      participants,
      status,
      scheduled_at,
      confirmation_deadline,
      confirmations,
      created_by,
      points_awarded,
      created_at,
      updated_at
    ) values (
      v_title,
      v_description,
      v_platform,
      v_meeting_link,
      v_timezone,
      array_prepend(v_uid, v_participant_ids),
      'scheduled',
      v_scheduled_at,
      v_deadline,
      jsonb_build_object(v_uid::text, true),
      v_uid,
      false,
      now(),
      now()
    )
    returning id into v_session_id;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'insert_failed', 'detail', sqlerrm);
  end;

  begin
    v_when_label := to_char(v_scheduled_at at time zone v_timezone, 'Dy, Mon DD YYYY HH12:MI AM');
  exception when others then
    v_when_label := to_char(v_scheduled_at at time zone 'UTC', 'Dy, Mon DD YYYY HH12:MI AM') || ' UTC';
  end;

  v_invite_message := v_creator_name || ' invited you to "' || v_title || '" on ' || v_when_label || '.';

  foreach v_participant_id in array v_participant_ids loop
    begin
      insert into public.peer_session_requests (
        session_id,
        from_user_id,
        from_name,
        from_email,
        to_user_id,
        status,
        created_at
      ) values (
        v_session_id,
        v_uid,
        v_creator_name,
        v_creator_email,
        v_participant_id,
        'pending',
        now()
      );
    exception when others then
      -- Session already exists; skip this invite row rather than aborting.
      null;
    end;

    begin
      insert into public.notifications (
        id, uid, type, notification_type, title, message, is_read, related_id, data, created_at, updated_at
      ) values (
        gen_random_uuid()::text,
        v_participant_id,
        'session_request',
        'session_request',
        'Practical invitation',
        v_invite_message,
        false,
        v_session_id::text,
        jsonb_build_object(
          'sessionId', v_session_id,
          'actionUrl', '/app/peer-connect?sessionId=' || v_session_id::text,
          'actionLabel', 'View practical',
          'scheduledAt', v_scheduled_at,
          'timezone', v_timezone,
          'creatorName', v_creator_name
        ),
        now(),
        now()
      );
    exception when others then
      -- Notifications are best-effort; do not roll back the practical.
      null;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_session_id);
exception when others then
  return jsonb_build_object('ok', false, 'error', 'unexpected', 'detail', sqlerrm);
end;
$$;

revoke all on function public.create_peer_session(jsonb) from public;
grant execute on function public.create_peer_session(jsonb) to authenticated;
grant execute on function public.create_peer_session(jsonb) to service_role;
