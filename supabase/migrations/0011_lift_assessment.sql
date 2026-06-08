-- ============================================================================
-- T4L  ·  LIFT Assessment (one-time, first-login)
-- 0011: lift_assessments table + RLS
--
-- One row per user (uid is the PK -> enforces "once in a lifetime"). Stores the
-- full intake (Part A), all 20 item scores, the four pillar scores, the LIFT
-- Index, the deterministic archetype/development-edge, the recommended offer,
-- the lead tier (A/B/C), and whether the coaching trigger fired. Doubles as the
-- aggregate table for admin views and the future benchmark report.
--
-- Safe to re-run (idempotent). Run in the Supabase SQL editor AFTER 0001.
-- ============================================================================

create table if not exists public.lift_assessments (
  uid                 uuid primary key references public.profiles(id) on delete cascade,
  intake              jsonb  not null default '{}'::jsonb,   -- Part A answers
  item_scores         jsonb  not null default '{}'::jsonb,   -- { "L1": 3, ..., "T5": 2 }
  pillar_l            int    not null default 0,             -- 0..100
  pillar_i            int    not null default 0,
  pillar_f            int    not null default 0,
  pillar_t            int    not null default 0,
  lift_index          int    not null default 0,             -- 0..100
  archetype           text,                                  -- Anchor | Architect | Catalyst | Operator | Practitioner | Emerging Leader
  development_edge    text,                                  -- L | I | F | T | null (Practitioner)
  recommended_offer   text,                                  -- offer key/label
  lead_tier           text   check (lead_tier in ('A','B','C')),
  coaching_triggered  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists lift_assessments_archetype_idx on public.lift_assessments(archetype);
create index if not exists lift_assessments_lead_tier_idx  on public.lift_assessments(lead_tier);

drop trigger if exists lift_assessments_set_updated_at on public.lift_assessments;
create trigger lift_assessments_set_updated_at before update on public.lift_assessments
  for each row execute function public.set_updated_at();

-- ── RLS: owner reads/writes own row; partner/admin read all (admin view + aggregate) ──
alter table public.lift_assessments enable row level security;

drop policy if exists lift_assessments_select on public.lift_assessments;
create policy lift_assessments_select on public.lift_assessments for select
  using (uid = auth.uid() or public.is_partner_or_admin());

drop policy if exists lift_assessments_insert on public.lift_assessments;
create policy lift_assessments_insert on public.lift_assessments for insert
  with check (uid = auth.uid());

-- Allow the owner to update their own row (kept for safety; the app treats the
-- assessment as one-time and will not re-prompt once a row exists).
drop policy if exists lift_assessments_update on public.lift_assessments;
create policy lift_assessments_update on public.lift_assessments for update
  using (uid = auth.uid()) with check (uid = auth.uid());
