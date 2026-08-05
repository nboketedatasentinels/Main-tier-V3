-- ============================================================================
-- T4L  ·  Peer challenges (Supabase)
-- 0040: Replace Firestore `challenges` writes that fail after the auth cutover
-- (no Firebase session → permission-denied on create). Points for the
-- checklist "challenger" activity are awarded ONLY after end_date has passed
-- and the challenge was accepted/completed — never on create.
--
-- IMPORTANT: `public.challenges` may already exist from an earlier scaffold
-- with a different shape (no challenger_id). CREATE TABLE IF NOT EXISTS would
-- skip and then indexes/policies fail with 42703. This migration adapts the
-- existing table (or creates it) so it matches the app contract.
--
-- Safe to re-run (idempotent).
-- ============================================================================

-- Depends on learner-role helper from 0039; recreate if missing.
create or replace function public._is_learner_role(p_role text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_role, 'user'))) in ('user', 'free_user', 'paid_member');
$$;

-- Create only when missing. If a legacy empty/incompatible table exists, reshape it.
do $$
declare
  v_exists boolean;
  v_has_challenger boolean;
  v_row_count bigint;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'challenges'
  ) into v_exists;

  if not v_exists then
    create table public.challenges (
      id uuid primary key default gen_random_uuid(),
      challenger_id uuid not null references public.profiles(id) on delete cascade,
      challenged_id uuid not null references public.profiles(id) on delete cascade,
      challenger_name text,
      challenged_name text,
      challenger_email text,
      challenged_email text,
      company_id text,
      company_code text,
      company_name text,
      participants uuid[] not null default '{}',
      status text not null default 'pending'
        check (status in ('pending', 'active', 'completed', 'declined', 'cancelled')),
      type text not null default 'competitive'
        check (type in ('competitive', 'collaborative')),
      custom_goal text,
      description text,
      start_date timestamptz not null,
      end_date timestamptz not null,
      metrics jsonb not null default '{"challenger":{"total":0},"challenged":{"total":0}}'::jsonb,
      result jsonb not null default '{}'::jsonb,
      points_awarded boolean not null default false,
      responded_at timestamptz,
      accepted_at timestamptz,
      declined_at timestamptz,
      cancelled_by uuid,
      cancelled_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'challenges'
      and column_name = 'challenger_id'
  ) into v_has_challenger;

  if v_has_challenger then
    return;
  end if;

  -- Legacy table without challenger_id. If empty, drop and recreate.
  execute 'select count(*) from public.challenges' into v_row_count;
  if v_row_count = 0 then
    drop table public.challenges cascade;
    create table public.challenges (
      id uuid primary key default gen_random_uuid(),
      challenger_id uuid not null references public.profiles(id) on delete cascade,
      challenged_id uuid not null references public.profiles(id) on delete cascade,
      challenger_name text,
      challenged_name text,
      challenger_email text,
      challenged_email text,
      company_id text,
      company_code text,
      company_name text,
      participants uuid[] not null default '{}',
      status text not null default 'pending'
        check (status in ('pending', 'active', 'completed', 'declined', 'cancelled')),
      type text not null default 'competitive'
        check (type in ('competitive', 'collaborative')),
      custom_goal text,
      description text,
      start_date timestamptz not null,
      end_date timestamptz not null,
      metrics jsonb not null default '{"challenger":{"total":0},"challenged":{"total":0}}'::jsonb,
      result jsonb not null default '{}'::jsonb,
      points_awarded boolean not null default false,
      responded_at timestamptz,
      accepted_at timestamptz,
      declined_at timestamptz,
      cancelled_by uuid,
      cancelled_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    return;
  end if;

  -- Non-empty legacy table: add required columns so RPCs can run.
  alter table public.challenges
    add column if not exists challenger_id uuid references public.profiles(id) on delete cascade,
    add column if not exists challenged_id uuid references public.profiles(id) on delete cascade,
    add column if not exists challenger_name text,
    add column if not exists challenged_name text,
    add column if not exists challenger_email text,
    add column if not exists challenged_email text,
    add column if not exists company_id text,
    add column if not exists company_code text,
    add column if not exists company_name text,
    add column if not exists participants uuid[] default '{}',
    add column if not exists status text default 'pending',
    add column if not exists type text default 'competitive',
    add column if not exists custom_goal text,
    add column if not exists description text,
    add column if not exists start_date timestamptz,
    add column if not exists end_date timestamptz,
    add column if not exists metrics jsonb default '{"challenger":{"total":0},"challenged":{"total":0}}'::jsonb,
    add column if not exists result jsonb default '{}'::jsonb,
    add column if not exists points_awarded boolean default false,
    add column if not exists responded_at timestamptz,
    add column if not exists accepted_at timestamptz,
    add column if not exists declined_at timestamptz,
    add column if not exists cancelled_by uuid,
    add column if not exists cancelled_at timestamptz,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now();
end;
$$;

-- Ensure id is uuid with a default when a legacy text/uuid id exists without one.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'challenges' and column_name = 'id'
  ) then
    begin
      alter table public.challenges alter column id set default gen_random_uuid();
    exception when others then
      null;
    end;
  end if;
