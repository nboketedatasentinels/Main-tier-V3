-- ============================================================================
-- T4L  ·  Programme component submissions (Supabase)
-- 0014: capstone / case study / practical submissions, migrated off Firestore.
--
-- Mirrors the Firestore `programmeComponentSubmissions` collection. Learners
-- write their own row (one per artefact, upserted on resubmit); partners/admins
-- of the learner's org read + review; AI grade is written server-side by the
-- grade-submission Edge Function (service role, bypasses RLS).
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0001.
-- ============================================================================

-- ── helper: does the current user manage this org? ───────────────────────────
-- super_admin sees all; a partner manages an org if it's in their
-- profiles.data->assignedOrganizations, or they are its transformation_partner.
create or replace function public.partner_manages_org(org text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select true
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or org = any(
          coalesce(array(select jsonb_array_elements_text(p.data->'assignedOrganizations')), '{}')
        )
        or exists (
          select 1 from public.organizations o
          where o.id = org and o.transformation_partner_id = p.id::text
        )
      )
    limit 1
  ), false);
$$;

-- ── table ────────────────────────────────────────────────────────────────────
create table if not exists public.programme_component_submissions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  organization_id   text,
  component_id      text not null,
  component_type    text check (component_type in ('capstone','case_study','practical')),
  component_title   text,
  pillar            text,
  part_id           text,
  part_title        text,
  answers           jsonb not null default '{}'::jsonb,
  answer_count      int not null default 0,
  status            text not null default 'submitted'
                      check (status in ('submitted','in_review','approved','needs_revision')),
  submitted_at      timestamptz not null default now(),
  last_updated_at   timestamptz not null default now(),
  resubmitted_at    timestamptz,
  source_page       text,
  -- partner review
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.profiles(id),
  reviewer_name     text,
  partner_notes     text,
  score             numeric,
  -- AI advisory grade (written by the grade-submission Edge Function)
  ai_grade          jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- one submission per learner per artefact (upsert target)
  unique (user_id, component_id)
);

create index if not exists idx_pcs_org on public.programme_component_submissions (organization_id);
create index if not exists idx_pcs_user on public.programme_component_submissions (user_id);
create index if not exists idx_pcs_status on public.programme_component_submissions (status);

-- keep updated_at fresh
create or replace function public.pcs_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pcs_touch on public.programme_component_submissions;
create trigger trg_pcs_touch
  before update on public.programme_component_submissions
  for each row execute function public.pcs_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.programme_component_submissions enable row level security;

-- read: own rows, or a partner/admin who manages the row's org
drop policy if exists pcs_select on public.programme_component_submissions;
create policy pcs_select on public.programme_component_submissions
  for select using (
    user_id = auth.uid()
    or public.partner_manages_org(organization_id)
  );

-- insert: only your own submission
drop policy if exists pcs_insert on public.programme_component_submissions;
create policy pcs_insert on public.programme_component_submissions
  for insert with check (user_id = auth.uid());

-- update (learner resubmit): own rows
drop policy if exists pcs_update_own on public.programme_component_submissions;
create policy pcs_update_own on public.programme_component_submissions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- update (partner review): managed-org rows
drop policy if exists pcs_update_partner on public.programme_component_submissions;
create policy pcs_update_partner on public.programme_component_submissions
  for update using (public.partner_manages_org(organization_id))
  with check (public.partner_manages_org(organization_id));

-- Note: the AI grade is written by the Edge Function with the service-role key,
-- which bypasses RLS, so no policy is needed for the ai_grade column.
