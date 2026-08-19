-- ============================================================================
-- T4L  ·  Mentorship goals (Supabase)
-- 0066: Session Prep / Leadership Council goals were still on Firestore and
--        returned empty under Supabase-only auth, so coach/mentor prep looked
--        static ("has not written a goal yet"). Move mentorship_goals and
--        allow learner + assigned/org mentor/coach to read & write.
-- ============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mentorship_goals'
  )
  and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mentorship_goals'
      and column_name = 'learner_id'
  ) then
    drop table if exists public.mentorship_goals cascade;
  end if;
end $$;

create table if not exists public.mentorship_goals (
  learner_id uuid primary key references public.profiles (id) on delete cascade,
  mentor_id uuid references public.profiles (id) on delete set null,
  goals text not null default '',
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentorship_goals_mentor_id_idx
  on public.mentorship_goals (mentor_id);

alter table public.mentorship_goals enable row level security;

drop policy if exists mentorship_goals_select on public.mentorship_goals;
create policy mentorship_goals_select
  on public.mentorship_goals
  for select
  to authenticated
  using (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or mentor_id = auth.uid()
    or exists (
      select 1
      from public.profiles learner
      join public.profiles me on me.id = auth.uid()
      where learner.id = mentorship_goals.learner_id
        and lower(trim(coalesce(me.role, ''))) in ('mentor', 'ambassador', 'coach')
        and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
          is not null
        and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
          = coalesce(nullif(trim(learner.company_id), ''), nullif(trim(learner.organization_id), ''))
    )
  );

drop policy if exists mentorship_goals_insert on public.mentorship_goals;
create policy mentorship_goals_insert
  on public.mentorship_goals
  for insert
  to authenticated
  with check (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or mentor_id = auth.uid()
    or exists (
      select 1
      from public.profiles learner
      join public.profiles me on me.id = auth.uid()
      where learner.id = mentorship_goals.learner_id
        and lower(trim(coalesce(me.role, ''))) in ('mentor', 'ambassador', 'coach')
        and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
          is not null
        and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
          = coalesce(nullif(trim(learner.company_id), ''), nullif(trim(learner.organization_id), ''))
    )
  );

drop policy if exists mentorship_goals_update on public.mentorship_goals;
create policy mentorship_goals_update
  on public.mentorship_goals
  for update
  to authenticated
  using (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or mentor_id = auth.uid()
    or exists (
      select 1
      from public.profiles learner
      join public.profiles me on me.id = auth.uid()
      where learner.id = mentorship_goals.learner_id
        and lower(trim(coalesce(me.role, ''))) in ('mentor', 'ambassador', 'coach')
        and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
          is not null
        and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
          = coalesce(nullif(trim(learner.company_id), ''), nullif(trim(learner.organization_id), ''))
    )
  )
  with check (
    public.is_partner_or_admin()
    or learner_id = auth.uid()
    or mentor_id = auth.uid()
    or exists (
      select 1
      from public.profiles learner
      join public.profiles me on me.id = auth.uid()
      where learner.id = mentorship_goals.learner_id
        and lower(trim(coalesce(me.role, ''))) in ('mentor', 'ambassador', 'coach')
        and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
          is not null
        and coalesce(nullif(trim(me.company_id), ''), nullif(trim(me.organization_id), ''))
          = coalesce(nullif(trim(learner.company_id), ''), nullif(trim(learner.organization_id), ''))
    )
  );

grant select, insert, update on public.mentorship_goals to authenticated;
