-- ============================================================================
-- T4L  ·  Impact log verifier role + email approval
-- 0041: Verifiers (in or out of org) receive impact logs by email and
-- approve/reject. Points are awarded only on approve; reject = 0.
-- While pending, the checklist `impact_log` activity stays pending.
--
-- Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists pgcrypto;

-- Keep learner helper excluding verifier (staff-like).
create or replace function public._is_learner_role(p_role text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_role, 'user'))) in ('user', 'free_user', 'paid_member');
$$;

-- Allow `verifier` on profiles.role (drop/recreate CHECK if present).
-- Use $do$ tags so nested quotes do not collide with the outer DO body.
do $do$
declare
  r record;
  allowed text :=
    'role = any (array['
    || '''free_user''::text, ''paid_member''::text, ''mentor''::text, ''ambassador''::text, '
    || '''partner''::text, ''super_admin''::text, ''verifier''::text, ''user''::text'
    || '])';
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'profiles'
      and c.conname = 'profiles_role_check'
  ) then
    execute 'alter table public.profiles add constraint profiles_role_check check (' || allowed || ')';
  end if;
exception
  when others then
    raise notice 'profiles role check update skipped: %', sqlerrm;
end $do$;

create table if not exists public.impact_verifications (
  id uuid primary key default gen_random_uuid(),
  impact_log_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  learner_name text,
  learner_email text,
  verifier_name text not null,
  verifier_email text not null,
  verifier_role text not null default 'verifier',
  verifier_user_id uuid references public.profiles(id) on delete set null,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  week_number integer not null default 1,
  journey_type text,
  activity_title text,
  points_to_award integer not null default 1000,
  impact_summary jsonb not null default '{}'::jsonb,
  rejection_reason text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.impact_verifications
  add column if not exists points_to_award integer not null default 1000;

create index if not exists impact_verifications_user_idx
  on public.impact_verifications (user_id, created_at desc);

create index if not exists impact_verifications_status_idx
  on public.impact_verifications (status)
  where status = 'pending';

create index if not exists impact_verifications_impact_log_idx
  on public.impact_verifications (impact_log_id);

create index if not exists impact_verifications_verifier_email_idx
  on public.impact_verifications (lower(verifier_email));

alter table public.impact_verifications enable row level security;

drop policy if exists impact_verifications_select_own on public.impact_verifications;
create policy impact_verifications_select_own
  on public.impact_verifications
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = verifier_user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(p.role) in ('partner', 'super_admin', 'admin', 'company_admin')
    )
  );

-- No direct client insert/update — use SECURITY DEFINER RPCs / service role.

create or replace function public._hash_impact_token(p_token text)
returns text
language sql
immutable
as $$
  select encode(digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.create_impact_verification(
  p_impact_log_id text,
  p_verifier_name text,
  p_verifier_email text,
  p_week_number integer,
  p_journey_type text default null,
  p_activity_title text default null,
  p_impact_summary jsonb default '{}'::jsonb,
  p_learner_name text default null,
  p_learner_email text default null,
  p_points_to_award integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_id uuid;
  v_email text;
  v_name text;
  v_verifier_uid uuid;
  v_points integer := greatest(0, coalesce(p_points_to_award, 1000));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_name := nullif(trim(coalesce(p_verifier_name, '')), '');
  v_email := lower(trim(coalesce(p_verifier_email, '')));

  if p_impact_log_id is null or length(trim(p_impact_log_id)) = 0 then
    raise exception 'impact_log_id_required';
  end if;
  if v_name is null then
    raise exception 'verifier_name_required';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'verifier_email_invalid';
  end if;
  if p_week_number is null or p_week_number < 1 then
    raise exception 'week_number_invalid';
  end if;

  select id into v_verifier_uid
  from public.profiles
  where lower(trim(email)) = v_email
  limit 1;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := public._hash_impact_token(v_token);
  v_id := gen_random_uuid();

  insert into public.impact_verifications (
    id, impact_log_id, user_id, learner_name, learner_email,
    verifier_name, verifier_email, verifier_role, verifier_user_id,
    token_hash, status, week_number, journey_type, activity_title,
    points_to_award, impact_summary
  ) values (
    v_id, trim(p_impact_log_id), v_uid, p_learner_name, p_learner_email,
    v_name, v_email, 'verifier', v_verifier_uid,
    v_hash, 'pending', p_week_number, p_journey_type, p_activity_title,
    v_points, coalesce(p_impact_summary, '{}'::jsonb)
  );

  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'status', 'pending',
    'verifierEmail', v_email,
    'verifierName', v_name,
    'verifierUserId', v_verifier_uid,
    'pointsToAward', v_points
  );
end;
$$;

revoke all on function public.create_impact_verification(
  text, text, text, integer, text, text, jsonb, text, text, integer
) from public;
grant execute on function public.create_impact_verification(
  text, text, text, integer, text, text, jsonb, text, text, integer
) to authenticated;

-- Service-role / edge only: look up by raw token.
create or replace function public.get_impact_verification_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_row public.impact_verifications%rowtype;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return null;
  end if;
  v_hash := public._hash_impact_token(trim(p_token));
  select * into v_row
  from public.impact_verifications
  where token_hash = v_hash
  limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'impactLogId', v_row.impact_log_id,
    'userId', v_row.user_id,
    'learnerName', v_row.learner_name,
    'learnerEmail', v_row.learner_email,
    'verifierName', v_row.verifier_name,
    'verifierEmail', v_row.verifier_email,
    'verifierRole', v_row.verifier_role,
    'status', v_row.status,
    'weekNumber', v_row.week_number,
    'journeyType', v_row.journey_type,
    'activityTitle', v_row.activity_title,
    'pointsToAward', v_row.points_to_award,
    'impactSummary', v_row.impact_summary,
    'rejectionReason', v_row.rejection_reason,
    'resolvedAt', v_row.resolved_at,
    'createdAt', v_row.created_at
  );
end;
$$;

revoke all on function public.get_impact_verification_by_token(text) from public;
grant execute on function public.get_impact_verification_by_token(text) to service_role;

create or replace function public.resolve_impact_verification(
  p_token text,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_row public.impact_verifications%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'invalid_token';
  end if;
  if v_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  v_hash := public._hash_impact_token(trim(p_token));

  select * into v_row
  from public.impact_verifications
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'not_found';
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object(
      'id', v_row.id,
      'status', v_row.status,
      'alreadyResolved', true,
      'impactLogId', v_row.impact_log_id,
      'userId', v_row.user_id,
      'weekNumber', v_row.week_number,
      'journeyType', v_row.journey_type
    );
  end if;

  update public.impact_verifications
  set
    status = v_decision,
    rejection_reason = case when v_decision = 'rejected' then nullif(trim(coalesce(p_rejection_reason, '')), '') else null end,
    resolved_at = now(),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'alreadyResolved', false,
    'impactLogId', v_row.impact_log_id,
    'userId', v_row.user_id,
    'weekNumber', v_row.week_number,
    'journeyType', v_row.journey_type,
    'activityTitle', v_row.activity_title,
    'pointsToAward', v_row.points_to_award,
    'impactSummary', v_row.impact_summary,
    'verifierName', v_row.verifier_name,
    'verifierEmail', v_row.verifier_email
  );
end;
$$;

revoke all on function public.resolve_impact_verification(text, text, text) from public;
grant execute on function public.resolve_impact_verification(text, text, text) to service_role;
