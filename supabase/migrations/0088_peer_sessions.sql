-- ============================================================================
-- T4L  ·  Peer practical sessions (Supabase)
-- 0088: Peer Connect "Start a practical meetup" still wrote Firestore
-- peer_sessions after the auth cutover → permission-denied.
-- Adapt legacy empty peer_sessions / peer_session_requests (or create fresh).
--
-- Safe to re-run (idempotent).
-- ============================================================================

do $$
declare
  v_exists boolean;
  v_has_created_by boolean;
  v_row_count bigint;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'peer_sessions'
  ) into v_exists;

  if not v_exists then
    create table public.peer_sessions (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      description text,
      platform text not null default 'Zoom'
        check (platform in ('Zoom', 'Google Meet', 'Zoho Meet')),
      meeting_link text,
      timezone text not null default 'UTC',
      participants uuid[] not null default '{}',
      status text not null default 'scheduled'
        check (status in ('pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'no_show')),
      scheduled_at timestamptz not null,
      confirmation_deadline timestamptz not null,
      confirmations jsonb not null default '{}'::jsonb,
      no_shows jsonb not null default '{}'::jsonb,
      reminder_notifications jsonb not null default '{}'::jsonb,
      created_by uuid not null references public.profiles(id) on delete cascade,
      points_awarded boolean not null default false,
      missed_at timestamptz,
      missed_by text,
      missed_reason text,
      confirmed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  else
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'peer_sessions'
        and column_name = 'created_by'
    ) into v_has_created_by;

    if not v_has_created_by then
      execute 'select count(*) from public.peer_sessions' into v_row_count;
      if v_row_count = 0 then
        drop table public.peer_sessions cascade;
        create table public.peer_sessions (
          id uuid primary key default gen_random_uuid(),
          title text not null,
          description text,
          platform text not null default 'Zoom'
            check (platform in ('Zoom', 'Google Meet', 'Zoho Meet')),
          meeting_link text,
          timezone text not null default 'UTC',
          participants uuid[] not null default '{}',
          status text not null default 'scheduled'
            check (status in ('pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'no_show')),
          scheduled_at timestamptz not null,
          confirmation_deadline timestamptz not null,
          confirmations jsonb not null default '{}'::jsonb,
          no_shows jsonb not null default '{}'::jsonb,
          reminder_notifications jsonb not null default '{}'::jsonb,
          created_by uuid not null references public.profiles(id) on delete cascade,
          points_awarded boolean not null default false,
          missed_at timestamptz,
          missed_by text,
          missed_reason text,
          confirmed_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      else
        raise exception 'peer_sessions exists without created_by and is not empty; manual migration required';
      end if;
    end if;
  end if;
end $$;

alter table public.peer_sessions
  add column if not exists confirmations jsonb not null default '{}'::jsonb;
alter table public.peer_sessions
  add column if not exists no_shows jsonb not null default '{}'::jsonb;
alter table public.peer_sessions
  add column if not exists reminder_notifications jsonb not null default '{}'::jsonb;
alter table public.peer_sessions
  add column if not exists missed_reason text;

do $$
declare
  v_exists boolean;
  v_has_from_user boolean;
  v_row_count bigint;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'peer_session_requests'
  ) into v_exists;

  if not v_exists then
    create table public.peer_session_requests (
      id uuid primary key default gen_random_uuid(),
      session_id uuid not null references public.peer_sessions(id) on delete cascade,
      from_user_id uuid not null references public.profiles(id) on delete cascade,
      from_name text,
      from_email text,
      to_user_id uuid not null references public.profiles(id) on delete cascade,
      status text not null default 'pending'
        check (status in ('pending', 'accepted', 'declined')),
      created_at timestamptz not null default now(),
      responded_at timestamptz
    );
  else
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'peer_session_requests'
        and column_name = 'from_user_id'
    ) into v_has_from_user;

    if not v_has_from_user then
      execute 'select count(*) from public.peer_session_requests' into v_row_count;
      if v_row_count = 0 then
        drop table public.peer_session_requests cascade;
        create table public.peer_session_requests (
          id uuid primary key default gen_random_uuid(),
          session_id uuid not null references public.peer_sessions(id) on delete cascade,
          from_user_id uuid not null references public.profiles(id) on delete cascade,
          from_name text,
          from_email text,
          to_user_id uuid not null references public.profiles(id) on delete cascade,
          status text not null default 'pending'
            check (status in ('pending', 'accepted', 'declined')),
          created_at timestamptz not null default now(),
          responded_at timestamptz
        );
      else
        raise exception 'peer_session_requests exists without from_user_id and is not empty; manual migration required';
      end if;
    end if;
  end if;
end $$;

create index if not exists peer_sessions_created_by_idx
  on public.peer_sessions (created_by, scheduled_at desc);

create index if not exists peer_sessions_participants_gin
  on public.peer_sessions using gin (participants);

create index if not exists peer_sessions_scheduled_at_idx
  on public.peer_sessions (scheduled_at desc);

create index if not exists peer_session_requests_to_user_idx
  on public.peer_session_requests (to_user_id, status, created_at desc);

create index if not exists peer_session_requests_from_user_idx
  on public.peer_session_requests (from_user_id, created_at desc);

create index if not exists peer_session_requests_session_idx
  on public.peer_session_requests (session_id);

alter table public.peer_sessions enable row level security;
alter table public.peer_session_requests enable row level security;

drop policy if exists peer_sessions_select_participant on public.peer_sessions;
create policy peer_sessions_select_participant
  on public.peer_sessions
  for select
  to authenticated
  using (auth.uid() = created_by or auth.uid() = any (participants));

drop policy if exists peer_sessions_update_participant on public.peer_sessions;
create policy peer_sessions_update_participant
  on public.peer_sessions
  for update
  to authenticated
  using (auth.uid() = created_by or auth.uid() = any (participants))
  with check (auth.uid() = created_by or auth.uid() = any (participants));

drop policy if exists peer_session_requests_select_own on public.peer_session_requests;
create policy peer_session_requests_select_own
  on public.peer_session_requests
  for select
  to authenticated
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

drop policy if exists peer_session_requests_update_recipient on public.peer_session_requests;
create policy peer_session_requests_update_recipient
  on public.peer_session_requests
  for update
  to authenticated
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

create or replace function public._peer_session_json(p public.peer_sessions)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'description', p.description,
    'platform', p.platform,
    'meetingLink', p.meeting_link,
    'timezone', p.timezone,
    'participants', to_jsonb(p.participants),
    'status', p.status,
    'scheduledAt', p.scheduled_at,
    'confirmationDeadline', p.confirmation_deadline,
    'confirmations', coalesce(p.confirmations, '{}'::jsonb),
    'noShows', coalesce(p.no_shows, '{}'::jsonb),
    'createdBy', p.created_by,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at,
    'pointsAwarded', p.points_awarded,
    'confirmedAt', p.confirmed_at
  );
$$;

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

  for v_participant_id in
    select distinct nullif(trim(elem), '')::uuid
    from jsonb_array_elements_text(v_raw_participants) as t(elem)
    where nullif(trim(elem), '') is not null
  loop
    if v_participant_id is null or v_participant_id = v_uid then
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

  if coalesce(array_length(v_participant_ids, 1), 0) < 2 then
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

  v_when_label := to_char(v_scheduled_at at time zone v_timezone, 'Dy, Mon DD YYYY HH12:MI AM');
  v_invite_message := v_creator_name || ' invited you to "' || v_title || '" on ' || v_when_label || '.';

  foreach v_participant_id in array v_participant_ids loop
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
  end loop;

  return jsonb_build_object('ok', true, 'id', v_session_id);
end;
$$;

create or replace function public.list_my_peer_sessions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select coalesce(jsonb_agg(public._peer_session_json(s) order by s.scheduled_at desc), '[]'::jsonb)
    into v_rows
  from public.peer_sessions s
  where s.created_by = v_uid or v_uid = any (s.participants);

  return jsonb_build_object('ok', true, 'sessions', coalesce(v_rows, '[]'::jsonb));
end;
$$;

create or replace function public.list_my_peer_session_invites()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'sessionId', r.session_id,
        'fromUserId', r.from_user_id,
        'fromName', r.from_name,
        'fromEmail', r.from_email,
        'toUserId', r.to_user_id,
        'status', r.status,
        'createdAt', r.created_at,
        'respondedAt', r.responded_at
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
    into v_rows
  from public.peer_session_requests r
  where r.to_user_id = v_uid
    and r.status = 'pending';

  return jsonb_build_object('ok', true, 'invites', coalesce(v_rows, '[]'::jsonb));
end;
$$;

create or replace function public.confirm_peer_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.peer_sessions%rowtype;
  v_all_confirmed boolean := false;
  v_should_award boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_session from public.peer_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_uid <> v_session.created_by and not (v_uid = any (v_session.participants)) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_session.confirmations := coalesce(v_session.confirmations, '{}'::jsonb) || jsonb_build_object(v_uid::text, true);

  select bool_and(coalesce((v_session.confirmations ->> pid::text)::boolean, false))
    into v_all_confirmed
  from unnest(v_session.participants) as pid;

  if coalesce(v_all_confirmed, false) and not v_session.points_awarded then
    v_should_award := true;
    update public.peer_sessions
    set confirmations = v_session.confirmations,
        status = 'confirmed',
        points_awarded = true,
        confirmed_at = now(),
        updated_at = now()
    where id = p_session_id
    returning * into v_session;
  else
    update public.peer_sessions
    set confirmations = v_session.confirmations,
        updated_at = now()
    where id = p_session_id
    returning * into v_session;
  end if;

  return jsonb_build_object(
    'ok', true,
    'allConfirmed', coalesce(v_all_confirmed, false),
    'pointsAwarded', v_should_award,
    'participants', to_jsonb(v_session.participants),
    'session', public._peer_session_json(v_session)
  );
end;
$$;

create or replace function public.respond_peer_session_invite(p_invite_id uuid, p_accepted boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.peer_session_requests%rowtype;
  v_session public.peer_sessions%rowtype;
  v_me public.profiles%rowtype;
  v_invitee_name text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_invite from public.peer_session_requests where id = p_invite_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_invite.to_user_id <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_invite.status <> 'pending' then
    return jsonb_build_object('ok', true, 'already_responded', true);
  end if;

  update public.peer_session_requests
  set status = case when p_accepted then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if p_accepted then
    select * into v_session from public.peer_sessions where id = v_invite.session_id;
    select * into v_me from public.profiles where id = v_uid;
    v_invitee_name := coalesce(
      nullif(trim(v_me.full_name), ''),
      nullif(trim(concat_ws(' ', v_me.first_name, v_me.last_name)), ''),
      v_me.email,
      'Peer'
    );

    insert into public.notifications (
      id, uid, type, notification_type, title, message, is_read, related_id, data, created_at, updated_at
    ) values (
      gen_random_uuid()::text,
      v_invite.from_user_id,
      'session_request',
      'session_request',
      'Practical invitation accepted',
      v_invitee_name || ' accepted your invitation to "' || coalesce(v_session.title, 'Practical meetup') || '".',
      false,
      v_invite.session_id::text,
      jsonb_build_object(
        'sessionId', v_invite.session_id,
        'actionUrl', '/app/peer-connect?sessionId=' || v_invite.session_id::text,
        'actionLabel', 'View practical',
        'acceptedBy', v_invitee_name,
        'status', 'accepted'
      ),
      now(),
      now()
    );
  end if;

  return jsonb_build_object('ok', true, 'accepted', p_accepted);
end;
$$;

create or replace function public.report_peer_session_no_show(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.peer_sessions%rowtype;
  v_already boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_session from public.peer_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_uid <> v_session.created_by and not (v_uid = any (v_session.participants)) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_already := coalesce((v_session.no_shows ->> v_uid::text)::boolean, false);
  if v_already then
    return jsonb_build_object('ok', true, 'already_reported', true, 'award_points', false);
  end if;

  update public.peer_sessions
  set status = 'no_show',
      no_shows = coalesce(no_shows, '{}'::jsonb) || jsonb_build_object(v_uid::text, true),
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('ok', true, 'already_reported', false, 'award_points', true);
end;
$$;

create or replace function public.mark_peer_session_missed_if_elapsed(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.peer_sessions%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_session from public.peer_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_uid <> v_session.created_by and not (v_uid = any (v_session.participants)) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_session.status in ('completed', 'no_show') then
    return jsonb_build_object('ok', true, 'marked', false);
  end if;
  if now() < v_session.scheduled_at + interval '2 hours' then
    return jsonb_build_object('ok', true, 'marked', false);
  end if;

  update public.peer_sessions
  set status = 'no_show',
      missed_at = now(),
      missed_by = 'system',
      missed_reason = 'auto_time_elapsed',
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('ok', true, 'marked', true);
end;
$$;

revoke all on function public._peer_session_json(public.peer_sessions) from public;
revoke all on function public.create_peer_session(jsonb) from public;
revoke all on function public.list_my_peer_sessions() from public;
revoke all on function public.list_my_peer_session_invites() from public;
revoke all on function public.confirm_peer_session(uuid) from public;
revoke all on function public.respond_peer_session_invite(uuid, boolean) from public;
revoke all on function public.report_peer_session_no_show(uuid) from public;
revoke all on function public.mark_peer_session_missed_if_elapsed(uuid) from public;

grant execute on function public.create_peer_session(jsonb) to authenticated;
grant execute on function public.list_my_peer_sessions() to authenticated;
grant execute on function public.list_my_peer_session_invites() to authenticated;
grant execute on function public.confirm_peer_session(uuid) to authenticated;
grant execute on function public.respond_peer_session_invite(uuid, boolean) to authenticated;
grant execute on function public.report_peer_session_no_show(uuid) to authenticated;
grant execute on function public.mark_peer_session_missed_if_elapsed(uuid) to authenticated;
