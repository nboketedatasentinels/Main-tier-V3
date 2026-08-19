-- ============================================================================
-- T4L  ·  Mentorship sessions (Supabase)
-- 0064: Mentor Meeting schedule was still on Firestore and returned empty under
--        Supabase-only auth. Move mentorship_sessions so mentor/learner flows work.
--
-- NOTE: Some environments already have a legacy empty schema with
-- `mentor_uid` / `learner_uid` + jsonb `data` (no `mentor_id`). CREATE TABLE IF
-- NOT EXISTS left that schema in place and later steps failed with
-- "column mentor_id does not exist". Drop + recreate when legacy.
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'mentorship_sessions'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mentorship_sessions'
      and column_name = 'mentor_id'
  ) then
    drop table if exists public.mentorship_sessions cascade;
  end if;
end $$;

create table if not exists public.mentorship_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'scheduled', 'completed', 'declined', 'cancelled')),
  topic text not null,
  request_message text,
  goals text,
  proposed_at timestamptz,
  scheduled_at timestamptz,
  meeting_link text,
  decline_reason text,
  cancellation_reason text,
  cancelled_by uuid references public.profiles (id) on delete set null,
  points_awarded boolean not null default false,
  points_awarded_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  learner_name text,
  mentor_name text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentorship_sessions_mentor_id_idx
  on public.mentorship_sessions (mentor_id, created_at desc);

create index if not exists mentorship_sessions_learner_id_idx
  on public.mentorship_sessions (learner_id, created_at desc);

create index if not exists mentorship_sessions_status_idx
  on public.mentorship_sessions (status);

alter table public.mentorship_sessions enable row level security;

drop policy if exists mentorship_sessions_select on public.mentorship_sessions;
create policy mentorship_sessions_select
  on public.mentorship_sessions
  for select
  to authenticated
  using (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or mentor_id = auth.uid()
  );

drop policy if exists mentorship_sessions_insert on public.mentorship_sessions;
create policy mentorship_sessions_insert
  on public.mentorship_sessions
  for insert
  to authenticated
  with check (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or mentor_id = auth.uid()
  );

drop policy if exists mentorship_sessions_update on public.mentorship_sessions;
create policy mentorship_sessions_update
  on public.mentorship_sessions
  for update
  to authenticated
  using (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or mentor_id = auth.uid()
  )
  with check (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or mentor_id = auth.uid()
  );

grant select, insert, update on public.mentorship_sessions to authenticated;