end;
$$;

create index if not exists challenges_challenger_idx on public.challenges (challenger_id, created_at desc);
create index if not exists challenges_challenged_idx on public.challenges (challenged_id, created_at desc);
create index if not exists challenges_participants_idx on public.challenges using gin (participants);
create index if not exists challenges_finalize_idx
  on public.challenges (status, end_date)
  where points_awarded = false;

alter table public.challenges enable row level security;

drop policy if exists challenges_select_participant on public.challenges;
create policy challenges_select_participant
  on public.challenges for select to authenticated
  using (
    auth.uid() = challenger_id
    or auth.uid() = challenged_id
    or auth.uid() = any (participants)
  );

-- Writes go through SECURITY DEFINER RPCs only.
revoke insert, update, delete on public.challenges from authenticated, anon;

-- ── create challenge + notify opponent ───────────────────────────────────────
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

  insert into public.notifications (
    id, uid, type, notification_type, title, message, is_read, related_id, data, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    v_peer_id,
    'challenge_request',
    'challenge_request',
    'New challenge',
    v_challenger_name || ' challenged you to a ' || v_type || ' battle.',
    false,
    v_id::text,
    jsonb_build_object('challengeId', v_id, 'challengerId', v_uid, 'type', v_type),
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

-- ── accept / decline ──────────────────────────────────────────────────────────
create or replace function public.respond_to_challenge(p_challenge_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.challenges%rowtype;
  v_status text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_challenge_id is null then
    return jsonb_build_object('ok', false, 'error', 'challenge_id_required');
  end if;
  if p_action not in ('accepted', 'declined') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action');
  end if;

  select * into v_row from public.challenges where id = p_challenge_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.challenged_id <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_row.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'already_responded');
  end if;

  v_status := case when p_action = 'accepted' then 'active' else 'declined' end;

  update public.challenges
     set status = v_status,
         responded_at = now(),
         accepted_at = case when p_action = 'accepted' then now() else null end,
         declined_at = case when p_action = 'declined' then now() else null end,
         updated_at = now()
   where id = p_challenge_id;

  insert into public.notifications (
    id, uid, type, notification_type, title, message, is_read, related_id, data, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    v_row.challenger_id,
    'challenge_response',
    'challenge_response',
    'Challenge response',
    coalesce(v_row.challenged_name, 'Your peer') || ' ' || p_action || ' your challenge.',
    false,
    p_challenge_id::text,
    jsonb_build_object('challengeId', p_challenge_id, 'action', p_action),
    now(), now()
  );

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

-- ── list my challenges ───────────────────────────────────────────────────────
create or replace function public.list_my_challenges()
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
    jsonb_agg(to_jsonb(c) order by c.created_at desc),
    '[]'::jsonb
  )
    into v_rows
  from public.challenges c
  where c.challenger_id = v_uid
     or c.challenged_id = v_uid
     or v_uid = any (c.participants);

  return jsonb_build_object('ok', true, 'challenges', coalesce(v_rows, '[]'::jsonb));
end;
$$;

-- ── cancel (participant) ─────────────────────────────────────────────────────
create or replace function public.cancel_challenge(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.challenges%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_row from public.challenges where id = p_challenge_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.challenger_id <> v_uid and v_row.challenged_id <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_row.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'already_completed');
  end if;

  update public.challenges
     set status = 'cancelled',
         cancelled_by = v_uid,
         cancelled_at = now(),
         result = jsonb_build_object('outcome', 'cancelled'),
         updated_at = now()
   where id = p_challenge_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── finalize expired active challenges (no points here — client awards) ──────
create or replace function public.finalize_expired_challenges()
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

  with due as (
    update public.challenges c
       set status = 'completed',
           updated_at = now(),
           result = coalesce(c.result, '{}'::jsonb) || jsonb_build_object('finalizedAt', now())
     where c.status = 'active'
       and c.end_date <= now()
       and (c.challenger_id = v_uid or c.challenged_id = v_uid)
    returning c.*
  )
  select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_rows from due d;

  return jsonb_build_object('ok', true, 'finalized', coalesce(v_rows, '[]'::jsonb));
end;
$$;

create or replace function public.mark_challenge_points_awarded(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  update public.challenges
     set points_awarded = true,
         updated_at = now()
   where id = p_challenge_id
     and (challenger_id = v_uid or challenged_id = v_uid)
     and status = 'completed';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.create_challenge(jsonb) from public;
revoke all on function public.respond_to_challenge(uuid, text) from public;
revoke all on function public.list_my_challenges() from public;
revoke all on function public.cancel_challenge(uuid) from public;
revoke all on function public.finalize_expired_challenges() from public;
revoke all on function public.mark_challenge_points_awarded(uuid) from public;

grant execute on function public.create_challenge(jsonb) to authenticated;
grant execute on function public.respond_to_challenge(uuid, text) to authenticated;
grant execute on function public.list_my_challenges() to authenticated;
grant execute on function public.cancel_challenge(uuid) to authenticated;
grant execute on function public.finalize_expired_challenges() to authenticated;
grant execute on function public.mark_challenge_points_awarded(uuid) to authenticated;
