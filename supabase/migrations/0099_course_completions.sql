-- ============================================================================
-- T4L  ·  Course completion approvals (Supabase)
-- 0099: Replace Firestore `approvals` course_completion docs so partners can
--        mark LIFT course modules complete under Supabase-only auth.
-- ============================================================================

create table if not exists public.course_completions (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid null,
  course_id text not null,
  course_title text not null,
  course_slug text null,
  status text not null default 'approved'
    check (status in ('approved', 'revoked')),
  points integer not null default 0 check (points >= 0),
  week_number integer not null default 1 check (week_number >= 1),
  claim_ref text null,
  approved_by uuid null references public.profiles (id) on delete set null,
  approved_by_name text null,
  approved_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists course_completions_user_idx
  on public.course_completions (user_id, approved_at desc);

create index if not exists course_completions_org_idx
  on public.course_completions (organization_id, approved_at desc)
  where organization_id is not null;

create index if not exists course_completions_approved_by_idx
  on public.course_completions (approved_by, approved_at desc)
  where approved_by is not null;

comment on table public.course_completions is
  'Partner-verified external course completions (LIFT module). Awards checklist points via claim_ref.';

alter table public.course_completions enable row level security;

drop policy if exists course_completions_select on public.course_completions;
create policy course_completions_select on public.course_completions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_partner_or_admin()
    or public.is_super_admin()
  );

drop policy if exists course_completions_insert on public.course_completions;
create policy course_completions_insert on public.course_completions
  for insert to authenticated
  with check (
    public.is_partner_or_admin()
    or public.is_super_admin()
  );

drop policy if exists course_completions_update on public.course_completions;
create policy course_completions_update on public.course_completions
  for update to authenticated
  using (
    public.is_partner_or_admin()
    or public.is_super_admin()
  )
  with check (
    public.is_partner_or_admin()
    or public.is_super_admin()
  );

grant select, insert, update on public.course_completions to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'course_completions'
     ) then
    alter publication supabase_realtime add table public.course_completions;
  end if;
end $$;
