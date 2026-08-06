-- ============================================================================
-- T4L  ·  Impact logs (Supabase)
-- 0049: Move learner impact_logs off Firestore.
--
-- WHY: ImpactLogPage still wrote to Firestore `impact_logs`, but after the
-- Supabase auth cutover there is no Firebase Auth session. Firestore rules
-- require `isAuthenticated()` (request.auth != null), so every submit failed
-- with "Missing or insufficient permissions" / "Unable to log impact".
--
-- Weekly Glance already reads `public.impact_logs` via `uid` + `people_impacted`.
-- This migration creates/adapts that table and adds RLS so learners can
-- insert/read/update/delete their own rows (and read org peers' rows).
--
-- Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.impact_logs (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references public.profiles(id) on delete cascade,
  company_id text,
  title text not null default 'Impact Activity',
  description text not null default '',
  activity_date date,
  hours numeric not null default 0,
  people_impacted numeric not null default 0,
  usd_value numeric not null default 0,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  -- Full camelCase payload the Impact Log UI expects (plus any extras).
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Adapt legacy / partial tables (Weekly Glance already expected uid + people_impacted).
alter table public.impact_logs
  add column if not exists uid uuid,
  add column if not exists company_id text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists activity_date date,
  add column if not exists hours numeric,
  add column if not exists people_impacted numeric,
  add column if not exists usd_value numeric,
  add column if not exists verification_status text,
  add column if not exists data jsonb,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

-- Defaults for newly added nullable columns on legacy empty tables.
alter table public.impact_logs
  alter column title set default 'Impact Activity',
  alter column description set default '',
  alter column hours set default 0,
  alter column people_impacted set default 0,
  alter column usd_value set default 0,
  alter column verification_status set default 'pending',
  alter column data set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

create index if not exists impact_logs_uid_created_idx
  on public.impact_logs (uid, created_at desc);

create index if not exists impact_logs_company_created_idx
  on public.impact_logs (company_id, created_at desc)
  where company_id is not null;

drop trigger if exists impact_logs_set_updated_at on public.impact_logs;
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    create trigger impact_logs_set_updated_at
      before update on public.impact_logs
      for each row execute function public.set_updated_at();
  end if;
exception
  when duplicate_object then null;
end $$;

alter table public.impact_logs enable row level security;

drop policy if exists impact_logs_select on public.impact_logs;
create policy impact_logs_select on public.impact_logs for select
  using (
    uid = auth.uid()
    or public.is_partner_or_admin()
    or (
      company_id is not null
      and company_id = (
        select nullif(trim(coalesce(p.company_id, p.organization_id::text, '')), '')
        from public.profiles p
        where p.id = auth.uid()
        limit 1
      )
    )
  );

drop policy if exists impact_logs_insert on public.impact_logs;
create policy impact_logs_insert on public.impact_logs for insert
  with check (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists impact_logs_update on public.impact_logs;
create policy impact_logs_update on public.impact_logs for update
  using (uid = auth.uid() or public.is_partner_or_admin())
  with check (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists impact_logs_delete on public.impact_logs;
create policy impact_logs_delete on public.impact_logs for delete
  using (uid = auth.uid() or public.is_super_admin());
