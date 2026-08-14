-- ============================================================================
-- T4L  ·  Course access unlock after learner Pre assessment
-- 0061: Persist Pre → course unlock (Wix/webhook is optional client-side).
-- ============================================================================

create table if not exists public.course_access_unlocks (
  uid uuid not null references public.profiles (id) on delete cascade,
  course_key text not null,
  course_title text,
  unlocked_at timestamptz not null default now(),
  primary key (uid, course_key)
);

create index if not exists course_access_unlocks_uid_idx
  on public.course_access_unlocks (uid);

alter table public.course_access_unlocks enable row level security;

drop policy if exists course_access_unlocks_select_own on public.course_access_unlocks;
create policy course_access_unlocks_select_own
  on public.course_access_unlocks
  for select
  to authenticated
  using (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists course_access_unlocks_insert_own on public.course_access_unlocks;
create policy course_access_unlocks_insert_own
  on public.course_access_unlocks
  for insert
  to authenticated
  with check (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists course_access_unlocks_update_own on public.course_access_unlocks;
create policy course_access_unlocks_update_own
  on public.course_access_unlocks
  for update
  to authenticated
  using (uid = auth.uid() or public.is_partner_or_admin())
  with check (uid = auth.uid() or public.is_partner_or_admin());

grant select, insert, update on public.course_access_unlocks to authenticated;
